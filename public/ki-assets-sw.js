/*
 * Ki Legends asset cache. The host sends game art without cache headers, so every visit downloaded
 * ~20 MB again. Versioned packs (/gpu/<pack>/<version>-<hash>/) never change: cache-first.
 * Other files under /game/ may be replaced in place: served from cache, refreshed in the background.
 * Range requests (music streaming) and everything outside /game/ go straight to the network.
 */
const CACHE = "ki-assets-v1";
const IMMUTABLE = /\/game\/assets\/gpu\/[^/]+\/[^/]+-[0-9a-f]{12}\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/game/")) return;
  if (url.pathname.startsWith("/game/music/")) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      const refresh = () =>
        fetch(request).then((response) => {
          if (response.status === 200) void cache.put(request, response.clone());
          return response;
        });
      if (!hit) return refresh();
      if (!IMMUTABLE.test(url.pathname)) event.waitUntil(refresh().catch(() => undefined));
      return hit;
    }),
  );
});
