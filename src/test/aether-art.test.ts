import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json" with { type: "json" };
import { PackSchema } from "../game/assets/schema";
import {
  actorVisual,
  makeCatalog,
  previewPacks,
  worldAssets,
  worldRenderRefs,
} from "../game/assets/catalog";
import { WORLDS, worldObstacles } from "../game/world/worlds";

const packs = (imported as unknown[]).map((p) => PackSchema.parse(p));
const pack = packs.find((p) => p.id === "aether-sanctuary")!;

describe("Aetheria anime start-point art", () => {
  it("is the default Aetheria art (owner moved it into the game)", () => {
    expect(pack.previewOnly).toBe(false);
    expect(packs.find((p) => p.id === "aether-expansion")?.previewOnly).toBe(false);
    expect(actorVisual("aether", "hero").id).toBe("hero-sage-painted");
  });

  it("replaces every Aetheria object and terrain texture when enabled", () => {
    const source = makeCatalog(packs);
    const ids = worldAssets("aether", false, source).map((a) => a.id);
    for (const object of WORLDS.aether.objects)
      expect(source.renderBindings["object." + object.asset]?.asset).toMatch(/^aether-(art|x)-/);
    for (const key of ["ground", "path", "plaza"] as const)
      expect(ids).toContain("aether-art-" + WORLDS.aether.terrain![key]);
    expect(ids).toContain("aether-art-aether-wall");
    expect(ids.some((id) => WORLDS.aether.objects.some((o) => o.asset === id))).toBe(false);
  });

  it("uses the painted textures by default", () => {
    const source = makeCatalog(packs, previewPacks(""));
    expect(worldRenderRefs("aether", source).some((r) => r.asset.startsWith("aether-art-"))).toBe(
      true,
    );
  });

  it("does not change collision footprints, spawn or layout", () => {
    expect(WORLDS.aether.spawn).toEqual({ x: 1150, y: 1130 });
    const sanctum = worldObstacles(WORLDS.aether).find((o) => o.width === 370 && o.height === 150);
    expect(sanctum).toEqual({ x: 1015, y: 355, width: 370, height: 150 });
  });
});
