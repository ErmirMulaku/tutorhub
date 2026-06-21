/**
 * TutorHub service worker — a small, hand-written offline layer (no Workbox).
 *
 * Strategy:
 *  - Static build assets (`/_next/static`, icons): cache-first (immutable).
 *  - Page navigations: network-first, falling back to the cached page, then to
 *    the cached home shell when fully offline.
 */
const CACHE = 'tutorhub-v1';
const PRECACHE = ['/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      }),
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return res;
    })
    .catch(() => caches.match(request).then((hit) => hit || caches.match('/')));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static') || PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
