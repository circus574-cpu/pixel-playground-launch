import { describe, expect, it } from "vitest";
import {
  CONTINENTS,
  MAP_H,
  MAP_W,
  MAX_ZOOM,
  QUEST_ISLANDS,
  REGIONS,
  clampView,
  containsPoint,
  fitScale,
  initialView,
  wholeView,
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

  it("keeps every traced outline inside the map", () => {
    for (const r of REGIONS) {
      expect(r.outline.length).toBeGreaterThan(20);
      for (const p of r.outline) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(MAP_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(MAP_H);
      }
    }
  });

  it("places every label and settlement on its own painted region", () => {
    for (const r of REGIONS) {
      expect(containsPoint(r, r.label), `${r.id} label`).toBe(true);
      if (r.settlementPoint) {
        expect(containsPoint(r, r.settlementPoint), `${r.id} settlement`).toBe(true);
      }
      for (const other of REGIONS) {
        if (other.id === r.id) continue;
        expect(containsPoint(other, r.label), `${r.id} label in ${other.id}`).toBe(false);
      }
    }
  });

  it("limits zoom between whole planet and 4x", () => {
    const v = wholeView(1000, 500);
    expect(zoomAt(v, 0.1, 500, 250, 1000, 500).s).toBe(fitScale(1000, 500));
    expect(zoomAt(v, 100, 500, 250, 1000, 500).s).toBe(fitScale(1000, 500) * MAX_ZOOM);
    expect(MAX_ZOOM).toBe(4);
  });

  it("shows the whole planet on landscape screens at start", () => {
    expect(initialView(1280, 640).s).toBe(fitScale(1280, 640));
  });

  it("fills most of a portrait phone without changing the atlas aspect ratio", () => {
    const v = initialView(390, 844);
    expect(v.s * MAP_H).toBeGreaterThanOrEqual(780);
    expect(v.cx).toBe(620);
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
