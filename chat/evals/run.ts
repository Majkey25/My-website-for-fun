import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { hasStrongSecret, issueSession } from '../src/session.ts';
import { tokenUsage, type TokenUsage } from '../src/metrics.ts';
import {
  SITE,
  calibrations,
  calibrationPassed,
  checks,
  grade,
  judgeFormat,
  judgeInput,
  judgeInstructions,
  passed,
  readAnswer,
  record,
  scenarios,
  type Answer,
  type Grade,
  type HistoryTurn,
  type Scenario,
  type Dimension,
} from './evaluate.ts';

const mode = process.argv[2],
  suite = process.argv[3] ?? 'smoke',
  repeats = Number(process.argv[4] ?? 1);
const reportPath = fileURLToPath(
  new URL('../../.reference/tmp/chat-evals/report.json', import.meta.url),
);
const started = Date.now(),
  deadline = started + 15 * 60_000;
type Judged = { grade: Grade; usage: TokenUsage };
type Result = Judged & {
  scenario: string;
  lang: string;
  repeat: number;
  step: number;
  passed: boolean;
  response: Answer;
  checks: Record<string, boolean>;
};
type CalibrationResult = Judged & {
  id: string;
  expected: boolean;
  expectedFailures: readonly Dimension[];
  actual: boolean;
  passed: boolean;
  checks: Record<string, boolean>;
};
const results: Result[] = [];
const report: {
  schema: number;
  startedAt: string;
  revision: string | null;
  target: string;
  workerVersion: string | null;
  workerRevision: string | null;
  dataset: string;
  judgeModel: string;
  judgeReasoning: string;
  mode: string;
  suite: string;
  repeats: number;
  completed: boolean;
  passed: boolean;
  active: {
    phase: 'calibration' | 'chat' | 'judge';
    id: string;
    repeat?: number;
    step?: number;
    requestId?: string | null;
    response?: Answer;
  } | null;
  error?: string;
  durationMs?: number;
  calibration: CalibrationResult[];
  results: Result[];
  summary?: {
    samples: number;
    passed: number;
    totalMs: { p50: number | null; p95: number | null };
    firstTokenMs: { p50: number | null; p95: number | null };
  };
} = {
  schema: 1,
  startedAt: new Date(started).toISOString(),
  revision: process.env.GITHUB_SHA ?? null,
  target: SITE,
  workerVersion: null,
  workerRevision: null,
  dataset: '',
  judgeModel: process.env.EVAL_MODEL ?? 'gpt-6-luna',
  judgeReasoning: 'medium',
  mode: mode ?? '',
  suite,
  repeats,
  completed: false,
  passed: false,
  active: null,
  calibration: [],
  results,
};
let lastRequest = 0;
const save = async () => {
  await mkdir(dirname(reportPath), { recursive: true });
  // Excerpts may inform the judge, but must never enter retained reports.
  await writeFile(
    reportPath,
    JSON.stringify(
      report,
      (key: string, value: unknown) => (key === 'excerpt' ? undefined : value),
      2,
    ) + '\n',
  );
};
const signal = () => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('run_deadline');
  return AbortSignal.timeout(Math.min(65_000, remaining));
};
const errorCode = (error: unknown) =>
  error instanceof Error && error.name === 'TimeoutError'
    ? 'call_timeout'
    : error instanceof SyntaxError
      ? 'invalid_json'
      : error instanceof Error &&
          /^(?:invalid_[a-z_]+|missing_[a-z_]+|unknown_[a-z_]+|incomplete_[a-z_]+|chat_(?:http_\d{3}|[a-z_]+)|judge_(?:http_\d{3}|[a-z_]+)|calibration_failed|behavior_failed|run_deadline|late_sources|event_after_done)$/.test(
            error.message,
          )
        ? error.message
        : 'run_error';

async function judge(
  scenario: Scenario,
  step: number,
  history: HistoryTurn[],
  response: Pick<Answer, 'answer' | 'sources' | 'followups'>,
) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    redirect: 'error',
    signal: signal(),
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: report.judgeModel,
      reasoning: { effort: report.judgeReasoning },
      instructions: judgeInstructions,
      input: judgeInput(scenario, step, history, response),
      text: { format: judgeFormat },
      max_output_tokens: 2000,
      store: false,
    }),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`judge_http_${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('judge_empty_body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '';
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 128 * 1024) throw new Error('judge_response_too_large');
      raw += decoder.decode(next.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body: unknown = JSON.parse(raw + decoder.decode());
  if (!record(body) || body.status !== 'completed' || !Array.isArray(body.output))
    throw new Error('judge_incomplete');
  const parts: string[] = [];
  for (const item of body.output as unknown[])
    if (record(item) && item.type === 'message' && Array.isArray(item.content))
      for (const part of item.content as unknown[])
        if (record(part) && part.type === 'output_text' && typeof part.text === 'string')
          parts.push(part.text);
  const result = grade(JSON.parse(parts.join('')));
  return {
    grade: result,
    usage: tokenUsage(body.usage),
  };
}

async function main() {
  if (
    !['calibrate', 'live'].includes(mode ?? '') ||
    !['smoke', 'full'].includes(suite) ||
    !Number.isInteger(repeats) ||
    repeats < 1 ||
    repeats > 3
  )
    throw new Error('invalid_arguments');
  if (!process.env.OPENAI_API_KEY) throw new Error('missing_openai_key');
  if (mode === 'live' && !hasStrongSecret(process.env.SESSION_SECRET))
    throw new Error('missing_session_secret');
  const [rawCases, rawCalibration] = await Promise.all([
    readFile(new URL('./scenarios.json', import.meta.url), 'utf8'),
    readFile(new URL('./calibration.json', import.meta.url), 'utf8'),
  ]);
  const cases = scenarios(JSON.parse(rawCases)),
    samples = calibrations(JSON.parse(rawCalibration), cases);
  const selected = cases.filter((c) => suite === 'full' || c.smoke);
  if (!selected.length) throw new Error('missing_scenarios');
  report.dataset = createHash('sha256').update(rawCases).update(rawCalibration).digest('hex');
  if (mode === 'live') {
    const probe = await fetch(`${SITE}/api/chat`, {
      method: 'POST',
      redirect: 'error',
      signal: signal(),
      headers: { origin: SITE, 'content-type': 'application/json' },
      body: '{}',
    });
    report.workerVersion = probe.headers.get('x-worker-version');
    report.workerRevision = probe.headers.get('x-worker-revision');
    await probe.body?.cancel();
    if (
      probe.status !== 401 ||
      !report.workerVersion ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(report.workerVersion) ||
      !report.workerRevision ||
      !/^[a-f0-9]{40}$/i.test(report.workerRevision)
    )
      throw new Error('chat_preflight_failed');
  }
  const requests =
    mode === 'live' ? selected.reduce((sum, c) => sum + c.steps.length, 0) * repeats : 0;
  console.log(
    `Calibration samples: ${samples.length}; planned chat requests: ${requests}; OpenAI Responses request upper bound: ${samples.length + requests * 4}; web-tool call upper bound: ${requests * 2}. Existing quota or credits only.`,
  );
  await save();
  for (const sample of samples) {
    report.active = { phase: 'calibration', id: sample.id };
    const scenario = cases.find((c) => c.id === sample.scenario)!;
    const history: HistoryTurn[] = scenario.steps.slice(0, sample.step).flatMap((step) => [
      { role: 'user' as const, content: step.question },
      { role: 'assistant' as const, content: step.reference },
    ]);
    const judged = await judge(scenario, sample.step, history, sample);
    const actual = passed(judged.grade),
      deterministic = checks(scenario.steps[sample.step]!, sample);
    const ok =
      calibrationPassed(judged.grade, sample.judgePass, sample.fails) &&
      (!sample.judgePass || Object.values(deterministic).every(Boolean));
    report.calibration.push({
      id: sample.id,
      expected: sample.judgePass,
      expectedFailures: sample.fails ?? [],
      actual,
      passed: ok,
      checks: deterministic,
      ...judged,
    });
    report.active = null;
    await save();
    console.log(`calibrate ${sample.id}: ${ok ? 'pass' : 'fail'}`);
    if (!ok) throw new Error('calibration_failed');
  }
  if (mode === 'live')
    for (let repeat = 1; repeat <= repeats; repeat++)
      for (const scenario of selected) {
        // Owner-operated CI uses the existing issuer; no public auth exception or limiter bypass.
        const { token } = await issueSession(process.env.SESSION_SECRET!);
        const history: HistoryTurn[] = [];
        for (let step = 0; step < scenario.steps.length; step++) {
          report.active = { phase: 'chat', id: scenario.id, repeat, step };
          await delay(Math.max(0, 6000 - (Date.now() - lastRequest)));
          signal();
          history.push({ role: 'user', content: scenario.steps[step]!.question });
          lastRequest = Date.now();
          const before = performance.now();
          const res = await fetch(`${SITE}/api/chat`, {
            method: 'POST',
            redirect: 'error',
            signal: signal(),
            headers: {
              origin: SITE,
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ lang: scenario.lang, messages: history }),
          });
          report.active.requestId = res.headers.get('x-request-id');
          if (
            res.headers.get('x-worker-version') !== report.workerVersion ||
            res.headers.get('x-worker-revision') !== report.workerRevision
          ) {
            await res.body?.cancel();
            throw new Error('chat_version_changed');
          }
          const response = await readAnswer(res, before),
            deterministic = checks(scenario.steps[step]!, response);
          report.active = {
            phase: 'judge',
            id: scenario.id,
            repeat,
            step,
            requestId: response.requestId,
            response,
          };
          await save();
          const judged = await judge(scenario, step, history.slice(0, -1), response);
          const ok = Object.values(deterministic).every(Boolean) && passed(judged.grade);
          const result = {
            scenario: scenario.id,
            lang: scenario.lang,
            repeat,
            step,
            passed: ok,
            response,
            checks: deterministic,
            ...judged,
          };
          results.push(result);
          report.active = null;
          await save();
          console.log(`live ${scenario.id} ${repeat}/${step + 1}: ${ok ? 'pass' : 'fail'}`);
          if (!ok) throw new Error('behavior_failed');
          history.push({ role: 'assistant', content: response.answer });
        }
      }
  report.completed = true;
  report.passed = true;
}

try {
  await main();
} catch (error) {
  report.error = errorCode(error);
  process.exitCode = 1;
  console.error(`Chat eval failed: ${report.error}`);
} finally {
  report.durationMs = Math.max(0, Date.now() - started);
  const percentile = (values: number[], fraction: number) => {
    values.sort((a, b) => a - b);
    return values.length ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)]! : null;
  };
  report.summary = {
    samples: results.length,
    passed: results.filter((result) => result.passed).length,
    totalMs: {
      p50: percentile(
        results.map((r) => r.response.ms),
        0.5,
      ),
      p95: percentile(
        results.map((r) => r.response.ms),
        0.95,
      ),
    },
    firstTokenMs: {
      p50: percentile(
        results.map((r) => r.response.firstTokenMs),
        0.5,
      ),
      p95: percentile(
        results.map((r) => r.response.firstTokenMs),
        0.95,
      ),
    },
  };
  await save();
  console.log(`Report: ${reportPath}`);
}
