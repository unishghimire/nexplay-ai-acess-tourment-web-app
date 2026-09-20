// NexPlay Esports PWA Service Worker
const CACHE_NAME = 'nexplay-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

// Install: pre-cache critical app shell icons & manifest
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Continue install even if one asset fails to cache
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: claim clients immediately and purge older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: pass-through for Firebase Auth, Firestore, APIs, and cross-origin requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude Firebase, Cloudinary, API, and non-GET requests from caching
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/auth/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('cloudinary')
  ) {
    return;
  }

  // Network-first for all same-origin GET requests with graceful fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Optionally cache successfully retrieved static assets
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.json') ||
           url.pathname.endsWith('.svg'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS: Background delivery to native mobile/desktop
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'NexPlay Esports', body: event.data.text() };
    }
  }

  const notificationData = payload.notification || payload;
  const title = notificationData.title || 'NexPlay Esports';
  const body = notificationData.body || payload.message || 'You have a new esports notification!';
  const icon = notificationData.icon || '/logo.png';
  const badge = notificationData.badge || '/favicon-32x32.png';
  const targetUrl = payload.data?.url || payload.url || payload.link || '/';

  const options = {
    body,
    icon,
    badge,
    data: {
      url: targetUrl,
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.tag || `nexplay-${Date.now()}`,
    renotify: true,
    actions: [
      { action: 'open', title: 'View Details' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification tap / click to focus existing window or open target route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window to the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
