// Service worker de Qubia Craft.
// Páginas (index.html): primero la red, para que cada despliegue llegue al
// momento; la copia guardada solo se usa sin conexión. Recursos con hash
// (/assets/…) e iconos: primero la caché, porque nunca cambian de contenido.
const CACHE = 'qubia-craft-v2';
const ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.includes('/api/')) return; // API: siempre red

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && new URL(req.url).pathname === '/') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/')))
    );
    return;
  }

  e.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
