import type { Point } from "../navigation";
import type { Obstacle } from "../movement";
import type { WorldNpc } from "../world/types";

export const BUILDING_IDS = ["shop", "hall", "inn", "smithy", "depot", "arena"] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];
export type CityBuilding = {
  id: BuildingId;
  name: string;
  district: string;
  description: string;
  objectId: string;
  door: Point;
};
export type CityDefinition = {
  name: string;
  /** Safe area inside a combat world; absent when the whole map is the city stage (Verdantia). */
  bounds?: { x: number; y: number; width: number; height: number };
  palette?: { wall: number; edge: number; accent: number; background: string };
  buildings: readonly CityBuilding[];
  roads: readonly Obstacle[];
};
export type Interior = {
  width: number;
  height: number;
  entry: Point;
  exit: Point;
  npc: Point;
  chest: Point;
  dummy: Point;
  obstacles: Obstacle[];
};
export function interiorNpcs(npcs: readonly WorldNpc[], building: BuildingId | null) {
  return npcs.filter((n) => (n.building ?? null) === building);
}

type CityWorld = { city?: CityDefinition; safeAreas?: readonly Obstacle[] };
/** The whole map is the city (no combat anywhere, tutorial runs on city quests). */
export const isCityStage = (world: CityWorld) => !!world.city && !world.city.bounds;
/** True where nothing fights: inside any building, on a city-stage map, or within the city bounds. */
export function inSafeCity(world: CityWorld, p: Point, interior: BuildingId | null) {
  if (
    world.safeAreas?.some(
      (b) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height,
    )
  )
    return true;
  const c = world.city;
  if (!c) return false;
  if (interior || !c.bounds) return true;
  const b = c.bounds;
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}
