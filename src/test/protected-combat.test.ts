import { ProtectedActor } from "../game/development/heritage/protectedActor";
import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import type { MonsterReceiver } from "../game/monsters/receivers";
import type { FxSpec } from "../game/monsters/types";
import type { HurtKind } from "../game/monsters/system";
function fixture(wall = false) {
  const world = {
    ...WORLDS.aether,
    width: 2500,
    height: 2000,
    spawn: { x: 1000, y: 1000 },
    objects: [],
    npcs: [],
    enemies: [],
    monsters: [],
    safeAreas: [],
    obstacles: wall ? [{ x: 1110, y: 870, width: 20, height: 300 }] : [],
    city: {
      name: "Fixture",
      bounds: { x: 50, y: 50, width: 100, height: 100 },
      roads: [],
      buildings: [],
    },
  };
  const s = new GameSession(undefined, "sage", { world, random: () => 0.99 });
  const tick = (ms: number) => {
    for (let n = 0; n < ms; n += 50) s.tick(Math.min(50, ms - n));
  };
  return { s, tick };
}
function actor(s: GameSession, id = "protected-a", x = 1100, y = 1000) {
  const body = { x, y, hp: 2000, dead: false };
  let valid = true;
  const hits: { raw: number; kind: HurtKind }[] = [],
    effects: FxSpec[] = [];
  const port: MonsterReceiver = {
    id,
    body,
    maxHp: 2000,
    valid: () => valid,
    hurt(raw, _from, kind) {
      if (body.dead) return { dealt: 0, evaded: true };
      const dealt = Math.min(body.hp, raw);
      body.hp -= dealt;
      body.dead = body.hp <= 0;
      hits.push({ raw, kind });
      return { dealt, evaded: false };
    },
    applyFx(fx) {
      effects.push(fx);
    },
  };
  s.monsters.registerCombatTarget(port);
  return {
    body,
    port,
    hits,
    effects,
    set valid(value: boolean) {
      valid = value;
    },
  };
}
describe("registered protected receivers in the existing monster AI", () => {
  it("preserves the ordinary zone FX clock while the hero is safe", () => {
    const { s } = fixture();
    s.player.x = 100;
    s.player.y = 100;
    expect(s.safe).toBe(true);
    const enemy = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: 280, y: 100 });
    s.monsters.zones.push({
      id: "city-edge",
      owner: enemy.id,
      x: 100,
      y: 100,
      machine: false,
      kind: "web",
      radius: 150,
      ms: 1000,
      dps: 0,
      atk: 1,
      fx: [{ k: "slow", pct: 0.2, ms: 500 }],
      fxMs: 0,
    });
    s.monsters.tick(100);
    expect(s.fx.slow.ms).toBe(0);
    expect(s.monsters.zones[0]!.fxMs).toBe(400);
    s.player.x = 200;
    expect(s.safe).toBe(false);
    s.monsters.tick(50);
    expect(s.fx.slow.ms).toBe(0);
    expect(s.monsters.zones[0]!.fxMs).toBe(350);
  });
  it("the production friendly body takes real damage/FX and unregisters without harming the hero", () => {
    const { s, tick } = fixture();
    const friendly = new ProtectedActor(s, "Posłaniec", { x: 1100, y: 1000 }, 500, 12, true);
    const e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: 1130, y: 1000 });
    s.monsters.setCombatTarget(e, friendly.id);
    tick(2000);
    expect(friendly.body.hp).toBeLessThan(500);
    expect(friendly.body.dead).toBe(false);
    friendly.applyFx({ k: "stun", ms: 1000 }, e);
    expect(friendly.fx.cannotMove).toBe(true);
    friendly.tick(1000);
    expect(friendly.fx.cannotMove).toBe(false);
    const hero = structuredClone(s.player),
      enemyCount = s.enemies.length;
    friendly.hurt(100000, e, "melee");
    expect(friendly.body.dead).toBe(true);
    expect(friendly.body.hp).toBe(0);
    expect(s.player).toEqual(hero);
    expect(s.enemies).toHaveLength(enemyCount);
    expect(s.events.some((event) => event.type === "death" && event.target === friendly.id)).toBe(
      true,
    );
    friendly.dispose();
    friendly.dispose();
    expect(friendly.valid()).toBe(false);
    expect(s.monsters.setCombatTarget(e, friendly.id)).toBe(false);
  });
  it("anchored objects ignore movement control while real DOT remains independent of tick grouping", () => {
    const { s } = fixture();
    const a = new ProtectedActor(s, "Węzeł", { x: 1100, y: 1000 }, 1000, 0, false);
    const b = new ProtectedActor(s, "Węzeł drugi", { x: 1200, y: 1000 }, 1000, 0, false);
    const enemy = s.monsters.spawn("verdant-lesny-pajak", { x: 1400, y: 1000 });
    a.applyFx({ k: "stun", ms: 1000 }, enemy);
    expect(a.fx.cannotMove).toBe(false);
    expect(
      s.events.some((e) => e.type === "status" && e.target === a.id && e.text === "Ogłuszenie"),
    ).toBe(false);
    a.applyFx({ k: "dot", id: "poison", atkPct: 0.1, ms: 5000 }, enemy);
    b.applyFx({ k: "dot", id: "poison", atkPct: 0.1, ms: 5000 }, enemy);
    for (let n = 0; n < 100; n++) a.tick(50);
    for (let n = 0; n < 10; n++) b.tick(500);
    expect(a.body.hp).toBe(b.body.hp);
    expect(a.body.hp).toBe(1000 - Math.floor(enemy.m.def.atk * 0.1 * 5 + 1e-9));
    expect(a.body.hp).toBeLessThan(1000);
    const before = a.body.hp;
    a.dispose();
    a.tick(5000);
    expect(a.body.hp).toBe(before);
  });
  it("directs actual melee hits to the explicit subject rather than the hero", () => {
    const { s, tick } = fixture(),
      a = actor(s),
      hp = s.player.hp;
    const e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: a.body.x + 30, y: a.body.y });
    expect(s.monsters.setCombatTarget(e, a.port.id)).toBe(true);
    tick(5000);
    expect(a.hits.length).toBeGreaterThan(0);
    expect(a.body.hp).toBeLessThan(2000);
    expect(s.player.hp).toBe(hp);
    expect(
      s.events.some(
        (event) => event.type === "attack" && event.source === e.id && event.target === a.port.id,
      ),
    ).toBe(true);
  });
  it("will not redirect a committed windup, and removal cancels its hit", () => {
    const { s, tick } = fixture(),
      a = actor(s),
      hp = s.player.hp;
    const e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: a.body.x + 30, y: a.body.y });
    s.monsters.setCombatTarget(e, a.port.id);
    for (let t = 0; t < 100 && !e.m.basicWindup; t++) tick(50);
    expect(e.m.basicWindup).toBeDefined();
    const before = a.hits.length,
      health = a.body.hp;
    expect(s.monsters.setCombatTarget(e, null)).toBe(false);
    s.monsters.unregisterCombatTarget(a.port.id);
    expect(e.m.basicWindup).toBeUndefined();
    tick(100);
    expect(a.hits).toHaveLength(before);
    expect(a.body.hp).toBe(health);
    expect(s.player.hp).toBe(hp);
  });
  it.each([false, true])("an in-flight projectile retains its subject; detached=%s", (detach) => {
    const { s, tick } = fixture(),
      a = actor(s, "protected-a", 1200, 1000),
      hp = s.player.hp;
    const e = s.monsters.spawn("verdant-lesny-pajak", { x: 1200, y: 1200 });
    s.monsters.setCombatTarget(e, a.port.id);
    for (let t = 0; t < 200 && !s.monsters.projectiles.active.length; t++) tick(50);
    expect(s.monsters.projectiles.active).toHaveLength(1);
    expect(s.monsters.projectiles.active[0]!.target).toBe(a.body);
    if (detach) s.monsters.unregisterCombatTarget(a.port.id);
    else expect(s.monsters.setCombatTarget(e, null)).toBe(true);
    tick(500);
    expect(a.hits.length).toBe(detach ? 0 : 1);
    expect(s.player.hp).toBe(hp);
  });
  it("does not duplicate a body registration, and validates finite live recipients", () => {
    const { s } = fixture(),
      a = actor(s);
    expect(() => s.monsters.registerCombatTarget(a.port)).toThrow();
    expect(() => s.monsters.registerCombatTarget({ ...a.port, id: "duplicate-body" })).toThrow();
    expect(() =>
      s.monsters.registerCombatTarget({ ...a.port, id: "hero-alias", body: s.player }),
    ).toThrow();
    expect(() =>
      s.monsters.registerCombatTarget({
        ...a.port,
        id: "bad",
        body: { x: NaN, y: 1000, hp: 10, dead: false },
      }),
    ).toThrow();
    expect(
      s.monsters.setCombatTarget(s.monsters.spawn("boar", { x: 1500, y: 1200 }), "not-registered"),
    ).toBe(false);
  });
  it("applies a lingering zone once per subject, including the hero, with one shared FX pulse", () => {
    const { s } = fixture(),
      a = actor(s, "protected-a", 1000, 1000),
      b = actor(s, "protected-b", 1010, 1000);
    const e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: 1600, y: 1500 }),
      hp = s.player.hp;
    s.monsters.zones.push({
      id: "fixture-zone",
      owner: e.id,
      machine: false,
      x: 1000,
      y: 1000,
      kind: "fire",
      radius: 80,
      ms: 1000,
      dps: 0.1,
      atk: 100,
      fx: [{ k: "slow", pct: 0.2, ms: 500 }],
      fxMs: 0,
    });
    s.monsters.tick(100);
    expect(a.hits).toEqual([{ raw: 1, kind: "dot" }]);
    expect(b.hits).toEqual([{ raw: 1, kind: "dot" }]);
    expect(a.effects).toHaveLength(1);
    expect(b.effects).toHaveLength(1);
    expect(s.player.hp).toBeLessThan(hp);
    s.monsters.tick(100);
    expect(a.hits).toHaveLength(2);
    expect(a.effects).toHaveLength(1);
    s.monsters.unregisterCombatTarget(a.port.id);
    s.monsters.tick(100);
    expect(a.hits).toHaveLength(2);
  });
  it("shares a single attack multiplier across genuine area contacts", () => {
    const { s } = fixture(),
      a = actor(s, "protected-a", 1000, 1000),
      b = actor(s, "protected-b", 1010, 1000);
    const e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: 1100, y: 1000 });
    // Controlled preparation fixture, resolved by the actual production AI, not a second engine.
    const skill = {
      id: "fixture-burst",
      name: "Fixture",
      mode: "burst" as const,
      cd: 5000,
      range: 200,
      dmg: 1,
      radius: 100,
    };
    e.m.def = { ...e.m.def, atk: 20, basic: "none", skills: [skill] };
    e.m.phase = "engage";
    e.m.engaged = true;
    e.m.nextAttack = 0.5;
    e.m.cast = { skill, at: { x: 1000, y: 1000 }, ms: 0, opener: false };
    s.monsters.tick(50);
    expect(a.hits).toEqual([{ raw: 30, kind: "area" }]);
    expect(b.hits).toEqual([{ raw: 30, kind: "area" }]);
    expect(e.m.nextAttack).toBe(0);
    expect(new Set(s.events.filter((x) => x.type === "attack").map((x) => x.target))).toEqual(
      new Set(["player", a.port.id, b.port.id]),
    );
  });
  it("invalid or dead targets cannot receive hits, and actors remain protected by obstacles", () => {
    const { s, tick } = fixture(true),
      a = actor(s),
      e = s.monsters.spawn("nexus-pelzacz-serwisowy", { x: 1155, y: 1000 });
    s.monsters.setCombatTarget(e, a.port.id);
    tick(1000);
    expect(a.hits).toHaveLength(0);
    a.valid = false;
    tick(5000);
    expect(a.hits).toHaveLength(0);
    a.valid = true;
    a.body.dead = true;
    a.body.hp = 0;
    tick(2000);
    expect(a.hits).toHaveLength(0);
    s.monsters.cancelCombat();
    expect(s.monsters.setCombatTarget(e, a.port.id)).toBe(false);
  });
});
