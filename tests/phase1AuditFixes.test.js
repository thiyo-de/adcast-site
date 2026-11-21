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

test('store provides all 12 dedicated ExoClick slots matching dashboard 1-to-1', () => {
  const settings = store.getAdSettings();
  const slotKeys = Object.keys(settings).filter((k) => k.startsWith('slot_'));
  
  assert.equal(slotKeys.length, 12, 'Must have exactly 12 dedicated ad slots');
  assert.ok(settings.slot_top_banner, 'slot_top_banner must exist');
  assert.ok(settings.slot_top_banner_mobile, 'slot_top_banner_mobile must exist');
  assert.ok(settings.slot_native_feed, 'slot_native_feed must exist');
  assert.ok(settings.slot_below_player, 'slot_below_player must exist');
  assert.ok(settings.slot_sticky_footer, 'slot_sticky_footer must exist');
  assert.ok(settings.slot_sticky_footer_mobile, 'slot_sticky_footer_mobile must exist');
  assert.ok(settings.slot_video_preroll, 'slot_video_preroll must exist');
  assert.ok(settings.slot_popunder, 'slot_popunder must exist');
  assert.ok(settings.slot_interstitial, 'slot_interstitial must exist');
  assert.ok(settings.slot_mobile_interstitial, 'slot_mobile_interstitial must exist');
  assert.ok(settings.slot_desktop_skyscraper_left, 'slot_desktop_skyscraper_left must exist');
  assert.ok(settings.slot_desktop_skyscraper_right, 'slot_desktop_skyscraper_right must exist');

  assert.equal(settings.slot_top_banner_mobile.zoneId, '6096160');
  assert.equal(settings.slot_sticky_footer_mobile.zoneId, '6096158');
  assert.equal(settings.slot_interstitial.zoneId, '6093518');
  assert.equal(settings.slot_mobile_interstitial.zoneId, '6100242');
});

test('DesktopGutterAds.jsx isolates 160x600 skyscraper towers to widescreen displays (2xl) with user dismiss controls', () => {
  const gutterPath = path.join(rootDir, 'src', 'components', 'DesktopGutterAds.jsx');
  assert.ok(fs.existsSync(gutterPath), 'DesktopGutterAds.jsx must exist');
  const gutterContent = fs.readFileSync(gutterPath, 'utf8');

  assert.ok(gutterContent.includes('hidden 2xl:flex'), 'Must only be visible on 2xl screens (hidden 2xl:flex)');
  assert.ok(gutterContent.includes('slot_desktop_skyscraper_left'), 'Must reference left skyscraper slot');
  assert.ok(gutterContent.includes('slot_desktop_skyscraper_right'), 'Must reference right skyscraper slot');
  assert.ok(gutterContent.includes('<AdSlot'), 'Must render AdSlot for safe ad injection');
  assert.ok(gutterContent.includes('setLeftDismissed'), 'Must provide left dismiss control');
  assert.ok(gutterContent.includes('setRightDismissed'), 'Must provide right dismiss control');
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

test('Admin.jsx provides responsive mobile bottom sheet drawer and desktop segmented navigation with flex-wrap', () => {
  const adminFilePath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const content = fs.readFileSync(adminFilePath, 'utf8');

  // Must have mobile state and drawer trigger
  assert.ok(content.includes('isMobileNavOpen'), 'Must contain isMobileNavOpen state');
  assert.ok(content.includes('sm:hidden'), 'Must have mobile specific container');
  assert.ok(content.includes('hidden sm:flex flex-wrap'), 'Must have desktop flex-wrap container so no tabs hide on PC');
  assert.ok(content.includes('Admin Tools Navigation'), 'Must have bottom sheet navigation modal');

  // Must NOT have unscrollable scrollbar-none clipping on desktop tabs
  assert.ok(!content.includes('hidden sm:flex gap-1.5 overflow-x-auto pb-1 scrollbar-none'), 'Desktop tabs must not be clipped by scrollbar-none');
});

test('Admin.jsx uses CustomSelect for all dropdowns and has zero raw select elements', () => {
  const adminFilePath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const content = fs.readFileSync(adminFilePath, 'utf8');

  assert.ok(content.includes('import CustomSelect from'), 'Must import CustomSelect');
  assert.ok(!content.includes('<select'), 'Must have zero raw <select> elements in Admin.jsx');
  assert.ok(content.includes('options={CATEGORY_OPTIONS}'), 'Must pass CATEGORY_OPTIONS to CustomSelect');
  assert.ok(content.includes('options={QUALITY_OPTIONS}'), 'Must pass QUALITY_OPTIONS to CustomSelect');
  assert.ok(content.includes('options={ADAPTER_TYPE_OPTIONS}'), 'Must pass ADAPTER_TYPE_OPTIONS to CustomSelect');
});

test('Admin.jsx implements Video Catalog pagination, quick search, and responsive mobile cards', () => {
  const adminFilePath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const content = fs.readFileSync(adminFilePath, 'utf8');

  assert.ok(content.includes('import Pagination from'), 'Must import Pagination');
  assert.ok(content.includes('catalogSearch'), 'Must have catalogSearch state');
  assert.ok(content.includes('catalogPageSize'), 'Must have catalogPageSize state');
  assert.ok(content.includes('m-vid-'), 'Must have responsive mobile video card keys');
  assert.ok(content.includes('<Pagination'), 'Must render Pagination component for video catalog');
});

test('CustomSelect.jsx enforces dark luxury aesthetic and App.jsx defaults to dark theme', () => {
  const customSelectPath = path.join(rootDir, 'src', 'components', 'CustomSelect.jsx');
  const selectContent = fs.readFileSync(customSelectPath, 'utf8');

  // Must not have white background fallback for menu popover
  assert.ok(!selectContent.includes('bg-white/95'), 'CustomSelect menu must not use bg-white/95');
  assert.ok(selectContent.includes('bg-[#0D111D]'), 'CustomSelect menu must use obsidian dark luxury bg-[#0D111D]');
  assert.ok(selectContent.includes('z-[80]'), 'CustomSelect menu must have high z-index for dropdown popover');

  // App.jsx must default to dark
  const appPath = path.join(rootDir, 'src', 'App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(!appContent.includes("matchMedia('(prefers-color-scheme: light)')"), 'App.jsx must not override default theme to light');
  assert.ok(appContent.includes("return 'dark';"), 'App.jsx must default to dark theme');

  // Admin.jsx must have responsive video modal and mobile nav drawer
  const adminPath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  assert.ok(adminContent.includes('max-h-[92vh] overflow-y-auto'), 'Video modal must have max-h and overflow-y-auto');
  assert.ok(adminContent.includes('bg-[#0E121E]'), 'Mobile nav drawer must have dark background');
});





