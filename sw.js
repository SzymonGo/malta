// Service worker: precache całej aplikacji, cache-first dla zasobów,
// network-first (z fallbackiem do cache) dla data/trip.json.
// Po zmianie dowolnego pliku podbij VERSION (albo: node tools/update-sw.mjs --bump).

const VERSION = 'malta-v1';

// <assets> (lista generowana przez tools/update-sw.mjs)
const CORE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'data/trip.json',
  'js/links.js',
  'js/schedule.js',
  'js/store.js',
  'js/util.js',
  'js/validate.js',
  'js/views.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];
const IMAGES = [
  'img/archaeology.jpg',
  'img/blueGrotto-2.jpg',
  'img/blueGrotto.jpg',
  'img/catacombs.jpg',
  'img/cittadella-2.jpg',
  'img/cittadella.jpg',
  'img/dingli-2.jpg',
  'img/dingli.jpg',
  'img/dwejra-2.jpg',
  'img/dwejra.jpg',
  'img/fortStAngelo-2.jpg',
  'img/fortStAngelo.jpg',
  'img/fortStElmo.jpg',
  'img/gardjola.jpg',
  'img/ggantija.jpg',
  'img/grandmaster.jpg',
  'img/hagarQim-2.jpg',
  'img/hagarQim.jpg',
  'img/hypogeum.jpg',
  'img/inquisitor.jpg',
  'img/lascaris.jpg',
  'img/marsaxlokk-2.jpg',
  'img/marsaxlokk.jpg',
  'img/mdina-2.jpg',
  'img/mdina.jpg',
  'img/mdinaCathedral.jpg',
  'img/mgarr.jpg',
  'img/ramla.jpg',
  'img/sliema.jpg',
  'img/spinola.jpg',
  'img/stJohns-2.jpg',
  'img/stJohns.jpg',
  'img/stPetersPool.jpg',
  'img/tapinu.jpg',
  'img/tarxien.jpg',
  'img/upperBarrakka-2.jpg',
  'img/upperBarrakka.jpg',
  'img/xlendi.jpg'
];
// </assets>

const scopeUrl = path => new URL(path, self.registration.scope).href;
const ALL = () => [...CORE, ...IMAGES].map(scopeUrl);

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(CORE.map(u => new Request(scopeUrl(u), { cache: 'reload' })));
      // Zdjęcia osobno – pojedynczy błąd nie blokuje instalacji; braki dociąga strona.
      await Promise.allSettled(IMAGES.map(u => cache.add(new Request(scopeUrl(u), { cache: 'reload' }))));
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('malta-') && k !== VERSION).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_ASSETS' && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, assets: ALL() });
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok && new URL(request.url).origin === self.location.origin) cache.put(request, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(request.url, { cache: 'no-cache', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      await cache.put(scopeUrl('data/trip.json'), res.clone());
      return res;
    }
    throw new Error('HTTP ' + res.status);
  } catch (err) {
    clearTimeout(timer);
    const hit = await cache.match(scopeUrl('data/trip.json'));
    return hit || Response.error();
  }
}

async function appShell() {
  const cache = await caches.open(VERSION);
  const hit = (await cache.match(scopeUrl('index.html'))) || (await cache.match(scopeUrl('./')));
  if (hit) return hit;
  try {
    return await fetch(scopeUrl('index.html'));
  } catch (err) {
    return new Response('<h1>Offline</h1><p>Otwórzcie aplikację raz z internetem.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // linki zewnętrzne: zwykła sieć
  if (!url.href.startsWith(self.registration.scope)) return;
  if (req.mode === 'navigate') {
    event.respondWith(appShell());
    return;
  }
  if (url.pathname.endsWith('/data/trip.json')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
