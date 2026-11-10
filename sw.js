// Service worker: guarda os ficheiros em cache para a app funcionar offline e ser instalável.
const CACHE = 'pulso-v6';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/app.js', './js/engine.js', './js/knob.js', './js/scope.js', './js/defs.js', './js/worklet.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Rede primeiro (para veres sempre a versão mais recente), cache se estiveres offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
