// Stored chat text is untrusted. Images stay in memory and never enter browser storage.
export type ChatSource = { id: string; title: string; url: string | null; excerpt?: string };
export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  images?: string[];
  imageExpired?: true;
};

export const HISTORY_LIMIT = 24;
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

export function readChatHistory(raw: string | null, now = Date.now()): ChatTurn[] {
  if (!raw || raw.length > MAX_HISTORY_CHARS) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.version !== 2 ||
      typeof value.updatedAt !== 'number' ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now ||
      now - value.updatedAt >= HISTORY_TTL_MS ||
      !Array.isArray(value.turns) ||
      value.turns.length > HISTORY_LIMIT
    )
      return [];
    const turns: ChatTurn[] = [];
    for (const turn of value.turns as unknown[]) {
      if (
        !record(turn) ||
        (turn.role !== 'user' && turn.role !== 'assistant') ||
        typeof turn.content !== 'string' ||
        (!turn.content.trim() && !(turn.role === 'user' && turn.imageExpired === true)) ||
        turn.content.length > (turn.role === 'user' ? 2000 : 6000)
      )
        return [];
      turns.push({
        role: turn.role,
        content: turn.content,
        sources: chatSources(turn.sources),
        ...(turn.role === 'user' && turn.imageExpired === true ? { imageExpired: true } : {}),
      });
    }
    return turns;
  } catch {
    return [];
  }
}

export function writeChatHistory(turns: ChatTurn[], now = Date.now()): string {
  return JSON.stringify({
    version: 2,
    updatedAt: now,
    turns: turns.slice(-HISTORY_LIMIT).map(({ role, content, sources, images, imageExpired }) => ({
      role,
      content: content.slice(0, role === 'user' ? 2000 : 6000),
      ...(sources?.length ? { sources: chatSources(sources) } : {}),
      ...(role === 'user' && (images?.length || imageExpired) ? { imageExpired: true } : {}),
    })),
  });
}
