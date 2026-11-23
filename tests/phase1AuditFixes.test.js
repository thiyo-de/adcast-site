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
import { computeCategoryCounts, getAvailableCategories } from '../src/constants/categories.js';
import { api } from '../src/services/supabase.js';

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
  assert.equal(settings.slot_desktop_skyscraper_left.zoneId, '6100280');
  assert.equal(settings.slot_desktop_skyscraper_right.zoneId, '6100290');
});

test('CORE_CATEGORIES contains canonical categories including Indian Leaks and Home.jsx removes duplicate pills row', () => {
  const catFilePath = path.join(rootDir, 'src', 'constants', 'categories.js');
  const catContent = fs.readFileSync(catFilePath, 'utf8');

  // Must include canonical categories
  const expectedCategoryIds = ['All', 'Trending', 'Indian Leaks', 'Creator Leaks', 'Amateur', 'Hardcore'];
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

test('Admin.jsx and store synchronize all 12 ExoClick slots and self-heal stale storage', () => {
  // Simulate stale localStorage with missing zoneId or placeholder
  const staleData = {
    slot_top_banner: { isActive: true, zoneId: '6093488', code: 'test' },
    slot_desktop_skyscraper_left: { isActive: true, zoneId: '', code: '<ins data-zoneid=""></ins>' }
  };
  localStorage.setItem('adcast_ad_settings', JSON.stringify(staleData));

  const hydrated = store.getAdSettings();
  const slotKeys = Object.keys(hydrated).filter((k) => k.startsWith('slot_'));

  assert.equal(slotKeys.length, 12, 'Admin and store must have all 12 slots');
  assert.equal(hydrated.slot_desktop_skyscraper_left.zoneId, '6100280', 'Stale left skyscraper must self-heal to 6100280');
  assert.equal(hydrated.slot_desktop_skyscraper_right.zoneId, '6100290', 'Right skyscraper must be populated with 6100290');
  assert.equal(hydrated.slot_mobile_interstitial.zoneId, '6100242', 'Mobile interstitial must be populated with 6100242');

  // Verify Admin.jsx preferredOrder contains all 12 slots
  const adminPath = path.join(rootDir, 'src', 'pages', 'Admin.jsx');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  slotKeys.forEach((key) => {
    assert.ok(adminContent.includes(`'${key}'`), `Admin.jsx preferredOrder must include ${key}`);
  });
});

test('getAvailableCategories and computeCategoryCounts dynamically discover and count new categories', () => {
  const sampleVideos = [
    { id: '1', title: 'Video 1', category: 'Indian Leaks' },
    { id: '2', title: 'Video 2', category: 'Indian Leaks' },
    { id: '3', title: 'Video 3', category: 'Cosplay' },
    { id: '4', title: 'Video 4', category: 'Virtual Reality' }
  ];

  const counts = computeCategoryCounts(sampleVideos);
  assert.equal(counts.All, 4);
  assert.equal(counts['Indian Leaks'], 2);
  assert.equal(counts['Cosplay'], 1, 'Must dynamically count custom category Cosplay');
  assert.equal(counts['Virtual Reality'], 1, 'Must dynamically count custom category Virtual Reality');

  const categories = getAvailableCategories(counts);
  const catIds = categories.map((c) => c.id);
  assert.ok(catIds.includes('Cosplay'), 'getAvailableCategories must include Cosplay');
  assert.ok(catIds.includes('Virtual Reality'), 'getAvailableCategories must include Virtual Reality');
});

test('api.getLocalVideosPage performs round-robin category interleaving on All Streams feed', () => {
  // Seed store with 3 videos of Cat A and 3 videos of Cat B
  const mockVideos = [
    { id: 'a1', title: 'A1', category: 'CatA', created_at: '2026-11-20T10:00:00Z' },
    { id: 'a2', title: 'A2', category: 'CatA', created_at: '2026-11-20T09:00:00Z' },
    { id: 'a3', title: 'A3', category: 'CatA', created_at: '2026-11-20T08:00:00Z' },
    { id: 'b1', title: 'B1', category: 'CatB', created_at: '2026-11-20T09:30:00Z' },
    { id: 'b2', title: 'B2', category: 'CatB', created_at: '2026-11-20T08:30:00Z' },
    { id: 'b3', title: 'B3', category: 'CatB', created_at: '2026-11-20T07:30:00Z' }
  ];
  const origGetVideos = store.getVideos;
  store.getVideos = () => mockVideos;

  try {
    // Query All Streams
    const res = api.getLocalVideosPage({ page: 1, pageSize: 6, category: 'All', sort: 'newest' });
    const categorySequence = res.items.map((v) => v.category);

    // The categories should alternate round-robin instead of all CatA followed by all CatB
    assert.notEqual(categorySequence[0], categorySequence[1], 'Consecutive videos should round-robin across categories');
    assert.equal(res.items.length, 6, 'All items must be present');
  } finally {
    store.getVideos = origGetVideos;
  }
});

test('only active ExoClick zones for this view and device supply detector endpoints', async () => {
  const { exoProbeUrls } = await import('../src/services/adBlockDetection.js');
  const settings = {
    slot_top_banner: { isActive: true, code: 'https://a.magsrv.com/ad-provider.js' },
    slot_top_banner_mobile: { isActive: false, code: 'https://a.magsrv.com/ad-provider.js' },
    slot_popunder: { isActive: true, code: 'https://example.org/ad.js' },
    slot_video_preroll: { isActive: true, vastUrl: 'https://s.pemsrv.com/v1/vast.php?idz=123' }
  };
  assert.deepEqual(exoProbeUrls(settings, 'home', false, false), ['https://a.magsrv.com/ad-provider.js']);
  assert.deepEqual(exoProbeUrls(settings, 'home', true, false), []);
  assert.deepEqual(exoProbeUrls(settings, 'watch', true, false), ['https://a.pemsrv.com/ad-provider.js']);
  assert.deepEqual(exoProbeUrls(settings, 'privacy', false, true), []);
});

test('AdBlockNotice locks html/body/touchAction against mobile scroll glitch', () => {
  const noticeFile = path.join(rootDir, 'src', 'components', 'AdBlockNotice.jsx');
  const noticeContent = fs.readFileSync(noticeFile, 'utf8');

  // Verify dual-element scroll lock and touch containment
  assert.ok(noticeContent.includes("document.documentElement.style.overflow = 'hidden'"), 'Must lock documentElement overflow');
  assert.ok(noticeContent.includes("document.body.style.overflow = 'hidden'"), 'Must lock body overflow');
  assert.ok(noticeContent.includes("document.body.style.touchAction = 'none'"), 'Must set touchAction none');
  assert.ok(noticeContent.includes('overscroll-contain'), 'Must contain overscroll on mobile');
  assert.ok(noticeContent.includes('max-h-[92dvh]'), 'Must restrict card max-height on small screens');

});

test('Supabase and store persist frequencyMinutes and migrate all 12 ad slots', () => {
  const storeSettings = store.getAdSettings();
  assert.equal(storeSettings.slot_video_preroll.frequencyMinutes, 0, 'Pre-roll default frequencyMinutes must be 0');

  const supabaseFile = path.join(rootDir, 'src', 'services', 'supabase.js');
  const content = fs.readFileSync(supabaseFile, 'utf8');

  assert.ok(content.includes('frequency_minutes:'), 'Must persist frequency_minutes');
  const migration = fs.readFileSync(path.join(rootDir, 'supabase/migrations/202611210001_ad_placement_settings.sql'), 'utf8');
  for (const id of ['slot_mobile_interstitial', 'slot_desktop_skyscraper_left', 'slot_desktop_skyscraper_right']) {
    assert.ok(migration.includes(id));
  }
  assert.match(migration, /ON CONFLICT \(slot_id\) DO NOTHING/);
});
