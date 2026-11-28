import { inflateSync } from "node:zlib";
import type { AndroidLand } from "./economy";
import generated from "./worldData.generated.json";
import stage4Generated from "./stage4Data.generated.json";

export type WorldPoint = { x: number; z: number };

type AndroidTarget =
  | ({ kind: "monster"; actorId?: string; level: number; elite: boolean } & WorldPoint)
  | ({ kind: "animal" } & WorldPoint)
  | ({ kind: "boss"; bossId: string; level: number } & WorldPoint)
  | { kind: "guardian"; room: string; level: number };

type AndroidRegion = {
  size: number;
  gridSize: number;
  walkable: string;
  targets: Record<string, AndroidTarget>;
  rooms: Record<string, { minLevel: number; grid: string[] }>;
  legacyKills: Record<string, number>;
  treasures: Record<
    string,
    WorldPoint & { minLevel: number; gold: number; xp: number; itemId?: string; room?: string }
  >;
  gatherables: Record<string, WorldPoint & { kind: string; itemId?: string }>;
  inns: Record<string, WorldPoint>;
};

export type AndroidBossMeta = {
  id: string;
  name: string;
  continent: AndroidLand;
  level: number;
  xp: number;
  x: number;
  z: number;
  lootTable: { itemId: string; chancePercent: number; minCount: number; maxCount: number }[];
};

export type AndroidWorldEventMeta = {
  id: string;
  name: string;
  continent: AndroidLand;
  minLevel: number;
  repeatability: string;
  xp: number;
  coins: number;
  itemId?: string;
};

export type AndroidPlayableQuestMeta = {
  id: string;
  title: string;
  continent: string;
  category: string;
  minLevel: number;
  prereqs: string[];
  repeatable: boolean;
  stageCount: number;
  frontierStages?: Array<
    Array<{ id: string; count: number; treasureId?: string; spawnId?: string }>
  >;
  xp: number;
  coins: number;
  itemId?: string;
  itemCount?: number;
  factionId?: string;
  factionAmount?: number;
};

export type AndroidIslandMeta = {
  id: AndroidLand;
  name: string;
  recommendedLevel: number;
  voyageCost: number;
};

type Stage4Data = {
  bosses: Record<string, AndroidBossMeta>;
  events: Record<string, AndroidWorldEventMeta>;
  quests: Record<string, AndroidPlayableQuestMeta>;
  speciesDrops: Record<string, { itemId: string; chance: number }[]>;
  islands: Record<string, AndroidIslandMeta>;
};

const regions = generated as Record<AndroidLand, AndroidRegion>;
const stage4 = stage4Generated as Stage4Data;
const masks = new Map<AndroidLand, Buffer>();

export const ANDROID_POSITION_LAYOUT = "superior-isometric-v1";
export const ANDROID_PICKUP_RADIUS = 16;

export function androidTarget(land: AndroidLand, id: string): AndroidTarget | undefined {
  const targets = regions[land]?.targets;
  return targets && Object.hasOwn(targets, id) ? targets[id] : undefined;
}

export function androidRoom(land: AndroidLand, room: string) {
  const rooms = regions[land]?.rooms;
  return rooms && Object.hasOwn(rooms, room) ? rooms[room] : undefined;
}

export function androidLegacyKillLevel(
  land: AndroidLand,
  actorId: string,
  level: number,
  elite: boolean,
) {
  return regions[land]?.legacyKills[`${actorId}:${level}:${elite ? 1 : 0}`];
}

export function androidTreasure(land: AndroidLand, id: string) {
  const treasures = regions[land]?.treasures;
  return treasures && Object.hasOwn(treasures, id) ? treasures[id] : undefined;
}

export function androidGatherable(land: AndroidLand, id: string) {
  const nodes = regions[land]?.gatherables;
  return nodes && Object.hasOwn(nodes, id) ? nodes[id] : undefined;
}

export function androidInn(land: AndroidLand, id: string) {
  const inns = regions[land]?.inns;
  return inns && Object.hasOwn(inns, id) ? inns[id] : undefined;
}

export function androidBoss(bossId: string): AndroidBossMeta | undefined {
  return Object.hasOwn(stage4.bosses, bossId) ? stage4.bosses[bossId] : undefined;
}

export function androidWorldEvent(eventId: string): AndroidWorldEventMeta | undefined {
  return Object.hasOwn(stage4.events, eventId) ? stage4.events[eventId] : undefined;
}

export function androidPlayableQuest(questId: string): AndroidPlayableQuestMeta | undefined {
  return Object.hasOwn(stage4.quests, questId) ? stage4.quests[questId] : undefined;
}

export function androidSpeciesDrops(actorId: string): { itemId: string; chance: number }[] {
  return Object.hasOwn(stage4.speciesDrops, actorId) ? (stage4.speciesDrops[actorId] ?? []) : [];
}

export function androidIsland(land: string): AndroidIslandMeta | undefined {
  return Object.hasOwn(stage4.islands, land) ? stage4.islands[land] : undefined;
}

export function walkableAndroidPoint(
  land: AndroidLand,
  { x, z }: WorldPoint,
  room?: string,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (room) {
    const maze = androidRoom(land, room);
    if (!maze) return false;
    // Same 74 px cells and 18 px collision radius as labyrinth_room.gd.
    for (const dx of [-18, 18]) {
      for (const dz of [-18, 18]) {
        const cell = maze.grid[Math.floor((z + dz) / 74)]?.[Math.floor((x + dx) / 74)];
        if (!cell || cell === "#") return false;
      }
    }
    return true;
  }

  const reg = regions[land];
  if (!reg) return false;
  const { size, gridSize, walkable } = reg;
  if (x < 12 || z < 12 || x > size - 12 || z > size - 12) return false;
  let mask = masks.get(land);
  if (!mask) {
    mask = inflateSync(Buffer.from(walkable, "base64"));
    masks.set(land, mask);
  }
  const gx = Math.round((x / size) * (gridSize - 1));
  const gz = Math.round((z / size) * (gridSize - 1));
  const index = gz * gridSize + gx;
  return Boolean((mask[Math.floor(index / 8)] ?? 0) & (1 << (index % 8)));
}
