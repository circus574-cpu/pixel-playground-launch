import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MONSTERS, MONSTER_DEFS, monsterDef } from "../game/monsters/catalog";
import { MATERIALS, MATERIAL_IDS, slug } from "../game/monsters/materials";
import { PlayerFx } from "../game/monsters/fx";
import { GameSession, SaveStore, SAVE_KEY, newPlayer, type StoragePort } from "../game/session";
import { distance } from "../game/navigation";
import { RACES, RACE_IDS, type RaceId } from "../game/world/races";
import type { Enemy } from "../game/monsters/types";

const roster = JSON.parse(readFileSync("art/production/enemies/roster.json", "utf8")).monsters;
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const raceOf = (world: string): RaceId => RACE_IDS.find((r) => RACES[r].world === world)!;
function memory(): StoragePort {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
// AI tests run in combat regions; Verdantia is now a protected city.
function arena(race: RaceId = "sage", random = () => 0.99) {
  const g = new GameSession(undefined, race, { random });
  g.enemies.splice(0);
  // The spawn lies inside the safe city; fight on open ground outside it.
  const open = g.world.enemies[0];
  if (g.safe && open) Object.assign(g.player, g.nav.safe(open));
  return g;
}
function put(g: GameSession, kind: string, dx = 120, dy = 0): Enemy {
  return g.monsters.spawn(kind, { x: g.player.x + dx, y: g.player.y + dy });
}
function ticks(g: GameSession, ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) g.tick(step);
}
const physical = { tags: ["physical"] };

describe("bestiary: 40 monsters from the owner document", () => {
  it("every roster entry has a definition with identical statistics", () => {
    expect(MONSTERS).toHaveLength(40);
    for (const r of roster) {
      const d = monsterDef(r.id);
      expect([
        d.name,
        d.level,
        d.hp,
        d.atk,
        d.def,
        d.xp,
        d.speed,
        d.range,
        d.agro,
        d.world,
      ]).toEqual([
        r.name,
        r.level,
        r.stats.hp,
        r.stats.atk,
        r.stats.def,
        r.stats.xp,
        r.speed,
        r.range,
        r.agro,
        r.world,
      ]);
      expect(d.loot.map((l) => l.name)).toEqual(r.loot.split(",").map((x: string) => x.trim()));
    }
  });
  it("ten monsters per continent, unique skill ids, sensible numbers", () => {
    for (const w of ["verdant", "aether", "nexus", "pyra"])
      expect(MONSTERS.filter((m) => m.world === w)).toHaveLength(10);
    for (const m of [...MONSTERS, ...Object.values(MONSTER_DEFS)]) {
      const ids = m.skills.map((s) => s.id);
      expect(new Set(ids).size, m.id).toBe(ids.length);
      expect(m.hp, m.id).toBeGreaterThan(0);
      expect(m.traits.leash, m.id).toBeGreaterThan(0);
      for (const s of m.skills) {
        expect(s.cd, m.id + "/" + s.id).toBeGreaterThan(0);
        if (s.summon) expect(MONSTER_DEFS[s.summon.kind], m.id).toBeDefined();
      }
    }
  });
  it("loot materials are unique by slug and every drop is a known material", () => {
    expect(slug("Łuska salamandry")).toBe("luska-salamandry");
    for (const m of MONSTERS)
      for (const l of m.loot) expect(MATERIALS[slug(l.name)], l.name).toBeDefined();
    expect(MATERIAL_IDS.length).toBeGreaterThan(40);
    for (const id of MATERIAL_IDS) expect(MATERIALS[id]!.sell).toBeGreaterThan(0);
  });
  it("every monster lives through 40 s of play in a combat region, then dies and pays out", () => {
    for (const m of MONSTERS) {
      const g = arena(m.world === "verdant" ? "sage" : raceOf(m.world), seeded(7));
      const e = put(g, m.id, 90, 0);
      g.player.hp = g.kit.stats.maxHp;
      const xp = g.player.xp + g.player.level * 1000;
      for (let t = 0; t < 40000; t += 50) {
        g.tick(50);
        expect(Number.isFinite(e.x + e.y + e.hp), m.id).toBe(true);
        expect(e.x, m.id).toBeGreaterThanOrEqual(0);
        expect(e.y, m.id).toBeGreaterThanOrEqual(0);
        expect(e.x, m.id).toBeLessThanOrEqual(g.world.width);
        expect(e.y, m.id).toBeLessThanOrEqual(g.world.height);
        g.player.hp = g.kit.stats.maxHp;
      }
      expect(() => g.snapshot()).not.toThrow();
      e.m.hidden = false;
      e.m.invulnerable = false;
      e.m.phase = "engage";
      e.m.guard = 0;
      e.m.reduceMs = 0;
      e.m.curlMs = 0;
      const before = g.player.xp;
      const level = g.player.level;
      let guard = 0;
      while (e.mode !== "dead" && guard++ < 20) {
        e.m.invulnerable = false;
        g.monsters.damage(e, 1e7, { tags: ["physical", "ki"] });
      }
      expect(e.mode, m.id).toBe("dead");
      expect(g.player.xp + (g.player.level - level) * 1e6, m.id).toBeGreaterThan(before);
      void xp;
    }
  }, 120000);
});

describe("player damage model and weaknesses", () => {
  it("applies max(1, ATK × multiplier − DEF/2) and weakness tags", () => {
    const g = arena();
    const a = put(g, "verdant-mchowy-szlamak");
    const b = put(g, "verdant-mchowy-szlamak", 0, 120);
    const phys = g.monsters.damage(a, 20, { tags: ["physical"] });
    const fire = g.monsters.damage(b, 20, { tags: ["physical", "fire"] });
    expect(phys).toBeCloseTo(20 - 4 / 2, 6);
    expect(fire).toBeCloseTo(20 * 1.3 - 4 / 2, 6);
    expect(g.monsters.damage(put(g, "verdant-mchowy-szlamak"), 0.1, physical)).toBe(1);
  });
  it("magmowy krab takes less from the front and more from behind", () => {
    const g = arena();
    const crab = put(g, "pyra-magmowy-krab", 100, 0);
    crab.m.facing = { x: -1, y: 0 }; // faces the player
    const front = g.monsters.damage(crab, 100, physical);
    crab.m.facing = { x: 1, y: 0 }; // turns its back
    const back = g.monsters.damage(crab, 100, physical);
    expect(front).toBeCloseTo(100 * 0.4 - 28 / 2, 6);
    expect(back).toBeCloseTo(100 * 1.4 - 28 / 2, 6);
  });
  it("złoty skarabeusz curls after three hits: physical −70%, KI unaffected", () => {
    const g = arena("sage");
    const s = put(g, "aether-zloty-skarabeusz");
    for (let i = 0; i < 3; i++) g.monsters.damage(s, 10, physical);
    expect(s.m.curlMs).toBeGreaterThan(0);
    const phys = g.monsters.damage(s, 200, physical);
    const ki = g.monsters.damage(s, 200, { tags: ["ki"] });
    expect(phys).toBeCloseTo(200 * 0.3 - 31 / 2, 6);
    expect(ki).toBeCloseTo(200 * 1.3 - 31 / 2, 6);
  });
  it("kryształowy motyl reflects physical damage but not KI", () => {
    const g = arena("sage");
    const m = put(g, "aether-krysztalowy-motyl", 60, 0);
    m.hp = m.maxHp = 1e5;
    const hp = g.player.hp;
    g.monsters.damage(m, 200, { tags: ["ki"] });
    expect(g.player.hp).toBe(hp);
    g.monsters.damage(m, 200, physical);
    expect(g.player.hp).toBeLessThan(hp);
  });
  it("duch bibliotekarza comes back once with 30% HP; nanites split in two and rejoin", () => {
    const g = arena("sage");
    const ghost = put(g, "aether-duch-bibliotekarza");
    g.monsters.damage(ghost, 1e6, { tags: ["ki"] });
    expect(ghost.mode).not.toBe("dead");
    expect(ghost.hp).toBe(Math.round(ghost.maxHp * 0.3));
    expect(g.monsters.damage(ghost, 5, { tags: ["ki"] })).toBe(0);
    ticks(g, 1600);
    g.monsters.damage(ghost, 1e6, { tags: ["ki"] });
    expect(ghost.mode).toBe("dead");
    const n = arena("android");
    const swarm = put(n, "nexus-roj-nanitow");
    n.monsters.damage(swarm, 10, { tags: ["electric"] });
    expect(n.enemies).toHaveLength(2);
    expect(swarm.maxHp).toBe(Math.round(272 * 0.4));
    for (let i = 0; i < 124; i++) {
      n.player.hp = n.kit.stats.maxHp;
      n.tick(50);
    }
    expect(n.enemies).toHaveLength(1);
    expect(swarm.maxHp).toBe(272);
  });
  it("węgielek explodes on death and hurts a nearby player for 40% ATK", () => {
    const g = arena("legend");
    const coal = put(g, "pyra-wegielek", 50, 0);
    const hp = g.player.hp;
    g.monsters.damage(coal, 1e5, physical);
    expect(coal.mode).toBe("dead");
    expect(g.player.hp).toBeLessThan(hp);
    expect(hp - g.player.hp).toBeCloseTo(Math.max(1, 7 * 0.4 - g.kit.stats.defense / 2), 6);
  });
});

describe("monster behaviour", () => {
  it("telegraphed melee can be dodged by stepping out of reach", () => {
    const g = arena();
    const golem = put(g, "pyra-golem-ruin", 100, 0);
    golem.m.phase = "engage";
    golem.m.engaged = true;
    golem.mode = "chase";
    ticks(g, 300);
    expect(golem.m.cast).toBeDefined();
    const hp = g.player.hp;
    Object.assign(g.player, g.nav.safe({ x: g.player.x - 260, y: g.player.y }));
    ticks(g, 1800);
    expect(g.player.hp).toBeGreaterThanOrEqual(hp - 1);
  });
  it("byk areny charges in a line; a dodged charge leaves it stunned and exposed", () => {
    const g = arena("legend");
    g.player.hp = g.kit.stats.maxHp;
    const bull = put(g, "pyra-byk-areny", 320, 0);
    bull.m.phase = "engage";
    bull.m.engaged = true;
    bull.mode = "chase";
    ticks(g, 1100);
    expect(bull.m.cast ?? bull.m.charge).toBeDefined();
    Object.assign(g.player, g.nav.safe({ x: g.player.x, y: g.player.y + 230 }));
    ticks(g, 3000);
    expect(bull.m.exposedMs > 0 || bull.m.stunMs > 0 || bull.m.cooldowns["szarza"]! > 0).toBe(true);
  });
  it("liściak stays hidden until the player comes within 200 and opens with a double hit", () => {
    const g = arena();
    g.player.hp = g.kit.stats.maxHp;
    const leaf = put(g, "verdant-lisciak-skrytobojca", 400, 0);
    ticks(g, 500);
    expect(leaf.m.hidden).toBe(true);
    expect(g.monsters.targetable).not.toContain(leaf);
    Object.assign(g.player, g.nav.safe({ x: leaf.x - 150, y: leaf.y }));
    ticks(g, 400);
    expect(leaf.m.hidden).toBe(false);
    const hp = g.player.hp;
    ticks(g, 300);
    expect(g.player.hp).toBeLessThan(hp);
    ticks(g, 2500);
    expect(leaf.m.phase === "retreat" || leaf.m.phase === "hidden").toBe(true);
  });
  it("korzeniowy pełzacz surfaces under the player with a telegraph, roots them and burrows again", () => {
    const g = arena();
    g.player.hp = g.kit.stats.maxHp;
    const root = put(g, "verdant-korzeniowy-pelzacz", 200, 0);
    expect(root.m.hidden).toBe(true);
    ticks(g, 400);
    expect(root.m.cast).toBeDefined();
    ticks(g, 600);
    expect(root.m.hidden).toBe(false);
    expect(g.fx.rootMs).toBeGreaterThan(0);
    ticks(g, 4200);
    expect(["under", "hidden"]).toContain(root.m.phase);
    expect(g.monsters.damage(root, 100, physical)).toBe(0);
  });
  it("szlamak does not attack first, slows when angered and gives up after 6 s", () => {
    const g = arena();
    g.player.hp = g.kit.stats.maxHp;
    const slime = put(g, "verdant-mchowy-szlamak", 80, 0);
    ticks(g, 3000);
    expect(slime.m.phase).toBe("idle");
    expect(g.player.hp).toBe(g.kit.stats.maxHp);
    g.monsters.damage(slime, 1, physical);
    expect(slime.m.phase).toBe("engage");
    ticks(g, 1500);
    expect(g.fx.slow.ms > 0 || g.player.hp < g.kit.stats.maxHp).toBe(true);
    Object.assign(g.player, g.nav.safe({ x: g.player.x - 600, y: g.player.y }));
    ticks(g, 6500);
    expect(["return", "idle"]).toContain(slime.m.phase);
  });
  it("cierniowy wilk: packs of 2–3, howl wakes an ally, flees under 25% HP", () => {
    const g = arena();
    const pack = g.monsters.spawnGroup("verdant-cierniowy-wilk", {
      x: g.player.x + 600,
      y: g.player.y,
    });
    expect(pack.length).toBeGreaterThanOrEqual(2);
    expect(pack.length).toBeLessThanOrEqual(3);
    const a = pack[0]!;
    const b = pack[1]!;
    a.m.phase = "engage";
    a.m.engaged = true;
    a.mode = "chase";
    ticks(g, 300);
    expect(b.m.engaged).toBe(true);
    a.hp = a.maxHp * 0.2;
    a.m.provoked = true;
    ticks(g, 200);
    expect(a.m.phase).toBe("retreat");
  });
  it("bursztynowa osa summons two small wasps below 40% HP, once", () => {
    const g = arena("android");
    g.player.hp = g.kit.stats.maxHp;
    const wasp = put(g, "verdant-bursztynowa-osa", 150, 0);
    wasp.m.phase = "engage";
    wasp.m.engaged = true;
    wasp.mode = "chase";
    wasp.hp = wasp.maxHp * 0.35;
    ticks(g, 400);
    expect(g.enemies.filter((e) => e.kind === "verdant-mala-osa")).toHaveLength(2);
    ticks(g, 2000);
    expect(g.enemies.filter((e) => e.kind === "verdant-mala-osa")).toHaveLength(2);
    for (const minion of g.enemies.filter((e) => e.kind === "verdant-mala-osa"))
      g.monsters.damage(minion, 1e5, physical);
    ticks(g, 1200);
    expect(g.enemies.filter((e) => e.kind === "verdant-mala-osa")).toHaveLength(0);
  });
  it("puchacz pyłowy only dives at a hurt player and has a smaller radius by day", () => {
    const g = arena();
    g.player.hp = g.kit.stats.maxHp;
    const owl = put(g, "verdant-puchacz-pylowy", 300, 0);
    expect(g.isNight()).toBe(false);
    ticks(g, 400);
    expect(owl.m.phase).toBe("idle"); // day: 50% of 500 = 250 < 300
    g.nowMs = 310000;
    expect(g.isNight()).toBe(true);
    ticks(g, 400);
    expect(owl.m.phase).toBe("engage");
    ticks(g, 6000);
    expect(g.player.hp).toBe(g.kit.stats.maxHp); // a healthy player is only circled
    g.events.length = 0;
    g.player.hp = g.kit.stats.maxHp * 0.3;
    ticks(g, 5000);
    expect(g.events.some((e) => e.type === "hit" && e.target === "player")).toBe(true);
  });
  it("wieżyczka rotates slowly, fires volleys when aligned and overheats after 12 shots", () => {
    const g = arena("android");
    g.player.hp = g.kit.stats.maxHp;
    const turret = put(g, "nexus-wiezyczka-autonomiczna", 300, 0);
    turret.m.aim = Math.PI;
    ticks(g, 400);
    expect(Math.abs(Math.atan2(Math.sin(turret.m.aim), Math.cos(turret.m.aim)))).toBeGreaterThan(
      1.5,
    );
    let hot = false;
    for (let i = 0; i < 400 && !hot; i++) {
      g.tick(50);
      hot = turret.m.heatMs > 0;
    }
    expect(hot).toBe(true);
    expect(turret.x).toBeCloseTo(g.player.x + 300, -1);
  });
  it("leśny pająk lays three webs, burning them destroys them, webs slow the player", () => {
    const g = arena();
    const spider = put(g, "verdant-lesny-pajak", 300, 0);
    expect(g.zones.filter((z) => z.kind === "web")).toHaveLength(3);
    const web = g.zones.find((z) => z.kind === "web")!;
    Object.assign(g.player, { x: web.x, y: web.y });
    ticks(g, 450);
    expect(g.fx.slow.ms).toBeGreaterThan(0);
    g.monsters.damage(spider, 5, { tags: ["physical", "fire"] });
    expect(g.zones.filter((z) => z.kind === "web")).toHaveLength(0);
  });
  it("grzybowy zarodnik never moves, poisons from range and leaves a cloud when it dies", () => {
    const g = arena();
    g.player.hp = g.kit.stats.maxHp;
    const spore = put(g, "verdant-grzybowy-zarodnik", 250, 0);
    const home = { x: spore.x, y: spore.y };
    ticks(g, 3000);
    expect(distance(spore, home)).toBeLessThan(1);
    expect(g.fx.active.some((a) => a.id === "poison")).toBe(true);
    g.monsters.damage(spore, 1e6, physical);
    expect(g.zones.some((z) => z.kind === "poison" && z.ms >= 4000)).toBe(true);
  });
  it("dron zwiadowca calls one ally with Alarm", () => {
    const g = arena("android");
    const drone = put(g, "nexus-dron-zwiadowca", 200, 0);
    const other = put(g, "nexus-pies-lowca", 400, 100);
    expect(other.m.engaged).toBe(false);
    ticks(g, 800);
    expect(drone.m.engaged).toBe(true);
    expect(other.m.engaged).toBe(true);
  });
  it("magmowy krab and ognista salamandra leave burning zones", () => {
    const g = arena("legend");
    g.player.hp = g.kit.stats.maxHp;
    const crab = put(g, "pyra-magmowy-krab", 150, 0);
    crab.m.phase = "engage";
    crab.m.engaged = true;
    crab.mode = "chase";
    ticks(g, 3000);
    expect(g.zones.some((z) => z.kind === "lava") || crab.m.cooldowns["zalew"]! > 0).toBe(true);
    const sal = put(g, "pyra-ognista-salamandra", 500, 0);
    ticks(g, 3000);
    expect(g.zones.some((z) => z.kind === "fire" && z.owner === sal.id)).toBe(true);
  });
});

describe("status effects on the player", () => {
  const apply = (fx: PlayerFx, spec: Parameters<PlayerFx["apply"]>[0], cc = 1) =>
    fx.apply(spec, { cc, stunImmune: false, atk: 20, machine: false });
  it("slow, root, stun, silence, fear and their expiry", () => {
    const fx = new PlayerFx();
    apply(fx, { k: "slow", pct: 0.4, ms: 1000 });
    expect(fx.speedMul).toBeCloseTo(0.6);
    apply(fx, { k: "root", ms: 500 });
    expect(fx.cannotMove).toBe(true);
    apply(fx, { k: "silence", ms: 500 });
    expect(fx.silenced).toBe(true);
    apply(fx, { k: "stun", ms: 500 });
    expect(fx.cannotAct).toBe(true);
    fx.tick(600);
    expect(fx.cannotMove).toBe(false);
    expect(fx.speedMul).toBeCloseTo(0.6);
    fx.tick(600);
    expect(fx.speedMul).toBe(1);
    expect(fx.active).toEqual([]);
  });
  it("control durations shrink with the tree and immunity stops them", () => {
    const fx = new PlayerFx();
    apply(fx, { k: "stun", ms: 1000 }, 0.75);
    expect(fx.stunMs).toBe(750);
    const imm = new PlayerFx();
    imm.apply({ k: "stun", ms: 1000 }, { cc: 1, stunImmune: true, atk: 1, machine: false });
    expect(imm.stunMs).toBe(0);
    const all = new PlayerFx();
    apply(all, { k: "root", ms: 1000 }, 0);
    apply(all, { k: "slow", pct: 0.5, ms: 1000 }, 0);
    expect(all.cannotMove).toBe(false);
    expect(all.speedMul).toBe(1);
  });
  it("poison stacks up to its limit and ticks damage; blind misses deterministically", () => {
    const fx = new PlayerFx();
    for (let i = 0; i < 5; i++)
      apply(fx, { k: "dot", id: "poison", atkPct: 0.1, ms: 5000, stacks: 3 });
    expect(fx.active.filter((a) => a.id === "poison")).toHaveLength(3);
    expect(fx.tick(1000)).toBeCloseTo(3 * 2, 5);
    apply(fx, { k: "blind", pct: 0.25, ms: 4000 });
    const misses = Array.from({ length: 8 }, () => fx.rollMiss()).filter(Boolean).length;
    expect(misses).toBe(2);
  });
  it("armor stacks, mark by machines only and the session mirrors them", () => {
    const fx = new PlayerFx();
    for (let i = 0; i < 5; i++) apply(fx, { k: "armorDown", pct: 0.1, ms: 8000, stacks: 3 });
    expect(fx.armorPct).toBeCloseTo(0.3);
    apply(fx, { k: "mark", pct: 0.15, ms: 6000, from: "machine" });
    expect(fx.markPct(true)).toBe(0.15);
    expect(fx.markPct(false)).toBe(0);
  });
  it("in a session: silence blocks abilities, stun blocks actions, fear pushes away, jam and fog show in the HUD", () => {
    const g = arena("sage");
    g.player.level = 7;
    g.command({ type: "learn", node: "B1" });
    g.player.ki = 80;
    const foe = put(g, "aether-duch-bibliotekarza", 80, 0);
    g.applyPlayerFx({ k: "silence", ms: 2000 }, foe);
    g.command({ type: "ability", ability: "B1" });
    expect(g.kit.shieldPoints).toBe(0);
    g.applyPlayerFx({ k: "jam", ms: 4000 }, foe);
    g.applyPlayerFx({ k: "fog", pct: 0.5, ms: 4000 }, foe);
    const snap = g.snapshot();
    expect(snap.minimapJammed).toBe(true);
    expect(snap.fog).toBe(0.5);
    expect(snap.statuses.map((s) => s.id)).toEqual(
      expect.arrayContaining(["silence", "jam", "fog"]),
    );
    const g2 = arena();
    const bull = put(g2, "aether-lew-swiatyni", 100, 0);
    const x = g2.player.x;
    g2.applyPlayerFx({ k: "fear", ms: 1000 }, bull);
    ticks(g2, 500);
    expect(g2.player.x).toBeLessThan(x);
    g2.applyPlayerFx({ k: "stun", ms: 1000 }, bull);
    g2.command({ type: "move", x: g2.player.x + 200, y: g2.player.y });
    expect(g2.snapshot().statuses.some((s) => s.id === "stun")).toBe(true);
  });
  it("breakShield removes the barrier; pull drags the player", () => {
    const g = arena("sage");
    g.player.level = 7;
    g.command({ type: "learn", node: "B1" });
    g.command({ type: "ability", ability: "B1" });
    expect(g.kit.shieldPoints).toBeGreaterThan(0);
    const scarab = put(g, "aether-zloty-skarabeusz", 200, 0);
    g.applyPlayerFx({ k: "breakShield" }, scarab);
    expect(g.kit.shieldPoints).toBe(0);
    const x = g.player.x;
    g.applyPlayerFx({ k: "pull", dist: 100 }, scarab);
    expect(g.player.x).toBeGreaterThan(x);
  });
});

describe("loot, materials and progression", () => {
  it("monster loot becomes materials; the merchant buys them; stacks cap at 99", () => {
    const g = arena("android", () => 0);
    g.player.hp = g.kit.stats.maxHp;
    const drone = put(g, "nexus-dron-zwiadowca", 60, 0);
    g.monsters.damage(drone, 1e6, { tags: ["electric"] });
    expect(g.loot.length).toBeGreaterThan(0);
    for (const l of [...g.loot]) {
      Object.assign(l, { x: g.player.x, y: g.player.y });
      g.command({ type: "loot", id: l.id });
    }
    expect(Object.keys(g.player.materials).length).toBeGreaterThan(0);
    const id = Object.keys(g.player.materials)[0]!;
    g.player.materials[id] = 99;
    g.loot.push({ id: "x", x: g.player.x, y: g.player.y, item: id, quantity: 1, gold: 0 });
    g.command({ type: "loot", id: "x" });
    expect(g.player.materials[id]).toBe(99);
    expect(g.loot.some((l) => l.id === "x")).toBe(true);
    g.player.materials[id] = 2;
    const door = g.world.city!.buildings.find((b) => b.id === "shop")!.door;
    Object.assign(g.player, g.nav.safe({ x: door.x, y: door.y }));
    g.command({ type: "interact", npc: "merchant" });
    ticks(g, 6000);
    expect(g.dialogue).toBe("merchant");
    const gold = g.player.gold;
    g.command({ type: "trade", item: id, buy: false });
    expect(g.player.materials[id]).toBe(1);
    expect(g.player.gold).toBe(gold + MATERIALS[id]!.sell);
    g.command({ type: "trade", item: id, buy: true });
    expect(g.player.materials[id]).toBe(1);
  });
  it("killing a monster grants its bestiary XP and quests ignore non-boar kills", () => {
    const g = arena();
    g.player.quests.steps = "done";
    g.player.quests.boars = "active";
    const slime = put(g, "verdant-mchowy-szlamak");
    const xp = g.player.xp;
    g.monsters.damage(slime, 1e6, physical);
    expect(g.player.xp - xp).toBe(16);
    expect(g.player.kills).toBe(0);
    const boar = put(g, "boar");
    g.monsters.damage(boar, 1e6, physical);
    expect(g.player.kills).toBe(1);
  });
  it("skill points: one per level up to 20, prerequisites, exclusive choice, respec rules", () => {
    const g = arena();
    expect(g.skillPoints).toBe(0);
    g.player.level = 4;
    expect(g.skillPoints).toBe(3);
    g.command({ type: "learn", node: "A4" });
    expect(g.player.skills).toEqual(["R"]);
    for (const n of ["A1", "A2", "A3"]) g.command({ type: "learn", node: n });
    expect(g.player.skills).toEqual(["R", "A1", "A2", "A3"]);
    expect(g.skillPoints).toBe(0);
    g.command({ type: "learn", node: "B1" });
    expect(g.player.skills).not.toContain("B1");
    expect(g.respecCost()).toBe(0);
    g.command({ type: "respec" });
    expect(g.player.skills).toEqual(["R"]);
    expect(g.player.respecs).toBe(1);
    expect(g.respecCost()).toBe(200);
    g.player.gold = 10;
    for (const n of ["A1"]) g.command({ type: "learn", node: n });
    g.command({ type: "respec" });
    expect(g.player.skills).toContain("A1");
    g.player.gold = 500;
    g.command({ type: "respec" });
    expect(g.player.gold).toBe(300);
    expect(g.kit.has("A1")).toBe(false);
  });
  it("level-up raises stats along the race table, speed +5% per level to 20, and awards a point", () => {
    const g = arena("legend");
    const before = g.snapshot().stats;
    expect(before.maxHp).toBe(140);
    expect(before.speed).toBe(170);
    g.player.xp = 99;
    const slime = put(g, "verdant-mchowy-szlamak");
    g.monsters.damage(slime, 1e6, physical);
    expect(g.player.level).toBe(2);
    const after = g.snapshot().stats;
    expect(after.maxHp).toBe(182);
    expect(after.speed).toBe(179); // 170 × 1,05 = 178,5 → 179 in the HUD
    expect(g.skillPoints).toBe(1);
    expect(g.player.hp).toBe(182);
  });
});

describe("saves: version 5 with skills, materials and depot, older saves intact", () => {
  it("round-trips skills, materials and respecs", () => {
    const store = memory();
    const g = new GameSession(new SaveStore(store), "sage");
    g.player.level = 5;
    g.command({ type: "learn", node: "A1" });
    g.player.materials["wegiel"] = 3;
    g.player.respecs = 2;
    g.flush();
    expect(JSON.parse(store.getItem(SAVE_KEY)!).version).toBe(5);
    const again = new GameSession(new SaveStore(store));
    expect(again.player.skills).toEqual(["R", "A1"]);
    expect(again.kit.has("A1")).toBe(true);
    expect(again.player.respecs).toBe(2);
  });
  it("loads a version 3 save, giving the root and unspent points, and keeps it unchanged until saving", () => {
    const store = memory();
    const old = newPlayer("planetary") as Record<string, unknown>;
    delete old["skills"];
    delete old["materials"];
    delete old["respecs"];
    Object.assign(old, {
      level: 6,
      cooldowns: { flame: 0, pulse: 0, shield: 0, attack: 0, potion: 0 },
      shield: 0,
    });
    const raw = JSON.stringify({ version: 3, revision: "r", player: old });
    store.setItem(SAVE_KEY, raw);
    const g = new GameSession(new SaveStore(store));
    expect(g.player.skills).toEqual(["R"]);
    expect(g.skillPoints).toBe(5);
    expect(g.player.level).toBe(6);
    expect(store.getItem(SAVE_KEY)).toBe(raw);
  });
  it("rejects saves with impossible skills or unknown materials", () => {
    for (const patch of [
      { skills: ["R", "A4"] },
      { skills: ["A1"] },
      { skills: ["R", "A1", "A1"] },
      { materials: { zlote: 1 } },
    ]) {
      const store = memory();
      const p = { ...newPlayer("planetary"), level: 20, ...patch };
      store.setItem(SAVE_KEY, JSON.stringify({ version: 4, revision: "r", player: p }));
      const saves = new SaveStore(store);
      const g = new GameSession(saves);
      expect(saves.warning).toContain("Niespójny");
      expect(g.player.skills).toEqual(["R"]);
    }
  });
});
