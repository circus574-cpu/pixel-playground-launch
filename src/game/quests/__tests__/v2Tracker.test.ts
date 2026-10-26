// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("questsV2 tracker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  it("offers Verdantia quests, starts one and advances a talk objective by talking to the game NPC", async () => {
    const { questsV2 } = await import("../v2Tracker");
    const available = questsV2.journal("verdant").filter((q) => q.state === "available");
    expect(available.length).toBeGreaterThan(0);
    const target = available.find(({ quest }) =>
      quest.stages[0]!.objectives.some((o) => o.type === "talk" && o.targetId === "npc-aira"),
    );
    expect(target).toBeDefined();
    questsV2.start(target!.quest.id);
    expect(questsV2.save.quests[target!.quest.id]?.state).toBe("active");
    questsV2.talk("verdant", "verdant-capital", "guide");
    const record = questsV2.save.quests[target!.quest.id]!;
    const progressed =
      record.state === "completed" ||
      record.currentStageIndex > 0 ||
      Object.values(record.objectiveProgress).some((n) => n > 0);
    expect(progressed).toBe(true);
    expect(localStorage.getItem("ki_legends_save_v5")).toContain(target!.quest.id);
    expect(localStorage.getItem("ki-legends:adventure:v1")).toBeNull();
  });
  it("discovers a famous place when the player walks up to it", async () => {
    const { questsV2 } = await import("../v2Tracker");
    const { v2Places } = await import("../../worlds/v2Places");
    const [id, place] = Object.entries(v2Places("verdant")!.famousById)[0]!;
    questsV2.near("verdant", place.x + 100, place.y);
    expect(questsV2.save.discoveredLocationIds).toContain(id);
  });
  it("hands every reward the engine grants to the game (first discovery of a famous place)", async () => {
    const { questsV2 } = await import("../v2Tracker");
    const { v2Places } = await import("../../worlds/v2Places");
    const rewards: { xp: number; gold: number }[] = [];
    questsV2.onReward((r) => rewards.push(r));
    const [, place] = Object.entries(v2Places("aether")!.famousById)[0]!;
    questsV2.near("aether", place.x, place.y);
    expect(rewards.length).toBe(1);
    expect(rewards[0]!.xp + rewards[0]!.gold).toBeGreaterThan(0);
  });
});
