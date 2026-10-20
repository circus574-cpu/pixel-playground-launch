import { tintPixels } from "../game/world/tintPixels";
import { describe, it, expect } from "vitest";
import { terrainBlits, TERRAIN_CHUNK_SIDE, terrainCacheBytes } from "../game/world/terrainBlits";
import { FOREST } from "../game/world/forest";
describe("static terrain cache keeps indexed layer geometry", () => {
  it("uses margin/spacing and the original layer order, including masked-out tiles", () => {
    const blits = [
      ...terrainBlits([[[0, 1]], [[-1, 17]]], 64, { x: 64, y: 0, width: 64, height: 64 }, 1904),
    ];
    expect(blits).toEqual([
      { layer: 0, tile: 1, sx: 70, sy: 2, dx: 0, dy: 0 },
      { layer: 1, tile: 17, sx: 1158, sy: 2, dx: 0, dy: 0 },
    ]);
  });
  it("covers every nonempty world tile exactly once across chunk boundaries", () => {
    const seen = new Set<string>();
    let count = 0;
    for (let y = 0; y < FOREST.height; y += TERRAIN_CHUNK_SIDE)
      for (let x = 0; x < FOREST.width; x += TERRAIN_CHUNK_SIDE)
        for (const b of terrainBlits(
          FOREST.layers,
          FOREST.tileSize,
          {
            x,
            y,
            width: Math.min(1024, FOREST.width - x),
            height: Math.min(1024, FOREST.height - y),
          },
          1904,
        )) {
          const key = [b.layer, x + b.dx, y + b.dy].join(":");
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          count++;
          expect(b.sx + 64).toBeLessThanOrEqual(1902);
          expect(b.sy + 64).toBeLessThanOrEqual(1902);
        }
    expect(count).toBe(FOREST.layers.flat(2).filter((t) => t >= 0).length);
    expect(terrainCacheBytes(FOREST.width, FOREST.height)).toBe(25165824);
  });
});

it("bakes multiply tint without premultiplying alpha a second time", () => {
  const rgba = new Uint8ClampedArray([255, 128, 64, 128, 20, 40, 60, 0]);
  tintPixels(rgba, 0x344b68);
  expect([...rgba]).toEqual([52, 38, 26, 128, 4, 12, 24, 0]);
});
