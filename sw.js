// MagicRace 0.2.1 : cache hors ligne. Fabrication 20261119-000213 (change à chaque fois, pour que les mises à jour arrivent).
const VERSION = 'magicrace-20261119-000213';
const FONTS = 'magicrace-fonts';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png?v=1',
  './icons/icon-512.png?v=1',
  './icons/icon-maskable-512.png?v=1',
  './icons/apple-touch-icon.png?v=1',
  './js/util.js?v=0.2.1',
  './js/catalog.js?v=0.2.1',
  './js/cards.js?v=0.2.1',
  './js/firebase.js?v=0.2.1',
  './js/sync.js?v=0.2.1',
  './js/audio.js?v=0.2.1',
  './js/marbleGL.js?v=0.2.1',
  './js/physics.js?v=0.2.1',
  './js/levels.js?v=0.2.1',
  './js/fx.js?v=0.2.1',
  './js/render.js?v=0.2.1',
  './js/ui.js?v=0.2.1',
  './js/packs.js?v=0.2.1',
  './js/settings.js?v=0.2.1',
  './js/progress.js?v=0.2.1',
  './js/account.js?v=0.2.1',
  './js/profile.js?v=0.2.1',
  './js/main.js?v=0.2.1'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {          // la page : réseau d'abord (mises à jour), sinon la copie hors ligne
      e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html')));
      return;
    }
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {   // polices gardées après la 1re visite
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
  }
});