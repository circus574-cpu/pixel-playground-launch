import { describe, expect, it } from "vitest";
import { createKit, type KitPort, type Hit, type Foe } from "../game/kit";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { GameSession, SaveStore, newPlayer, stats } from "../game/session";
import {
  emptyDevelopment,
  DevelopmentSchema,
  MODULE_ENERGY,
  type VariantId,
} from "../game/development/state";
import {
  DISCIPLINES,
  EXAM_IDS,
  TrainingSchema,
  examAvailable,
  examId,
  rankCost,
  rankUnavailable,
  trainingCost,
} from "../game/development/training";
import { ExamAttempt, examSpec } from "../game/development/exams";
import { MONSTER_BASE } from "../game/monsters/base.generated";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { WORLDS } from "../game/world/worlds";
import { Navigation } from "../game/navigation";
import { readFileSync } from "node:fs";

function storage() {
  const data = new Map<string, string>();
  let fail = false;
  return {
    data,
    set fail(value: boolean) {
      fail = value;
    },
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw Error("Quota");
      data.set(k, v);
    },
  };
}
function fundedPlayer(race: RaceId = "planetary") {
  const p = newPlayer(race);
  p.development = emptyDevelopment();
  for (const m of MONSTER_BASE) {
    p.development.knowledge[m.id] = 4;
    p.development.rewardReceipts[`bestiary:${m.id}:complete:v1`] = { practice: 50 };
    p.development.practiceEarned += 50;
  }
  return p;
}
function trainer(race: RaceId = "planetary") {
  const port = storage(),
    save = new SaveStore(port, "character");
  save.load();
  const p = fundedPlayer(race);
  p.interior = "arena";
  p.x = 300;
  p.y = 330;
  expect(save.save(p)).toBe(true);
  return { port, session: new GameSession(save, race) };
}
function harness(race: RaceId, variant?: VariantId) {
  const d = emptyDevelopment();
  if (variant) {
    d.unlockedVariants.push(variant);
    d.activeVariantId = variant;
  }
  const p = { x: 0, y: 0, level: 20, hp: 1, ki: 1000 };
  const foe: Foe = { id: "foe", x: 40, y: 0, hp: 100000, maxHp: 100000 };
  const state = {
    now: 0,
    heals: 0,
    ki: 0,
    seal: 0,
    mark: 0,
    stun: 0,
    radius: 0,
    raw: [] as { raw: number; hit: Hit }[],
  };
  const noop = () => {};
  const port: KitPort = {
    development: d,
    get nowMs() {
      return state.now;
    },
    player: p,
    gear: { attack: 0, defense: 0 },
    inCombat: false,
    terrain: () => "open",
    facing: { x: 1, y: 0 },
    random: () => 0.99,
    say: noop,
    foesIn: (center, radius) => {
      state.radius = radius;
      return Math.hypot(foe.x - center.x, foe.y - center.y) <= radius ? [foe] : [];
    },
    target: () => foe,
    visible: () => true,
    hurtFoe: (_f, raw, hit) => {
      state.raw.push({ raw, hit });
      return raw;
    },
    stunFoe: (_f, ms) => {
      state.stun = ms;
    },
    slowFoe: noop,
    burnFoe: noop,
    sealFoe: (_f, ms) => {
      state.seal = ms;
    },
    markFoe: (_f, ms) => {
      state.mark = ms;
    },
    pushFoe: noop,
    weakenFoe: noop,
    breakFoeShield: noop,
    isSealed: () => false,
    isMarked: () => false,
    foeHpFraction: () => 1,
    dash: (to) => Object.assign(p, to),
    emit: noop,
    heal: (n) => {
      state.heals += n;
    },
    addKi: (n) => {
      p.ki += n;
      state.ki += n;
    },
  };
  const kit = createKit(race, port, ["R", "A1", "B1", "C1"]);
  const tick = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      state.now += 50;
      kit.tick(50, false);
    }
  };
  return { d, p, foe, state, kit, tick };
}

describe("training accounting and schema", () => {
  it("has five 30-rank disciplines, 90 combined, and exact costs", () => {
    expect(DISCIPLINES).toHaveLength(5);
    expect(EXAM_IDS).toHaveLength(30);
    expect(Array.from({ length: 30 }, (_, r) => rankCost(r)).reduce((a, b) => a + b, 0)).toBe(5850);
    const d = emptyDevelopment();
    Object.assign(d.training, { strength: 30, endurance: 30, defense: 30 });
    expect(trainingCost(d.training)).toBe(17550);
    expect(TrainingSchema.safeParse(d.training).success).toBe(true);
    d.training.kiControl = 1;
    expect(TrainingSchema.safeParse(d.training).success).toBe(false);
  });
  it.each([NaN, Infinity, -1, 30, 1.5])("rejects invalid next-rank input %s", (r) =>
    expect(() => rankCost(r)).toThrow(),
  );
  it("requires exam thresholds in sequence and sufficient practice", () => {
    const d = emptyDevelopment();
    d.training.strength = 4;
    expect(examAvailable(d.training, [], "strength", 1)).toBe(true);
    expect(examAvailable(d.training, [], "strength", 2)).toBe(false);
    expect(rankUnavailable(d.training, [], 999, "strength")).toContain("egzamin");
    expect(rankUnavailable(d.training, [examId("strength", 1)], 89, "strength")).toContain(
      "praktyki",
    );
    expect(rankUnavailable(d.training, [examId("strength", 1)], 90, "strength")).toBe("");
  });
  it("rejects forged or inconsistent receipts, duplicate unlocks and future fields", () => {
    expect(DevelopmentSchema.safeParse(fundedPlayer().development).success).toBe(true);
    const d = emptyDevelopment();
    d.practiceEarned = 500;
    expect(DevelopmentSchema.safeParse(d).success).toBe(false);
    expect(DevelopmentSchema.safeParse({ ...emptyDevelopment(), version: 999 }).success).toBe(
      false,
    );
    expect(DevelopmentSchema.safeParse({ ...emptyDevelopment(), future: true }).success).toBe(
      false,
    );
    expect(
      DevelopmentSchema.safeParse({
        ...emptyDevelopment(),
        unlockedModules: ["mn-scanner", "mn-scanner"],
      }).success,
    ).toBe(false);
  });
});
describe("production kit stats and mastery effects", () => {
  it.each(RACE_IDS)("preserves exact zero-development stats for %s", (race) => {
    const p = newPlayer(race);
    p.level = 20;
    p.weapon = "sword";
    p.upgrade = 1;
    expect(stats({ ...p, development: emptyDevelopment() })).toEqual(stats(p));
  });
  it("adds training to the unrounded racial base without multiplying it by talents or gear", () => {
    const h = harness("legend");
    const base = h.kit.stats;
    h.d.training.endurance = 30;
    h.d.training.strength = 30;
    expect(h.kit.stats.maxHp).toBe(1079);
    // Canonical ATK is unrounded 101.4: 101.4 * 1.12 = 113.568 → 114.
    expect(h.kit.stats.attack).toBe(114);
    h.kit.addBuff({ id: "test", ms: 10000, atkPct: 0.3 });
    expect(h.kit.stats.attack).toBe(Math.floor(101.4 * 1.3 + 101.4 * 0.12 + 0.5));
    expect(h.kit.stats.speed).toBe(base.speed);
    expect(h.kit.stats.attackInterval).toBe(base.attackInterval);
  });
  it("uses one rounded KI cost for display and payment, preserving noKi", () => {
    const h = harness("planetary", "mv-trail");
    h.d.training.kiControl = 30;
    const cost = h.kit.abilities().find((a) => a.id === "A1")!.ki;
    const ki = h.p.ki;
    expect(h.kit.use("A1").ok).toBe(true);
    expect(ki - h.p.ki).toBe(cost);
    expect(cost).toBe(9);
    h.kit.addBuff({ id: "free", ms: 10000, noKi: true });
    expect(h.kit.stats.kiCostMul).toBe(0);
  });
  it("Planetary variants alter real dash, both earth hits and four fixed healing ticks", () => {
    const dash = harness("planetary", "mv-trail");
    dash.kit.use("A1");
    expect(dash.p.x).toBe(192);
    const earth = harness("planetary", "mv-earth");
    earth.kit.learn("B5");
    earth.kit.use("B1");
    earth.tick(500);
    expect(earth.state.radius).toBe(144);
    expect(earth.state.raw).toHaveLength(2);
    expect(earth.state.raw[0]!.raw / earth.kit.stats.attack).toBeCloseTo(1.4 * 0.9);
    expect(earth.state.raw[1]!.raw / earth.kit.stats.attack).toBeCloseTo(1.4 * 0.6 * 0.9);
    const heal = harness("planetary", "mv-root");
    heal.kit.use("C1");
    heal.tick(4000);
    const partial = heal.state.heals;
    heal.tick(2000);
    expect(partial).toBeLessThan(heal.state.heals);
    expect(heal.state.heals).toBeCloseTo(heal.kit.stats.maxHp * 0.12 * 1.1);
  });
  it("Sage variants preserve total ticks and apply shield and seal tradeoffs", () => {
    const h = harness("sage", "ma-seal");
    expect(h.kit.use("A1").ok).toBe(true);
    expect(h.state.seal).toBe(2400);
    h.tick(2350);
    expect(h.state.raw).toHaveLength(0);
    h.tick(50);
    expect(h.state.raw).toHaveLength(1);
    const b = harness("sage", "ma-barrier");
    b.kit.learn("B3");
    b.kit.learn("B7");
    b.kit.use("B1");
    expect(b.kit.shields[0]!.ms).toBe(9000);
    expect(b.kit.shieldPoints).toBeCloseTo(b.kit.stats.maxHp * 0.15 * 1.3 * 0.8);
    const focus = harness("sage", "ma-focus");
    focus.kit.use("C1");
    focus.tick(4500);
    expect(focus.state.ki).toBeCloseTo(focus.kit.stats.maxKi * 0.3 * 1.2);
    expect(focus.kit.channel).toBeUndefined();
  });
  it("Android module effects commute, affect neither R/T cooldowns nor core limits", () => {
    const a = harness("android");
    a.d.equippedModuleIds = ["mn-routing", "mn-cooling", "mn-precision"];
    const s = a.kit.stats;
    a.d.equippedModuleIds.reverse();
    expect(a.kit.stats).toEqual(s);
    const plain = harness("android");
    expect(s.maxKi).toBe(Math.floor(plain.kit.stats.maxKi * 0.9 * 0.95 + 0.5));
    expect(s.crit).toBe(plain.kit.stats.crit + 2);
    expect(a.kit.abilities().find((n) => n.id === "B1")!.cd).toBe(11000);
    expect(a.kit.abilities()[0]!.cd).toBe(plain.kit.abilities()[0]!.cd);
    a.kit.learn("C7");
    expect(a.kit.resource()!.max).toBe(150);
    a.kit.learn("C8");
    expect(a.kit.resource()!.max).toBe(70);
    expect(Object.values(MODULE_ENERGY)).toEqual([4, 4, 4, 3, 2, 3]);
  });
  it("optics extends only actual basic reach, not marking reach or unrelated races", () => {
    const optical = harness("android"),
      plain = harness("android");
    optical.d.equippedModuleIds = ["mn-optics"];
    optical.foe.x = plain.foe.x = plain.kit.stats.range * 1.05;
    expect(optical.kit.stats.range).toBe(plain.kit.stats.range);
    expect(optical.kit.basicRange).toBeCloseTo(plain.kit.basicRange * 1.1);
    expect(plain.kit.use("R").ok).toBe(false);
    expect(optical.kit.use("R").ok).toBe(true);
    expect(optical.state.raw).toHaveLength(1);
    expect(optical.kit.use("A1").ok).toBe(false);
    expect(optical.state.mark).toBe(0);
    for (const race of RACE_IDS.filter((r) => r !== "android")) {
      const other = harness(race);
      other.d.equippedModuleIds = ["mn-optics"];
      expect(other.kit.basicRange).toBe(other.kit.stats.range);
    }
  });
  it("optics range agrees across retained target, auto-attack, HUD and initial stats", () => {
    const p = newPlayer("android");
    p.x = p.y = 1000;
    p.development = emptyDevelopment();
    p.development.unlockedModules = ["mn-optics"];
    p.development.equippedModuleIds = ["mn-optics"];
    const store = storage(),
      save = new SaveStore(store, "optical-fixture");
    save.load();
    expect(save.save(p)).toBe(true);
    const world = {
      ...WORLDS.nexus,
      width: 4096,
      height: 4096,
      spawn: { x: 1000, y: 1000 },
      npcs: [],
      enemies: [],
      monsters: [],
      objects: [],
      obstacles: [],
      safeAreas: [],
      city: {
        name: "Fixture",
        bounds: { x: 100, y: 100, width: 200, height: 200 },
        buildings: [],
        roads: [],
      },
    };
    const session = new GameSession(save, "android", { world, random: () => 0.99 });
    const enemy = session.monsters.spawn("verdant-mchowy-szlamak", {
      x: 1000 + session.kit.stats.range * 1.05,
      y: 1000,
    });
    session.targetId = enemy.id;
    session.autoAttack = true;
    expect(session.snapshot().target!.inRange).toBe(true);
    expect(session.snapshot().stats.range).toBe(Math.round(session.kit.basicRange));
    expect(stats(session.player).range).toBe(session.kit.basicRange);
    session.tick(16);
    expect(session.kit.abilities().find((a) => a.id === "R")!.remaining).toBeGreaterThan(0);
    expect(session.route).toEqual([]);
    expect({ x: session.player.x, y: session.player.y }).toEqual({ x: 1000, y: 1000 });
  });
  it("Android mastery changes marking, shield and beam geometry without free charge", () => {
    const mark = harness("android", "mn-mark");
    mark.kit.use("A1");
    expect(mark.state.mark).toBe(9000);
    const shield = harness("android", "mn-barrier");
    shield.d.equippedModuleIds = ["mn-shield"];
    shield.kit.use("B1");
    expect(shield.kit.shields[0]!.ms).toBe(3600);
    expect(shield.kit.shieldPoints).toBeCloseTo(shield.kit.stats.maxHp * 0.18 * 1.15 * 1.1);
    const beam = harness("android", "mn-discharge");
    beam.foe.y = 60;
    beam.kit.use("C1");
    expect(beam.state.raw).toHaveLength(1);
    expect(beam.state.raw[0]!.raw).toBeCloseTo(beam.kit.stats.attack * 0.9);
    expect(beam.kit.resource()!.value).toBe(0);
  });
  it("Legend mastery preserves the number of cuts and burn while trading damage and geometry", () => {
    const a = harness("legend", "mp-cuts");
    a.kit.learn("A7");
    a.kit.use("A1");
    a.tick(1000);
    expect(a.state.raw).toHaveLength(5);
    const normal = harness("legend");
    normal.kit.learn("A7");
    normal.kit.use("A1");
    normal.tick(1000);
    expect(a.state.raw.reduce((n, h) => n + h.raw, 0)).toBeCloseTo(
      normal.state.raw.reduce((n, h) => n + h.raw, 0) * 1.1,
    );
    expect(a.kit.resource()).toEqual(normal.kit.resource());
    const b = harness("legend", "mp-break");
    b.kit.use("B1");
    expect(b.state.stun).toBe(1500);
    expect(b.state.raw[0]!.raw).toBeCloseTo(b.kit.stats.attack * 1.5 * 0.9);
    const c = harness("legend", "mp-burst");
    c.foe.x = 175;
    c.kit.use("C1");
    expect(c.state.radius).toBe(180);
    expect(c.state.raw).toHaveLength(1);
  });
  it("an unlearned or wrong-race variant never changes a kit", () => {
    const h = harness("sage", "mp-cuts");
    expect(h.kit.abilities().find((n) => n.id === "A1")!.ki).toBe(12);
    h.d.activeVariantId = "ma-seal";
    h.d.unlockedVariants = ["ma-seal"];
    h.kit.forgetAll(["R"]);
    expect(h.kit.use("A1").ok).toBe(false);
  });
});
describe("atomic character development and exam isolation", () => {
  it.each(RACE_IDS)(
    "purchases and resets ranks without healing or resetting kit timers: %s",
    (race) => {
      const { session: s } = trainer(race);
      expect(s.developmentServiceReady).toBe(true);
      const identity = s.player;
      s.player.hp = 5;
      s.player.ki = 3;
      s.kit.cooldowns["A1"] = 2300;
      const resource = s.kit.resource();
      s.command({ type: "development", action: "train", discipline: "endurance" });
      expect(s.player).toBe(identity);
      expect(s.player.development!.training.endurance).toBe(1);
      expect(s.player.development!.practiceSpent).toBe(50);
      expect(s.player.hp).toBe(5);
      expect(s.player.ki).toBe(3);
      expect(s.kit.cooldowns["A1"]).toBe(2300);
      expect(s.kit.resource()).toEqual(resource);
      s.command({ type: "development", action: "reset-training" });
      expect(s.player.development!.practiceSpent).toBe(0);
      expect(s.player.development!.practiceEarned).toBe(2000);
      expect(s.player.hp).toBe(5);
      expect(s.player.ki).toBe(3);
    },
  );
  it("failed storage and a conflicting tab publish no rank or debit", () => {
    const { session: s, port } = trainer();
    const before = structuredClone(s.player);
    port.fail = true;
    s.command({ type: "development", action: "train", discipline: "strength" });
    expect(s.player).toEqual(before);
    port.fail = false;
    port.data.set("character", "changed in other tab");
    s.command({ type: "development", action: "train", discipline: "strength" });
    expect(s.player).toEqual(before);
    expect(port.getItem("character")).toBe("changed in other tab");
  });
  it("rejects training away from the trainer and while fighting", () => {
    const { session: s } = trainer();
    s.player.x = 800;
    s.command({ type: "development", action: "train", discipline: "strength" });
    expect(s.player.development!.practiceSpent).toBe(0);
    s.player.x = 300;
    s.combatIn = 100;
    s.command({ type: "development", action: "train", discipline: "strength" });
    expect(s.player.development!.practiceSpent).toBe(0);
  });
  it("loaned profiles never change the owner, and abandoned/unowned attempts cannot grant rewards", () => {
    const { session: s } = trainer("android");
    const before = structuredClone(s.player);
    const attempt = s.startDevelopmentExam("strength", 1, true)!;
    expect(attempt).toBeDefined();
    expect(attempt.session.saves).toBeUndefined();
    attempt.session.player.gold = 900;
    attempt.session.player.items.sword = 10;
    attempt.session.player.dead = true;
    expect(s.finishDevelopmentExam(attempt)).toBe(false);
    s.leaveDevelopmentExam(attempt);
    expect(s.player).toEqual(before);
    expect(s.finishDevelopmentExam(new ExamAttempt("android", "strength", 1))).toBe(false);
  });
  it.each(RACE_IDS)(
    "scores only real hits in separate exposure windows using the existing kit: %s",
    (race) => {
      const a = new ExamAttempt(race, "strength", 1),
        s = a.session;
      const advance = (ms: number) => {
        s.tick(ms);
        a.update();
      };
      advance(1000);
      advance(450);
      s.command({ type: "ability", ability: "R" });
      advance(50);
      expect(a.snapshot().successes).toBe(1);
      // No command => no extra success, irrespective of animation or render count.
      advance(1000);
      a.update();
      expect(a.snapshot().successes).toBe(1);
      s.paused = true;
      const time = a.snapshot().activeMs;
      advance(10000);
      expect(a.snapshot().activeMs).toBe(time);
      expect(s.player.kills).toBe(0);
      expect(s.player.xp).toBe(0);
      expect(s.loot).toHaveLength(0);
    },
  );
  it("defines all thirty distinct difficulty records and exact tier parameters", () => {
    const specs = DISCIPLINES.flatMap((d) =>
      Array.from({ length: 6 }, (_, i) => examSpec(d, i + 1)),
    );
    expect(specs).toHaveLength(30);
    expect(examSpec("strength", 6).windowMs).toBe(900);
    expect(examSpec("defense", 6).target).toBe(10);
    expect(examSpec("endurance", 6).limitMs).toBe(330000);
    expect(examSpec("kiControl", 6).kiBudget).toBe(0.6);
  });
  it("backs up old Superior bytes before the first development save; future data blocks writes", () => {
    const port = storage();
    const index = JSON.parse(
      readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
    ) as SuperiorIndex;
    const save = new SuperiorSaveStore(port, "slot", index, "verdant");
    save.load();
    const p = newPlayer();
    expect(save.save(p)).toBe(true);
    const legacy = JSON.parse(port.getItem("slot")!);
    legacy.version = 1;
    const old = JSON.stringify(legacy);
    port.data.set("slot", old);
    const migrated = new SuperiorSaveStore(port, "slot", index, "verdant");
    expect(migrated.load()).toBeDefined();
    p.development = emptyDevelopment();
    expect(migrated.save(p)).toBe(true);
    expect(JSON.parse(port.getItem("slot")!).version).toBe(5);
    expect(port.getItem("ki-legends:recovery:before-superior-v2:slot")).toBe(old);
    const future = JSON.parse(port.getItem("slot")!);
    future.player.development.futureField = true;
    const bytes = JSON.stringify(future);
    port.data.set("slot", bytes);
    const newer = new SuperiorSaveStore(port, "slot", index, "verdant");
    expect(newer.load()).toBeUndefined();
    expect(newer.save(p)).toBe(false);
    expect(port.getItem("slot")).toBe(bytes);
  });
  it("keeps four character ledgers independent", () => {
    const port = storage();
    for (const race of RACE_IDS) {
      const save = new SaveStore(port, race);
      save.load();
      expect(save.save(fundedPlayer(race))).toBe(true);
    }
    const first = new GameSession(new SaveStore(port, "planetary"));
    first.player.interior = "arena";
    first.player.x = 300;
    first.player.y = 330;
    first.command({ type: "development", action: "train", discipline: "strength" });
    for (const race of RACE_IDS)
      expect(new SaveStore(port, race).load()!.development!.training.strength).toBe(
        race === "planetary" ? 1 : 0,
      );
  });
});

describe("earned practice and replay-safe exam rewards", () => {
  it("credits real seen → attack → study → kill once, persisting knowledge", () => {
    const port = storage(),
      save = new SaveStore(port, "field");
    save.load();
    const p = newPlayer();
    p.x = 1000;
    p.y = 1000;
    p.level = 10;
    p.hp = stats(p).maxHp;
    p.ki = stats(p).maxKi;
    expect(save.save(p)).toBe(true);
    const world = {
      ...WORLDS.verdant,
      width: 4096,
      height: 4096,
      spawn: { x: 1000, y: 1000 },
      npcs: [],
      enemies: [],
      monsters: [],
      objects: [],
      obstacles: [],
      safeAreas: [],
      city: {
        name: "Safe entry",
        bounds: { x: 100, y: 100, width: 200, height: 200 },
        buildings: [],
        roads: [],
      },
    };
    const session = new GameSession(save, "planetary", {
      world,
      navigation: new Navigation(4096, 4096, []),
      random: () => 0.99,
    });
    const species = "verdant-mchowy-szlamak";
    const enemy = session.monsters.spawn(species, { x: 1050, y: 1000 });
    const tick = (ms: number) => {
      for (let n = 0; n < ms; n += 50) session.tick(50);
    };
    tick(1000);
    expect(session.player.development?.knowledge[species]).toBe(1);
    session.command({ type: "ability", ability: "R" });
    tick(3000);
    expect(session.player.development?.knowledge[species]).toBe(2);
    session.command({ type: "development", action: "study", species });
    expect(session.player.development?.knowledge[species]).toBe(3);
    session.command({ type: "ability", ability: "R" });
    tick(100);
    expect(enemy.hp).toBe(0);
    expect(session.player.development?.knowledge[species]).toBe(4);
    expect(session.player.development?.practiceEarned).toBe(50);
    session.killed(enemy);
    expect(session.player.development?.practiceEarned).toBe(50);
    session.flush();
    expect(new SaveStore(port, "field").load()?.development?.knowledge[species]).toBe(4);
  });
  it("only a genuinely passed eligible instance can pay, with retry after failed CAS", () => {
    const { session: owner, port } = trainer("sage");
    for (let rank = 0; rank < 4; rank++)
      owner.command({ type: "development", action: "train", discipline: "strength" });
    const profile = owner.startDevelopmentExam("strength", 1)!;
    expect(profile).toBeDefined();
    let nextHitAt = 0;
    for (let ms = 0; ms < 15000 && !profile.passed; ms += 50) {
      profile.session.tick(50);
      profile.update();
      if (profile.windowOpen && profile.session.nowMs >= nextHitAt) {
        profile.session.command({ type: "ability", ability: "R" });
        nextHitAt = profile.session.nowMs + 1200;
      }
    }
    expect(profile.passed).toBe(true);
    const original = structuredClone(owner.player);
    port.fail = true;
    expect(owner.finishDevelopmentExam(profile)).toBe(false);
    expect(owner.player).toEqual(original);
    port.fail = false;
    expect(owner.finishDevelopmentExam(profile)).toBe(true);
    expect(owner.player.development!.practiceEarned).toBe(2250);
    expect(owner.player.development!.practiceSpent).toBe(260);
    expect(owner.finishDevelopmentExam(profile)).toBe(false);
    expect(owner.player.development!.practiceEarned).toBe(2250);
    expect(new SaveStore(port, "character").load()!.development!.passedExamIds).toEqual([
      "exam:strength:1",
    ]);
  });
  it("refuses dropping existing development when a stale caller supplies a legacy-shaped player", () => {
    const port = storage(),
      save = new SaveStore(port, "character");
    save.load();
    const p = fundedPlayer();
    expect(save.save(p)).toBe(true);
    const original = port.getItem("character");
    const legacy = { ...p };
    delete legacy.development;
    expect(save.save(legacy)).toBe(false);
    expect(port.getItem("character")).toBe(original);
  });
});

describe("defense exams use legal racial protection", () => {
  it.each(["planetary", "sage", "android"] as const)(
    "allows an actual kit shield to absorb one announced strike: %s",
    (race) => {
      const attempt = new ExamAttempt(race, "defense", 1);
      const session = attempt.session;
      for (let ms = 0; ms < 1500; ms += 50) {
        session.tick(50);
        attempt.update();
      }
      const ability = race === "planetary" ? "C4" : "B1";
      expect(session.kit.use(ability).ok).toBe(true);
      for (let ms = 1500; ms < 3250; ms += 50) {
        session.tick(50);
        attempt.update();
      }
      expect(attempt.snapshot().successes).toBe(1);
      expect(attempt.snapshot().errors).toBe(0);
      expect(session.player.hp).toBe(session.kit.stats.maxHp);
    },
  );
  it("offers immediate retry of a failed owned instance without a new reward or leaked profile", () => {
    const { session: owner } = trainer("legend");
    const attempt = owner.startDevelopmentExam("defense", 1, true)!;
    expect(attempt.session.player.skills).toEqual(["R"]);
    for (let ms = 0; ms < 10000; ms += 50) {
      attempt.session.tick(50);
      attempt.update();
    }
    expect(attempt.snapshot().outcome).toBe("failed");
    const next = owner.retryDevelopmentExam(attempt)!;
    expect(next).toBeDefined();
    expect(next).not.toBe(attempt);
    expect(next.snapshot()).toMatchObject({
      outcome: "running",
      successes: 0,
      errors: 0,
      activeMs: 0,
    });
    expect(owner.player.development!.practiceEarned).toBe(2000);
    expect(owner.finishDevelopmentExam(attempt)).toBe(false);
  });
});

it("ordinary skill-tree reset disables its variant while retaining the discovery", () => {
  const { session } = trainer();
  session.player.level = 2;
  session.command({ type: "learn", node: "A1" });
  session.player.development!.unlockedVariants = ["mv-trail"];
  session.command({ type: "development", action: "variant", id: "mv-trail" });
  expect(session.player.development!.activeVariantId).toBe("mv-trail");
  session.command({ type: "respec" });
  expect(session.player.skills).toEqual(["R"]);
  expect(session.player.development!.activeVariantId).toBeNull();
  expect(session.player.development!.unlockedVariants).toEqual(["mv-trail"]);
});
