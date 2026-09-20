// Firebase Cloud Messaging Background Service Worker
// Automatically loaded by Firebase SDK when running in background

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyANcdsPT054jotKUvU950kj9wWyBMZJ8g8",
  authDomain: "nexplayorg-app.firebaseapp.com",
  projectId: "nexplayorg-app",
  storageBucket: "nexplayorg-app.firebasestorage.app",
  messagingSenderId: "882712406279",
  appId: "1:882712406279:web:86cc15d0ce544241abfda2"
};

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
