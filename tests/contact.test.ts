import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { decodeEmail, emailUri, encodeEmail } from '../src/contact.ts';

test('protected email preserves plus addressing and Unicode', () => {
  for (const [value, uri] of [
    ['booking+press@example.com', 'mailto:booking%2Bpress@example.com'],
    ['příjemce@example.cz', 'mailto:p%C5%99%C3%ADjemce@example.cz'],
    ['a%40b?subject=x&body=y@example.com', 'mailto:a%2540b%3Fsubject%3Dx%26body%3Dy@example.com'],
  ]) {
    assert.equal(decodeEmail(encodeEmail(value)), value);
    assert.equal(emailUri(value), uri);
  }
});

test('email URI restores every encoded @', () => {
  assert.equal(emailUri('a@b@example.com'), 'mailto:a@b@example.com');
});

test('malformed or injected contacts are rejected', () => {
  assert.throws(() => decodeEmail('%%%'));
  for (const value of ['not-email', 'a@example.com\r\nBcc:other@example.com', 'a@b@example.com']) {
    assert.throws(() => decodeEmail(encodeEmail(value)));
  }
});

test('built pages and scripts do not expose contacts before activation', async () => {
  const dist = new URL('../dist/', import.meta.url);
  const files = (await readdir(dist, { recursive: true })).filter((file) =>
    /\.(html|js|json|xml)$/.test(file),
  );
  const artifacts = await Promise.all(
    files.map(async (file) => ({
      file,
      text: await readFile(new URL(file.replaceAll('\\', '/'), dist), 'utf8'),
    })),
  );
  const emails = new Set(
    artifacts.flatMap(({ file, text }) =>
      file.endsWith('.html')
        ? [...text.matchAll(/data-contact-value="([^"]+)"/g)].map((match) => decodeEmail(match[1]))
        : [],
    ),
  );
  assert(emails.size > 0, 'Build must contain protected contacts');
  for (const { file, text } of artifacts) {
    for (const email of emails) {
      assert(
        !text.includes(email) && !text.includes(encodeURIComponent(email)),
        `${file}: raw email exposed`,
      );
    }
    if (file.endsWith('.html'))
      assert(!/href=["'](?:mailto|tel):/i.test(text), `${file}: initial contact URI exposed`);
  }
});

test('both contact pages ship a configured contact form', async () => {
  for (const path of ['contact/index.html', 'cs/contact/index.html']) {
    const home = await readFile(
      new URL(`../dist/${path.replace('contact/', '')}`, import.meta.url),
      'utf8',
    );
    assert(
      !home.includes('data-contact-form'),
      'The short homepage must link to the full contact page',
    );
    assert(/href="[^"]*\/contact\/"/.test(home), 'Homepage contact link missing');
    const html = await readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
    const form = /<form\b([^>]*\bdata-contact-form\b[^>]*)>([\s\S]*?)<\/form>/.exec(html);
    assert(form, `${path}: contact form missing`);
    assert(form[1].includes('action="https://api.web3forms.com/submit"'));
    const key = /<input[^>]*name="access_key"[^>]*value="([^"]+)"/.exec(form[2])?.[1];
    assert(
      key &&
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key) &&
        key !== '00000000-0000-0000-0000-000000000000',
      `${path}: configure the recipient's Web3Forms access key before publication`,
    );
    for (const name of ['email', 'message']) {
      assert(
        new RegExp(`<[^>]*name="${name}"[^>]*required`).test(form[2]),
        `${path}: ${name} must be required`,
      );
    }
  }
});
