// Firebase Cloud Messaging Background Service Worker
// Automatically loaded by Firebase SDK when running in background
//
// ponytail: the Firebase web config lives in /firebase-applet-config.json
// (single source of truth, same values the app bundle uses). Firebase web API
// keys are public identifiers by design — access control is enforced by
// Firestore rules + App Check, not by hiding this config.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

fetch('/firebase-applet-config.json')
  .then((res) => {
    if (!res.ok) throw new Error('config fetch HTTP ' + res.status);
    return res.json();
  })
  .then((firebaseConfig) => {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    // Background message handler
    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification?.title || payload.data?.title || 'NexPlay Esports';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'New tournament update available!',
        icon: payload.notification?.icon || '/logo.png',
        badge: '/favicon-32x32.png',
        data: {
          url: payload.data?.url || payload.data?.link || '/',
          timestamp: Date.now()
        },
        vibrate: [200, 100, 200],
        tag: payload.data?.tag || `nexplay-${Date.now()}`
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  })
  .catch((err) => {
    // Push notifications are unavailable without config — the rest of the
    // service worker (notification clicks) still functions.
    console.warn('[FCM SW] Firebase config unavailable, push notifications disabled:', err);
  });

// Handle notification click / tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
