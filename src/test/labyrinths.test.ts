// @vitest-environment node
/**
 * Labyrinths on the real world v2 data: sealed in open sea, fully walkable from the arrival to the
 * heart and the exits, portals land on walkable ground, creatures stand inside the corridors.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  browserNavigation,
  decodeRuns,
  type GridData,
} from "../game/world/generated/browserTerrain";
import {
  LABYRINTHS,
  labyrinthArt,
  labyrinthLayout,
  labyrinthOpenings,
  withLabyrinthSpawns,
} from "../game/world/generated/labyrinths";
import type { AuthoredSpawn } from "../game/world/generated/spawnStream";
import { distance } from "../game/navigation";
import type { Obstacle } from "../game/movement";
import { catalog } from "../game/assets/catalog";

const read = (feature: string, file: string) =>
  JSON.parse(readFileSync(`public/game/worlds/superior-v2/${feature}/${file}`, "utf8"));

describe.each(LABYRINTHS.map((l) => [l.feature, l] as const))(
  "labyrinth of %s",
  (feature, spec) => {
    const world = read(feature, "world.json");
    const navData = read(feature, "navigation.json") as GridData;
    const terrain = read(feature, "terrain.json") as GridData;
    const colliders = read(feature, "collision.json") as Obstacle[];
    const { width, height } = world.geometry;
    const layout = labyrinthLayout(spec);
    const nav = browserNavigation(
      width,
      height,
      navData,
      terrain,
      colliders,
      [],
      labyrinthOpenings(feature),
    );
    const plain = browserNavigation(width, height, navData, terrain, colliders);

    it("uses the land's reserved labyrinth entrance", () => {
      const maze = world.dungeons.find((d: { kind: string }) => d.kind === "maze");
      expect(maze.id).toBe(spec.id);
      expect(maze.overworldEntrance).toEqual(spec.entrance);
    });

    it("is sealed in sea at least 3 km from any walkable ground of the land", () => {
      const blocked = decodeRuns(navData.blocked, navData.width * navData.height);
      const b = layout.bounds,
        pad = 3000;
      let open = 0;
      for (let y = Math.floor((b.y - pad) / 16); y < Math.ceil((b.y + b.height + pad) / 16); y++)
        for (let x = Math.floor((b.x - pad) / 16); x < Math.ceil((b.x + b.width + pad) / 16); x++)
          if (blocked[y * navData.width + x] !== 1) open++;
      expect(open).toBe(0);
    });

    it("connects the arrival to the heart, the exit and every dead end", () => {
      expect(nav.walkable(layout.arrival)).toBe(true);
      for (const target of [layout.goal, layout.exit, ...layout.deadEnds]) {
        const path = nav.path(layout.arrival, target);
        expect(path.length).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, target)).toBeLessThan(1);
      }
      expect(distance(layout.arrival, layout.goal)).toBeGreaterThan(1500);
    });

    it("walls stay solid between corridors", () => {
      const wall = layout.walls.find((w) => !w.horizontal)!;
      expect(nav.walkable(wall)).toBe(false);
      expect(plain.walkable(layout.arrival)).toBe(false);
    });

    it("portals lead to walkable ground and never chain into each other", () => {
      expect(nav.walkable(spec.entrance)).toBe(true);
      for (const portal of layout.portals) {
        expect(nav.walkable(nav.safe(portal.to))).toBe(true);
        for (const other of layout.portals)
          expect(distance(portal.to, other.at)).toBeGreaterThan(other.radius + 20);
      }
    });

    it("places creatures inside the corridors with a guardian at the heart", () => {
      const land = read(feature, "spawns.json").overworld as AuthoredSpawn[];
      const all = withLabyrinthSpawns(feature, land, (p) => nav.walkable(p));
      const added = all.slice(land.length);
      expect(added.length).toBe(layout.deadEnds.length + 1);
      expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
      for (const s of added) {
        expect(s.id.startsWith(feature + "-")).toBe(true);
        expect(nav.walkable(s)).toBe(true);
      }
      expect(added.at(-1)!.id).toBe(feature + "-labyrinth-guardian");
    });

    it("draws only installed artwork", () => {
      for (const item of labyrinthArt(feature))
        expect(catalog.renderBindings[item.binding], item.binding).toBeDefined();
    });
  },
);
