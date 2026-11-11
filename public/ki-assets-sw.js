/*
 * Ki Legends asset cache. The host sends game art without cache headers, so every visit downloaded
 * ~20 MB again. Versioned packs (/gpu/<pack>/<version>-<hash>/) never change: cache-first.
 * Other files under /game/ may be replaced in place: served from cache, refreshed in the background.
 * Range requests (music streaming) and everything outside /game/ go straight to the network.
 *
 * Faza 3 (11.11.2026): cache ma limit wpisów z przycinaniem najstarszych. Bez tego dziesięć lądów
 * po ~50 MB rosło w nieskończoność i na telefonie potrafiło przepełnić storage, co zamiast
 * przyspieszać — wyrzucało cache i spowalniało. Wersja podbita, żeby stary, nieograniczony cache
 * został wyczyszczony przy aktywacji.
 */
const CACHE = "ki-assets-v2";
const IMMUTABLE = /\/game\/assets\/gpu\/[^/]+\/[^/]+-[0-9a-f]{12}\//;
const MAX_ENTRIES = 800;
const TRIM_EVERY = 40;
let putsSinceTrim = 0;

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // keys() zwraca w kolejności wstawiania — usuwamy najstarsze, aż wrócimy poniżej limitu.
  const excess = keys.length - MAX_ENTRIES;
  await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

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
          if (response.status === 200) {
            void cache.put(request, response.clone()).then(() => {
              if (++putsSinceTrim >= TRIM_EVERY) {
                putsSinceTrim = 0;
                void trim(cache).catch(() => undefined);
              }
            });
          }
          return response;
        });
      if (!hit) return refresh();
      if (!IMMUTABLE.test(url.pathname)) event.waitUntil(refresh().catch(() => undefined));
      return hit;
    }),
  );
});
