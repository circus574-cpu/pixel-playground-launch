import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CAMERA,
  discHalfAngle,
  fitDistance,
  focusDistance,
  globeQuality,
  horizonFade,
  mapToSphere,
  markerPoint,
  maxDistance,
  narrowHalfAngle,
  regionAt,
  sphereToMap,
  startCamera,
  uvToMap,
  zoomPercent,
} from "../components/planet-map/globeMath";
import { CONTINENTS, MAP_H, MAP_W, QUEST_ISLANDS, REGIONS } from "../components/planet-map/mapData";

const PHONE = 390 / 844;
const ASPECTS = [PHONE, 0.75, 1, 1280 / 800, 2.2];

describe("/mapa globe projection", () => {
  it("round-trips atlas points through the sphere", () => {
    for (const p of [
      { x: 10, y: 500 },
      { x: 755, y: 498 },
      { x: 1453, y: 711 },
      { x: 1990, y: 120 },
    ]) {
      const back = sphereToMap(mapToSphere(p, 1.7));
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });

  it("matches three.js sphere UVs, so picking follows the painted texture", () => {
    const geo = new THREE.SphereGeometry(1, 64, 32);
    const pos = geo.getAttribute("position");
    const uv = geo.getAttribute("uv");
    for (const i of [70, 400, 777, 1200, 1800]) {
      const fromUv = uvToMap(uv.getX(i), uv.getY(i));
      const fromPos = mapToSphere(fromUv);
      expect(fromPos[0]).toBeCloseTo(pos.getX(i), 5);
      expect(fromPos[1]).toBeCloseTo(pos.getY(i), 5);
      expect(fromPos[2]).toBeCloseTo(pos.getZ(i), 5);
    }
    geo.dispose();
  });

  it("wraps the texture seam onto the same longitude", () => {
    expect(uvToMap(1.25, 0.5).x).toBeCloseTo(uvToMap(0.25, 0.5).x, 6);
    expect(uvToMap(-0.25, 0.5).x).toBeCloseTo(MAP_W * 0.75, 6);
    expect(uvToMap(0.5, 1).y).toBe(0);
    expect(uvToMap(0.5, 0).y).toBe(MAP_H);
  });

  it("picks every region at its marker and nothing in open ocean", () => {
    for (const r of REGIONS) expect(regionAt(markerPoint(r))?.id).toBe(r.id);
    expect(regionAt({ x: 5, y: 5 })).toBeNull();
  });

  it("marks the four continents and six quest islands", () => {
    expect(CONTINENTS.map((c) => c.name)).toEqual(["Verdantia", "Aetheria", "Nexus-9", "Pyra"]);
    expect(QUEST_ISLANDS).toHaveLength(6);
  });

  it("shows markers only on the hemisphere facing the camera", () => {
    const cam: [number, number, number] = [0, 0, 3];
    expect(horizonFade([0, 0, 1], cam)).toBe(1);
    expect(horizonFade([0, 0, -1], cam)).toBe(0);
    expect(horizonFade([1, 0, 0], cam)).toBe(0);
  });
});

describe("/mapa globe camera", () => {
  it("opens zoomed out with the whole planet disc on screen", () => {
    for (const a of ASPECTS) {
      const d = fitDistance(a);
      expect(discHalfAngle(d)).toBeLessThan(narrowHalfAngle(a));
      expect(Math.hypot(...startCamera(a))).toBeCloseTo(d, 6);
      expect(zoomPercent(d, a)).toBe(100);
    }
  });

  it("zooms between a close surface view and slightly beyond the opening view", () => {
    for (const a of ASPECTS) {
      expect(CAMERA.min).toBeGreaterThan(1);
      expect(maxDistance(a)).toBeGreaterThan(fitDistance(a));
      const [continent, island] = [CONTINENTS[0], QUEST_ISLANDS[0]];
      if (!continent || !island) throw new Error("missing regions");
      expect(focusDistance(continent, a)).toBeLessThan(fitDistance(a));
      expect(focusDistance(island, a)).toBeLessThan(focusDistance(continent, a));
      expect(focusDistance(island, a)).toBeGreaterThan(CAMERA.min);
    }
  });
});

describe("/mapa globe render budget", () => {
  it("caps a 3x Android phone at 1.5x pixel ratio with the light texture", () => {
    const q = globeQuality({
      devicePixelRatio: 3,
      coarsePointer: true,
      width: 390,
      deviceMemory: 8,
    });
    expect(q.maxDpr).toBe(1.5);
    expect(q.hiResColor).toBe(false);
    expect(q.antialias).toBe(false);
  });

  it("caps low-memory phones at 1.25x", () => {
    const q = globeQuality({
      devicePixelRatio: 2.75,
      coarsePointer: true,
      width: 360,
      deviceMemory: 2,
    });
    expect(q.maxDpr).toBe(1.25);
  });

  it("allows desktops up to 2x and the 3840 px texture", () => {
    expect(globeQuality({ devicePixelRatio: 3, coarsePointer: false, width: 1600 }).maxDpr).toBe(2);
    const q = globeQuality({ devicePixelRatio: 1, coarsePointer: false, width: 1600 });
    expect(q.maxDpr).toBe(1);
    expect(q.hiResColor).toBe(true);
  });
});
