import { catalog } from "../../assets/catalog";
import type { ArtObject } from "./renderSuperior";
import type { Point } from "../../navigation";

/** Opt-in presentation only. Authored terrain/navigation/spawns are never rewritten. */
export const verdantiaContinentEnabled = (feature: string) =>
  feature === "verdant" && !!catalog.renderBindings["terrain.verdantia-continent.grass"];
export const continentTerrainBindings = [
  "grass",
  "forest",
  "rockg",
  "wet",
  "sand",
  "water",
  "road1",
  "road2",
  "road3",
  "road4",
].map((n) => "terrain.verdantia-continent." + n);
export const continentBiomeBindings = continentTerrainBindings.slice(0, 4);

/** Retained objects keep their physical metadata. Only non-solid decorative canopies may thin. */
export function continentObjects(
  items: readonly ArtObject[],
  outside: (p: Point) => boolean,
  roads: readonly Road[] = [],
): ArtObject[] {
  return items.flatMap((item) => {
    if (!outside(item)) return [item];
    let name: string | undefined;
    if (/verdant-(oak|tree2)-|biome-forest.tall-broadleaf-oak-tree/.test(item.binding))
      name = "oak";
    else if (/verdant-pine-/.test(item.binding)) name = "pine";
    else if (/verdant-(flowerbush|bush)-|biome-forest.flowering-bush/.test(item.binding))
      name = "bush";
    else if (/verdant-fern-/.test(item.binding)) name = "flora";
    else if (
      /verdant-(rocks|boulder)-/.test(item.binding) ||
      item.binding === "object.biome-forest.mossy-boulder"
    )
      name = "rocks";
    if ((name === "oak" || name === "pine") && !item.solid && !item.footprint) {
      // Decorative canopies form groves and glades rather than a uniform wall of foliage.
      // Solid authored scenery always retains its visible representation.
      const grove = noise(Math.floor(item.x / 620), Math.floor(item.y / 620));
      const retain = noise(Math.floor(item.x), Math.floor(item.y));
      if (
        retain > 0.24 + grove * 0.42 ||
        roads.some((r) => roadDistance(item, r) < r.width / 2 + 85)
      )
        return [];
    }
    return [name ? { ...item, binding: "object.verdantia-continent." + name } : item];
  });
}

type Road = { points: [number, number][]; width: number; kind: string };
export function roadDistance(p: Point, road: Road): number {
  let nearest = Infinity;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!,
      b = road.points[i]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
    );
    nearest = Math.min(nearest, Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy));
  }
  return nearest;
}

function noise(x: number, y: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Small roadside plants from a world-anchored grid; no colliders, no blocked road centres. */
export function continentRoadside(
  x: number,
  y: number,
  roads: readonly Road[],
  outside: (p: Point) => boolean,
  land: (p: Point) => boolean,
): ArtObject[] {
  const items: ArtObject[] = [];
  const nearby = roads.filter((r) =>
    r.points.some((p, i) => {
      const q = r.points[i + 1] ?? p;
      return (
        Math.min(p[0], q[0]) <= x + 2300 &&
        Math.max(p[0], q[0]) >= x - 252 &&
        Math.min(p[1], q[1]) <= y + 2300 &&
        Math.max(p[1], q[1]) >= y - 252
      );
    }),
  );
  if (!nearby.length) return items;
  for (let gy = Math.ceil(y / 112); gy * 112 < y + 2048; gy++)
    for (let gx = Math.ceil(x / 112); gx * 112 < x + 2048; gx++) {
      const n = noise(gx, gy);
      if (n < 0.36) continue;
      const p = { x: gx * 112 + (n - 0.5) * 70, y: gy * 112 + (noise(gy, gx) - 0.5) * 70 };
      // A plant belongs to exactly one chunk, including its jitter.
      if (p.x < x || p.x >= x + 2048 || p.y < y || p.y >= y + 2048 || !outside(p) || !land(p))
        continue;
      const rim = Math.min(...nearby.map((r) => roadDistance(p, r) - r.width / 2));
      if (rim < 36 || rim > 170) continue;
      items.push({
        id: `verdantia-rim-${gx}-${gy}`,
        kind: "bush",
        binding: "object.verdantia-continent." + (n > 0.76 ? "bush" : "flora"),
        ...p,
        width: n > 0.76 ? 95 : 66,
        height: n > 0.76 ? 88 : 65,
        anchorX: 0.5,
        anchorY: 0.92,
        layer: "objects",
        solid: false,
      });
    }
  return items;
}
