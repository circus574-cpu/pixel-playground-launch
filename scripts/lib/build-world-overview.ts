/** Immutable read-only admin catalogue. Run in a fresh process; never applies editor overrides. */
import { writeFileSync } from "node:fs";
import { ALL_QUESTS_V2 } from "../../src/game/quests/engine";
import {
  ALL_CITIES_V2,
  ALL_ROADS_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_HIDDEN_PLACES_V2,
  ALL_WORLD_EVENTS_V2,
} from "../../src/game/worlds";
import { MONSTERS } from "../../src/game/monsters/catalog";
import { BOSS_CATALOG } from "../../src/game/bosses/catalog";
import { WORLDS } from "../../src/game/world/worlds";
import { ALL_NPC_DIALOGUES } from "../../src/game/dialogue";
import { ITEM_CATALOG } from "../../src/game/items/catalog";
import { CRAFTING_RECIPES } from "../../src/game/items/recipes";
import places from "../../src/game/worlds/v2Places.generated.json";
import { itemDropChances } from "../../src/game/items/loot";
const equipmentDrops: Record<string, { itemId: string; name: string; chance: number }[]> = {};
for (const item of ITEM_CATALOG)
  for (const { monster, chance } of itemDropChances(item.id))
    (equipmentDrops[monster.id] ??= []).push({ itemId: item.id, name: item.name, chance });
import { QUEST_NAMES } from "../../src/game/session";
const data = {
  tutorialQuests: QUEST_NAMES,
  roads: ALL_ROADS_V2,
  markets: Object.fromEntries(Object.entries(WORLDS).map(([id, w]) => [id, w.market])),
  places,
  equipmentDrops,
  quests: ALL_QUESTS_V2,
  cities: ALL_CITIES_V2,
  famous: ALL_FAMOUS_LOCATIONS_V2,
  hidden: ALL_HIDDEN_PLACES_V2,
  events: ALL_WORLD_EVENTS_V2,
  monsters: MONSTERS,
  bosses: BOSS_CATALOG,
  npcTemplates: Object.fromEntries(Object.entries(WORLDS).map(([id, w]) => [id, w.npcs])),
  dialogues: ALL_NPC_DIALOGUES,
  items: ITEM_CATALOG,
  recipes: CRAFTING_RECIPES,
};
writeFileSync("src/game/admin/worldOverviewCatalog.generated.json", JSON.stringify(data) + "\n");
console.log("Admin overview catalogue refreshed from runtime definitions.");
