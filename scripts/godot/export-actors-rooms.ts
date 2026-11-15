/* eslint-disable @typescript-eslint/no-explicit-any -- bridge script over the browser game's loosely typed world data */
/**
 * Rooms (six service interiors per world), NPC and hero actor definitions for the four races' worlds -> JSON.
 * Output: /tmp/godot-actors/{rooms,actors}.json (consumed by scripts/godot/prepare_actors.py). Presentation only.
 * Run: npx tsx scripts/godot/export-actors-rooms.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { actorVisual, catalog } from "../../src/game/assets/catalog";
import { cityRoom } from "../../src/game/city/room";
import { roomPicture } from "../../src/game/city/paintedRooms";

const WORLDS = ["pyra", "verdant", "aether", "nexus"] as const;
const SERVICES = ["hall", "shop", "arena", "depot", "smithy", "inn"] as const;
const ROLES = [
  "guide",
  "hunter",
  "steward",
  "merchant",
  "trainer",
  "keeper",
  "smith",
  "innkeeper",
  "alchemist",
  "warden",
];
mkdirSync("/tmp/godot-actors", { recursive: true });
const rooms: Record<string, any> = {};
for (const w of WORLDS) {
  rooms[w] = {};
  for (const s of SERVICES) rooms[w][s] = { ...cityRoom(s, w), picture: roomPicture(w, s) };
}
const actors: Record<string, any> = {};
const assets: Record<string, any> = {};
const take = (key: string, visual: any) => {
  for (const clip of Object.values(visual.clips) as any[]) {
    const a = catalog.assets.get(clip.asset);
    if (a) assets[clip.asset] = { url: (a as any).url, atlasUrl: (a as any).atlasUrl };
  }
  actors[key] = visual;
};
for (const w of WORLDS) {
  take(`${w}.hero`, actorVisual(w, "hero"));
  for (const r of ROLES) {
    try {
      take(`${w}.npc.${r}`, actorVisual(w, "npc", r));
    } catch {
      /* role without art in this world */
    }
  }
}
writeFileSync("/tmp/godot-actors/rooms.json", JSON.stringify(rooms));
writeFileSync("/tmp/godot-actors/actors.json", JSON.stringify({ actors, assets }));
console.log(
  JSON.stringify({
    worlds: WORLDS.length,
    rooms: WORLDS.length * SERVICES.length,
    actors: Object.keys(actors).length,
    assets: Object.keys(assets).length,
  }),
);
