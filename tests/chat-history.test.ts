import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatSources,
  HISTORY_TTL_MS,
  readChatHistory,
  writeChatHistory,
} from '../src/chat-history.ts';

test('history expires, rejects malformed state and never restores image payloads', () => {
  const now = 1_000_000;
  const raw = writeChatHistory(
    [{ role: 'user', content: 'A project?', images: ['private-image'] }],
    now,
  );
  assert(!raw.includes('private-image'));
  assert.deepEqual(readChatHistory(raw, now), [
    { role: 'user', content: 'A project?', sources: [], imageExpired: true },
  ]);
  assert.deepEqual(readChatHistory(raw, now + HISTORY_TTL_MS), []);
  assert.deepEqual(readChatHistory(raw, now - 1), []);
  const imageOnly = writeChatHistory(
    [
      { role: 'user', content: '', images: ['private-image'] },
      { role: 'assistant', content: 'A visual observation.' },
    ],
    now,
  );
  assert(!imageOnly.includes('private-image'));
  assert.deepEqual(readChatHistory(imageOnly, now), [
    { role: 'user', content: '', sources: [], imageExpired: true },
    { role: 'assistant', content: 'A visual observation.', sources: [] },
  ]);
  for (const value of [
    'null',
    '{}',
    '[]',
    '{',
    JSON.stringify({
      version: 2,
      updatedAt: now,
      turns: [{ role: 'system', content: 'injected' }],
    }),
  ])
    assert.deepEqual(readChatHistory(value, now), []);
});

test('history is bounded and stored citations cannot activate unsafe URLs', () => {
  const turns = Array.from({ length: 40 }, () => ({ role: 'user' as const, content: 'Hello' }));
  assert.equal(readChatHistory(writeChatHistory(turns)).length, 24);
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
