import { describe, expect, it } from "vitest";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { Navigation, distance } from "../game/navigation";

type Building = {
  id: string;
  name: string;
  district: string;
  objectId: string;
  door: { x: number; y: number };
};
type City = {
  id: string;
  safe: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  minServiceDistance: number;
  buildings: Building[];
  npcs: { id: string; building: string; name: string; dialogue: string }[];
};
const world = WORLDS.nexus;
const city = (world as unknown as { cityPlan: City }).cityPlan;
const nav = new Navigation(world.width, world.height, worldObstacles(world));
const SERVICES = ["shop", "hall", "inn", "smithy", "depot", "arena"];

describe("Nexus-9 city (Androids)", () => {
  it("defines the six service buildings, each with its own district and graphic object", () => {
    expect(city.buildings.map((b) => b.id).sort()).toEqual([...SERVICES].sort());
    expect(new Set(city.buildings.map((b) => b.district)).size).toBe(6);
    for (const b of city.buildings) {
      expect(
        world.objects.some((o) => o.id === b.objectId),
        b.id,
      ).toBe(true);
      expect(b.name.length).toBeGreaterThan(3);
    }
  });
  it("keeps the services in separate districts, at least the contract distance apart", () => {
    const door = (id: string) => city.buildings.find((b) => b.id === id)!.door;
    for (const a of SERVICES)
      for (const b of SERVICES)
        if (a < b) expect(distance(door(a), door(b)), `${a}-${b}`).toBeGreaterThanOrEqual(700);
  });
  it("has every door on walkable ground, reachable from the start and from each other", () => {
    for (const b of city.buildings) {
      expect(nav.walkable(b.door), b.id + " door walkable").toBe(true);
      expect(nav.path(world.spawn, b.door).length, b.id + " from spawn").toBeGreaterThan(0);
    }
    const hall = city.buildings.find((b) => b.id === "hall")!.door;
    for (const b of city.buildings)
      expect(nav.path(hall, b.door).length, "hall to " + b.id).toBeGreaterThan(0);
  });
  it("keeps the tutorial points and the street NPCs reachable", () => {
    expect(nav.path(world.spawn, world.market).length).toBeGreaterThan(0);
    for (const n of world.npcs) {
      expect(nav.walkable(n), n.id).toBe(true);
      expect(nav.path(world.spawn, n).length, n.id).toBeGreaterThan(0);
    }
  });
  it("is a safe area: no combat spawns or monsters inside it", () => {
    const { x, y, width, height } = city.bounds;
    const inside = (p: { x: number; y: number }) =>
      p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height;
    expect(city.safe).toBe(true);
    expect(world.enemies.filter(inside)).toEqual([]);
    expect((world.monsters ?? []).filter(inside)).toEqual([]);
  });
  it("gives each service building its own resident with a Sages' dialogue", () => {
    for (const id of SERVICES) {
      const residents = city.npcs.filter((n) => n.building === id);
      expect(residents.length, id).toBe(1);
      expect(residents[0]!.dialogue.length).toBeGreaterThan(20);
    }
    expect(new Set(city.npcs.map((n) => n.name)).size).toBe(city.npcs.length);
  });
  it("does not stack buildings: footprints never overlap each other", () => {
    const rects = city.buildings.map((b) => {
      const o = world.objects.find((x) => x.id === b.objectId)!;
      const f = o.footprint!;
      return { id: b.id, x: o.x - f.width / 2, y: o.y - f.height / 2, w: f.width, h: f.height };
    });
    for (const a of rects)
      for (const b of rects)
        if (a.id < b.id)
          expect(
            a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
            `${a.id}/${b.id}`,
          ).toBe(true);
  });
});
