// Stored chat text is untrusted. Images stay in memory and never enter browser storage.
export type ChatSource = { id: string; title: string; url: string | null; excerpt?: string };
export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  images?: string[];
  imageExpired?: true;
  followups?: string[];
};
export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  saved: boolean;
  turns: ChatTurn[];
};
type History = { activeId: string | null; threads: ChatThread[] };

export const HISTORY_LIMIT = 24;
export const THREAD_LIMIT = 10;
export const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_CHARS = 2 * 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function chatSources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((source: unknown): ChatSource[] => {
    if (
      !record(source) ||
      typeof source.id !== 'string' ||
      !/^S(?:[1-9]|10)$/.test(source.id) ||
      typeof source.title !== 'string' ||
      (source.url !== null && (typeof source.url !== 'string' || source.url.length > 2048))
    )
      return [];
    if (source.url === null)
      return [
        {
          id: source.id,
          title: source.title.slice(0, 160),
          url: null,
          ...(typeof source.excerpt === 'string' ? { excerpt: source.excerpt.slice(0, 1200) } : {}),
        },
      ];
    try {
      const url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password) return [];
      return [{ id: source.id, title: source.title.slice(0, 160), url: url.href }];
    } catch {
      return [];
    }
  });
}

export function chatFollowups(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(
      (question) => typeof question === 'string' && question.trim() && question.length <= 160,
    )
  )
    return [];
  const questions = value.map((question: string) => question.trim());
  return new Set(questions).size === 3 ? questions : [];
}

function readTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length > HISTORY_LIMIT) return null;
  const turns: ChatTurn[] = [];
  for (const turn of value as unknown[]) {
    if (
      !record(turn) ||
      (turn.role !== 'user' && turn.role !== 'assistant') ||
      typeof turn.content !== 'string' ||
      (!turn.content.trim() && !(turn.role === 'user' && turn.imageExpired === true)) ||
      turn.content.length > (turn.role === 'user' ? 2000 : 6000)
    )
      return null;
    const followups = turn.role === 'assistant' ? chatFollowups(turn.followups) : [];
    turns.push({
      role: turn.role,
      content: turn.content,
      sources: chatSources(turn.sources),
      ...(turn.role === 'user' && turn.imageExpired === true ? { imageExpired: true } : {}),
      ...(followups.length ? { followups } : {}),
    });
  }
  return turns;
}

const current = (time: unknown, now: number): time is number =>
  typeof time === 'number' &&
  Number.isFinite(time) &&
  time >= 0 &&
  time <= now &&
  now - time < HISTORY_TTL_MS;

function decode(
  raw: string | null,
  savedOnly: boolean,
  now: number,
): History & { legacy?: true; version?: 3 } {
  const empty: History = { activeId: null, threads: [] };
  if (!raw || raw.length > MAX_HISTORY_CHARS) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return empty;
    if (value.version === 2 && current(value.updatedAt, now)) {
      const turns = readTurns(value.turns);
      if (!turns?.length) return empty;
      return {
        activeId: 'legacy',
        legacy: true,
        threads: [
          {
            id: 'legacy',
            title:
              turns
                .find((turn) => turn.role === 'user')
                ?.content.trim()
                .slice(0, 120) ?? '',
            updatedAt: value.updatedAt,
            saved: savedOnly,
            turns,
          },
        ],
      };
    }
    if (
      value.version !== 3 ||
      (value.activeId !== null && typeof value.activeId !== 'string') ||
      !Array.isArray(value.threads) ||
      value.threads.length > THREAD_LIMIT
    )
      return empty;
    const threads: ChatThread[] = [];
    for (const thread of value.threads as unknown[]) {
      if (
        !record(thread) ||
        typeof thread.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(thread.id) ||
        typeof thread.title !== 'string' ||
        thread.title.length > 120 ||
        !current(thread.updatedAt, now) ||
        typeof thread.saved !== 'boolean' ||
        (savedOnly && !thread.saved)
      )
        continue;
      const turns = readTurns(thread.turns);
      if (turns)
        threads.push({
          id: thread.id,
          title: thread.title,
          updatedAt: thread.updatedAt,
          saved: thread.saved,
          turns,
        });
    }
    return { activeId: value.activeId, threads, version: 3 };
  } catch {
    return empty;
  }
}

const newestActiveFirst = (activeId: string | null) => (a: ChatThread, b: ChatThread) =>
  Number(b.id === activeId) - Number(a.id === activeId) || b.updatedAt - a.updatedAt;

export function readThreads(
  sessionRaw: string | null,
  localRaw: string | null,
  now = Date.now(),
): History {
  const session = decode(sessionRaw, false, now);
  const local = decode(localRaw, true, now);
  // Version 2 had no saved flag; matching local data records its existing save choice.
  const legacy = session.threads.find((thread) => thread.id === 'legacy');
  if (
    session.legacy &&
    legacy &&
    local.threads.some((thread) => thread.id === 'legacy' && thread.updatedAt === legacy.updatedAt)
  )
    legacy.saved = true;
  // Explicit current storage records deletions; keep stale tab text without saving it again.
  if (local.version === 3) {
    const saved = new Set(local.threads.map((thread) => thread.id));
    for (const thread of session.threads) if (!saved.has(thread.id)) thread.saved = false;
  }
  const merged = new Map<string, ChatThread>();
  // Equal timestamps prefer the tab's current save choice over stale persistent state.
  for (const thread of [...local.threads, ...session.threads]) {
    const previous = merged.get(thread.id);
    if (!previous || thread.updatedAt >= previous.updatedAt) merged.set(thread.id, thread);
  }
  const activeId = session.activeId ?? local.activeId;
  const threads = [...merged.values()].sort(newestActiveFirst(activeId)).slice(0, THREAD_LIMIT);
  return {
    activeId: threads.some((thread) => thread.id === activeId)
      ? activeId
      : (threads[0]?.id ?? null),
    threads,
  };
}

export function writeThreads(
  threads: ChatThread[],
  activeId: string | null,
  savedOnly = false,
  now = Date.now(),
): string {
  const clean = threads
    .filter(
      (thread) =>
        /^[A-Za-z0-9_-]{1,80}$/.test(thread.id) &&
        current(thread.updatedAt, now) &&
        (!savedOnly || thread.saved),
    )
    .sort(newestActiveFirst(activeId))
    .slice(0, THREAD_LIMIT)
    .map((thread) => ({
      id: thread.id,
      title: thread.title.slice(0, 120),
      updatedAt: thread.updatedAt,
      saved: thread.saved,
      turns: thread.turns
        .slice(-HISTORY_LIMIT)
        .map(({ role, content, sources, images, imageExpired, followups }) => {
          const questions = role === 'assistant' ? chatFollowups(followups) : [];
          return {
            role,
            content: content.slice(0, role === 'user' ? 2000 : 6000),
            ...(sources?.length ? { sources: chatSources(sources) } : {}),
            ...(role === 'user' && (images?.length || imageExpired) ? { imageExpired: true } : {}),
            ...(questions.length ? { followups: questions } : {}),
          };
        }),
    }));
  const history = {
    version: 3,
    activeId: clean.some((thread) => thread.id === activeId) ? activeId : null,
    threads: clean,
  };
  let raw = JSON.stringify(history);
  // Retain the active chat first when unusually large source excerpts fill browser storage.
  while (raw.length > MAX_HISTORY_CHARS && clean.length) {
    if (clean.length > 1 || clean[0]!.id !== history.activeId) clean.pop();
    else clean[0]!.turns.shift();
    raw = JSON.stringify(history);
  }
  return raw;
}
