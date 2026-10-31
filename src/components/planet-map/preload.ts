/** Shared, retryable preparation. No WebGL context or gameplay/session imports. */
import atlasLoV1 from "@/assets/planet-map/atlas-1920.webp";
import atlasHiV1 from "@/assets/planet-map/atlas-3840.webp";
import atlasLoV2 from "@/assets/planet-map/atlas-v2-1920.webp";
import atlasHiV2 from "@/assets/planet-map/atlas-v2-3840.webp";
import space from "@/assets/planet-map/space.jpg";
import { ATLAS_V2 } from "./mapData";

const images = new Map<string, Promise<HTMLImageElement>>();
const resolvedImages = new Map<string, HTMLImageElement>();
/** Keep at most two decoded detailed land images, not all ten continents/islands. */
const terrain = new Map<string, Promise<HTMLImageElement>>();
const resolvedTerrain = new Map<string, HTMLImageElement>();

export function getCachedImage(url: string, detail = false): HTMLImageElement | undefined {
  const cache = detail ? terrain : images;
  const resolved = detail ? resolvedTerrain : resolvedImages;
  const img = resolved.get(url);
  if (img) {
    const existing = cache.get(url);
    if (existing) {
      cache.delete(url);
      cache.set(url, existing);
    }
    resolved.delete(url);
    resolved.set(url, img);
  }
  return img;
}

export function decodedImage(url: string, detail = false): Promise<HTMLImageElement> {
  const cache = detail ? terrain : images;
  const resolved = detail ? resolvedTerrain : resolvedImages;
  const existing = cache.get(url);
  if (existing) {
    cache.delete(url);
    cache.set(url, existing);
    const img = resolved.get(url);
    if (img) {
      resolved.delete(url);
      resolved.set(url, img);
    }
    return existing;
  }
  const promise: Promise<HTMLImageElement> = (async () => {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (cache.get(url) === promise) resolved.set(url, image);
    return image;
  })();
  cache.set(url, promise);
  if (detail && cache.size > 2) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
    resolved.delete(oldest);
  }
  void promise.catch(() => {
    if (cache.get(url) === promise) {
      cache.delete(url);
      resolved.delete(url);
    }
  });
  return promise;
}
decodedImage.cached = getCachedImage;

type OverlayData = Awaited<ReturnType<typeof importOverlay>>;
let overlay: Promise<OverlayData> | undefined;
let resolvedOverlay: OverlayData | null = null;
const importOverlay = () => import("./worldOverlay.v2.json").then((m) => m.default);
export function getCachedWorldOverlay(): OverlayData | null {
  return resolvedOverlay;
}
export function loadWorldOverlay() {
  if (!overlay) {
    overlay = importOverlay()
      .then((data) => {
        resolvedOverlay = data;
        return data;
      })
      .catch((error) => {
        overlay = undefined;
        resolvedOverlay = null;
        throw error;
      });
  }
  return overlay;
}
loadWorldOverlay.cached = getCachedWorldOverlay;

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
