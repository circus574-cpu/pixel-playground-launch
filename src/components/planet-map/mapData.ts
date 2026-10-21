/**
 * Procedural data for the /mapa DEMO preview of planet Superior.
 * Pure, deterministic and browser-safe: no randomness at module scope,
 * no storage access, no dependency on game sessions or saves.
 */
export const MAP_W = 2000;
export const MAP_H = 1000;
export const MAX_ZOOM = 8;

export type Point = { x: number; y: number };
export type RegionKind = "continent" | "island";
export type MapRegion = {
  id: string;
  kind: RegionKind;
  name: string;
  people?: string;
  settlement?: string;
  settlementPoint?: Point;
  summary: string;
  status: string;
  numeral?: string;
  terrain: "forest" | "sanctum" | "tech" | "volcanic" | "isle";
  fill: string;
  shade: string;
  center: Point;
  radius: Point;
  seed: number;
  roughness: number;
};

const CONTINENT_STATUS = "Region startowy dostępny w obecnej wersji gry (lokalne PvE).";
const ISLAND_STATUS = "Przyszła wyspa questowa — planowana, jeszcze niedostępna w grze.";

export const CONTINENTS: MapRegion[] = [
  {
    id: "verdant",
    kind: "continent",
    name: "Verdantia",
    people: "Planetarni",
    settlement: "Wioska Początkowa",
    settlementPoint: { x: 640, y: 440 },
    summary: "Leśne doliny, rzeki i szlaki podróżników. Żywa energia ziemi i rzemiosło.",
    status: CONTINENT_STATUS,
    terrain: "forest",
    fill: "#5f8a45",
    shade: "#3f6630",
    center: { x: 620, y: 420 },
    radius: { x: 270, y: 180 },
    seed: 11,
    roughness: 0.16,
  },
  {
    id: "aether",
    kind: "continent",
    name: "Aetheria",
    people: "Mędrcy",
    settlement: "Sanktuarium Tysiąca Źródeł",
    settlementPoint: { x: 1310, y: 300 },
    summary: "Tarasy, biblioteki i źródła skupionego KI wśród prastarych drzew.",
    status: CONTINENT_STATUS,
    terrain: "sanctum",
    fill: "#4f9a8c",
    shade: "#2f6d64",
    center: { x: 1330, y: 290 },
    radius: { x: 250, y: 165 },
    seed: 23,
    roughness: 0.18,
  },
  {
    id: "nexus",
    kind: "continent",
    name: "Nexus-9",
    people: "Androidy",
    settlement: "Węzeł Świadomości",
    settlementPoint: { x: 1440, y: 720 },
    summary: "Laboratoria, reaktor i syntetyczna energia rdzenia. Świadomość maszyn.",
    status: CONTINENT_STATUS,
    terrain: "tech",
    fill: "#4b6f91",
    shade: "#2e4b66",
    center: { x: 1420, y: 725 },
    radius: { x: 240, y: 155 },
    seed: 37,
    roughness: 0.14,
  },
  {
    id: "pyra",
    kind: "continent",
    name: "Pyra",
    people: "Legendy",
    settlement: "Twierdza Popiołu",
    settlementPoint: { x: 560, y: 790 },
    summary: "Wulkaniczne szczeliny, areny klanów i kamienne monumenty honoru.",
    status: CONTINENT_STATUS,
    terrain: "volcanic",
    fill: "#9a5a3c",
    shade: "#6b3a26",
    center: { x: 560, y: 790 },
    radius: { x: 225, y: 135 },
    seed: 41,
    roughness: 0.2,
  },
];

const ISLAND_SPOTS: Array<[number, number, number, number]> = [
  [985, 165, 62, 42],
  [1005, 525, 70, 46],
  [1835, 250, 58, 44],
  [1850, 690, 66, 48],
  [165, 235, 60, 40],
  [995, 875, 64, 40],
];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export const QUEST_ISLANDS: MapRegion[] = ISLAND_SPOTS.map(([x, y, rx, ry], i) => ({
  id: `island-${i + 1}`,
  kind: "island",
  name: `Wyspa questowa ${NUMERALS[i]}`,
  numeral: NUMERALS[i] ?? String(i + 1),
  summary: "Nazwa robocza. Treść, przeciwnicy i nagrody zostaną określone w przyszłych etapach.",
  status: ISLAND_STATUS,
  terrain: "isle",
  fill: "#8b8a5e",
  shade: "#5d5c3e",
  center: { x, y },
  radius: { x: rx, y: ry },
  seed: 100 + i * 7,
  roughness: 0.22,
}));

export const REGIONS: MapRegion[] = [...CONTINENTS, ...QUEST_ISLANDS];

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radius multiplier of a star-shaped blob at angle theta. */
export function blobShape(seed: number, roughness: number) {
  const r = rng(seed);
  const harmonics = [2, 3, 4, 5, 7, 9].map((k) => ({
    k,
    amp: (roughness * (0.6 + r() * 0.8)) / Math.sqrt(k - 1),
    phase: r() * Math.PI * 2,
  }));
  return (theta: number) =>
    1 + harmonics.reduce((sum, h) => sum + h.amp * Math.sin(h.k * theta + h.phase), 0);
}

export function regionPoint(region: MapRegion, theta: number, t: number, shape = blobShape(region.seed, region.roughness)): Point {
  const m = shape(theta) * t;
  return {
    x: region.center.x + Math.cos(theta) * region.radius.x * m,
    y: region.center.y + Math.sin(theta) * region.radius.y * m,
  };
}

/** Smooth closed path (Catmull-Rom to cubic Bézier) of a region outline. */
export function regionPath(region: MapRegion, scale = 1, steps = 64) {
  const shape = blobShape(region.seed, region.roughness);
  const pts = Array.from({ length: steps }, (_, i) =>
    regionPoint(region, (i / steps) * Math.PI * 2, scale, shape),
  );
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
}

export type Decoration = Point & { size: number; variant: number };

/** Deterministic terrain glyph positions inside a region. */
export function regionDecorations(region: MapRegion, count: number): Decoration[] {
  const r = rng(region.seed * 31 + 5);
  const shape = blobShape(region.seed, region.roughness);
  return Array.from({ length: count }, () => {
    const theta = r() * Math.PI * 2;
    const t = Math.sqrt(r()) * 0.78;
    return { ...regionPoint(region, theta, t, shape), size: 0.7 + r() * 0.6, variant: Math.floor(r() * 3) };
  });
}

/** Deterministic fog cloud puffs covering the whole map. */
export function fogClouds(count: number, seed = 777): Decoration[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({
    x: r() * MAP_W,
    y: r() * MAP_H,
    size: 50 + r() * 110,
    variant: 0,
  }));
}

// ---------- Viewport math (zoom / pan) ----------

/** View: centre in map units and scale in screen pixels per map unit. */
export type View = { cx: number; cy: number; s: number };

export function fitScale(cw: number, ch: number) {
  return Math.min(cw / MAP_W, ch / MAP_H);
}

export function initialView(cw: number, ch: number): View {
  return { cx: MAP_W / 2, cy: MAP_H / 2, s: fitScale(cw, ch) };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function clampView(v: View, cw: number, ch: number): View {
  const fit = fitScale(cw, ch);
  const s = clamp(v.s, fit, fit * MAX_ZOOM);
  const hw = cw / (2 * s);
  const hh = ch / (2 * s);
  const cx = hw * 2 >= MAP_W ? MAP_W / 2 : clamp(v.cx, hw, MAP_W - hw);
  const cy = hh * 2 >= MAP_H ? MAP_H / 2 : clamp(v.cy, hh, MAP_H - hh);
  return { cx, cy, s };
}

/** Zoom by factor keeping the map point under (px, py) stationary on screen. */
export function zoomAt(v: View, factor: number, px: number, py: number, cw: number, ch: number): View {
  const fit = fitScale(cw, ch);
  const s = clamp(v.s * factor, fit, fit * MAX_ZOOM);
  const mx = v.cx + (px - cw / 2) / v.s;
  const my = v.cy + (py - ch / 2) / v.s;
  return clampView({ cx: mx - (px - cw / 2) / s, cy: my - (py - ch / 2) / s, s }, cw, ch);
}

export function panBy(v: View, dx: number, dy: number, cw: number, ch: number): View {
  return clampView({ ...v, cx: v.cx - dx / v.s, cy: v.cy - dy / v.s }, cw, ch);
}

export function focusOn(region: MapRegion, cw: number, ch: number): View {
  const s = Math.min(cw / (region.radius.x * 2 * 1.7), ch / (region.radius.y * 2 * 1.7));
  return clampView({ cx: region.center.x, cy: region.center.y, s }, cw, ch);
}

export function viewBox(v: View, cw: number, ch: number) {
  const w = cw / v.s;
  const h = ch / v.s;
  return `${(v.cx - w / 2).toFixed(2)} ${(v.cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
}

export function zoomLevel(v: View, cw: number, ch: number) {
  return v.s / fitScale(cw, ch);
}
