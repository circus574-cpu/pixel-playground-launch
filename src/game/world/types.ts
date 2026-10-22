import type { Point } from "../navigation";
import type { Obstacle } from "../movement";
import type { WorldId, RaceId } from "./races";
import type { ForestObject } from "./forest";
export type NpcRole = "guide" | "hunter" | "merchant" | "smith";
export type WorldNpc = Point & {
  id: NpcRole;
  name: string;
  role: string;
  tint: number;
  dialogue?: string;
};
export type Landmark = Point & { label: string; kind: "settlement" | "energy" | "danger" };
export type RegionObject = ForestObject & { asset?: string };
export type WorldDefinition = {
  id: WorldId;
  race: RaceId;
  name: string;
  settlement: string;
  description: string;
  architecture: string;
  width: number;
  height: number;
  spawn: Point;
  background: string;
  minimap: string;
  market: Point & { radius: number; label: string; instruction: string; action: string };
  npcs: WorldNpc[];
  enemies: Point[];
  /** Monster spawns from the bestiary; empty until the continents are complete. */
  monsters?: { kind: string; x: number; y: number }[];
  enemyName: string;
  huntName: string;
  landmarks: Landmark[];
  objects: readonly RegionObject[];
  obstacles: readonly Obstacle[];
  terrain?: {
    ground: string;
    path: string;
    plaza: string;
    paths: Obstacle[];
    plazas: Obstacle[];
    /** Curved roads (centre polyline + width) and organic courts; presentation only. */
    roads?: Road[];
    courts?: Court[];
  };
};
export type Road = { width: number; points: [number, number][] };
export type Court = { points: [number, number][] };
