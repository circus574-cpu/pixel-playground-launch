import { inflateSync } from "node:zlib";
import type { AndroidLand } from "./economy";
import generated from "./worldData.generated.json";

export type WorldPoint = { x: number; z: number };

type AndroidTarget =
  | ({ kind: "monster"; level: number; elite: boolean } & WorldPoint)
  | ({ kind: "animal" } & WorldPoint)
  | { kind: "guardian"; room: string; level: number };

type AndroidRegion = {
  size: number;
  gridSize: number;
  walkable: string;
  targets: Record<string, AndroidTarget>;
  rooms: Record<string, { minLevel: number; grid: string[] }>;
};

const regions = generated as Record<AndroidLand, AndroidRegion>;
const masks = new Map<AndroidLand, Buffer>();

export const ANDROID_POSITION_LAYOUT = "superior-isometric-v1";
export const ANDROID_PICKUP_RADIUS = 16;

export function androidTarget(land: AndroidLand, id: string): AndroidTarget | undefined {
  const targets = regions[land].targets;
  return Object.hasOwn(targets, id) ? targets[id] : undefined;
}

export function androidRoom(land: AndroidLand, room: string) {
  const rooms = regions[land].rooms;
  return Object.hasOwn(rooms, room) ? rooms[room] : undefined;
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

  const { size, gridSize, walkable } = regions[land];
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
