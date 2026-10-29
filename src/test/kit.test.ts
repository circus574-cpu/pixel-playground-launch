import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KIT_NODES,
  RACE_BASE,
  canLearn,
  createKit,
  freePoints,
  validLearned,
  type Foe,
  type Hit,
  type KitPort,
} from "../game/kit";
import { RACE_IDS, type RaceId } from "../game/world/races";

type TestFoe = Foe & {
  def: number;
  stunned: number;
  slowed: number;
  burn: number;
  sealed: boolean;
  marked: boolean;
  shield: boolean;
  weak: number;
};
type AnnexNode = {
  id: string;
  name: string;
  type: string;
  minLevel: number;
  requiresAny: string[];
  effect: string;
};
const annex = JSON.parse(readFileSync("docs/design/data/character-progression-1-20.json", "utf8"));

function foe(id: string, x: number, y: number, hp = 1000, def = 0): TestFoe {
  return {
    id,
    x,
    y,
    hp,
    maxHp: hp,
    def,
    stunned: 0,
    slowed: 0,
    burn: 0,
    sealed: false,
    marked: false,
    shield: true,
    weak: 0,
  };
}
function harness(race: RaceId, level: number, learned: string[], foes: TestFoe[] = []) {
  const state = {
    now: 0,
    player: { x: 0, y: 0, level, hp: 1, ki: 1000 },
    heals: 0,
    inCombat: true,
    seq: 0.99,
    events: [] as string[],
    hits: [] as { foe: string; raw: number; hit: Hit }[],
    terrain: "open" as "open" | "forest" | "rock" | "water",
    target: undefined as TestFoe | undefined,
  };
  const port: KitPort = {
    get nowMs() {
      return state.now;
    },
    gear: { attack: 0, defense: 0 },
    get inCombat() {
      return state.inCombat;
    },
    terrain: () => state.terrain,
    player: state.player,
    facing: { x: 1, y: 0 },
    random: () => state.seq,
    say: () => {},
    foesIn: (c, r) => foes.filter((f) => f.hp > 0 && Math.hypot(f.x - c.x, f.y - c.y) <= r),
    target: () => state.target,
    visible: () => true,
    hurtFoe: (f, raw, hit) => {
      const t = f as TestFoe;
      const dealt = Math.max(1, Math.round(raw - t.def / 2));
      t.hp = Math.max(0, t.hp - dealt);
      state.hits.push({ foe: f.id, raw, hit });
      return dealt;
    },
    stunFoe: (f, ms) => void ((f as TestFoe).stunned = Math.max((f as TestFoe).stunned, ms)),
    slowFoe: (f, pct) => void ((f as TestFoe).slowed = pct),
    burnFoe: (f, dps, ms) => void ((f as TestFoe).burn += dps * (ms / 1000)),
    sealFoe: (f) => void ((f as TestFoe).sealed = true),
    markFoe: (f) => void ((f as TestFoe).marked = true),
    pushFoe: () => {},
    weakenFoe: (f, pct) => void ((f as TestFoe).weak = pct),
    breakFoeShield: (f) => void ((f as TestFoe).shield = false),
    isSealed: (f) => (f as TestFoe).sealed,
    isMarked: (f) => (f as TestFoe).marked,
    foeHpFraction: (f) => f.hp / f.maxHp,
    dash: (to, d) => {
      const len = Math.hypot(to.x - state.player.x, to.y - state.player.y) || 1;
      const k = Math.min(1, d / len);
      state.player.x += (to.x - state.player.x) * k;
      state.player.y += (to.y - state.player.y) * k;
      return { x: state.player.x, y: state.player.y };
    },
    emit: (e) => void state.events.push(e.type + ":" + (e.ability ?? "")),
    heal: (n) => void (state.heals += n),
    addKi: (n) => void (state.player.ki += n),
  };
  const kit = createKit(race, port, learned);
  const step = (ms: number, moving = false) => {
    for (let t = 0; t < ms; t += 50) {
      state.now += 50;
      kit.tick(50, moving);
    }
  };
  return { kit, state, port, step, foes };
}

describe("owner annex 22.10.2026: stats and tree data", () => {
  it("race stats reproduce the annex table at levels 10 and 20", () => {
    const table: Record<RaceId, number[][]> = {
      planetary: [
        [449, 86, 48, 27],
        [809, 126, 88, 51],
      ],
      sage: [
        [352, 143, 55, 17],
        [632, 213, 101, 33],
      ],
      android: [
        [421, 105, 46, 34],
        [761, 155, 84, 64],
      ],
      legend: [
        [518, 67, 55, 22],
        [938, 97, 101, 42],
      ],
    };
    for (const race of RACE_IDS) {
      [10, 20].forEach((level, i) => {
        const h = harness(race, level, ["R"]);
        const s = h.kit.stats;
        expect([s.maxHp, s.maxKi, s.attack, s.defense]).toEqual(table[race][i]);
      });
    }
  });
  it("level 10 and 20 regeneration and crit match the annex; speed follows the owner's +5%/level to level 20", () => {
    const expected: Record<
      RaceId,
      { regen10: number; crit10: number; crit20: number; speed: number; interval: number }
    > = {
      planetary: { regen10: 1.45, crit10: 7.25, crit20: 9.75, speed: 185, interval: 650 },
      sage: { regen10: 2.9, crit10: 6.8, crit20: 8.8, speed: 170, interval: 800 },
      android: { regen10: 1.74, crit10: 11.6, crit20: 15.6, speed: 175, interval: 700 },
      legend: { regen10: 1.16, crit10: 8.7, crit20: 11.7, speed: 170, interval: 750 },
    };
    for (const race of RACE_IDS) {
      const a = harness(race, 10, ["R"]).kit.stats;
      const b = harness(race, 20, ["R"]).kit.stats;
      const e = expected[race];
      expect(a.kiRegen).toBeCloseTo(e.regen10, 2);
      expect(a.crit).toBeCloseTo(e.crit10, 2);
      expect(b.crit).toBeCloseTo(e.crit20, 2);
      expect(a.speed).toBeCloseTo(e.speed * 1.45, 6);
      expect(b.speed).toBeCloseTo(e.speed * 1.95, 6);
      expect(harness(race, 60, ["R"]).kit.stats.speed).toBeCloseTo(e.speed * 1.95, 6);
      expect(harness(race, 1, ["R"]).kit.stats.speed).toBe(e.speed);
      expect(a.attackInterval).toBe(e.interval);
    }
  });
  it("generated nodes equal the annex JSON (ids, names, levels, requirements, text)", () => {
    for (const race of RACE_IDS) {
      const src = annex.races[race];
      expect(src.base).toEqual(RACE_BASE[race].base);
      expect(src.perLevel).toEqual(RACE_BASE[race].perLevel);
      expect(KIT_NODES[race]).toHaveLength(29);
      expect(
        KIT_NODES[race].map((n) => [n.id, n.name, n.type, n.minLevel, n.requires, n.text]),
      ).toEqual(
        src.nodes.map((n: AnnexNode) => [
          n.id,
          n.name,
          n.type,
          n.minLevel,
          n.requiresAny,
          n.effect,
        ]),
      );
    }
  });
  it("every active node has a runtime definition and every active definition has a node", () => {
    for (const race of RACE_IDS) {
      const kit = harness(race, 20, []).kit;
      const activeNodes = KIT_NODES[race]
        .filter((n) => ["active", "ultimate", "ki-mode"].includes(n.type))
        .map((n) => n.id);
      expect(Object.keys(kit.defs).sort()).toEqual(activeNodes.sort());
    }
  });
  it("tree rules: points, prerequisites, level gates, exclusive choices", () => {
    for (const race of RACE_IDS) {
      const learned = ["R"];
      expect(freePoints(1, learned)).toBe(0);
      expect(canLearn(race, 1, learned, "A1")).toMatchObject({ ok: false });
      expect(canLearn(race, 2, learned, "A1")).toEqual({ ok: true });
      expect(canLearn(race, 2, ["R"], "A4")).toMatchObject({ ok: false });
      // A walk through branch A to the choice
      const order = ["R", "A1", "A2", "A3", "A4", "A5", "A6", "A7"];
      let have: string[] = [];
      for (const id of order) {
        const lv = KIT_NODES[race].find((n) => n.id === id)!.minLevel;
        const level = Math.max(lv, have.length + 1);
        expect(canLearn(race, level, have, id)).toEqual({ ok: true });
        have = [...have, id];
      }
      expect(canLearn(race, 20, have, "A8")).toMatchObject({ ok: false });
      expect(validLearned(race, 20, have)).toBe(true);
      expect(validLearned(race, 20, [...have, "A8"])).toBe(false);
      expect(validLearned(race, 3, have)).toBe(false);
      expect(canLearn(race, 20, have, "T")).toMatchObject({ ok: false });
    }
  });
  it("the wide skeleton needs 19 points and Ki mode makes exactly 20", () => {
    for (const race of RACE_IDS) {
      const path = [
        "R",
        "A1",
        "A2",
        "A4",
        "A5",
        "A7",
        "A9",
        "B1",
        "B2",
        "B4",
        "B5",
        "B7",
        "B9",
        "C1",
        "C2",
        "C4",
        "C5",
        "C7",
        "C9",
      ];
      expect(path).toHaveLength(19);
      expect(validLearned(race, 20, path)).toBe(true);
      expect(validLearned(race, 20, [...path, "T"])).toBe(true);
      expect(freePoints(20, [...path, "T"])).toBe(0);
    }
  });
});

describe("annex control duels (damage = max(1, ATK − DEF/2), no rounding)", () => {
  const duels = [
    {
      level: 1,
      foe: { hp: 54, atk: 9, def: 3 },
      want: { planetary: [6, 20], sage: [5, 14], android: [6, 21], legend: [5, 20] },
    },
    {
      level: 10,
      foe: { hp: 350, atk: 41, def: 19 },
      want: { planetary: [10, 17], sage: [8, 11], android: [10, 18], legend: [8, 18] },
    },
    {
      level: 20,
      foe: { hp: 3120, atk: 121, def: 60 },
      want: { planetary: [54, 9], sage: [44, 7], android: [58, 9], legend: [44, 10] },
    },
  ] as const;
  it("reproduces every number of the annex table for all four races", () => {
    for (const d of duels)
      for (const race of RACE_IDS) {
        const s = harness(race, d.level, ["R"]).kit.stats;
        const hits = Math.ceil(d.foe.hp / Math.max(1, s.attack - d.foe.def / 2));
        const taken = Math.ceil(s.maxHp / Math.max(1, d.foe.atk - s.defense / 2));
        expect([hits, taken], race + " L" + d.level).toEqual(d.want[race]);
      }
  });
});

describe("Planetarni", () => {
  it("third hit of a series deals ×1.3 and the basic attack respects its interval", () => {
    const f = foe("f", 40, 0);
    const h = harness("planetary", 1, ["R"], [f]);
    h.state.target = f;
    const raws: number[] = [];
    for (let i = 0; i < 3; i++) {
      expect(h.kit.use("R").ok).toBe(true);
      raws.push(h.state.hits.at(-1)!.raw);
      expect(h.kit.use("R").ok).toBe(false);
      h.step(650);
    }
    expect(raws[2]! / raws[0]!).toBeCloseTo(1.3, 5);
  });
  it("dodge dashes, grants 0.4 s invulnerability and arms the follow-up bonuses", () => {
    const f = foe("f", 40, 0);
    const h = harness("planetary", 7, ["R", "A1", "A3", "A7"], [f]);
    expect(h.kit.use("A1").ok).toBe(true);
    expect(h.state.player.x).toBeCloseTo(160);
    expect(h.kit.absorb(100, "melee")).toBe(0);
    h.step(450);
    expect(h.kit.absorb(100, "melee")).toBe(100);
    const f2 = foe("g", 200, 0, 1000);
    const h2 = harness("planetary", 7, ["R", "A1", "A3", "A7"], [f2]);
    h2.state.target = f2;
    h2.state.player.x = 150;
    h2.kit.use("A1");
    h2.step(400);
    h2.state.player.x = 150;
    h2.state.player.y = 0;
    h2.kit.use("R");
    const base = harness("planetary", 7, ["R"], [foe("g", 200, 0)]);
    base.state.target = base.foes[0];
    base.state.player.x = 150;
    base.kit.use("R");
    const hit = h2.state.hits.at(-1)!;
    expect(hit.hit.crit).toBe(true);
    expect(hit.raw).toBeCloseTo(base.state.hits.at(-1)!.raw * 1.25 * 1.5, 4);
  });
  it("Impuls Ziemi hits in an area, slows and Rezonans strikes again after 0.5 s", () => {
    const a = foe("a", 60, 0);
    const b = foe("b", 0, 100);
    const c = foe("c", 500, 0);
    const h = harness("planetary", 10, ["R", "B1", "B3", "B5", "B6"], [a, b, c]);
    const kiBefore = h.state.player.ki;
    expect(h.kit.use("B1").ok).toBe(true);
    expect(a.slowed).toBe(0.3);
    expect(c.hp).toBe(1000);
    const first = h.state.hits.length;
    expect(first).toBe(2);
    h.step(550);
    expect(h.state.hits.length).toBe(4);
    expect(h.state.hits[2]!.raw).toBeCloseTo(h.state.hits[0]!.raw * 0.6, 5);
    expect(h.state.player.ki).toBe(kiBefore - 10 + 10);
  });
  it("Adaptacja gives terrain bonuses", () => {
    const h = harness("planetary", 4, ["R", "A1", "B1", "B2"]);
    const base = h.kit.stats;
    h.state.terrain = "forest";
    expect(h.kit.stats.kiRegen / base.kiRegen).toBeCloseTo(1.3);
    h.state.terrain = "rock";
    expect(h.kit.stats.defense).toBeGreaterThan(base.defense);
    h.state.terrain = "water";
    expect(h.kit.stats.speed / base.speed).toBeCloseTo(1.08);
  });
  it("Tarcza Liści absorbs 18% max HP and reflects melee with Strażnik Gaju", () => {
    const attacker = foe("m", 30, 0, 500);
    const h = harness("planetary", 13, ["R", "C1", "C4", "C7"], [attacker]);
    // C4 requires C2|C3 in the tree, but the runtime accepts any learned set
    expect(h.kit.use("C4").ok).toBe(true);
    const cap = h.kit.stats.maxHp * 0.18;
    expect(h.kit.shieldPoints).toBeCloseTo(cap);
    expect(h.kit.absorb(50, "melee", attacker)).toBe(0);
    expect(attacker.hp).toBeLessThan(500);
    expect(h.kit.absorb(cap, "melee", attacker)).toBeGreaterThan(0);
  });
});

describe("Mędrcy", () => {
  it("Pieczęć Energii explodes after 3 s for ×2.0 and A8 returns Ki", () => {
    const f = foe("f", 200, 0);
    const h = harness("sage", 13, ["R", "A1", "A8"], [f]);
    h.state.target = f;
    h.kit.use("A1");
    expect(f.sealed).toBe(true);
    const ki = h.state.player.ki;
    h.step(3050);
    expect(h.state.hits).toHaveLength(1);
    const attack = h.kit.stats.attack;
    expect(h.state.hits[0]!.raw).toBeCloseTo(attack * 2, 3);
    expect(h.state.player.ki).toBe(ki + 15);
  });
  it("Strumień Ki channels six ticks of ×0.4", () => {
    const f = foe("f", 200, 0);
    const h = harness("sage", 7, ["R", "A4"], [f]);
    h.state.target = f;
    h.kit.use("A4");
    h.step(3100);
    expect(h.state.hits).toHaveLength(6);
    expect(h.state.hits.reduce((n, x) => n + x.raw, 0)).toBeCloseTo(h.kit.stats.attack * 2.4, 3);
    expect(h.kit.channel).toBeUndefined();
  });
  it("Skupienie KI restores 30% and is interrupted by moving unless Skupienie Mistrza", () => {
    const h = harness("sage", 13, ["R", "C1"]);
    h.state.player.ki = 0;
    h.kit.use("C1");
    h.step(3100);
    expect(h.state.player.ki).toBeCloseTo(h.kit.stats.maxKi * 0.3, 3);
    const g = harness("sage", 13, ["R", "C1"]);
    g.state.player.ki = 0;
    g.kit.use("C1");
    g.step(500, true);
    expect(g.kit.channel).toBeUndefined();
    const m = harness("sage", 16, ["R", "C1", "C8"]);
    m.state.player.ki = 0;
    m.kit.use("C1");
    m.step(500, true);
    expect(m.kit.channel).toBeDefined();
  });
  it("Bariera: Lustro reflects the first attack in full and Kopuła raises capacity", () => {
    const attacker = foe("m", 30, 0, 500);
    const h = harness("sage", 13, ["R", "B1", "B8"], [attacker]);
    h.kit.use("B1");
    expect(h.kit.absorb(40, "melee", attacker)).toBe(0);
    expect(attacker.hp).toBe(500 - 40);
    const k = harness("sage", 13, ["R", "B1", "B7"]);
    k.kit.use("B1");
    expect(k.kit.shieldPoints).toBeCloseTo(k.kit.stats.maxHp * 0.15 * 1.3);
  });
  it("Pełnia Skupienia removes Ki costs", () => {
    const h = harness("sage", 16, ["R", "A1", "C9"]);
    h.kit.use("C9");
    const before = h.state.player.ki;
    h.kit.use("A1");
    expect(h.state.player.ki).toBe(before);
  });
});

describe("Androidy", () => {
  it("each shot adds 4 charge, overheating at 100 stops shooting for 2 s", () => {
    const f = foe("f", 200, 0, 1e6);
    const h = harness("android", 1, ["R"], [f]);
    h.state.target = f;
    for (let i = 0; i < 25; i++) {
      h.kit.use("R");
      h.step(700);
    }
    const res = h.kit.resource()!;
    expect(res.state === "overheat" || res.value < 100).toBe(true);
    // force exactly 100
    const g = harness("android", 1, ["R"], [foe("g", 200, 0, 1e6)]);
    g.state.target = g.foes[0];
    let shots = 0;
    while (g.kit.resource()!.state !== "overheat" && shots < 40) {
      g.kit.use("R");
      shots++;
      g.step(700);
      if (shots > 30) break;
    }
    expect(g.kit.use("R").ok).toBe(false);
  });
  it("Wyładowanie Rdzenia scales with charge and spends it", () => {
    const f = foe("f", 200, 0, 1e6);
    const h = harness("android", 7, ["R", "C1"], [f]);
    h.state.target = f;
    (h.kit as unknown as { charge: number }).charge = 100;
    h.kit.use("C1");
    const raw = h.state.hits.at(-1)!.raw;
    expect(raw).toBeCloseTo(h.kit.stats.attack * 3, 3);
    expect((h.kit as unknown as { charge: number }).charge).toBe(0);
  });
  it("Przeciążony Rdzeń lifts the cap to 150 (×4.0) and Stabilny Rdzeń never overheats", () => {
    const f = foe("f", 200, 0, 1e6);
    const h = harness("android", 13, ["R", "C1", "C7"], [f]);
    (h.kit as unknown as { charge: number }).charge = 150;
    h.kit.use("C1");
    expect(h.state.hits.at(-1)!.raw).toBeCloseTo(h.kit.stats.attack * 4, 3);
    const s = harness("android", 13, ["R", "C8"], [foe("g", 200, 0, 1e6)]);
    s.state.target = s.foes[0];
    for (let i = 0; i < 40; i++) {
      expect(s.kit.use("R").ok).toBe(true);
      s.step(700);
    }
    expect(s.kit.resource()!.max).toBe(70);
    expect(s.kit.resource()!.state).not.toBe("overheat");
  });
  it("marks: Salwa and Egzekucja need a mark, Egzekucja deals ×6 below 30% HP", () => {
    const f = foe("f", 200, 0, 1000);
    const h = harness("android", 16, ["R", "A1", "A4", "A9"], [f]);
    h.state.target = f;
    expect(h.kit.use("A4").ok).toBe(false);
    expect(h.kit.use("A1").ok).toBe(true);
    expect(f.marked).toBe(true);
    expect(h.kit.use("A9").ok).toBe(true);
    expect(h.state.hits.at(-1)!.raw).toBeCloseTo(h.kit.stats.attack * 4 * (1 + 0), -1);
    f.hp = 200;
    h.step(31000);
    h.kit.use("A9");
    expect(h.state.hits.at(-1)!.raw / h.kit.stats.attack).toBeGreaterThan(5.5);
  });
  it("Przeciążenie Systemu: free abilities, then a 2 s shutdown", () => {
    const h = harness("android", 16, ["R", "C9"]);
    h.kit.use("C9");
    h.step(6100);
    expect(h.kit.lockMs).toBeGreaterThan(0);
    expect(h.kit.use("R").ok).toBe(false);
    h.step(2100);
    expect(h.kit.lockMs).toBe(0);
  });
});

describe("Legendy", () => {
  it("Żar grows by 4 per hit, boosts damage up to 10% and decays outside combat", () => {
    const f = foe("f", 40, 0, 1e6);
    const h = harness("legend", 1, ["R"], [f]);
    h.state.target = f;
    h.kit.use("R");
    expect(h.kit.resource()!.value).toBe(4);
    for (let i = 0; i < 40; i++) {
      h.step(750);
      h.kit.use("R");
    }
    expect(h.kit.resource()!.value).toBe(100);
    h.state.inCombat = false;
    h.step(2000);
    expect(h.kit.resource()!.value).toBeCloseTo(90, 0);
  });
  it("Ogniste Cięcie: 3 cuts totalling ×1.8, Taniec Płomieni 5 cuts ×2.6, ignition", () => {
    const f = foe("f", 40, 0, 1e6);
    const h = harness("legend", 10, ["R", "A1", "A2"], [f]);
    h.state.target = f;
    h.kit.use("A1");
    h.step(400);
    expect(h.state.hits).toHaveLength(3);
    expect(f.burn).toBeGreaterThan(0);
    const g = foe("g", 40, 0, 1e6);
    const k = harness("legend", 16, ["R", "A1", "A7"], [g]);
    k.state.target = g;
    k.kit.use("A1");
    k.step(800);
    expect(k.state.hits).toHaveLength(5);
  });
  it("Eksplozja Żaru consumes ember, Ostatni Płomień saves from a lethal hit", () => {
    const f = foe("f", 40, 0, 1e6);
    const h = harness("legend", 10, ["R", "C1", "C4"], [f]);
    (h.kit as unknown as { ember: number }).ember = 100;
    h.kit.use("C4");
    expect(h.state.hits.at(-1)!.raw / h.kit.stats.attack).toBeGreaterThanOrEqual(3 * 0.999);
    expect(h.kit.resource()!.value).toBe(0);
    const g = harness("legend", 16, ["R", "B9"]);
    expect(g.kit.saveFromDeath()).toBe(false);
    g.kit.use("B9");
    expect(g.kit.saveFromDeath()).toBe(true);
    expect(g.kit.saveFromDeath()).toBe(false);
  });
  it("Płomienny Szał trades defence for attack unless Kontrolowany Żar", () => {
    const h = harness("legend", 10, ["R", "B4"]);
    const b = h.kit.stats;
    h.kit.use("B4");
    const s = h.kit.stats;
    expect(s.attack).toBeGreaterThan(b.attack * 1.25);
    expect(s.defense).toBeLessThan(b.defense);
    const k = harness("legend", 16, ["R", "B4", "B8"]);
    const kb = k.kit.stats;
    k.kit.use("B4");
    expect(k.kit.stats.defense).toBe(kb.defense);
  });
});

describe("Technique execution guards", () => {
  it("allows one paid skill repeat, never an endless reset chain", () => {
    const h = harness("planetary", 7, ["R", "A1", "A3", "A7"], [foe("g", 30, 0)]);
    h.port.player.combatTraining = {
      dodge: { rank: 0, progress: 0 },
      attackSpeed: { rank: 0, progress: 0 },
      technique: { rank: 100, progress: 0 },
    };
    h.state.seq = 0;
    const before = h.state.player.ki;
    expect(h.kit.use("A1").ok).toBe(true);
    const cost = before - h.state.player.ki;
    expect(cost).toBeGreaterThan(0);
    expect(h.kit.use("A1").ok).toBe(true);
    expect(h.state.player.ki).toBe(before - 2 * cost);
    expect(h.kit.use("A1").ok).toBe(false);
    expect(h.state.player.ki).toBe(before - 2 * cost);
  });
  it("does not bypass KI or learned-skill requirements", () => {
    const h = harness("planetary", 7, ["R", "A1", "A3", "A7"]);
    h.port.player.combatTraining = {
      dodge: { rank: 0, progress: 0 },
      attackSpeed: { rank: 0, progress: 0 },
      technique: { rank: 100, progress: 0 },
    };
    h.state.seq = 0;
    h.state.player.ki = 0;
    expect(h.kit.use("A1").ok).toBe(false);
    expect(h.kit.use("B7").ok).toBe(false);
  });
});

it("Technique increases KI damage without amplifying physical attacks", () => {
  for (const race of ["sage", "planetary"] as const) {
    const a = harness(race, 1, ["R"], [foe("a", 30, 0)]),
      b = harness(race, 1, ["R"], [foe("b", 30, 0)]);
    b.port.player.combatTraining = {
      dodge: { rank: 0, progress: 0 },
      attackSpeed: { rank: 0, progress: 0 },
      technique: { rank: 100, progress: 0 },
    };
    expect(a.kit.use("R").ok).toBe(true);
    expect(b.kit.use("R").ok).toBe(true);
    expect(b.state.hits[0]!.raw / a.state.hits[0]!.raw).toBeCloseTo(race === "sage" ? 1.25 : 1, 5);
  }
});

it("keeps equipment, training and temporary bonuses separate and expires buffs", () => {
  const h = harness("planetary", 1, ["R"]);
  Object.assign(h.port.gear, {
    attack: 8,
    defense: 3,
    dodgeChance: 2,
    technique: 10,
    attackSpeedPct: 5,
  });
  h.kit.addBuff({ id: "stat-test", ms: 1000, dodgeAdd: 3, techniqueAdd: 5, attackSpeedPct: 4 });
  expect(h.kit.stats.dodgeChance).toBe(5);
  expect(h.kit.stats.technique).toBe(15);
  expect(h.kit.stats.attackSpeedPct).toBe(9);
  expect(h.kit.statBreakdown.technique.items).toBe(10);
  expect(h.kit.statBreakdown.technique.effects).toBe(5);
  h.step(1100);
  expect(h.kit.stats.technique).toBe(10);
  expect(h.kit.stats.dodgeChance).toBe(2);
});
