/** Execute the actual game Navigation against the CPU browser package. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browserNavigation, type GridData } from "../../src/game/world/generated/browserTerrain";
import { distance, type Point } from "../../src/game/navigation";
import type { Obstacle } from "../../src/game/movement";
const root = process.argv[2],
  feature = process.argv[3];
if (!root || !feature) throw Error("Usage: check-navigation ROOT FEATURE [REPORT]");
const read = (name: string) => JSON.parse(readFileSync(join(root, feature, name), "utf8"));
const world = read("world.json") as { geometry: { width: number; height: number } },
  fixtures = read("collision-fixtures.json") as (Point & { walkable: boolean })[];
const nav = browserNavigation(
  world.geometry.width,
  world.geometry.height,
  read("navigation.json") as GridData,
  read("terrain.json") as GridData,
  read("collision.json") as Obstacle[],
);
let collisionChecks = 0;
for (const fixture of fixtures) {
  if (nav.walkable(fixture) !== fixture.walkable)
    throw Error("Python/TypeScript collision mismatch " + JSON.stringify(fixture));
  collisionChecks++;
}
const anchors = read("navigation-anchors.json") as {
  id: string;
  point: Point;
  navigationPoint: Point;
}[];
// Test engine paths across the feature, to city services and to resource approaches.
const selected = [
  ...anchors.slice(0, 8),
  ...anchors.filter((a) => a.id.startsWith("accepted-")),
  ...anchors.slice(-4),
];
const start = anchors[0]!.point;
let paths = 0,
  segments = 0;
const started = performance.now();
for (const target of selected) {
  const path = nav.path(start, target.point);
  if (!path.length) throw Error("Game Navigation found no path: " + target.id);
  let from = start;
  for (const to of path) {
    const steps = Math.max(1, Math.ceil(distance(from, to) / 4));
    for (let i = 0; i <= steps; i++) {
      const p = {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      };
      if (!nav.walkable(p)) throw Error("Engine route intersects collider: " + target.id);
    }
    from = to;
    segments++;
  }
  paths++;
}
const report = {
  feature,
  passed: true,
  engine: "src/game/navigation.ts",
  collisionChecks,
  paths,
  segments,
  seconds: Math.round((performance.now() - started) / 10) / 100,
  footRadius: 12,
};
if (process.argv[4]) writeFileSync(process.argv[4], JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
