import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

test('store provides all 9 dedicated ExoClick slots matching dashboard 1-to-1', () => {
  const settings = store.getAdSettings();
  const slotKeys = Object.keys(settings).filter((k) => k.startsWith('slot_'));
  
  assert.equal(slotKeys.length, 9, 'Must have exactly 9 dedicated ad slots');
  assert.ok(settings.slot_top_banner, 'slot_top_banner must exist');
  assert.ok(settings.slot_top_banner_mobile, 'slot_top_banner_mobile must exist');
  assert.ok(settings.slot_native_feed, 'slot_native_feed must exist');
  assert.ok(settings.slot_below_player, 'slot_below_player must exist');
  assert.ok(settings.slot_sticky_footer, 'slot_sticky_footer must exist');
  assert.ok(settings.slot_sticky_footer_mobile, 'slot_sticky_footer_mobile must exist');
  assert.ok(settings.slot_video_preroll, 'slot_video_preroll must exist');
  assert.ok(settings.slot_popunder, 'slot_popunder must exist');
  assert.ok(settings.slot_interstitial, 'slot_interstitial must exist');

  assert.equal(settings.slot_top_banner_mobile.zoneId, '6096160');
  assert.equal(settings.slot_sticky_footer_mobile.zoneId, '6096158');
  assert.equal(settings.slot_interstitial.zoneId, '6093518');
});

test('InterstitialTrigger.jsx contains ExoClick close button selectors, backdrop detection, and non-blocking safety', () => {
  const filePath = path.join(rootDir, 'src', 'components', 'InterstitialTrigger.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Must detect ExoClick specific overlay elements
  assert.ok(content.includes('.ex-over-btn'), 'Must detect .ex-over-btn');
  assert.ok(content.includes('.ex-over-top'), 'Must detect .ex-over-top');
  assert.ok(content.includes('.ex-over-front'), 'Must detect .ex-over-front');
  assert.ok(content.includes('[id^="ad_"]'), 'Must detect [id^="ad_"]');
  assert.ok(content.includes('#adcast-interstitial-close-btn'), 'Must have dedicated close button');

  // 2. Must restore scrolling on both body and documentElement
  assert.ok(content.includes("document.body.style.overflow = ''"), 'Must restore body overflow');
  assert.ok(content.includes("document.documentElement.style.overflow = ''"), 'Must restore html overflow');

  // 3. Must check isInInterstitial so normal page buttons are never intercepted
  assert.ok(content.includes('isInInterstitial'), 'Must check isInInterstitial before intercepting');

  // 4. Must preserve ad clickthroughs inside ad content
  assert.ok(content.includes('isInsideAdContent'), 'Must check isInsideAdContent so sponsor clicks work');
});

test('CORE_CATEGORIES contains strictly 5 canonical categories and Home.jsx removes duplicate pills row', () => {
  const catFilePath = path.join(rootDir, 'src', 'constants', 'categories.js');
  const catContent = fs.readFileSync(catFilePath, 'utf8');

  // Must have strictly 5 categories
  const expectedCategoryIds = ['All', 'Trending', 'Creator Leaks', 'Amateur', 'Hardcore'];
  expectedCategoryIds.forEach((id) => {
    assert.ok(catContent.includes(`id: '${id}'`), `Must include category ${id}`);
  });

  // Must NOT include deleted empty categories
  const removedCategories = ['POV', 'MILF', 'Asian', '4K Ultra'];
  removedCategories.forEach((id) => {
    assert.ok(!catContent.includes(`id: '${id}'`), `Must NOT include deleted category ${id}`);
  });

  // Home.jsx must not contain duplicate category discovery pills row
  const homeFilePath = path.join(rootDir, 'src', 'pages', 'Home.jsx');
  const homeContent = fs.readFileSync(homeFilePath, 'utf8');
  assert.ok(!homeContent.includes('CORE_CATEGORIES.map'), 'Home.jsx must not render duplicate category pills');
});

test('Navbar.jsx hides Categories, Saved bookmarks, and Search bar when in Admin view', () => {
  const navbarFilePath = path.join(rootDir, 'src', 'components', 'Navbar.jsx');
  const content = fs.readFileSync(navbarFilePath, 'utf8');

  // Must detect admin mode via currentView
  assert.ok(content.includes("currentView === 'admin'"), 'Must compute isAdmin from currentView');

  // Must isolate consumer controls behind !isAdmin
  assert.ok(content.includes('!isAdmin && ('), 'Must conditionally hide consumer elements when in admin');
  assert.ok(content.includes('Exit to Site'), 'Must show Exit to Site button in admin view');

  // App.jsx must pass currentView to Navbar
  const appFilePath = path.join(rootDir, 'src', 'App.jsx');
  const appContent = fs.readFileSync(appFilePath, 'utf8');
  assert.ok(appContent.includes('currentView={currentView}'), 'App.jsx must pass currentView to Navbar');
});

test('Admin.jsx provides responsive mobile bottom sheet drawer and desktop segmented navigation', () => {
  const adminFilePath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const content = fs.readFileSync(adminFilePath, 'utf8');

  // Must have mobile state and drawer trigger
  assert.ok(content.includes('isMobileNavOpen'), 'Must contain isMobileNavOpen state');
  assert.ok(content.includes('sm:hidden'), 'Must have mobile specific container');
  assert.ok(content.includes('hidden sm:flex'), 'Must have desktop specific container');
  assert.ok(content.includes('Admin Tools Navigation'), 'Must have bottom sheet navigation modal');
});



