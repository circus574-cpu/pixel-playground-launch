import { catalog } from "../../assets/catalog";
import type { ArtObject } from "./renderSuperior";
import type { BrowserChunk } from "./browserLoader";
import { decodeRuns } from "./browserTerrain";
import type { Point } from "../../navigation";
import { roadDistance } from "./verdantiaContinent";
type Road = { points: [number, number][]; width: number; kind: string };

export const nexusContinentEnabled = (feature: string) =>
  feature === "nexus" && !!catalog.renderBindings["terrain.nexus-continent.circuit-plain"];

/** Charged liquid only ever sits on already impassable core-waste cells. */
export const nexusEnergyCell = (flags: number, biome: number) =>
  !!(flags & 16) && !(flags & 1) && biome === 3;

/** Biomy Nexusa w kolejności `biomeNames` z world.json: obwody, ogrody, płaskowyż, pustkowia. */
export const nexusBiomeBindings = [
  "circuit-plain",
  "synthetic-garden",
  "plateau",
  "core-waste",
].map((n) => "terrain.nexus-continent." + n);
export const nexusTerrainBindings = [
  "circuit-plain",
  "synthetic-garden",
  "plateau",
  "core-waste",
  "moss-stone",
  "pale-plaza",
  "crystal-ground",
  "damp-stone",
  "sand",
  "water",
  "river",
  "ocean",
  "shallow-water",
  "dry-shore",
  "dry-bank",
  "energy-liquid",
  "road1",
  "road2",
  "road3",
  "road4",
  "road5",
].map((n) => "terrain.nexus-continent." + n);

export function nexusNoise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Czyta wyłącznie autorowane komórki biomu; nigdy nie wymyśla ani nie zmienia strefy klimatu. */
export function nexusBiomeAt(chunk: BrowserChunk) {
  const t = chunk.terrain,
    values = decodeRuns(t.biome, t.width * t.height);
  return (p: Point) => {
    const x = Math.max(0, Math.min(t.width - 1, Math.floor((p.x - chunk.x) / t.cell)));
    const y = Math.max(0, Math.min(t.height - 1, Math.floor((p.y - chunk.y) / t.cell)));
    return values[y * t.width + x]!;
  };
}

const patches: Record<string, string> = {
  "object.biome-desert.salt-crystal-formation": "crystals",
  "object.biome-mountain.boulder-pile": "rocks",
  "object.biome-mountain.cliff-outcrop": "cliff",
  "object.biome-mountain.mountain-pine-tree": "silver-cypress",
  "object.biome-mountain.rock-with-a-small-waterfall": "spring",
  "object.biome-mountain.stone-cairn": "monolith",
  "object.biome-snow.an-ice-crystal-cluster": "crystal-outcrop",
  "object.biome-snow.snow-covered-pine-tree": "silver-cypress",
  "object.biome-snow.tall-ice-spire-cluster": "chasm-rim",
  "object.crystal": "crystal-outcrop",
  "object.ki-source": "spring",
  "object.ki-tree": "violet-tree",
};

const TREES = ["violet-tree", "cyan-tree", "silver-cypress", "crystal-tree"];

export function nexusSceneryName(item: ArtObject, biome = 0): string | undefined {
  const b = item.binding,
    n = nexusNoise(item.x + 7919, item.y - 313);
  if (patches[b]) {
    const name = patches[b]!;
    if (biome >= 2 && name === "spring") return "crystal-outcrop";
    return name;
  }
  if (/nexus-(pine|tree2|oak)-/.test(b)) {
    if (biome >= 2) return n < 0.5 ? "silver-cypress" : "crystal-tree";
    return TREES[Math.floor(n * TREES.length) % TREES.length]!;
  }
  if (/nexus-fern-/.test(b)) return biome >= 2 ? "luminous-grass" : "fern";
  if (/nexus-reeds-/.test(b)) return "luminous-grass";
  if (/nexus-mushrooms-/.test(b)) return "mushrooms";
  if (/nexus-(bush|flowerbush)-/.test(b)) return biome >= 2 ? "luminous-grass" : "violet-bush";
  if (/nexus-(rocks|boulder)-/.test(b)) return biome >= 2 ? "basalt-ridge" : "rocks";
  if (/nexus-log-/.test(b)) return "log";
  if (/nexus-stump-/.test(b)) return "stump";
  if (b.endsWith("nexus-tent")) return "camp";
  if (b.endsWith("nexus-crates")) return "supplies";
  if (b.endsWith("nexus-banner")) return "sign";
  if (b.endsWith("nexus-bonfire")) return "energy-brazier";
  if (b.endsWith("nexus-totem")) return "monolith";
  if (b.endsWith("nexus-lab")) return "field-lab";
  if (b.endsWith("nexus-monolith")) return "monolith";
  if (b.endsWith("nexus-reactor")) return "reactor";
  if (b.endsWith("nexus-terminal")) return "terminal";
  if (b.endsWith("an-ancient-stone-gate-ruin"))
    return item.id.includes("transit")
      ? "transit-gate"
      : item.id.includes("labyrinth")
        ? "ruin"
        : "cave";
  return undefined;
}

/** Wszystkie zachowane wpisy utrzymują fizyczne metadane, pozycje i tożsamości interakcji. */
export function nexusObjects(
  items: readonly ArtObject[],
  outside: (p: Point) => boolean,
  roads: readonly Road[] = [],
  biomeAt: (p: Point) => number = () => 0,
): ArtObject[] {
  return items.flatMap((item) => {
    if (!outside(item)) return [item];
    const biome = biomeAt(item),
      name = nexusSceneryName(item, biome);
    if (!name) return [item];
    if (!item.solid && !item.footprint) {
      const retain = nexusNoise(item.x + 193, item.y - 719);
      if (
        (name === "stump" && retain > (biome >= 2 ? 0.07 : 0.18)) ||
        (name === "log" && retain > (biome >= 2 ? 0.1 : 0.26)) ||
        (["luminous-grass", "mushrooms", "fern"].includes(name) && retain > 0.62)
      )
        return [];
    }
    const tree = TREES.includes(name);
    if (!item.solid && !item.footprint && (tree || name === "chasm-rim")) {
      const threshold = tree
        ? biome >= 2
          ? 0.18
          : 0.23 + nexusNoise(item.x / 620, item.y / 620) * 0.3
        : 0.16;
      if (
        nexusNoise(item.x, item.y) > threshold ||
        (tree && roads.some((r) => roadDistance(item, r) < r.width / 2 + 90))
      )
        return [];
    }
    const result: ArtObject[] = [{ ...item, binding: "object.nexus-continent." + name }];
    // Ambient life: energy at machines, fireflies at crystal growths, mist in ruins and caves.
    const effects: string[] =
      name === "reactor" || name === "energy-brazier"
        ? ["fx-energy"]
        : name === "spring"
          ? ["fx-energy", "fx-steam"]
          : name === "crystals" || name === "crystal-outcrop"
            ? ["fx-fireflies"]
            : name === "ruin" || name === "cave"
              ? ["fx-mist"]
              : name === "field-lab" || name === "relay" || name === "terminal"
                ? ["fx-dust"]
                : [];
    // Synthetic gardens shed petals from a third of their canopy.
    if (biome === 1 && TREES.includes(name) && nexusNoise(item.x + 51, item.y + 77) < 0.34)
      effects.push("fx-petals");
    for (const effect of effects)
      result.push({
        id: item.id + ":" + effect,
        kind: "ambient-effect",
        binding: "object.nexus-continent." + effect,
        x: item.x,
        y: item.y - item.height * 0.3,
        width: item.width * 0.55,
        height: item.height * 0.7,
        anchorX: 0.5,
        anchorY: 0.9,
        layer: "overhead",
        solid: false,
      });
    return result;
  });
}

/** Static translucent textures animated by position and fade, like the Pyra ambient set. */
export function nexusEffectFrame(item: ArtObject, time: number) {
  const phase = (((time / 2600 + nexusNoise(item.x, item.y)) % 1) + 1) % 1;
  // Motes released into the air travel; sprites clinging to a machine only shimmer.
  const airborne = item.id.startsWith("nexus-air-");
  const drift = airborne ? 46 : 5;
  const lift = Math.sin(phase * Math.PI * 2) * (airborne ? 22 : 6);
  const alpha =
    (item.binding.endsWith("fx-energy")
      ? 0.2
      : item.binding.endsWith("fx-fireflies")
        ? 0.34
        : item.binding.endsWith("fx-petals")
          ? 0.3
          : 0.22) *
    (0.55 + 0.45 * Math.sin(phase * Math.PI));
  return {
    x: item.x + Math.cos(phase * Math.PI * 2) * drift,
    y: item.y + lift,
    alpha,
  };
}

/** Tylko dekoracyjna roślinność przydrożna; skalne biomy pozostają rzadkie. */
export function nexusRoadside(
  x: number,
  y: number,
  roads: readonly Road[],
  outside: (p: Point) => boolean,
  land: (p: Point) => boolean,
  biomeAt: (p: Point) => number,
): ArtObject[] {
  const nearby = roads.filter((r) =>
    r.points.some((a, i) => {
      const b = r.points[i + 1] ?? a;
      return (
        Math.min(a[0], b[0]) < x + 2300 &&
        Math.max(a[0], b[0]) > x - 252 &&
        Math.min(a[1], b[1]) < y + 2300 &&
        Math.max(a[1], b[1]) > y - 252
      );
    }),
  );
  const result: ArtObject[] = [];
  for (let gy = Math.ceil(y / 160); gy * 160 < y + 2048; gy++)
    for (let gx = Math.ceil(x / 160); gx * 160 < x + 2048; gx++) {
      const n = nexusNoise(gx, gy);
      if (n < 0.6) continue;
      const p = { x: gx * 160 + (n - 0.5) * 70, y: gy * 160 + (nexusNoise(gy, gx) - 0.5) * 70 };
      if (
        p.x < x ||
        p.x >= x + 2048 ||
        p.y < y ||
        p.y >= y + 2048 ||
        !outside(p) ||
        !land(p) ||
        biomeAt(p) >= 2
      )
        continue;
      const rim = Math.min(...nearby.map((r) => roadDistance(p, r) - r.width / 2));
      if (rim < 40 || rim > 160) continue;
      const names = ["luminous-grass", "fern", "violet-bush", "mushrooms"];
      result.push({
        id: `nexus-rim-${gx}-${gy}`,
        kind: "bush",
        binding:
          "object.nexus-continent." +
          names[Math.floor(nexusNoise(gx + 31, gy + 17) * names.length)]!,
        ...p,
        width: 70,
        height: 65,
        anchorX: 0.5,
        anchorY: 0.92,
        layer: "objects",
        solid: false,
      });
    }
  return result;
}

/**
 * Wilderness dressing. The authored continent carries 8–16 props per screen against 104
 * in the capital, so no palette can hide the emptiness. These sprites are deliberately
 * nonphysical: no footprint and solid=false, so collision, navigation and saves stay
 * exactly as authored. Density is capped because every prop is an animated budget image.
 */
export function nexusScatter(
  x: number,
  y: number,
  roads: readonly Road[],
  outside: (p: Point) => boolean,
  land: (p: Point) => boolean,
  biomeAt: (p: Point) => number,
): ArtObject[] {
  const result: ArtObject[] = [];
  const MIX: Record<number, [string, number][]> = {
    0: [
      ["luminous-grass", 0.4],
      ["rocks", 0.25],
      ["fern", 0.2],
      ["crystal-tree", 0.08],
      ["sign", 0.07],
    ],
    1: [
      ["violet-bush", 0.34],
      ["fern", 0.24],
      ["mushrooms", 0.18],
      ["cyan-tree", 0.12],
      ["log", 0.12],
    ],
    2: [
      ["rocks", 0.34],
      ["basalt-ridge", 0.24],
      ["silver-cypress", 0.2],
      ["cliff", 0.14],
      ["stump", 0.08],
    ],
    3: [
      ["crystals", 0.36],
      ["crystal-outcrop", 0.24],
      ["monolith", 0.16],
      ["ruin", 0.14],
      ["chasm-rim", 0.1],
    ],
  };
  for (let gy = Math.ceil(y / 220); gy * 220 < y + 2048; gy++)
    for (let gx = Math.ceil(x / 220); gx * 220 < x + 2048; gx++) {
      if (result.length >= 40) return result;
      const roll = nexusNoise(gx * 41 + 7, gy * 67 + 11);
      if (roll > 0.34) continue;
      const p = {
        x: gx * 220 + nexusNoise(gx, gy * 3) * 190,
        y: gy * 220 + nexusNoise(gx * 5, gy) * 190,
      };
      if (p.x < x || p.x >= x + 2048 || p.y < y || p.y >= y + 2048 || !outside(p) || !land(p))
        continue;
      if (roads.some((r) => roadDistance(p, r) < r.width / 2 + 70)) continue;
      const biome = biomeAt(p);
      let acc = 0;
      const pick = (MIX[biome] ?? MIX[0]!).find(([_, w]) => (acc += w) >= roll / 0.34);
      if (!pick) continue;
      const name = pick[0];
      const big = [
        "cyan-tree",
        "silver-cypress",
        "crystal-tree",
        "cliff",
        "basalt-ridge",
        "chasm-rim",
      ].includes(name);
      result.push({
        id: `nexus-dress-${gx}-${gy}`,
        kind: big ? "tree" : "bush",
        binding: "object.nexus-continent." + name,
        ...p,
        width: big ? 300 : 96,
        height: big ? 360 : 92,
        anchorX: 0.5,
        anchorY: 0.92,
        layer: "objects",
        solid: false,
      });
    }
  return result;
}

/**
 * Airborne motes over the warm biomes only. Kept deliberately sparse: every mote is an
 * animated Phaser image inside the streamed chunk budget, and a dense field measured a
 * screenshot timeout on software WebGL. Cold rock stays stark, which is also the intent.
 */
export function nexusAir(
  x: number,
  y: number,
  outside: (p: Point) => boolean,
  land: (p: Point) => boolean,
  biomeAt: (p: Point) => number,
): ArtObject[] {
  const result: ArtObject[] = [];
  for (let gy = Math.ceil(y / 320); gy * 320 < y + 2048; gy++)
    for (let gx = Math.ceil(x / 320); gx * 320 < x + 2048; gx++) {
      const roll = nexusNoise(gx * 17 + 3, gy * 31 + 5);
      if (roll > 0.3) continue;
      const p = { x: gx * 320 + roll * 290, y: gy * 320 + nexusNoise(gy * 13, gx * 29) * 290 };
      if (p.x < x || p.x >= x + 2048 || p.y < y || p.y >= y + 2048 || !outside(p) || !land(p))
        continue;
      const biome = biomeAt(p);
      if (biome >= 2) continue;
      const binding = biome === 1 ? (roll < 0.07 ? "fx-fireflies" : "fx-petals") : "fx-dust";
      result.push({
        id: `nexus-air-${gx}-${gy}`,
        kind: "ambient-effect",
        binding: "object.nexus-continent." + binding,
        ...p,
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
