import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks, worldAssets, worldRenderRefs } from "../game/assets/catalog";
import { WORLDS } from "../game/world/worlds";
import { forestObstacles } from "../game/world/forest";

const packs = (imported as unknown[]).map((p) => PackSchema.parse(p));
const VILLAGE = ["cottage", "inn", "forge", "market", "fountain", "lamp", "fence", "bridge"];

describe("verdant anime start village", () => {
  it("is opt-in and the accepted forest stays the default", () => {
    expect(packs.find((p) => p.id === "verdant-start")?.previewOnly).toBe(true);
    expect(previewPacks("")).not.toContain("verdant-start");
    expect(previewPacks("?ki-verdant-art=1")).toContain("verdant-start");
    const base = makeCatalog(packs, previewPacks(""));
    expect(base.renderBindings["terrain.verdant"]).toBeUndefined();
    expect(worldAssets("verdant", false, base).map((a) => a.id)).toContain("forest-terrain");
  });
  it("replaces village pictures and terrain, keeps accepted trees", () => {
    const source = makeCatalog(packs, ["verdant-start"]);
    const ids = worldAssets("verdant", false, source).map((a) => a.id);
    expect(ids).toContain("verdant-art-terrain");
    expect(ids).not.toContain("forest-terrain");
    for (const kind of VILLAGE)
      expect(source.renderBindings["object.forest." + kind]?.asset).toBe("verdant-art-" + kind);
    for (const kind of ["oak", "fir", "bush", "rock"])
      expect(source.renderBindings["object.forest." + kind]).toBeUndefined();
  });
  it("leaves collisions, other continents and actors unchanged", () => {
    const base = makeCatalog(packs);
    const enabled = makeCatalog(packs, ["verdant-start"]);
    expect(enabled.actorBindings).toEqual(base.actorBindings);
    expect(WORLDS.verdant.obstacles).toEqual(forestObstacles());
    for (const other of ["aether", "nexus", "pyra"] as const)
      expect(worldRenderRefs(other, enabled)).toEqual(worldRenderRefs(other, base));
  });
});
