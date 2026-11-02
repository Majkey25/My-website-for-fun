import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatFollowups,
  chatSources,
  HISTORY_LIMIT,
  HISTORY_TTL_MS,
  readThreads,
  THREAD_LIMIT,
  writeThreads,
  type ChatThread,
  type ChatTurn,
} from '../src/chat-history.ts';

const now = 1_000_000_000;
const thread = (
  id: string,
  updatedAt = now,
  saved = false,
  turns: ChatTurn[] = [{ role: 'user', content: 'Hello' }],
): ChatThread => ({ id, title: id, updatedAt, saved, turns });

test('stored history strips attachment payloads and credentials but retains markers and followups', () => {
  const followups = ['What projects?', 'What technologies?', 'What experience?'];
  const value = thread('image-chat', now, false, [
    { role: 'user', content: '', images: ['private-image'] },
    { role: 'assistant', content: 'A visual observation.', followups },
    {
      role: 'user',
      content: '',
      files: [{ filename: 'private-name.txt', file_data: 'private-file' }],
    },
  ]);
  const raw = writeThreads([value], value.id, false, now);
  assert(!raw.includes('private-image'));
  assert(!raw.includes('private-file'));
  assert(!raw.includes('private-name'));
  assert.deepEqual(readThreads(raw, null, now).threads[0]?.turns, [
    { role: 'user', content: '', sources: [], imageExpired: true },
    { role: 'assistant', content: 'A visual observation.', sources: [], followups },
    { role: 'user', content: '', sources: [], imageExpired: true },
  ]);
  const corrupt = JSON.stringify({
    version: 3,
    activeId: 'injected',
    token: 'private-token',
    threads: [
      {
        ...thread('injected'),
        token: 'private-token',
        turns: [
          {
            role: 'user',
            content: 'A project?',
            images: ['private-image'],
            token: 'private-token',
          },
        ],
      },
    ],
  });
  const recovered = readThreads(corrupt, null, now);
  const rewritten = writeThreads(recovered.threads, recovered.activeId, false, now);
  assert(!rewritten.includes('private-token'));
  assert(!rewritten.includes('private-image'));
  assert.deepEqual(chatFollowups(['Same', 'Same', 'Other']), []);
  assert.deepEqual(chatFollowups(['Same', ' same ']), []);
  assert.deepEqual(chatFollowups(['First', 'Second', 'Third', 'Fourth']), []);
  assert.deepEqual(chatFollowups(['First', 'Second', 'x'.repeat(161)]), []);
});

test('history retains zero to three followups without reviving older suggestions', () => {
  for (const count of [0, 1, 2, 3]) {
    const followups = ['First?', 'Second?', 'Third?'].slice(0, count);
    const turns: ChatTurn[] = [
      { role: 'user', content: 'A project?' },
      { role: 'assistant', content: 'Answer.', followups },
      { role: 'user', content: 'Thank you.' },
      { role: 'assistant', content: 'You are welcome.', followups: [] },
    ];
    const raw = writeThreads([thread('questions', now, true, turns)], 'questions', true, now);
    const restored = readThreads(null, raw, now).threads[0]!.turns;
    assert.deepEqual(chatFollowups(restored[1]?.followups), followups);
    assert.deepEqual(chatFollowups(restored.at(-1)?.followups), []);
  }
});

test('version 2 history migrates without losing text, image markers or an existing save choice', () => {
  const turns = [
    { role: 'user', content: 'A project?', imageExpired: true },
    { role: 'assistant', content: 'The documented answer.' },
  ];
  const raw = JSON.stringify({ version: 2, updatedAt: now, turns });
  const migrated = readThreads(raw, raw, now);
  assert.equal(migrated.activeId, 'legacy');
  assert.equal(migrated.threads.length, 1);
  assert.equal(migrated.threads[0]?.saved, true);
  assert.equal(migrated.threads[0]?.title, 'A project?');
  assert.equal(migrated.threads[0]?.updatedAt, now);
  assert.deepEqual(migrated.threads[0]?.turns, [
    { ...turns[0], sources: [] },
    { ...turns[1], sources: [] },
  ]);
  assert.equal(readThreads(raw, null, now).threads[0]?.saved, false);
  const unsaved = writeThreads([{ ...migrated.threads[0]!, saved: false }], 'legacy', false, now);
  const saved = writeThreads(migrated.threads, 'legacy', true, now);
  assert.equal(readThreads(unsaved, saved, now).threads[0]?.saved, false);
  assert.deepEqual(readThreads(raw, null, now + HISTORY_TTL_MS).threads, []);
  assert.deepEqual(readThreads(raw, null, now - 1).threads, []);
});

test('merging prefers newer data and preserves the tab save choice on equal timestamps', () => {
  const session = writeThreads([thread('same'), thread('tab')], 'tab', false, now);
  const local = JSON.stringify({
    version: 3,
    activeId: 'same',
    threads: [thread('same', now, true), thread('saved', now, true), thread('not-saved')],
  });
  const merged = readThreads(session, local, now);
  assert.equal(merged.activeId, 'tab');
  assert.equal(merged.threads.find((item) => item.id === 'same')?.saved, false);
  assert(!merged.threads.some((item) => item.id === 'not-saved'));
  const savedRaw = writeThreads(merged.threads, merged.activeId, true, now + 100);
  const saved = readThreads(null, savedRaw, now + 100);
  assert.deepEqual(
    saved.threads.map((item) => item.id),
    ['saved'],
  );
  assert.equal(saved.threads[0]?.updatedAt, now);
  assert.equal(JSON.parse(savedRaw).activeId, null);
  const newer = writeThreads([thread('same', now + 1, true)], 'same', true, now + 1);
  assert.equal(
    readThreads(session, newer, now + 1).threads.find((item) => item.id === 'same')?.updatedAt,
    now + 1,
  );
});

test('a deleted saved chat remains readable in a stale tab without being saved again', () => {
  const stale = writeThreads([thread('deleted', now, true)], 'deleted', false, now);
  const empty = writeThreads([], null, true, now);
  const restored = readThreads(stale, empty, now);
  assert.equal(restored.activeId, 'deleted');
  assert.equal(restored.threads[0]?.saved, false);
  assert.equal(restored.threads[0]?.turns[0]?.content, 'Hello');
  assert.deepEqual(
    readThreads(null, writeThreads(restored.threads, 'deleted', true, now), now).threads,
    [],
  );
  // A missing or unreadable persistent envelope does not establish a deletion.
  for (const unavailable of [null, '{'])
    assert.equal(readThreads(stale, unavailable, now).threads[0]?.saved, true);
});

test('each conversation expires independently and corrupt state cannot become a chat', () => {
  const raw = JSON.stringify({
    version: 3,
    activeId: 'expired',
    threads: [
      thread('expired', now - HISTORY_TTL_MS, true),
      thread('future', now + 1, true),
      thread('valid', now - 20, true),
      { ...thread('bad-role'), turns: [{ role: 'system', content: 'injected' }] },
    ],
  });
  const result = readThreads(raw, null, now);
  assert.deepEqual(
    result.threads.map((item) => item.id),
    ['valid'],
  );
  assert.equal(result.activeId, 'valid');
  assert.equal(result.threads[0]?.updatedAt, now - 20);
  for (const invalid of ['null', '{}', '[]', '{', 'x'.repeat(2 * 1024 * 1024 + 1)])
    assert.deepEqual(readThreads(invalid, invalid, now), { activeId: null, threads: [] });
  const empty = writeThreads([thread('empty', now, false, [])], 'empty', false, now);
  assert.equal(readThreads(empty, null, now).activeId, 'empty');
});

test('thread and message caps preserve the active chat without mutating live state', () => {
  const turns: ChatTurn[] = Array.from({ length: 40 }, () => ({ role: 'user', content: 'Hello' }));
  const threads = Array.from({ length: 15 }, (_, index) =>
    thread(`chat-${index}`, now - index, false, turns),
  );
  const raw = writeThreads(threads, 'chat-14', false, now);
  const result = readThreads(raw, null, now);
  assert.equal(result.threads.length, THREAD_LIMIT);
  assert.equal(result.activeId, 'chat-14');
  assert.equal(result.threads[0]?.turns.length, HISTORY_LIMIT);
  assert.equal(threads[0]?.turns.length, 40);
  assert.equal(threads[14]?.updatedAt, now - 14);
  const dense: ChatTurn[] = Array.from({ length: HISTORY_LIMIT }, () => ({
    role: 'assistant',
    content: '\u0001'.repeat(6000),
    sources: Array.from({ length: 10 }, (_, index) => ({
      id: `S${index + 1}`,
      title: 'CV document',
      url: null,
      excerpt: '\u0001'.repeat(1200),
      links: Array.from(
        { length: 10 },
        (_, link) => `https://github.com/Majkey25/${link}${'x'.repeat(1950)}`,
      ),
    })),
  }));
  const bounded = writeThreads(
    [thread('active', now, false, dense), thread('old', now - 1, false, dense)],
    'active',
    false,
    now,
  );
  assert(bounded.length <= 2 * 1024 * 1024);
  const restored = readThreads(bounded, null, now);
  assert.equal(restored.activeId, 'active');
  assert(restored.threads[0]?.turns.length);
  assert.equal(dense.length, HISTORY_LIMIT);
});

test('stored citations cannot activate unsafe URLs and private-file excerpts remain available', () => {
  assert.equal(
    chatSources([{ id: 'S1', title: 'CV', url: null, excerpt: 'x'.repeat(6000) }])[0]?.excerpt
      ?.length,
    1200,
  );
  const sources = [
    { id: 'S1', title: 'Safe', url: 'https://github.com/Majkey25' },
    { id: 'S2', title: 'Script', url: 'javascript:alert(1)' },
    { id: 'S3', title: 'Credentials', url: 'https://user:password@example.com/' },
    { id: 'S4', title: 'Data', url: 'data:text/html,test' },
  ];
  assert.deepEqual(chatSources(sources), [sources[0]]);
  assert.deepEqual(
    chatSources([
      { id: 'S10', title: 'CV document', url: null, excerpt: 'Page 1: professional experience' },
    ]),
    [{ id: 'S10', title: 'CV document', url: null, excerpt: 'Page 1: professional experience' }],
  );
});

test('source links survive history while URL excerpts stay transient', () => {
  const links = ['https://github.com/Majkey25/ScanIt'];
  const sources = [
    {
      id: 'S1',
      title: 'Scanner',
      url: 'https://init-chat.majkeylab.workers.dev/work/seliascan/',
      links,
      excerpt: 'Transient web evidence',
    },
    { id: 'S2', title: 'Approved file', url: null, links, excerpt: 'Approved file evidence' },
  ];
  const value = thread('links', now, true, [
    { role: 'assistant', content: '[Repository](https://github.com/Majkey25/ScanIt)', sources },
  ]);
  const raw = writeThreads([value], value.id, true, now);
  assert(!raw.includes('Transient web evidence'));
  assert.deepEqual(readThreads(null, raw, now).threads[0]?.turns[0]?.sources, [
    { id: 'S1', title: sources[0]!.title, url: sources[0]!.url, links },
    sources[1],
  ]);
  for (const invalid of [
    'not an array',
    [null],
    ['javascript:alert(1)'],
    ['https://user:password@example.org/'],
    ['https://GITHUB.com/Majkey25'],
    ['https://example.org/' + 'x'.repeat(2048)],
    Array.from({ length: 11 }, () => links[0]),
  ])
    for (const source of sources)
      assert.deepEqual(chatSources([{ ...source, links: invalid }]), []);
});
