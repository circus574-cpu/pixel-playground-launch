import { catalog } from "../../assets/catalog";
import type { ArtObject, FeatureArt } from "./renderSuperior";

export const islandArtEnabled = (feature: string) =>
  /^island-[1-6]$/.test(feature) && !!catalog.renderBindings[`terrain.${feature}.biome-0`];

export function islandObjects(feature: string, objects: ArtObject[]): ArtObject[] {
  if (!islandArtEnabled(feature)) return objects;
  return objects.map((item) => {
    const b = item.binding;
    const kind = /ancient-stone-gate-ruin/.test(b)
      ? "arch"
      : /-(oak|tree2|pine)-|tall-broadleaf/.test(b)
        ? "tree"
        : !["island-1", "island-3", "island-6"].includes(feature) &&
            /bush|fern|reeds|mushrooms/.test(b)
          ? "flora"
          : /boulder|rock|obsidian|ice-spire|ice-crystal/.test(b)
            ? "rock"
            : undefined;
    return kind ? { ...item, binding: `object.${feature}.${kind}` } : item;
  });
}
export function islandFeatureArt(feature: string, art: FeatureArt): FeatureArt {
  if (!islandArtEnabled(feature)) return art;
  return {
    ...art,
    groundByBiome: art.groundByBiome.map((_, i) => `terrain.${feature}.biome-${i}`),
    water: feature === "island-6" ? art.water : `terrain.${feature}.water`,
    road: `terrain.${feature}.road`,
    plaza: `terrain.${feature}.plaza`,
    acceptedCityScenery: islandObjects(feature, art.acceptedCityScenery ?? []),
    dungeonEntrances: islandObjects(feature, art.dungeonEntrances),
  };
}
/** Temporary renderer canvases. Isolate frames before resampling, then soft toroidal patches. */
export function islandMaterial(
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;
  frame.getContext("2d")!.drawImage(image, x, y, width, height, 0, 0, width, height);
  image = frame;
  x = y = 0;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, x + width / 2, y + height / 2, 1, 1, 0, 0, 512, 512);
  const patch = document.createElement("canvas");
  patch.width = patch.height = 256;
  const pen = patch.getContext("2d")!;
  const fade = pen.createLinearGradient(0, 0, 256, 0);
  fade.addColorStop(0, "transparent");
  fade.addColorStop(0.2, "white");
  fade.addColorStop(0.8, "white");
  fade.addColorStop(1, "transparent");
  const vertical = pen.createLinearGradient(0, 0, 0, 256);
  vertical.addColorStop(0, "transparent");
  vertical.addColorStop(0.2, "white");
  vertical.addColorStop(0.8, "white");
  vertical.addColorStop(1, "transparent");
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const seed = (((row + 1) * 73856093) ^ ((col + 1) * 19349663)) >>> 0;
      pen.globalCompositeOperation = "source-over";
      pen.clearRect(0, 0, 256, 256);
      pen.drawImage(
        image,
        x + ((seed % 257) / 512) * width,
        y + (((seed >>> 9) % 257) / 512) * height,
        width / 2,
        height / 2,
        0,
        0,
        256,
        256,
      );
      pen.globalCompositeOperation = "destination-in";
      pen.fillStyle = fade;
      pen.fillRect(0, 0, 256, 256);
      pen.fillStyle = vertical;
      pen.fillRect(0, 0, 256, 256);
      for (const dx of [col * 128, col * 128 - 512])
        for (const dy of [row * 128, row * 128 - 512]) ctx.drawImage(patch, dx, dy);
    }
  return canvas;
}
