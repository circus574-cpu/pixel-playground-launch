import { describe, expect, it } from "vitest";
import { GameSession, SaveStore, newPlayer } from "../game/session";
import { cityRoom } from "../game/city/room";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { DevelopmentSchema, emptyDevelopment } from "../game/development/state";
import { TRIALS, trialReceipt, domainRank } from "../game/development/trials/catalog";
import { completeTrial, walkTrial } from "./helpers/racialTrials";
import { TrialAttempt } from "../game/development/trials/attempt";
import { trialPuzzles } from "../game/development/trials/puzzles";

function fixture(race: RaceId = "planetary") {
  const data = new Map<string, string>();
  let failing = false;
  const port = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failing) throw Error("fixture storage outage");
      data.set(k, v);
    },
  };
  const p = newPlayer(race),
    room = cityRoom("arena", p.continent);
  p.interior = "arena";
  p.x = room.npc.x;
  p.y = room.npc.y + 40;
  const save = new SaveStore(port, race);
  save.load();
  expect(save.save(p)).toBe(true);
  const s = new GameSession(new SaveStore(port, race), race);
  expect(s.developmentServiceReady).toBe(true);
  return {
    s,
    port,
    data,
    fail: (v: boolean) => {
      failing = v;
    },
  };
}
describe("racial trial results are owned, atomic and finite", () => {
  it.each(RACE_IDS)(
    "earns all three grades in its domain, keeps loan state out of the owner and reloads: %s",
    (race) => {
      const { s, port } = fixture(race),
        original = structuredClone(s.player);
      s.kit.cooldowns["A1"] = 1234;
      for (const def of TRIALS.filter((t) => t.race === race)) {
        expect(s.startRacialTrial(def.id, 2)).toBeUndefined();
        for (const tier of [1, 2, 3] as const) {
          const a = s.startRacialTrial(def.id, tier)!;
          expect(a).toBeDefined();
          expect(s.startDevelopmentExam("strength", 1, true)).toBeUndefined();
          expect(s.startRacialTrial(def.id, tier)).toBeUndefined();
          expect(s.finishRacialTrial(a)).toBe(false);
          completeTrial(a);
          expect(s.finishRacialTrial(a)).toBe(true);
          expect(s.finishRacialTrial(a)).toBe(false);
          expect(s.player.development!.trials[def.id]).toBe(tier);
        }
      }
      const d = s.player.development!;
      expect(domainRank(d.trials, race, TRIALS.find((t) => t.race === race)!.domain)).toBe(3);
      expect(d.practiceEarned).toBe(5400);
      expect(DevelopmentSchema.safeParse(d).success).toBe(true);
      if (race === "planetary") {
        expect(d.unlockedVariants).toContain("mv-earth");
        expect(d.unlockedVariants).toContain("mv-trail");
        expect(d.unlockedVariants).toContain("mv-root");
      }
      if (race === "sage") {
        expect(d.unlockedVariants).toContain("ma-seal");
        expect(d.unlockedVariants).toContain("ma-barrier");
        expect(d.unlockedVariants).toContain("ma-focus");
      }
      if (race === "legend") {
        expect(d.unlockedVariants).toContain("mp-cuts");
        expect(d.unlockedVariants).toContain("mp-break");
        expect(d.unlockedVariants).toContain("mp-burst");
      }
      if (race === "android") {
        expect(d.unlockedVariants).toContain("mn-barrier");
        expect(d.unlockedModules).toContain("mn-shield");
        expect(d.unlockedModules).toContain("mn-optics");
        expect(d.unlockedModules).toContain("mn-precision");
        expect(d.unlockedVariants).toContain("mn-mark");
      }
      const { development: _development, ...after } = s.player;
      expect(after).toEqual(original);
      expect(s.kit.cooldowns["A1"]).toBe(1234);
      const restored = new SaveStore(port, race).load()!;
      expect(restored.development).toEqual(d);
      const again = s.startRacialTrial(TRIALS.find((t) => t.race === race)!.id, 1)!;
      completeTrial(again);
      expect(s.finishRacialTrial(again)).toBe(true);
      expect(s.player.development!.practiceEarned).toBe(5400);
    },
  );
  it("refuses a constructed or foreign result and requires the physical trainer", () => {
    const { s } = fixture("sage");
    const foreign = new TrialAttempt("TA01", 1);
    completeTrial(foreign);
    expect(s.finishRacialTrial(foreign)).toBe(false);
    expect(s.startRacialTrial("TV10", 1)).toBeUndefined();
    s.player.x += 400;
    expect(s.startRacialTrial("TA01", 1)).toBeUndefined();
    expect(s.player.development).toBeUndefined();
  });
  it("failed storage never publishes a grade or reward and the same result can be retried", () => {
    const { s, fail } = fixture("sage"),
      a = s.startRacialTrial("TA01", 1)!;
    const before = structuredClone(s.player);
    completeTrial(a);
    fail(true);
    expect(s.finishRacialTrial(a)).toBe(false);
    expect(s.player).toEqual(before);
    fail(false);
    expect(s.finishRacialTrial(a)).toBe(true);
    expect(s.player.development!.practiceEarned).toBe(100);
  });
  it("a second writer cannot overwrite a completed result", () => {
    const { s, data } = fixture("sage"),
      a = s.startRacialTrial("TA01", 1)!;
    completeTrial(a);
    const external = JSON.stringify({ ...JSON.parse(data.get("sage")!), revision: "other-tab" });
    data.set("sage", external);
    expect(s.finishRacialTrial(a)).toBe(false);
    expect(s.player.development).toBeUndefined();
    expect(data.get("sage")).toBe(external);
  });
  it("retry and leaving preserve the original character and discard test objects", () => {
    const { s } = fixture("sage"),
      a = s.startRacialTrial("TA01", 1)!;
    const before = structuredClone(s.player);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    a.answer(0, "wrong");
    expect(a.snapshot().outcome).toBe("failed");
    const next = s.retryRacialTrial(a)!;
    expect(next.instanceId).not.toBe(a.instanceId);
    expect(s.finishRacialTrial(a)).toBe(false);
    s.leaveRacialTrial(next);
    expect(s.player).toEqual(before);
    expect(s.finishRacialTrial(next)).toBe(false);
  });
  it("validates cumulative receipts and rejects unknown, forged or mismatched grades", () => {
    const d = emptyDevelopment();
    d.trials.TA01 = 2;
    expect(DevelopmentSchema.safeParse(d).success).toBe(false);
    d.rewardReceipts[trialReceipt("TA01", 1)] = { practice: 100 };
    d.rewardReceipts[trialReceipt("TA01", 2)] = { practice: 150 };
    d.practiceEarned = 250;
    expect(DevelopmentSchema.safeParse(d).success).toBe(true);
    d.rewardReceipts[trialReceipt("TA01", 2)] = { practice: 151 };
    d.practiceEarned = 251;
    expect(DevelopmentSchema.safeParse(d).success).toBe(false);
    expect(
      DevelopmentSchema.safeParse({ ...emptyDevelopment(), trials: { future: 1 } }).success,
    ).toBe(false);
  });
  it("schema migration preserves old development and exact old bytes before writer upgrades", () => {
    const { data, port, s } = fixture("sage");
    const old = emptyDevelopment();
    const {
      trials: _trials,
      fieldwork: _fieldwork,
      encounterKnowledge: _encounters,
      completedExpeditions: _expeditions,
      ...v2
    } = old;
    const prior = JSON.stringify({
      version: 9,
      revision: "old-writer",
      player: { ...s.player, development: { ...v2, version: 2 } },
    });
    data.set("sage", prior);
    const save = new SaveStore(port, "sage"),
      loaded = save.load()!;
    expect(loaded.development!.version).toBe(4);
    expect(loaded.development!.trials).toEqual({});
    expect(data.get("sage")).toBe(prior);
    expect(save.save(loaded)).toBe(true);
    expect(JSON.parse(data.get("sage")!).version).toBe(11);
    expect(data.get("ki-legends:recovery:before-v11:sage")).toBe(prior);
    const newer = JSON.stringify({ ...JSON.parse(data.get("sage")!), version: 12 });
    data.set("sage", newer);
    const guard = new SaveStore(port, "sage");
    expect(guard.load()).toBeUndefined();
    expect(guard.save(loaded)).toBe(false);
    expect(data.get("sage")).toBe(newer);
  });
  it("does not unlock a domain variant from two completed trials", () => {
    const { s } = fixture("sage");
    for (const id of ["TA01", "TA02"] as const)
      for (const tier of [1, 2] as const) {
        const a = s.startRacialTrial(id, tier)!;
        completeTrial(a);
        expect(s.finishRacialTrial(a)).toBe(true);
      }
    expect(s.player.development!.unlockedVariants).not.toContain("ma-seal");
    const a = s.startRacialTrial("TA03", 1)!;
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    a.answer(0, trialPuzzles(a.definition, 1)[0]!.answer);
    s.leaveRacialTrial(a);
    expect(s.player.development!.unlockedVariants).not.toContain("ma-seal");
  });
  it.each([true, false])(
    "preserves both Sage domains across saves in either order: memory first=%s",
    (memoryFirst) => {
      const f = fixture("sage");
      let s = f.s;
      const order = memoryFirst ? ["source-memory", "focus"] : ["focus", "source-memory"];
      let expectedPractice = 0;
      const preserved: Record<string, number> = {};
      for (const domain of order) {
        for (const def of TRIALS.filter((t) => t.race === "sage" && t.domain === domain)) {
          for (const tier of [1, 2] as const) {
            const a = s.startRacialTrial(def.id, tier)!;
            completeTrial(a);
            expect(s.finishRacialTrial(a)).toBe(true);
            expectedPractice += tier === 1 ? 100 : 150;
          }
          preserved[def.id] = 2;
        }
        s = new GameSession(new SaveStore(f.port, "sage"), "sage");
        expect(s.player.development!.trials).toEqual(preserved);
        expect(s.player.development!.practiceEarned).toBe(expectedPractice);
        expect(
          domainRank(s.player.development!.trials, "sage", domain as "focus" | "source-memory"),
        ).toBe(2);
        expect(s.player.development!.unlockedVariants.includes("ma-focus")).toBe(
          order.indexOf("focus") <= order.indexOf(domain),
        );
      }
      expect(s.player.development!.unlockedVariants).toContain("ma-focus");
      expect(Object.keys(s.player.development!.trials)).toHaveLength(6);
      const again = s.startRacialTrial("TA10", 1)!;
      completeTrial(again);
      expect(s.finishRacialTrial(again)).toBe(true);
      expect(s.player.development!.practiceEarned).toBe(expectedPractice);
    },
  );
});
