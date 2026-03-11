const CACHE_NAME = 'evidence-prace-v2';
// v2026-03-10 - NOVÉ: handler pro SHOW_NOTIF zprávy z main.js (upozornění na obědy v 18:00)
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/styles.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/api.js',
  '/js/notifications.js',
  '/js/main.js',
  '/js/admin-main.js',
  '/js/components/login.js',
  '/js/components/home.js',
  '/js/components/summary.js',
  '/js/components/settings.js',
  '/js/components/admin/admin.js',
  '/js/components/admin/statistics.js',
  '/js/components/stavebni-denik.js',
  'https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.prod.js',
  'https://cdn.jsdelivr.net/npm/quasar@2.12.0/dist/quasar.umd.prod.js',
  'https://cdn.jsdelivr.net/npm/quasar@2.12.0/dist/quasar.prod.css',
  'https://fonts.googleapis.com/css?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap'
];

// Install - uložit soubory do cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache otevřena');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch - vracet z cache nebo načíst ze sítě
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(response => {
          if (event.request.url.includes('action=')) return response;
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
      .catch(() => caches.match('/index.html'))
  );
});

// Activate - smazat staré cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Mažu starou cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// NOVÉ v2026-03-10: Přijmout zprávu z aplikace a zobrazit notifikaci
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIF') {
    const title = event.data.title || '🍽 Evidence práce';
    const body  = event.data.body  || 'Zkontrolujte objednávky obědů.';
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'obed-notif',          // přepíše předchozí notifikaci stejného tagu
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }
});

// Kliknutí na notifikaci — otevřít apku
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
