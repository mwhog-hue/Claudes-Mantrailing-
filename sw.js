/* RH-Mantrailing-Assistent – Service Worker: startet die App auch ohne Internet (z. B. im Funkloch).
   Die Daten liegen im lokalen Gerätespeicher, nicht in diesem Cache.
   Bei jeder neuen Version CACHE_VERSION erhöhen. */
const CACHE_VERSION = 'mantrailing-2.2.0';
const DATEIEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
/* Kartenbibliothek (MapLibre) – ohne diese beiden Dateien startet die Live-Karte offline nicht, auch wenn Kacheln gespeichert sind. */
const KARTENBIBLIOTHEK = ['https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_VERSION).then(c=>
    // Einzeln laden: eine fehlende Datei (z. B. ein Icon) darf die Installation nicht komplett verhindern.
    Promise.allSettled([...DATEIEN, ...KARTENBIBLIOTHEK].map(u=>c.add(u).catch(()=>{})))
  ).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  const u = new URL(e.request.url);
  if(u.origin===location.origin){
    // App-Dateien: Netz zuerst (Aktualisierungen kommen an), sonst Cache
    e.respondWith(fetch(e.request).then(r=>{ const k=r.clone(); caches.open(CACHE_VERSION).then(c=>c.put(e.request,k)); return r; })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
    return;
  }
  if(u.host==='unpkg.com'){
    // Kartenbibliothek: Cache zuerst (Version ist in der Adresse festgeschrieben)
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{ const k=n.clone(); caches.open(CACHE_VERSION).then(c=>c.put(e.request,k)); return n; })));
  }
  // Wetter, Ortssuche und Kartenkacheln laufen bewusst am Service Worker vorbei (Kacheln speichert die App selbst).
});
