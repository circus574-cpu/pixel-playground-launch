import type { Point } from "../navigation";

/**
 * Combat-arena clearing (opt-in `?ki-clear-arenas=1`, owner request 04.11.2026): tall trees and dense
 * bushes right next to a monster spawn hide the fight and burn sprites. Presentation only: art objects
 * are non-solid and collision always comes from the world's own obstacles, so saves and navigation
 * never depend on what is drawn here.
 */
export const ARENA_CLEAR_RADIUS = 260;
export const ARENA_THIN_RADIUS = 420;
/** Share of foliage kept in the thinning ring (deterministic per object, so chunks reload identically). */
export const ARENA_THIN_KEEP = 0.4;
/** Ground props and low bushes below this height never block the view of a fight. */
export const ARENA_MIN_HEIGHT = 100;
const CELL = 512;
const FOLIAGE = /tree|pine|oak|birch|spruce|willow|palm|cherry|bamboo|bush|shrub|foliage/;

export function arenaClearingEnabled(search: string): boolean {
  return new URLSearchParams(search).get("ki-clear-arenas") === "1";
}

export type ArenaObject = Point & {
  binding?: string;
  kind?: string;
  height?: number;
  solid?: boolean;
};

export function isArenaFoliage(o: ArenaObject): boolean {
  // A solid tree has a collision footprint: it stays drawn so no invisible wall is left in an arena.
  return (
    !o.solid &&
    (o.height ?? 0) >= ARENA_MIN_HEIGHT &&
    (FOLIAGE.test((o.binding ?? "").toLowerCase()) || FOLIAGE.test((o.kind ?? "").toLowerCase()))
  );
}

export type ArenaIndex = { nearest(p: Point): number };

/** Spatial hash of spawn points: distance to the nearest spawn within the thinning radius, else Infinity. */
export function buildArenaIndex(spawns: readonly Point[]): ArenaIndex {
  const cells = new Map<string, Point[]>();
  for (const s of spawns) {
    const k = Math.floor(s.x / CELL) + ":" + Math.floor(s.y / CELL);
    const list = cells.get(k);
    if (list) list.push(s);
    else cells.set(k, [s]);
  }
  return {
    nearest(p) {
      const cx = Math.floor(p.x / CELL),
        cy = Math.floor(p.y / CELL);
      let best = Infinity;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const s of cells.get(cx + dx + ":" + (cy + dy)) ?? []) {
            const d = Math.hypot(p.x - s.x, p.y - s.y);
            if (d < best) best = d;
          }
      return best;
    },
  };
}

/** Whether a decoration should be left out: all foliage in the arena core, a deterministic share in the ring. */
export function clearsArena(index: ArenaIndex, o: ArenaObject): boolean {
  if (!isArenaFoliage(o)) return false;
  const d = index.nearest(o);
  if (d < ARENA_CLEAR_RADIUS) return true;
  if (d >= ARENA_THIN_RADIUS) return false;
  const hash = Math.abs(Math.floor(o.x * 13 + o.y * 37)) % 100;
  return hash >= ARENA_THIN_KEEP * 100;
}
