import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, worldRenderRefs } from "../game/assets/catalog";
import { CONTINENTS, containsPoint, ZONES, zonesOf } from "../components/planet-map/mapData";
import { Navigation } from "../game/navigation";
import { inSafeCity } from "../game/city/types";
import { migrateLayout, newPlayer, SaveStore, SAVE_KEY } from "../game/session";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { atlasPoint, minimapPercent, OPEN_WORLDS } from "../game/world/zoneMap";
import { sourceToPlanet } from "../game/world/planet";

const OPEN = ["aether", "nexus", "pyra"] as const;
// Real size of each painted continent in game units (docs/PLANET-GEOMETRY-2026-10-22.md).
const CONTINENT_SIZE = {
  aether: [44300, 27400],
  nexus: [39700, 26600],
  pyra: [42000, 25300],
} as const;
const packs = (imported as unknown[]).map((p) => PackSchema.parse(p));
const source = makeCatalog(packs);

describe.each(OPEN)("%s open world", (id) => {
  const world = WORLDS[id];
  const open = OPEN_WORLDS[id]!;
  it("is as large as the continent, with the outer boundary re-drawn", () => {
    const shift = world.layoutShifts!["3"]!;
    expect(world.layout).toBe(3);
    expect(world.width).toBe(CONTINENT_SIZE[id][0]);
    expect(world.height).toBe(CONTINENT_SIZE[id][1]);
    expect(shift.x).toBeGreaterThan(0);
    expect(shift.y).toBeGreaterThan(0);
    expect(world.border).toBe(4);
    const [top, left, right, bottom] = world.obstacles;
    expect(top).toMatchObject({ x: 0, y: 0, width: world.width });
    expect(left).toMatchObject({ x: 0 });
    expect(right!.x + right!.width).toBe(world.width);
    expect(bottom!.y + bottom!.height).toBe(world.height);
  });
  it("has four zones with floors, roads, landmarks, enemies and scenery on every side", () => {
    expect(open.zones.map((z) => z.id).sort()).toEqual(["east", "north", "south", "west"]);
    expect(world.terrain!.zones!.map((z) => z.id).sort()).toEqual([
      "east",
      "north",
      "south",
      "west",
    ]);
    for (const zone of open.zones) {
      expect(
        world.landmarks.some((l) => l.label === zone.name && l.x === zone.x && l.y === zone.y),
      ).toBe(true);
      expect(world.objects.some((o) => o.id.startsWith("zone-" + zone.id + "-"))).toBe(true);
    }
    for (const zone of world.terrain!.zones!)
      expect(source.renderBindings["terrain." + zone.texture], zone.texture).toBeTruthy();
    expect(world.terrain!.roads!.length).toBeGreaterThanOrEqual(4);
  });
  it("has hunting grounds on every side of the safe city, none inside it", () => {
    const b = world.city!.bounds!;
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    const sides = { north: 0, south: 0, east: 0, west: 0 };
    for (const e of world.enemies) {
      expect(inSafeCity(world, e, null), JSON.stringify(e)).toBe(false);
      const dx = (e.x - cx) / b.width,
        dy = (e.y - cy) / b.height;
      sides[
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north"
      ]++;
    }
    for (const [side, n] of Object.entries(sides)) expect(n, side).toBeGreaterThanOrEqual(3);
  });
  it("loads every zone texture and nature object it uses", () => {
    const assets = new Set(worldRenderRefs(id, source).map((r) => r.asset));
    for (const zone of world.terrain!.zones!)
      expect(assets.has(source.renderBindings["terrain." + zone.texture]!.asset)).toBe(true);
    for (const o of world.objects.filter((q) => q.asset?.startsWith("nature.")))
      expect(source.renderBindings["object." + o.asset], o.asset).toBeTruthy();
  });
  it("keeps spawn, NPCs, market, enemies and landmarks reachable from the spawn", () => {
    const nav = new Navigation(world.width, world.height, worldObstacles(world));
    expect(nav.walkable(world.spawn)).toBe(true);
    for (const p of [...world.npcs, ...world.enemies, ...world.landmarks, world.market]) {
      expect(nav.path(world.spawn, nav.safe(p)).length, JSON.stringify(p)).toBeGreaterThan(0);
    }
  });
  it("lets the player cross the old city edge in every direction", () => {
    const nav = new Navigation(world.width, world.height, worldObstacles(world));
    for (const zone of open.zones) {
      const goal = nav.safe({ x: zone.x, y: zone.y });
      expect(nav.path(world.spawn, goal).length, zone.id).toBeGreaterThan(0);
    }
  });
  it("matches zones.json (shared with /mapa) and the atlas settlement", () => {
    expect([open.width, open.height]).toEqual([world.width, world.height]);
    const settlement = world.landmarks.find((l) => l.kind === "settlement")!;
    expect(open.anchor).toEqual({ x: settlement.x, y: settlement.y });
    const c = CONTINENTS.find((q) => q.id === id)!;
    const placed = sourceToPlanet(id, open.atlas.settle);
    expect(placed.x).toBeCloseTo(c.settlementPoint!.x, 0);
    expect(placed.y).toBeCloseTo(c.settlementPoint!.y, 0);
    expect(atlasPoint(id, open.anchor)).toEqual(open.atlas.settle);
    expect(atlasPoint(id, { x: 0, y: 0 })).toEqual({
      x: open.atlas.bbox.x0,
      y: open.atlas.bbox.y0,
    });
    expect(atlasPoint(id, { x: world.width, y: world.height })).toEqual({
      x: open.atlas.bbox.x1,
      y: open.atlas.bbox.y1,
    });
  });
  it("places the four zones on the painted continent for /mapa and the globe", () => {
    const c = CONTINENTS.find((q) => q.id === id)!;
    expect(zonesOf(id)).toHaveLength(4);
    for (const z of zonesOf(id)) expect(containsPoint(c, z.point), z.id).toBe(true);
    expect(
      ZONES.filter((z) => z.region === id)
        .map((z) => z.dir)
        .sort(),
    ).toEqual(["east", "north", "south", "west"]);
  });
  it("puts every game point inside the minimap crop", () => {
    for (const p of [
      world.spawn,
      ...world.landmarks,
      { x: 0, y: 0 },
      { x: world.width, y: world.height },
    ]) {
      const m = minimapPercent(id, p, world);
      expect(m.left).toBeGreaterThanOrEqual(0);
      expect(m.left).toBeLessThanOrEqual(100);
      expect(m.top).toBeGreaterThanOrEqual(0);
      expect(m.top).toBeLessThanOrEqual(100);
    }
  });
});

describe("saves follow the layout revision", () => {
  const stub = (player: object) => {
    const data: Record<string, string> = {
      [SAVE_KEY]: JSON.stringify({ version: 3, revision: "r", player }),
    };
    return { getItem: (k: string) => data[k] ?? null, setItem: () => undefined };
  };
  it("shifts a position saved before the open world and marks it migrated", () => {
    const old = { ...newPlayer("legend"), x: 1180, y: 1330 };
    delete (old as { layout?: number }).layout;
    const loaded = new SaveStore(stub(old)).load()!;
    const first = WORLDS.pyra.legacyShift!,
      second = WORLDS.pyra.layoutShifts!["3"]!;
    expect([loaded.x, loaded.y]).toEqual([1180 + first.x + second.x, 1330 + first.y + second.y]);
    expect(loaded.layout).toBe(3);
  });
  it("moves a layout-2 save onto the continent by the second shift only", () => {
    const p = { continent: "pyra" as const, x: 2380, y: 2230, layout: 2 };
    migrateLayout(p);
    const second = WORLDS.pyra.layoutShifts!["3"]!;
    expect([p.x, p.y]).toEqual([2380 + second.x, 2230 + second.y]);
    expect(p.layout).toBe(3);
  });
  it("does not shift twice and does not touch continents without a new layout", () => {
    const current = { ...newPlayer("android"), x: 2400, y: 1500 };
    const again = new SaveStore(stub(current)).load()!;
    expect([again.x, again.y]).toEqual([2400, 1500]);
    const planetary = { ...newPlayer("planetary"), x: 1570, y: 1250 };
    const unchanged = new SaveStore(stub(planetary)).load()!;
    expect([unchanged.x, unchanged.y]).toEqual([1570, 1250]);
    const p = { continent: "nexus" as const, x: 10, y: 20, layout: 3 };
    migrateLayout(p);
    expect([p.x, p.y]).toEqual([10, 20]);
  });
  it("starts new characters inside the new layout", () => {
    for (const race of ["sage", "android", "legend"] as const) {
      const p = newPlayer(race);
      expect(p.layout).toBe(3);
      const world = WORLDS[p.continent];
      expect(new Navigation(world.width, world.height, worldObstacles(world)).walkable(p)).toBe(
        true,
      );
    }
  });
});
