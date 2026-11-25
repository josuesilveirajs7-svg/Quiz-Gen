// Service worker do QuizGen.
// Estratégia: sempre busca a versão mais nova na internet; usa a cópia guardada só quando estiver offline.
// Assim o celular nunca fica preso numa versão antiga.
const VERSION = 'quizgen-v5';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.allSettled(SHELL.map(f => fetch(f, {cache: 'reload'}).then(r => r.ok && c.put(f, r)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin, font = url.hostname.startsWith('fonts.g');
  if (!same && !font) return;                                   // API do Gemini e outros: direto pela rede
  e.respondWith(
    fetch(req, same ? {cache: 'no-cache'} : undefined).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, copy)); }
      return r;
    }).catch(() => caches.match(req, {ignoreSearch: true})
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
