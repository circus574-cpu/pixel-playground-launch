import { describe, expect, it } from "vitest";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { Navigation } from "../game/navigation";

const aether = WORLDS.aether;

describe("enlarged Aetheria", () => {
  it("is 3600×2560 and keeps the original spawn, NPCs and first enemies", () => {
    expect([aether.width, aether.height]).toEqual([3600, 2560]);
    expect(aether.spawn).toEqual({ x: 1150, y: 1130 });
    expect(aether.enemies.slice(0, 4)).toEqual([
      { x: 1820, y: 1080 },
      { x: 1870, y: 1510 },
      { x: 900, y: 1450 },
      { x: 470, y: 1100 },
    ]);
    expect(aether.enemies).toHaveLength(8);
  });
  it("has curved roads, organic courts and new districts", () => {
    expect(aether.terrain!.paths).toHaveLength(0);
    expect(aether.terrain!.roads!.length).toBeGreaterThanOrEqual(8);
    expect(aether.terrain!.courts!.length).toBeGreaterThanOrEqual(5);
    for (const kind of ["pagoda", "koi-pond", "spirit-gate", "stone-lantern", "cherry-tree"])
      expect(aether.objects.some((o) => o.kind === kind)).toBe(true);
  });
  it("every old walkable save position in the 2400×1792 area stays reachable", () => {
    const nav = new Navigation(aether.width, aether.height, worldObstacles(aether));
    for (const p of [
      { x: 1150, y: 1130 },
      { x: 2300, y: 600 },
      { x: 2350, y: 1500 },
      { x: 1200, y: 1700 },
    ]) {
      expect(nav.walkable(p), JSON.stringify(p)).toBe(true);
      expect(nav.path(aether.spawn, p).length).toBeGreaterThan(0);
    }
  });
});
