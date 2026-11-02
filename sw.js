/* Netwerk eerst (altijd nakijken bij GitHub, niet de browsercache), cache als terugval (offline). Verhoog V bij elke release. */
const V = 'hb-v19', F = ['./', 'index.html', 'style.css', 'app.js', 'calc.js', 'layout.js', 'widgets.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(F)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
