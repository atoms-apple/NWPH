/**
 * Service worker.
 *
 * On this network the app has to open with no signal — standing on gravel at
 * Pangnirtung with a boarding pass to show. So the whole application is
 * precached on first visit: shell, styles, every module, the icons. There is
 * nothing to fetch afterwards, because there is no server behind it.
 *
 * Strategy: cache-first for anything precached, network-first for navigations
 * with the shell as fallback. The precache list and the version are written in
 * by build-app.mjs — a content hash, so a deploy invalidates the old cache and
 * an unchanged deploy does not.
 */

const VERSION = '__BUILD_VERSION__';
const CACHE = `northwinds-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fails the whole install if one entry 404s; add individually so a
    // single missing asset degrades rather than leaving no cache at all.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('northwinds-') && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation always resolves to the shell: the app routes on the hash, so
  // every screen is the same document.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch {
      return hit ?? Response.error();
    }
  })());
});
