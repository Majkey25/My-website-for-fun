// The site assistant's API.
//   POST /api/session  Turnstile token in, short-lived bearer token out.
//   POST /api/chat     Conversation in, server-sent events out: status, sources, delta, done | error.
// The cron trigger refreshes the knowledge index (ingest.ts).

import {
  buildInput,
  streamAnswer,
  UpstreamError,
  type Lang,
  type Outcome,
  type Source,
  type Turn,
} from './answer.ts';
import { isImage } from './image.ts';
import { ingest } from './ingest.ts';
import { hasStrongSecret, issueSession, verifySession } from './session.ts';
import { OWNER_FILES } from './sources.ts';
import { ownerUrl, searchWeb } from './web.ts';

const MAX_BODY_BYTES = 32 * 1024;
/** Room for up to three re-encoded images; text stays bounded by the character limits. */
const MAX_CHAT_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 3;
const MAX_TURNS = 12;
const MAX_USER_CHARS = 2000;
const MAX_ASSISTANT_CHARS = 6000;
const MAX_TOTAL_CHARS = 30_000;
const MAX_SOURCES = 6;
const MAX_SOURCE_CHARS = 6000;
const ANSWER_TIMEOUT_MS = 60_000;

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const json = (body: unknown, headers: HeadersInit, status = 200) =>
  Response.json(body, { status, headers: { ...BASE_HEADERS, ...headers } });

async function readJson(request: Request, limit = MAX_BODY_BYTES): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'invalid');
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new HttpError(413, 'too_large');
  // Count the bytes too: a chunked body has no length header.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid');
  const chunks: Uint8Array[] = [];
  for (let size = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'too_large');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(await new Blob(chunks).text());
  } catch {
    throw new HttpError(400, 'invalid');
  }
}

export function parseChat(body: unknown): { turns: Turn[]; lang: Lang } {
  const invalid = new HttpError(400, 'invalid');
  if (!isRecord(body) || !Array.isArray(body.messages)) throw invalid;
  const lang = body.lang;
  if (lang !== 'cs' && lang !== 'en') throw invalid;
  const turns = body.messages.map((message: unknown): Turn => {
    if (!isRecord(message) || typeof message.content !== 'string') throw invalid;
    const { role, images } = message;
    if (role !== 'user' && role !== 'assistant') throw invalid;
    const content = message.content.trim();
    if (content.length > (role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS)) throw invalid;
    if (images === undefined) {
      if (!content) throw invalid;
      return { role, content };
    }
    // One image per visitor turn; an answer never carries one.
    if (role !== 'user' || !Array.isArray(images) || images.length > 1 || !images.every(isImage))
      throw invalid;
    if (!content && !images.length) throw invalid;
    return images.length ? { role, content, images } : { role, content };
  });
  const total = turns.reduce((sum, turn) => sum + turn.content.length, 0);
  const pictures = turns.reduce((sum, turn) => sum + (turn.images?.length ?? 0), 0);
  if (!turns.length || turns.length > MAX_TURNS || total > MAX_TOTAL_CHARS) throw invalid;
  if (pictures > MAX_IMAGES) throw invalid;
  if (turns[turns.length - 1]?.role !== 'user') throw invalid;
  return { turns, lang };
}

async function createSession(request: Request, env: Env, ip: string) {
  if (!(await env.RL_SESSION.limit({ key: ip })).success) throw new HttpError(429, 'busy');
  const body = await readJson(request);
  const token = isRecord(body) ? body.turnstile : undefined;
  if (typeof token !== 'string' || !token || token.length > 2048)
    throw new HttpError(400, 'invalid');
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  const outcome = (await res.json().catch(() => null)) as {
    success?: unknown;
    hostname?: unknown;
  } | null;
  if (outcome?.success !== true || outcome.hostname !== new URL(request.url).hostname)
    throw new HttpError(403, 'challenge');
  return issueSession(env.SESSION_SECRET);
}

/** Stop awaiting bindings that do not accept AbortSignal themselves. */
async function withAbort<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([work(), cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

/** Best chunks grouped per document, numbered S1, S2, ... in rank order. */
async function retrieve(env: Env, turns: Turn[]): Promise<Source[]> {
  const messages = turns
    .slice(-4)
    .filter(({ content }) => content.trim())
    .map(({ role, content }) => ({ role, content }));
  if (!messages.some(({ role }) => role === 'user')) return [];
  try {
    const { chunks } = await env.AI_SEARCH.get('init').search({
      // The last few turns let the query rewrite resolve follow-ups like "and the second one?".
      // Text only: images never leave for the index.
      messages,
      ai_search_options: {
        retrieval: {
          retrieval_type: 'hybrid',
          fusion_method: 'rrf',
          max_num_results: 10,
          // Calibrated against the full indexed Czech/English corpus.
          match_threshold: 0.24,
          context_expansion: 1,
          return_on_failure: false,
        },
        // The reranker filtered known English and Czech CV hits in the live probes.
        reranking: { enabled: false },
        query_rewrite: { enabled: true },
      },
    });
    console.log(
      JSON.stringify({
        event: 'retrieval',
        chunks: chunks.length,
        topScore: chunks[0]?.score ?? null,
      }),
    );
    // A replacement can finish indexing before the next crawl removes its old version.
    const versions = new Map<string, { key: string; timestamp: number }>();
    for (const chunk of chunks) {
      if (OWNER_FILES.has(chunk.item.key)) continue;
      const raw = chunk.item.metadata?.url;
      const url = typeof raw === 'string' ? ownerUrl(raw) : null;
      if (!url) continue;
      const timestamp = chunk.item.timestamp ?? 0;
      const known = versions.get(url);
      if (!known || timestamp > known.timestamp)
        versions.set(url, { key: chunk.item.key, timestamp });
    }
    const sources = new Map<string, Source>();
    for (const chunk of chunks) {
      // Uploaded documents expose their own title and excerpt, never an unrelated web link.
      const file = OWNER_FILES.get(chunk.item.key);
      const { url, title } = file ?? chunk.item.metadata ?? {};
      if (!file && (typeof url !== 'string' || !ownerUrl(url))) continue;
      if (!file && versions.get(ownerUrl(String(url))!)?.key !== chunk.item.key) continue;
      const known = sources.get(chunk.item.key);
      if (known) known.text = `${known.text}\n…\n${chunk.text}`.slice(0, MAX_SOURCE_CHARS);
      else if (sources.size < MAX_SOURCES)
        sources.set(chunk.item.key, {
          id: `S${sources.size + 1}`,
          title: typeof title === 'string' && title ? title.slice(0, 160) : String(url),
          url: file ? null : ownerUrl(String(url)),
          text: chunk.text.slice(0, MAX_SOURCE_CHARS),
        });
    }
    return [...sources.values()];
  } catch {
    // Answering without sources is still safe: the model is told to say it does not know.
    console.error(JSON.stringify({ event: 'search_failed' }));
    return [];
  }
}

async function chat(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const token = /^Bearer (\S{1,512})$/.exec(request.headers.get('authorization') ?? '')?.[1];
  const session = token ? await verifySession(env.SESSION_SECRET, token) : null;
  if (!session) throw new HttpError(401, 'session');
  if (!(await env.RL_CHAT.limit({ key: session })).success) throw new HttpError(429, 'busy');
  if (!(await env.RL_GLOBAL.limit({ key: 'global' })).success) throw new HttpError(429, 'busy');
  const { turns, lang } = parseChat(await readJson(request, MAX_CHAT_BYTES));

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event: string, data: unknown) =>
    writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  // Stop the paid upstream call when the visitor leaves, the answer stalls or a write fails.
  const stop = new AbortController();
  const signal = AbortSignal.any([
    stop.signal,
    request.signal,
    AbortSignal.timeout(ANSWER_TIMEOUT_MS),
  ]);
  const abortWriter = () => void writer.abort(signal.reason).catch(() => undefined);
  signal.addEventListener('abort', abortWriter, { once: true });
  if (signal.aborted) abortWriter();
  void writer.closed.catch(() => stop.abort());

  const listSources = (sources: Source[]) =>
    send(
      'sources',
      sources.map(({ id, title, url, text }) => ({
        id,
        title,
        url,
        ...(url === null ? { excerpt: text.slice(0, 1200) } : {}),
      })),
    );
  /** Streams one answer call to the visitor; `wrote` tells whether any text went out. */
  const relay = async (sources: Source[], search: boolean) => {
    const answer = streamAnswer(env, buildInput(turns, sources, lang), signal, search);
    let wrote = false;
    let step = await answer.next();
    while (!step.done) {
      wrote ||= step.value.trim().length > 0;
      await send('delta', { text: step.value });
      step = await answer.next();
    }
    return { ...step.value, wrote };
  };

  const run = async () => {
    const started = Date.now();
    try {
      await send('status', { stage: 'search' });
      const sources = await withAbort(() => retrieve(env, turns), signal);
      await listSources(sources);
      const usage: Outcome['usage'][] = [];
      let outcome = await relay(sources, true);
      usage.push(outcome.usage);
      // At most one web search per answer, and only when nothing was written yet.
      let web = 0;
      if (outcome.query && !outcome.wrote) {
        await send('status', { stage: 'web' });
        const found = await searchWeb(env, outcome.query, sources.length, signal);
        web = found.length;
        sources.push(...found);
        await listSources(sources);
        outcome = await relay(sources, false);
        usage.push(outcome.usage);
      }
      if (!outcome.wrote) throw new UpstreamError('unavailable');
      await send('done', {});
      console.log(
        JSON.stringify({
          event: 'answer',
          ms: Date.now() - started,
          sources: sources.length,
          web,
          images: turns.reduce((sum, turn) => sum + (turn.images?.length ?? 0), 0),
          usage,
        }),
      );
    } catch (error) {
      const timedOut =
        signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError';
      const code =
        error instanceof UpstreamError ? error.code : timedOut ? 'timeout' : 'unavailable';
      const status = error instanceof UpstreamError ? error.status : 0;
      console.error(
        JSON.stringify({ event: 'answer_failed', code, status, ms: Date.now() - started }),
      );
      await send('error', { code }).catch(() => undefined);
    } finally {
      signal.removeEventListener('abort', abortWriter);
      stop.abort();
      await writer.close().catch(() => undefined);
    }
  };
  void run();
  return new Response(readable, {
    headers: { ...BASE_HEADERS, ...cors, 'content-type': 'text/event-stream; charset=utf-8' },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get('origin');
    // The Worker's own origin (it also serves the site) plus the listed embedding sites.
    const allowed =
      origin !== null &&
      (origin === new URL(request.url).origin ||
        env.ALLOWED_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
          .includes(origin));
    const cors: Record<string, string> = allowed
      ? { 'access-control-allow-origin': origin, vary: 'origin' }
      : { vary: 'origin' };
    try {
      const { pathname } = new URL(request.url);
      if (pathname !== '/api/session' && pathname !== '/api/chat')
        throw new HttpError(404, 'not_found');
      // Browsers always send Origin on these requests; anything else is not the site.
      if (!allowed) throw new HttpError(403, 'origin');
      if (request.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: {
            ...BASE_HEADERS,
            ...cors,
            'access-control-allow-methods': 'POST',
            'access-control-allow-headers': 'authorization, content-type',
            'access-control-max-age': '600',
          },
        });
      if (request.method !== 'POST') throw new HttpError(405, 'method');
      if (!env.OPENAI_API_KEY || !env.TURNSTILE_SECRET || !hasStrongSecret(env.SESSION_SECRET)) {
        console.error(JSON.stringify({ event: 'misconfigured' }));
        throw new HttpError(503, 'unavailable');
      }
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      if (pathname === '/api/session') return json(await createSession(request, env, ip), cors);
      return await chat(request, env, cors);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code }, cors, error.status);
      console.error(JSON.stringify({ event: 'unhandled', error: `${error}` }));
      return json({ error: 'unavailable' }, cors, 500);
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(ingest(env));
  },
} satisfies ExportedHandler<Env>;
