import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json";
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks } from "../game/assets/catalog";
import {
  nexusBiomeAt,
  nexusObjects,
  nexusRoadside,
  nexusScatter,
  nexusAir,
  nexusSceneryName,
  nexusEffectFrame,
} from "../game/world/generated/nexusContinent";
import type { ArtObject } from "../game/world/generated/renderSuperior";
import type { BrowserChunk } from "../game/world/generated/browserLoader";
const tree: ArtObject = {
  id: "nexus-test",
  kind: "tree",
  binding: "object.ki-v2-objects.nexus-oak-1",
  x: 500,
  y: 600,
  width: 300,
  height: 400,
  anchorX: 0.5,
  anchorY: 0.92,
  solid: true,
  footprint: { width: 50, height: 50 },
};
describe("Nexus-9 presentation safety", () => {
  it("is default on since 06.11.2026 and never replaces a previous binding", () => {
    expect(previewPacks("")).toContain("nexus-continent-v2");
    expect(previewPacks("?ki-nexus-continent=1")).toContain("nexus-continent-v2");
    expect(previewPacks("?ki-nexus-continent=0")).not.toContain("nexus-continent-v2");
    const packs = imported.map((p) => PackSchema.parse(p)),
      pack = packs.find((p) => p.id === "nexus-continent-v2")!;
    expect(pack.assets).toHaveLength(64);
    expect(new Set(pack.assets.map((a) => a.id)).size).toBe(64);
    expect(pack.assets.reduce((n, a) => n + a.width! * a.height! * 4, 0)).toBeLessThan(
      40 * 1024 * 1024,
    );
    const base = makeCatalog(packs, []),
      preview = makeCatalog(packs, previewPacks("?ki-nexus-continent=1"));
    for (const [k, v] of Object.entries(base.renderBindings))
      expect(preview.renderBindings[k]).toEqual(v);
    // The generic renderer block asks for these conventional names under the pack prefix.
    for (const n of ["sand", "water", "road1", "road2", "road3", "road4", "road5"])
      expect(preview.renderBindings["terrain.nexus-continent." + n]).toBeDefined();
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
      at = nexusBiomeAt(chunk);
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
    expect(nexusObjects([tree], () => false)).toEqual([tree]);
    for (const climate of [0, 1, 2, 3]) {
      const before = structuredClone(tree),
        [mapped] = nexusObjects(
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
  it("keeps the four canopy variants in warm biomes and crystalline ones in the wastes", () => {
    const trees = Array.from({ length: 1000 }, (_, i) => {
      const { footprint: _f, ...rest } = tree;
      return {
        ...rest,
        id: "tree-" + i,
        solid: false,
        x: i * 71 + 7,
        y: i * 53 + 8000,
        binding: i % 3 === 0 ? "object.ki-v2-objects.nexus-pine-0" : tree.binding,
      };
    });
    const warmAll = nexusObjects(
        trees,
        () => true,
        [],
        () => 1,
      ),
      warm = warmAll.filter((t) => t.kind !== "ambient-effect"),
      cold = nexusObjects(
        trees,
        () => true,
        [],
        () => 3,
      ).filter((t) => t.kind !== "ambient-effect");
    expect(new Set(warm.map((t) => t.binding))).toEqual(
      new Set(
        ["violet-tree", "cyan-tree", "silver-cypress", "crystal-tree"].map(
          (n) => "object.nexus-continent." + n,
        ),
      ),
    );
    // Gardens breathe: part of the warm canopy sheds petals; the wastes never do.
    expect(warmAll.some((t) => t.binding === "object.nexus-continent.fx-petals")).toBe(true);
    expect(cold.some((t) => t.binding === "object.nexus-continent.fx-petals")).toBe(false);
    expect(cold.length).toBeGreaterThan(0);
    expect(new Set(cold.map((t) => t.binding))).toEqual(
      new Set(["silver-cypress", "crystal-tree"].map((n) => "object.nexus-continent." + n)),
    );
    expect(nexusSceneryName({ ...tree, binding: "object.crystal" }, 3)).toBe("crystal-outcrop");
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
      nexusRoadside(
        0,
        0,
        roads,
        () => false,
        () => true,
        () => 0,
      ),
    ).toEqual([]);
    expect(
      nexusRoadside(
        0,
        0,
        roads,
        () => true,
        () => true,
        () => 3,
      ),
    ).toEqual([]);
    const items = nexusRoadside(
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
  it("breathes: machines glow, crystals carry fireflies, ruins hold mist", () => {
    const reactor: ArtObject = {
      ...tree,
      id: "reactor-1",
      binding: "object.ki-v2-landmarks.nexus-reactor",
    };
    const out = nexusObjects(
      [reactor],
      () => true,
      [],
      () => 0,
    );
    const fx = out.filter((o) => o.kind === "ambient-effect");
    expect(fx.map((o) => o.binding)).toEqual(["object.nexus-continent.fx-energy"]);
    for (const f of fx) {
      expect(f.solid).toBe(false);
      expect(f.layer).toBe("overhead");
    }
    const frame = nexusEffectFrame(fx[0]!, 1234);
    expect(frame.alpha).toBeGreaterThan(0);
    expect(frame.alpha).toBeLessThan(0.4);
  });
  it("dresses the wilderness with nonphysical props only, and caps the count", () => {
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
      nexusScatter(
        0,
        0,
        roads,
        () => false,
        () => true,
        () => 0,
      ),
    ).toEqual([]);
    const props = nexusScatter(
      0,
      0,
      roads,
      () => true,
      () => true,
      () => 3,
    );
    expect(props.length).toBeGreaterThan(0);
    expect(props.length).toBeLessThanOrEqual(40);
    for (const p of props) {
      expect(p.solid).toBe(false);
      expect(p.footprint).toBeUndefined();
      expect(p.layer).toBe("objects");
      expect(p.binding.startsWith("object.nexus-continent.")).toBe(true);
      // Nothing may sit on the road surface.
      expect(p.y).not.toBeCloseTo(500, -1);
    }
  });
  it("keeps the airborne field sparse and warm-only, because every mote costs a frame", () => {
    const cold = nexusAir(
      0,
      0,
      () => true,
      () => true,
      () => 3,
    );
    expect(cold).toEqual([]);
    const inCity = nexusAir(
      0,
      0,
      () => false,
      () => true,
      () => 1,
    );
    expect(inCity).toEqual([]);
    const warm = nexusAir(
      0,
      0,
      () => true,
      () => true,
      () => 1,
    );
    expect(warm.length).toBeGreaterThan(0);
    // A dense field measured a screenshot timeout on software WebGL. This is the guard.
    expect(warm.length).toBeLessThanOrEqual(24);
    for (const mote of warm) {
      expect(mote.kind).toBe("ambient-effect");
      expect(mote.solid).toBe(false);
      expect(mote.layer).toBe("overhead");
      expect(mote.id.startsWith("nexus-air-")).toBe(true);
    }
    // Motes travel; sprites clinging to a machine only shimmer in place.
    const a = nexusEffectFrame(warm[0]!, 0),
      b = nexusEffectFrame(warm[0]!, 1300);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(0);
  });
});
