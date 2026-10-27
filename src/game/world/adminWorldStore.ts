/**
 * Centralny magazyn i silnik edycji świata dla Administratora i Game Mastera (Ki Legends).
 *
 * Przechowuje nadpisania (overrides) w localStorage pod kluczem `ki-legends:admin-world-overrides-v1`
 * oraz udostępnia funkcje odczytu/zapisu, eksportu/importu JSON i nakładania zmian na żywo bez
 * psucia kanonicznych stałych używanych przez testy jednostkowe (dopóki administrator nie zapisze
 * zmiany).
 */
import { BOSS_CATALOG } from "../bosses/catalog";
import type { BossDefinition } from "../bosses/types";
import { ALL_NPC_DIALOGUES, type NpcDialogueDefinition } from "../dialogue";
import { ITEM_CATALOG } from "../items/catalog";
import { CRAFTING_RECIPES } from "../items/recipes";
import type { CraftingRecipe, ItemDefinition } from "../items/types";
import { KIT_NODES, RACE_BASE } from "../kit/nodes.generated";
import type { KitNodeData, RaceBase } from "../kit/types";
import { MONSTER_BASE, type MonsterBase } from "../monsters/base.generated";
import { MONSTERS, MONSTER_DEFS } from "../monsters/catalog";
import { MATERIALS, type Material } from "../monsters/materials";
import type { MonsterDef } from "../monsters/types";
import { ALL_QUESTS_V2, QUEST_BY_ID } from "../quests/engine";
import type { QuestDefinition } from "../quests/types";
import { ITEMS, type ItemId } from "../session";
import {
  ALL_CITIES_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_HIDDEN_PLACES_V2,
  ALL_ROADS_V2,
  ALL_WORLD_EVENTS_V2,
  CONTINENTS_WORLD_V2,
  type AdventureRoad,
  type CityDefinition as CityZoneV2,
  type FamousLocation,
  type HiddenPlace,
  type WorldEventDefinition,
} from "../worlds";
import { v2Places } from "../worlds/v2Places";
import { WORLD_INDEX } from "./generated/worldVersion";
import type { FeatureId, FeatureInfo } from "./generated/superiorSave";
import type { AuthoredSpawn } from "./generated/spawnStream";
import { RACES, type RaceId, type WorldId } from "./races";
import type { WorldDefinition, WorldNpc } from "./types";
import { WORLDS } from "./worlds";

export const ADMIN_WORLD_STORAGE_KEY = "ki-legends:admin-world-overrides-v1";

export type FeatureOverride = Partial<{
  name: string;
  arrival: { x: number; y: number };
}>;

export type ContinentOverride = Partial<{
  name: string;
  settlement: string;
  architecture: string;
  description: string;
  background: string;
  huntName: string;
  spawn: { x: number; y: number };
  cityName: string;
  cityBounds: { x: number; y: number; width: number; height: number };
  buildings: Record<
    string,
    Partial<{
      name: string;
      district: string;
      description: string;
      door: { x: number; y: number };
    }>
  >;
  npcs: Record<
    string,
    Partial<{
      name: string;
      role: string;
      x: number;
      y: number;
      tint: number;
      dialogue: string;
    }>
  >;
}>;

export type CityV2Override = Partial<{
  name: string;
  atmosphere: string;
  economicAndHistoricalFunction: string;
  isSafeZone: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}>;

export type PlaceOverride = Partial<{
  name: string;
  x: number;
  y: number;
  description: string;
  radius: number;
  rewardXp: number;
  rewardCoins: number;
}>;

export type RoadV2Override = Partial<{
  name: string;
  dangerLevel: number;
  description: string;
  waypoints: { x: number; y: number }[];
  monsterIds: string[];
}>;

export type WorldEventOverride = Partial<{
  name: string;
  description: string;
  x: number;
  y: number;
  radius: number;
  minLevel: number;
  rewardXp: number;
  rewardCoins: number;
}>;

export type MonsterOverride = Partial<{
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  speed: number;
  range: number;
  agro: number;
  attackCd: number;
  respawn: number;
  size: "S" | "M" | "L";
  loot: string[];
}>;

export type BossOverride = Partial<{
  name: string;
  title: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  speed: number;
  range: number;
  agro: number;
  locationName: string;
}>;

export type RaceOverride = Partial<{
  name: string;
  title: string;
  description: string;
  color: string;
  base: Partial<RaceBase>;
  perLevel: Partial<RaceBase>;
}>;

export type SkillNodeOverride = Partial<{
  name: string;
  minLevel: number;
  text: string;
}>;

export type RuntimeItemOverride = Partial<{
  name: string;
  attack: number;
  defense: number;
  price: number;
  sell: number;
}>;

export type CatalogItemOverride = Partial<{
  name: string;
  price: number;
  description: string;
  atkBonus: number;
  defBonus: number;
  hpBonus: number;
  kiBonus: number;
}>;

export type MaterialOverride = Partial<{
  name: string;
  level: number;
  sell: number;
}>;

export type RecipeOverride = Partial<{
  name: string;
  requiredLevel: number;
  craftingCostCoins: number;
  resultItemId: string;
  resultCount: number;
}>;

export type QuestOverride = Partial<{
  title: string;
  recommendedLevel: number;
  giverName: string;
  summary: string;
  repeatable: boolean;
  rewardXp: number;
  rewardCoins: number;
}>;

export type DialogueOverride = Partial<{
  npcName: string;
  role: string;
  greetings: [string, string, string];
  rumors: [string, string, string];
}>;

export type CustomSpawnDef = AuthoredSpawn & {
  feature: FeatureId;
  deleted?: boolean;
};

export interface AdminWorldOverrides {
  version: 1;
  updatedAt: string;
  features: Partial<Record<FeatureId, FeatureOverride>>;
  continents: Partial<Record<WorldId, ContinentOverride>>;
  citiesV2: Record<string, CityV2Override>;
  famousPlaces: Record<string, PlaceOverride>;
  hiddenPlaces: Record<string, PlaceOverride>;
  roadsV2: Record<string, RoadV2Override>;
  worldEvents: Record<string, WorldEventOverride>;
  monsters: Record<string, MonsterOverride>;
  bosses: Record<string, BossOverride>;
  races: Partial<Record<RaceId, RaceOverride>>;
  skillNodes: Record<string, SkillNodeOverride>;
  runtimeItems: Partial<Record<ItemId, RuntimeItemOverride>>;
  catalogItems: Record<string, CatalogItemOverride>;
  materials: Record<string, MaterialOverride>;
  recipes: Record<string, RecipeOverride>;
  quests: Record<string, QuestOverride>;
  dialogues: Record<string, DialogueOverride>;
  customSpawns: Record<string, CustomSpawnDef>;
}

export function emptyAdminWorldOverrides(): AdminWorldOverrides {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    features: {},
    continents: {},
    citiesV2: {},
    famousPlaces: {},
    hiddenPlaces: {},
    roadsV2: {},
    worldEvents: {},
    monsters: {},
    bosses: {},
    races: {},
    skillNodes: {},
    runtimeItems: {},
    catalogItems: {},
    materials: {},
    recipes: {},
    quests: {},
    dialogues: {},
    customSpawns: {},
  };
}

// Keep immutable baseline snapshots of canonical runtime objects so "Reset to canon" works cleanly
const BASELINE = {
  features: structuredClone(WORLD_INDEX.features) as FeatureInfo[],
  worlds: structuredClone(WORLDS) as Record<WorldId, WorldDefinition>,
  citiesV2: structuredClone(ALL_CITIES_V2) as CityZoneV2[],
  famousPlaces: structuredClone(ALL_FAMOUS_LOCATIONS_V2) as FamousLocation[],
  hiddenPlaces: structuredClone(ALL_HIDDEN_PLACES_V2) as HiddenPlace[],
  roadsV2: structuredClone(ALL_ROADS_V2) as AdventureRoad[],
  worldEvents: structuredClone(ALL_WORLD_EVENTS_V2) as WorldEventDefinition[],
  monsterBase: structuredClone(MONSTER_BASE) as MonsterBase[],
  monsters: structuredClone(MONSTERS) as MonsterDef[],
  bosses: structuredClone(BOSS_CATALOG) as BossDefinition[],
  races: structuredClone(RACES),
  raceBase: structuredClone(RACE_BASE),
  kitNodes: structuredClone(KIT_NODES),
  runtimeItems: structuredClone(ITEMS),
  catalogItems: structuredClone(ITEM_CATALOG) as ItemDefinition[],
  materials: structuredClone(MATERIALS) as Record<string, Material>,
  recipes: structuredClone(CRAFTING_RECIPES) as CraftingRecipe[],
  quests: structuredClone(ALL_QUESTS_V2) as QuestDefinition[],
  dialogues: structuredClone(ALL_NPC_DIALOGUES) as Record<string, NpcDialogueDefinition>,
};

const listeners = new Set<() => void>();
let cachedOverrides: AdminWorldOverrides | null = null;

function browserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readAdminWorldOverrides(
  storage?: Pick<Storage, "getItem"> | null,
): AdminWorldOverrides {
  const port = storage !== undefined ? storage : browserStorage();
  if (!port) return cachedOverrides ?? emptyAdminWorldOverrides();
  try {
    const raw = port.getItem(ADMIN_WORLD_STORAGE_KEY);
    if (!raw) return emptyAdminWorldOverrides();
    const parsed = JSON.parse(raw) as Partial<AdminWorldOverrides>;
    if (!parsed || typeof parsed !== "object") return emptyAdminWorldOverrides();
    return {
      ...emptyAdminWorldOverrides(),
      ...parsed,
      version: 1,
    };
  } catch {
    return emptyAdminWorldOverrides();
  }
}

export function writeAdminWorldOverrides(
  next: AdminWorldOverrides,
  storage?: Pick<Storage, "setItem" | "removeItem"> | null,
): AdminWorldOverrides {
  const stamped: AdminWorldOverrides = {
    ...emptyAdminWorldOverrides(),
    ...next,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  cachedOverrides = stamped;
  const port = storage !== undefined ? storage : browserStorage();
  try {
    port?.setItem(ADMIN_WORLD_STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    /* Ignore quota errors in restricted sandboxes */
  }
  applyAdminWorldOverridesToRuntime(stamped);
  for (const listener of listeners) listener();
  return stamped;
}

export function resetAdminWorldOverrides(
  storage?: Pick<Storage, "setItem" | "removeItem"> | null,
): AdminWorldOverrides {
  const fresh = emptyAdminWorldOverrides();
  cachedOverrides = fresh;
  const port = storage !== undefined ? storage : browserStorage();
  try {
    port?.removeItem(ADMIN_WORLD_STORAGE_KEY);
  } catch {
    /* Ignore */
  }
  applyAdminWorldOverridesToRuntime(fresh);
  for (const listener of listeners) listener();
  return fresh;
}

export function subscribeAdminWorld(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function countActiveOverrides(o: AdminWorldOverrides = readAdminWorldOverrides()): number {
  return (
    Object.keys(o.features).length +
    Object.keys(o.continents).length +
    Object.keys(o.citiesV2).length +
    Object.keys(o.famousPlaces).length +
    Object.keys(o.hiddenPlaces).length +
    Object.keys(o.roadsV2).length +
    Object.keys(o.worldEvents).length +
    Object.keys(o.monsters).length +
    Object.keys(o.bosses).length +
    Object.keys(o.races).length +
    Object.keys(o.skillNodes).length +
    Object.keys(o.runtimeItems).length +
    Object.keys(o.catalogItems).length +
    Object.keys(o.materials).length +
    Object.keys(o.recipes).length +
    Object.keys(o.quests).length +
    Object.keys(o.dialogues).length +
    Object.keys(o.customSpawns).length
  );
}

/**
 * Nakłada zapisane przez Administratora nadpisania na obiekty runtime w pamięci.
 * Jeśli brak nadpisań dla danego obiektu, przywraca wartość bazową (BASELINE).
 */
export function applyAdminWorldOverridesToRuntime(
  overrides: AdminWorldOverrides = readAdminWorldOverrides(),
): void {
  // 1. Features (Superior Planet Index)
  for (let i = 0; i < WORLD_INDEX.features.length; i++) {
    const base = BASELINE.features[i]!;
    const target = WORLD_INDEX.features[i]!;
    const ov = overrides.features[base.id as FeatureId];
    target.name = ov?.name ?? base.name;
    target.arrival = ov?.arrival ? { ...ov.arrival } : { ...base.arrival };
  }

  // 2. Continents (WORLDS)
  for (const worldId of Object.keys(BASELINE.worlds) as WorldId[]) {
    const base = BASELINE.worlds[worldId];
    const target = WORLDS[worldId];
    const ov = overrides.continents[worldId];
    target.name = ov?.name ?? base.name;
    target.settlement = ov?.settlement ?? base.settlement;
    target.architecture = ov?.architecture ?? base.architecture;
    target.description = ov?.description ?? base.description;
    target.background = ov?.background ?? base.background;
    target.huntName = ov?.huntName ?? base.huntName;
    target.spawn = ov?.spawn ? { ...ov.spawn } : { ...base.spawn };
    if (target.city && base.city) {
      target.city.name = ov?.cityName ?? base.city.name;
      if (ov?.cityBounds) {
        target.city.bounds = { ...ov.cityBounds };
      } else if (base.city.bounds) {
        target.city.bounds = { ...base.city.bounds };
      } else {
        delete target.city.bounds;
      }
      target.city.buildings = base.city.buildings.map((b) => {
        const bov = ov?.buildings?.[b.id];
        return {
          ...b,
          name: bov?.name ?? b.name,
          district: bov?.district ?? b.district,
          description: bov?.description ?? b.description,
          door: bov?.door ? { ...bov.door } : { ...b.door },
        };
      });
    }
    target.npcs = base.npcs.map((n): WorldNpc => {
      const nov = ov?.npcs?.[n.id];
      const nextNpc: WorldNpc = {
        ...n,
        name: nov?.name ?? n.name,
        role: nov?.role ?? n.role,
        x: nov?.x ?? n.x,
        y: nov?.y ?? n.y,
        tint: nov?.tint ?? n.tint,
      };
      const dlg = nov?.dialogue ?? n.dialogue;
      if (dlg !== undefined) nextNpc.dialogue = dlg;
      return nextNpc;
    });
  }

  // 3. Cities V2 + v2Places
  for (let i = 0; i < ALL_CITIES_V2.length; i++) {
    const base = BASELINE.citiesV2[i]!;
    const target = ALL_CITIES_V2[i]!;
    const ov = overrides.citiesV2[base.id];
    target.name = ov?.name ?? base.name;
    target.atmosphere = ov?.atmosphere ?? base.atmosphere;
    target.economicAndHistoricalFunction =
      ov?.economicAndHistoricalFunction ?? base.economicAndHistoricalFunction;
    target.isSafeZone = ov?.isSafeZone ?? base.isSafeZone;
    target.bounds = ov?.bounds ? { ...ov.bounds } : { ...base.bounds };
    const places = v2Places(target.continent);
    if (places?.cities[target.id]) {
      places.cities[target.id]!.name = target.name;
      places.cities[target.id]!.x = Math.round(target.bounds.x + target.bounds.width / 2);
      places.cities[target.id]!.y = Math.round(target.bounds.y + target.bounds.height / 2);
    }
  }

  // 4. Famous & Hidden Places
  for (let i = 0; i < ALL_FAMOUS_LOCATIONS_V2.length; i++) {
    const base = BASELINE.famousPlaces[i]!;
    const target = ALL_FAMOUS_LOCATIONS_V2[i]!;
    const ov = overrides.famousPlaces[base.id];
    target.name = ov?.name ?? base.name;
    target.coordinates = {
      x: ov?.x ?? base.coordinates.x,
      y: ov?.y ?? base.coordinates.y,
    };
    target.loreAndLegend = ov?.description ?? base.loreAndLegend;
    const places = v2Places(target.continent);
    if (places?.famousById[target.id]) {
      places.famousById[target.id]!.name = target.name;
      places.famousById[target.id]!.x = target.coordinates.x;
      places.famousById[target.id]!.y = target.coordinates.y;
    }
  }

  for (let i = 0; i < ALL_HIDDEN_PLACES_V2.length; i++) {
    const base = BASELINE.hiddenPlaces[i]!;
    const target = ALL_HIDDEN_PLACES_V2[i]!;
    const ov = overrides.hiddenPlaces[base.id];
    target.name = ov?.name ?? base.name;
    target.coordinates = {
      x: ov?.x ?? base.coordinates.x,
      y: ov?.y ?? base.coordinates.y,
    };
    target.radius = ov?.radius ?? base.radius;
    target.description = ov?.description ?? base.description;
    target.reward = {
      ...base.reward,
      xp: ov?.rewardXp ?? base.reward.xp,
      coins: ov?.rewardCoins ?? base.reward.coins,
    };
    const places = v2Places(target.continent);
    if (places?.hidden[target.id]) {
      places.hidden[target.id]!.name = target.name;
      places.hidden[target.id]!.x = target.coordinates.x;
      places.hidden[target.id]!.y = target.coordinates.y;
    }
  }

  // 5. Roads V2 & World Events
  for (let i = 0; i < ALL_ROADS_V2.length; i++) {
    const base = BASELINE.roadsV2[i]!;
    const target = ALL_ROADS_V2[i]!;
    const ov = overrides.roadsV2[base.id];
    target.name = ov?.name ?? base.name;
    target.dangerLevel = ov?.dangerLevel ?? base.dangerLevel;
    target.description = ov?.description ?? base.description;
    target.waypoints = ov?.waypoints
      ? ov.waypoints.map((p) => ({ ...p }))
      : base.waypoints.map((p) => ({ ...p }));
    target.monsterIds = ov?.monsterIds ? [...ov.monsterIds] : [...base.monsterIds];
  }

  for (let i = 0; i < ALL_WORLD_EVENTS_V2.length; i++) {
    const base = BASELINE.worldEvents[i]!;
    const target = ALL_WORLD_EVENTS_V2[i]!;
    const ov = overrides.worldEvents[base.id];
    target.name = ov?.name ?? base.name;
    target.description = ov?.description ?? base.description;
    target.activationCondition = {
      ...base.activationCondition,
      minLevel: ov?.minLevel ?? base.activationCondition.minLevel,
      radius: ov?.radius ?? base.activationCondition.radius,
      coordinates: {
        x: ov?.x ?? base.activationCondition.coordinates.x,
        y: ov?.y ?? base.activationCondition.coordinates.y,
      },
    };
    target.reward = {
      ...base.reward,
      xp: ov?.rewardXp ?? base.reward.xp,
      coins: ov?.rewardCoins ?? base.reward.coins,
    };
  }

  // Sync CONTINENTS_WORLD_V2 references
  for (const cid of Object.keys(CONTINENTS_WORLD_V2) as WorldId[]) {
    CONTINENTS_WORLD_V2[cid].cities = ALL_CITIES_V2.filter((c) => c.continent === cid);
    CONTINENTS_WORLD_V2[cid].famousLocations = ALL_FAMOUS_LOCATIONS_V2.filter(
      (f) => f.continent === cid,
    );
    CONTINENTS_WORLD_V2[cid].hiddenPlaces = ALL_HIDDEN_PLACES_V2.filter((h) => h.continent === cid);
    CONTINENTS_WORLD_V2[cid].roads = ALL_ROADS_V2.filter((r: AdventureRoad) => r.continent === cid);
    CONTINENTS_WORLD_V2[cid].worldEvents = ALL_WORLD_EVENTS_V2.filter((e) => e.continent === cid);
  }

  // 6. Monsters (40 bestiary + runtime defs)
  for (let i = 0; i < MONSTER_BASE.length; i++) {
    const base = BASELINE.monsterBase[i]!;
    const targetBase = MONSTER_BASE[i]!;
    const ov = overrides.monsters[base.id];
    targetBase.name = ov?.name ?? base.name;
    targetBase.level = ov?.level ?? base.level;
    targetBase.hp = ov?.hp ?? base.hp;
    targetBase.atk = ov?.atk ?? base.atk;
    targetBase.def = ov?.def ?? base.def;
    targetBase.xp = ov?.xp ?? base.xp;
    targetBase.speed = ov?.speed ?? base.speed;
    targetBase.range = ov?.range ?? base.range;
    targetBase.agro = ov?.agro ?? base.agro;
    targetBase.size = ov?.size ?? base.size;
    targetBase.loot = ov?.loot ? [...ov.loot] : [...base.loot];
  }

  for (let i = 0; i < MONSTERS.length; i++) {
    const base = BASELINE.monsters[i]!;
    const target = MONSTERS[i]!;
    const ov = overrides.monsters[base.id];
    target.name = ov?.name ?? base.name;
    target.level = ov?.level ?? base.level;
    target.hp = ov?.hp ?? base.hp;
    target.atk = ov?.atk ?? base.atk;
    target.def = ov?.def ?? base.def;
    target.xp = ov?.xp ?? base.xp;
    target.speed = ov?.speed ?? base.speed;
    target.range = ov?.range ?? base.range;
    target.agro = ov?.agro ?? base.agro;
    target.attackCd = ov?.attackCd ?? base.attackCd;
    target.respawn = ov?.respawn ?? base.respawn;
    if (ov?.loot) {
      target.loot = ov.loot.map((name, idx) => ({
        name,
        chance: base.loot[idx]?.chance ?? (idx === 0 ? 0.7 : 0.35),
      }));
    } else {
      target.loot = structuredClone(base.loot);
    }
    MONSTER_DEFS[target.id] = target;
  }

  // 7. Bosses (8 bosses)
  for (let i = 0; i < BOSS_CATALOG.length; i++) {
    const base = BASELINE.bosses[i]!;
    const target = BOSS_CATALOG[i]!;
    const ov = overrides.bosses[base.id];
    target.name = ov?.name ?? base.name;
    target.title = ov?.title ?? base.title;
    target.level = ov?.level ?? base.level;
    target.stats = {
      hp: ov?.hp ?? base.stats.hp,
      atk: ov?.atk ?? base.stats.atk,
      def: ov?.def ?? base.stats.def,
      xp: ov?.xp ?? base.stats.xp,
    };
    target.speed = ov?.speed ?? base.speed;
    target.range = ov?.range ?? base.range;
    target.agro = ov?.agro ?? base.agro;
    target.locationName = ov?.locationName ?? base.locationName;
  }

  // 8. Races & Skill Nodes
  for (const raceId of Object.keys(BASELINE.races) as RaceId[]) {
    const baseRace = BASELINE.races[raceId];
    const targetRace = RACES[raceId];
    const rov = overrides.races[raceId];
    targetRace.name = rov?.name ?? baseRace.name;
    targetRace.title = rov?.title ?? baseRace.title;
    targetRace.description = rov?.description ?? baseRace.description;
    targetRace.color = rov?.color ?? baseRace.color;

    const baseStats = BASELINE.raceBase[raceId];
    const targetStats = RACE_BASE[raceId];
    targetStats.base = { ...baseStats.base, ...(rov?.base ?? {}) };
    targetStats.perLevel = { ...baseStats.perLevel, ...(rov?.perLevel ?? {}) };

    const baseNodes = BASELINE.kitNodes[raceId];
    const targetNodes = KIT_NODES[raceId];
    for (let i = 0; i < baseNodes.length; i++) {
      const bn = baseNodes[i]!;
      const tn = targetNodes[i]! as KitNodeData;
      const nov = overrides.skillNodes[`${raceId}:${bn.id}`];
      tn.name = nov?.name ?? bn.name;
      tn.minLevel = nov?.minLevel ?? bn.minLevel;
      tn.text = nov?.text ?? bn.text;
    }
  }

  // 9. Items, Materials & Recipes
  for (const itemId of Object.keys(BASELINE.runtimeItems) as ItemId[]) {
    const base = BASELINE.runtimeItems[itemId];
    const target = ITEMS[itemId] as {
      name: string;
      attack: number;
      defense: number;
      price: number;
      sell: number;
    };
    const ov = overrides.runtimeItems[itemId];
    target.name = ov?.name ?? base.name;
    target.attack = ov?.attack ?? base.attack;
    target.defense = ov?.defense ?? base.defense;
    target.price = ov?.price ?? base.price;
    target.sell = ov?.sell ?? base.sell;
  }

  for (let i = 0; i < ITEM_CATALOG.length; i++) {
    const base = BASELINE.catalogItems[i]!;
    const target = ITEM_CATALOG[i]!;
    const ov = overrides.catalogItems[base.id];
    target.name = ov?.name ?? base.name;
    target.price = ov?.price ?? base.price;
    target.description = ov?.description ?? base.description;
    target.stats = {
      ...(base.stats ?? {}),
      ...(ov?.atkBonus !== undefined ? { atkBonus: ov.atkBonus } : {}),
      ...(ov?.defBonus !== undefined ? { defBonus: ov.defBonus } : {}),
      ...(ov?.hpBonus !== undefined ? { hpBonus: ov.hpBonus } : {}),
      ...(ov?.kiBonus !== undefined ? { kiBonus: ov.kiBonus } : {}),
    };
  }

  for (const matId of Object.keys(BASELINE.materials)) {
    const base = BASELINE.materials[matId]!;
    const target = MATERIALS[matId]!;
    const ov = overrides.materials[matId];
    target.name = ov?.name ?? base.name;
    target.level = ov?.level ?? base.level;
    target.sell = ov?.sell ?? base.sell;
  }

  for (let i = 0; i < CRAFTING_RECIPES.length; i++) {
    const base = BASELINE.recipes[i]!;
    const target = CRAFTING_RECIPES[i]!;
    const ov = overrides.recipes[base.id];
    target.name = ov?.name ?? base.name;
    target.requiredLevel = ov?.requiredLevel ?? base.requiredLevel;
    target.craftingCostCoins = ov?.craftingCostCoins ?? base.craftingCostCoins;
    target.resultItemId = ov?.resultItemId ?? base.resultItemId;
    target.resultCount = ov?.resultCount ?? base.resultCount;
  }

  // 10. Quests V2 & Dialogues
  for (let i = 0; i < ALL_QUESTS_V2.length; i++) {
    const base = BASELINE.quests[i]!;
    const target = ALL_QUESTS_V2[i]!;
    const ov = overrides.quests[base.id];
    target.title = ov?.title ?? base.title;
    target.recommendedLevel = ov?.recommendedLevel ?? base.recommendedLevel;
    target.giverName = ov?.giverName ?? base.giverName;
    target.summary = ov?.summary ?? base.summary;
    target.repeatable = ov?.repeatable ?? base.repeatable;
    target.reward = {
      ...base.reward,
      xp: ov?.rewardXp ?? base.reward.xp,
      coins: ov?.rewardCoins ?? base.reward.coins,
    };
    QUEST_BY_ID[target.id] = target;
  }

  for (const npcId of Object.keys(BASELINE.dialogues)) {
    const base = BASELINE.dialogues[npcId]!;
    const target = ALL_NPC_DIALOGUES[npcId]!;
    const ov = overrides.dialogues[npcId];
    target.npcName = ov?.npcName ?? base.npcName;
    target.role = ov?.role ?? base.role;
    target.greetings = ov?.greetings ? [...ov.greetings] : [...base.greetings];
    target.rumors = ov?.rumors ? [...ov.rumors] : [...base.rumors];
  }
}

/**
 * Zwraca listę spawnów lądu po nałożeniu zmian administratora (przesunięcia, nowe spawny, usunięcia).
 */
export function applyCustomSpawnsForFeature(
  feature: FeatureId,
  authored: readonly AuthoredSpawn[],
  overrides: AdminWorldOverrides = readAdminWorldOverrides(),
): AuthoredSpawn[] {
  const customForFeature = Object.values(overrides.customSpawns).filter(
    (s) => s.feature === feature,
  );
  if (customForFeature.length === 0) return [...authored];
  const byId = new Map<string, AuthoredSpawn>(authored.map((s) => [s.id, { ...s }]));
  for (const c of customForFeature) {
    if (c.deleted) {
      byId.delete(c.id);
    } else {
      byId.set(c.id, {
        id: c.id.startsWith(feature + "-") ? c.id : `${feature}-${c.id}`,
        kind: c.kind,
        x: c.x,
        y: c.y,
        homeLeash: c.homeLeash,
        respawnMs: Math.max(1000, c.respawnMs),
      });
    }
  }
  return [...byId.values()];
}
