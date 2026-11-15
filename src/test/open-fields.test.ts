/** Real published data: spawns stand on open ground and paths lead to them (scripts/worldgen/v2/open_fields.py). */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { worldFileFetcher } from "../server/characters/superiorSimulation";
import { loadBrowserFeature } from "../game/world/generated/browserLoader";

const fetcher = worldFileFetcher(path.resolve("public"));
const BASE = "/game/worlds/superior-v2";
type Spawn = { id: string; x: number; y: number; streamCell: [number, number]; kind: string };
type Road = { id: string; kind: string; points: [number, number][] };

const RING = Array.from(
  { length: 8 },
  (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const,
);
function distanceToRoads(p: { x: number; y: number }, roads: Road[]): number {
  let best = Infinity;
  for (const r of roads)
    for (let i = 1; i < r.points.length; i++) {
      const [ax, ay] = r.points[i - 1]!,
        [bx, by] = r.points[i]!;
      const dx = bx - ax,
        dy = by - ay,
        len = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len));
      best = Math.min(best, Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy)));
    }
  return best;
}

describe.each(["island-1", "verdant"])("open fields in %s", (land) => {
  it("puts spawns on open ground and leaves their identity alone", async () => {
    const loader = await loadBrowserFeature(BASE, land, { fetcher });
    const spawns = ((await loader.loadSpawns()) as { overworld: Spawn[] }).overworld;
    expect(new Set(spawns.map((s) => s.id)).size).toBe(spawns.length);
    let cramped = 0;
    for (const s of spawns) {
      expect(loader.navigation.walkable(s)).toBe(true);
      expect(s.streamCell).toEqual([Math.floor(s.x / 2048), Math.floor(s.y / 2048)]);
      const blocked = RING.filter(
        ([dx, dy]) => !loader.navigation.walkable({ x: s.x + dx * 120, y: s.y + dy * 120 }),
      ).length;
      if (blocked > 2) cramped++;
    }
    // Before the move about a quarter of the spawns stood wedged between rocks and bushes.
    expect(cramped / spawns.length).toBeLessThan(0.04);
  });
  it("adds walkable paths that lead from the road network to the spawns", async () => {
    const loader = await loadBrowserFeature(BASE, land, { fetcher });
    const roads = loader.definition["roads"] as Road[];
    const own = roads.filter((r) => r.id.startsWith(land + "-spawn-path-"));
    expect(own.length).toBeGreaterThan(5);
    expect(own.every((r) => r.kind === "path")).toBe(true);
    let samples = 0,
      walkable = 0;
    for (const r of own)
      for (let i = 1; i < r.points.length; i++) {
        const [ax, ay] = r.points[i - 1]!,
          [bx, by] = r.points[i]!;
        const steps = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / 64));
        for (let k = 0; k <= steps; k++) {
          samples++;
          if (
            loader.navigation.walkable({
              x: ax + ((bx - ax) * k) / steps,
              y: ay + ((by - ay) * k) / steps,
            })
          )
            walkable++;
        }
      }
    expect(walkable / samples).toBeGreaterThan(0.97);
    const spawns = ((await loader.loadSpawns()) as { overworld: Spawn[] }).overworld;
    const served = spawns.filter((s) => distanceToRoads(s, roads) <= 1100).length;
    expect(served / spawns.length).toBeGreaterThan(0.97);
  });
});

describe("spawns of every land", () => {
  it.each([
    "verdant",
    "aether",
    "nexus",
    "pyra",
    ...Array.from({ length: 6 }, (_, i) => "island-" + (i + 1)),
  ])("stay outside the towns in %s", async (land) => {
    const root = path.resolve("public" + BASE, land);
    const read = async (name: string) => JSON.parse(await readFile(path.join(root, name), "utf8"));
    const world = (await read("world.json")) as {
      settlements: { bounds: { x: number; y: number; width: number; height: number } }[];
    };
    const spawns = (
      (await read("spawns.json")) as { overworld: (Spawn & { safeExclusion: number })[] }
    ).overworld;
    let inside = 0,
      shortfall = 0;
    for (const s of spawns)
      for (const { bounds: b } of world.settlements) {
        const dx = Math.max(b.x - s.x, 0, s.x - (b.x + b.width)),
          dy = Math.max(b.y - s.y, 0, s.y - (b.y + b.height));
        const d = Math.hypot(dx, dy);
        if (d <= 12) inside++; // the game server refuses such a spawn (outsideCities)
        shortfall = Math.max(shortfall, s.safeExclusion - d);
      }
    expect(inside).toBe(0);
    // A few authored spawns of Nexus-9 and the islands were already up to 39 units inside their exclusion ring;
    // relocation never makes that worse.
    expect(shortfall).toBeLessThanOrEqual(40);
  });
});

describe("the game server accepts every land's spawns", () => {
  // prepareSuperior refuses a land whose spawn is not walkable ("Nieprawidłowe spawny"), so every land is checked.
  it.each([
    "verdant",
    "aether",
    "nexus",
    "pyra",
    ...Array.from({ length: 6 }, (_, i) => "island-" + (i + 1)),
  ])(
    "%s: all spawns are walkable",
    async (land) => {
      const loader = await loadBrowserFeature(BASE, land, { fetcher });
      const spawns = ((await loader.loadSpawns()) as { overworld: Spawn[] }).overworld;
      expect(spawns.filter((s) => !loader.navigation.walkable(s))).toEqual([]);
    },
    60_000,
  );
});
