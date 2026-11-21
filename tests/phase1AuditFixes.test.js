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

test('AdBlock detection uses Brave-sensitive canaries, fast 250ms timers, and Interstitial renders as centered popup on mobile', () => {
  const detectionFile = path.join(rootDir, 'src', 'services', 'adBlockDetection.js');
  const detectionContent = fs.readFileSync(detectionFile, 'utf8');

  // Brave Shields canary verification
  assert.ok(detectionContent.includes('a.magsrv.com/ad-provider.js'), 'Must probe a.magsrv.com for Brave Shields and Opera');
  assert.ok(detectionContent.includes('anyBlocked = true'), 'Must trigger when any canary ad CDN is blocked');
  assert.ok(detectionContent.includes('setTimeout(async () => {'), 'Must schedule initial probe');
  assert.ok(detectionContent.includes('}, 250);'), 'Probe and confirmation timers must be 250ms for sub-second detection');

  // AdBlockContext fast mount verification
  const contextFile = path.join(rootDir, 'src', 'services', 'adBlockContext.jsx');
  const contextContent = fs.readFileSync(contextFile, 'utf8');
  assert.ok(contextContent.includes('}, 250);'), 'Mount settle delay in AdBlockContext must be 250ms');

  // InterstitialTrigger mobile popup verification
  const interstitialFile = path.join(rootDir, 'src', 'components', 'InterstitialTrigger.jsx');
  const interstitialContent = fs.readFileSync(interstitialFile, 'utf8');
  assert.ok(
    interstitialContent.includes("slot_interstitial") && !interstitialContent.includes("const slotKey = isMobile ? 'slot_mobile_interstitial' : 'slot_interstitial'"),
    'Must use responsive centered popup slot across all viewports instead of mobile drawer'
  );
});

test('AdBlockNotice locks html/body/touchAction against mobile scroll glitch and StickyFooter suppresses duplicate close bar', () => {
  const noticeFile = path.join(rootDir, 'src', 'components', 'AdBlockNotice.jsx');
  const noticeContent = fs.readFileSync(noticeFile, 'utf8');

  // Verify dual-element scroll lock and touch containment
  assert.ok(noticeContent.includes("document.documentElement.style.overflow = 'hidden'"), 'Must lock documentElement overflow');
  assert.ok(noticeContent.includes("document.body.style.overflow = 'hidden'"), 'Must lock body overflow');
  assert.ok(noticeContent.includes("document.body.style.touchAction = 'none'"), 'Must set touchAction none');
  assert.ok(noticeContent.includes('overscroll-contain'), 'Must contain overscroll on mobile');
  assert.ok(noticeContent.includes('max-h-[92dvh]'), 'Must restrict card max-height on small screens');

  const stickyFile = path.join(rootDir, 'src', 'components', 'StickyFooter.jsx');
  const stickyContent = fs.readFileSync(stickyFile, 'utf8');

  // Verify duplicate provider close bar suppression and single unified button
  assert.ok(stickyContent.includes('#adcast-sticky-footer .exo-close'), 'Must suppress provider .exo-close bar');
  assert.ok(stickyContent.includes('display: none !important;'), 'Must hide provider close bars');
  assert.ok(stickyContent.includes('{isLoaded && ('), 'Must render corner close button as sole unified button');
});

