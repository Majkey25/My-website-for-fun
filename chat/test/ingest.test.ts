import assert from 'node:assert/strict';
import test from 'node:test';
import { ingest, isAllowed, mainContent, parseRobots } from '../src/ingest.ts';
import { DOCUMENTS, SITEMAPS } from '../src/sources.ts';
import { ownerUrl } from '../src/web.ts';

test('robots.txt: own group wins, longest rule wins, allow wins ties', () => {
  const rules = parseRobots(`
User-agent: *
Disallow: /

User-agent: other-bot
User-agent: init-chat-crawler
Disallow: /private
Allow: /private/ok$
Disallow: /*.pdf$
`);
  assert.ok(isAllowed(rules, '/init/'));
  assert.ok(!isAllowed(rules, '/private/x'));
  assert.ok(isAllowed(rules, '/private/ok'));
  assert.ok(!isAllowed(rules, '/docs/a.pdf'));
  assert.ok(!isAllowed(parseRobots('User-agent: *\nDisallow: /'), '/a'));
  assert.ok(isAllowed(parseRobots(''), '/a'));
});

/** In-memory AI Search items API. */
function fakeIndex() {
  type Item = {
    id: string;
    key: string;
    metadata: unknown;
    status: 'completed' | 'queued' | 'error';
    created_at?: string;
  };
  const items = new Map<string, Item>();
  let next = 0;
  const index = {
    items,
    /** Uploads whose key starts with this prefix throw, like a failing API call. */
    failPrefix: '',
    failDelete: false,
    uploadStatus: 'completed' as Item['status'],
    binding: {
      get: (name: string) => {
        assert.equal(name, 'init');
        return {
          items: {
            list: async ({ page = 1, per_page = 20 } = {}) => ({
              result: [...items.values()].slice((page - 1) * per_page, page * per_page),
            }),
            upload: async (key: string, _content: Blob, options: { metadata: unknown }) => {
              if (index.failPrefix && key.startsWith(index.failPrefix))
                throw new Error('upload failed');
              const item: Item = {
                id: `id${next++}`,
                key,
                metadata: options.metadata,
                status: index.uploadStatus,
              };
              items.set(item.id, item);
              return item;
            },
            delete: async (id: string) => {
              if (index.failDelete) throw new Error('delete failed');
              items.delete(id);
            },
          },
        };
      },
    },
  };
  return index;
}

const PAGE_A = new URL('.', SITEMAPS[0]!).href;
const PAGE_B = new URL('work/', PAGE_A).href;
const ROBOTS = new URL('/robots.txt', PAGE_A).href;

const bindings = (index: ReturnType<typeof fakeIndex>) =>
  ({
    AI_SEARCH: index.binding,
    ASSETS: { fetch: globalThis.fetch },
  }) as never;

function stubWeb(t: test.TestContext, fullCorpus = false) {
  // Lifecycle fixtures fit one refresh; the full-corpus test exercises bounded batching below.
  const documents = fullCorpus ? [] : DOCUMENTS.splice(10);
  t.after(() => DOCUMENTS.push(...documents));
  const site = {
    sitemap: 200,
    /** robots.txt status for the site's own host; the README host always answers 200. */
    robots: 200,
    sitemapUrls: [PAGE_A, PAGE_B],
    pages: new Map<string, Response | (() => Response)>(),
    requests: [] as string[],
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    site.requests.push(url);
    assert.equal(init?.redirect, 'manual');
    const page = site.pages.get(url);
    if (page) return typeof page === 'function' ? page() : page.clone();
    if (url.endsWith('/robots.txt'))
      return site.robots === 200 || !url.startsWith(PAGE_A)
        ? new Response('User-agent: *\nAllow: /')
        : new Response('', { status: site.robots });
    if (url === SITEMAPS[0])
      return site.sitemap === 200
        ? new Response(`<urlset>${site.sitemapUrls.map((url) => `<url><loc>${url}</loc></url>`).join('')}
<url><loc>https://elsewhere.test/x</loc></url></urlset>`)
        : new Response('', { status: site.sitemap });
    if (DOCUMENTS.includes(url))
      return new Response(`# ${url.split('/')[4]}\nReadme`, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    return new Response('missing', { status: 404 });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return site;
}

const html = (title: string, body = '') =>
  new Response(`<html><head><title>${title}</title></head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

test('the crawl uploads new pages, skips unchanged ones and replaces changed ones', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Matěj Teplý &amp; AI'));
  site.pages.set(PAGE_B, html('Work'));

  const first = await ingest(bindings(index));
  assert.equal(first.uploaded, DOCUMENTS.length + 2);
  const titles = [...index.items.values()].map((i) => (i.metadata as { title: string }).title);
  assert.ok(titles.includes('Matěj Teplý & AI'));
  assert.ok(titles.includes('CzechCore'));
  assert.ok(![...index.items.values()].some((i) => JSON.stringify(i).includes('elsewhere.test')));

  const second = await ingest(bindings(index));
  assert.equal(second.uploaded, 0);

  site.pages.set(PAGE_B, html('Work', 'changed'));
  const third = await ingest(bindings(index));
  assert.equal(third.uploaded, 1);
  assert.equal(index.items.size, DOCUMENTS.length + 2);
});

test('removed pages leave the index; a failed sitemap or redirect off-site deletes nothing wrongly', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  await ingest(bindings(index));
  const total = index.items.size;

  site.sitemap = 503;
  const broken = await ingest(bindings(index));
  assert.equal(broken.complete, false);
  assert.equal(index.items.size, total);

  site.sitemap = 200;
  site.pages.set(
    PAGE_B,
    new Response(null, {
      status: 302,
      headers: { location: 'https://elsewhere.test/landing' },
    }),
  );
  const redirected = await ingest(bindings(index));
  assert.equal(redirected.deleted, 1);
  assert.equal(index.items.size, total - 1);
  assert(!site.requests.some((url) => url === 'https://elsewhere.test/landing'));
});

test('only the main content is indexed, without forms', () => {
  const page = `<html><head><title>T</title></head><body><nav>Work About</nav>
<main id="main"><h1>Name</h1><form class="ask"><input placeholder="Ask"></form><p>Real text</p></main>
<site-chat><button>Ask the site</button></site-chat><footer>Privacy</footer></body></html>`;
  assert.equal(mainContent(page), '<main id="main"><h1>Name</h1><p>Real text</p></main>');
  assert.equal(mainContent('<p>No main</p>'), '<p>No main</p>');
});

const idOf = async (url: string) =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url)))
    .toString('hex')
    .slice(0, 16);

test('a robots.txt outage or a failed upload keeps the index and finishes the crawl', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  await ingest(bindings(index));
  const total = index.items.size;

  site.robots = 503;
  const outage = await ingest(bindings(index));
  assert.equal(outage.complete, false);
  assert.equal(index.items.size, total);

  site.robots = 200;
  site.pages.set(PAGE_A, html('Home', 'changed'));
  site.pages.set(PAGE_B, html('Work', 'changed'));
  index.failPrefix = await idOf(PAGE_A);
  const failing = await ingest(bindings(index));
  assert.equal(failing.failed, 1);
  assert.equal(failing.uploaded, 1, 'the crawl continues after a failed upload');
  assert.equal(failing.complete, false);
  assert.equal(index.items.size, total);
});

test('leftover duplicate versions of a page are removed', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  await ingest(bindings(index));
  const total = index.items.size;
  const id = await idOf(PAGE_A);
  index.items.set('stale', {
    id: 'stale',
    key: `${id}-0000000000000000.html`,
    metadata: {},
    status: 'completed',
  });
  const run = await ingest(bindings(index));
  assert.equal(run.uploaded, 0);
  assert.equal(run.deleted, 1);
  assert.equal(index.items.size, total);
  assert.ok(!index.items.has('stale'));
});

test('a complete crawl leaves hand-uploaded files such as the CV alone', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  index.items.set('cv', { id: 'cv', key: 'owner-cv.md', metadata: {}, status: 'completed' });
  const run = await ingest(bindings(index));
  assert.equal(run.complete, true);
  assert.equal(run.deleted, 0);
  assert.ok(index.items.has('cv'));
});

test('a title-only change is re-uploaded', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  const page = (title: string) =>
    new Response(`<title>${title}</title><nav>x</nav><main><p>Same text</p></main>`, {
      headers: { 'content-type': 'text/html' },
    });
  site.pages.set(PAGE_A, page('Old title'));
  site.pages.set(PAGE_B, html('Work'));
  await ingest(bindings(index));
  site.pages.set(PAGE_A, page('New title'));
  const run = await ingest(bindings(index));
  assert.equal(run.uploaded, 1);
  const titles = [...index.items.values()].map((i) => (i.metadata as { title: string }).title);
  assert.ok(titles.includes('New title') && !titles.includes('Old title'));
});

test('replacement indexing must complete before old content is deleted; failed indexing is retried', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Old work'));
  await ingest(bindings(index));
  const count = index.items.size;
  const id = await idOf(PAGE_B);
  const original = [...index.items.values()].find((item) => item.key.startsWith(id))!;
  site.pages.set(PAGE_B, html('Updated work'));
  index.uploadStatus = 'queued';
  await ingest(bindings(index));
  assert.equal(index.items.size, count + 1);
  assert(index.items.has(original.id));
  const pending = [...index.items.values()].find((item) => item.status === 'queued')!;
  pending.status = 'error';
  const retry = await ingest(bindings(index));
  assert.equal(retry.uploaded, 1);
  assert(!index.items.has(pending.id));
  assert(index.items.has(original.id));
  [...index.items.values()].find((item) => item.status === 'queued')!.status = 'completed';
  const ready = await ingest(bindings(index));
  assert.equal(ready.uploaded, 0);
  assert(!index.items.has(original.id));
  assert.equal(index.items.size, count);
});

test('repeated queued source changes retain only the latest candidate and working fallback', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Original'));
  await ingest(bindings(index));
  const id = await idOf(PAGE_B);
  const versions = () => [...index.items.values()].filter((item) => item.key.startsWith(id));
  const original = versions()[0]!;
  original.created_at = '2026-11-01T12:00:00Z';
  index.items.set('older-working', {
    ...original,
    id: 'older-working',
    key: `${id}-0000000000000000.html`,
    created_at: '2026-10-31T12:00:00Z',
  });
  index.uploadStatus = 'queued';
  for (let change = 0; change < 5; change++) {
    site.pages.set(PAGE_B, html(`Change ${change}`));
    await ingest(bindings(index));
    assert.equal(versions().length, 2);
    assert(index.items.has(original.id));
  }
  const candidate = versions().find((item) => item.status === 'queued')!;
  index.failPrefix = id;
  site.pages.set(PAGE_B, html('Failed upload'));
  await ingest(bindings(index));
  assert.equal(versions().length, 1);
  assert(index.items.has(original.id));
  index.failPrefix = '';
  index.uploadStatus = 'completed';
  await ingest(bindings(index));
  assert.equal(versions().length, 1);
  assert(!index.items.has(original.id) && !index.items.has(candidate.id));
});

test('failed obsolete-version deletion blocks uploads and cannot accumulate new candidates', async (t) => {
  const site = stubWeb(t),
    index = fakeIndex();
  site.pages.set(PAGE_A, html('Original'));
  await ingest(bindings(index));
  const id = await idOf(PAGE_A);
  const versions = () => [...index.items.values()].filter((item) => item.key.startsWith(id));
  const original = versions()[0]!;
  index.uploadStatus = 'queued';
  site.pages.set(PAGE_A, html('First candidate'));
  await ingest(bindings(index));
  index.failDelete = true;
  for (let change = 0; change < 4; change++) {
    site.pages.set(PAGE_A, html(`Later candidate ${change}`));
    const report = await ingest(bindings(index));
    assert.equal(report.uploaded, 0);
    assert.equal(versions().length, 2);
    assert(index.items.has(original.id));
  }
  index.failDelete = false;
  index.uploadStatus = 'completed';
  await ingest(bindings(index));
  assert.equal(versions().length, 1);
  assert(!index.items.has(original.id));
});

test('manifest withdrawals are removed even when the remaining corpus exceeds the fetch budget', async (t) => {
  const site = stubWeb(t),
    index = fakeIndex();
  await ingest(bindings(index));
  const removed = DOCUMENTS.shift()!;
  t.after(() => DOCUMENTS.unshift(removed));
  site.sitemapUrls = Array.from({ length: 70 }, (_, i) => `${PAGE_A}more-${i}/`);
  for (const url of site.sitemapUrls) site.pages.set(url, html('Page'));
  const id = await idOf(removed);
  const exists = () => [...index.items.values()].some((item) => item.key.startsWith(id));
  assert(exists());
  index.failDelete = true;
  assert.equal((await ingest(bindings(index))).complete, false);
  assert(exists(), 'Failed withdrawal must stay retryable');
  index.failDelete = false;
  const result = await ingest(bindings(index));
  assert(result.skipped > 0);
  assert(!exists(), 'Explicit document withdrawal must not depend on a complete crawl');
});

test('confirmed bulk withdrawals are removed even when most indexed sources disappear', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  await ingest(bindings(index));
  for (const url of DOCUMENTS) site.pages.set(url, new Response(null, { status: 410 }));
  const run = await ingest(bindings(index));
  assert.equal(run.deleted, DOCUMENTS.length);
  assert.equal(index.items.size, 2);
  await ingest(bindings(index));
  assert.equal(index.items.size, 2, 'later crawls must not restore withdrawn chunks');
});

test('missing sitemap entries are reconciled before confirmed bulk withdrawals are removed', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.sitemapUrls.push(...Array.from({ length: 16 }, (_, i) => `${PAGE_A}withdrawn-${i}/`));
  for (const url of site.sitemapUrls) site.pages.set(url, html('Public page'));
  await ingest(bindings(index));
  assert.equal(index.items.size, DOCUMENTS.length + 18);
  site.sitemapUrls = [];
  site.pages.clear();
  const run = await ingest(bindings(index));
  assert.equal(run.deleted, 18);
  assert.equal(index.items.size, DOCUMENTS.length);
  await ingest(bindings(index));
  assert.equal(index.items.size, DOCUMENTS.length);
});

test('redirects are validated before fetching each document, robots and sitemap hop', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });
  const foreign = 'https://elsewhere.test/private';
  site.pages.set(PAGE_A, redirect(foreign));
  await ingest(bindings(index));
  assert(!site.requests.some((url) => url === foreign));
  const foreignOwner = 'https://raw.githubusercontent.com/other-owner/project/HEAD/README.md';
  site.pages.set(PAGE_A, redirect(foreignOwner));
  await ingest(bindings(index));
  assert(!site.requests.includes(foreignOwner), 'an allowed host does not authorize another owner');
  site.pages.set(ROBOTS, redirect(foreign));
  site.pages.set(SITEMAPS[0]!, redirect(foreign));
  const blocked = await ingest(bindings(index));
  assert.equal(blocked.complete, false);
  assert(!site.requests.some((url) => url === foreign));
  site.pages.set(ROBOTS, new Response('User-agent: *\nDisallow: /private'));
  site.pages.delete(SITEMAPS[0]!);
  site.pages.set(PAGE_A, redirect('/private'));
  await ingest(bindings(index));
  assert(!site.requests.includes(new URL('/private', PAGE_A).href));
});

test('the site sitemap, robots and pages use the asset binding instead of self-fetching', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Work'));
  const web = globalThis.fetch;
  const assets: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.notEqual(new URL(String(input)).origin, new URL(PAGE_A).origin);
    return web(input, init);
  };
  await ingest({
    AI_SEARCH: index.binding,
    ASSETS: {
      fetch: async (input: string, init?: RequestInit) => {
        assets.push(input);
        return web(input, init);
      },
    },
  } as never);
  for (const url of [SITEMAPS[0], ROBOTS, PAGE_A, PAGE_B]) assert(assets.includes(url!));
});

test('an oversized crawl eventually visits its tail and rechecks withdrawn pages', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  const clock = t.mock.method(Date, 'now', () => 0);
  site.pages.set(PAGE_A, html('Home'));
  site.pages.set(PAGE_B, html('Old work page'));
  await ingest(bindings(index));
  const hasOld = () =>
    [...index.items.values()].some((item) => (item.metadata as { url: string }).url === PAGE_B);
  site.sitemapUrls = Array.from(
    { length: 70 },
    (_, i) => new URL(`work/example-${i}/`, PAGE_A).href,
  );
  for (const url of site.sitemapUrls) site.pages.set(url, html(url));
  site.pages.delete(PAGE_B);
  site.requests.length = 0;
  const first = await ingest(bindings(index));
  assert(first.skipped > 0);
  assert.equal(first.complete, false);
  assert(site.requests.length <= 45);
  assert(hasOld(), 'A budget-exhausted run preserves the last indexed version');
  const visited = new Set(site.requests);
  for (
    let run = 1;
    run <= 3 && (hasOld() || site.sitemapUrls.some((url) => !visited.has(url)));
    run++
  ) {
    clock.mock.mockImplementation(() => run * 21_600_000);
    site.requests.length = 0;
    await ingest(bindings(index));
    assert(site.requests.length <= 45);
    for (const url of site.requests) visited.add(url);
  }
  assert(
    site.sitemapUrls.every((url) => visited.has(url)),
    'No discovered page remains starved',
  );
  assert(!hasOld(), 'A withdrawn page is eventually rechecked and removed');
});

test('the full public GitHub corpus and site are covered within three bounded refreshes', async (t) => {
  const site = stubWeb(t, true);
  const index = fakeIndex();
  const clock = t.mock.method(Date, 'now', () => 0);
  site.sitemapUrls = Array.from({ length: 32 }, (_, i) => `${PAGE_A}public-${i}/`);
  for (const url of site.sitemapUrls) site.pages.set(url, html(`Page ${url}`));
  const documents = new Set(DOCUMENTS);
  assert.equal(documents.size, 45);
  for (const url of documents) assert.equal(ownerUrl(url), url);
  const visited = new Set<string>();
  for (let run = 0; run < 3; run++) {
    clock.mock.mockImplementation(() => run * 21_600_000);
    site.requests.length = 0;
    const report = await ingest(bindings(index));
    assert.equal(report.failed, 0);
    assert(report.skipped > 0);
    assert(site.requests.length <= 45);
    for (const url of site.requests) visited.add(url);
  }
  for (const url of [...documents, ...site.sitemapUrls])
    assert(visited.has(url), `Source was not reached: ${url}`);
  assert.equal(index.items.size, documents.size + site.sitemapUrls.length);
});

test('streamed size limits cancel documents, robots and sitemaps before full allocation', async (t) => {
  const site = stubWeb(t);
  const index = fakeIndex();
  let cancelled = 0;
  const oversized = () => {
    let chunks = 0;
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunks++ === 20) return controller.close();
          controller.enqueue(new Uint8Array(512 * 1024));
        },
        cancel() {
          cancelled++;
        },
      }),
      { headers: { 'content-type': 'text/plain' } },
    );
  };
  site.pages.set(PAGE_A, oversized);
  await ingest(bindings(index));
  assert.equal(cancelled, 1);
  site.pages.set(SITEMAPS[0]!, oversized);
  await ingest(bindings(index));
  assert.equal(cancelled, 2);
  site.pages.delete(PAGE_A);
  site.pages.delete(SITEMAPS[0]!);
  site.pages.set('https://raw.githubusercontent.com/robots.txt', oversized);
  const run = await ingest(bindings(index));
  assert.equal(run.complete, false);
  assert.equal(cancelled, 3);
});
