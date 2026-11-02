import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenUsage } from '../src/metrics.ts';

test('token telemetry distinguishes unknown from zero and drops non-metric provider data', () => {
  assert.deepEqual(tokenUsage(undefined), {
    inputTokens: null,
    outputTokens: null,
    cachedTokens: null,
    reasoningTokens: null,
  });
  assert.deepEqual(
    tokenUsage({
      input_tokens: 0,
      output_tokens: 12,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 5 },
      private_data: 'not logged',
    }),
    { inputTokens: 0, outputTokens: 12, cachedTokens: 0, reasoningTokens: 5 },
  );
  assert.deepEqual(
    tokenUsage({
      input_tokens: -1,
      output_tokens: Infinity,
      input_tokens_details: { cached_tokens: '10' },
      output_tokens_details: { reasoning_tokens: 1.5 },
    }),
    tokenUsage(null),
  );
});
