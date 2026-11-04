import { describe, expect, it } from "vitest";
import {
  ARENA_CLEAR_RADIUS,
  ARENA_THIN_RADIUS,
  arenaClearingEnabled,
  buildArenaIndex,
  clearsArena,
} from "../game/world/combatArena";

const tree = (x: number, y: number, extra = {}) => ({
  x,
  y,
  binding: "object.ki-v2-objects.verdant-oak-3",
  height: 258,
  solid: false,
  ...extra,
});

describe("combat arena clearing", () => {
  const index = buildArenaIndex([{ x: 1000, y: 1000 }]);

  it("is on by default and off only with ?ki-clear-arenas=0", () => {
    expect(arenaClearingEnabled("")).toBe(true);
    expect(arenaClearingEnabled("?ki-clear-arenas=1")).toBe(true);
    expect(arenaClearingEnabled("?ki-clear-arenas=0")).toBe(false);
  });

  it("removes tall trees in the core, keeps those far away", () => {
    expect(clearsArena(index, tree(1000 + ARENA_CLEAR_RADIUS - 10, 1000))).toBe(true);
    expect(clearsArena(index, tree(1000 + ARENA_THIN_RADIUS + 10, 1000))).toBe(false);
  });

  it("thins the ring deterministically, keeping a share", () => {
    const ring = Array.from({ length: 200 }, (_, i) =>
      tree(1000 + ARENA_CLEAR_RADIUS + 20 + (i % 10), 1000 + i),
    ).filter((o) => Math.hypot(o.x - 1000, o.y - 1000) < ARENA_THIN_RADIUS);
    const kept = ring.filter((o) => !clearsArena(index, o)).length;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(ring.length);
    expect(ring.map((o) => clearsArena(index, o))).toEqual(ring.map((o) => clearsArena(index, o)));
  });

  it("never removes solid trees, low props, or non-foliage", () => {
    expect(clearsArena(index, tree(1000, 1000, { solid: true }))).toBe(false);
    expect(clearsArena(index, tree(1000, 1000, { height: 60 }))).toBe(false);
    expect(
      clearsArena(index, tree(1000, 1000, { binding: "object.biome-mountain.boulder-pile" })),
    ).toBe(false);
  });
});
