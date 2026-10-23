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
