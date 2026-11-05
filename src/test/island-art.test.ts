import { describe, expect, it, vi } from "vitest";
import type { ArtObject, FeatureArt } from "../game/world/generated/renderSuperior";
vi.mock("../game/assets/catalog", () => ({
  catalog: {
    renderBindings: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`terrain.island-${i + 1}.biome-0`, { asset: "test" }]),
    ),
  },
}));
import {
  islandArtEnabled,
  islandFeatureArt,
  islandObjects,
} from "../game/world/generated/islandArt";
const tree = {
  id: "tree",
  binding: "object.ki-v2-objects.aether-oak-2",
  x: 123,
  y: 456,
  width: 110,
  height: 240,
  anchorX: 0.5,
  anchorY: 0.9,
  solid: true,
  footprint: { x: 100, y: 450, width: 40, height: 20 },
} as unknown as ArtObject;
const art = {
  groundByBiome: ["a", "b", "c", "d"],
  water: "ocean",
  road: "road",
  plaza: "plaza",
  buildings: [tree],
  acceptedCityBuildings: [tree],
  acceptedCityScenery: [tree],
  resources: [tree],
  dungeonEntrances: [],
} as FeatureArt;
describe("island art presentation overlay", () => {
  for (let i = 1; i <= 6; i++)
    it(`island ${i}: independent materials preserve physical state and services`, () => {
      const feature = `island-${i}`;
      const before = structuredClone(art);
      const result = islandFeatureArt(feature, art);
      expect(result.groundByBiome).toEqual(
        [0, 1, 2, 3].map((n) => `terrain.${feature}.biome-${n}`),
      );
      expect(result.water).toBe(i === 6 ? "ocean" : `terrain.${feature}.water`);
      expect(result.buildings).toBe(art.buildings);
      expect(result.resources).toBe(art.resources);
      expect(islandObjects(feature, [tree])[0]).toEqual({
        ...tree,
        binding: `object.${feature}.tree`,
      });
      expect(art).toEqual(before);
    });
  it("leaves all continents and unknown islands untouched", () => {
    for (const f of ["aether", "verdant", "pyra", "nexus", "island-7"]) {
      expect(islandArtEnabled(f)).toBe(false);
      expect(islandFeatureArt(f, art)).toBe(art);
      const items = [tree];
      expect(islandObjects(f, items)).toBe(items);
    }
  });
  it("does not substitute gatherable materials, buildings or unrelated props", () => {
    for (const binding of ["object.crystal", "object.herb", "object.house", "object.log"]) {
      const item = { ...tree, binding };
      expect(islandObjects("island-1", [item])[0]).toBe(item);
    }
  });
});
