/**
 * Playable labyrinths of world v2. Each continent's reserved labyrinth entrance (world.json,
 * kind "maze") leads to a maze built in a sealed pocket of open sea on the same land: at least
 * 3.6 km of water separates it from any shore, so creatures can neither leave nor enter it.
 * Using the land's own coordinates keeps combat, spawns, saves and the online server unchanged.
 *
 * The layout is generated deterministically from a fixed seed (browser and server build the same
 * corridors). Navigation opens exactly the corridor rectangles; everything else stays sea.
 */
import { MONSTER_DEFS } from "../../monsters/catalog";
import type { Obstacle } from "../../movement";
import type { Point } from "../../navigation";
import type { AuthoredSpawn } from "./spawnStream";
import type { ArtObject } from "./renderSuperior";

export type LabyrinthSpec = {
  id: string;
  feature: string;
  name: string;
  /** Reserved overworld entrance (world.json dungeons[kind=maze]). */
  entrance: Point;
  /** Top-left corner of the maze inside the sealed sea pocket. */
  origin: Point;
  cols: number;
  rows: number;
  seed: number;
  floor: "a" | "b";
};

export const LABYRINTH_CELL = 384;
export const LABYRINTH_WALL = 96;

/** Pockets measured on navigation.json: the clearance from any walkable cell is ≥ 5.9 km. */
export const LABYRINTHS: readonly LabyrinthSpec[] = [
  {
    id: "v2-verdant-labyrinth-verdant",
    feature: "verdant",
    name: "Labirynt Splątanych Korzeni",
    entrance: { x: 61296, y: 22896 },
    origin: { x: 69024, y: 50048 },
    cols: 12,
    rows: 12,
    seed: 0x5eed01,
    floor: "a",
  },
  {
    id: "v2-aether-labyrinth-aether",
    feature: "aether",
    name: "Labirynt Mglistych Sal",
    entrance: { x: 43376, y: 32240 },
    origin: { x: 61792, y: 3680 },
    cols: 12,
    rows: 12,
    seed: 0x5eed02,
    floor: "b",
  },
  {
    id: "v2-nexus-labyrinth-nexus",
    feature: "nexus",
    name: "Labirynt Martwych Obwodów",
    entrance: { x: 44656, y: 19696 },
    origin: { x: 3632, y: 41360 },
    cols: 12,
    rows: 12,
    seed: 0x5eed03,
    floor: "b",
  },
  {
    id: "v2-pyra-labyrinth-pyra",
    feature: "pyra",
    name: "Labirynt Wygasłych Pieców",
    entrance: { x: 28144, y: 15248 },
    origin: { x: 56672, y: 33408 },
    cols: 12,
    rows: 12,
    seed: 0x5eed04,
    floor: "a",
  },
];

export const labyrinthsOf = (feature: string) => LABYRINTHS.filter((l) => l.feature === feature);

export type Portal = {
  id: string;
  at: Point;
  radius: number;
  to: Point;
  message: string;
};

export type LabyrinthLayout = {
  spec: LabyrinthSpec;
  /** Walkable rectangles (cell floors and the passages between them). */
  openings: Obstacle[];
  /** Whole maze including its outer walls. */
  bounds: Obstacle;
  arrival: Point;
  exit: Point;
  goal: Point;
  deadEnds: Point[];
  /** Closed edges between cells (or the outer border), for presentation. */
  walls: { x: number; y: number; horizontal: boolean }[];
  portals: Portal[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, LabyrinthLayout>();

export function labyrinthLayout(spec: LabyrinthSpec): LabyrinthLayout {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const { cols, rows } = spec;
  const C = LABYRINTH_CELL,
    W = LABYRINTH_WALL;
  const random = mulberry32(spec.seed);
  // east[i] / south[i]: passage from cell i to its right / lower neighbour.
  const east = new Uint8Array(cols * rows),
    south = new Uint8Array(cols * rows),
    seen = new Uint8Array(cols * rows);
  const start = (rows - 1) * cols; // bottom-left
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack[stack.length - 1]!;
    const x = i % cols,
      y = Math.floor(i / cols);
    const next: [number, () => void][] = [];
    if (x > 0 && !seen[i - 1]) next.push([i - 1, () => (east[i - 1] = 1)]);
    if (x < cols - 1 && !seen[i + 1]) next.push([i + 1, () => (east[i] = 1)]);
    if (y > 0 && !seen[i - cols]) next.push([i - cols, () => (south[i - cols] = 1)]);
    if (y < rows - 1 && !seen[i + cols]) next.push([i + cols, () => (south[i] = 1)]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [n, open] = next[Math.floor(random() * next.length)]!;
    open();
    seen[n] = 1;
    stack.push(n);
  }
  const ox = spec.origin.x,
    oy = spec.origin.y;
  const cellLeft = (x: number) => ox + W / 2 + x * C;
  const cellTop = (y: number) => oy + W / 2 + y * C;
  const centre = (i: number): Point => ({
    x: cellLeft(i % cols) + C / 2,
    y: cellTop(Math.floor(i / cols)) + C / 2,
  });
  const inner = C - W;
  const openings: Obstacle[] = [];
  const walls: LabyrinthLayout["walls"] = [];
  for (let i = 0; i < cols * rows; i++) {
    const x = i % cols,
      y = Math.floor(i / cols);
    const left = cellLeft(x) + W / 2,
      top = cellTop(y) + W / 2;
    openings.push({ x: left, y: top, width: inner, height: inner });
    // Passages overlap both floors so a walking foot never meets a seam.
    if (east[i]) openings.push({ x: left + inner / 2, y: top, width: C, height: inner });
    else if (x < cols - 1)
      walls.push({ x: cellLeft(x) + C, y: cellTop(y) + C / 2, horizontal: false });
    if (south[i]) openings.push({ x: left, y: top + inner / 2, width: inner, height: C });
    else if (y < rows - 1)
      walls.push({ x: cellLeft(x) + C / 2, y: cellTop(y) + C, horizontal: true });
  }
  for (let x = 0; x < cols; x++) {
    walls.push({ x: cellLeft(x) + C / 2, y: cellTop(0), horizontal: true });
    walls.push({ x: cellLeft(x) + C / 2, y: cellTop(rows - 1) + C, horizontal: true });
  }
  for (let y = 0; y < rows; y++) {
    walls.push({ x: cellLeft(0), y: cellTop(y) + C / 2, horizontal: false });
    walls.push({ x: cellLeft(cols - 1) + C, y: cellTop(y) + C / 2, horizontal: false });
  }
  // Breadth-first distances: the goal is the cell farthest from the start.
  const links = (i: number) => {
    const x = i % cols,
      out: number[] = [];
    if (x > 0 && east[i - 1]) out.push(i - 1);
    if (x < cols - 1 && east[i]) out.push(i + 1);
    if (i >= cols && south[i - cols]) out.push(i - cols);
    if (i + cols < cols * rows && south[i]) out.push(i + cols);
    return out;
  };
  const dist = new Int32Array(cols * rows).fill(-1);
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++)
    for (const n of links(queue[q]!))
      if (dist[n]! < 0) {
        dist[n] = dist[queue[q]!]! + 1;
        queue.push(n);
      }
  let goalCell = start;
  for (let i = 0; i < dist.length; i++) if (dist[i]! > dist[goalCell]!) goalCell = i;
  const deadEnds: Point[] = [];
  for (let i = 0; i < cols * rows; i++)
    if (i !== start && i !== goalCell && links(i).length === 1) deadEnds.push(centre(i));
  const s = centre(start);
  const arrival = { x: s.x, y: s.y - 70 };
  const exit = { x: s.x, y: s.y + 90 };
  const goal = centre(goalCell);
  const back = { x: spec.entrance.x, y: spec.entrance.y + 200 };
  const layout: LabyrinthLayout = {
    spec,
    openings,
    bounds: { x: ox, y: oy, width: cols * C + W, height: rows * C + W },
    arrival,
    exit,
    goal,
    deadEnds,
    walls,
    portals: [
      {
        id: spec.id + ":in",
        at: spec.entrance,
        radius: 70,
        to: arrival,
        message: "Wchodzisz do: " + spec.name + ". Uwaga: najsilniejsze potwory tej krainy.",
      },
      {
        id: spec.id + ":out",
        at: exit,
        radius: 48,
        to: back,
        message: "Wychodzisz na powierzchnię.",
      },
      {
        id: spec.id + ":goal",
        at: { x: goal.x, y: goal.y + 90 },
        radius: 48,
        to: back,
        message: "Serce labiryntu zdobyte. Portal wynosi cię na powierzchnię.",
      },
    ],
  };
  cache.set(spec.id, layout);
  return layout;
}

export const labyrinthOpenings = (feature: string) =>
  labyrinthsOf(feature).flatMap((l) => labyrinthLayout(l).openings);
export const labyrinthPortals = (feature: string) =>
  labyrinthsOf(feature).flatMap((l) => labyrinthLayout(l).portals);
export const labyrinthBounds = (feature: string) =>
  labyrinthsOf(feature).map((l) => labyrinthLayout(l).bounds);

/**
 * Creatures of the labyrinth: the land's strongest kinds in dead ends, the strongest one guarding
 * the heart. `kinds` must be sorted strongest first (from the land's own spawn list).
 */
export function labyrinthSpawns(feature: string, kinds: readonly string[]): AuthoredSpawn[] {
  if (!kinds.length) return [];
  const out: AuthoredSpawn[] = [];
  for (const l of labyrinthsOf(feature)) {
    const layout = labyrinthLayout(l);
    const pool = kinds.slice(0, 4);
    layout.deadEnds.forEach((p, n) =>
      out.push({
        id: `${feature}-labyrinth-${n}`,
        kind: pool[n % pool.length]!,
        x: p.x,
        y: p.y,
        homeLeash: 220,
        respawnMs: 120_000,
      }),
    );
    out.push({
      id: `${feature}-labyrinth-guardian`,
      kind: kinds[0]!,
      x: layout.goal.x,
      y: layout.goal.y - 60,
      homeLeash: 200,
      respawnMs: 300_000,
    });
  }
  return out;
}

/** Presentation of the maze through the regular scenery layer (walls, torches, the treasure). */
export function labyrinthArt(feature: string): ArtObject[] {
  const out: ArtObject[] = [];
  const item = (
    id: string,
    binding: string,
    x: number,
    y: number,
    width: number,
    height: number,
    layer: ArtObject["layer"] = "objects",
    anchorX = 0.5,
    anchorY = 0.92,
  ) =>
    out.push({
      id,
      kind: binding,
      binding,
      x,
      y,
      width,
      height,
      anchorX,
      anchorY,
      layer,
      solid: false,
    } as unknown as ArtObject);
  for (const l of labyrinthsOf(feature)) {
    const layout = labyrinthLayout(l);
    const floor = "terrain.dungeon-floor-" + l.floor;
    layout.openings.forEach((o, n) =>
      item(`${l.id}-floor-${n}`, floor, o.x, o.y, o.width, o.height, "below", 0, 0),
    );
    layout.walls.forEach((w, n) =>
      w.horizontal
        ? item(
            `${l.id}-wall-${n}`,
            "object.dungeon-tiles.wall-straight",
            w.x,
            w.y + LABYRINTH_WALL / 2,
            LABYRINTH_CELL + LABYRINTH_WALL,
            250,
          )
        : item(
            `${l.id}-wall-${n}`,
            "object.dungeon-kit.cracked-stone-pillar",
            w.x,
            w.y + LABYRINTH_CELL / 2,
            110,
            200,
          ),
    );
    layout.deadEnds.forEach((p, n) =>
      item(
        `${l.id}-deco-${n}`,
        n % 3 === 0
          ? "object.dungeon-kit.torch-on-a-stand"
          : n % 3 === 1
            ? "object.dungeon-kit.bone-pile"
            : "object.dungeon-kit.glowing-crystal-cluster",
        p.x + 100,
        p.y - 90,
        n % 3 === 0 ? 90 : 120,
        n % 3 === 0 ? 180 : 110,
      ),
    );
    item(
      `${l.id}-exit`,
      "object.dungeon-kit.stone-doorway",
      layout.exit.x,
      layout.exit.y + 40,
      200,
      220,
    );
    item(
      `${l.id}-arrival-torch`,
      "object.dungeon-kit.torch-on-a-stand",
      layout.arrival.x - 120,
      layout.arrival.y,
      90,
      180,
    );
    item(
      `${l.id}-treasure`,
      "object.dungeon-kit.treasure-chest",
      layout.goal.x + 90,
      layout.goal.y - 40,
      130,
      110,
    );
    item(
      `${l.id}-goal-portal`,
      "object.dungeon-kit.stone-doorway",
      layout.goal.x,
      layout.goal.y + 130,
      200,
      220,
    );
  }
  return out;
}

/** The land's spawns plus its labyrinth creatures (strongest kinds of that land). */
export function withLabyrinthSpawns(
  feature: string,
  overworld: readonly AuthoredSpawn[],
  placeable: (p: Point) => boolean,
): AuthoredSpawn[] {
  const kinds = [...new Set(overworld.map((s) => s.kind))].filter((k) => MONSTER_DEFS[k]);
  kinds.sort((a, b) => MONSTER_DEFS[b]!.level - MONSTER_DEFS[a]!.level || a.localeCompare(b));
  // A spawn that cannot stand (e.g. a land without its labyrinth) is skipped, never fatal.
  return [...overworld, ...labyrinthSpawns(feature, kinds).filter(placeable)];
}

/** The labyrinth the point stands in, if any (presentation: location header). */
export function labyrinthAt(feature: string, p: Point): LabyrinthSpec | undefined {
  return labyrinthsOf(feature).find((l) => {
    const b = labyrinthLayout(l).bounds;
    return p.x >= b.x && p.y >= b.y && p.x <= b.x + b.width && p.y <= b.y + b.height;
  });
}
