const CACHE_NAME = 'aura-app-v2.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-192.png',
  './icon-512.png'
  // Firebase SDK files intentionally excluded: served from Google CDN with long cache-control headers.
  // Caching opaque cross-origin responses risks serving corrupted/stale Firebase SDK.
];

// Service Worker Install State - cache all core files bypass HTTP cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching critical assets with reload bypass');
      // Use cache: 'reload' on Requests to force network fetch, bypassing stale browser HTTP cache
      const cachePromises = ASSETS.map((url) => {
        const request = new Request(url, { cache: 'reload' });
        return fetch(request).then((response) => {
          if (response.ok || response.status === 0) { // status 0 allows caching cross-origin opaque CDN assets
            return cache.put(url, response);
          }
          throw new Error(`Failed to fetch ${url} (status: ${response.status})`);
        });
      });
      return Promise.all(cachePromises).catch(err => {
        console.error('Failed to cache some assets during install:', err);
        throw err;
      });
    })
  );
  // DELETED self.skipWaiting() from here so that PWA update toast works perfectly!
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

// Intercept network requests - Stale-While-Revalidate with robust Firebase exclusion
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Dynamic Auth, Realtime Database, Firestore, and Google Account services robust exclusions
  // Allow Google Fonts to be cached offline, but block all firebase / auth / real-time googleapis
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isAuthOrFirebase = 
    !isGoogleFont && (
      url.hostname.endsWith('firebaseapp.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('web.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('google.com') ||
      url.hostname === 'ssl.gstatic.com' ||
      url.hostname === 'www.gstatic.com' ||
      event.request.url.includes('/__/auth/') ||
      event.request.url.includes('identitytoolkit') ||
      event.request.url.includes('securetoken')
    );
  
  if (isAuthOrFirebase) {
    return; // Force direct network pass-through
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to update cache (Stale-While-Revalidate)
        // Reconstruct the request if mode is 'navigate' to prevent security policy crash on background fetch
        let fetchReq = event.request;
        if (event.request.mode === 'navigate') {
          fetchReq = new Request(event.request.url, {
            method: event.request.method,
            headers: event.request.headers,
            credentials: event.request.credentials,
            redirect: event.request.redirect
          });
        }

        fetch(fetchReq).then((networkResponse) => {
          if (networkResponse.status === 200 || networkResponse.status === 0) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {/* Ignore offline fetch errors */});
        
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200 || networkResponse.status === 0) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Network error and no cache available.', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      });
    })
  );
});

// Support programmatic skipWaiting message triggers from PWA Update Toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
