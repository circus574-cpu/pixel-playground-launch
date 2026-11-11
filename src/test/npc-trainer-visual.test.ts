import { expect, it } from "vitest";
it("shows the Trener turnaround for the Pyra training NPC and keeps the other roles on their defaults", async () => {
  const { actorVisual } = await import("../game/assets/catalog");
  const trainer = actorVisual("pyra", "npc", "trainer");
  expect(trainer.id).toBe("npc-pyra-trainer");
  expect(trainer.profile).toBe("npc");
  expect(Object.keys(trainer.clips).sort()).toEqual(["idle", "walk"]);
  expect(trainer.clips["idle"]!.directions["left"]).toHaveLength(8);
  expect(actorVisual("pyra", "npc", "trainer").id).not.toBe(
    actorVisual("pyra", "npc", "npc-rokan").id,
  );
  expect(actorVisual("verdant", "npc", "trainer").id).not.toBe("npc-pyra-trainer");
});
