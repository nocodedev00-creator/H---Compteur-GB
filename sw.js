/* ============================================================
 * Stat-GB - Service Worker
 * Garantit le fonctionnement 100% hors-ligne (cache-first)
 * ============================================================ */



const CACHE_NAME = 'hbc-nantes-live-v10';










// Ressources locales à mettre en cache (hors-ligne)
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Installation : pré-cache des ressources locales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Stratégie : cache-first pour les ressources locales,
// network-first (avec fallback cache) pour les CDN (Tailwind, Lucide, Fonts).
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ne pas intercepter les requêtes non-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ressources locales : cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // CDN (Tailwind, Lucide, Google Fonts) : network-first avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
