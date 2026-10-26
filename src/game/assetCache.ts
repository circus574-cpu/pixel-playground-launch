/** Registers the game's asset cache (public/ki-assets-sw.js); failures only cost the speed-up. */
export function registerAssetCache() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
  navigator.serviceWorker.register("/ki-assets-sw.js").catch(() => undefined);
}
