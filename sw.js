const CACHE_NAME = 'aura-app-v1.1';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

// Service Worker Install State - cache all core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching critical assets');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Failed to cache some files (they will load dynamically):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate state - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept network requests - Cache First policy
self.addEventListener('fetch', (event) => {
  // Filter out browser extensions and non-HTTP requests
  if (!event.request.url.startsWith('http')) return;

  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Exclude Firebase active API endpoints but ALLOW caching of static JS SDK assets & Google Fonts
  const isFirebaseApi = event.request.url.includes('identitytoolkit.googleapis.com') || 
                         event.request.url.includes('securetoken.googleapis.com');
  
  if (isFirebaseApi) {
    return; // Force network check for dynamic auth/token requests
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to update cache (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {/* Ignore offline fetch errors */});
        
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
