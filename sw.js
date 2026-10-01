/* RH-Mantrailing-Assistent – Service Worker: startet die App auch ohne Internet (z. B. im Funkloch).
   Die Daten liegen im lokalen Gerätespeicher (und die Offline-Kartenkacheln in der Datenbank der App), nicht in diesem Cache.
   Bei jeder neuen Version CACHE_VERSION erhöhen (Präfix „mantrailing-“ beibehalten). */
const CACHE_PREFIX = 'mantrailing-';
const CACHE_VERSION = CACHE_PREFIX + '2.8.0';
const DATEIEN = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
/* Kartenbibliothek (MapLibre) – ohne diese beiden Dateien startet die Live-Karte offline nicht, auch wenn Kacheln gespeichert sind. */
const KARTENBIBLIOTHEK = ['https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_VERSION).then(c=>
    // Einzeln laden: eine fehlende Datei (z. B. ein Icon) darf die Installation nicht komplett verhindern.
    // Eigene Dateien mit cache:'reload', damit nicht eine bis zu zehn Minuten alte Fassung aus dem Browser-Zwischenspeicher
    // (GitHub Pages) in den neuen Cache gelangt.
    Promise.allSettled([
      ...DATEIEN.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})),
      ...KARTENBIBLIOTHEK.map(u=>c.add(u).catch(()=>{}))
    ])
  ).then(()=>self.skipWaiting()));
});
/* Nur alte Caches DIESER App löschen. Alle RH-Apps auf demselben GitHub-Pages-Konto teilen sich denselben
   Cache-Speicher; ein Löschen „aller anderen“ Caches würde die Offline-Fassung der übrigen Apps entfernen. */
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith(CACHE_PREFIX)&&x!==CACHE_VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  const u = new URL(e.request.url);
  if(u.origin===location.origin){
    // App-Dateien: Netz zuerst (Aktualisierungen kommen an), sonst Cache.
    // Nur erfolgreiche Antworten speichern, damit eine Fehlerseite (z. B. 404 bei GitHub) nie die funktionierende Fassung ersetzt.
    e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{
      if(r.ok){ const k=r.clone(); e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.put(e.request,k)).catch(()=>{})); }
      return r;
    }).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):undefined))));
    return;
  }
  if(u.host==='unpkg.com'){
    // Kartenbibliothek: Cache zuerst (Version ist in der Adresse festgeschrieben)
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{
      if(n.ok){ const k=n.clone(); e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.put(e.request,k)).catch(()=>{})); }
      return n;
    })));
  }
  // Wetter, Ortssuche und Kartenkacheln laufen bewusst am Service Worker vorbei (Kacheln speichert die App selbst).
});
