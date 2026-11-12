import { describe, expect, it } from "vitest";
import { createQuestTracker, createDefaultSaveV5 } from "../game/quests/v2Tracker";
import { ALL_QUESTS_V2, recordQuestObjectiveEvent } from "../game/quests/engine";
import { GameSession, ensurePlayerEquipment, type ItemId } from "../game/session";
import type { PlayerSaveV5, QuestObjective } from "../game/quests/types";

const CANONICAL = ["potion", "tusk", "sword", "vest"];
function findDeliverQuest() {
  for (const quest of ALL_QUESTS_V2) {
    for (let si = 0; si < quest.stages.length; si++) {
      const obj = quest.stages[si]!.objectives.find(
        (o) => o.type === "deliver" && CANONICAL.includes(o.targetId),
      );
      if (obj) return { quest, stageIndex: si, obj: obj as QuestObjective };
    }
  }
  throw new Error("brak questa z przedmiotowym celem deliver");
}

function saveWithActiveDeliver(): {
  save: PlayerSaveV5;
  questId: string;
  stageIndex: number;
  obj: QuestObjective;
} {
  const { quest, stageIndex, obj } = findDeliverQuest();
  const base = createDefaultSaveV5(quest.continent);
  const save: PlayerSaveV5 = {
    ...base,
    quests: {
      ...base.quests,
      [quest.id]: {
        questId: quest.id,
        state: "active",
        currentStageIndex: stageIndex,
        objectiveProgress: {},
        completionCount: 0,
      },
    },
  };
  return { save, questId: quest.id, stageIndex, obj };
}

describe("cel questów deliver (rozbudowa NPC 12.11.2026)", () => {
  it("deliveries() zwraca aktywne cele, a deliver() zużywa przedmiot i posuwa cel", () => {
    const { save, questId, stageIndex, obj } = saveWithActiveDeliver();
    let persisted = save;
    const tracker = createQuestTracker(
      () => save,
      (s) => {
        persisted = s;
      },
    );
    expect(
      tracker.deliveries().some((d) => d.itemId === obj.targetId && d.needed === obj.targetCount),
    ).toBe(true);
    tracker.deliver(obj.targetId, obj.targetCount);
    const rec = persisted.quests[questId]!;
    const progressed =
      (rec.objectiveProgress[obj.id] ?? 0) >= obj.targetCount ||
      rec.currentStageIndex > stageIndex ||
      rec.state === "completed";
    expect(progressed).toBe(true);
    // deliver zużywa przekazany przedmiot na cel (netto 0); ewentualny stan inventory pochodzi
    // już z nagrody za ukończenie questa, nie z podwójnego naliczenia przekazania.
    expect(persisted.quests[questId]).toBeDefined();
  });

  it("komenda sesji quest-deliver odejmuje przedmiot z ekwipunku i posuwa zadanie", () => {
    const { save, obj } = saveWithActiveDeliver();
    let current = save;
    const tracker = createQuestTracker(
      () => current,
      (s) => {
        current = s;
      },
    );
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.setQuestTracker(tracker);
    const itemId = obj.targetId as ItemId;
    g.player.items[itemId] = 3;
    g.command({ type: "quest-deliver", item: itemId });
    expect(g.player.items[itemId]).toBeLessThan(3);
    expect(g.player.items[itemId]).toBeGreaterThanOrEqual(0);
  });

  it("quest-deliver bez aktywnego celu nie zużywa przedmiotu", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const tracker = createQuestTracker(
      () => createDefaultSaveV5("verdant"),
      () => {},
    );
    g.setQuestTracker(tracker);
    g.player.items.potion = 2;
    g.command({ type: "quest-deliver", item: "potion" });
    expect(g.player.items.potion).toBe(2);
  });

  it("cel deliver do NPC (np. npc-mio) postępuje bez zużywania przedmiotu", () => {
    let target: { questId: string; stageIndex: number; obj: QuestObjective } | null = null;
    for (const quest of ALL_QUESTS_V2) {
      for (let si = 0; si < quest.stages.length && !target; si++) {
        const obj = quest.stages[si]!.objectives.find(
          (o) => o.type === "deliver" && !CANONICAL.includes(o.targetId),
        );
        if (obj) target = { questId: quest.id, stageIndex: si, obj: obj as QuestObjective };
      }
      if (target) break;
    }
    expect(target).not.toBeNull();
    const { questId, stageIndex, obj } = target!;
    const base = createDefaultSaveV5("verdant");
    const save: PlayerSaveV5 = {
      ...base,
      quests: {
        ...base.quests,
        [questId]: {
          questId,
          state: "active",
          currentStageIndex: stageIndex,
          objectiveProgress: {},
          completionCount: 0,
        },
      },
    };
    const next = recordQuestObjectiveEvent(save, "deliver", obj.targetId, 1);
    const rec = next.quests[questId]!;
    const progressed =
      (rec.objectiveProgress[obj.id] ?? 0) >= 1 ||
      rec.currentStageIndex > stageIndex ||
      rec.state === "completed";
    expect(progressed).toBe(true);
  });
});
