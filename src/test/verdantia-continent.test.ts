import { describe, expect, it } from "vitest";
import { catalog, makeCatalog, previewPacks } from "../game/assets/catalog";
import { PackSchema } from "../game/assets/schema";
import imported from "../game/assets/imported.json";
import {
  continentObjects,
  continentRoadside,
  roadDistance,
  extraSceneryName,
} from "../game/world/generated/verdantiaContinent";
import type { ArtObject } from "../game/world/generated/renderSuperior";

const tree: ArtObject = {
  id: "oak",
  binding: "object.ki-v2-objects.verdant-oak-0",
  kind: "tree",
  x: 500,
  y: 600,
  width: 240,
  height: 300,
  anchorX: 0.5,
  anchorY: 0.92,
  solid: false,
};
describe("Verdantia continent presentation safety", () => {
  it("retains all three new tree variants after decorative canopy thinning", () => {
    const key = "object.verdantia-extra.fern",
      previous = catalog.renderBindings[key];
    catalog.renderBindings[key] = { asset: "test-preview-marker", fit: "contain" };
    try {
      const items = Array.from({ length: 400 }, (_, i) => ({
        ...tree,
        id: "oak-" + i,
        x: 1000 + (i % 20) * 73,
        y: 2000 + Math.floor(i / 20) * 89,
      }));
      const mapped = continentObjects(items, () => true);
      const names = new Set(mapped.map((o) => o.binding));
      for (const name of ["ancient-oak", "birch", "willow"])
        expect(names.has("object.verdantia-extra." + name)).toBe(true);
      expect(mapped.length).toBeLessThan(items.length);
    } finally {
      if (previous) catalog.renderBindings[key] = previous;
      else delete catalog.renderBindings[key];
    }
  });
  it("is default-on (=0 opts out) and leaves the accepted city bindings intact", () => {
    expect(previewPacks("")).toContain("verdantia-continent-v2");
    expect(previewPacks("?ki-verdant-continent=0")).not.toContain("verdantia-continent-v2");
    expect(previewPacks("?ki-verdant-continent=1")).toContain("verdantia-continent-v2");
    const packs = imported.map((p) => PackSchema.parse(p));
    const reviewPack = packs.find((p) => p.id === "verdantia-continent-v2")!;
    expect(reviewPack.assets.reduce((sum, a) => sum + a.width! * a.height! * 4, 0)).toBeLessThan(
      20 * 1024 * 1024,
    );
    const extra = packs.find((p) => p.id === "verdantia-extra-runtime")!;
    expect(extra.assets).toHaveLength(26);
    expect(extra.assets.reduce((sum, a) => sum + a.width! * a.height! * 4, 0)).toBeLessThan(
      16 * 1024 * 1024,
    );
    const original = makeCatalog(packs, previewPacks("?ki-verdant-continent=0"));
    const review = makeCatalog(packs, previewPacks("?ki-verdant-continent=1"));
    for (const [key, value] of Object.entries(original.renderBindings))
      expect(review.renderBindings[key]).toEqual(value);
  });
  it("keeps city scenery and all physical metadata unchanged, without mutating the source", () => {
    // The extra scenery pack is default-on now; switch it off here so this checks the base continent mapping.
    const key = "object.verdantia-extra.fern",
      previous = catalog.renderBindings[key];
    delete catalog.renderBindings[key];
    try {
      expect(continentObjects([tree], () => false)).toEqual([tree]);
      const solid = { ...tree, solid: true, footprint: { x: 480, y: 590, width: 40, height: 20 } };
      const result = continentObjects([solid], () => true)[0]!;
      expect(result.binding).toBe("object.verdantia-continent.oak");
      const { binding: _binding, ...physical } = result;
      const { binding: _original, ...expected } = solid;
      expect(physical).toEqual(expected);
      expect(solid.binding).toBe(tree.binding);
    } finally {
      if (previous) catalog.renderBindings[key] = previous;
    }
  });
  it("keeps roadside flora on land, outside cities and away from the path centre", () => {
    const road = {
      points: [
        [-10000, 800],
        [10000, 800],
      ] as [number, number][],
      width: 96,
      kind: "road",
    };
    const plants = continentRoadside(
      0,
      0,
      [road],
      (p) => p.x > 500,
      (p) => p.x < 1800,
    );
    expect(plants.length).toBeGreaterThan(0);
    expect(
      continentRoadside(
        0,
        0,
        [road],
        () => true,
        () => false,
      ),
    ).toEqual([]);
    for (const p of plants) {
      expect(p.x).toBeGreaterThan(500);
      expect(p.x).toBeLessThan(1800);
      expect(p.solid).toBe(false);
      expect(roadDistance(p, road)).toBeGreaterThanOrEqual(84);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(2048);
    }
    expect(plants).toEqual(
      continentRoadside(
        0,
        0,
        [road],
        (p) => p.x > 500,
        (p) => p.x < 1800,
      ),
    );
  });
  it("handles repeated points and computes distance to segment interiors", () => {
    expect(
      roadDistance(
        { x: 50, y: 20 },
        {
          points: [
            [0, 0],
            [0, 0],
            [100, 0],
          ],
          width: 40,
          kind: "trail",
        },
      ),
    ).toBe(20);
  });
  it("matches replacement art to existing world semantics without touching source geometry", () => {
    const specimens = [
      ["object.ki-v2-objects.verdant-stump-0", "stump"],
      ["object.ki-v2-objects.verdant-mushrooms-1", "mushrooms"],
      ["object.ki-v2-camps.verdant-tent", "camp"],
      ["object.ki-v2-camps.verdant-crates", "chest"],
      ["object.biome-mountain.cliff-outcrop", "cliff"],
      ["object.biome-mountain.rock-with-a-small-waterfall", "spring"],
      ["object.ki-v2-landmarks.verdant-bridge", "bridge"],
    ];
    for (const [binding, expected] of specimens) {
      const item = { ...tree, binding: binding! };
      const before = structuredClone(item);
      expect(extraSceneryName(item)).toBe(expected);
      expect(item).toEqual(before);
    }
    expect(
      extraSceneryName({ ...tree, binding: "object.ki-v2-buildings.verdant-house" }),
    ).toBeUndefined();
  });
});
