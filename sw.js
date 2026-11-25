// Service worker do QuizGen: guarda o app para abrir rápido e funcionar offline.
// Ao mudar qualquer arquivo, aumente a versão abaixo para os celulares baixarem a atualização.
const VERSION = 'quizgen-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // chamadas à API do Gemini passam direto
  const url = new URL(req.url);
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) return;

  // Páginas: rede primeiro, cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { caches.open(VERSION).then(c => c.put('index.html', r.clone())); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Arquivos do app e fontes: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok && (url.origin === location.origin || url.hostname.includes('fonts.'))) {
        const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
