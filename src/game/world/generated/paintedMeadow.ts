import { catalog } from "../../assets/catalog";
import type { ArtObject, FeatureArt } from "./renderSuperior";

/** A render-only review switch. No world data, collider or saved position is changed. */
export const paintedMeadowEnabled = (feature: string) =>
  (feature === "verdant" || feature === "aether") &&
  catalog.renderBindings["terrain.ki-v2-" + feature + "-grass-0"]?.asset ===
    feature + "-painted-grass";

/** Painted city buildings: display width and height/width ratio per cut-out. */
const PAINTED_BUILDINGS: Record<string, { width: number; ratio: number }> = {
  "verdant-painted-shop": { width: 560, ratio: 520 / 560 },
  "aether-painted-b-hall": { width: 640, ratio: 0.731 },
  "aether-painted-b-market": { width: 560, ratio: 0.74 },
  "aether-painted-b-inn": { width: 640, ratio: 0.777 },
  "aether-painted-b-smithy": { width: 580, ratio: 0.758 },
  "aether-painted-b-depot": { width: 600, ratio: 0.783 },
  "aether-painted-b-arena": { width: 700, ratio: 0.716 },
};

export function meadowBuildings(items: readonly ArtObject[]): ArtObject[] {
  return items.map((item) => {
    const ref = catalog.renderBindings[item.binding];
    const size = ref && PAINTED_BUILDINGS[ref.asset];
    if (!size || !ref.origin || !item.door) return item;
    return {
      ...item,
      x: item.door.x,
      y: item.door.y,
      width: size.width,
      height: Math.round(size.width * size.ratio),
      anchorX: ref.origin[0],
      anchorY: ref.origin[1],
    };
  });
}

function noise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, cell: number) {
  const gx = x / cell,
    gy = y / cell,
    ix = Math.floor(gx),
    iy = Math.floor(gy);
  const f = (t: number) => t * t * (3 - 2 * t);
  const fx = f(gx - ix),
    fy = f(gy - iy);
  const top = noise(ix, iy) * (1 - fx) + noise(ix + 1, iy) * fx;
  const bottom = noise(ix, iy + 1) * (1 - fx) + noise(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Turns a blurred biome mask into an organic, ragged-edged patch. The noise is anchored to world
 * coordinates, so neighbouring chunks agree and the border never shows a seam.
 */
export function organicMask(soft: HTMLCanvasElement, x: number, y: number, chunk: number) {
  const n = 256;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(soft, 0, 0, soft.width, soft.height, 0, 0, n, n);
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < n * n; i++) {
    const wx = x + ((i % n) + 0.5) * (chunk / n),
      wy = y + (Math.floor(i / n) + 0.5) * (chunk / n);
    const v = 0.6 * smoothNoise(wx, wy, 240) + 0.4 * smoothNoise(wx + 977, wy + 531, 80);
    const a = img.data[i * 4 + 3]! / 255;
    const t = (a - 0.5) * 3.2 + (v - 0.5) * 2.2 + 0.5;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, t)) * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Low-frequency light stays anchored to the world when chunks stream in and out. */
export function meadowLight(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  for (let gy = Math.floor(y / 380) - 1; gy <= Math.floor((y + 2048) / 380) + 1; gy++)
    for (let gx = Math.floor(x / 380) - 1; gx <= Math.floor((x + 2048) / 380) + 1; gx++) {
      const n = noise(gx, gy);
      const cx = (gx * 380 + n * 190 - x) * scale;
      const cy = (gy * 380 + noise(gy, gx) * 190 - y) * scale;
      const r = (180 + n * 190) * scale;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, n > 0.46 ? "rgba(255,238,136,0.32)" : "rgba(14,47,24,0.26)");
      gradient.addColorStop(1, "rgba(40,80,35,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  ctx.restore();
}

/** One union mask for every road: intersections have no double borders or rectangular plates. */
export function paintedPaths(
  ctx: CanvasRenderingContext2D,
  silhouette: HTMLCanvasElement,
  fill: CanvasPattern,
  x: number,
  y: number,
  scale: number,
) {
  const size = silhouette.width - 48;
  const mask = document.createElement("canvas");
  mask.width = mask.height = size;
  const m = mask.getContext("2d")!;
  m.filter = `blur(${12 * scale}px)`;
  m.drawImage(silhouette, -24, -24);
  m.filter = "none";
  const pixels = m.getImageData(0, 0, size, size);
  // Only the soft rim is perturbed. Its hash uses world coordinates, so there is no chunk seam.
  for (let i = 3; i < pixels.data.length; i += 4) {
    const alpha = pixels.data[i]!;
    if (!alpha || alpha === 255) continue;
    const p = (i - 3) / 4;
    const wx = Math.floor((x + (p % size) / scale) / 7);
    const wy = Math.floor((y + Math.floor(p / size) / scale) / 7);
    const coverage = (alpha / 255 - 0.14 + (noise(wx, wy) - 0.5) * 0.38) / 0.72;
    pixels.data[i] = Math.round(Math.max(0, Math.min(1, coverage)) * 255);
  }
  m.putImageData(pixels, 0, 0);
  const road = document.createElement("canvas");
  road.width = road.height = size;
  const r = road.getContext("2d")!;
  r.fillStyle = fill;
  r.fillRect(0, 0, size, size);
  r.globalCompositeOperation = "destination-in";
  r.drawImage(mask, 0, 0);
  ctx.drawImage(road, 0, 0);
}

/** Existing transparent props, streamed and Y-sorted by the usual renderer, never colliders. */
export function meadowScenery(
  art: FeatureArt,
  roads: readonly { x: number; y: number; width: number; height: number }[],
): ArtObject[] {
  const shop = art.acceptedCityBuildings.find((b) => b.id === "accepted-city-shop");
  if (!shop) return [];
  const items: ArtObject[] = [];
  const add = (kind: string, dx: number, dy: number, width: number, height: number) => {
    const x = shop.x + dx,
      y = shop.y + dy;
    if (
      roads.some(
        (r) =>
          x >= r.x - 30 && x <= r.x + r.width + 30 && y >= r.y - 25 && y <= r.y + r.height + 25,
      )
    )
      return;
    items.push({
      id: "painted-meadow-" + items.length,
      asset: "ki-v2-objects." + kind,
      binding: "object.ki-v2-objects." + kind,
      kind: kind.includes("tree") ? "tree" : "bush",
      x,
      y,
      width,
      height,
      anchorX: 0.5,
      anchorY: 0.9,
      solid: false,
      layer: "objects",
    });
  };
  add("verdant-tree2-0", 710, -70, 390, 475);
  add("verdant-tree2-2", 1030, 620, 400, 490);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 5; col++) {
      const n = noise(col + 31, row + 97);
      const dx = 200 + col * 175 + (n - 0.5) * 90;
      const dy = 285 + row * 175 + (noise(row, col) - 0.5) * 70;
      add("verdant-bush-0", dx, dy, 100 + n * 55, 95 + n * 40);
      if (n > 0.35) add("verdant-flowerbush-0", dx + 65, dy + 38, 70, 62);
      if (n < 0.7) add("verdant-fern-0", dx - 65, dy + 50, 76, 70);
    }
  return items;
}
