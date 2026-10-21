import { describe, expect, it } from "vitest";
import {
  CONTINENTS,
  MAP_H,
  MAP_W,
  MAX_ZOOM,
  QUEST_ISLANDS,
  REGIONS,
  clampView,
  fitScale,
  initialView,
  zoomAt,
} from "../components/planet-map/mapData";
import { WORLDS } from "../game/world/worlds";
import { RACES } from "../game/world/races";

describe("/mapa planet Superior preview", () => {
  it("uses a 2:1 map", () => {
    expect(MAP_W / MAP_H).toBe(2);
  });

  it("shows exactly the four canonical continents with their origins", () => {
    expect(CONTINENTS.map((c) => [c.name, c.people])).toEqual([
      ["Verdantia", "Planetarni"],
      ["Aetheria", "Mędrcy"],
      ["Nexus-9", "Androidy"],
      ["Pyra", "Legendy"],
    ]);
  });

  it("matches the game's world, race and settlement names", () => {
    for (const c of CONTINENTS) {
      const world = WORLDS[c.id as keyof typeof WORLDS];
      expect(world.name).toBe(c.name);
      expect(world.settlement).toBe(c.settlement);
      expect(RACES[world.race].name).toBe(c.people);
    }
  });

  it("has six future quest islands", () => {
    expect(QUEST_ISLANDS).toHaveLength(6);
    expect(QUEST_ISLANDS.every((i) => i.kind === "island")).toBe(true);
  });

  it("keeps every region inside the map", () => {
    for (const r of REGIONS) {
      expect(r.center.x - r.radius.x * 1.4).toBeGreaterThan(0);
      expect(r.center.x + r.radius.x * 1.4).toBeLessThan(MAP_W);
      expect(r.center.y - r.radius.y * 1.4).toBeGreaterThan(0);
      expect(r.center.y + r.radius.y * 1.4).toBeLessThan(MAP_H);
    }
  });

  it("limits zoom between whole planet and 8x", () => {
    const v = initialView(1000, 500);
    expect(zoomAt(v, 0.1, 500, 250, 1000, 500).s).toBe(fitScale(1000, 500));
    expect(zoomAt(v, 100, 500, 250, 1000, 500).s).toBe(fitScale(1000, 500) * MAX_ZOOM);
    expect(MAX_ZOOM).toBe(8);
  });

  it("keeps the map point under the cursor fixed while zooming", () => {
    const v = clampView({ cx: 1000, cy: 500, s: 1 }, 1000, 500);
    const px = 700;
    const py = 300;
    const before = { x: v.cx + (px - 500) / v.s, y: v.cy + (py - 250) / v.s };
    const z = zoomAt(v, 1.5, px, py, 1000, 500);
    const after = { x: z.cx + (px - 500) / z.s, y: z.cy + (py - 250) / z.s };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});
