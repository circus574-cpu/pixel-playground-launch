import { describe, expect, it } from "vitest";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { Navigation } from "../game/navigation";

const aether = WORLDS.aether;

describe("enlarged Aetheria", () => {
  it("is a continent-sized world and keeps the original content shifted by the layout offset", () => {
    const first = aether.legacyShift!,
      second = aether.layoutShifts!["3"]!;
    const dx = first.x + second.x,
      dy = first.y + second.y;
    // Layout 2 enlarged the scene to 6000×4360; layout 3 puts it on the real continent.
    expect([aether.width, aether.height]).toEqual([44300, 27400]);
    expect(aether.layout).toBe(3);
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
    const first = aether.legacyShift!,
      second = aether.layoutShifts!["3"]!;
    const dx = first.x + second.x,
      dy = first.y + second.y;
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
