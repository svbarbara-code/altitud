// Altitud offline cache. The page (index.html) is network-first so updates show up at once when there's signal;
// the page fetch revalidates with the server (GitHub sends max-age=600), so an update shows on the next open;
// everything else from this site (tabs/*.js?v=..., icons) and Google Fonts is cache-first. Other sites (weather API) pass through.
const CACHE = 'altitud-v2';   // v2: new icons
const CORE = ['./', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png', 'favicon-32.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data && e.data.precache) e.waitUntil(precache(e.data.precache)); });
async function put(req, res) {
  if (!res || !(res.ok || res.type === 'opaque')) return;
  const c = await caches.open(CACHE), u = new URL(req.url || req, self.location);
  if (u.origin === self.location.origin && u.search) {   // drop older versions of the same file
    for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) await c.delete(k); }
  }
  await c.put(req, res);
}
async function precache(urls) { for (const u of urls) { try { if (!(await caches.match(u))) await put(u, await fetch(u)); } catch (e) {} } }
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== self.location.origin && !fonts) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}).then(r => { const copy = r.clone(); put('./', copy); return r; })
      .catch(() => caches.match('./', {ignoreSearch: true}).then(r => r || caches.match(req))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { put(req, r.clone()); return r; })));
});
