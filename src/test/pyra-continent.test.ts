import { describe, it, expect } from "vitest";
import imported from "../game/assets/imported.json";
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks } from "../game/assets/catalog";
import {
  pyraMoltenCell,
  pyraObjects,
  pyraEffectFrame,
  pyraPathScenery,
} from "../game/world/generated/pyraContinent";
import type { ArtObject } from "../game/world/generated/renderSuperior";
const object: ArtObject = {
  id: "pyra-test",
  kind: "landmark",
  binding: "object.biome-volcanic.smoking-volcano",
  x: 500,
  y: 600,
  width: 400,
  height: 450,
  anchorX: 0.5,
  anchorY: 0.92,
  solid: true,
  footprint: { width: 40, height: 40 },
};
describe("Pyra presentation safety", () => {
  it("is opt-in, preserves previous bindings and fits the streaming budget", () => {
    expect(previewPacks("")).not.toContain("pyra-continent-v2");
    const packs = imported.map((p) => PackSchema.parse(p));
    const pack = packs.find((p) => p.id === "pyra-continent-v2")!;
    expect(pack.assets).toHaveLength(52);
    expect(new Set(pack.assets.map((a) => a.id)).size).toBe(52);
    expect(pack.assets.reduce((n, a) => n + a.width! * a.height! * 4, 0)).toBeLessThan(
      32 * 1024 * 1024,
    );
    const base = makeCatalog(packs, previewPacks("")),
      review = makeCatalog(packs, previewPacks("?ki-pyra-continent=1"));
    for (const [k, v] of Object.entries(base.renderBindings))
      expect(review.renderBindings[k]).toEqual(v);
  });
  it("never paints molten lava over walkable terrain or ocean", () => {
    expect(pyraMoltenCell(17, 2)).toBe(false);
    expect(pyraMoltenCell(0, 2)).toBe(false);
    expect(pyraMoltenCell(16, 3)).toBe(false);
    expect(pyraMoltenCell(16, 2)).toBe(true);
  });
  it("preserves safe cities and all physical metadata on existing objects", () => {
    expect(pyraObjects([object], () => false)).toEqual([object]);
    const before = structuredClone(object),
      mapped = pyraObjects([object], () => true)[0]!;
    const { binding: _a, ...a } = object,
      { binding: _b, ...b } = mapped;
    expect(b).toEqual(a);
    expect(object).toEqual(before);
  });
  it("adds only non-solid finite ambient effects and bounds their animation", () => {
    const spring = { ...object, binding: "object.biome-volcanic.sulfur-vent-with-yellow-crust" };
    const effect = pyraObjects([spring], () => true).find((o) => o.kind === "ambient-effect")!;
    expect(effect.solid).toBe(false);
    expect(effect.footprint).toBeUndefined();
    for (const time of [0, 1000, 8500, 1000000]) {
      const f = pyraEffectFrame(effect, time);
      expect(f.alpha).toBeGreaterThanOrEqual(0);
      expect(f.alpha).toBeLessThanOrEqual(0.25);
      expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
    }
  });
  it("keeps decorative passage graphics out of safe cities", () => {
    const roads = [
      {
        points: [
          [0, 0],
          [1200, 0],
        ] as [number, number][],
        width: 96,
        kind: "road",
      },
    ];
    expect(pyraPathScenery(roads, () => false)).toEqual([]);
    for (const p of pyraPathScenery(roads, () => true)) {
      expect(p.solid).toBe(false);
      expect(p.footprint).toBeUndefined();
      expect(p.layer).toBe("below");
    }
  });
});
