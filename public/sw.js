const CACHE_NAME = 'groundtruth-cache-v1';

// Pre-cache core shell resources on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.svg'
      ]);
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept requests and serve offline App Shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept GET requests, and skip external database/API calls (Supabase/Groq)
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/v1/chat/completions')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone and cache it dynamically
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — fall back to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If client-side router navigation request fails, return the cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
