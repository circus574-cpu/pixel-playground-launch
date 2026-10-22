import { describe, expect, it, vi, afterEach } from "vitest";
import {
  GameSession,
  newPlayer,
  SaveStore,
  SAVE_KEY,
  stats,
  type StoragePort,
} from "../game/session";
import { NODES, TREES, skillId } from "../game/progression/catalog";
import {
  availablePoints,
  equipSkill,
  graphErrors,
  learnSkill,
  newProgression,
  raceDamage,
  raceStats,
  resetSkills,
  validateProgression,
} from "../game/progression/model";
import { RACE_IDS, type RaceId } from "../game/world/races";

afterEach(() => vi.restoreAllMocks());
function game(race: RaceId, level = 20, codes: string[] = []) {
  const g = new GameSession(undefined, race, true);
  g.player.level = level;
  const p = g.player.progression!;
  for (const code of codes)
    expect(learnSkill(race, level, p, skillId(race, code)), code).toBe(true);
  g.player.hp = stats(g.player).maxHp;
  g.player.ki = stats(g.player).maxKi;
  return g;
}
const path = (b: string) => [b + "1", b + "2", b + "4", b + "5", b + "7", b + "9"];
function near(g: GameSession) {
  const e = g.enemies[0]!;
  Object.assign(g.player, g.nav.safe({ x: e.x - 35, y: e.y }));
  g.targetId = e.id;
  e.hp = e.maxHp = 10000;
  return e;
}
function ticks(g: GameSession, ms: number) {
  for (let left = ms; left > 0; left -= 50) g.tick(Math.min(50, left));
}
function memory(): StoragePort {
  const values = new Map<string, string>();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
}

describe("annex graph and point economy", () => {
  it("validates every race and permits the documented 20-point triple-ultimate build", () => {
    expect(graphErrors()).toEqual([]);
    for (const r of RACE_IDS) {
      expect(TREES[r]).toHaveLength(29);
      const p = newProgression(r);
      for (const code of [...path("A"), ...path("B"), ...path("C"), "T"])
        expect(learnSkill(r, 20, p, skillId(r, code)), r + code).toBe(true);
      expect(p.learned).toHaveLength(20);
      expect(availablePoints(20, p)).toBe(0);
      expect(validateProgression(r, 20, p)).toBe(true);
      expect(learnSkill(r, 20, p, skillId(r, "A3"))).toBe(false);
    }
  });
  it("enforces level, predecessor OR, both normal passives and mutually exclusive choices", () => {
    const r = "planetary",
      p = newProgression(r);
    expect(learnSkill(r, 1, p, "planetary.A1")).toBe(false);
    expect(learnSkill(r, 20, p, "planetary.A9")).toBe(false);
    for (const c of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"])
      expect(learnSkill(r, 20, p, skillId(r, c))).toBe(true);
    expect(learnSkill(r, 20, p, "planetary.A8")).toBe(false);
    expect(validateProgression("sage", 20, p)).toBe(false);
    expect(validateProgression(r, 3, p)).toBe(false);
    p.learned.push("planetary.A7");
    expect(validateProgression(r, 20, p)).toBe(false);
  });
  it("swaps slots without duplicates, preserves cooldowns on reset and cannot equip a passive", () => {
    const p = newProgression("sage");
    for (const c of path("A")) learnSkill("sage", 20, p, skillId("sage", c));
    p.cooldowns["sage.A1"] = 7000;
    expect(equipSkill(p, "sage.A2", 0)).toBe(false);
    expect(equipSkill(p, "sage.A9", 0)).toBe(true);
    expect(equipSkill(p, "sage.A1", 2)).toBe(true);
    expect(p.loadout.filter((x) => x === "sage.A1")).toHaveLength(1);
    resetSkills("sage", p);
    expect(p.learned).toEqual(["sage.R"]);
    expect(p.cooldowns["sage.A1"]).toBe(7000);
  });
});

describe("growth and damage math", () => {
  const expected = {
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
  for (const r of RACE_IDS)
    it(`${r}: matches the source tables and keeps levels above 20 intact`, () => {
      for (const [i, level] of [10, 20].entries()) {
        const s = raceStats(r, level);
        expect([s.maxHp, s.maxKi, s.attack, s.defense]).toEqual(expected[r][i]);
      }
      expect(raceStats(r, 100)).toEqual(raceStats(r, 20));
    });
  it("proportionally charges defense: eight hits equal a single cast before crit", () => {
    const whole = raceDamage(101, 4.2, 60),
      split = Array.from({ length: 8 }, () => raceDamage(101, 4.2 / 8, 60, 1 / 8)).reduce(
        (a, b) => a + b,
        0,
      );
    expect(split).toBeCloseTo(whole);
    expect(whole).toBeCloseTo(394.2);
    expect(raceDamage(101, 2.4, 60)).toBeCloseTo(212.4);
    expect(raceDamage(1, 0.01, 1000, 0.1)).toBe(0.1);
  });
});

describe("saved character safety", () => {
  it("round-trips every race immediately after its own basic attack cooldown", () => {
    for (const r of RACE_IDS) {
      const storage = memory(),
        g = new GameSession(new SaveStore(storage), r, true);
      const e = near(g);
      g.command({ type: "ability", ability: "attack" });
      expect(g.player.cooldowns.attack).toBeGreaterThan(0);
      const restored = new GameSession(new SaveStore(storage));
      expect(restored.saves!.warning, r).toBe("");
      expect(restored.player.progression, r).toBeDefined();
      expect(restored.player.cooldowns.attack).toBe(g.player.cooldowns.attack);
      expect(e.hp).toBeLessThan(e.maxHp);
    }
  });
  it("migrates deliberately, creates a byte-identical recovery copy and reloads a v4 allocation", () => {
    const storage = memory(),
      legacy = JSON.stringify({ version: 3, revision: "old", player: newPlayer("sage") });
    storage.setItem(SAVE_KEY, legacy);
    const g = new GameSession(new SaveStore(storage));
    g.player.level = 4;
    g.command({ type: "activate-progression" });
    g.command({ type: "learn-skill", id: "sage.A1" });
    expect(storage.getItem("ki-legends:recovery:before-v4:" + SAVE_KEY)).toBe(legacy);
    const raw = storage.getItem(SAVE_KEY)!;
    expect(JSON.parse(raw).version).toBe(4);
    const restored = new GameSession(new SaveStore(storage));
    expect(restored.player.progression!.learned).toContain("sage.A1");
    expect(restored.player.level).toBe(4);
    g.command({ type: "learn-skill", id: "sage.A2" });
    restored.player.gold = 999;
    restored.flush();
    expect(restored.saves!.warning).toContain("innej karcie");
    expect(storage.getItem(SAVE_KEY)).not.toBe(raw);
  });
  it("preserves invalid/future allocations without overwriting or silently resetting them", () => {
    for (const learned of [
      ["sage.R", "sage.A9"],
      ["sage.R", "sage.A1", "sage.A1"],
      ["sage.R", "android.A1"],
    ]) {
      const storage = memory(),
        p = newPlayer("sage", true);
      p.level = 20;
      p.progression!.learned = learned;
      const raw = JSON.stringify({ version: 4, revision: "corrupt", player: p });
      storage.setItem(SAVE_KEY, raw);
      const g = new GameSession(new SaveStore(storage));
      g.flush();
      expect(storage.getItem(SAVE_KEY)).toBe(raw);
      expect(g.saves!.warning).not.toBe("");
    }
  });
  it("refuses migration when recovery storage fails, keeping the original", () => {
    const legacy = JSON.stringify({ version: 3, revision: "old", player: newPlayer() });
    let current = legacy;
    const storage = {
      getItem: (k: string) => (k === SAVE_KEY ? current : null),
      setItem: (k: string, v: string) => {
        if (k !== SAVE_KEY) throw Error("full");
        current = v;
      },
    };
    const g = new GameSession(new SaveStore(storage));
    g.command({ type: "activate-progression" });
    expect(current).toBe(legacy);
    expect(g.saves!.warning).not.toBe("");
  });
});

describe("real session mechanics for the four races", () => {
  it("resistance passives shorten control, and fortification grants immunity", () => {
    const g = game("planetary", 20, ["C1", "C2", "C4", "C5"]);
    g.raceCombat.receiveControl("stun", 1000);
    expect(g.raceCombat.locked).toBe(true);
    ticks(g, 750);
    expect(g.raceCombat.locked).toBe(false);
    const a = game("android", 20, path("B"));
    a.command({ type: "cast-skill", id: "android.B9" });
    a.raceCombat.receiveControl("stun", 3000);
    expect(a.raceCombat.locked).toBe(false);
  });
  it("an active form and Android shutdown survive reload without resetting cooldowns", () => {
    const storage = memory(),
      g = new GameSession(new SaveStore(storage), "android", true);
    g.player.level = 20;
    const p = g.player.progression!;
    for (const c of [...path("C"), "T"])
      expect(learnSkill("android", 20, p, skillId("android", c))).toBe(true);
    g.player.ki = stats(g.player).maxKi;
    g.command({ type: "cast-skill", id: "android.T" });
    g.command({ type: "cast-skill", id: "android.C9" });
    const loaded = new GameSession(new SaveStore(storage));
    expect(loaded.snapshot().progression!.form).toBe(20000);
    ticks(loaded, 6000);
    expect(loaded.raceCombat.locked).toBe(true);
    loaded.flush();
    const again = new GameSession(new SaveStore(storage));
    expect(again.raceCombat.locked).toBe(true);
    ticks(again, 2000);
    expect(again.raceCombat.locked).toBe(false);
    expect(again.player.progression!.cooldowns["android.C9"]).toBe(37000);
  });
  it("enforces learning through commands and does not heal on reset or regain points after reload", () => {
    const g = game("planetary", 4);
    g.player.hp = 50;
    g.player.ki = 20;
    g.command({ type: "learn-skill", id: "planetary.C1" });
    g.command({ type: "learn-skill", id: "planetary.C2" });
    expect(g.player.hp).toBeLessThanOrEqual(50);
    expect(g.player.ki).toBeLessThanOrEqual(20);
    g.command({ type: "reset-skills" });
    expect(g.player.hp).toBeLessThanOrEqual(50);
    expect(availablePoints(4, g.player.progression!)).toBe(3);
  });
  it("keeps the established game unchanged before activation", () => {
    const g = new GameSession();
    expect(stats(g.player).attack).toBe(18);
    expect(g.player.progression).toBeUndefined();
    const e = near(g);
    g.command({ type: "ability", ability: "pulse" });
    expect(e.hp).toBe(9971);
  });
  it("Planetarni: heals over four ticks, refunds only at completion, pauses effects and preserves cooldowns", () => {
    const g = game("planetary", 20, ["C1", "C2", "C4", "C6", "C8"]);
    g.player.hp = 100;
    g.player.ki = 50;
    g.command({ type: "cast-skill", id: "planetary.C1" });
    expect(g.player.ki).toBe(38);
    expect(g.player.hp).toBe(100);
    g.command({ type: "pause", value: true });
    ticks(g, 4000);
    expect(g.player.hp).toBe(100);
    expect(g.player.progression!.cooldowns["planetary.C1"]).toBe(12000);
    g.command({ type: "pause", value: false });
    ticks(g, 4000);
    expect(g.player.hp).toBeGreaterThan(230);
    expect(g.player.ki).toBeGreaterThan(53);
  });
  it("Mędrcy: moving interrupts a channel without refund; full channel restores Ki and a mark explodes later", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const g = game("sage", 20, ["C1", "A1"]);
    g.player.ki = 20;
    g.command({ type: "cast-skill", id: "sage.C1" });
    g.manual(1, 0, 50);
    ticks(g, 3000);
    expect(g.player.ki).toBeLessThan(40);
    g.player.progression!.cooldowns["sage.C1"] = 0;
    g.command({ type: "cast-skill", id: "sage.C1" });
    ticks(g, 3000);
    expect(g.player.ki).toBeGreaterThan(90);
    const e = near(g);
    g.command({ type: "cast-skill", id: "sage.A1" });
    expect(e.hp).toBe(10000);
    ticks(g, 3000);
    expect(e.hp).toBeLessThan(9900);
  });
  it("Androidy: sustained shots accumulate heat, pause freezes it and overheat recovers", () => {
    const g = game("android", 1),
      e = near(g);
    e.attackIn = 1e6;
    g.command({ type: "target", id: e.id });
    ticks(g, 17500);
    expect(g.player.progression!.overheat).toBeGreaterThan(0);
    g.command({ type: "pause", value: true });
    const heat = g.player.progression!.overheat;
    ticks(g, 5000);
    expect(g.player.progression!.overheat).toBe(heat);
    g.command({ type: "pause", value: false });
    g.command({ type: "cancel" });
    ticks(g, 2100);
    expect(g.player.progression!.resource).toBe(0);
  });
  it("Androidy: an equipped discharge spends its heat and has its own Ki cost", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const g = game("android", 20, ["C1"]),
      e = near(g); // facing set by a real basic attack
    g.command({ type: "ability", ability: "attack" });
    g.player.progression!.resource = 100;
    const before = e.hp,
      ki = g.player.ki;
    g.command({ type: "cast-skill", id: "android.C1" });
    expect(g.player.progression!.resource).toBe(0);
    expect(e.hp).toBeLessThan(before - 200);
    expect(g.player.ki).toBe(ki - 15);
  });
  it("Legendy: series produces real separated hits and Żar; ultimate follows aggregate armor math", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const g = game("legend", 20, path("A")),
      e = near(g);
    e.attackIn = 1e6;
    g.command({ type: "cast-skill", id: "legend.A9" });
    const first = e.hp;
    expect(first).toBeGreaterThan(9900);
    ticks(g, 650);
    expect(e.hp).toBeLessThan(first - 200);
    expect(g.player.progression!.resource).toBe(32);
  });
  it("a shield absorbs damage once and reflected hits do not recursively generate effects", () => {
    const g = game("android", 20, ["B1"]),
      e = near(g);
    g.player.hp = 100;
    g.command({ type: "cast-skill", id: "android.B1" });
    const shield = g.snapshot().progression!.shield;
    const damage = g.raceCombat.receive(e, 100);
    expect(damage).toBe(0);
    expect(g.player.hp).toBe(100);
    expect(g.snapshot().progression!.shield).toBeLessThan(shield);
  });
  it("every active and ultimate has an executable action, consumes its declared cooldown and rejects another race", () => {
    for (const r of RACE_IDS) {
      for (const n of TREES[r].filter((n) => ["active", "ultimate", "form"].includes(n.kind))) {
        const p = newProgression(r);
        // Legal shortest paths; prerequisites are selected recursively, never grants of free points.
        const add = (id: string) => {
          const a = NODES[id]!;
          if (p.learned.includes(id)) return;
          if (a.requires[0]) add(a.requires[0]);
          expect(learnSkill(r, 20, p, id), id).toBe(true);
        };
        add(n.id);
        const g = game(r);
        g.player.progression = p;
        const e = near(g);
        g.player.ki = 1000;
        p.resource = 100;
        if (r === "android" && ["A4", "A9"].includes(n.code)) {
          learnSkill(r, 20, p, "android.A1");
          equipSkill(p, "android.A1", 0);
          g.command({ type: "cast-skill", id: "android.A1" });
        }
        if (n.kind === "active") equipSkill(p, n.id, 0);
        if (n.kind === "ultimate") equipSkill(p, n.id, 3);
        g.command({ type: "cast-skill", id: n.id });
        expect(p.cooldowns[n.id], n.id).toBeGreaterThan(0);
        expect(e.hp).toBeGreaterThanOrEqual(0);
        expect(g.player.ki).toBeGreaterThanOrEqual(0);
        const ki = g.player.ki;
        g.command({ type: "cast-skill", id: skillId(r === "sage" ? "legend" : "sage", "A1") });
        expect(g.player.ki).toBe(ki);
      }
    }
  });
});
