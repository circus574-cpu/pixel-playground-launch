import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, worldRenderRefs } from "../game/assets/catalog";
import { CONTINENTS, containsPoint, ZONES, zonesOf } from "../components/planet-map/mapData";
import { Navigation } from "../game/navigation";
import { migrateLayout, newPlayer, SaveStore, SAVE_KEY } from "../game/session";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { atlasPoint, minimapPercent, OPEN_WORLDS } from "../game/world/zoneMap";

const OPEN = ["aether", "nexus", "pyra"] as const;
const LEGACY = { aether: [3600, 2560], nexus: [2400, 1792], pyra: [2400, 1792] } as const;
const packs = (imported as unknown[]).map((p) => PackSchema.parse(p));
const source = makeCatalog(packs);

describe.each(OPEN)("%s open world", (id) => {
  const world = WORLDS[id];
  const open = OPEN_WORLDS[id]!;
  const shift = world.legacyShift!;
  it("is the legacy rectangle plus a margin on every side, with the outer boundary re-drawn", () => {
    expect(world.layout).toBe(2);
    expect(world.width).toBe(LEGACY[id][0] + 2 * shift.x);
    expect(world.height).toBe(LEGACY[id][1] + 2 * shift.y);
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
      const near = world.enemies.filter(
        (e) => Math.abs(e.x - zone.x) < zone.width / 2 && Math.abs(e.y - zone.y) < zone.height / 2,
      );
      expect(near.length, zone.id).toBeGreaterThanOrEqual(4);
      expect(world.objects.some((o) => o.id.startsWith("zone-" + zone.id + "-"))).toBe(true);
    }
    for (const zone of world.terrain!.zones!)
      expect(source.renderBindings["terrain." + zone.texture], zone.texture).toBeTruthy();
    expect(world.terrain!.roads!.length).toBeGreaterThanOrEqual(4);
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
    expect(open.atlas.settle).toEqual(c.settlementPoint);
    expect(atlasPoint(id, open.anchor)).toEqual(c.settlementPoint);
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
    const shift = WORLDS.pyra.legacyShift!;
    expect([loaded.x, loaded.y]).toEqual([1180 + shift.x, 1330 + shift.y]);
    expect(loaded.layout).toBe(2);
  });
  it("does not shift twice and does not touch continents without a new layout", () => {
    const current = { ...newPlayer("android"), x: 2400, y: 1500 };
    const again = new SaveStore(stub(current)).load()!;
    expect([again.x, again.y]).toEqual([2400, 1500]);
    const planetary = { ...newPlayer("planetary"), x: 1570, y: 1250 };
    const unchanged = new SaveStore(stub(planetary)).load()!;
    expect([unchanged.x, unchanged.y]).toEqual([1570, 1250]);
    const p = { continent: "nexus" as const, x: 10, y: 20, layout: 2 };
    migrateLayout(p);
    expect([p.x, p.y]).toEqual([10, 20]);
  });
  it("starts new characters inside the new layout", () => {
    for (const race of ["sage", "android", "legend"] as const) {
      const p = newPlayer(race);
      expect(p.layout).toBe(2);
      const world = WORLDS[p.continent];
      expect(new Navigation(world.width, world.height, worldObstacles(world)).walkable(p)).toBe(
        true,
      );
    }
  });
});
