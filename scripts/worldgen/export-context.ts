/** Read-only source snapshot for offline CPU generation; never writes runtime map data. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { WORLDS, worldObstacles } from "../../src/game/world/worlds";
const target = process.argv[2];
if (!target) throw new Error("Usage: tsx scripts/worldgen/export-context.ts OUTPUT.json");
const value = {
  version: 1,
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  worlds: Object.fromEntries(
    Object.entries(WORLDS).map(([id, world]) => [
      id,
      {
        ...world,
        obstacles: worldObstacles(world),
        enemies: [],
        monsters: [],
      },
    ]),
  ),
};
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(value));
console.log("Exported immutable generation context:", target);
