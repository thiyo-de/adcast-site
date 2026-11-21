import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for headless Node environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

import { store } from '../src/services/store.js';

test('store.updateAdSlot preserves existing fields on partial toggle', () => {
  const initial = store.getAdSettings();
  const testSlot = initial.slot_top_banner;
  assert.ok(testSlot, 'slot_top_banner should exist in default ad settings');
  const originalCode = testSlot.code;
  const originalNetwork = testSlot.network;

  // Simulate toggling isActive: false
  const updated = store.updateAdSlot('slot_top_banner', { isActive: false });
  const modifiedSlot = updated.slot_top_banner;

  assert.equal(modifiedSlot.isActive, false, 'isActive should be toggled to false');
  assert.equal(modifiedSlot.code, originalCode, 'code must NOT be erased or set to null');
  assert.equal(modifiedSlot.network, originalNetwork, 'network must NOT be overwritten');

  // Restore
  store.updateAdSlot('slot_top_banner', { isActive: true });
});

test('store.updateAdSlot correctly updates vastUrl for pre-roll slot', () => {
  const testUrl = 'https://syndication.exoclick.com/splash.php?idzone=9999999';
  const updated = store.updateAdSlot('slot_video_preroll', { vastUrl: testUrl, targetUrl: testUrl });
  
  assert.equal(updated.slot_video_preroll.vastUrl, testUrl, 'vastUrl must match the provided URL');
  assert.equal(updated.slot_video_preroll.targetUrl, testUrl, 'targetUrl must match the provided URL');
});
