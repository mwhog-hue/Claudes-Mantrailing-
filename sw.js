// RH Mantrailing-Assistent – Service Worker
// Cacht nur die App-Hülle (HTML/Manifest/Icons), damit die App auch ohne
// Internet startet. Wetterdaten, Kartenkacheln und die MapLibre-Bibliothek
// werden weiterhin ganz normal live aus dem Netz geladen, wenn online.

const CACHE = 'rh-mantrailing-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nur eigene Dateien (gleicher Ursprung) aus dem Cache bedienen.
  // Alles andere (Wetter-API, Kartenkacheln, MapLibre-CDN) unangetastet
  // ans Netz durchreichen – dafür braucht die App ohnehin Internet.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
