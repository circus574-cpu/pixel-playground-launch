import { expect, it } from "vitest";
const ROLES = ["guide", "smith", "keeper", "innkeeper", "steward", "warden", "merchant"] as const;
const WORLDS = ["verdant", "aether", "nexus", "pyra"] as const;
const DIRECTIONS = [
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
] as const;
it("gives the guide, blacksmith, depositor, innkeeper, steward and warden their own figure in every world", async () => {
  const { actorVisual, catalog } = await import("../game/assets/catalog");
  const ids = new Set<string>();
  for (const world of WORLDS)
    for (const role of ROLES) {
      const npc = actorVisual(world, "npc", role);
      expect(npc.id, `${world}/${role}`).toBe(`npc-${world}-${role}`);
      expect(npc.profile).toBe("npc");
      expect(npc.size).toEqual([150, 150]); // taller than the hero (133), shorter than the Trener (192)
      expect(catalog.actors.get(npc.id)!.size).toEqual([96, 96]); // the pack keeps the contract size
      expect(Object.keys(npc.clips).sort()).toEqual(["idle", "walk"]);
      for (const direction of DIRECTIONS)
        expect(
          npc.clips["idle"]!.directions[direction],
          `${world}/${role}/${direction}`,
        ).toHaveLength(8);
      ids.add(npc.id);
    }
  expect(ids.size).toBe(WORLDS.length * ROLES.length);
});
it("keeps the shared stand-in for the roles without a film (hunter, alchemist) and the Trener", async () => {
  const { actorVisual } = await import("../game/assets/catalog");
  for (const world of WORLDS) {
    for (const role of ["hunter", "alchemist"] as const)
      expect(actorVisual(world, "npc", role).id, `${world}/${role}`).not.toContain(`-${role}`);
    expect(actorVisual(world, "npc", "trainer").id).toBe(`npc-${world}-trainer`);
  }
});
