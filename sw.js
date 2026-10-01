/* RH Trümmersuchassistent – Service Worker
   Version 3.2.0 · Strategie: Netz zuerst, Cache als Rückfall (Offline-Start).
   Bei jeder neuen App-Version die Zeile CACHE_VERSION anpassen (Präfix „rh-truemmer-“ beibehalten),
   damit alte Dateien ersetzt werden. */
const CACHE_PREFIX = 'rh-truemmer-';
const CACHE = CACHE_PREFIX + '3.2.0';

/* Kern: muss gelingen (App-Seite). */
const CORE = ['./', './index.html'];

/* Optional: wird vorgeladen, wenn vorhanden; fehlende Dateien brechen die
   Installation nicht ab. Namen bei Bedarf an das eigene Repository anpassen. */
const OPTIONAL = [
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png',
  './icon.png', './favicon.ico'
];

/* Kartenbibliothek (Leaflet) von cdnjs: wird vorab gespeichert, damit die Online-Karte-Funktion
   auch dann startet, wenn sie zuvor nie online geöffnet wurde. Kacheln benötigen weiterhin Internet. */
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* cache:'reload' – nicht eine bis zu zehn Minuten alte Fassung aus dem Browser-Zwischenspeicher (GitHub Pages) übernehmen. */
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    await Promise.allSettled([
      ...OPTIONAL.map(u => c.add(new Request(u, { cache: 'reload' }))),
      ...LIBS.map(u => c.add(u))
    ]);
    await self.skipWaiting();
  })());
});

/* Nur alte Caches DIESER App löschen. Alle RH-Apps auf demselben GitHub-Pages-Konto teilen sich
   denselben Cache-Speicher; das Löschen „aller anderen“ Caches würde die Offline-Fassung der übrigen Apps entfernen. */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Wetterdienst, Ortssuche, Anthropic-API, Kartenkacheln: nie zwischenspeichern. */
  if (/open-meteo\.com|nominatim|geocoding|api\.anthropic\.com|tile\.openstreetmap|tile\.opentopomap/.test(url.host)) return;

  /* Bibliotheken vom CDN: Cache zuerst, sonst Netz und merken. */
  if (CDN_HOSTS.includes(url.host)) {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) event.waitUntil(c.put(req, res.clone()).catch(() => {}));
      return res;
    })());
    return;
  }

  /* Eigene Dateien: Netz zuerst, bei Ausfall aus dem Cache. */
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) event.waitUntil(c.put(req, res.clone()).catch(() => {}));
        return res;
      } catch (e) {
        const hit = await c.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await c.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
  }
});

/* Sofortiges Aktivieren, falls die Seite es anfordert. */
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
