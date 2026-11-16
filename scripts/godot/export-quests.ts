/* eslint-disable @typescript-eslint/no-explicit-any -- bridge script over the browser game's loosely typed definitions */
/**
 * Quest catalogue of the browser game (Argon's engine on world v2) -> /tmp/godot-quests/quests.json.
 * Quests, famous and hidden places with their rewards, the NPCs that give them (with their game bindings) and the v2 place
 * coordinates. The Godot port plays the same rules (scripts/quest_engine.gd mirrors src/game/quests/engine.ts).
 * Run: npx tsx scripts/godot/export-quests.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ALL_QUESTS_V2 } from "../../src/game/quests/engine";
import { ALL_NPC_DIALOGUES } from "../../src/game/dialogue";
import {
  ALL_CITIES_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_HIDDEN_PLACES_V2,
  ALL_WORLD_EVENTS_V2,
} from "../../src/game/worlds";

mkdirSync("/tmp/godot-quests", { recursive: true });
const places = JSON.parse(readFileSync("src/game/worlds/v2Places.generated.json", "utf8"));
const out = {
  quests: ALL_QUESTS_V2,
  famous: ALL_FAMOUS_LOCATIONS_V2.map((f: any) => ({
    id: f.id,
    mapPointId: f.mapPointId,
    continent: f.continent,
    name: f.name,
    lore: f.loreAndLegend,
    minLevel: f.discoveryCondition.minLevel,
    reward: f.firstDiscoveryReward,
  })),
  hidden: ALL_HIDDEN_PLACES_V2.map((h: any) => ({
    id: h.id,
    continent: h.continent,
    name: h.name,
    description: h.description,
    radius: h.radius,
    status: h.implementationStatus,
    reward: h.reward,
  })),
  events: ALL_WORLD_EVENTS_V2.map((e: any) => ({
    id: e.id,
    continent: e.continent,
    name: e.name,
    status: e.implementationStatus,
    minLevel: e.activationCondition.minLevel,
    radius: e.activationCondition.radius,
    repeatability: e.repeatability,
    description: e.description,
    reward: e.reward,
  })),
  cities: ALL_CITIES_V2.map((c: any) => ({
    id: c.id,
    name: c.name,
    continent: c.continent,
    npcs: c.npcs.map((n: any) => ({
      id: n.id,
      bindingId: n.bindingId,
      name: n.name,
      role: n.role,
      story: n.storyConnection,
      offered: n.offeredQuestIds,
    })),
  })),
  places,
  dialogues: ALL_NPC_DIALOGUES,
};
writeFileSync("/tmp/godot-quests/quests.json", JSON.stringify(out));
console.log(
  JSON.stringify({
    quests: out.quests.length,
    famous: out.famous.length,
    hidden: out.hidden.length,
    events: out.events.length,
    cities: out.cities.length,
  }),
);
