import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('built pages carry the revision used by the deployment job', async () => {
  const pages = (await readdir('dist', { recursive: true })).filter((path) =>
    path.endsWith('.html'),
  );
  assert(pages.length > 0, 'Build the site before checking its revision');
  for (const page of pages) {
    const html = await readFile(join('dist', page), 'utf8');
    assert.equal(
      /<meta name="app-revision" content="([^"]+)"/.exec(html)?.[1],
      process.env.GITHUB_SHA ?? 'local',
      page,
    );
  }
});
