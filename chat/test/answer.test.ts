import assert from 'node:assert/strict';
import test from 'node:test';
import { streamAnswer, UpstreamError, type Message, type Settings } from '../src/answer.ts';

const env: Settings = {
  OPENAI_API_KEY: 'test-key',
  OPENAI_BASE_URL: 'https://openai.test/v1',
  OPENAI_MODEL: 'gpt-6-luna',
  OPENAI_REASONING: 'low',
};
const input: Message[] = [{ role: 'user', content: 'What is CzechCore?' }];
const questions = ['How does it work?', 'Which models does it use?', 'Where can I try it?'];
type Event = {
  type: string;
  delta?: string;
  item_id?: string;
  output_index?: number;
  content_index?: number;
  item?: { type: string; name: string; arguments: string };
  response?: { usage?: { input_tokens: number; output_tokens: number } };
};
const delta = (text: string): Event => ({
  type: 'response.output_text.delta',
  item_id: 'msg_1',
  output_index: 0,
  content_index: 0,
  delta: text,
});
const completed: Event = {
  type: 'response.completed',
  response: { usage: { input_tokens: 100, output_tokens: 40 } },
};
const sse = (events: Event[]) =>
  new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });

function stub(t: test.TestContext, response: Response) {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init: RequestInit) => {
    requests.push(init);
    return response;
  });
  return requests;
}

async function collect(signal = new AbortController().signal, search = false) {
  const stream = streamAnswer(env, input, signal, search);
  let text = '';
  let step = await stream.next();
  while (!step.done) {
    text += step.value;
    step = await stream.next();
  }
  return { text, outcome: step.value };
}

test('answer text streams before completion and returns three questions in the same request', async (t) => {
  const requests = stub(
    t,
    sse([
      delta('{"answer":"CzechCore is '),
      delta(`a proofreader [S1].","followups":${JSON.stringify(questions)}}`),
      completed,
    ]),
  );
  const stream = streamAnswer(env, input, new AbortController().signal, true);
  assert.deepEqual(await stream.next(), { value: 'CzechCore is ', done: false });
  assert.deepEqual(await stream.next(), { value: 'a proofreader [S1].', done: false });
  assert.deepEqual(await stream.next(), {
    value: { usage: completed.response?.usage, followups: questions },
    done: true,
  });
  assert.equal(requests.length, 1);
  const body = JSON.parse(String(requests[0]?.body));
  assert.deepEqual(body.text.format.schema.required, ['answer', 'followups']);
  assert.deepEqual(Object.keys(body.text.format.schema.properties), ['answer', 'followups']);
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.properties.followups.minItems, 0);
  assert.equal(body.text.format.schema.properties.followups.maxItems, 3);
  assert.equal(body.tools[0].name, 'search_web');
  assert.equal(body.tool_choice, 'auto');
  assert.equal(body.parallel_tool_calls, false);
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
});

for (const count of [0, 1, 2])
  test(`a complete answer accepts ${count} useful follow-up questions without padding`, async (t) => {
    const followups = questions.slice(0, count);
    stub(t, sse([delta(JSON.stringify({ answer: 'Answer.', followups })), completed]));
    const result = await collect();
    assert.equal(result.text, 'Answer.');
    assert.deepEqual(result.outcome.followups, followups);
  });

test('split JSON escapes, Czech text and surrogate pairs never expose JSON or broken characters', async (t) => {
  const text = 'Matěj řekl: "Ahoj".\nC:\\code\t\b\f\r 🕶️ 😀 [S1]';
  const raw = JSON.stringify({ answer: text, followups: questions }).replace('🕶', '\\ud83d\\udd76');
  stub(t, sse([...raw.split('').map(delta), completed]));
  const stream = streamAnswer(env, input, new AbortController().signal);
  let actual = '';
  let step = await stream.next();
  while (!step.done) {
    assert.ok(step.value.isWellFormed());
    actual += step.value;
    step = await stream.next();
  }
  assert.equal(actual, text);
  assert.deepEqual(step.value.followups, questions);
});

test('a search-only response returns the query and usage without invented questions', async (t) => {
  stub(
    t,
    sse([
      {
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          name: 'search_web',
          arguments: '{"query":"Matěj CzechCore"}',
        },
      },
      completed,
    ]),
  );
  assert.deepEqual(await collect(undefined, true), {
    text: '',
    outcome: { query: 'Matěj CzechCore', usage: completed.response?.usage },
  });
});

test('a provider refusal remains readable text without fabricated questions', async (t) => {
  stub(
    t,
    sse([
      { ...delta('I cannot '), type: 'response.refusal.delta' },
      { ...delta('help with that.'), type: 'response.refusal.delta' },
      completed,
    ]),
  );
  assert.deepEqual(await collect(), {
    text: 'I cannot help with that.',
    outcome: { usage: completed.response?.usage },
  });
});

const badPayloads: [string, string][] = [
  ['empty answer', JSON.stringify({ answer: ' \n', followups: questions })],
  ['missing questions', JSON.stringify({ answer: 'Answer.' })],
  [
    'too many questions',
    JSON.stringify({ answer: 'Answer.', followups: [...questions, 'One more?'] }),
  ],
  ['empty question', JSON.stringify({ answer: 'Answer.', followups: [' ', 'B?', 'C?'] })],
  ['duplicate questions', JSON.stringify({ answer: 'Answer.', followups: ['A?', ' a? ', 'C?'] })],
  [
    'long question',
    JSON.stringify({ answer: 'Answer.', followups: ['x'.repeat(161), 'B?', 'C?'] }),
  ],
  ['non-string question', JSON.stringify({ answer: 'Answer.', followups: [1, 'B?', 'C?'] })],
  ['long answer', JSON.stringify({ answer: 'x'.repeat(6001), followups: questions })],
  ['unpaired surrogate', JSON.stringify({ answer: '\ud83d', followups: questions })],
  ['extra field', JSON.stringify({ answer: 'Answer.', followups: questions, extra: true })],
  ['wrong first field', JSON.stringify({ followups: questions, answer: 'Answer.' })],
  ['truncated JSON', '{"answer":"A partial answer'],
  ['invalid escape', '{"answer":"bad\\x20","followups":["A?","B?","C?"]}'],
  ['malformed JSON', '{"answer":"Answer.","followups":}'],
  ['oversized JSON', ' '.repeat(48_001)],
];
for (const [name, raw] of badPayloads)
  test(`${name} cannot become a successful answer`, async (t) => {
    stub(t, sse([delta(raw), completed]));
    await assert.rejects(
      collect(),
      (error) => error instanceof UpstreamError && error.code === 'unavailable',
    );
  });

for (const terminal of ['response.incomplete', 'response.failed', 'error', 'disconnect'])
  test(`${terminal} cannot complete an answer or return questions`, async (t) => {
    const events = [delta(JSON.stringify({ answer: 'A partial answer.', followups: questions }))];
    if (terminal !== 'disconnect') events.push({ type: terminal });
    stub(t, sse(events));
    await assert.rejects(collect(), UpstreamError);
  });

test('separate output parts cannot be spliced into one valid answer', async (t) => {
  stub(
    t,
    sse([
      delta('{"answer":"Answer.'),
      { ...delta(`","followups":${JSON.stringify(questions)}}`), item_id: 'msg_2' },
      completed,
    ]),
  );
  await assert.rejects(collect(), UpstreamError);
});

test('a refusal cannot be mixed into a structured answer', async (t) => {
  stub(
    t,
    sse([
      delta('{"answer":"Answer.'),
      { ...delta('Refusal.'), type: 'response.refusal.delta' },
      completed,
    ]),
  );
  await assert.rejects(collect(), UpstreamError);
});

test('cancellation after visible text prevents completion and reaches the provider fetch', async (t) => {
  const controller = new AbortController();
  const requests = stub(
    t,
    sse([
      delta('{"answer":"Answer.'),
      delta(`","followups":${JSON.stringify(questions)}}`),
      completed,
    ]),
  );
  const stream = streamAnswer(env, input, controller.signal);
  assert.equal((await stream.next()).value, 'Answer.');
  controller.abort();
  await assert.rejects(stream.next(), { name: 'AbortError' });
  assert.equal(requests[0]?.signal, controller.signal);
});

test('quota failures remain explicit and do not retry', async (t) => {
  const requests = stub(
    t,
    Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }),
  );
  await assert.rejects(
    collect(),
    (error) => error instanceof UpstreamError && error.code === 'quota',
  );
  assert.equal(requests.length, 1);
});
