import mapData from "./forest-map.json" with { type: "json" };
import type { Obstacle } from "../movement";

export type ForestObject = {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  solid: boolean;
  footprint?: { width: number; height: number; offsetY?: number };
};
/** The painted valley in its own coordinates (0,0 .. 3072×2048); see `FOREST_ORIGIN`. */
export const FOREST = mapData;
/**
 * Where the valley lies on the continent (Verdantia is 49 000 × 31 400 units, like the painted
 * continent; docs/PLANET-GEOMETRY-2026-10-22.md). Multiples of the 128-unit ground pattern, so the
 * ground that continues beyond the valley lines up with it.
 */
export const FOREST_ORIGIN = { x: 32640, y: 21376 };
/** Verdantia's playable continent. */
export const VERDANT_SIZE = { width: 49000, height: 31400 };
const at = <T extends { x: number; y: number }>(p: T): T => ({
  ...p,
  x: p.x + FOREST_ORIGIN.x,
  y: p.y + FOREST_ORIGIN.y,
});
export const FOREST_SPAWN = at(FOREST.spawn);
export const FOREST_ENEMIES = FOREST.enemies.map(at);
export const FOREST_BRIDGE = at(FOREST.bridge);
export const FOREST_RIVER = FOREST.riverRows.map(at);
export const FOREST_OBJECTS: readonly ForestObject[] = FOREST.objects.map(at);
export const FOREST_MINIMAP = "/game/assets/anime-forest-v1/minimap.webp";
export function forestObstacles(): Obstacle[] {
  const obstacles: Obstacle[] = FOREST_RIVER.map((row) => ({ ...row }));
  for (const obj of FOREST_OBJECTS) {
    if (!obj.solid || !obj.footprint) continue;
    const { width, height } = obj.footprint;
    obstacles.push({
      x: obj.x - width / 2,
      y: obj.y + (obj.footprint.offsetY ?? 0) - height / 2,
      width,
      height,
    });
  }
  return obstacles;
}
/** Corner bits: NW=1, NE=2, SE=4, SW=8. Soil also underlays stone edges. */
export function terrainMask(corners: readonly number[], material: 1 | 2 | 3): number {
  return corners.reduce(
    (mask, value, index) =>
      mask | ((material === 1 ? value === 1 || value === 2 : value === material) ? 1 << index : 0),
    0,
  );
}
export function tileIndex(material: 1 | 2 | 3, mask: number, phase = 0): number {
  return mask === 0 ? -1 : 16 + (material - 1) * 256 + phase * 16 + mask;
}
