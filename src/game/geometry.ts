/** Gameplay geometry in world units; importing artwork cannot override it. */
export const FOOT_RADIUS = 12;
export const WORLD_EDGE_MARGIN = 16;
export const INTERACTION_BOUNDS = {
  npc: { width: 84, height: 125, belowFoot: 20 },
  enemy: { width: 100, height: 125, belowFoot: 20 },
  loot: { width: 74, height: 60, belowFoot: 20 },
} as const;
