import { describe, it, expect } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { WORLDS } from "../game/world/worlds";
import type { RaceId } from "../game/world/races";
import { combatTarget } from "../game/combat/targeting";
import { Projectiles, segmentContact } from "../game/combat/projectiles";
import type { Obstacle } from "../game/movement";
function arena(race: RaceId = "planetary", obstacles: Obstacle[] = []) {
  const world = {
    ...WORLDS.verdant,
    width: 2000,
    height: 2000,
    spawn: { x: 800, y: 800 },
    enemies: [],
    monsters: [],
    objects: [],
    npcs: [],
    obstacles,
    safeAreas: [],
  };
  delete world.city;
  delete world.terrain;
  return new GameSession(undefined, race, {
    world,
    navigation: new Navigation(2000, 2000, obstacles),
    random: () => 0.99,
  });
}
const tick = (g: GameSession, ms: number, step = 20) => {
  for (let t = 0; t < ms; t += step) g.tick(Math.min(step, ms - t));
};
const foe = (g: GameSession, x = 850, y = 800) => g.monsters.spawn("boar", { x, y });
const attack = (g: GameSession) => g.command({ type: "ability", ability: "R" });
describe("V3 targeting", () => {
  const p = { x: 0, y: 0 },
    f = { x: 1, y: 0 };
  const enemy = (id: string, x: number, y = 0) => ({ id, x, y, hp: 100, maxHp: 100 });
  it("falls back from unreachable, dead or occluded selections to a valid forward target", () => {
    const near = enemy("near", 40),
      far = enemy("far", 100),
      dead = { ...near, id: "dead", hp: 0 };
    for (const selected of [far, dead])
      expect(combatTarget(p, f, 78, selected, [near, far, dead], () => true)).toBe(near);
    expect(combatTarget(p, f, 78, near, [near, enemy("clear", 50)], (_, b) => b !== near)?.id).toBe(
      "clear",
    );
  });
  it("retains explicit valid target; never automatically acquires behind or beyond exact range", () => {
    const chosen = enemy("chosen", 70),
      closer = enemy("closer", 20);
    expect(combatTarget(p, f, 78, chosen, [closer, chosen], () => true)).toBe(chosen);
    expect(
      combatTarget(p, f, 78, undefined, [enemy("behind", -20), enemy("far", 78.01)], () => true),
    ).toBeUndefined();
  });
  it("ties resolve identically independent of array ordering", () => {
    const a = enemy("a", 40),
      b = enemy("b", 40);
    expect(combatTarget(p, f, 78, undefined, [b, a], () => true)).toBe(a);
    expect(combatTarget(p, f, 78, undefined, [a, b], () => true)).toBe(a);
  });
});
describe("V3 bounded input and lifecycle", () => {
  it("queues only one near-ready attack; does not add hits or shorten cooldown", () => {
    const g = arena(),
      e = foe(g);
    g.targetId = e.id;
    attack(g);
    const hp = e.hp;
    tick(g, 500);
    for (let i = 0; i < 50; i++) attack(g);
    expect(e.hp).toBe(hp);
    tick(g, 149);
    expect(e.hp).toBe(hp);
    tick(g, 1);
    expect(e.hp).toBe(hp - 12); // 12 ATK, boar DEF0
    const once = e.hp;
    tick(g, 500);
    expect(e.hp).toBe(once);
  });
  it("early presses do not become late automatic attacks", () => {
    const g = arena(),
      e = foe(g);
    g.targetId = e.id;
    attack(g);
    const hp = e.hp;
    tick(g, 100);
    attack(g);
    tick(g, 700);
    expect(e.hp).toBe(hp);
  });
  it("out-of-range basic never starts movement or autoattack", () => {
    const g = arena(),
      e = foe(g, 1100);
    g.targetId = e.id;
    attack(g);
    expect(g.autoAttack).toBe(false);
    expect(g.route).toHaveLength(0);
    expect(g.player.x).toBe(800);
    expect(e.hp).toBe(e.maxHp);
  });
  it("movement and attack preserve speed, costs and position continuity", () => {
    const g = arena(),
      e = foe(g);
    g.targetId = e.id;
    const x = g.player.x;
    g.manual(0, 1, 20);
    attack(g);
    g.manual(0, 1, 20);
    expect(g.player.x).toBe(x);
    expect(g.player.y).toBeCloseTo(800 + g.kit.stats.speed * 0.04);
    expect(g.player.ki).toBe(50);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
  it("pause discards queued input instead of attacking on resume", () => {
    const g = arena(),
      e = foe(g);
    g.targetId = e.id;
    attack(g);
    tick(g, 500);
    attack(g);
    g.paused = true;
    g.tick(20);
    g.paused = false;
    const hp = e.hp;
    tick(g, 200);
    expect(e.hp).toBe(hp);
  });
  it("death cancels channels/timers, pending input and future healing after respawn", () => {
    const g = arena(),
      e = foe(g);
    g.player.level = 20;
    g.kit.learn("C1");
    g.player.hp = 50;
    g.command({ type: "ability", ability: "C1" });
    g.hurtPlayer(1e6, e, "melee");
    expect(g.player.dead).toBe(true);
    tick(g, 3000);
    expect(g.player.dead).toBe(false);
    g.player.hp = 50;
    tick(g, 1000);
    expect(g.player.hp).toBeLessThan(53);
  });
  it("skill cooldown and KI survive cancellation", () => {
    const g = arena();
    g.player.level = 3;
    g.kit.learn("B1");
    g.command({ type: "ability", ability: "B1" });
    const ki = g.player.ki,
      cd = g.kit.remaining("B1");
    g.kit.cancelActions();
    g.command({ type: "ability", ability: "B1" });
    expect(g.player.ki).toBe(ki);
    expect(g.kit.remaining("B1")).toBe(cd);
  });
});
describe("V3 swept projectiles", () => {
  it("detects crossing, tangent, miss and zero-length overlap", () => {
    expect(segmentContact({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBeCloseTo(0.4);
    expect(segmentContact({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 10 }, 10)).toBeCloseTo(0.5);
    expect(segmentContact({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 11 }, 10)).toBeUndefined();
    expect(segmentContact({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toBe(0);
  });
  it.each([16, 50, 100, 250])("hits exactly once with %d ms updates", (step) => {
    let hits = 0;
    const pool = new Projectiles(
      "p",
      () => true,
      () => {},
    );
    pool.launch(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      1000,
      200,
      { x: 100, y: 0 },
      () => true,
      () => hits++,
    );
    for (let t = 0; t < 1000; t += step) pool.tick(step);
    expect(hits).toBe(1);
    expect(pool.active).toHaveLength(0);
  });
  it("walls block contact, motion can evade and cancellation releases the pool", () => {
    let hits = 0;
    const target = { x: 100, y: 0 };
    const pool = new Projectiles(
      "p",
      (_, b) => b.x < 50,
      () => {},
    );
    pool.launch(
      { x: 0, y: 0 },
      target,
      1000,
      200,
      target,
      () => true,
      () => hits++,
    );
    pool.tick(150);
    expect(hits).toBe(0);
    expect(pool.active).toHaveLength(0);
    const clear = new Projectiles(
      "p",
      () => true,
      () => {},
    );
    clear.launch(
      { x: 0, y: 0 },
      target,
      1000,
      200,
      target,
      () => true,
      () => hits++,
    );
    target.y = 100;
    clear.tick(250);
    expect(hits).toBe(0);
    clear.cancel();
    expect(clear.active).toHaveLength(0);
  });
  it.each(["sage", "android"] as RaceId[])(
    "%s fires a real projectile and dead caster cannot hit",
    (race) => {
      const g = arena(race),
        e = foe(g, 1050);
      g.targetId = e.id;
      attack(g);
      expect(e.hp).toBe(e.maxHp);
      expect(g.projectiles.active).toHaveLength(1);
      tick(g, 300);
      expect(e.hp).toBeLessThan(e.maxHp);
      tick(g, 600);
      attack(g);
      const hp = e.hp;
      g.hurtPlayer(1e6, e, "melee");
      tick(g, 500);
      expect(e.hp).toBe(hp);
      expect(g.projectiles.active).toHaveLength(0);
    },
  );
});
describe("V3 enemy commitment", () => {
  it("basic wind-up is dodgeable and cannot swivel into a rear hit", () => {
    const g = arena(),
      e = foe(g);
    e.attackIn = 0;
    e.m.phase = "engage";
    e.m.provoked = true;
    g.tick(20);
    expect(e.m.basicWindup).toBeDefined();
    const hp = g.player.hp;
    Object.assign(g.player, { x: e.x + 40, y: e.y });
    tick(g, 200);
    expect(g.player.hp).toBeGreaterThanOrEqual(hp);
  });
  it("stun cancels wind-up without refunding enemy cooldown", () => {
    const g = arena(),
      e = foe(g);
    e.attackIn = 0;
    e.m.phase = "engage";
    e.m.provoked = true;
    g.tick(20);
    const cooldown = e.attackIn;
    g.monsters.stun(e, 500);
    g.tick(20);
    expect(e.m.basicWindup).toBeUndefined();
    expect(e.attackIn).toBe(cooldown - 20);
  });
  it("death awards once and cancels enemy volley", () => {
    const g = arena(),
      e = foe(g);
    g.monsters.damage(e, 1e6, { tags: ["physical"] });
    const xp = g.player.xp,
      loot = g.loot.length;
    g.monsters.damage(e, 1e6, { tags: ["physical"] });
    expect(g.player.xp).toBe(xp);
    expect(g.loot).toHaveLength(loot);
    expect(e.m.volley).toBeUndefined();
  });
  it("knockback stops at walls and map bounds", () => {
    const wall: Obstacle = { x: 900, y: 700, width: 40, height: 200 };
    const g = arena("android", [wall]),
      e = foe(g);
    g.monsters.push(e, g.player, 300);
    expect(e.x).toBeLessThan(900);
    expect(g.nav.walkable(e)).toBe(true);
    g.monsters.push(e, { x: 1000, y: 800 }, 5000);
    expect(g.nav.walkable(e)).toBe(true);
  });
});

describe("V3 geometry, groups and canonical skill lifetimes", () => {
  it("an area attack respects radius and walls without changing its damage", () => {
    const g = arena("planetary", [{ x: 880, y: 730, width: 20, height: 180 }]);
    const near = foe(g, 840),
      blocked = foe(g, 910),
      far = foe(g, 800, 940);
    g.player.level = 3;
    g.kit.learn("B1");
    g.command({ type: "ability", ability: "B1" });
    expect(near.hp).toBeCloseTo(near.maxHp - g.kit.stats.attack * 1.4);
    expect(blocked.hp).toBe(blocked.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(blocked.fx.slow.ms).toBe(0);
  });
  it("a delayed melee sequence cannot hit a foe that left its reach", () => {
    const g = arena("legend"),
      e = foe(g);
    g.targetId = e.id;
    g.player.level = 3;
    g.kit.learn("A1");
    const ki = g.player.ki;
    g.command({ type: "ability", ability: "A1" });
    e.x = 1200;
    const hp = e.hp;
    tick(g, 600);
    expect(e.hp).toBe(hp);
    expect(g.player.ki).toBeLessThan(ki - 9);
    expect(g.kit.remaining("A1")).toBe(5400);
  });
  it("nearby enemies separate gradually while staying on walkable ground", () => {
    const g = arena(),
      a = foe(g),
      b = foe(g);
    for (const e of [a, b]) {
      e.m.phase = "engage";
      e.m.engaged = true;
      e.m.provoked = true;
    }
    const start = { x: a.x, y: a.y };
    tick(g, 400);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(10);
    expect(Math.hypot(a.x - start.x, a.y - start.y)).toBeLessThan(30);
    expect(g.nav.walkable(a) && g.nav.walkable(b)).toBe(true);
  });
  it("a charge commits to the announced location instead of tracking the dodge", () => {
    const g = arena(),
      e = g.monsters.spawn("pyra-byk-areny", { x: 1000, y: 800 });
    const skill = e.m.def.skills.find((s) => s.mode === "charge")!;
    e.m.phase = "engage";
    e.m.engaged = true;
    e.m.provoked = true;
    e.m.cast = { skill, ms: 100, at: { x: 800, y: 800 }, opener: false };
    Object.assign(g.player, { x: 1000, y: 950 });
    g.tick(100);
    expect(e.m.charge).toBeDefined();
    expect(e.m.charge!.to.y).toBe(800);
    expect(e.m.charge!.to.x).toBeLessThan(e.x);
  });
  it("death clears pending hostile projectiles and casts before respawn", () => {
    const g = arena(),
      e = foe(g);
    g.monsters.projectiles.launch(
      e,
      g.player,
      700,
      200,
      g.player,
      () => true,
      () => g.hurtPlayer(10, e, "projectile"),
    );
    e.m.basicWindup = { ms: 100, aim: { x: -1, y: 0 }, extra: 1 };
    g.hurtPlayer(1e6, e, "melee");
    expect(g.monsters.projectiles.active).toHaveLength(0);
    expect(e.m.basicWindup).toBeUndefined();
    tick(g, 3100);
    expect(g.player.hp).toBe(g.kit.stats.maxHp);
  });
  it("automatic assistance retains its last valid target between commands", () => {
    const g = arena(),
      a = foe(g, 845),
      b = foe(g, 850);
    g.facing = { x: 1, y: 0 };
    attack(g);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
    tick(g, 650);
    a.x = 850;
    b.x = 845;
    attack(g);
    expect(b.hp).toBe(b.maxHp);
  });
});

describe("V3 simulation deadlines", () => {
  it.each([16, 50, 100, 250])("keeps KI and cooldown elapsed time at %i ms frames", (step) => {
    const g = arena("sage");
    g.player.ki = 0;
    g.kit.cooldowns["B1"] = 3000;
    tick(g, 1000, step);
    expect(g.nowMs).toBe(1000);
    expect(g.kit.remaining("B1")).toBe(2000);
    expect(g.player.ki).toBeCloseTo(g.kit.stats.kiRegen, 5);
  });
  it("discards pending input on focus loss without changing target or movement orders", () => {
    const g = arena(),
      e = foe(g);
    g.targetId = e.id;
    attack(g);
    tick(g, 500);
    attack(g);
    const hp = e.hp;
    g.discardBufferedInput();
    tick(g, 150);
    expect(e.hp).toBe(hp);
    expect(g.targetId).toBe(e.id);
  });
});
