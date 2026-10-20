import type { CharacterVisual } from "./characterVisual";
import type { WorldDefinition } from "./types";
/** Rendering identity is separate from race and gameplay. Replace this adapter for 8 directions. */
export const CHARACTER_VISUALS: Record<"human-v2", CharacterVisual> = {
  "human-v2": {
    kind: "sheet",
    key: "hero-sheet",
    url: "/game/assets/hero-walk-v2.webp",
    columns: 4,
    directions: ["down", "left", "right", "up"],
    frames: 4,
    frameRate: 8,
    width: 96,
    height: 96,
    originX: 0.5,
    originY: 0.95,
  },
} as const;
export const SHARED_ASSETS = {
  creatures: { key: "world-atlas", url: "/game/assets/world-v1.webp" },
  ui: {
    key: "ui-icons",
    url: "/game/assets/anime-forest-v1/ui.webp",
    frameWidth: 256,
    frameHeight: 256,
  },
  forestTerrain: { key: "forest-terrain", url: "/game/assets/anime-forest-v1/terrain.png" },
  forestObjects: {
    key: "forest-objects",
    url: "/game/assets/anime-forest-v1/objects.webp",
    atlas: "/game/assets/anime-forest-v1/objects.json",
  },
};
export function regionAssets(world: WorldDefinition) {
  const keys = new Set(world.objects.map((o) => o.asset).filter((k): k is string => !!k));
  if (world.terrain)
    for (const k of [world.terrain.ground, world.terrain.path, world.terrain.plaza]) keys.add(k);
  return [...keys].map((key) => ({ key, url: `/game/assets/stage3/${key}.svg` }));
}
