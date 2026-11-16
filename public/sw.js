/**
 * AdCast Service Worker
 * Provides offline caching for static assets, styles, and fonts.
 */

const CACHE_NAME = 'adcast-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
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
  // Only handle GET requests and skip video streams / ad scripts
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip video blobs and ad requests
  if (
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.m3u8') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googlevideo.com') ||
    url.hostname.includes('exoclick') ||
    url.hostname.includes('juicyads') ||
    url.hostname.includes('trafficfactory')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.origin === self.location.origin || url.hostname.includes('jsdelivr.net') || url.hostname.includes('fonts.googleapis.com'))
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
