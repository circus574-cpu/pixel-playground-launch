import { catalog } from "../../assets/catalog";
import { decodeRuns } from "./browserTerrain";
import { roadDistance } from "./verdantiaContinent";
import type { BrowserChunk } from "./browserLoader";
import type { ArtObject } from "./renderSuperior";
import type { Point } from "../../navigation";
type Road = { points: [number, number][]; width: number; kind: string };

/**
 * World dressing, on by default since 06.11.2026 (owner: no more flagging, every land works);
 * `?ki-dress=0` restores the bare frame.
 *
 * Measured on the shipped data (window of a 900×560 frame at zoom 0.62, i.e. 1452×903 world
 * units): continent wilderness carries 6–12 authored props per frame while island wilderness
 * carries 65–79, and 29 % of continent chunks hold no authored prop at all. Every island
 * settlement has `acceptedCityScenery = 0` against 64–130 on the continents, so the frame a
 * player actually spawns into is bare. Both gaps are density of scene objects, not palette:
 * swapping materials changed 55–69 % of the island frame yet left the prop count untouched.
 *
 * Everything here is presentation only. Props are `solid: false` with no footprint, so
 * collision, navigation, quest anchors and saves read exactly the authored world.
 */
export const dressEnabled = () =>
  typeof window === "undefined" ||
  new URLSearchParams(window.location.search).get("ki-dress") !== "0";

const SIDE = 2048;
/**
 * Steps are world units between candidate props. Measured against the real catalog: at 150 a
 * chunk carries ~110 wilderness props, about 34 inside one 1452×903 frame — the continent
 * baseline is 6–12 and the densest shipped data (island wilderness) is 65–79. Towns need the
 * same step because the arrival frame is small next to a 3072×2560 settlement.
 */
export const WILD_STEP = 150;
export const WILD_CAP = 130;
export const TOWN_STEP = 150;
export const TOWN_CAP = 320;
export const TOWN_INNER = 380;
export const TOWN_OUTER = 1700;
const TOWN_KEEP = 0.88;

function dressNoise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Biome index of a point, decoded from the chunk's terrain channel like every continent layer. */
export function dressBiomeAt(chunk: BrowserChunk) {
  const t = chunk.terrain;
  const values = decodeRuns(t.biome, t.width * t.height);
  return (p: Point) => {
    const x = Math.max(0, Math.min(t.width - 1, Math.floor((p.x - chunk.x) / t.cell)));
    const y = Math.max(0, Math.min(t.height - 1, Math.floor((p.y - chunk.y) / t.cell)));
    return values[y * t.width + x]!;
  };
}

type Motif = {
  binding: string;
  weight: number;
  width: number;
  height: number;
  kind: "tree" | "bush" | "rock" | "structure";
  /** Lower bound of the density field this motif appears in; keeps ridges rocky and hollows green. */
  minDensity?: number;
};

const m = (
  binding: string,
  weight: number,
  width: number,
  height: number,
  kind: Motif["kind"],
  minDensity = 0,
): Motif => ({ binding, weight, width, height, kind, minDensity });

/** Only bindings that exist in the installed catalog; a missing pack must never be requested. */
const LAND_MOTIFS: Record<string, Motif[]> = {
  verdant: [
    m("object.verdantia-extra.grass", 0.2, 92, 78, "bush"),
    m("object.verdantia-extra.flowers", 0.14, 96, 88, "bush"),
    m("object.verdantia-extra.fern", 0.12, 104, 96, "bush"),
    m("object.verdantia-continent.bush", 0.12, 132, 120, "bush", 0.35),
    m("object.verdantia-continent.flora", 0.08, 100, 92, "bush", 0.35),
    m("object.verdantia-extra.mushrooms", 0.06, 74, 66, "bush", 0.45),
    m("object.verdantia-extra.burdock", 0.05, 96, 104, "bush", 0.45),
    m("object.verdantia-extra.blueberry", 0.05, 118, 108, "bush", 0.5),
    m("object.verdantia-continent.rocks", 0.1, 128, 108, "rock", 0.4),
    m("object.verdantia-extra.stump", 0.04, 110, 96, "rock", 0.5),
    m("object.verdantia-extra.roots", 0.04, 120, 88, "rock", 0.5),
    m("object.verdantia-continent.pine", 0.09, 250, 350, "tree", 0.55),
    m("object.verdantia-continent.oak", 0.11, 300, 380, "tree", 0.6),
    m("object.verdantia-extra.birch", 0.07, 260, 350, "tree", 0.6),
    m("object.verdantia-extra.willow", 0.05, 290, 340, "tree", 0.65),
    m("object.verdantia-extra.ancient-oak", 0.04, 360, 430, "tree", 0.75),
    m("object.verdantia-extra.hill", 0.05, 220, 150, "rock", 0.5),
    m("object.verdantia-extra.cliff", 0.04, 240, 200, "rock", 0.6),
    m("object.verdantia-extra.spring", 0.02, 180, 120, "structure", 0.7),
    m("object.verdantia-extra.arch", 0.02, 220, 210, "structure", 0.8),
    m("object.verdantia-extra.shrine", 0.02, 150, 190, "structure", 0.8),
  ],
  pyra: [
    m("object.pyra-continent.dry-grass", 0.18, 96, 84, "bush"),
    m("object.pyra-continent.weeds", 0.12, 92, 88, "bush"),
    m("object.pyra-continent.leaf-patch", 0.08, 110, 70, "bush"),
    m("object.pyra-continent.berry-bush", 0.08, 126, 112, "bush", 0.4),
    m("object.pyra-continent.copper-bush", 0.06, 120, 108, "bush", 0.45),
    m("object.pyra-continent.lantern-bush", 0.04, 118, 126, "bush", 0.55),
    m("object.pyra-continent.scree", 0.12, 130, 92, "rock", 0.35),
    m("object.pyra-continent.rocks", 0.1, 128, 108, "rock", 0.4),
    m("object.pyra-continent.shards", 0.06, 104, 120, "rock", 0.5),
    m("object.pyra-continent.pahoehoe", 0.06, 180, 110, "rock", 0.5),
    m("object.pyra-continent.hill", 0.06, 230, 150, "rock", 0.55),
    m("object.pyra-continent.cliff", 0.05, 250, 210, "rock", 0.6),
    m("object.pyra-continent.ridge", 0.04, 300, 220, "rock", 0.7),
    m("object.pyra-continent.stump", 0.04, 110, 96, "rock", 0.5),
    m("object.pyra-continent.log", 0.04, 150, 92, "rock", 0.5),
    m("object.pyra-continent.pine", 0.09, 250, 340, "tree", 0.55),
    m("object.pyra-continent.maple", 0.08, 280, 350, "tree", 0.6),
    m("object.pyra-continent.obsidian-spire", 0.03, 160, 300, "structure", 0.75),
    m("object.pyra-continent.rock-arch", 0.02, 240, 200, "structure", 0.8),
    m("object.pyra-continent.crystals", 0.03, 130, 160, "structure", 0.7),
    m("object.pyra-continent.spring", 0.02, 180, 120, "structure", 0.7),
  ],
  aether: [
    m("object.aetheria-continent.flowers", 0.16, 96, 86, "bush"),
    m("object.aetheria-continent.lavender", 0.14, 92, 104, "bush"),
    m("object.aetheria-continent.reeds", 0.1, 96, 120, "bush"),
    m("object.aetheria-continent.bamboo", 0.08, 110, 210, "bush", 0.4),
    m("object.aetheria-continent.hill", 0.1, 220, 150, "rock", 0.4),
    m("object.aetheria-continent.cliff", 0.08, 240, 200, "rock", 0.5),
    m("object.aetheria-continent.peak", 0.05, 300, 260, "rock", 0.65),
    m("object.aetheria-continent.log", 0.05, 150, 92, "rock", 0.45),
    m("object.aetheria-continent.stump", 0.04, 110, 96, "rock", 0.45),
    m("object.aetheria-continent.cherry", 0.12, 300, 370, "tree", 0.55),
    m("object.aetheria-continent.ginkgo", 0.1, 290, 360, "tree", 0.6),
    m("object.aetheria-continent.cypress", 0.09, 220, 360, "tree", 0.6),
    m("object.aetheria-continent.snow-pine", 0.09, 250, 350, "tree", 0.7),
    m("object.aetheria-continent.glacier-ridge", 0.04, 320, 200, "rock", 0.75),
    m("object.aetheria-continent.arch", 0.03, 230, 210, "structure", 0.75),
    m("object.aetheria-continent.spring", 0.03, 180, 120, "structure", 0.6),
    m("object.aetheria-continent.shrine", 0.02, 150, 190, "structure", 0.8),
  ],
  nexus: [
    m("object.nexus-continent.luminous-grass", 0.2, 96, 84, "bush"),
    m("object.nexus-continent.fern", 0.12, 104, 96, "bush"),
    m("object.nexus-continent.mushrooms", 0.08, 78, 70, "bush", 0.4),
    m("object.nexus-continent.violet-bush", 0.12, 128, 116, "bush", 0.35),
    m("object.nexus-continent.rocks", 0.12, 128, 108, "rock", 0.4),
    m("object.nexus-continent.basalt-ridge", 0.07, 260, 170, "rock", 0.55),
    m("object.nexus-continent.cliff", 0.06, 240, 200, "rock", 0.55),
    m("object.nexus-continent.hill", 0.05, 220, 150, "rock", 0.45),
    m("object.nexus-continent.chasm-rim", 0.03, 300, 150, "rock", 0.7),
    m("object.nexus-continent.log", 0.04, 150, 92, "rock", 0.45),
    m("object.nexus-continent.stump", 0.04, 110, 96, "rock", 0.45),
    m("object.nexus-continent.crystals", 0.06, 130, 160, "structure", 0.6),
    m("object.nexus-continent.crystal-outcrop", 0.05, 190, 150, "structure", 0.65),
    m("object.nexus-continent.violet-tree", 0.1, 290, 370, "tree", 0.55),
    m("object.nexus-continent.cyan-tree", 0.08, 270, 350, "tree", 0.6),
    m("object.nexus-continent.silver-cypress", 0.08, 230, 360, "tree", 0.6),
    m("object.nexus-continent.crystal-tree", 0.06, 280, 380, "tree", 0.7),
    m("object.nexus-continent.monolith", 0.03, 160, 300, "structure", 0.75),
    m("object.nexus-continent.stone-arch", 0.02, 240, 210, "structure", 0.8),
    m("object.nexus-continent.spring", 0.02, 180, 120, "structure", 0.65),
  ],
};

/** Motes only where the pack actually ships them; a missing binding is a hard renderer error. */
const LAND_AIR: Record<string, [string, number][]> = {
  nexus: [
    ["fx-dust", 0.4],
    ["fx-petals", 0.25],
    ["fx-fireflies", 0.2],
    ["fx-mist", 0.15],
  ],
  pyra: [
    ["fx-ash", 0.4],
    ["fx-embers", 0.3],
    ["fx-heat", 0.15],
    ["fx-smoke", 0.15],
  ],
};

const cache = new Map<string, Motif[]>();
function motifsFor(land: string) {
  const hit = cache.get(land);
  if (hit) return hit;
  const live = (LAND_MOTIFS[land] ?? []).filter(
    (x) => catalog.renderBindings[x.binding] !== undefined,
  );
  const total = live.reduce((s, x) => s + x.weight, 0);
  const scaled = live.map((x) => ({ ...x, weight: total ? x.weight / total : 0 }));
  cache.set(land, scaled);
  return scaled;
}

function pickMotif(land: string, roll: number, density: number) {
  const list = motifsFor(land).filter((x) => (x.minDensity ?? 0) <= density);
  if (!list.length) return undefined;
  let acc = 0;
  const target = roll * list.reduce((s, x) => s + x.weight, 0);
  for (const motif of list) {
    acc += motif.weight;
    if (acc >= target) return motif;
  }
  return list[list.length - 1];
}

/**
 * Wilderness dressing for a continent chunk. The density field is coarse (700-unit cells) so
 * the result reads as groves and glades instead of a lattice, which is what a uniform grid
 * produces and what the authored canopy thinning in continentObjects was written to avoid.
 */
export function continentDress(
  land: string,
  x: number,
  y: number,
  roads: readonly Road[],
  outside: (p: Point) => boolean,
  onLand: (p: Point) => boolean,
  biomeAt: (p: Point) => number,
): ArtObject[] {
  const result: ArtObject[] = [];
  if (!motifsFor(land).length) return result;
  for (let gy = Math.ceil(y / WILD_STEP); gy * WILD_STEP < y + SIDE; gy++)
    for (let gx = Math.ceil(x / WILD_STEP); gx * WILD_STEP < x + SIDE; gx++) {
      if (result.length >= WILD_CAP) return result;
      const p = {
        x: gx * WILD_STEP + dressNoise(gx * 3, gy * 7) * (WILD_STEP - 18),
        y: gy * WILD_STEP + dressNoise(gx * 11, gy * 5) * (WILD_STEP - 18),
      };
      if (p.x < x || p.x >= x + SIDE || p.y < y || p.y >= y + SIDE) continue;
      if (!outside(p) || !onLand(p)) continue;
      if (roads.some((r) => roadDistance(p, r) < r.width / 2 + 58)) continue;
      const density = dressNoise(Math.floor(p.x / 700), Math.floor(p.y / 700));
      const roll = dressNoise(gx * 41 + 7, gy * 67 + 11);
      if (roll > 0.28 + density * 0.62) continue;
      // Nexus core-waste (biome 3) stays stark; the authored data already draws it as a waste.
      const biome = biomeAt(p);
      if (land === "nexus" && biome === 3 && dressNoise(p.x, p.y) < 0.75) continue;
      // A separate noise stream from the biome filter: sharing one value would always pick the
      // tail of the motif list, because the filter cuts the low range and the pick is a quantile
      // of the same range.
      const motif = pickMotif(land, dressNoise(p.x + 977, p.y - 313), density);
      if (!motif || (land === "nexus" && biome === 3 && motif.kind === "tree")) continue;
      const jitter = 0.82 + dressNoise(p.y, p.x) * 0.4;
      result.push({
        id: `dress-${land}-${gx}-${gy}`,
        kind: motif.kind,
        binding: motif.binding,
        x: p.x,
        y: p.y,
        width: Math.round(motif.width * jitter),
        height: Math.round(motif.height * jitter),
        anchorX: 0.5,
        anchorY: motif.kind === "tree" ? 0.93 : 0.9,
        layer: "objects",
        solid: false,
      });
    }
  return result;
}

/**
 * Airborne motes. Deliberately sparse: every mote is an animated image inside the streamed
 * chunk budget and a dense field measured a screenshot timeout on software WebGL.
 */
export function continentAir(
  land: string,
  x: number,
  y: number,
  outside: (p: Point) => boolean,
  onLand: (p: Point) => boolean,
): ArtObject[] {
  const table = (LAND_AIR[land] ?? []).filter(
    ([name]) => catalog.renderBindings[`object.${land}-continent.${name}`] !== undefined,
  );
  const result: ArtObject[] = [];
  if (!table.length) return result;
  for (let gy = Math.ceil(y / 320); gy * 320 < y + SIDE; gy++)
    for (let gx = Math.ceil(x / 320); gx * 320 < x + SIDE; gx++) {
      const roll = dressNoise(gx * 17 + 3, gy * 31 + 5);
      if (roll > 0.3) continue;
      const p = { x: gx * 320 + roll * 290, y: gy * 320 + dressNoise(gy * 13, gx * 29) * 290 };
      if (p.x < x || p.x >= x + SIDE || p.y < y || p.y >= y + SIDE) continue;
      if (!outside(p) || !onLand(p)) continue;
      let acc = 0;
      const hit = table.find(([, w]) => (acc += w) >= roll / 0.3);
      if (!hit) continue;
      result.push({
        id: `dress-air-${land}-${gx}-${gy}`,
        kind: "ambient-effect",
        binding: `object.${land}-continent.${hit[0]}`,
        x: p.x,
        y: p.y,
        width: 96,
        height: 96,
        anchorX: 0.5,
        anchorY: 0.5,
        layer: "overhead",
        solid: false,
      });
    }
  return result;
}

type Blocker = Point & { width: number; height: number };
type Settlement = {
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number };
};

/**
 * Frames whose background is not a clean cutout, measured as the median alpha of a 40 px band
 * along each cell edge (`sharp` over `art/production/superior-islands-v1/island-N/props.png`):
 * island-1 0-1, island-3 0, island-4 2-4, island-5 0-1, island-2 2-15, island-6 3-51. Only the
 * three island-6 frames above 30 are a problem: their glow is clipped by the cell border, so
 * over dark obsidian it draws a grey rectangle instead of an aura. Until the atlas is re-exported,
 * those motifs fall back to the parent continent's prop, which is installed and cleanly cut.
 */
const HAZY_FRAMES: Record<string, string> = {
  "object.island-6.tree": "object.pyra-continent.maple",
  "object.island-6.rock": "object.pyra-continent.rocks",
  "object.island-6.arch": "object.pyra-continent.rock-arch",
};

const TOWN_MOTIFS: Record<string, Motif[]> = {};
for (let i = 1; i <= 6; i++) {
  const f = `island-${i}`;
  const motif = (name: string, weight: number, w: number, h: number, kind: Motif["kind"]) =>
    m(HAZY_FRAMES[`object.${f}.${name}`] ?? `object.${f}.${name}`, weight, w, h, kind);
  TOWN_MOTIFS[f] = [
    // Trees and rocks carry the frame: in the island-2 capture the 96 px ground cover was lost
    // on a paving texture that already draws its own flowers — the same failure as baked flora.
    motif("tree", 0.38, 250, 320, "tree"),
    motif("flora", 0.18, 96, 86, "bush"),
    motif("rock", 0.18, 120, 100, "rock"),
    motif("cargo", 0.1, 104, 92, "structure"),
    motif("arch", 0.08, 210, 190, "structure"),
    motif("landmark", 0.08, 200, 240, "structure"),
  ];
}

/**
 * Island town dressing. The authored overlay carries nothing inside settlement bounds, so the
 * first frame of every island is bare paving. Props go in a ring around the square — close
 * enough to be on screen at the arrival point, far enough to leave the plaza and its roads
 * walkable and readable. Never solid, never a footprint: the town's collision stays authored.
 */
export function townDress(
  feature: string,
  settlements: readonly Settlement[],
  blockers: readonly Blocker[],
  roads: readonly Road[],
  cityRoads: readonly Blocker[] = [],
): ArtObject[] {
  const motifs = (TOWN_MOTIFS[feature] ?? []).filter(
    (x) => catalog.renderBindings[x.binding] !== undefined,
  );
  if (!motifs.length) return [];
  const total = motifs.reduce((s, x) => s + x.weight, 0);
  const result: ArtObject[] = [];
  for (const s of settlements) {
    const b = s.bounds;
    for (let gy = Math.ceil(b.y / TOWN_STEP); gy * TOWN_STEP < b.y + b.height; gy++)
      for (let gx = Math.ceil(b.x / TOWN_STEP); gx * TOWN_STEP < b.x + b.width; gx++) {
        if (result.length >= TOWN_CAP) return result;
        const p = {
          x: gx * TOWN_STEP + dressNoise(gx * 7, gy * 3) * (TOWN_STEP - 20),
          y: gy * TOWN_STEP + dressNoise(gx * 13, gy * 11) * (TOWN_STEP - 20),
        };
        const fromSquare = Math.hypot(p.x - s.x, p.y - s.y);
        if (fromSquare < TOWN_INNER || fromSquare > TOWN_OUTER) continue;
        if (
          blockers.some(
            (o) =>
              Math.abs(p.x - o.x) < o.width / 2 + 40 && Math.abs(p.y - o.y) < o.height / 2 + 40,
          )
        )
          continue;
        if (roads.some((r) => roadDistance(p, r) < r.width / 2 + 50)) continue;
        if (
          cityRoads.some(
            (r) =>
              Math.abs(p.x - (r.x + r.width / 2)) < r.width / 2 + 40 &&
              Math.abs(p.y - (r.y + r.height / 2)) < r.height / 2 + 40,
          )
        )
          continue;
        const roll = dressNoise(gx * 23 + 5, gy * 29 + 9);
        if (roll > TOWN_KEEP) continue;
        let acc = 0;
        const motif = motifs.find((x) => (acc += x.weight / total) >= roll / TOWN_KEEP);
        if (!motif) continue;
        const jitter = 0.85 + dressNoise(p.y, p.x) * 0.35;
        result.push({
          id: `town-dress-${feature}-${gx}-${gy}`,
          kind: motif.kind,
          binding: motif.binding,
          x: p.x,
          y: p.y,
          width: Math.round(motif.width * jitter),
          height: Math.round(motif.height * jitter),
          anchorX: 0.5,
          anchorY: motif.kind === "tree" ? 0.93 : 0.9,
          layer: "objects",
          solid: false,
        });
      }
  }
  return result;
}
