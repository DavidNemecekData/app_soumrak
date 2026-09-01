/* Service worker — celá aplikace je statická, takže cache-first.
   Aktualizace se vydá zvýšením VERSION; starý cache se pak smaže. */

const VERSION = 'soumrak-v7';

/* Relativní cesty, aby aplikace fungovala i v podadresáři
   (GitHub Pages servíruje na /nazev-repozitare/). */
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/ui.js',
  './js/db.js',
  './js/model.js',
  './js/stats.js',
  './js/instruments.js',
  './js/thoughts.js',
  './js/strings.cs.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  // Autotest se cachuje schválně: nejvíc se hodí spustit ho na telefonu,
  // klidně i bez připojení.
  './tests/',
  './tests/index.html',
  './tests/selftest.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigace: nejdřív přesná shoda v cache, pak síť, a teprve když je
  // zařízení offline, app shell. Natvrdo vracet index.html by pohltilo
  // každou adresu v rozsahu — třeba /tests/.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Do cache jde jen to, co je opravdu naše a v pořádku.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});
