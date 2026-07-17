// Increment CACHE_VERSION whenever you deploy new assets to bust stale caches.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `groundtruth-${CACHE_VERSION}`;

// Pre-cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.json', '/favicon.png'])
    )
  );
  self.skipWaiting();
});

// Remove outdated caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// Network-first with cache fallback for same-origin GET requests.
// External API calls (Supabase, Groq) are never intercepted.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests; skip API endpoints
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/rest/v1') ||
    url.pathname.startsWith('/v1/')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response?.status === 200) {
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            (request.mode === 'navigate' ? caches.match('/index.html') : undefined)
        )
      )
  );
});
