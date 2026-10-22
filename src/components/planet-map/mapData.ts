/**
 * Data for the /mapa DEMO preview of planet Superior.
 *
 * The terrain is a painted raster atlas (src/assets/planet-map/atlas-*.webp).
 * Region outlines in atlasRegions.json were traced from that exact image, in
 * map units (MAP_W x MAP_H), so hitboxes, labels and markers stay aligned with
 * the painted coastlines at every zoom level.
 *
 * Pure, deterministic and browser-safe: no storage access, no dependency on
 * game sessions or saves.
 */
import outlines from "./atlasRegions.json";
import layout from "./planetLayout.json";
import { sourceToPlanet } from "../../game/world/planet";
import { atlasPoint, OPEN_WORLDS } from "../../game/world/zoneMap";

export const MAP_W = 2000;
export const MAP_H = 1000;
/** The high-resolution atlas is 3840 px wide; beyond 4x it would only blur. */
export const MAX_ZOOM = 4;

export type Point = { x: number; y: number };
export type RegionKind = "continent" | "island";
export type MapRegion = {
  id: string;
  kind: RegionKind;
  name: string;
  people?: string;
  settlement?: string;
  /** Painted city or sanctuary on the atlas. */
  settlementPoint?: Point;
  summary: string;
  status: string;
  numeral?: string;
  /** Where the name label sits, on open land of the region. */
  label: Point;
  /** Outline traced from the atlas image, in map units. */
  outline: Point[];
  /** Bounding-box centre and half-size of the outline. */
  center: Point;
  radius: Point;
};

const CONTINENT_STATUS = "Region startowy dostępny w obecnej wersji gry (lokalne PvE).";
const OPEN_STATUS =
  "Otwarty region: miasto i cztery strefy — północ, południe, wschód, zachód (lokalne PvE).";
const ISLAND_STATUS = "Przyszła wyspa questowa — planowana, jeszcze niedostępna w grze.";

const OUTLINES: Record<string, number[][]> = outlines;
/** Settlement points and label spots on the planet atlas, computed by scripts/relayout_planet.py. */
const LAYOUT = layout as Record<string, { settlementPoint?: Point; label: Point }>;

function withOutline(region: Omit<MapRegion, "outline" | "center" | "radius">): MapRegion {
  const raw = OUTLINES[region.id];
  if (!raw || raw.length < 3) throw new Error(`Missing atlas outline: ${region.id}`);
  const outline = raw.map(([x = 0, y = 0]) => ({ x, y }));
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    ...region,
    outline,
    center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    radius: { x: (x1 - x0) / 2, y: (y1 - y0) / 2 },
  };
}

export const CONTINENTS: MapRegion[] = [
  withOutline({
    id: "verdant",
    kind: "continent",
    name: "Verdantia",
    people: "Planetarni",
    settlement: "Wioska Początkowa",
    settlementPoint: LAYOUT["verdant"]!.settlementPoint!,
    label: LAYOUT["verdant"]!.label,
    summary:
      "Gęste lasy, kręte rzeki, wielkie jezioro i grzbiet ośnieżonych gór. Żywa energia ziemi i rzemiosło.",
    status: CONTINENT_STATUS,
  }),
  withOutline({
    id: "aether",
    kind: "continent",
    name: "Aetheria",
    people: "Mędrcy",
    settlement: "Sanktuarium Tysiąca Źródeł",
    settlementPoint: LAYOUT["aether"]!.settlementPoint!,
    label: LAYOUT["aether"]!.label,
    summary:
      "Lodowe szczyty, lodowce i świecące turkusowo źródła skupionego KI wśród świątynnych tarasów.",
    status: OPEN_STATUS,
  }),
  withOutline({
    id: "nexus",
    kind: "continent",
    name: "Nexus-9",
    people: "Androidy",
    settlement: "Węzeł Świadomości",
    settlementPoint: LAYOUT["nexus"]!.settlementPoint!,
    label: LAYOUT["nexus"]!.label,
    summary:
      "Cybernetyczna metropolia wokół świecącego reaktora, autostrady-obwody, doki i skaliste płaskowyże.",
    status: OPEN_STATUS,
  }),
  withOutline({
    id: "pyra",
    kind: "continent",
    name: "Pyra",
    people: "Legendy",
    settlement: "Twierdza Popiołu",
    settlementPoint: LAYOUT["pyra"]!.settlementPoint!,
    label: LAYOUT["pyra"]!.label,
    summary:
      "Czynne wulkany, rzeki lawy spływające do morza, bazaltowe pustkowia i kaniony z czerwonej skały.",
    status: OPEN_STATUS,
  }),
];

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];
export const QUEST_ISLANDS: MapRegion[] = NUMERALS.map((numeral, i) =>
  withOutline({
    id: `island-${i + 1}`,
    kind: "island",
    name: `Wyspa questowa ${numeral}`,
    numeral,
    label: LAYOUT[`island-${i + 1}`]!.label,
    summary: "Nazwa robocza. Treść, przeciwnicy i nagrody zostaną określone w przyszłych etapach.",
    status: ISLAND_STATUS,
  }),
);

export const REGIONS: MapRegion[] = [...CONTINENTS, ...QUEST_ISLANDS];

export type ZoneDir = "north" | "south" | "east" | "west";
export type MapZone = {
  id: string;
  region: string;
  dir: ZoneDir;
  name: string;
  summary: string;
  /** Zone centre on the atlas, moved onto the continent's painted land. */
  point: Point;
};
export const ZONE_DIR_NAMES: Record<ZoneDir, string> = {
  north: "Północ",
  south: "Południe",
  east: "Wschód",
  west: "Zachód",
};

/** Pulls a point toward the settlement until it lies inside the traced outline. */
function onLand(region: MapRegion, from: Point, settle: Point): Point {
  for (let k = 0; k <= 20; k++) {
    const p = {
      x: from.x + ((settle.x - from.x) * k) / 20,
      y: from.y + ((settle.y - from.y) * k) / 20,
    };
    if (containsPoint(region, p)) return p;
  }
  return settle;
}

/** The four zones of every open-world continent, placed with the same mapping as the minimap. */
export const ZONES: MapZone[] = CONTINENTS.flatMap((c) => {
  const world = OPEN_WORLDS[c.id];
  if (!world || !c.settlementPoint) return [];
  return world.zones.map((z) => {
    const source = atlasPoint(c.id, z);
    const raw = source ? sourceToPlanet(c.id, source) : c.settlementPoint!;
    return {
      id: `${c.id}-${z.id}`,
      region: c.id,
      dir: z.id,
      name: z.name,
      summary: z.summary,
      point: onLand(c, raw, c.settlementPoint!),
    };
  });
});
export const zonesOf = (regionId: string) => ZONES.filter((z) => z.region === regionId);

/** Closed SVG path of a region outline. */
export function regionPath(region: MapRegion) {
  return `M${region.outline.map((p) => `${p.x} ${p.y}`).join("L")}Z`;
}

/** Even-odd point-in-polygon test against the traced outline. */
export function containsPoint(region: MapRegion, p: Point) {
  const o = region.outline;
  let inside = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const a = o[i];
    const b = o[j];
    if (!a || !b) continue;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// ---------- Viewport math (zoom / pan) ----------

/** View: centre in map units and scale in screen pixels per map unit. */
export type View = { cx: number; cy: number; s: number };

export function fitScale(cw: number, ch: number) {
  return Math.min(cw / MAP_W, ch / MAP_H);
}

/**
 * Landscape screens see the whole planet. Portrait phones start with the map
 * filling more of the height (the whole planet is one tap away via the globe
 * button), so the painted terrain is not a thin strip.
 */
export function initialView(cw: number, ch: number): View {
  const fit = fitScale(cw, ch);
  const portrait = cw < 900 && ch > cw * 1.15;
  const s = portrait ? Math.min(fit * MAX_ZOOM, Math.max(fit, ch / MAP_H)) : fit;
  return clampView({ cx: MAP_W * 0.31, cy: MAP_H / 2, s }, cw, ch);
}

/** Whole planet fitted into the viewport. */
export function wholeView(cw: number, ch: number): View {
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
export function zoomAt(
  v: View,
  factor: number,
  px: number,
  py: number,
  cw: number,
  ch: number,
): View {
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
  const pad = region.kind === "island" ? 2.6 : 1.35;
  const s = Math.min(cw / (region.radius.x * 2 * pad), ch / (region.radius.y * 2 * pad));
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
