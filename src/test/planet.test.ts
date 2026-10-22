import { describe, expect, it } from "vitest";
import {
  featureCenter,
  lonLatToMap,
  mapToLonLat,
  PLANET,
  sourceToPlanet,
  surfaceDistance,
} from "../game/world/planet";
import {
  CONTINENTS,
  containsPoint,
  QUEST_ISLANDS,
  REGIONS,
} from "../components/planet-map/mapData";

const CITIES = ["verdant", "aether", "nexus", "pyra"];
describe("planet Superior geometry", () => {
  it("puts every pair of main cities exactly 80 000 units apart", () => {
    expect(PLANET.cityDistance).toBe(80000);
    for (const a of CITIES)
      for (const b of CITIES)
        if (a < b)
          expect(surfaceDistance(featureCenter(a), featureCenter(b)), a + "-" + b).toBeCloseTo(
            80000,
            0,
          );
  });
  it("derives the radius from the regular tetrahedron", () => {
    expect(PLANET.radius).toBeCloseTo(80000 / Math.acos(-1 / 3), 1);
    expect(PLANET.unitsPerMapUnit).toBeCloseTo((2 * Math.PI * PLANET.radius) / 2000, 3);
  });
  it("puts each quest island on an edge midpoint, 40 000 units from its two cities", () => {
    expect(Object.keys(PLANET.islandEdges)).toHaveLength(6);
    for (const [island, [a, b]] of Object.entries(PLANET.islandEdges)) {
      const c = featureCenter(island);
      expect(surfaceDistance(c, featureCenter(a!)), island).toBeCloseTo(40000, 0);
      expect(surfaceDistance(c, featureCenter(b!)), island).toBeCloseTo(40000, 0);
    }
    const pairs = Object.values(PLANET.islandEdges).map((e) => [...e].sort().join("-"));
    expect(new Set(pairs).size).toBe(6);
  });
  it("converts between map units and longitude/latitude without drift", () => {
    for (const p of [
      { x: 0, y: 0 },
      { x: 1000, y: 500 },
      { x: 1999, y: 999 },
    ]) {
      const back = lonLatToMap(mapToLonLat(p));
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });
  it("shows the atlas settlement of each continent at its city on the sphere", () => {
    for (const c of CONTINENTS) {
      const here = lonLatToMap(featureCenter(c.id));
      expect(c.settlementPoint!.x).toBeCloseTo(here.x, 0);
      expect(c.settlementPoint!.y).toBeCloseTo(here.y, 0);
      expect(containsPoint(c, c.settlementPoint!)).toBe(true);
    }
  });
  it("keeps a continent's true size: source offsets shrink by the planet scale", () => {
    const f = PLANET.features["aether"]!;
    const east = sourceToPlanet("aether", { x: f.source.x + 100, y: f.source.y });
    const centre = sourceToPlanet("aether", f.source);
    const a = mapToLonLat(east),
      b = mapToLonLat(centre);
    const metres = surfaceDistance(a, b);
    expect(metres).toBeCloseTo(100 * PLANET.unitsPerMapUnit * PLANET.scale, 0);
  });
  it("keeps continents and islands apart from each other", () => {
    for (const a of REGIONS)
      for (const b of REGIONS)
        if (a.id < b.id) {
          const overlap = a.outline.some((p) => containsPoint(b, p));
          expect(overlap, a.id + " overlaps " + b.id).toBe(false);
        }
    expect(QUEST_ISLANDS).toHaveLength(6);
  });
});
