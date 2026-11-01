// The knowledge crawl: fetch the allowed sources, upload what changed to AI Search and remove
// what disappeared. Item names are `<url hash>-<content hash>.<ext>`, so a listing alone says
// which documents changed; no extra store is needed.

import { DOCUMENTS, SITEMAPS, USER_AGENT } from './sources.ts';
import { ownerUrl } from './web.ts';

const MAX_BYTES = 4 * 1024 * 1024; // AI Search limit for HTML and PDFs without OCR.
const MAX_CONTROL_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;
const MAX_FETCHES = 45; // Stay below Workers Free's 50 external subrequests, including redirects.
const PRODUCT_TOKEN = 'init-chat-crawler';
const EXTENSIONS = {
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'md',
  'application/pdf': 'pdf',
} as const;

type Extension = (typeof EXTENSIONS)[keyof typeof EXTENSIONS];
type Doc = { body: ArrayBuffer; ext: Extension; type: string; title: string };
export type Rules = { allow: string[]; disallow: string[] };

/** robots.txt rules for this crawler (RFC 9309): its own group if named, otherwise `*`. */
export function parseRobots(text: string): Rules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let readingAgents = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!readingAgents || !group) groups.push((group = { agents: [], allow: [], disallow: [] }));
      group.agents.push(value.toLowerCase());
      readingAgents = true;
      continue;
    }
    readingAgents = false;
    if (group && value && (field === 'allow' || field === 'disallow')) group[field].push(value);
  }
  const own = groups.filter((g) => g.agents.includes(PRODUCT_TOKEN));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes('*'));
  return {
    allow: chosen.flatMap((g) => g.allow),
    disallow: chosen.flatMap((g) => g.disallow),
  };
}

const patternMatches = (pattern: string, path: string) => {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
};

/** The longest matching rule wins; on a tie, allow wins. */
export function isAllowed(rules: Rules, path: string): boolean {
  const longest = (list: string[]) =>
    Math.max(-1, ...list.filter((p) => patternMatches(p, path)).map((p) => p.length));
  return longest(rules.allow) >= longest(rules.disallow);
}

const hex = async (data: string | ArrayBuffer) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        typeof data === 'string' ? new TextEncoder().encode(data) : data,
      ),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * The page's own content: its <main> element without forms. Navigation, the footer, the
 * assistant's own panel and the question boxes would otherwise match every query.
 */
export function mainContent(html: string): string {
  const start = html.search(/<main[\s>]/i);
  const end = html.lastIndexOf('</main>');
  const main = start >= 0 && end > start ? html.slice(start, end + '</main>'.length) : html;
  return main.replace(/<form\b[\s\S]*?<\/form>/gi, '');
}

const decodeEntities = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function titleOf(body: ArrayBuffer, ext: Extension, url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).pop() ?? url.host;
  let fallback = segment;
  try {
    fallback = decodeURIComponent(segment);
  } catch {
    // A malformed escape such as "%zz" stays as it is.
  }
  if (ext === 'pdf') return fallback;
  const text = new TextDecoder().decode(body.slice(0, 64 * 1024));
  const match =
    ext === 'html' ? /<title[^>]*>([^<]{1,200})<\/title>/i.exec(text) : /^#\s+(.+)$/m.exec(text);
  return match?.[1] ? decodeEntities(match[1]).trim().slice(0, 160) : fallback;
}

async function readBody(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get('content-length') ?? 0) > limit) {
    await response.body?.cancel();
    throw new Error('Source exceeds byte limit');
  }
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Source exceeds byte limit');
      chunks.push(new Uint8Array(value));
    }
    return await new Blob(chunks).arrayBuffer();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function ingest(env: Pick<Env, 'AI_SEARCH' | 'ASSETS'>) {
  const index = env.AI_SEARCH.get('init');
  const hosts = new Set([...SITEMAPS, ...DOCUMENTS].map((u) => new URL(u).host));
  const scopes = SITEMAPS.map((url) => new URL('.', url));
  let budget = MAX_FETCHES;
  // False when part of the source list could not be read; then nothing is deleted this run.
  let complete = true;
  const get = async (url: string, respectRobots = false): Promise<Response> => {
    const signal = AbortSignal.timeout(15_000);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = new URL(url);
      if (
        target.protocol !== 'https:' ||
        !hosts.has(target.host) ||
        target.username ||
        target.password
      ) {
        if (respectRobots) return new Response(null, { status: 410 });
        throw new Error('Source outside allowed hosts');
      }
      if (respectRobots) {
        if (!ownerUrl(target.href)) return new Response(null, { status: 410 });
        const rules = await rulesFor(target.host);
        if (!rules) throw new Error('Robots unavailable');
        if (!isAllowed(rules, target.pathname + target.search))
          return new Response(null, { status: 410 });
      }
      if (budget-- <= 0) throw new Error('Fetch budget for this run is spent');
      // Use the bound site files; a self-fetch can re-enter the API handler in preview.
      const fetchSource =
        target.origin === scopes[0]?.origin ? env.ASSETS.fetch.bind(env.ASSETS) : fetch;
      const response = await fetchSource(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'manual',
        signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Redirect has no location');
      url = new URL(location, target).href;
    }
    throw new Error('Too many redirects');
  };

  const robots = new Map<string, Rules | null>();
  const rulesFor = async (host: string): Promise<Rules | null> => {
    const known = robots.get(host);
    if (known !== undefined) return known;
    let rules: Rules | null = { allow: [], disallow: [] };
    try {
      const res = await get(`https://${host}/robots.txt`);
      if (res.ok)
        rules = parseRobots(new TextDecoder().decode(await readBody(res, MAX_CONTROL_BYTES)));
      // An unreachable robots.txt means "assume everything is disallowed" (RFC 9309). That is
      // a temporary state, so this run must not delete what it could not read.
      else if (res.status >= 500) {
        rules = null;
        complete = false;
      }
    } catch {
      rules = null;
      complete = false;
    }
    robots.set(host, rules);
    return rules;
  };

  const urls = new Set(DOCUMENTS);
  for (const sitemap of SITEMAPS) {
    try {
      const res = await get(sitemap);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = new TextDecoder().decode(await readBody(res, MAX_CONTROL_BYTES));
      for (const [, loc] of text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const url = new URL(decodeEntities(loc ?? ''));
        if (
          scopes.some(
            (scope) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname),
          )
        )
          urls.add(url.href);
      }
    } catch (error) {
      complete = false;
      console.error(JSON.stringify({ event: 'ingest_sitemap_failed', sitemap, error: `${error}` }));
    }
  }

  const fetchDoc = async (url: string): Promise<Doc | 'gone' | 'failed'> => {
    let res: Response;
    try {
      res = await get(url, true);
    } catch {
      return 'failed';
    }
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) return 'failed';
    const final = new URL(res.url || url);
    const type = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const ext = EXTENSIONS[type as keyof typeof EXTENSIONS];
    if (!ext) {
      await res.body?.cancel();
      return 'gone';
    }
    const raw = await readBody(res, MAX_BYTES);
    const title = titleOf(raw, ext, final);
    const body =
      ext === 'html'
        ? await new Blob([mainContent(new TextDecoder().decode(raw))]).arrayBuffer()
        : raw;
    return { body, ext, type, title };
  };

  // Every listed version per URL id: a failed delete in an earlier run can leave two. Items with
  // other names were uploaded by hand (see OWNER_FILES) and are never touched.
  const existing = new Map<string, AiSearchItemInfo[]>();
  for (let page = 1; ; page++) {
    const { result } = await index.items.list({ page, per_page: 50 });
    for (const item of result) {
      if (!/^[0-9a-f]{16}-[0-9a-f]{16}\.(?:html|md|pdf)$/.test(item.key)) continue;
      const id = item.key.split('-')[0] ?? item.key;
      existing.set(id, [...(existing.get(id) ?? []), item]);
    }
    if (result.length < 50) break;
  }

  const keep = new Set<string>();
  // Recheck previously discovered pages even after they vanish from the sitemap.
  for (const versions of existing.values()) {
    for (const item of versions) {
      const url = item.metadata?.url;
      if (typeof url !== 'string') continue;
      try {
        const target = new URL(url);
        if (
          scopes.some(
            (scope) => target.origin === scope.origin && target.pathname.startsWith(scope.pathname),
          )
        )
          urls.add(target.href);
      } catch {
        // Unusable legacy metadata does not authorize another fetch.
      }
    }
  }
  const report = {
    urls: urls.size,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    deleted: 0,
    complete: true,
  };
  const remove = async (items: AiSearchItemInfo[]) => {
    for (const item of items) {
      await index.items.delete(item.id);
      report.deleted++;
    }
  };
  // Removing a listed document is an explicit withdrawal, even during a partial site crawl.
  for (const [id, versions] of existing) {
    const withdrawn = versions.filter((item) => {
      const source = item.metadata?.url;
      if (typeof source !== 'string' || urls.has(source)) return false;
      try {
        const target = new URL(source);
        return !scopes.some(
          (scope) => target.origin === scope.origin && target.pathname.startsWith(scope.pathname),
        );
      } catch {
        return false;
      }
    });
    try {
      await remove(withdrawn);
      const remaining = versions.filter((item) => !withdrawn.includes(item));
      if (remaining.length) existing.set(id, remaining);
      else existing.delete(id);
    } catch (error) {
      report.failed++;
      complete = false;
      console.error(JSON.stringify({ event: 'ingest_delete_failed', id, error: `${error}` }));
    }
  }
  // Start each refresh at the next batch, reserving a fetch per uncached robots.txt.
  const queue = [...urls];
  const robotHosts = new Set(
    queue.map((url) => new URL(url).host).filter((host) => !robots.has(host)),
  );
  const batchSize = Math.max(1, budget - robotHosts.size);
  const batches = Math.max(1, Math.ceil(queue.length / batchSize));
  const run = Math.floor(Date.now() / 21_600_000);
  // Move the sweep by one page too, so redirect-heavy batches cannot always miss the same ends.
  const offset = ((run % batches) * batchSize + Math.floor(run / batches)) % queue.length;
  for (let step = 0; step < queue.length; step++) {
    const url = queue[(offset + step) % queue.length]!;
    const id = (await hex(url)).slice(0, 16);
    if (budget <= 0) {
      report.skipped++;
      complete = false;
      if (existing.has(id)) keep.add(id);
      continue;
    }
    // A body that times out mid-download throws; it counts as a failed fetch.
    const doc = await fetchDoc(url).catch(() => 'failed' as const);
    if (doc === 'failed') {
      if (budget < 0) {
        report.skipped++;
        complete = false;
      } else report.failed++;
      if (existing.has(id)) keep.add(id);
      continue;
    }
    if (doc === 'gone') {
      try {
        await remove(existing.get(id) ?? []);
        existing.delete(id);
      } catch (error) {
        report.failed++;
        complete = false;
        console.error(JSON.stringify({ event: 'ingest_delete_failed', id, error: `${error}` }));
      }
      continue;
    }
    keep.add(id);
    // The title lives outside <main>, so it is part of what counts as a change.
    const digest = await hex(await new Blob([doc.title, '\n', doc.body]).arrayBuffer());
    const name = `${id}-${digest.slice(0, 16)}.${doc.ext}`;
    let versions = [...(existing.get(id) ?? [])].sort(
      (a, b) => (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0),
    );
    try {
      let current = versions.find((item) => item.key === name);
      if (current && ['error', 'skipped', 'outdated'].includes(current.status)) {
        await remove([current]);
        versions = versions.filter((item) => item.key !== name);
        current = undefined;
      }
      if (!current) {
        const fallback =
          versions.find((item) => item.status === 'completed') ??
          versions.find((item) => item.status === 'queued' || item.status === 'running');
        // Failed cleanup must block new uploads, rather than grow another queued version.
        await remove(versions.filter((item) => item.id !== fallback?.id));
        versions = fallback ? [fallback] : [];
        current = await index.items.upload(name, new Blob([doc.body], { type: doc.type }), {
          metadata: { url, title: doc.title },
        });
        report.uploaded++;
      }
      // Keep one working fallback and the current candidate; superseded queues cannot accumulate.
      const fallback =
        current.status === 'completed'
          ? undefined
          : versions.find((item) => item.status === 'completed');
      await remove(versions.filter((item) => item.key !== name && item.id !== fallback?.id));
    } catch (error) {
      // One bad document must not stop the crawl; deletions wait for a clean run.
      report.failed++;
      complete = false;
      console.error(JSON.stringify({ event: 'ingest_item_failed', url, error: `${error}` }));
    }
  }

  // A crawl that lost more than half of the index is more likely broken than real.
  report.complete = complete && keep.size >= existing.size / 2;
  if (report.complete)
    for (const [id, items] of existing) {
      if (keep.has(id)) continue;
      await remove(items).catch((error: unknown) => {
        report.failed++;
        console.error(JSON.stringify({ event: 'ingest_delete_failed', id, error: `${error}` }));
      });
    }
  console.log(JSON.stringify({ event: 'ingest', ...report }));
  return report;
}
