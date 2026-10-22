import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks, worldAssets, worldRenderRefs } from "../game/assets/catalog";
import { WORLDS } from "../game/world/worlds";

const allPacks = (imported as unknown[]).map((p) => PackSchema.parse(p));
/** Later public packs that intentionally override the start-point surfaces and add scenery. */
const LATER = new Set([
  "aether-terrain-v2",
  "nexus-terrain-v2",
  "pyra-terrain-v2",
  "nature-textures-v1",
  "nature-objects-v1",
]);
const packs = allPacks.filter((p) => !LATER.has(p.id));
for (const world of ["nexus", "pyra"] as const) {
  describe(world + " anime start art", () => {
    it("is the default art in the game", () => {
      const pack = packs.find((p) => p.id === world + "-start");
      expect(pack?.previewOnly).toBe(false);
      const ids = worldAssets(world, false, makeCatalog(allPacks, previewPacks(""))).map(
        (a) => a.id,
      );
      expect(
        makeCatalog(packs, previewPacks("")).renderBindings["terrain." + world + "-ground"],
      ).toBeTruthy();
      expect(ids).toContain(world + "-terrain-v2-ground");
      expect(ids).toContain("nature-obj-" + (world === "pyra" ? "volcano-active" : "ice-spires"));
    });
    it("loads independent images for every object and all four surfaces", () => {
      const source = makeCatalog(packs, [world + "-start"]);
      const ids = worldAssets(world, false, source).map((a) => a.id);
      for (const object of WORLDS[world].objects.filter((o) => !o.asset?.startsWith("nature."))) {
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
