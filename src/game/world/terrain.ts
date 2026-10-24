import { FOREST, FOREST_ORIGIN, FOREST_RIVER } from "./forest";
import type { WorldDefinition } from "./types";

export type TerrainKind = "forest" | "rock" | "water" | "open";

/**
 * Terrain under a point, for Planetarni's Adaptacja. Only Verdantia carries terrain data: river rows are
 * water, stone corners are rock and everything else on the forest map counts as forest.
 */
export function terrainAt(world: WorldDefinition, p: { x: number; y: number }): TerrainKind {
  if (world.id !== "verdant") return "open";
  for (const r of FOREST_RIVER)
    if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return "water";
  const row = FOREST.vertices[Math.round((p.y - FOREST_ORIGIN.y) / FOREST.tileSize)] as
    readonly number[] | undefined;
  const corner = row?.[Math.round((p.x - FOREST_ORIGIN.x) / FOREST.tileSize)];
  return corner === 2 ? "rock" : "forest";
}
