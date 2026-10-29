import { describe, expect, it } from "vitest";
import {
  advanceCombatTraining,
  CombatTrainingSchema,
  emptyCombatTraining,
  techniqueEffects,
  trainedBonuses,
} from "../game/combatTraining";
import {
  GameSession,
  newPlayer,
  stats,
  SaveStore,
  SAVE_KEY,
  type StoragePort,
} from "../game/session";
import { RACE_IDS } from "../game/world/races";

describe("train-only character parameters", () => {
  it("advances only the practiced discipline and never mutates the old save", () => {
    const original = emptyCombatTraining();
    let next = original;
    for (let i = 0; i < 20; i++) next = advanceCombatTraining(next, "technique");
    expect(next.technique).toEqual({ rank: 1, progress: 0 });
    expect(next.dodge).toEqual(original.dodge);
    expect(original.technique.rank).toBe(0);
    expect(CombatTrainingSchema.safeParse(next).success).toBe(true);
  });
  it("caps rank and rejects malformed progress", () => {
    const t = emptyCombatTraining();
    t.dodge = { rank: 100, progress: 0 };
    expect(advanceCombatTraining(t, "dodge")).toEqual(t);
    expect(
      CombatTrainingSchema.safeParse({ ...t, dodge: { rank: 100, progress: 1 } }).success,
    ).toBe(false);
  });
  for (const race of RACE_IDS)
    it(`${race}: level does not award train-only bonuses`, () => {
      const p = newPlayer(race);
      const a = stats(p);
      p.level = 20;
      const b = stats(p);
      for (const key of ["technique", "dodgeChance", "attackSpeedPct"] as const)
        expect(b[key]).toBe(a[key]);
      p.combatTraining = emptyCombatTraining();
      p.combatTraining.attackSpeed.rank = 100;
      p.combatTraining.technique.rank = 100;
      p.combatTraining.dodge.rank = 100;
      const trained = stats(p);
      expect(trained.attackInterval).toBeLessThan(b.attackInterval);
      expect(trained.crit - b.crit).toBe(5);
      expect(trained.dodgeChance).toBe(10);
    });
  it("shows the actual +8 equipped weapon and additive breakdown totals", () => {
    const game = new GameSession(undefined, "planetary");
    game.player.weapon = "sword";
    const view = game.snapshot();
    expect(view.statBreakdown.attack.items).toBe(8);
    for (const row of Object.values(view.statBreakdown))
      expect(row.base + row.training + row.skills + row.items + row.effects + row.gm).toBeCloseTo(
        row.total,
        8,
      );
  });
  it("preserves training and an exact pre-migration backup", () => {
    const data = new Map<string, string>();
    const storage: StoragePort = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
    const p = newPlayer("planetary");
    const old = JSON.stringify({ version: 5, revision: "legacy-fixture", player: p });
    storage.setItem(SAVE_KEY, old);
    const saves = new SaveStore(storage);
    const restored = saves.load()!;
    restored.combatTraining = emptyCombatTraining();
    restored.combatTraining.technique.rank = 7;
    expect(saves.save(restored)).toBe(true);
    expect(new SaveStore(storage).load()?.combatTraining?.technique.rank).toBe(7);
    expect([...data.values()]).toContain(old);
    expect(JSON.parse(data.get(SAVE_KEY)!).version).toBe(8);
  });
  it("has bounded Technique effects and zero bonuses for untrained characters", () => {
    expect(trainedBonuses()).toEqual({ dodgeChance: 0, attackSpeedPct: 0, technique: 0 });
    expect(techniqueEffects(1000)).toEqual({ crit: 5, resetChance: 5, kiDamage: 0.25 });
  });
});
