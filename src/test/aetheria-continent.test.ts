import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json";
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks } from "../game/assets/catalog";
import {
  aetheriaBiomeAt,
  aetheriaObjects,
  aetheriaRoadside,
  aetheriaSceneryName,
} from "../game/world/generated/aetheriaContinent";
import type { ArtObject } from "../game/world/generated/renderSuperior";
import type { BrowserChunk } from "../game/world/generated/browserLoader";
const tree: ArtObject = {
  id: "aether-test",
  kind: "tree",
  binding: "object.ki-v2-objects.aether-oak-1",
  x: 500,
  y: 600,
  width: 300,
  height: 400,
  anchorX: 0.5,
  anchorY: 0.92,
  solid: true,
  footprint: { width: 50, height: 50 },
};
describe("Aetheria presentation safety", () => {
  it("adds a default-on pack (=0 opts out) without replacing any previous binding", () => {
    expect(previewPacks("")).toContain("aetheria-continent-v2");
    expect(previewPacks("?ki-aetheria-continent=0")).not.toContain("aetheria-continent-v2");
    const packs = imported.map((p) => PackSchema.parse(p)),
      pack = packs.find((p) => p.id === "aetheria-continent-v2")!;
    expect(pack.assets).toHaveLength(36);
    expect(new Set(pack.assets.map((a) => a.id)).size).toBe(36);
    expect(pack.assets.reduce((n, a) => n + a.width! * a.height! * 4, 0)).toBeLessThan(
      28 * 1024 * 1024,
    );
    const base = makeCatalog(packs, previewPacks("?ki-aetheria-continent=0")),
      preview = makeCatalog(packs, previewPacks("?ki-aetheria-continent=1"));
    for (const [k, v] of Object.entries(base.renderBindings))
      expect(preview.renderBindings[k]).toEqual(v);
  });
  it("reads the authored biome cells without changing the chunk", () => {
    const chunk: BrowserChunk = {
      format: "superior-browser-1",
      id: "0-0",
      x: 0,
      y: 0,
      terrain: {
        cell: 32,
        width: 2,
        height: 2,
        flags: [[17, 4]],
        biome: [
          [0, 1],
          [1, 1],
          [2, 1],
          [3, 1],
        ],
      },
      navigation: { cell: 16, width: 4, height: 4, blocked: [[0, 16]] },
      colliders: [],
      objects: [],
    };
    const before = structuredClone(chunk),
      at = aetheriaBiomeAt(chunk);
    expect(
      [
        [10, 10],
        [40, 10],
        [10, 40],
        [40, 40],
      ].map(([x, y]) => at({ x: x!, y: y! })),
    ).toEqual([0, 1, 2, 3]);
    expect(chunk).toEqual(before);
  });
  it("keeps safe cities unchanged and never thins physical objects", () => {
    expect(aetheriaObjects([tree], () => false)).toEqual([tree]);
    for (const climate of [0, 1, 2, 3]) {
      const before = structuredClone(tree),
        [mapped] = aetheriaObjects(
          [tree],
          () => true,
          [],
          () => climate,
        );
      const { binding: _original, ...a } = tree,
        { binding: _replacement, ...b } = mapped!;
      expect(b).toEqual(a);
      expect(tree).toEqual(before);
    }
  });
  it("keeps warm canopy variants independent from thinning and uses snowy trees in cold biomes", () => {
    const trees = Array.from({ length: 1000 }, (_, i) => {
      const { footprint: _f, ...rest } = tree;
      return {
        ...rest,
        id: "tree-" + i,
        solid: false,
        x: i * 71 + 7,
        y: i * 53 + 8000,
        binding: i % 3 === 0 ? "object.ki-v2-objects.aether-pine-0" : tree.binding,
      };
    });
    const warm = aetheriaObjects(
        trees,
        () => true,
        [],
        () => 1,
      ),
      cold = aetheriaObjects(
        trees,
        () => true,
        [],
        () => 3,
      );
    expect(new Set(warm.map((t) => t.binding))).toEqual(
      new Set(["cherry", "ginkgo", "cypress"].map((n) => "object.aetheria-continent." + n)),
    );
    expect(cold.length).toBeGreaterThan(0);
    expect(new Set(cold.map((t) => t.binding))).toEqual(
      new Set(["object.aetheria-continent.snow-pine"]),
    );
    expect(aetheriaSceneryName({ ...tree, binding: "object.cherry-tree" }, 3)).toBe("snow-pine");
  });
  it("adds only nonphysical roadside vegetation outside cities and warm biomes", () => {
    const roads = [
      {
        points: [
          [0, 500],
          [4000, 500],
        ] as [number, number][],
        width: 80,
        kind: "road",
      },
    ];
    expect(
      aetheriaRoadside(
        0,
        0,
        roads,
        () => false,
        () => true,
        () => 0,
      ),
    ).toEqual([]);
    expect(
      aetheriaRoadside(
        0,
        0,
        roads,
        () => true,
        () => true,
        () => 3,
      ),
    ).toEqual([]);
    const items = aetheriaRoadside(
      0,
      0,
      roads,
      () => true,
      () => true,
      () => 0,
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.solid).toBe(false);
      expect(item.footprint).toBeUndefined();
    }
  });
});
