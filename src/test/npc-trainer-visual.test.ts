import { expect, it } from "vitest";
it("gives every world its own Trener (same figure, outfit colour per race) bound to the trainer NPC", async () => {
  const { actorVisual } = await import("../game/assets/catalog");
  const ids = new Set<string>();
  for (const world of ["verdant", "aether", "nexus", "pyra"] as const) {
    const trainer = actorVisual(world, "npc", "trainer");
    expect(trainer.id).toBe(`npc-${world}-trainer`);
    expect(trainer.profile).toBe("npc");
    expect(Object.keys(trainer.clips).sort()).toEqual(["idle", "walk"]);
    for (const direction of [
      "down",
      "down-left",
      "left",
      "up-left",
      "up",
      "up-right",
      "right",
      "down-right",
    ] as const)
      expect(trainer.clips["idle"]!.directions[direction]).toHaveLength(8);
    ids.add(trainer.id);
    // other NPC roles keep their own visuals
    expect(actorVisual(world, "npc", "npc-rokan").id).not.toBe(trainer.id);
  }
  expect(ids.size).toBe(4);
});
