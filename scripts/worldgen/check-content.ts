/** Check CPU-generated dungeon/state and resident clock in the game's TypeScript modules. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DungeonProgress, type DungeonFloor } from "../../src/game/world/generated/dungeonProgress";
import {
  SettlementLife,
  type LifeRoutine,
  type Resident,
  type LifeRoute,
} from "../../src/game/world/generated/settlementLife";
import { browserNavigation } from "../../src/game/world/generated/browserTerrain";
const [browser, dungeons, life, output] = process.argv.slice(2);
if (!browser || !dungeons || !life || !output)
  throw Error("Usage: check-content BROWSER DUNGEONS LIFE REPORT");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const regions = read(join(browser, "conversion-report.json")).features as { feature: string }[];
let floors = 0,
  claims = 0,
  residentSamples = 0,
  residentsCount = 0;
for (const { feature } of regions) {
  const entries = read(join(dungeons, feature, "index.json")) as { path: string }[];
  for (const entry of entries) {
    const data = read(join(dungeons, feature, entry.path)) as DungeonFloor;
    const state = new DungeonProgress(data, () => true);
    for (const key of data.keys)
      if (!state.pickup(key.id, key)) throw Error("Key cannot be acquired");
    for (const gate of data.gates) if (!state.open(gate.id, gate)) throw Error("Gate cannot open");
    for (const chest of data.chests) {
      if (!state.claim(chest.id, chest) || state.claim(chest.id, chest))
        throw Error("Chest claim not single-use");
      claims++;
    }
    const restored = new DungeonProgress(data, () => true, state.snapshot());
    for (const chest of data.chests)
      if (restored.claim(chest.id, chest)) throw Error("Chest duplicated after reload");
    floors++;
  }
  const directory = join(browser, feature),
    world = read(join(directory, "world.json"));
  const nav = browserNavigation(
    world.geometry.width,
    world.geometry.height,
    read(join(directory, "navigation.json")),
    read(join(directory, "terrain.json")),
    read(join(directory, "collision.json")),
  );
  const people = read(join(life, feature, "residents.json")) as Resident[],
    routes = read(join(life, feature, "routes.json")) as LifeRoute[],
    routines = read(join(life, feature, "routines.json")) as LifeRoutine[];
  const clock = new SettlementLife(people, routes, routines);
  residentsCount += people.length;
  for (const resident of people)
    for (let t = 0; t < 480000; t += 1000) {
      const position = clock.at(resident, t);
      if (!nav.walkable(position))
        throw Error("Resident intersects world collider: " + resident.id + " at " + t);
      residentSamples++;
    }
  if (clock.nearby(world.geometry.anchor, 120000).length > 16)
    throw Error("Resident activation budget exceeded");
}
const report = {
  passed: true,
  engine: "DungeonProgress + SettlementLife + Navigation",
  regions: regions.length,
  dungeonFloors: floors,
  persistentChestClaims: claims,
  residents: residentsCount,
  residentSamples,
  sampleStepMs: 1000,
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
