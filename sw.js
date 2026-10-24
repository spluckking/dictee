/*
 * sw.js — Service worker : met toute l'appli en cache pour le hors-ligne.
 *
 * Tous les chemins sont relatifs à l'emplacement de sw.js, donc l'appli
 * fonctionne aussi bien à la racine d'un domaine que sous
 * https://pseudo.github.io/nom-du-depot/ (portée = dossier du dépôt).
 *
 * Stratégie : « cache d'abord, mise à jour en arrière-plan ». L'appli se lance
 * instantanément depuis le cache ; si le réseau est là, les fichiers sont
 * rafraîchis pour le lancement suivant. Changer VERSION force un recache complet.
 */
const VERSION = 'dictee-blocs-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/align.js',
  './js/leitner.js',
  './js/distractors.js',
  './js/syllables.js',
  './js/store.js',
  './js/speech.js',
  './js/sound.js',
  './js/pixel.js',
  './js/app.js',
  './fonts/press-start-2p.woff2',
  './fonts/andika-400.woff2',
  './fonts/andika-700.woff2',
  './fonts/playwrite-fr-moderne.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (ouverture de l'appli) : toujours la page principale.
  const isNav = req.mode === 'navigate';
  const key = isNav ? new URL('./index.html', self.registration.scope).href : req;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      return res || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })
  );
});
