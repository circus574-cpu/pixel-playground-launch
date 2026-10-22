import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks, worldAssets, worldRenderRefs } from "../game/assets/catalog";
import { WORLDS } from "../game/world/worlds";

const packs = (imported as unknown[]).map((p) => PackSchema.parse(p));
for (const world of ["nexus", "pyra"] as const) {
  describe(world + " anime start art", () => {
    it("is opt-in until owner acceptance", () => {
      const pack = packs.find((p) => p.id === world + "-start");
      expect(pack?.previewOnly).toBe(true);
      expect(previewPacks("")).not.toContain(world + "-start");
      expect(previewPacks("?ki-" + world + "-art=1")).toContain(world + "-start");
      expect(previewPacks("?ki-" + world + "-art=0")).not.toContain(world + "-start");
    });
    it("loads independent images for every object and all four surfaces", () => {
      const source = makeCatalog(packs, [world + "-start"]);
      const ids = worldAssets(world, false, source).map((a) => a.id);
      for (const object of WORLDS[world].objects) {
        expect(source.renderBindings["object." + object.asset]?.asset).toMatch(
          new RegExp("^" + world + "-art-"),
        );
      }
      for (const key of ["ground", "path", "plaza", "wall"])
        expect(ids).toContain(world + "-art-" + key);
    });
    it("leaves other continents and actor bindings unchanged", () => {
      const base = makeCatalog(packs);
      const enabled = makeCatalog(packs, [world + "-start"]);
      expect(enabled.actorBindings).toEqual(base.actorBindings);
      for (const other of ["verdant", "aether", "nexus", "pyra"] as const)
        if (other !== world)
          expect(worldRenderRefs(other, enabled)).toEqual(worldRenderRefs(other, base));
    });
  });
}
