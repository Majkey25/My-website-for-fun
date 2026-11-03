import assert from 'node:assert/strict';
import test from 'node:test';
import { onPage } from '../src/scripts/page.ts';

test('page work starts once per body and stops before the next body mounts', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = Object.assign(new EventTarget(), { body: {} });
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  const owners: AbortSignal[] = [];
  const stopped: boolean[] = [];
  try {
    onPage((signal) => {
      owners.push(signal);
      return () => stopped.push(signal.aborted);
    });
    document.dispatchEvent(new Event('astro:page-load'));
    assert.equal(owners.length, 1);
    document.dispatchEvent(new Event('astro:before-swap'));
    assert.deepEqual(stopped, [true]);
    document.body = {};
    document.dispatchEvent(new Event('astro:after-swap'));
    document.dispatchEvent(new Event('astro:page-load'));
    assert.equal(owners.length, 2);
    assert.equal(owners[1]?.aborted, false);
    assert.deepEqual(stopped, [true]);
    document.dispatchEvent(new Event('astro:before-swap'));
    assert.deepEqual(stopped, [true, true]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
