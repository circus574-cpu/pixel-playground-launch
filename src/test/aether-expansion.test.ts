import { describe, expect, it } from "vitest";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { Navigation } from "../game/navigation";

const aether = WORLDS.aether;

describe("enlarged Aetheria", () => {
  it("is the open world (6000×4360) and keeps the original content shifted by the layout offset", () => {
    const { x: dx, y: dy } = aether.legacyShift!;
    expect([aether.width, aether.height]).toEqual([3600 + 2 * dx, 2560 + 2 * dy]);
    expect(aether.layout).toBe(2);
    expect(aether.spawn).toEqual({ x: 1150 + dx, y: 1130 + dy });
    // The four spawns that stood inside the sanctuary valley were removed: the city is a safe area.
    expect(aether.enemies).not.toContainEqual({ x: 1820 + dx, y: 1080 + dy });
    expect(aether.enemies.length).toBeGreaterThan(8);
  });
  it("has curved roads, organic courts and new districts", () => {
    expect(aether.terrain!.paths).toHaveLength(0);
    expect(aether.terrain!.roads!.length).toBeGreaterThanOrEqual(12);
    expect(aether.terrain!.courts!.length).toBeGreaterThanOrEqual(5);
    for (const kind of ["pagoda", "koi-pond", "spirit-gate", "stone-lantern", "cherry-tree"])
      expect(aether.objects.some((o) => o.kind === kind)).toBe(true);
  });
  it("every old walkable save position in the 2400×1792 area stays reachable", () => {
    const nav = new Navigation(aether.width, aether.height, worldObstacles(aether));
    const { x: dx, y: dy } = aether.legacyShift!;
    for (const p of [
      { x: 1150, y: 1130 },
      { x: 2300, y: 600 },
      { x: 2350, y: 1500 },
      { x: 1200, y: 1700 },
    ].map((q) => ({ x: q.x + dx, y: q.y + dy }))) {
      expect(nav.walkable(p), JSON.stringify(p)).toBe(true);
      expect(nav.path(aether.spawn, p).length).toBeGreaterThan(0);
    }
  });
});
