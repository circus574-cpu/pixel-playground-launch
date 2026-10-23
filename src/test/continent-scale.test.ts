import { describe, expect, it } from "vitest";
import { Navigation, distance } from "../game/navigation";
import { inSafeCity } from "../game/city/types";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { WORLD_IDS } from "../game/world/races";

// Owner decision 23.10.2026: every local city is a safe area of about 4000 × 2500 units and the rest
// of the continent, at the size of the painted continent, is empty but reachable ground.
const CONTINENT = {
  verdant: [49000, 31400],
  aether: [44300, 27400],
  nexus: [39700, 26600],
  pyra: [42000, 25300],
} as const;

describe.each(WORLD_IDS)("%s at continent scale", (id) => {
  const world = WORLDS[id];
  const city = world.city!;
  const bounds = city.bounds!;
  const nav = new Navigation(world.width, world.height, worldObstacles(world));
  it("is as large as the painted continent", () => {
    expect([world.width, world.height]).toEqual(CONTINENT[id]);
  });
  it("has a safe city of 4000 × 2500 units inside the world", () => {
    expect([bounds.width, bounds.height]).toEqual([4000, 2500]);
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThan(world.width);
    expect(bounds.y + bounds.height).toBeLessThan(world.height);
    expect(inSafeCity(world, world.spawn, null)).toBe(true);
  });
  it("keeps all six service doors in the city, spread out and reachable from the start", () => {
    expect(city.buildings).toHaveLength(6);
    for (const b of city.buildings) {
      expect(inSafeCity(world, b.door, null), b.id).toBe(true);
      expect(nav.walkable(b.door), b.id).toBe(true);
      expect(nav.path(world.spawn, b.door).length, b.id).toBeGreaterThan(0);
      for (const o of city.buildings)
        if (o.id !== b.id) expect(distance(b.door, o.door), b.id + "-" + o.id).toBeGreaterThan(700);
    }
    const xs = city.buildings.map((b) => b.door.x),
      ys = city.buildings.map((b) => b.door.y);
    // No single cluster: the districts cover most of the city.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(bounds.width * 0.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(bounds.height * 0.5);
  });
  it("lets the player walk out of the city to the far edges of the continent", () => {
    for (const goal of [
      { x: 400, y: 400 },
      { x: world.width - 400, y: world.height - 400 },
      { x: world.width - 400, y: 400 },
      { x: 400, y: world.height - 400 },
    ]) {
      const target = nav.safe(goal);
      expect(nav.walkable(target)).toBe(true);
      expect(nav.path(world.spawn, target).length, JSON.stringify(goal)).toBeGreaterThan(0);
    }
  });
  it("keeps hunting grounds outside the city", () => {
    expect(world.enemies.length).toBeGreaterThanOrEqual(12);
    for (const e of world.enemies) {
      expect(inSafeCity(world, e, null), JSON.stringify(e)).toBe(false);
      expect(nav.walkable(e), JSON.stringify(e)).toBe(true);
      expect(nav.path(world.spawn, e).length, JSON.stringify(e)).toBeGreaterThan(0);
    }
  });
});
