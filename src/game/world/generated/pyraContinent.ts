import { catalog } from "../../assets/catalog";
import type { ArtObject } from "./renderSuperior";
import type { Point } from "../../navigation";
import { roadDistance } from "./verdantiaContinent";
type Road = { points: [number, number][]; width: number; kind: string };
const legacyPatches: Record<string, string> = {
  "object.basalt": "ridge",
  "object.nature.patch-basalt-columns": "ridge",
  "object.nature.patch-volcano-active": "crater",
  "object.nature.patch-volcano-dormant": "hill",
  "object.nature.patch-lava-rocks": "pahoehoe",
  "object.nature.patch-boulder-group": "rocks",
  "object.nature.patch-cliff-outcrop": "cliff",
  "object.nature.mountain-peak": "hill",
};

export const pyraMoltenCell = (flags: number, biome: number) =>
  !!(flags & 16) && !(flags & 1) && biome === 2;
export const pyraContinentEnabled = (feature: string) =>
  feature === "pyra" && !!catalog.renderBindings["terrain.pyra-continent.ash"];
export const pyraTerrainBindings = [
  "basalt",
  "ash",
  "gravel",
  "leaves",
  "water",
  "lava",
  "shore",
  "lava-bank",
  "sulfur",
  "ash-rock",
  "road1",
  "road2",
  "road3",
  "road4",
].map((n) => "terrain.pyra-continent." + n);
export const pyraBiomeBindings = ["ash", "basalt", "lava-bank", "gravel"].map(
  (n) => "terrain.pyra-continent." + n,
);
export function pyraNoise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function pyraSceneryName(item: ArtObject, roads: readonly Road[] = []): string | undefined {
  const b = item.binding,
    n = pyraNoise(item.x + 7919, item.y - 313),
    pick = (a: string[]) => a[Math.floor(n * a.length)]!;
  if (legacyPatches[b]) return legacyPatches[b];
  if (/pyra-(oak|tree2)-/.test(b)) return "maple";
  if (/pyra-pine-|mountain-pine-tree/.test(b)) return "pine";
  if (/pyra-(flowerbush|bush)-|biome-forest.flowering-bush/.test(b))
    return pick(["berry-bush", "copper-bush", "lantern-bush"]);
  if (/pyra-(fern|reeds|mushrooms)-/.test(b)) return pick(["dry-grass", "weeds", "leaf-patch"]);
  if (/pyra-stump-/.test(b)) return "stump";
  if (/pyra-log-|biome-forest.fallen-mossy-log/.test(b))
    return n < 0.12 && roads.some((r) => roadDistance(item, r) < r.width / 2 + 220)
      ? "cart"
      : "log";
  if (/pyra-(rocks|boulder)-|biome-forest.mossy-boulder/.test(b)) return "rocks";
  if (b === "object.crystal" || b.endsWith("glowing-crystal-cluster")) return "crystals";
  if (b.endsWith("an-obsidian-shard-formation"))
    return pick(["shards", "shards", "obsidian-spire"]);
  if (b.endsWith("basalt-column-cluster")) return pick(["ridge", "obsidian-spire", "scree"]);
  if (b.endsWith("magma-pool-rim")) return pick(["crater", "fissure", "pahoehoe"]);
  if (b.endsWith("smoking-volcano")) return pick(["hill", "crater"]);
  if (b.endsWith("sulfur-vent-with-yellow-crust")) return "spring";
  if (b.endsWith("cliff-outcrop")) return "cliff";
  if (b.endsWith("pyra-tent")) return "camp";
  if (b.endsWith("pyra-bonfire")) return "fire";
  if (b.endsWith("pyra-totem") || b.endsWith("pyra-war-shrine")) return "ruin";
  if (b.endsWith("pyra-banner")) return "sign";
  if (b.endsWith("pyra-crates")) return "supplies";
  if (b === "object.ruins-props.an-ancient-stone-gate-ruin")
    return pick(["cave", "mine", "rock-arch"]);
  return undefined;
}
export function pyraObjects(
  items: readonly ArtObject[],
  outside: (p: Point) => boolean,
  roads: readonly Road[] = [],
): ArtObject[] {
  return items.flatMap((item) => {
    if (!outside(item)) return [item];
    const name = pyraSceneryName(item, roads);
    if (!name) return [item];
    if (
      !item.solid &&
      !item.footprint &&
      (name === "maple" || name === "pine" || name === "shards" || name === "obsidian-spire")
    ) {
      const density = pyraNoise(item.x / 600, item.y / 600);
      if (
        pyraNoise(item.x, item.y) > 0.18 + density * 0.3 ||
        ((name === "maple" || name === "pine") &&
          roads.some((r) => roadDistance(item, r) < r.width / 2 + 90))
      )
        return [];
    }
    const result: ArtObject[] = [{ ...item, binding: "object.pyra-continent." + name }];
    const effects =
      name === "crater"
        ? ["fx-heat", "fx-smoke"]
        : name === "spring"
          ? ["fx-steam"]
          : name === "fire"
            ? ["fx-embers", "fx-ash"]
            : [];
    for (const effect of effects)
      result.push({
        id: item.id + ":" + effect,
        kind: "ambient-effect",
        binding: "object.pyra-continent." + effect,
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
export function pyraRoadside(
  x: number,
  y: number,
  roads: readonly Road[],
  outside: (p: Point) => boolean,
  land: (p: Point) => boolean,
): ArtObject[] {
  const items: ArtObject[] = [];
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
  for (let gy = Math.ceil(y / 160); gy * 160 < y + 2048; gy++)
    for (let gx = Math.ceil(x / 160); gx * 160 < x + 2048; gx++) {
      const n = pyraNoise(gx, gy);
      if (n < 0.58) continue;
      const p = { x: gx * 160 + (n - 0.5) * 70, y: gy * 160 + (pyraNoise(gy, gx) - 0.5) * 70 };
      if (p.x < x || p.x >= x + 2048 || p.y < y || p.y >= y + 2048 || !outside(p) || !land(p))
        continue;
      const rim = Math.min(...nearby.map((r) => roadDistance(p, r) - r.width / 2));
      if (rim < 40 || rim > 160) continue;
      const names = [
        "dry-grass",
        "leaf-patch",
        "weeds",
        "berry-bush",
        "copper-bush",
        "lantern-bush",
      ];
      items.push({
        id: `pyra-rim-${gx}-${gy}`,
        kind: "bush",
        binding:
          "object.pyra-continent." + names[Math.floor(pyraNoise(gx + 31, gy + 17) * names.length)],
        ...p,
        width: 70,
        height: 65,
        anchorX: 0.5,
        anchorY: 0.92,
        layer: "objects",
        solid: false,
      });
    }
  return items;
}
/** Small graphic causeways on existing wide tracks; no new route or collider. */
export function pyraPathScenery(
  roads: readonly Road[],
  outside: (p: Point) => boolean,
): ArtObject[] {
  const items: ArtObject[] = [];
  for (const road of roads) {
    if (road.width < 64) continue;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!,
        b = road.points[i]!,
        p = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
      if (
        Math.abs(a[0] - b[0]) < 320 ||
        Math.abs(a[1] - b[1]) > 10 ||
        !outside(p) ||
        !outside({ x: p.x - 250, y: p.y - 250 }) ||
        !outside({ x: p.x + 250, y: p.y + 250 })
      )
        continue;
      const name = items.length % 2 ? "steps" : "bridge";
      items.push({
        id: "pyra-path-" + items.length,
        kind: "path-decoration",
        binding: "object.pyra-continent." + name,
        ...p,
        width: road.width * 3.4,
        height: road.width * 2.4,
        anchorX: 0.5,
        anchorY: 0.5,
        layer: "below",
        solid: false,
      });
      break;
    }
    if (items.length === 4) break;
  }
  return items;
}
export function pyraEffectFrame(item: ArtObject, time: number) {
  const phase = (time / 8500 + pyraNoise(item.x, item.y)) % 1;
  return {
    alpha: Math.sin(phase * Math.PI) * (item.binding.endsWith("fx-heat") ? 0.16 : 0.25),
    x: item.x + Math.sin(phase * Math.PI) * 12,
    y: item.y - phase * 55,
  };
}
