import type Phaser from "phaser";
import { renderDepth } from "../assets/layers";

/**
 * Large-scale light and shade over the ground. A small repeating texture covers a continent, so the pattern
 * shows as a grid; this soft, world-aligned layer of darker and lighter patches (period 3072 units) breaks
 * the repetition and takes some contrast out of the ground so that characters stay the focus. Presentation
 * only: no collision, navigation or save data involved.
 */
const KEY = (worldId: string) => "macro-variation-" + worldId;
const TEXTURE = 512;
const PERIOD = 3072; // world units per texture repeat
const CHUNK = 1024;

function ensureTexture(scene: Phaser.Scene, worldId: string) {
  const key = KEY(worldId);
  if (scene.textures.exists(key)) return;
  const haze = HAZE[worldId] ?? HAZE["verdant"]!;
  const tex = scene.textures.createCanvas(key, TEXTURE, TEXTURE);
  if (!tex) return;
  const ctx = tex.getContext();
  const img = ctx.createImageData(TEXTURE, TEXTURE);
  // Seeded, tileable value noise: three octaves on wrapping grids.
  let seed = 90210;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const grids = [4, 8, 16].map((n) => ({
    n,
    v: Array.from({ length: n * n }, () => rnd() * 2 - 1),
  }));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sample = (g: { n: number; v: number[] }, x: number, y: number) => {
    const fx = (x / TEXTURE) * g.n,
      fy = (y / TEXTURE) * g.n;
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy);
    const tx = smooth(fx - x0),
      ty = smooth(fy - y0);
    const at = (i: number, j: number) =>
      g.v[(((j % g.n) + g.n) % g.n) * g.n + (((i % g.n) + g.n) % g.n)]!;
    const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  for (let y = 0; y < TEXTURE; y++)
    for (let x = 0; x < TEXTURE; x++) {
      const n =
        sample(grids[0]!, x, y) * 0.55 +
        sample(grids[1]!, x, y) * 0.3 +
        sample(grids[2]!, x, y) * 0.15;
      const i = (y * TEXTURE + x) * 4;
      if (n < 0) {
        // shade: cool dark tint
        img.data[i] = 14;
        img.data[i + 1] = 24;
        img.data[i + 2] = 36;
        img.data[i + 3] = Math.min(255, -n * 255 * 0.55);
      } else {
        // haze: warm light tint that also lifts the darkest ground
        img.data[i] = haze.r;
        img.data[i + 1] = haze.g;
        img.data[i + 2] = haze.b;
        img.data[i + 3] = Math.min(255, (n * 255 * 0.2 + 46) * haze.strength);
      }
    }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

export type Haze = { r: number; g: number; b: number; strength: number };
/** Per-continent haze tint: how much light is lifted over the ground (less contrast, characters stand out). */
export const HAZE: Record<string, Haze> = {
  verdant: { r: 232, g: 240, b: 214, strength: 1 },
  aether: { r: 238, g: 234, b: 214, strength: 1.5 },
  nexus: { r: 150, g: 180, b: 206, strength: 1.4 },
  pyra: { r: 236, g: 206, b: 180, strength: 1.4 },
};

export function macroVariation(
  scene: Phaser.Scene,
  size: { width: number; height: number },
  worldId = "verdant",
) {
  ensureTexture(scene, worldId);
  const chunks = new Map<string, Phaser.GameObjects.TileSprite>();
  const scale = PERIOD / TEXTURE;
  const update = () => {
    const view = scene.cameras.main.worldView;
    const first = (v: number) => Math.max(0, Math.floor((v - 64) / CHUNK) * CHUNK);
    for (let y = first(view.top); y < Math.min(size.height, view.bottom + 64); y += CHUNK)
      for (let x = first(view.left); x < Math.min(size.width, view.right + 64); x += CHUNK) {
        const key = x + ":" + y;
        if (chunks.has(key)) continue;
        const tile = scene.add
          .tileSprite(
            x,
            y,
            Math.min(CHUNK, size.width - x),
            Math.min(CHUNK, size.height - y),
            KEY(worldId),
          )
          .setOrigin(0)
          .setDepth(renderDepth("paths") + 3)
          .setTileScale(scale, scale);
        tile.setTilePosition(x / scale, y / scale);
        chunks.set(key, tile);
      }
    for (const [key, tile] of chunks) {
      const [x, y] = key.split(":").map(Number) as [number, number];
      if (
        x > view.right + 640 ||
        x + CHUNK < view.left - 640 ||
        y > view.bottom + 640 ||
        y + CHUNK < view.top - 640
      ) {
        tile.destroy();
        chunks.delete(key);
      }
    }
  };
  update();
  return {
    update,
    dispose() {
      for (const tile of chunks.values()) tile.destroy();
      chunks.clear();
    },
  };
}
