import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRenderedAd, showRecommendationAdAfter } from '../src/services/adRendering.js';

const root = (...elements) => ({ querySelectorAll: () => elements });
const creative = (tagName, overrides = {}) => ({
  tagName,
  getBoundingClientRect: () => ({ width: 300, height: 250 }),
  getAttribute: () => null,
  ...overrides,
});
globalThis.getComputedStyle = (element) => ({ display: 'block', visibility: 'visible', ...element.style });

test('reserved height and empty wrappers do not count as an advertisement', () => {
  assert.equal(hasRenderedAd({ offsetHeight: 380, querySelectorAll: () => [] }), false);
});

test('broken/loading images and tracking pixels do not count; a loaded creative does', () => {
  assert.equal(hasRenderedAd(root(creative('IMG', { complete: false, naturalWidth: 300 }))), false);
  assert.equal(hasRenderedAd(root(creative('IMG', { complete: true, naturalWidth: 0 }))), false);
  assert.equal(hasRenderedAd(root(creative('IMG', {
    complete: true, naturalWidth: 1, getBoundingClientRect: () => ({ width: 1, height: 1 }),
  }))), false);
  assert.equal(hasRenderedAd(root(creative('IMG', { complete: true, naturalWidth: 300 }))), true);
});

test('cross-origin frames need a nonblank source and a load event', () => {
  const frame = creative('IFRAME', { getAttribute: (key) => key === 'src' ? 'https://ads.example/creative' : null });
  const loaded = new WeakSet();
  assert.equal(hasRenderedAd(root(frame), loaded), false);
  loaded.add(frame);
  assert.equal(hasRenderedAd(root(frame), loaded), true);
  frame.getAttribute = (key) => key === 'src' ? 'about:blank' : null;
  assert.equal(hasRenderedAd(root(frame), loaded), false);
});

test('same-origin blank frames remain empty until their creative is loaded', () => {
  const frame = creative('IFRAME', { contentDocument: root() });
  assert.equal(hasRenderedAd(root(frame)), false);
  frame.contentDocument = root(creative('IMG', { complete: true, naturalWidth: 300 }));
  assert.equal(hasRenderedAd(root(frame)), true);
});

test('hidden creatives are not reported as filled', () => {
  assert.equal(hasRenderedAd(root(creative('IMG', {
    complete: true, naturalWidth: 300, style: { visibility: 'hidden' },
  }))), false);
});

test('short recommendations include one placement and long lists space ads six videos apart', () => {
  const positions = (count) => Array.from({ length: count }, (_, index) => index)
    .filter(index => showRecommendationAdAfter(index, count));
  assert.deepEqual(positions(0), []);
  assert.deepEqual(positions(1), [0]);
  assert.deepEqual(positions(2), [1]);
  assert.deepEqual(positions(3), [1]);
  assert.deepEqual(positions(12), [1, 7]);
});
