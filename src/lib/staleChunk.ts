/**
 * After a deployment the hashed chunks of the previous build are gone. A tab opened before the
 * deployment then fails to lazy-load a panel (the world map, for example) with one of these errors.
 * The cure is a fresh page load, so the app reloads once instead of showing a dead error screen.
 */
const STALE_CHUNK_PATTERN =
  /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|error loading dynamically/i;
const RELOAD_KEY = "ki-stale-chunk-reload";
const RELOAD_WINDOW_MS = 60_000;

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return STALE_CHUNK_PATTERN.test(message);
}

/** Reloads at most once per minute so a genuinely broken deployment cannot loop. Returns true if reloading. */
export function reloadForFreshBuild(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function installStaleChunkReload(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    reloadForFreshBuild();
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
