import { describe, expect, it, vi } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { WORLDS } from "../game/world/worlds";
import { browserNavigation } from "../game/world/generated/browserTerrain";
import { streamSpawns, type AuthoredSpawn } from "../game/world/generated/spawnStream";
import { SuperiorSaveStore } from "../game/world/generated/superiorSave";

function setup(count = 1) {
  const world = structuredClone(WORLDS.aether);
  Object.assign(world, {
    width: 8192,
    height: 6144,
    city: undefined,
    enemies: [],
    monsters: [],
    obstacles: [],
    spawn: { x: 3000, y: 2000 },
  });
  const g = new GameSession(undefined, "sage", {
    world,
    navigation: new Navigation(8192, 6144, []),
    maximumActiveEnemies: 24,
  });
  const save = new SuperiorSaveStore(
    null,
    "test",
    { format: "superior-runtime-1", revision: "test", features: [] },
    "aether",
  );
  const slots: AuthoredSpawn[] = Array.from({ length: count }, (_, i) => ({
    id: "aether-slot-" + i,
    kind: "verdant-cierniowy-wilk",
    x: 3100 + i,
    y: 2000,
    homeLeash: 520,
    respawnMs: 25000,
  }));
  let now = 100000;
  const stream = streamSpawns(
    g,
    save,
    slots,
    { acquire: async () => {}, release: () => {} },
    () => now,
  );
  return {
    g,
    save,
    slots,
    stream,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const settled = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("Superior authored spawn lifecycle", () => {
  it("activates at most two slots per frame and never expands a wolf into an unvalidated pack", async () => {
    const { g, stream } = setup(60);
    stream.update();
    await settled();
    expect(g.enemies).toHaveLength(2);
    for (let i = 0; i < 30; i++) {
      stream.update();
      await settled();
    }
    expect(g.enemies).toHaveLength(16);
    expect(new Set(g.enemies.map((e) => e.id)).size).toBe(16);
    stream.dispose();
  });
  it("retains damaged live enemies and persists HP before saving or travelling", async () => {
    const { g, save, stream } = setup();
    stream.update();
    await settled();
    const e = g.enemies[0]!;
    e.hp -= 11;
    g.player.x = 7000;
    stream.update();
    expect(g.enemies).toContain(e);
    expect(save.spawns[e.id]?.hp).toBe(e.hp);
    stream.dispose();
  });
  it("does not respawn a killed slot by crossing a chunk boundary; uses its authored cooldown", async () => {
    const { g, save, stream, advance } = setup();
    stream.update();
    await settled();
    const e = g.enemies[0]!;
    e.hp = 0;
    e.mode = "dead";
    stream.capture();
    const deadline = save.spawns[e.id]!.deadUntil;
    g.enemies.splice(0);
    stream.update();
    await settled();
    expect(g.enemies).toHaveLength(0);
    expect(deadline).toBe(125000);
    advance(24999);
    stream.update();
    await settled();
    expect(g.enemies).toHaveLength(0);
    advance(1);
    stream.update();
    await settled();
    expect(g.enemies).toHaveLength(1);
    expect(g.enemies[0]!.hp).toBe(g.enemies[0]!.maxHp);
    stream.dispose();
  });
  it("keeps a dead root's atlas until its last living summoned descendant is gone", async () => {
    const { g, save, slots } = setup();
    const release = vi.fn();
    const stream = streamSpawns(g, save, slots, { acquire: async () => {}, release });
    stream.update();
    await settled();
    const root = g.enemies[0]!;
    const child = g.monsters.spawn("verdant-mala-osa", { x: root.x + 20, y: root.y });
    child.m.parent = root.id;
    root.mode = "dead";
    root.hp = 0;
    stream.capture();
    g.enemies.splice(g.enemies.indexOf(root), 1);
    stream.update();
    expect(release).not.toHaveBeenCalled();
    g.enemies.splice(g.enemies.indexOf(child), 1);
    stream.update();
    expect(release).toHaveBeenCalledTimes(1);
    stream.dispose();
  });
  it("does not activate an async request after disposing the outgoing scene", async () => {
    const { g, save, slots } = setup();
    let ready!: () => void;
    const stream = streamSpawns(g, save, slots, {
      acquire: () =>
        new Promise<void>((r) => {
          ready = r;
        }),
      release: () => {},
    });
    stream.update();
    stream.dispose();
    ready();
    await settled();
    expect(g.enemies).toHaveLength(0);
  });
  it("caps split mechanics at the runtime enemy budget without changing the global definition", () => {
    const { g } = setup();
    const split = g.monsters.spawn("nexus-roj-nanitow", { x: 3100, y: 2000 });
    for (let i = 1; i < 24; i++)
      g.monsters.spawn("verdant-mchowy-szlamak", { x: 3300 + i, y: 2000 });
    g.monsters.damage(split, 1, { tags: ["physical"] });
    expect(g.enemies).toHaveLength(24);
    expect(split.m.split).toBe(false);
  });
});

describe("enemy-only city exclusion", () => {
  it("keeps player doors walkable while enemy routes and pushes cannot cross the city", () => {
    const field = { cell: 16, width: 32, height: 32, blocked: [[0, 1024] as [number, number]] };
    const terrain = { cell: 32, width: 16, height: 16, flags: [[17, 256] as [number, number]] };
    const city = { x: 192, y: 160, width: 128, height: 192 };
    const player = browserNavigation(512, 512, field, terrain, []);
    const enemy = browserNavigation(512, 512, field, terrain, [], [city]);
    expect(player.walkable({ x: 256, y: 256 })).toBe(true);
    expect(enemy.walkable({ x: 256, y: 256 })).toBe(false);
    expect(enemy.step({ x: 160, y: 256 }, { x: 360, y: 256 }, 200).x).toBeLessThan(180);
    const path = enemy.path({ x: 100, y: 256 }, { x: 400, y: 256 });
    expect(path.length).toBeGreaterThan(0);
    for (const p of path) expect(enemy.walkable(p)).toBe(true);
  });
});
