const CACHE_NAME = 'evidence-prace-v1';
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
        // Cache hit - vrátit z cache
        if (response) {
          return response;
        }
        
        // Není v cache - načíst ze sítě
        return fetch(event.request).then(response => {
          // Nekešovat API requesty
          if (event.request.url.includes('action=')) {
            return response;
          }
          
          // Uložit do cache pro příště
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        });
      })
      .catch(() => {
        // Offline - vrátit základní stránku
        return caches.match('/index.html');
      })
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
