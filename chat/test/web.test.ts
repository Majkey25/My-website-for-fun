import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { evidence, SEARCH_DOMAINS } from '../src/web.ts';
import { ownerUrl } from '../src/sources.ts';

test('only the owner pages pass, whatever the search adds or disguises', () => {
  assert.equal(
    ownerUrl('https://github.com/Majkey25/CzechCore?utm_source=openai#readme'),
    'https://github.com/Majkey25/CzechCore',
  );
  assert.equal(ownerUrl('https://GITHUB.com/majkey25'), 'https://github.com/majkey25');
  assert.ok(ownerUrl('https://majkey25.github.io/rc-audio-lab/'));
  assert.ok(ownerUrl('https://init-chat.majkeylab.workers.dev/cs/about/'));
  assert.ok(
    ownerUrl('https://play.google.com/store/apps/details?id=com.tuneitall.tuner&utm_source=openai'),
  );
  const refused = [
    'https://github.com/Majkey25evil',
    'https://github.com/other/Majkey25',
    'https://github.com/Majkey25/../other',
    'https://github.com/Majkey25%2F..%2Fother',
    'https://github.com/StudentTraineeCenter/other',
    'http://github.com/Majkey25',
    'https://github.com.evil.test/Majkey25',
    'https://evil.github.io/',
    'https://other.majkeylab.workers.dev/',
    'https://init-chat.majkeylab.workers.dev.evil.test/',
    'https://user@github.com/Majkey25',
    'https://github.com:8443/Majkey25',
    'https://www.linkedin.com/in/someone-else',
    'https://www.linkedin.com/in/matejteply-fake',
    'https://play.google.com/store/apps/details?id=com.other',
    'https://play.google.com/store/apps/details?id=com.tuneitall.tuner&hl=cs',
    'javascript:alert(1)',
    'not a url',
  ];
  for (const url of refused) assert.equal(ownerUrl(url), null, url);
  for (const url of [
    'https://github.com/Majkey25/init/blob/main/chat/evals/calibration.json',
    'https://raw.githubusercontent.com/Majkey25/init/main/chat/evals/scenarios.json',
    'https://github.com/Majkey25/init/blob/main/%63hat%2Fevals/calibration.json',
    'https://raw.githubusercontent.com/Majkey25/init/main/chat/test/worker.test.ts',
    'https://github.com/Majkey25/init/blob/main/%invalid',
    'https://github.com/Majkey25/init/pull/1/files',
    'https://github.com/Majkey25/init/commit/abc',
    'https://github.com/Majkey25/init/compare/a...b',
    'https://github.com/Majkey25/init/pull/1.diff',
    'https://github.com/Majkey25/init.git/pull/1/files',
    'https://github.com/Majkey25/%69nit/pull/1/files',
    'https://raw.githubusercontent.com/Majkey25/init/old-commit/chat/evals/calibration.json',
  ])
    assert.equal(ownerUrl(url), null, url);
  assert(ownerUrl('https://github.com/Majkey25/init/blob/main/README.md'));
  assert(ownerUrl('https://github.com/Majkey25/init'));
  assert(ownerUrl('https://github.com/Majkey25/init/'));
  assert(ownerUrl('https://raw.githubusercontent.com/Majkey25/init/main/README.md'));
  assert(ownerUrl('https://www.exhalace.cz/%E1'));
  assert.ok(SEARCH_DOMAINS.some((domain) => domain === 'github.com'));
  assert.ok(!SEARCH_DOMAINS.some((domain) => domain.includes('/')));
});

test('every link the site lists for its owner is inside the search policy', async () => {
  const files = ['../../src/site.ts', '../../src/data/projects.yaml'];
  const text = (
    await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')))
  ).join('\n');
  const links = [...text.matchAll(/https:\/\/[^\s'"},]+/g)].map(([link]) => link);
  assert.ok(links.length > 40);
  for (const link of links) assert.ok(ownerUrl(link), link);
});

const cite = (text: string, needle: string, url: string, title = 'Page') => {
  const start = text.indexOf(needle);
  return { type: 'url_citation', start_index: start, end_index: start + needle.length, url, title };
};

test('web evidence keeps only lines that cite owner pages and nothing else', () => {
  const text = [
    'CzechCore is an offline Czech proofreader. ([github.com](https://github.com/Majkey25/CzechCore?utm_source=openai))',
    'Another Matěj works at a bank. ([linkedin.com](https://www.linkedin.com/in/someone-else))',
    'He mixes facts. ([github.com](https://github.com/Majkey25/CzechCore)) ([evil.test](https://evil.test/x))',
    'A line with no citation at all.',
    'Inline only https://evil.test/claim but cited to the owner ([github.com](https://github.com/Majkey25))',
    '- Project-Guard checks GitHub projects. ([github.com](https://github.com/Majkey25/Project-Guard))',
  ].join('\n');
  const response = {
    output: [
      { type: 'web_search_call', status: 'completed' },
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text,
            annotations: [
              cite(
                text,
                '[github.com](https://github.com/Majkey25/CzechCore?utm_source=openai)',
                'https://github.com/Majkey25/CzechCore?utm_source=openai',
                'CzechCore',
              ),
              cite(
                text,
                '[linkedin.com](https://www.linkedin.com/in/someone-else)',
                'https://www.linkedin.com/in/someone-else',
              ),
              cite(
                text,
                '[github.com](https://github.com/Majkey25/CzechCore))',
                'https://github.com/Majkey25/CzechCore',
              ),
              cite(text, '[evil.test](https://evil.test/x)', 'https://evil.test/x'),
              cite(
                text,
                '[github.com](https://github.com/Majkey25))',
                'https://github.com/Majkey25',
              ),
              cite(
                text,
                '[github.com](https://github.com/Majkey25/Project-Guard)',
                'https://github.com/Majkey25/Project-Guard',
                'Project-Guard',
              ),
              // Malformed annotations count for nothing.
              {
                type: 'url_citation',
                start_index: '0',
                end_index: 5,
                url: 'https://github.com/Majkey25',
              },
            ],
          },
        ],
      },
    ],
  };
  const { sources, dropped } = evidence(response, 2);
  assert.deepEqual(sources, [
    {
      id: 'S3',
      title: 'CzechCore',
      url: 'https://github.com/Majkey25/CzechCore',
      text: 'CzechCore is an offline Czech proofreader.',
    },
    {
      id: 'S4',
      title: 'Project-Guard',
      url: 'https://github.com/Majkey25/Project-Guard',
      text: 'Project-Guard checks GitHub projects.',
    },
  ]);
  assert.equal(dropped, 4);
  assert.deepEqual(evidence(null, 0), { sources: [], dropped: 0 });
  assert.deepEqual(evidence({ output: 'x' }, 0).sources, []);
});
