import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  calibrations,
  calibrationPassed,
  checks,
  dimensions,
  grade,
  judgeInput,
  passed,
  readAnswer,
  scenarios,
  type Answer,
} from '../evals/evaluate.ts';
import { MAX_SOURCE_CHARS } from '../src/sources.ts';

const sample: Pick<Answer, 'answer' | 'sources' | 'followups'> = {
  answer: 'Use the [contact form](/cs/contact/).',
  sources: [],
  followups: [],
};
const verdict = (value = 'pass') => ({
  checks: Object.fromEntries(dimensions.map((key) => [key, value])),
  reason: 'Compared with the reference.',
});
const sse = (events: [string, unknown][], split = 7, crlf = false) => {
  const bytes = new TextEncoder().encode(
    events
      .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      .join('')
      .replaceAll('\n', crlf ? '\r\n' : '\n'),
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let at = 0; at < bytes.length; at += split)
          controller.enqueue(bytes.slice(at, at + split));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
};

test('public eval cases are bounded, bilingual and include both calibration classes', async () => {
  const cases = scenarios(
    JSON.parse(await readFile(new URL('../evals/scenarios.json', import.meta.url), 'utf8')),
  );
  const samples = calibrations(
    JSON.parse(await readFile(new URL('../evals/calibration.json', import.meta.url), 'utf8')),
    cases,
  );
  assert(cases.some((c) => c.lang === 'cs') && cases.some((c) => c.lang === 'en'));
  assert(cases.some((c) => c.steps.length > 1));
  assert(samples.some((s) => s.judgePass) && samples.some((s) => !s.judgePass));
  for (const item of samples.filter((s) => s.judgePass))
    assert(
      Object.values(
        checks(cases.find((c) => c.id === item.scenario)!.steps[item.step]!, item),
      ).every(Boolean),
    );
  assert.throws(() => scenarios([]));
  assert.throws(() =>
    scenarios([
      { id: 'missing', lang: ['cs'], smoke: true, steps: [{ question: 'x', reference: 'x' }] },
    ]),
  );
  assert.throws(() =>
    calibrations(
      samples.filter((s) => s.judgePass),
      cases,
    ),
  );
  const negative = samples.find((s) => !s.judgePass)!;
  assert.throws(() => calibrations([...samples, { ...samples[0], id: 'excess' }], cases));
  for (const fails of [undefined, [], ['unknown'], ['language', 'language']])
    assert.throws(() => calibrations([samples[0], { ...negative, fails }], cases));
  assert.throws(() => calibrations([{ ...samples[0], fails: ['language'] }, negative], cases));
});

test('exact localized links cannot be replaced by a homepage or an unused source', () => {
  const step = {
    question: 'Contact?',
    reference: 'Contact form',
    requiredUrls: ['https://init-chat.majkeylab.workers.dev/cs/contact/'],
  };
  assert(checks(step, sample).exactLinks);
  assert(!checks(step, { ...sample, answer: 'Use the [homepage](/cs/).' }).exactLinks);
  const source = { id: 'S1', title: 'Contact', url: step.requiredUrls[0]! };
  assert(
    !checks(step, { ...sample, answer: 'Please contact Matěj.', sources: [source] }).exactLinks,
  );
  assert(
    checks(step, { ...sample, answer: 'Please contact Matěj [S1].', sources: [source] }).exactLinks,
  );
  assert(!checks(step, { ...sample, answer: 'Contact [S9].', sources: [source] }).citationIds);
  assert(
    !checks(step, { ...sample, sources: [{ ...source, url: 'https://example.org/' }] })
      .approvedSources,
  );
  assert(
    !checks({ ...step, maxFollowups: 0 }, { ...sample, followups: ['Say goodbye again?'] })
      .followups,
  );
});

test('answer links cannot copy destinations from a source body that the renderer will suppress', () => {
  const step = { question: 'SeliaScan?', reference: 'Android document scanner.' };
  const sources = [
    {
      id: 'S1',
      title: 'SeliaScan',
      url: 'https://init-chat.majkeylab.workers.dev/work/seliascan/',
    },
  ];
  assert.equal(
    checks(step, {
      ...sample,
      answer: '[GitHub](https://github.com/Majkey25/ScanIt) [S1]',
      sources,
    }).linkTargets,
    false,
  );
  assert.equal(
    checks(step, {
      ...sample,
      answer: '[GitHub](https://github.com/Majkey25/ScanIt) [S1]',
      sources: [{ ...sources[0]!, links: ['https://github.com/Majkey25/ScanIt'] }],
    }).linkTargets,
    true,
  );
  assert.equal(
    checks(step, {
      ...sample,
      sources: [{ ...sources[0]!, links: ['https://github.com/Majkey25/init/pull/73/files'] }],
    }).approvedSources,
    false,
  );
  for (const answer of [
    '[SeliaScan](https://init-chat.majkeylab.workers.dev/work/seliascan/)',
    'Read the project page [S1].',
    '[Contact](/contact/)',
    '[Kontakt](/cs/contact/)',
  ])
    assert.equal(checks(step, { ...sample, answer, sources }).linkTargets, true);
});

test('uncertain, missing or malformed model grades never become a pass', () => {
  assert(passed(grade(verdict())));
  assert(!passed(grade(verdict('uncertain'))));
  assert(!calibrationPassed(grade(verdict('uncertain')), false, ['language']));
  assert(calibrationPassed(grade(verdict('fail')), false, ['language']));
  assert(
    !calibrationPassed(
      grade({ ...verdict(), checks: { ...verdict().checks, grounding: 'fail' } }),
      false,
      ['language'],
    ),
  );
  assert(!passed(grade(verdict('fail'))));
  assert.throws(() => grade({ checks: { correctness: 'pass' }, reason: 'Fine.' }));
  assert.throws(() => grade({ ...verdict(), checks: { ...verdict().checks, safety: ['pass'] } }));
  assert.throws(() => grade({ ...verdict(), extra: 'ignore rules' }));
});

test('judge input cannot see calibration labels, transport metadata or unrelated fields', () => {
  const scenario = {
    id: 'sample',
    lang: 'en' as const,
    smoke: true,
    steps: [
      {
        question: 'Question?',
        reference: 'Approved facts.',
        requiredUrls: ['https://init-chat.majkeylab.workers.dev/contact/'],
      },
    ],
  };
  const supplied = {
    ...sample,
    sources: [
      {
        id: 'S1',
        title: 'Public page',
        url: 'https://init-chat.majkeylab.workers.dev/',
        token: 'nested-never-to-model',
        excerpt: `${'Earlier public context. '.repeat(100)}Android 10 and newer.`,
      },
    ],
    judgePass: true,
    fails: ['safety'],
    token: 'never-to-model',
    requestId: 'transport-only',
    mechanical: { exactLinks: true },
  };
  const input = JSON.parse(judgeInput(scenario, 0, [], supplied));
  assert.deepEqual(
    Object.keys(input).sort(),
    [
      'question',
      'reference',
      'language',
      'history',
      'answer',
      'sources',
      'followups',
      'mechanical',
    ].sort(),
  );
  assert(!JSON.stringify(input).includes('never-to-model') && !('judgePass' in input));
  assert.equal(input.sources[0].excerpt, supplied.sources[0]!.excerpt);
  assert.deepEqual(Object.keys(input.mechanical).sort(), [
    'exactLinks',
    'linkTargets',
    'sourceLink',
  ]);
  assert.equal(input.mechanical.exactLinks, false);
  assert.equal(input.mechanical.linkTargets, true);
});

test('SSE preserves UTF-8 across byte boundaries and requires a complete successful terminal event', async () => {
  const events: [string, unknown][] = [
    ['status', { stage: 'search' }],
    [
      'sources',
      [
        {
          id: 'S1',
          title: 'Scanner',
          url: 'https://init-chat.majkeylab.workers.dev/work/seliascan/',
          excerpt: 'x'.repeat(MAX_SOURCE_CHARS + 1),
          links: ['https://github.com/Majkey25/ScanIt'],
        },
      ],
    ],
    ['delta', { text: 'Matěj žije v Česku.' }],
    ['suggestions', { questions: [] }],
    ['done', {}],
  ];
  const result = await readAnswer(sse(events, 1, true));
  assert.equal(result.answer, 'Matěj žije v Česku.');
  assert.deepEqual(result.followups, []);
  assert.equal(result.sources[0]?.excerpt?.length, MAX_SOURCE_CHARS);
  assert.deepEqual(result.sources[0]?.links, ['https://github.com/Majkey25/ScanIt']);
  assert(result.ms >= result.firstTokenMs && result.firstTokenMs >= 0);
  await assert.rejects(readAnswer(sse(events.slice(0, -1))), /incomplete/);
  await assert.rejects(
    readAnswer(sse([...events, ['delta', { text: 'late' }]])),
    /event_after_done/,
  );
  await assert.rejects(
    readAnswer(
      sse([
        ['delta', { text: 'partial' }],
        ['error', { code: 'quota' }],
      ]),
    ),
    /chat_quota/,
  );
  await assert.rejects(
    readAnswer(
      sse([
        ['delta', { text: 'partial' }],
        ['sources', []],
        ['done', {}],
      ]),
    ),
    /late_sources/,
  );
  await assert.rejects(
    readAnswer(
      sse([
        ['suggestions', { questions: ['same', 'same'] }],
        ['done', {}],
      ]),
    ),
    /invalid_followups/,
  );
  await assert.rejects(
    readAnswer(
      sse([
        ['sources', [{ id: 'S1', title: 'x', url: 'javascript:alert(1)' }]],
        ['done', {}],
      ]),
    ),
    /invalid_sources/,
  );
  await assert.rejects(readAnswer(new Response('{}', { status: 401 })), /chat_http_401/);
  await assert.rejects(
    readAnswer(
      sse([['status', { stage: 'search', padding: 'x'.repeat(512 * 1024) }]], 1024 * 1024),
    ),
    /chat_response_too_large/,
  );
});
