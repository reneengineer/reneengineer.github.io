const CACHE_NAME = 'between-us-v10';
const ASSETS = [
  '/cardgame/',
  '/cardgame/index.html',
  '/cardgame/style.css',
  '/cardgame/app.js',
  '/cardgame/questions.js',
  '/cardgame/manifest.json',
  '/cardgame/icons/icon-192.png',
  '/cardgame/icons/icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
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

// Fetch — network first for HTML/JS/CSS, cache fallback for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For same-origin navigations and core assets, try network first
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('/cardgame/index.html');
          }
        });
      })
    );
  } else {
    // External resources (fonts, etc.) — cache first
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
