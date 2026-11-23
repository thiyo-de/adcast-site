/**
 * AdCast Service Worker (v2 - Hardened Network-First Strategy)
 * Resolves C16: Reliable update delivery without stale-cache traps.
 */

const CACHE_NAME = 'adcast-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname === '/ads/banner-ad.js') return;

  // Development modules are not immutable assets. Never cache Vite's source or runtime.
  if (url.origin === self.location.origin &&
      /^\/(src\/|node_modules\/|@vite\/|@id\/|@fs\/|@react-refresh)/.test(url.pathname)) return;

  // 1. Strict Exclusion: Never intercept video streams, APIs, or ad providers
  const isExcluded =
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.webm') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('magsrv.com') ||
    url.hostname.includes('pemsrv.com') ||
    url.hostname.includes('exdynsrv.com') ||
    url.hostname.includes('exoclick.com') ||
    url.hostname.includes('juicyads') ||
    url.hostname.includes('trafficfactory') ||
    url.hostname.includes('adsterra');

  if (isExcluded) return;

  // 2. Navigation / HTML Document Requests -> Network-First (C16)
  // Ensures user always gets the newest deployed index.html and fresh chunk hashes
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // 3. Static Assets (Hashed JS, CSS, Fonts) -> Cache-First with Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === self.location.origin ||
           url.hostname.includes('jsdelivr.net') ||
           url.hostname.includes('fonts.googleapis.com') ||
           url.hostname.includes('fonts.gstatic.com'))
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
