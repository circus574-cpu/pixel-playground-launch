/* eslint-disable @typescript-eslint/no-explicit-any -- bridge script over the browser game's loosely typed world data */
/**
 * All ten Superior v2 lands -> JSON for the native port, using the browser game's own remapping functions
 * (pyraObjects, continentObjects, aetheriaObjects, nexusObjects, islandObjects) so the scenery matches exactly.
 * Output: /tmp/godot-lands/<land>.json (consumed by scripts/godot/prepare_lands.py). Presentation only.
 * Run: npx tsx scripts/godot/export-lands.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { catalog } from "../../src/game/assets/catalog";
import { pyraObjects, pyraPathScenery } from "../../src/game/world/generated/pyraContinent";
import { continentObjects } from "../../src/game/world/generated/verdantiaContinent";
import { aetheriaObjects } from "../../src/game/world/generated/aetheriaContinent";
import { nexusObjects } from "../../src/game/world/generated/nexusContinent";
import { islandObjects } from "../../src/game/world/generated/islandArt";
import { decodeRuns } from "../../src/game/world/generated/browserTerrain";

const ROOT = "public/game/worlds/superior-v2/";
const LANDS = [
  "pyra",
  "verdant",
  "aether",
  "nexus",
  "island-1",
  "island-2",
  "island-3",
  "island-4",
  "island-5",
  "island-6",
];
type Obj = Record<string, any>;
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

function terrainRoles(land: string, art: any): Record<string, any> {
  const t = (prefix: string, names: string[]) => names.map((n) => `terrain.${prefix}.${n}`);
  if (land === "pyra")
    return {
      biome: t("pyra-continent", ["ash", "basalt", "lava-bank", "gravel"]),
      shore: "terrain.pyra-continent.shore",
      water: "terrain.pyra-continent.water",
      special: "terrain.pyra-continent.lava",
      over1: "terrain.pyra-continent.leaves",
      over2: "terrain.pyra-continent.ash-rock",
      roads: t("pyra-continent", ["road1", "road2", "road3", "road4"]),
    };
  if (land === "verdant")
    return {
      biome: t("verdantia-continent", ["grass", "forest", "rockg", "wet"]),
      shore: "terrain.verdantia-continent.sand",
      water: "terrain.verdantia-continent.water",
      roads: t("verdantia-continent", ["road1", "road2", "road3", "road4"]),
    };
  if (land === "aether")
    return {
      biome: t("aetheria-continent", ["grass", "forest", "rockg", "ice"]),
      shore: "terrain.aetheria-continent.sand",
      water: "terrain.aetheria-continent.water",
      over1: "terrain.aetheria-continent.snow",
      over2: "terrain.aetheria-continent.wet",
      roads: t("aetheria-continent", ["road1", "road2", "road3", "road4", "road5"]),
    };
  if (land === "nexus")
    return {
      biome: t("nexus-continent", ["circuit-plain", "synthetic-garden", "plateau", "core-waste"]),
      shore: "terrain.nexus-continent.sand",
      water: "terrain.nexus-continent.water",
      special: "terrain.nexus-continent.energy-liquid",
      over1: "terrain.nexus-continent.crystal-ground",
      over2: "terrain.nexus-continent.damp-stone",
      roads: t("nexus-continent", ["road1", "road2", "road3", "road4"]),
    };
  return {
    biome: [0, 1, 2, 3].map((i) => `terrain.${land}.biome-${i}`),
    shore: `terrain.${land}.shore`,
    water: land === "island-6" ? art.water : `terrain.${land}.water`,
    special: land === "island-6" ? `terrain.${land}.lava` : undefined,
    roads: [`terrain.${land}.road`],
    plaza: `terrain.${land}.plaza`,
  };
}

mkdirSync("/tmp/godot-lands", { recursive: true });
for (const land of LANDS) {
  const world = read(`${ROOT}${land}/world.json`);
  const paths = read(`${ROOT}${land}/paths.json`);
  const art = read(`${ROOT}art/${land}/feature.art.json`);
  const settlements: any[] = world.settlements;
  const roads = [...world.roads, ...paths.roads].map((r: any) => ({
    points: r.points,
    width: r.width,
    kind: r.kind,
  }));
  const outside = (p: { x: number; y: number }) =>
    !settlements.some(
      (s) =>
        p.x >= s.bounds.x - 12 &&
        p.x <= s.bounds.x + s.bounds.width + 12 &&
        p.y >= s.bounds.y - 12 &&
        p.y <= s.bounds.y + s.bounds.height + 12,
    );
  // biome grid (32 units) from the chunks
  const cols = Math.ceil(world.geometry.width / 32),
    rows = Math.ceil(world.geometry.height / 32);
  const biome = new Uint8Array(cols * rows);
  const items: Obj[] = [];
  for (const f of readdirSync(`${ROOT}art/${land}/chunks`))
    items.push(...read(`${ROOT}art/${land}/chunks/${f}`).objects);
  for (const f of readdirSync(`${ROOT}${land}/chunks`)) {
    const d = read(`${ROOT}${land}/chunks/${f}`);
    const b = decodeRuns(d.terrain.biome, d.terrain.width * d.terrain.height);
    const x0 = d.x / 32,
      y0 = d.y / 32;
    for (let y = 0; y < d.terrain.height && y0 + y < rows; y++)
      for (let x = 0; x < d.terrain.width && x0 + x < cols; x++)
        biome[(y0 + y) * cols + x0 + x] = b[y * d.terrain.width + x]!;
  }
  const biomeAt = (p: { x: number; y: number }) =>
    biome[
      Math.min(rows - 1, Math.max(0, Math.floor(p.y / 32))) * cols +
        Math.min(cols - 1, Math.max(0, Math.floor(p.x / 32)))
    ]!;
  const statics = [
    ...(art.landmarks ?? []),
    ...art.resources,
    ...art.dungeonEntrances,
    ...art.buildings,
    ...(land === "pyra"
      ? []
      : [...(art.acceptedCityBuildings ?? []), ...(art.acceptedCityScenery ?? [])]),
  ];
  items.push(...statics);
  if (land === "pyra") items.push(...pyraPathScenery(roads as any, outside as any));
  let mapped: Obj[];
  if (land === "pyra") mapped = pyraObjects(items as any, outside as any, roads as any);
  else if (land === "verdant")
    mapped = continentObjects(items as any, outside as any, roads as any);
  else if (land === "aether")
    mapped = aetheriaObjects(items as any, outside as any, roads as any, biomeAt as any);
  else if (land === "nexus")
    mapped = nexusObjects(items as any, outside as any, roads as any, biomeAt as any);
  else mapped = islandObjects(land, items as any);
  // resolve bindings to files
  const files: Record<string, any> = {};
  const resolve = (binding: string) => {
    if (binding in files) return files[binding];
    const ref = catalog.renderBindings[binding];
    const asset = ref ? catalog.assets.get(ref.asset) : undefined;
    files[binding] =
      asset && (asset as any).url
        ? {
            url: (asset as any).url,
            origin: (ref as any).origin ?? null,
            frame: (ref as any).frame ?? null,
            tile: (ref as any).tileSize ?? null,
          }
        : null;
    return files[binding];
  };
  const objects = mapped
    .filter((o) => !o.binding.startsWith("object.ki-v2-landmarks") || true)
    .map((o) => ({
      id: o.id,
      x: o.x,
      y: o.y,
      b: o.binding,
      w: o.width,
      h: o.height,
      ay: o.anchorY ?? 0.92,
      below: o.layer === "below" ? 1 : 0,
      fx: o.kind === "ambient-effect" ? 1 : 0,
    }))
    .filter((o) => resolve(o.b) !== null);
  const dropped = mapped.length - objects.length;
  const roles = terrainRoles(land, art);
  const roleBindings = [
    ...roles.biome,
    roles.shore,
    roles.water,
    roles.special,
    roles.over1,
    roles.over2,
    ...(roles.roads ?? []),
    roles.plaza,
  ].filter(Boolean);
  for (const b of roleBindings) resolve(b);
  // The capital of Pyra keeps the painted houses the browser game accepted (one per service).
  const capitalBuildings =
    land === "pyra"
      ? (art.acceptedCityBuildings ?? [])
          .filter((b: any) => resolve(b.binding) !== null)
          .map((b: any) => ({
            id: b.id,
            x: b.x,
            y: b.y,
            w: b.width,
            h: b.height,
            b: b.binding,
            door: b.door ?? null,
          }))
      : [];
  const out = {
    land,
    objects,
    files,
    roles,
    dropped,
    roads,
    capitalBuildings,
    capital: land === "pyra" ? true : false,
  };
  writeFileSync(`/tmp/godot-lands/${land}.json`, JSON.stringify(out));
  console.log(
    JSON.stringify({
      land,
      objects: objects.length,
      bindings: Object.keys(files).length,
      dropped,
      missingTerrain: roleBindings.filter((b) => !files[b]),
    }),
  );
}
