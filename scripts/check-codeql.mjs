import assert from 'node:assert/strict';
import { lstat, open, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const levels = ['none', 'note', 'warning', 'error'];
const languages = ['actions', 'javascript'];

function object(value = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected a SARIF object');
  return value;
}

function array(value = []) {
  assert(Array.isArray(value), 'Expected a SARIF array');
  return value;
}

function level(value = 'warning') {
  assert(levels.includes(value), 'Unknown SARIF level');
  return value;
}

function checkRun(run, language) {
  object(run);
  assert.equal(run.tool?.driver?.name, 'CodeQL', 'Expected a CodeQL run');
  assert.equal(run.externalPropertyFileReferences, undefined, 'External SARIF data is unsupported');
  assert(Array.isArray(run.results), 'Missing SARIF results');
  assert(array(run.invocations).length > 0, 'Missing scan invocation');
  for (const invocation of run.invocations) {
    assert.equal(invocation.executionSuccessful, true, 'Scan did not complete successfully');
    assert.equal(
      array(invocation.ruleConfigurationOverrides).length,
      0,
      'Rule overrides unsupported',
    );
    for (const key of ['toolExecutionNotifications', 'toolConfigurationNotifications']) {
      for (const notification of array(invocation[key])) {
        assert.notEqual(level(object(notification).level), 'error', 'Scan reported an error');
      }
    }
  }

  const components = [run.tool.driver, ...array(run.tool.extensions)];
  const rules = new Map();
  for (const component of components) {
    object(component);
    const entries = array(component.rules);
    const ids = new Set();
    for (const rule of entries) {
      object(rule);
      assert(typeof rule.id === 'string' && rule.id.length > 0, 'Missing rule ID');
      assert(!ids.has(rule.id), 'Duplicate rule ID');
      ids.add(rule.id);
      const configuration = object(rule.defaultConfiguration);
      level(configuration.level);
      const properties = object(rule.properties);
      const tags = array(properties.tags);
      assert(
        tags.every((tag) => typeof tag === 'string'),
        'Malformed rule tags',
      );
      const score = properties['security-severity'];
      if (score !== undefined) {
        assert(
          typeof score === 'string' && /^(?:\d+)(?:\.\d+)?$/.test(score),
          'Invalid security severity',
        );
        assert(Number(score) >= 0 && Number(score) <= 10, 'Security severity outside 0..10');
      } else {
        assert(!tags.includes('security'), 'Security rule lacks security severity');
      }
    }
    rules.set(component, entries);
  }
  assert(
    components.some(
      (component) =>
        component.name === `codeql/${language}-queries` && rules.get(component).length > 0,
    ),
    `Missing ${language} query rules`,
  );

  let blocked = 0;
  for (const result of run.results) {
    object(result);
    assert.equal(
      result.kind === undefined ? 'fail' : result.kind,
      'fail',
      'Unsupported SARIF result kind',
    );
    assert(typeof result.message?.text === 'string', 'Missing result message');
    const reference = object(result.rule);
    const componentReference = reference.toolComponent;
    let component = run.tool.driver;
    if (componentReference !== undefined) {
      object(componentReference);
      assert(Number.isInteger(componentReference.index), 'Missing tool component index');
      component = array(run.tool.extensions)[componentReference.index];
      assert(component, 'Unresolved tool component');
      for (const key of ['name', 'guid']) {
        if (componentReference[key] !== undefined) {
          assert.equal(componentReference[key], component[key], 'Conflicting tool component');
        }
      }
    }
    const entries = rules.get(component);
    const index = reference.index === undefined ? result.ruleIndex : reference.index;
    const id = reference.id ?? result.ruleId;
    if (index !== undefined) assert(Number.isInteger(index) && index >= 0, 'Invalid rule index');
    const rule = index === undefined ? entries.find((entry) => entry.id === id) : entries[index];
    assert(rule, 'Unresolved result rule');
    for (const candidate of [reference.id, result.ruleId]) {
      if (candidate !== undefined) assert.equal(candidate, rule.id, 'Conflicting result rule ID');
    }
    if (reference.guid !== undefined) {
      assert.equal(reference.guid, rule.guid, 'Conflicting result rule GUID');
    }
    if (result.ruleIndex !== undefined) {
      assert(
        Number.isInteger(result.ruleIndex) && result.ruleIndex >= 0,
        'Invalid legacy rule index',
      );
      assert.equal(
        rules.get(run.tool.driver)[result.ruleIndex],
        rule,
        'Conflicting legacy rule index',
      );
    }
    const severity = level(
      result.level === undefined ? rule.defaultConfiguration?.level : result.level,
    );
    if (severity === 'error' || Number(rule.properties?.['security-severity'] ?? 0) >= 7) {
      console.error(`${language}: ${rule.id} exceeds the CodeQL threshold`);
      blocked++;
    }
  }
  return blocked;
}

const output = process.argv[2];
assert(
  output && process.argv.length === 3,
  'Usage: node scripts/check-codeql.mjs <SARIF directory>',
);
assert((await lstat(output)).isDirectory(), 'SARIF output must be a real directory');
assert.deepEqual(
  (await readdir(output)).sort(),
  languages.map((language) => `${language}.sarif`),
  'Expected complete Actions and JavaScript SARIF output',
);
let blocked = 0;
for (const language of languages) {
  const path = join(output, `${language}.sarif`);
  const file = await open(path, 'r');
  try {
    const entry = await lstat(path);
    const opened = await file.stat();
    assert(entry.isFile() && opened.isFile(), 'SARIF output must be a regular file');
    assert(
      entry.dev === opened.dev && entry.ino === opened.ino,
      'SARIF output changed while opening',
    );
    const sarif = JSON.parse(await file.readFile('utf8'));
    assert.equal(sarif.version, '2.1.0', 'Unsupported SARIF version');
    assert(array(sarif.runs).length > 0, 'Missing SARIF runs');
    for (const run of sarif.runs) blocked += checkRun(run, language);
  } finally {
    await file.close();
  }
}
assert.equal(
  blocked,
  0,
  `CodeQL blocked ${blocked} high/critical security or error-level findings`,
);
console.log('CodeQL thresholds passed for Actions and JavaScript');
