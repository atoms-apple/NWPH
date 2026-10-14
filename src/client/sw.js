/*
 * Polar Express — offline support.
 *
 * Nunavut connections drop. The point of this worker is that someone standing
 * in a porch with no signal can still open the app and see the last stock they
 * loaded, clearly labelled as old, rather than a browser error page.
 *
 * Strategy by resource:
 *   inventory feed  network first, fall back to cache  (freshness matters most)
 *   pages + assets  cache first, refresh in background  (speed on a slow link)
 */

var VERSION = 'pe-v1';
var SHELL = VERSION + '-shell';
var FEED = VERSION + '-feed';

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (key) { return key.indexOf(VERSION) !== 0; })
          .map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); }),
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The stock feed: always try the network, keep the last good copy.
  if (url.pathname.indexOf('/shop/inventory.json') !== -1) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(FEED).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () { return caches.match(request); }),
    );
    return;
  }

  // Everything else the app needs: serve from cache, refresh behind it.
  if (url.pathname.indexOf('/shop') !== -1 || url.pathname.indexOf('/assets/') !== -1) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        var network = fetch(request)
          .then(function (response) {
            if (response && response.status === 200) {
              var copy = response.clone();
              caches.open(SHELL).then(function (cache) { cache.put(request, copy); });
            }
            return response;
          })
          .catch(function () { return cached; });
        return cached || network;
      }),
    );
  }
});
