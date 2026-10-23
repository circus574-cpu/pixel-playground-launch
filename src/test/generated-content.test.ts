import { describe, expect, it } from "vitest";
import { browserNavigation, decodeRuns } from "../game/world/generated/browserTerrain";
import { blockedAt } from "../game/movement";
import { Navigation } from "../game/navigation";
import { GameSession } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import { DungeonProgress, type DungeonFloor } from "../game/world/generated/dungeonProgress";
import { SettlementLife, type LifeRoutine } from "../game/world/generated/settlementLife";

describe("CPU browser world contract", () => {
  it("rejects malformed, truncated and oversized RLE grids", () => {
    expect([
      ...decodeRuns(
        [
          [1, 2],
          [0, 2],
        ],
        4,
      ),
    ]).toEqual([1, 1, 0, 0]);
    for (const value of [[[1, 5]], [[1, 0]], [[256, 4]], [[1, 1.5]], [[1, 2]]])
      expect(() => decodeRuns(value, 4)).toThrow();
    expect(() => decodeRuns([], 20_000_000)).toThrow();
  });
  it("routes the actual game navigator around an exact collider and prevents tunnelling", () => {
    const rectangles = [{ x: 144, y: 64, width: 32, height: 192 }],
      width = 320,
      height = 320;
    const blocked = [] as [number, number][];
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++)
        blocked.push([
          blockedAt(x * 16 + 8, y * 16 + 8, rectangles, 12 + Math.SQRT2 * 8) ? 1 : 0,
          1,
        ]);
    const nav = browserNavigation(
      width,
      height,
      { cell: 16, width: 20, height: 20, blocked },
      { cell: 32, width: 10, height: 10, flags: [[17, 100]] },
      rectangles,
    );
    expect(nav).toBeInstanceOf(Navigation);
    expect(nav.walkable({ x: 188, y: 160 })).toBe(false);
    expect(nav.walkable({ x: 188.1, y: 160 })).toBe(true);
    const start = { x: 64, y: 160 },
      end = { x: 256, y: 160 },
      path = nav.path(start, end);
    expect(path.length).toBeGreaterThan(2);
    expect(path.at(-1)).toEqual(end);
    let from = start;
    for (const to of path) {
      expect(nav.visible(from, to)).toBe(true);
      from = to;
    }
    expect(nav.step(start, end, 1000)).toEqual(start);
  });
  it("injects alternate worlds without mutating accepted maps or default sessions", () => {
    const baseline = JSON.stringify(WORLDS),
      world = {
        ...WORLDS.verdant,
        width: 320,
        height: 320,
        spawn: { x: 64, y: 64 },
        enemies: [],
        npcs: [],
        objects: [],
        obstacles: [],
      };
    delete world.city;
    const nav = new Navigation(320, 320, []),
      g = new GameSession(undefined, "planetary", { world, navigation: nav, random: () => 0.5 });
    expect(g.world).toBe(world);
    expect(g.nav).toBe(nav);
    expect([g.player.x, g.player.y]).toEqual([64, 64]);
    expect(g.safe).toBe(false);
    expect(JSON.stringify(WORLDS)).toBe(baseline);
    expect(new GameSession().world).toBe(WORLDS.verdant);
  });
});

describe("local dungeon progression", () => {
  const floor: DungeonFloor = {
    id: "floor-1",
    keys: [{ id: "key", x: 100, y: 100 }],
    gates: [{ id: "gate", key: "key", x: 200, y: 100 }],
    chests: [{ id: "chest", x: 300, y: 100, reward: { gold: 10, potion: 1 } }],
  };
  it("requires the key, prevents remote interaction and persists one-time chest claims", () => {
    const p = new DungeonProgress(floor, () => true);
    expect(p.open("gate", { x: 200, y: 100 })).toBe(false);
    expect(p.pickup("key", { x: 900, y: 900 })).toBe(false);
    expect(p.pickup("key", { x: 100, y: 100 })).toBe(true);
    expect(p.open("gate", { x: 200, y: 100 })).toBe(true);
    expect(p.lockedGates()).toHaveLength(0);
    expect(p.claim("chest", { x: 300, y: 100 })).toEqual({ gold: 10, potion: 1 });
    expect(p.claim("chest", { x: 300, y: 100 })).toBeNull();
    const restored = new DungeonProgress(floor, () => true, p.snapshot());
    expect(restored.claim("chest", { x: 300, y: 100 })).toBeNull();
  });
  it("rejects unknown/future progress and prevents reaching through walls", () => {
    const p = new DungeonProgress(floor, () => false);
    expect(p.pickup("key", { x: 100, y: 100 })).toBe(false);
    expect(
      () =>
        new DungeonProgress(floor, () => true, {
          version: 1,
          floor: "floor-1",
          keys: [],
          gates: ["gate"],
          chests: [],
        }),
    ).toThrow();
    expect(
      () =>
        new DungeonProgress(floor, () => true, {
          version: 2,
          floor: "floor-1",
          keys: [],
          gates: [],
          chests: [],
        } as unknown as ReturnType<DungeonProgress["snapshot"]>),
    ).toThrow();
  });
});

describe("settlement world clock", () => {
  const routes = [
    {
      id: "out",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
    {
      id: "back",
      points: [
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ],
    },
  ];
  const routine: LifeRoutine = {
    id: "routine",
    dayMs: 4000,
    phaseOffsetMs: 0,
    segments: [
      { fromMs: 0, toMs: 1000, activity: "sleep", position: { x: 0, y: 0 }, indoors: true },
      { fromMs: 1000, toMs: 2000, activity: "walk", route: "out", indoors: false },
      { fromMs: 2000, toMs: 3000, activity: "work", position: { x: 100, y: 0 }, indoors: true },
      { fromMs: 3000, toMs: 4000, activity: "walk", route: "back", indoors: false },
    ],
  };
  const residents = Array.from({ length: 30 }, (_, i) => ({
    id: "resident-" + i,
    routine: "routine",
    role: "artisan",
    artBinding: "npc.sage.artisan",
  }));
  it("reconstructs movement without ticking distant NPCs and caps visible actors", () => {
    const life = new SettlementLife(residents, routes, [routine]);
    expect(life.at(residents[0]!, 1500)).toEqual({ x: 50, y: 0, activity: "walk", visible: true });
    expect(life.at(residents[0]!, 5500)).toEqual(life.at(residents[0]!, 1500));
    expect(life.nearby({ x: 50, y: 0 }, 1500)).toHaveLength(16);
    expect(life.nearby({ x: 0, y: 0 }, 500)).toHaveLength(0);
    expect(() => life.nearby({ x: 0, y: 0 }, 1500, 100)).toThrow();
  });
  it("rejects gaps, teleporting loops and invalid world time", () => {
    const bad = structuredClone(routine);
    bad.segments[1]!.fromMs = 999;
    expect(() => new SettlementLife(residents, routes, [bad])).toThrow();
    const life = new SettlementLife(residents, routes, [routine]);
    expect(() => life.at(residents[0]!, -1)).toThrow();
  });
});

// The loader remains a separate boundary so corrupt downloads never become a navigable world.
describe("generated asset loading", () => {
  it("rejects unknown features before fetching and detects content corruption", async () => {
    const { loadBrowserFeature } = await import("../game/world/generated/browserLoader");
    let requests = 0;
    const fetcher = (async () => {
      requests++;
      return new Response(
        JSON.stringify({
          format: "superior-browser-1",
          files: {
            "world.json": "0".repeat(64),
            "navigation.json": "0".repeat(64),
            "terrain.json": "0".repeat(64),
            "collision.json": "0".repeat(64),
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    await expect(loadBrowserFeature("/assets", "../../test", { fetcher })).rejects.toThrow(
      "Unknown",
    );
    expect(requests).toBe(0);
    await expect(loadBrowserFeature("/assets", "verdant", { fetcher })).rejects.toThrow();
  });
});
