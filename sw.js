// Service worker: guarda os ficheiros em cache para a app funcionar offline e ser instalável.
const CACHE = 'pulso-v11';
const FILES = [
  './', './index.html', './style.css?v=11', './manifest.webmanifest',
  ...['app', 'engine', 'knob', 'scope', 'defs', 'stage', 'worklet'].map((f) => `./js/${f}.js?v=11`),
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
// Rede primeiro (para veres sempre a versão mais recente), cache se estiveres offline.
// O pedido à rede ignora a cache HTTP do browser (o GitHub Pages guarda os ficheiros 10 minutos),
// senão a página nova podia arrancar com scripts antigos.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  const req = sameOrigin ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;
  e.respondWith(
    fetch(req)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
