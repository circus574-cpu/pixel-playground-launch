import { catalog } from "../../assets/catalog";
import type { ArtObject } from "./renderSuperior";
import type { BrowserChunk } from "./browserLoader";
import { decodeRuns } from "./browserTerrain";
import type { Point } from "../../navigation";
import { roadDistance } from "./verdantiaContinent";
type Road = { points: [number, number][]; width: number; kind: string };
export const aetheriaContinentEnabled = (feature: string) =>
  feature === "aether" && !!catalog.renderBindings["terrain.aetheria-continent.grass"];
export const aetheriaTerrainBindings = [
  "grass",
  "forest",
  "rockg",
  "wet",
  "sand",
  "water",
  "river",
  "snow",
  "ice",
  "road1",
  "road2",
  "road3",
  "road4",
  "road5",
].map((n) => "terrain.aetheria-continent." + n);
export const aetheriaBiomeBindings = ["grass", "forest", "rockg", "ice"].map(
  (n) => "terrain.aetheria-continent." + n,
);
export function aetheriaNoise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Reads authored biome cells only; never invents or changes a climate/nav zone. */
export function aetheriaBiomeAt(chunk: BrowserChunk) {
  const t = chunk.terrain,
    values = decodeRuns(t.biome, t.width * t.height);
  return (p: Point) => {
    const x = Math.max(0, Math.min(t.width - 1, Math.floor((p.x - chunk.x) / t.cell)));
    const y = Math.max(0, Math.min(t.height - 1, Math.floor((p.y - chunk.y) / t.cell)));
    return values[y * t.width + x]!;
  };
}
const patches: Record<string, string> = {
  "object.cloud-peak": "peak",
  "object.garden": "flowers",
  "object.nature.mountain-peak": "peak",
  "object.nature.patch-glacier-block": "glacier-ridge",
  "object.nature.patch-ice-spires": "glacier-ridge",
  "object.nature.grassy-hill": "hill",
  "object.nature.patch-cliff-outcrop": "cliff",
  "object.nature.patch-boulder-group": "hill",
  "object.nature.patch-waterfall": "spring",
  "object.ki-source": "spring",
  "object.cherry-tree": "cherry",
  "object.ki-tree": "ginkgo",
  "object.nature.pine-tree": "cypress",
  "object.nature.flower-bush": "lavender",
  "object.nature.reed-clump": "reeds",
};
export function aetheriaSceneryName(item: ArtObject, biome = 0): string | undefined {
  const b = item.binding,
    n = aetheriaNoise(item.x + 7919, item.y - 313);
  if (patches[b]) {
    const name = patches[b]!;
    if (biome >= 2 && ["cherry", "ginkgo", "cypress"].includes(name)) return "snow-pine";
    if (biome >= 2 && ["lavender", "reeds", "flowers"].includes(name)) return "glacier-ridge";
    return name;
  }
  if (/aether-(oak|tree2)-/.test(b))
    return biome >= 2 ? "snow-pine" : n < 0.68 ? "cherry" : "ginkgo";
  if (/aether-pine-/.test(b)) return biome >= 2 ? "snow-pine" : "cypress";
  if (b.endsWith("snow-covered-pine-tree")) return "snow-pine";
  if (b.endsWith("snowy-mountain-peak")) return "peak";
  if (/tall-ice-spire-cluster|an-ice-crystal-cluster|snowy-rock-ledge/.test(b))
    return "glacier-ridge";
  if (b.endsWith("rock-with-a-small-waterfall") || b.endsWith("aether-spring")) return "spring";
  if (b.endsWith("stone-cairn")) return "shrine";
  if (/aether-(flowerbush|bush)-|biome-forest.flowering-bush/.test(b))
    return biome >= 2 ? "glacier-ridge" : "lavender";
  if (/aether-fern-/.test(b)) return biome >= 2 ? "glacier-ridge" : "flowers";
  if (/aether-reeds-/.test(b)) return biome >= 2 ? "glacier-ridge" : n < 0.5 ? "bamboo" : "reeds";
  if (/aether-mushrooms-/.test(b)) return biome >= 2 ? "glacier-ridge" : "flowers";
  if (/aether-(rocks|boulder)-|biome-forest.mossy-boulder/.test(b))
    return biome >= 2 ? "glacier-ridge" : "hill";
  if (/aether-log-|biome-forest.fallen-mossy-log/.test(b)) return "log";
  if (/aether-stump-/.test(b)) return "stump";
  if (b.endsWith("aether-tent")) return "camp";
  if (b.endsWith("aether-totem")) return "shrine";
  if (b.endsWith("aether-crates")) return "chest";
  if (b.endsWith("aether-banner")) return "sign";
  if (b.endsWith("an-ancient-stone-gate-ruin"))
    return item.id.includes("transit") ? "arch" : item.id.includes("labyrinth") ? "ruin" : "cave";
  return undefined;
}
/** All retained entries preserve physical metadata, positions and interaction identities. */
export function aetheriaObjects(
  items: readonly ArtObject[],
  outside: (p: Point) => boolean,
  roads: readonly Road[] = [],
  biomeAt: (p: Point) => number = () => 0,
): ArtObject[] {
  return items.flatMap((item) => {
    if (!outside(item)) return [item];
    const biome = biomeAt(item),
      name = aetheriaSceneryName(item, biome);
    if (!name) return [item];
    if (!item.solid && !item.footprint) {
      const retain = aetheriaNoise(item.x + 193, item.y - 719);
      if (
        (name === "stump" && retain > (biome >= 2 ? 0.07 : 0.18)) ||
        (name === "log" && retain > (biome >= 2 ? 0.1 : 0.26)) ||
        (["lavender", "flowers", "reeds", "bamboo"].includes(name) && retain > 0.6)
      )
        return [];
    }
    const tree = ["cherry", "ginkgo", "cypress", "snow-pine"].includes(name);
    const smallCold =
      biome >= 2 && /aether-(fern|reeds|mushrooms|bush|flowerbush)-/.test(item.binding);
    if (!item.solid && !item.footprint && (tree || name === "glacier-ridge")) {
      const threshold = smallCold
        ? 0.1
        : tree
          ? biome >= 2
            ? 0.18
            : 0.23 + aetheriaNoise(item.x / 620, item.y / 620) * 0.3
          : 0.16;
      if (
        aetheriaNoise(item.x, item.y) > threshold ||
        (tree && roads.some((r) => roadDistance(item, r) < r.width / 2 + 90))
      )
        return [];
    }
    return [{ ...item, binding: "object.aetheria-continent." + name }];
  });
}
/** Only decorative roadside vegetation; cold authored biomes remain sparse. */
export function aetheriaRoadside(
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
      const n = aetheriaNoise(gx, gy);
      if (n < 0.6) continue;
      const p = { x: gx * 160 + (n - 0.5) * 70, y: gy * 160 + (aetheriaNoise(gy, gx) - 0.5) * 70 };
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
      const names = ["flowers", "lavender", "reeds", "bamboo"];
      result.push({
        id: `aetheria-rim-${gx}-${gy}`,
        kind: "bush",
        binding:
          "object.aetheria-continent." +
          names[Math.floor(aetheriaNoise(gx + 31, gy + 17) * names.length)],
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
