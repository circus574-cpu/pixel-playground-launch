/** Shared, retryable preparation. No WebGL context or gameplay/session imports. */
import atlasLoV1 from "@/assets/planet-map/atlas-1920.webp";
import atlasHiV1 from "@/assets/planet-map/atlas-3840.webp";
import atlasLoV2 from "@/assets/planet-map/atlas-v2-1920.webp";
import atlasHiV2 from "@/assets/planet-map/atlas-v2-3840.webp";
import space from "@/assets/planet-map/space.jpg";
import { ATLAS_V2 } from "./mapData";

const images = new Map<string, Promise<HTMLImageElement>>();
/** Keep at most two decoded detailed land images, not all ten continents/islands. */
const terrain = new Map<string, Promise<HTMLImageElement>>();
export function decodedImage(url: string, detail = false): Promise<HTMLImageElement> {
  const cache = detail ? terrain : images;
  const existing = cache.get(url);
  if (existing) {
    cache.delete(url);
    cache.set(url, existing);
    return existing;
  }
  const promise = (async () => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  })();
  cache.set(url, promise);
  if (detail && cache.size > 2) cache.delete(cache.keys().next().value!);
  void promise.catch(() => {
    if (cache.get(url) === promise) cache.delete(url);
  });
  return promise;
}
let overlay: ReturnType<typeof importOverlay> | undefined;
const importOverlay = () => import("./worldOverlay.v2.json").then((m) => m.default);
export function loadWorldOverlay() {
  if (!overlay) {
    overlay = importOverlay().catch((error) => {
      overlay = undefined;
      throw error;
    });
  }
  return overlay;
}
let globe: Promise<typeof import("./PlanetGlobe")> | undefined;
export function loadPlanetGlobe() {
  return (globe ??= import("./PlanetGlobe").catch((error) => {
    globe = undefined;
    throw error;
  }));
}
/** Called during the real loading screen; failures remain retryable when opening the map. */
export async function prepareGameMap(land: string) {
  const work = Promise.allSettled([
    import("./MapaView"),
    decodedImage(ATLAS_V2 ? atlasLoV2 : atlasLoV1),
    decodedImage(ATLAS_V2 ? atlasHiV2 : atlasHiV1),
    decodedImage(space),
    ATLAS_V2 ? loadWorldOverlay() : Promise.resolve(),
    ATLAS_V2
      ? decodedImage(`/game/worlds/superior-v2/${land}/map-hi.webp`, true)
      : Promise.resolve(),
    loadPlanetGlobe().then((module) => module.preloadGlobeTextures()),
  ]);
  // Map preparation is optional. An offline/slow map must never prevent entering PvE.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 12_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
