import assert from 'node:assert/strict';
import test from 'node:test';
import { canRetryChatError, chatErrorCode, chatErrors, chatHttpError } from '../src/chat-errors.ts';

test('chat errors preserve known causes and never expose unknown server messages', () => {
  assert.equal(chatHttpError(429, { error: 'credits' }), 'credits');
  assert.equal(chatHttpError(429, { error: 'quota' }), 'quota');
  assert.equal(chatHttpError(503, { error: 'configuration' }), 'configuration');
  assert.equal(chatHttpError(429, '<html>gateway failure</html>'), 'busy');
  assert.equal(chatHttpError(413, null), 'too_large');
  assert.equal(chatHttpError(401, {}), 'session');
  for (const raw of ['secret-canary', '__proto__', { message: 'secret-canary' }, null]) {
    assert.equal(chatErrorCode(raw), 'unavailable');
    assert.equal(chatHttpError(500, { error: raw }), 'unavailable');
  }
  for (const code of ['credits', 'quota', 'configuration', 'invalid', 'too_large'] as const)
    assert.equal(canRetryChatError(code), false);
  for (const code of ['timeout', 'challenge', 'network', 'incomplete'] as const)
    assert.equal(canRetryChatError(code), true);
  assert(chatErrors.cs.credits.includes('došly kredity'));
  assert(chatErrors.en.credits.includes('operator'));
});
