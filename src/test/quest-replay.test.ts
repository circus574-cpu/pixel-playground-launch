import { describe, expect, it } from "vitest";
import {
  ALL_QUESTS_V2,
  createDefaultSaveV5,
  recordQuestObjectiveEvent,
  startQuest,
  syncQuestAvailability,
} from "../game/quests/engine";
import type { ObjectiveType, PlayerSaveV5 } from "../game/quests/types";

/**
 * A scene reload re-fires "visit", "talk" and "discover" events (entering the town again, walking
 * past the same place). Those objectives must never pay a reward or count progress twice.
 */
const ONCE: ObjectiveType[] = ["visit", "talk", "discover"];
const rewards = (s: PlayerSaveV5) =>
  JSON.stringify([
    s.xp,
    s.coins,
    s.inventory,
    s.rewardClaimedQuestIds,
    s.discoveryRewardClaimedIds,
    s.factionReputation,
  ]);

function started(questId: string): PlayerSaveV5 {
  const base = createDefaultSaveV5("verdant");
  return startQuest(syncQuestAvailability({ ...base, level: 100 }), questId);
}

describe("powtórzone zdarzenia celów zadań", () => {
  const candidates = ALL_QUESTS_V2.filter(
    (q) =>
      q.playableInCurrentRuntime &&
      q.stages[0]?.objectives.length &&
      q.stages[0].objectives.every((o) => ONCE.includes(o.type)),
  );

  it("istnieją zadania z celami jednorazowego typu do sprawdzenia", () => {
    expect(candidates.length).toBeGreaterThan(5);
  });

  it("żaden cel visit/talk/discover nie wymaga więcej niż jednego zdarzenia", () => {
    for (const q of ALL_QUESTS_V2)
      for (const stage of q.stages)
        for (const o of stage.objectives)
          if (ONCE.includes(o.type)) expect(o.targetCount, q.id + " " + o.id).toBe(1);
  });

  it("ponowne zdarzenie po zaliczeniu celu nie zmienia nagród ani postępu", () => {
    let checked = 0;
    for (const q of candidates) {
      const first = started(q.id);
      if (first.quests[q.id]?.state !== "active") continue;
      let once = first;
      for (const o of q.stages[0]!.objectives)
        once = recordQuestObjectiveEvent(once, o.type, o.targetId);
      let replayed = once;
      for (let i = 0; i < 3; i++)
        for (const o of q.stages[0]!.objectives)
          replayed = recordQuestObjectiveEvent(replayed, o.type, o.targetId);
      expect(rewards(replayed), q.id).toBe(rewards(once));
      expect(replayed.quests[q.id]?.currentStageIndex, q.id).toBe(
        once.quests[q.id]?.currentStageIndex,
      );
      expect(replayed.quests[q.id]?.completionCount, q.id).toBe(once.quests[q.id]?.completionCount);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
});
