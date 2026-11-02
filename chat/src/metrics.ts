export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
};

/** Missing counts are unknown, not zero; never log arbitrary provider fields. */
export function tokenUsage(value: unknown): TokenUsage {
  const record = (input: unknown): Record<string, unknown> =>
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const count = (input: unknown) =>
    typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 ? input : null;
  const usage = record(value);
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cachedTokens: count(record(usage.input_tokens_details).cached_tokens),
    reasoningTokens: count(record(usage.output_tokens_details).reasoning_tokens),
  };
}
