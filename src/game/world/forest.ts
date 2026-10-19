import mapData from "./forest-map.json";
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
  footprint?: { width: number; height: number };
};
export const FOREST = mapData;
export const WORLD_WIDTH = FOREST.width;
export const WORLD_HEIGHT = FOREST.height;
export const FOREST_OBJECTS: readonly ForestObject[] = FOREST.objects;
export const FOREST_MINIMAP = "/game/assets/forest-v3/minimap.webp";
export function forestObstacles(): Obstacle[] {
  const obstacles: Obstacle[] = FOREST.riverRows.map((row) => ({ ...row }));
  for (const obj of FOREST_OBJECTS) {
    if (!obj.solid || !obj.footprint) continue;
    const { width, height } = obj.footprint;
    obstacles.push({ x: obj.x - width / 2, y: obj.y - height / 2, width, height });
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
export function tileIndex(material: 1 | 2 | 3, mask: number): number {
  return mask === 0 ? -1 : 1 + (material - 1) * 16 + mask;
}
