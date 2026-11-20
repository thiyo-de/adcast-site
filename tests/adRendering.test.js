import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRenderedAd, showRecommendationAdAfter, getAdFrameLayout } from '../src/services/adRendering.js';

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

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test('oversized and offset creatives stay inside the card at phone, tablet and desktop widths', () => {
  for (const available of [120, 264, 300, 375, 720, 1024]) {
    const container = rect(40, 80, available, 250);
    const children = [rect(10, 70, 728, 300), rect(60, 300, 300, 120)];
    const layout = getAdFrameLayout(available, container, children);
    for (const child of children) {
      const left = layout.x + (child.left - container.left) * layout.scale;
      const right = layout.x + (child.right - container.left) * layout.scale;
      const top = layout.y + (child.top - container.top) * layout.scale;
      const bottom = layout.y + (child.bottom - container.top) * layout.scale;
      assert.ok(left >= -0.00001 && right <= available + 0.00001, `horizontal bounds at ${available}px`);
      assert.ok(top >= -0.00001 && bottom <= layout.height, `vertical bounds at ${available}px`);
    }
  }
});

test('positioned native content reserves height even when its wrapper has zero height', () => {
  const layout = getAdFrameLayout(280, rect(0, 0, 280, 0), [rect(0, 0, 300, 600)]);
  assert.equal(layout.height, 560);
  assert.equal(layout.scale, 280 / 300);
});

test('fitting does not enlarge small creatives or assign geometry to an empty slot', () => {
  assert.equal(getAdFrameLayout(728, rect(0, 0, 728, 90), [rect(214, 0, 300, 90)]).scale, 1);
  assert.equal(getAdFrameLayout(0, rect(0, 0, 0, 0), []), null);
});

test('a scaled preview reserves the same card space and contains the entire creative', () => {
  const container = rect(0, 0, 280, 0);
  const child = rect(-10, -5, 300, 600);
  const expected = getAdFrameLayout(280, container, [child]);
  for (const zoom of [0.4, 0.5, 0.75, 1, 1.25, 2]) {
    const viewportRect = r => rect(50 + r.left * zoom, 30 + r.top * zoom, r.width * zoom, r.height * zoom);
    const actual = getAdFrameLayout(280, viewportRect(container), [viewportRect(child)], { x: zoom, y: zoom });
    for (const key of ['x', 'y', 'height', 'scale']) {
      assert.ok(Math.abs(actual[key] - expected[key]) < 0.00001, `${key} changes at ${zoom}x preview scale`);
    }
    assert.equal(actual.height, 560);
  }
});

test('provider height changes reserve additional space instead of clipping the refreshed ad', () => {
  const container = rect(0, 0, 280, 0);
  const before = getAdFrameLayout(280, container, [rect(0, 0, 300, 250)]);
  const after = getAdFrameLayout(280, container, [rect(0, 0, 300, 600)]);
  assert.equal(before.height, 234);
  assert.equal(after.height, 560);
});
