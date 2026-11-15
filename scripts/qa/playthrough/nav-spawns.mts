import { writeFileSync } from "node:fs";
import path from "node:path";
import { worldFileFetcher } from "../../../src/server/characters/superiorSimulation";
import { loadBrowserFeature } from "../../../src/game/world/generated/browserLoader";
import { monsterDef } from "../../../src/game/monsters/catalog";

// Exports Verdantia's overworld spawns near the start city (kind, level, position) for the player bot, and prints an ASCII
// map of walkable ground around the city (every 100 units). Run: OUT=qa-out/spawns.json npx tsx scripts/qa/playthrough/nav-spawns.mts
const fetcher = worldFileFetcher(path.resolve("public"));
const basePath = "/game/worlds/superior-v2";
const loader = await loadBrowserFeature(basePath, "verdant", { fetcher });
const nav = loader.navigation;
for (let y = 33600; y <= 36600; y += 100) {
  let row = String(y).padStart(6) + " ";
  for (let x = 47200; x <= 52200; x += 100) row += nav.walkable({ x, y }) ? "." : "#";
  console.log(row);
}
const raw = (await loader.loadSpawns()) as {
  overworld: { id: string; kind: string; x: number; y: number }[];
};
const all = raw.overworld
  .map((s) => ({
    id: s.id,
    kind: s.kind,
    lvl: monsterDef(s.kind).level,
    x: Math.round(s.x),
    y: Math.round(s.y),
  }))
  .filter(
    (s) =>
      s.kind.startsWith("verdant-") && s.lvl <= 12 && Math.hypot(s.x - 49100, s.y - 34900) < 14000,
  );
const out = process.env["OUT"] ?? "qa-out/spawns.json";
writeFileSync(out, JSON.stringify(all));
console.log("saved", all.length, "spawns to", out);
