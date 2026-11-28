import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { computePassiveEquipmentBonuses } from "../../game/items";
import { KIT_NODES, RACE_BASE } from "../../game/kit/nodes.generated";
import type { RaceId } from "../../game/world/races";
import {
  ANDROID_CRAFT_RECIPE_MAP,
  ANDROID_CRAFT_RECIPES,
  ANDROID_EQUIPMENT_SETS,
  ENHANCE_MAX_LEVEL,
  ENHANCE_STAT_BONUS_PER_LEVEL,
  HERITAGE_WEAPON_STAGES,
  buildExtendedV2Items,
  enhanceCostForNextTier,
  type AndroidCraftRecipe,
  type HeritageWeaponStage,
} from "./catalogBridge";
import { ANDROID_GOALS_MAP, evaluateGoalForCharacter, type AndroidGoalProgressView } from "./goals";
import {
  ANDROID_PICKUP_RADIUS,
  ANDROID_POSITION_LAYOUT,
  androidBoss,
  androidGatherable,
  androidInn,
  androidIsland,
  androidLegacyKillLevel,
  androidPlayableQuest,
  androidRoom,
  androidSpeciesDrops,
  androidTarget,
  androidTreasure,
  androidWorldEvent,
  walkableAndroidPoint,
  type WorldPoint,
} from "./worldData";

export {
  ANDROID_CRAFT_RECIPES,
  ANDROID_CRAFT_RECIPE_MAP,
  ANDROID_EQUIPMENT_SETS,
  ENHANCE_MAX_LEVEL,
  ENHANCE_STAT_BONUS_PER_LEVEL,
  HERITAGE_WEAPON_STAGES,
  enhanceCostForNextTier,
  type AndroidCraftRecipe,
  type HeritageWeaponStage,
};

export const ANDROID_RACES = ["legend", "planetary", "sage", "android"] as const;
export type AndroidRace = (typeof ANDROID_RACES)[number];

export const ANDROID_CONTINENTS = ["pyra", "verdant", "aether", "nexus"] as const;
export type AndroidContinent = (typeof ANDROID_CONTINENTS)[number];

export const ANDROID_LANDS = [
  "pyra",
  "verdant",
  "aether",
  "nexus",
  "island-1",
  "island-2",
  "island-3",
  "island-4",
  "island-5",
  "island-6",
] as const;
export type AndroidLand = (typeof ANDROID_LANDS)[number];

export const HOME_LAND_BY_RACE: Record<AndroidRace, AndroidLand> = {
  legend: "pyra",
  planetary: "verdant",
  sage: "aether",
  android: "nexus",
};

export const BACKPACK_SIZE = 24;
export const BANK_SIZE = 24;
export const EQUIP_SLOTS = 8;
export const MAX_LEVEL = 100;
export const MAX_GOLD = 10_000_000;
export const TRAINING_COOLDOWN_MS = 8_000;
export const ARENA_COOLDOWN_MS = TRAINING_COOLDOWN_MS;
export const BLESSING_DURATION_MS = 15 * 60 * 1000;
export const GATHER_NODE_COOLDOWN_MS = 90_000;
export const GATHER_GLOBAL_COOLDOWN_MS = 1_200;
export const REST_COOLDOWN_MS = 8_000;
export const BOSS_COOLDOWN_MS = 5 * 60 * 1000;
export const WORLD_EVENT_COOLDOWN_MS = 300_000;
export const WORLD_CONTRACT_COOLDOWN_MS = 600_000;
const INTERACTION_RADIUS = 100;
export const KILL_WINDOW_MS = 1_000;
export const MAX_KILLS_PER_WINDOW = 14;
const LOOT_LIFETIME_MS = 120_000;
const MAX_PENDING_LOOT = 128;
export const QUEST_GOLD_REWARD = 80;
export const QUEST_XP_REWARD = 45;
export const MAX_PLAYER_ANDROID_CHARACTERS = 12;

export type AndroidItemCategory = "weapon" | "armor" | "jewelry" | "consumable" | "material";
export type AndroidItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AndroidItemSource = "shop" | "craft" | "quest" | "gather" | "drop" | "elite" | "legacy";

export type CraftIngredient = { id: string; qty: number };

export type AndroidItemDef = {
  id: string;
  name: string;
  cat: AndroidItemCategory;
  rarity: AndroidItemRarity;
  obtainableFrom: AndroidItemSource;
  minLevel: number;
  icon: string;
  slot: number; // -1 consumable/material, 0..7 equip slot
  desc: string;
  /** Non-null ONLY for consumables and Tier-1 starter gear sold in Shop. */
  shopPrice: number | null;
  /** Sell payout in Shop (0 = unsellable). */
  sellPrice: number;
  /** Gold fee in Smithy (non-null ONLY for craftable gear). */
  craftCost: number | null;
  /** Materials required in Smithy for crafting. */
  craftIngredients?: readonly CraftIngredient[];
  setId?: string;
  atk?: number;
  def?: number;
  hp?: number;
  ki?: number;
  spd?: number;
  crit?: number;
  healHp?: number;
  healKi?: number;
  gold?: number;
};

/**
 * Canonical Android/Godot item catalog aligned with owner's V2 economy (12.11.2026 & 25.11.2026):
 * - Shop: ONLY consumables + Tier 1 starter common gear (Lv.1-2). NO rare/epic/legendary, NO pouch_gold!
 * - Craft (Smithy): Majority of equipment (Tier 2 uncommon Lv.2-4, Tier 3 rare Lv.6-9, Tier 4 epic Lv.10-14 + 265 V2 recipes)
 *   requiring real gathered materials + monster trophies + Elite cores + gold + level gate!
 * - Hard Quests / Labyrinths / Bosses / Elites: Unique rare/epic/legendary items not purchasable in shop!
 */
const ANDROID_BASE_ITEM_CATALOG: readonly AndroidItemDef[] = [
  // =========================================================================
  // 1. CONSUMABLES (Shop + Drops)
  // =========================================================================
  {
    id: "potion_hp_small",
    name: "Mała Mikstura Życia",
    cat: "consumable",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "item-potion.webp",
    slot: -1,
    desc: "Przywraca +75 HP",
    shopPrice: 45,
    sellPrice: 12,
    craftCost: null,
    healHp: 75,
  },
  {
    id: "potion_hp",
    name: "Wielki Eliksir Życia",
    cat: "consumable",
    rarity: "uncommon",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "gear-potion.webp",
    slot: -1,
    desc: "Przywraca +160 HP",
    shopPrice: 110,
    sellPrice: 28,
    craftCost: null,
    healHp: 160,
  },
  {
    id: "potion_ki",
    name: "Eliksir Energii Ki",
    cat: "consumable",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "emblem_potion.webp",
    slot: -1,
    desc: "Przywraca +80 KI",
    shopPrice: 90,
    sellPrice: 22,
    craftCost: null,
    healKi: 80,
  },
  {
    id: "scroll_tp",
    name: "Zwój Powrotu do Stolicy",
    cat: "consumable",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "emblem_scroll.webp",
    slot: -1,
    desc: "Natychmiastowy powrót do stolicy (bez czasu oczekiwania)",
    shopPrice: 80,
    sellPrice: 20,
    craftCost: null,
  },
  {
    // Legacy save compatibility only — NEVER sold in Shop (closes +380g exploit!)
    id: "pouch_gold",
    name: "Sakiewka Złota (Archiwalna)",
    cat: "consumable",
    rarity: "common",
    obtainableFrom: "legacy",
    minLevel: 1,
    icon: "gear-coin.webp",
    slot: -1,
    desc: "Dodaje 100 złota",
    shopPrice: null,
    sellPrice: 0,
    craftCost: null,
    gold: 100,
  },

  // =========================================================================
  // 2. GATHERED MATERIALS (12 regional resources — server-authoritative!)
  // =========================================================================
  {
    id: "mat_ember",
    name: "Esencja Płomienia",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-esencja-plomienia.webp",
    slot: -1,
    desc: "Surowiec Pyry do craftingu w Kuźni",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_obsidian",
    name: "Odłamek Obsydianu",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-obsydian.webp",
    slot: -1,
    desc: "Surowiec Pyry do wykuwania broni i pancerzy",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_ash_herb",
    name: "Skrzydło Żaru",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-skrzydlo-zaru.webp",
    slot: -1,
    desc: "Zioło Pyry używane w rzemiośle",
    shopPrice: null,
    sellPrice: 15,
    craftCost: null,
  },
  {
    id: "mat_shroom",
    name: "Czerwony Grzyb",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-czerwony-grzyb.webp",
    slot: -1,
    desc: "Surowiec Verdantii do craftingu",
    shopPrice: null,
    sellPrice: 16,
    craftCost: null,
  },
  {
    id: "mat_amber",
    name: "Złoty Bursztyn",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-bursztyn.webp",
    slot: -1,
    desc: "Surowiec Verdantii do wykuwania broni i biżuterii",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_seeds",
    name: "Nasiona Gaju",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-nasiona.webp",
    slot: -1,
    desc: "Surowiec Verdantii do pancerzy natury",
    shopPrice: null,
    sellPrice: 15,
    craftCost: null,
  },
  {
    id: "mat_rune",
    name: "Kamień Runiczny",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-kamien-runiczny.webp",
    slot: -1,
    desc: "Surowiec Aetherii do kosturów i pieczęci",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_lightdust",
    name: "Pył Światła",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-pyl-swiatla.webp",
    slot: -1,
    desc: "Surowiec Aetherii do amuletów i hełmów",
    shopPrice: null,
    sellPrice: 17,
    craftCost: null,
  },
  {
    id: "mat_parchment",
    name: "Karta Pergaminu",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-karta-pergaminu.webp",
    slot: -1,
    desc: "Surowiec Aetherii do zaawansowanych receptur",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_plasma",
    name: "Rdzeń Plazmy",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-rdzen-plazmy.webp",
    slot: -1,
    desc: "Surowiec Nexus-9 do uzbrojenia plazmowego",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_coil",
    name: "Cewka Zasilająca",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-cewka.webp",
    slot: -1,
    desc: "Surowiec Nexus-9 do obwodów bojowych",
    shopPrice: null,
    sellPrice: 18,
    craftCost: null,
  },
  {
    id: "mat_optic",
    name: "Moduł Optyczny",
    cat: "material",
    rarity: "common",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "material-modul-optyczny.webp",
    slot: -1,
    desc: "Surowiec Nexus-9 do precyzyjnego sprzętu",
    shopPrice: null,
    sellPrice: 17,
    craftCost: null,
  },

  // =========================================================================
  // 3. MONSTER TROPHIES & ELITE / LABYRINTH CORES
  // =========================================================================
  {
    id: "crystal_ki",
    name: "Kryształ Skupienia Ki",
    cat: "material",
    rarity: "uncommon",
    obtainableFrom: "gather",
    minLevel: 1,
    icon: "emblem_crystal.webp",
    slot: -1,
    desc: "Uniwersalny kryształ rzemieślniczy (zbiór i potwory)",
    shopPrice: null,
    sellPrice: 24,
    craftCost: null,
  },
  {
    id: "tusk_beast",
    name: "Kieł Bestii",
    cat: "material",
    rarity: "common",
    obtainableFrom: "drop",
    minLevel: 1,
    icon: "gear-tusk.webp",
    slot: -1,
    desc: "Trofeum z potworów (do Kuźni lub na sprzedaż)",
    shopPrice: null,
    sellPrice: 16,
    craftCost: null,
  },
  {
    id: "mat_salamander_scale",
    name: "Łuska Salamandry",
    cat: "material",
    rarity: "uncommon",
    obtainableFrom: "drop",
    minLevel: 2,
    icon: "material-luska-salamandry.webp",
    slot: -1,
    desc: "Trofeum potworów Pyry do craftingu",
    shopPrice: null,
    sellPrice: 24,
    craftCost: null,
  },
  {
    id: "mat_magma_plate",
    name: "Magmowy Pancerz",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "drop",
    minLevel: 6,
    icon: "material-magmowy-pancerz.webp",
    slot: -1,
    desc: "Rzadkie trofeum silnych potworów Pyry",
    shopPrice: null,
    sellPrice: 40,
    craftCost: null,
  },
  {
    id: "mat_moss_jelly",
    name: "Mchowa Galaretka",
    cat: "material",
    rarity: "common",
    obtainableFrom: "drop",
    minLevel: 1,
    icon: "material-mchowa-galaretka.webp",
    slot: -1,
    desc: "Trofeum potworów Verdantii do craftingu",
    shopPrice: null,
    sellPrice: 20,
    craftCost: null,
  },
  {
    id: "mat_wolf_thorn",
    name: "Cierń Wilka",
    cat: "material",
    rarity: "uncommon",
    obtainableFrom: "drop",
    minLevel: 3,
    icon: "material-ciern-wilka.webp",
    slot: -1,
    desc: "Trofeum drapieżników Verdantii",
    shopPrice: null,
    sellPrice: 26,
    craftCost: null,
  },
  {
    id: "mat_spider_silk",
    name: "Jedwab Pająka",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "drop",
    minLevel: 6,
    icon: "material-jedwab-pajaka.webp",
    slot: -1,
    desc: "Rzadkie trofeum głębokiego lasu Verdantii",
    shopPrice: null,
    sellPrice: 40,
    craftCost: null,
  },
  {
    id: "mat_aether_thread",
    name: "Nić Eteru",
    cat: "material",
    rarity: "common",
    obtainableFrom: "drop",
    minLevel: 1,
    icon: "material-nic-eteru.webp",
    slot: -1,
    desc: "Trofeum istot Aetherii do craftingu",
    shopPrice: null,
    sellPrice: 20,
    craftCost: null,
  },
  {
    id: "mat_crystal_wing",
    name: "Kryształowe Skrzydło",
    cat: "material",
    rarity: "uncommon",
    obtainableFrom: "drop",
    minLevel: 3,
    icon: "material-skrzydlo-krysztalowe.webp",
    slot: -1,
    desc: "Trofeum eterycznych bestii Aetherii",
    shopPrice: null,
    sellPrice: 26,
    craftCost: null,
  },
  {
    id: "mat_temple_stone",
    name: "Kamień Świątynny",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "drop",
    minLevel: 6,
    icon: "material-kamien-swiatynny.webp",
    slot: -1,
    desc: "Rzadkie trofeum strażników Aetherii",
    shopPrice: null,
    sellPrice: 40,
    craftCost: null,
  },
  {
    id: "mat_sensor",
    name: "Czujnik Drona",
    cat: "material",
    rarity: "common",
    obtainableFrom: "drop",
    minLevel: 1,
    icon: "material-czujnik.webp",
    slot: -1,
    desc: "Trofeum maszyn Nexus-9 do craftingu",
    shopPrice: null,
    sellPrice: 20,
    craftCost: null,
  },
  {
    id: "mat_armor_plate",
    name: "Płyta Pancerna",
    cat: "material",
    rarity: "uncommon",
    obtainableFrom: "drop",
    minLevel: 3,
    icon: "material-plyta-pancerna.webp",
    slot: -1,
    desc: "Trofeum jednostek bojowych Nexus-9",
    shopPrice: null,
    sellPrice: 26,
    craftCost: null,
  },
  {
    id: "mat_energy_core",
    name: "Rdzeń Energii",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "drop",
    minLevel: 6,
    icon: "material-rdzen-energii.webp",
    slot: -1,
    desc: "Rzadkie trofeum ciężkich mechów Nexus-9",
    shopPrice: null,
    sellPrice: 40,
    craftCost: null,
  },
  {
    id: "mat_elite_core",
    name: "Rdzeń Alfy",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "elite",
    minLevel: 5,
    icon: "material-zloty-pancerz.webp",
    slot: -1,
    desc: "Gwarantowany łup z Elit — wymagany do zaawansowanego craftu (Poz. 6+)",
    shopPrice: null,
    sellPrice: 75,
    craftCost: null,
  },
  {
    id: "mat_labyrinth_relic",
    name: "Relikt Labiryntu",
    cat: "material",
    rarity: "epic",
    obtainableFrom: "quest",
    minLevel: 5,
    icon: "material-maska-rytualu.webp",
    slot: -1,
    desc: "Zdobywany za ukończenie Labiryntu (4/4 skrzynie) — składnik mistrzowskiej Kuźni",
    shopPrice: null,
    sellPrice: 120,
    craftCost: null,
  },

  // =========================================================================
  // 4. TIER 1 — STARTER SHOP GEAR (common, Lv.1-2 — ONLY gear sold in Shop!)
  // =========================================================================
  {
    id: "weapon_recruit_sword",
    name: "Miecz Rekruta",
    cat: "weapon",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "item-sword.webp",
    slot: 2,
    desc: "Poz. 1 • +7 Atak (Sklep — podstawowy)",
    shopPrice: 180,
    sellPrice: 45,
    craftCost: null,
    atk: 7,
  },
  {
    id: "weapon_apprentice_staff",
    name: "Kostur Ucznia",
    cat: "weapon",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "emblem_crystal.webp",
    slot: 2,
    desc: "Poz. 1 • +6 Atak • +18 KI (Sklep — podstawowy)",
    shopPrice: 180,
    sellPrice: 45,
    craftCost: null,
    atk: 6,
    ki: 18,
  },
  {
    id: "armor_traveler_vest",
    name: "Przeszywanica Wędrowca",
    cat: "armor",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "item-vest.webp",
    slot: 4,
    desc: "Poz. 1 • +6 Obrona • +30 HP (Sklep — podstawowy)",
    shopPrice: 200,
    sellPrice: 50,
    craftCost: null,
    def: 6,
    hp: 30,
  },
  {
    id: "helm_traveler",
    name: "Kaptur Podróżnika",
    cat: "armor",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 1,
    icon: "gear-helmet.webp",
    slot: 0,
    desc: "Poz. 1 • +4 Obrona • +18 HP (Sklep — podstawowy)",
    shopPrice: 150,
    sellPrice: 38,
    craftCost: null,
    def: 4,
    hp: 18,
  },
  {
    id: "gloves_leather",
    name: "Skórzane Rękawice",
    cat: "armor",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 2,
    icon: "gear-gloves.webp",
    slot: 3,
    desc: "Poz. 2 • +4 Atak • +3 Obrona (Sklep — podstawowy)",
    shopPrice: 160,
    sellPrice: 40,
    craftCost: null,
    atk: 4,
    def: 3,
  },
  {
    id: "boots_trail",
    name: "Sandały Traktu",
    cat: "jewelry",
    rarity: "common",
    obtainableFrom: "shop",
    minLevel: 2,
    icon: "gear-boots.webp",
    slot: 7,
    desc: "Poz. 2 • +12 Szybkość • +3 Obrona (Sklep — podstawowy)",
    shopPrice: 170,
    sellPrice: 42,
    craftCost: null,
    spd: 12,
    def: 3,
  },

  // =========================================================================
  // 5. TIER 2 — CRAFTED GEAR (uncommon, Lv.2-4 — NOT in Shop, requires mats!)
  // =========================================================================
  {
    id: "blade_ember_t2",
    name: "Ostrze Żaru I",
    cat: "weapon",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 2,
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "Poz. 2 • +15 Atak • +2% Kryt (Kuźnia)",
    shopPrice: null,
    sellPrice: 65,
    craftCost: 110,
    craftIngredients: [
      { id: "mat_obsidian", qty: 2 },
      { id: "tusk_beast", qty: 2 },
    ],
    atk: 15,
    crit: 2,
  },
  {
    id: "blade_grove_t2",
    name: "Klinga Gaju I",
    cat: "weapon",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 2,
    icon: "gear-sword.webp",
    slot: 2,
    desc: "Poz. 2 • +13 Atak • +12 Szybkość (Kuźnia)",
    shopPrice: null,
    sellPrice: 65,
    craftCost: 110,
    craftIngredients: [
      { id: "mat_amber", qty: 2 },
      { id: "mat_moss_jelly", qty: 2 },
    ],
    atk: 13,
    spd: 12,
  },
  {
    id: "staff_seal_t2",
    name: "Laska Pieczęci I",
    cat: "weapon",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 2,
    icon: "emblem_crystal.webp",
    slot: 2,
    desc: "Poz. 2 • +14 Atak • +28 KI (Kuźnia)",
    shopPrice: null,
    sellPrice: 65,
    craftCost: 110,
    craftIngredients: [
      { id: "mat_rune", qty: 2 },
      { id: "mat_aether_thread", qty: 2 },
    ],
    atk: 14,
    ki: 28,
  },
  {
    id: "blade_pulse_t2",
    name: "Klinga Impulsowa MK-I",
    cat: "weapon",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 2,
    icon: "emblem_slash.webp",
    slot: 2,
    desc: "Poz. 2 • +14 Atak • +4% Kryt (Kuźnia)",
    shopPrice: null,
    sellPrice: 65,
    craftCost: 110,
    craftIngredients: [
      { id: "mat_coil", qty: 2 },
      { id: "mat_sensor", qty: 2 },
    ],
    atk: 14,
    crit: 4,
  },
  {
    id: "helm_scout_t2",
    name: "Hełm Zwiadowcy",
    cat: "armor",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 2,
    icon: "gear-helmet.webp",
    slot: 0,
    desc: "Poz. 2 • +9 Obrona • +38 HP (Kuźnia)",
    shopPrice: null,
    sellPrice: 55,
    craftCost: 95,
    craftIngredients: [
      { id: "tusk_beast", qty: 2 },
      { id: "crystal_ki", qty: 1 },
    ],
    def: 9,
    hp: 38,
  },
  {
    id: "vest_scale_t2",
    name: "Pancerz Łuskowy",
    cat: "armor",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 3,
    icon: "gear-vest.webp",
    slot: 4,
    desc: "Poz. 3 • +13 Obrona • +62 HP (Kuźnia)",
    shopPrice: null,
    sellPrice: 75,
    craftCost: 135,
    craftIngredients: [
      { id: "tusk_beast", qty: 3 },
      { id: "crystal_ki", qty: 2 },
    ],
    def: 13,
    hp: 62,
  },
  {
    id: "shield_warden_t2",
    name: "Tarcza Strażnika Szlaku",
    cat: "armor",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 3,
    icon: "gear-shield.webp",
    slot: 5,
    desc: "Poz. 3 • +14 Obrona • +45 HP (Kuźnia)",
    shopPrice: null,
    sellPrice: 70,
    craftCost: 130,
    craftIngredients: [
      { id: "tusk_beast", qty: 2 },
      { id: "crystal_ki", qty: 2 },
    ],
    def: 14,
    hp: 45,
  },
  {
    id: "gloves_adept_t2",
    name: "Rękawice Adepta Ki",
    cat: "armor",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 3,
    icon: "gear-gloves.webp",
    slot: 3,
    desc: "Poz. 3 • +8 Atak • +6 Obrona (Kuźnia)",
    shopPrice: null,
    sellPrice: 60,
    craftCost: 115,
    craftIngredients: [
      { id: "tusk_beast", qty: 2 },
      { id: "crystal_ki", qty: 1 },
    ],
    atk: 8,
    def: 6,
  },
  {
    id: "boots_swift_t2",
    name: "Buty Pędu Szlaku",
    cat: "jewelry",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 3,
    icon: "gear-boots.webp",
    slot: 7,
    desc: "Poz. 3 • +22 Szybkość • +6 Obrona (Kuźnia)",
    shopPrice: null,
    sellPrice: 65,
    craftCost: 120,
    craftIngredients: [
      { id: "tusk_beast", qty: 2 },
      { id: "crystal_ki", qty: 2 },
    ],
    spd: 22,
    def: 6,
  },
  {
    id: "amulet_spark_t2",
    name: "Amulet Iskry Ki",
    cat: "jewelry",
    rarity: "uncommon",
    obtainableFrom: "craft",
    minLevel: 4,
    icon: "gear-amulet.webp",
    slot: 1,
    desc: "Poz. 4 • +32 KI • +3% Kryt (Kuźnia)",
    shopPrice: null,
    sellPrice: 70,
    craftCost: 140,
    craftIngredients: [{ id: "crystal_ki", qty: 3 }],
    ki: 32,
    crit: 3,
  },

  // =========================================================================
  // 6. TIER 3 — RARE CRAFTED GEAR (Lv.6-9 — NOT in Shop, requires Elite Core!)
  // =========================================================================
  {
    id: "sword_superior",
    name: "Ostrze Superior",
    cat: "weapon",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 6,
    icon: "gear-sword.webp",
    slot: 2,
    desc: "Poz. 6 • +28 Atak • +4% Kryt (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 130,
    craftCost: 340,
    craftIngredients: [
      { id: "crystal_ki", qty: 4 },
      { id: "tusk_beast", qty: 4 },
      { id: "mat_elite_core", qty: 1 },
    ],
    atk: 28,
    crit: 4,
  },
  {
    id: "helm_pyra",
    name: "Hełm Żaru Cytadeli",
    cat: "armor",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 6,
    icon: "gear-helmet.webp",
    slot: 0,
    desc: "Poz. 6 • +16 Obrona • +60 HP (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 120,
    craftCost: 310,
    craftIngredients: [
      { id: "mat_obsidian", qty: 4 },
      { id: "mat_salamander_scale", qty: 3 },
      { id: "mat_elite_core", qty: 1 },
    ],
    def: 16,
    hp: 60,
  },
  {
    id: "vest_guardian",
    name: "Kirys Strażnika Gaju",
    cat: "armor",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 7,
    icon: "gear-vest.webp",
    slot: 4,
    desc: "Poz. 7 • +26 Obrona • +120 HP (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 150,
    craftCost: 390,
    craftIngredients: [
      { id: "crystal_ki", qty: 4 },
      { id: "tusk_beast", qty: 5 },
      { id: "mat_elite_core", qty: 1 },
    ],
    def: 26,
    hp: 120,
  },
  {
    id: "gloves_clan",
    name: "Rękawice Mistrza Ki",
    cat: "armor",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 6,
    icon: "gear-gloves.webp",
    slot: 3,
    desc: "Poz. 6 • +14 Atak • +12 Obrona (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 120,
    craftCost: 320,
    craftIngredients: [
      { id: "crystal_ki", qty: 3 },
      { id: "tusk_beast", qty: 4 },
      { id: "mat_elite_core", qty: 1 },
    ],
    atk: 14,
    def: 12,
  },
  {
    id: "boots_wind",
    name: "Buty Wichru Superior",
    cat: "jewelry",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 7,
    icon: "gear-boots.webp",
    slot: 7,
    desc: "Poz. 7 • +35 Szybkość • +10 Obrona (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 130,
    craftCost: 340,
    craftIngredients: [
      { id: "crystal_ki", qty: 4 },
      { id: "tusk_beast", qty: 4 },
      { id: "mat_elite_core", qty: 1 },
    ],
    spd: 35,
    def: 10,
  },
  {
    id: "amulet_ki",
    name: "Amulet Czystego Ki",
    cat: "jewelry",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 8,
    icon: "gear-amulet.webp",
    slot: 1,
    desc: "Poz. 8 • +65 KI • +5% Kryt (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 140,
    craftCost: 380,
    craftIngredients: [
      { id: "crystal_ki", qty: 6 },
      { id: "mat_elite_core", qty: 1 },
    ],
    ki: 65,
    crit: 5,
  },
  {
    id: "ring_aether",
    name: "Pierścień Eteru",
    cat: "jewelry",
    rarity: "rare",
    obtainableFrom: "craft",
    minLevel: 8,
    icon: "gear-ring.webp",
    slot: 6,
    desc: "Poz. 8 • +18 Atak • +35 KI (Kuźnia — Rzadkie)",
    shopPrice: null,
    sellPrice: 145,
    craftCost: 390,
    craftIngredients: [
      { id: "mat_rune", qty: 4 },
      { id: "crystal_ki", qty: 4 },
      { id: "mat_elite_core", qty: 1 },
    ],
    atk: 18,
    ki: 35,
  },

  // =========================================================================
  // 7. TIER 4 — MASTER EPIC CRAFTED GEAR (Lv.10-14 — Elite Cores + Lab Relic!)
  // =========================================================================
  {
    id: "blade_pyra",
    name: "Obsydianowy Miecz Żaru",
    cat: "weapon",
    rarity: "epic",
    obtainableFrom: "craft",
    minLevel: 10,
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "Poz. 10 • +42 Atak • +5% Kryt (Mistrzowska Kuźnia)",
    shopPrice: null,
    sellPrice: 260,
    craftCost: 780,
    craftIngredients: [
      { id: "mat_ember", qty: 6 },
      { id: "mat_obsidian", qty: 6 },
      { id: "mat_elite_core", qty: 2 },
      { id: "mat_labyrinth_relic", qty: 1 },
    ],
    atk: 42,
    crit: 5,
  },
  {
    id: "staff_aether",
    name: "Kostur Tysiąca Źródeł",
    cat: "weapon",
    rarity: "epic",
    obtainableFrom: "craft",
    minLevel: 10,
    icon: "emblem_crystal.webp",
    slot: 2,
    desc: "Poz. 10 • +30 Atak • +45 KI (Mistrzowska Kuźnia)",
    shopPrice: null,
    sellPrice: 260,
    craftCost: 780,
    craftIngredients: [
      { id: "mat_rune", qty: 6 },
      { id: "mat_lightdust", qty: 6 },
      { id: "mat_elite_core", qty: 2 },
      { id: "mat_labyrinth_relic", qty: 1 },
    ],
    atk: 30,
    ki: 45,
  },
  {
    id: "blade_nexus",
    name: "Klinga Plazmowa MK-IX",
    cat: "weapon",
    rarity: "epic",
    obtainableFrom: "craft",
    minLevel: 10,
    icon: "emblem_slash.webp",
    slot: 2,
    desc: "Poz. 10 • +38 Atak • +8% Kryt (Mistrzowska Kuźnia)",
    shopPrice: null,
    sellPrice: 260,
    craftCost: 780,
    craftIngredients: [
      { id: "mat_plasma", qty: 6 },
      { id: "mat_coil", qty: 6 },
      { id: "mat_elite_core", qty: 2 },
      { id: "mat_labyrinth_relic", qty: 1 },
    ],
    atk: 38,
    crit: 8,
  },
  {
    id: "helm_aether",
    name: "Korona Lodowego Mędrca",
    cat: "armor",
    rarity: "epic",
    obtainableFrom: "craft",
    minLevel: 11,
    icon: "gear-helmet.webp",
    slot: 0,
    desc: "Poz. 11 • +24 Obrona • +75 KI (Mistrzowska Kuźnia)",
    shopPrice: null,
    sellPrice: 240,
    craftCost: 720,
    craftIngredients: [
      { id: "mat_rune", qty: 5 },
      { id: "crystal_ki", qty: 6 },
      { id: "mat_elite_core", qty: 2 },
      { id: "mat_labyrinth_relic", qty: 1 },
    ],
    def: 24,
    ki: 75,
  },
  {
    id: "shield_basalt",
    name: "Tarcza Bazaltowej Grani",
    cat: "armor",
    rarity: "epic",
    obtainableFrom: "craft",
    minLevel: 11,
    icon: "gear-shield.webp",
    slot: 5,
    desc: "Poz. 11 • +32 Obrona • +90 HP (Mistrzowska Kuźnia)",
    shopPrice: null,
    sellPrice: 250,
    craftCost: 750,
    craftIngredients: [
      { id: "mat_obsidian", qty: 6 },
      { id: "crystal_ki", qty: 5 },
      { id: "mat_elite_core", qty: 2 },
      { id: "mat_labyrinth_relic", qty: 1 },
    ],
    def: 32,
    hp: 90,
  },

  // =========================================================================
  // 8. HARD QUEST / LABYRINTH / ENDGAME EXCLUSIVES (NO Shop, NO Smithy!)
  // =========================================================================
  {
    id: "ring_covenant_q",
    name: "Pierścień Przymierza",
    cat: "jewelry",
    rarity: "rare",
    obtainableFrom: "quest",
    minLevel: 3,
    icon: "gear-ring.webp",
    slot: 6,
    desc: "Poz. 3 • +12 Atak • +45 HP • +3% Kryt (Nagroda Ciężkiego Kontraktu I)",
    shopPrice: null,
    sellPrice: 120,
    craftCost: null,
    atk: 12,
    hp: 45,
    crit: 3,
  },
  {
    id: "amulet_guardian_q",
    name: "Amulet Strażnika Podziemi",
    cat: "jewelry",
    rarity: "rare",
    obtainableFrom: "quest",
    minLevel: 5,
    icon: "gear-amulet.webp",
    slot: 1,
    desc: "Poz. 5 • +10 Obrona • +65 HP • +40 KI (Nagroda Labiryntu I)",
    shopPrice: null,
    sellPrice: 160,
    craftCost: null,
    def: 10,
    hp: 65,
    ki: 40,
  },
  {
    id: "vest_champion_q",
    name: "Zbroja Czempiona Superior",
    cat: "armor",
    rarity: "epic",
    obtainableFrom: "quest",
    minLevel: 8,
    icon: "gear-vest.webp",
    slot: 4,
    desc: "Poz. 8 • +34 Obrona • +165 HP • +4% Kryt (Nagroda Ciężkiego Kontraktu II)",
    shopPrice: null,
    sellPrice: 280,
    craftCost: null,
    def: 34,
    hp: 165,
    crit: 4,
  },
  {
    id: "ring_titan",
    name: "Sygnet Tytana",
    cat: "jewelry",
    rarity: "legendary",
    obtainableFrom: "quest",
    minLevel: 12,
    icon: "emblem_shield.webp",
    slot: 6,
    desc: "Poz. 12 • +140 HP • +22 Obrona (Legendarna nagroda Ciężkiego Kontraktu III / Krypty)",
    shopPrice: null,
    sellPrice: 400,
    craftCost: null,
    hp: 140,
    def: 22,
  },
  {
    id: "weapon_superior_legend",
    name: "Reliktowe Ostrze Superiora",
    cat: "weapon",
    rarity: "legendary",
    obtainableFrom: "quest",
    minLevel: 15,
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "Poz. 15 • +56 Atak • +10% Kryt • +40 KI (Legendarna nagroda finału Dziedzictwa)",
    shopPrice: null,
    sellPrice: 500,
    craftCost: null,
    atk: 56,
    crit: 10,
    ki: 40,
  },
] as const;

export const ANDROID_ITEM_CATALOG: readonly AndroidItemDef[] = [
  ...ANDROID_BASE_ITEM_CATALOG,
  ...buildExtendedV2Items(new Set(ANDROID_BASE_ITEM_CATALOG.map((i) => i.id))),
];

export const ANDROID_ITEM_MAP = new Map<string, AndroidItemDef>(
  ANDROID_ITEM_CATALOG.map((item) => [item.id, item]),
);

export const STAT_KEYS = ["hp", "ki", "atk", "def", "spd", "crit"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const BLESSING_KINDS = ["march", "might", "focus"] as const;
export type BlessingKind = (typeof BLESSING_KINDS)[number];
export type ActiveBlessing = { kind: BlessingKind; expiresAt: number };

export type ItemStack = { id: string; qty: number };

export type AndroidLootDrop = WorldPoint & {
  token: string;
  land: AndroidLand;
  room?: string | undefined;
  gold: number;
  items: ItemStack[];
  expiresAt: number;
};
type StoredLoot = AndroidLootDrop & { claimed: boolean };
type SavedPosition = WorldPoint & { layout: typeof ANDROID_POSITION_LAYOUT; land: AndroidLand };

export type ActiveQuestProgress = {
  stage: number;
  progress: Record<string, number>;
};

export type AndroidProgressState = {
  visitedLands: AndroidLand[];
  craftedCount: number;
  arenaCount: number;
  trainingCount: number;
  shopCount: number;
  monsterKills: number;
  eliteKills: number;
  bossKills: number;
  gatherCount: number;
  lastGatherAt: number;
  gatheredNodes: Record<string, number>;
  discoveredWaystones: string[];
  openedTreasures: string[];
  clearedLabyrinths: string[];
  lastKillAt: number;
  recentKillTimes: number[];
  recentDefeats: Record<string, number>;
  animalsHunted: number;
  defeatedBosses: Record<string, number>;
  claimedEvents: Record<string, number>;
  dojoTrials: string[];
  discoveredIslands: string[];
  speciesKills: Record<string, number>;
};

export type AndroidHeroState = {
  version: number;
  position: SavedPosition | null;
  positionEpoch: number;
  pendingLoot: StoredLoot[];
  xp: number;
  bankGold: number;
  hp: number;
  ki: number;
  freeStatPoints: number;
  skillPoints: number;
  bonusStats: Record<StatKey, number>;
  /** Permanent City Training sessions per stat — boosts stats WITHOUT granting XP/levels! */
  training: Record<StatKey, number>;
  lastTrainingAt: number;
  activeBlessing: ActiveBlessing | null;
  unlockedNodes: string[];
  hotbarSlots?: [string, string, string, string];
  equipment: Record<string, string | null>;
  /** Smithy +1..+9 tempering tier per equipment slot ("0".."7"). */
  equipUpgrades: Record<string, number>;
  /** 6-stage Racial Heritage Weapon progression (0..6). */
  heritageStage: number;
  backpack: (ItemStack | null)[];
  bankItems: (ItemStack | null)[];
  completedQuests: Record<string, string>;
  activeQuests: Record<string, ActiveQuestProgress>;
  factions: Record<string, number>;
  lastArenaAt: number;
  lastRestAt: number;
  progress: AndroidProgressState;
};

export const ASSIGNABLE_SKILL_NODES = [
  "A1",
  "B1",
  "C1",
  "A4",
  "B4",
  "C4",
  "A9",
  "B9",
  "C9",
] as const;

export const DEFAULT_HOTBAR_SLOTS: readonly [string, string, string, string] = [
  "A1",
  "B1",
  "C1",
  "A4",
];

export type AndroidComputedStats = {
  maxHp: number;
  maxKi: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  kiRegen: number;
  xpNeeded: number;
  trainingMasteryTitle: string;
  trainingCapPerStat: number;
  dojoTitle?: string;
  activeSetBonuses?: Record<string, number>;
};

export type AndroidCharacterView = {
  id: string;
  accountId: string;
  name: string;
  race: AndroidRace;
  land: AndroidLand;
  level: number;
  gold: number;
  revision: number;
  state: Omit<AndroidHeroState, "pendingLoot">;
  stats: AndroidComputedStats;
  goals?: AndroidGoalProgressView[];
  browserCharacterId: string | null;
  createdAt: string;
  updatedAt: string;
};

export class AndroidEconomyError extends Error {
  constructor(
    readonly code:
      | "INVALID_ACTION"
      | "UNKNOWN_ITEM"
      | "NOT_CRAFTABLE"
      | "INSUFFICIENT_GOLD"
      | "INSUFFICIENT_MATERIALS"
      | "INSUFFICIENT_BANK_GOLD"
      | "BACKPACK_FULL"
      | "BANK_FULL"
      | "EMPTY_SLOT"
      | "NO_STAT_POINTS"
      | "NO_SKILL_POINTS"
      | "NODE_ALREADY_UNLOCKED"
      | "QUEST_ALREADY_COMPLETED"
      | "GOAL_NOT_MET"
      | "TRAINING_CAP_REACHED"
      | "ARENA_COOLDOWN"
      | "FORBIDDEN"
      | "NAME_TAKEN"
      | "CHARACTER_LIMIT"
      | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export const characterNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(16)
  .regex(/^[\p{L}\p{N}_\- ]{3,16}$/u);

/**
 * Rebalanced solo & MMORPG XP curve (Stage 4):
 * Lv. 1->20 total = 46,010 XP (down ~30x from legacy 1.34M wall); Endgame Lv. 20->100 scales smoothly.
 */
export const XP_NEEDED_BY_LEVEL: readonly number[] = [
  180, // 1 -> 2
  300, // 2 -> 3
  450, // 3 -> 4
  620, // 4 -> 5
  820, // 5 -> 6
  1040, // 6 -> 7
  1280, // 7 -> 8
  1540, // 8 -> 9
  1820, // 9 -> 10
  2120, // 10 -> 11
  2440, // 11 -> 12
  2780, // 12 -> 13
  3140, // 13 -> 14
  3520, // 14 -> 15
  3920, // 15 -> 16
  4340, // 16 -> 17
  4780, // 17 -> 18
  5240, // 18 -> 19
  5720, // 19 -> 20
  6200, // 20 -> 21
];

export function xpNeededForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (lv <= XP_NEEDED_BY_LEVEL.length) return XP_NEEDED_BY_LEVEL[lv - 1]!;
  return 6200 + (lv - 20) * 650;
}

/** Max permanent City Training sessions per stat at given hero level. */
export function maxTrainingPerStat(level: number): number {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 3 + (lv - 1) * 2;
}

/** Gold cost for the next City Training session (first 3 sessions per stat are FREE!). */
export function trainingSessionCost(currentSessions: number): number {
  const n = Math.max(0, Math.floor(currentSessions));
  return n < 3 ? 0 : 15 + (n - 2) * 10;
}

export function computeDojoTitle(dojoTrials: readonly string[]): string {
  const core = ["dojo_dodge", "dojo_skill", "dojo_ki"].filter((t) => dojoTrials.includes(t)).length;
  if (core >= 3) return "Mistrz Dojo";
  if (core === 2) return "Adept Dojo";
  if (core === 1) return "Praktyk Dojo";
  return "Uczeń Dojo";
}

export function computeTrainingBonuses(training: Record<StatKey, number>): {
  hp: number;
  ki: number;
  kiRegen: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  masteryTitle: string;
} {
  const minAll = Math.min(
    training.hp,
    training.ki,
    training.atk,
    training.def,
    training.spd,
    training.crit,
  );
  let masteryTitle = "Rekrut";
  let mHp = 0;
  let mAtk = 0;
  let mDef = 0;
  if (minAll >= 15) {
    masteryTitle = "Mistrz Ki";
    mHp = 50;
    mAtk = 8;
    mDef = 6;
  } else if (minAll >= 10) {
    masteryTitle = "Weteran Stolicy";
    mHp = 25;
    mAtk = 4;
    mDef = 4;
  } else if (minAll >= 6) {
    masteryTitle = "Wojownik Miasta";
    mHp = 10;
    mAtk = 2;
    mDef = 2;
  } else if (minAll >= 3) {
    masteryTitle = "Adept Miasta";
  }

  return {
    hp: training.hp * 12 + mHp,
    ki: training.ki * 8,
    kiRegen: Number((training.ki * 0.08).toFixed(2)),
    atk: training.atk * 2 + mAtk,
    def: Math.ceil(training.def * 1.5) + mDef,
    spd: training.spd * 6,
    crit: Number((training.crit * 0.6).toFixed(2)),
    masteryTitle,
  };
}

/** Canonical passive talent bonuses from KIT_NODES (annex 22.10.2026). */
export function computeTalentPassiveBonuses(
  race: AndroidRace,
  unlockedNodes: readonly string[],
): {
  hpPct: number;
  kiPct: number;
  atkPct: number;
  defPct: number;
  spdPct: number;
  critAdd: number;
  kiRegenPct: number;
} {
  const has = (id: string) => unlockedNodes.includes(id);
  let hpPct = 0;
  let kiPct = 0;
  let atkPct = 0;
  let defPct = 0;
  let spdPct = 0;
  let critAdd = 0;
  let kiRegenPct = 0;

  if (race === "planetary") {
    if (has("A2")) spdPct += 6;
    if (has("A6")) critAdd += 5;
    if (has("B2")) kiRegenPct += 15;
    if (has("B3")) defPct += 8;
    if (has("C2")) hpPct += 10;
  } else if (race === "sage") {
    if (has("A6")) critAdd += 8;
    if (has("B2")) defPct += 10;
    if (has("C2")) kiPct += 15;
    if (has("C3")) kiRegenPct += 12;
  } else if (race === "android") {
    if (has("A2")) critAdd += 6;
    if (has("B2")) defPct += 8;
    if (has("C5")) kiPct += 12;
  } else if (race === "legend") {
    if (has("A5")) atkPct += 8;
    if (has("A6")) critAdd += 6;
    if (has("B2")) defPct += 8;
    if (has("B3")) hpPct += 10;
    if (has("C6")) kiRegenPct += 25;
  }
  return { hpPct, kiPct, atkPct, defPct, spdPct, critAdd, kiRegenPct };
}

export function computeAndroidStats(
  race: AndroidRace,
  level: number,
  state: AndroidHeroState,
  nowMs?: number,
): AndroidComputedStats {
  const spec = RACE_BASE[race as RaceId];
  const lvOff = Math.max(0, level - 1);
  const spdLvOff = Math.min(lvOff, 19);

  let eqHp = 0;
  let eqKi = 0;
  let eqAtk = 0;
  let eqDef = 0;
  let eqSpd = 0;
  let eqCrit = 0;
  const equippedIds: string[] = [];
  const upgMap = state.equipUpgrades ?? {};
  for (let s = 0; s < EQUIP_SLOTS; s++) {
    const sk = String(s);
    const itemId = state.equipment[sk];
    const def = itemId ? ANDROID_ITEM_MAP.get(itemId) : undefined;
    if (!def) continue;
    equippedIds.push(def.id);
    const tier = Math.max(0, Math.min(ENHANCE_MAX_LEVEL, Math.floor(upgMap[sk] ?? 0)));
    const mult = 1 + tier * ENHANCE_STAT_BONUS_PER_LEVEL;
    eqHp += Math.round((def.hp ?? 0) * mult);
    eqKi += Math.round((def.ki ?? 0) * mult);
    eqAtk += Math.round((def.atk ?? 0) * mult);
    eqDef += Math.round((def.def ?? 0) * mult);
    eqSpd += Math.round((def.spd ?? 0) * mult);
    eqCrit += Number(((def.crit ?? 0) * mult).toFixed(2));
  }

  // Canonical V2 Equipment Set bonuses (3/5/7 pieces + passive artifact sets)
  const v2Passive = computePassiveEquipmentBonuses(equippedIds);
  const setPct = v2Passive.cappedTotals;

  const tr = computeTrainingBonuses(
    state.training ?? { hp: 0, ki: 0, atk: 0, def: 0, spd: 0, crit: 0 },
  );
  const tal = computeTalentPassiveBonuses(race, state.unlockedNodes ?? ["R"]);
  const blessActive =
    state.activeBlessing && (nowMs === undefined || nowMs < state.activeBlessing.expiresAt)
      ? state.activeBlessing.kind
      : null;

  const rawHp =
    spec.base.hp + spec.perLevel.hp * lvOff + (state.bonusStats.hp || 0) * 25 + tr.hp + eqHp;
  const rawKi =
    spec.base.ki + spec.perLevel.ki * lvOff + (state.bonusStats.ki || 0) * 15 + tr.ki + eqKi;
  const rawAtk =
    spec.base.attack +
    spec.perLevel.attack * lvOff +
    (state.bonusStats.atk || 0) * 5 +
    tr.atk +
    eqAtk;
  const rawDef =
    spec.base.defense +
    spec.perLevel.defense * lvOff +
    (state.bonusStats.def || 0) * 4 +
    tr.def +
    eqDef;
  const rawSpd =
    spec.base.speed * (1 + 0.05 * spdLvOff) + (state.bonusStats.spd || 0) * 15 + tr.spd + eqSpd;
  const rawKiRegen = spec.base.kiRegen + spec.perLevel.kiRegen * lvOff + tr.kiRegen;

  const maxHp = Math.round(rawHp * (1 + (tal.hpPct + setPct.maxHpPercent) / 100));
  const maxKi = Math.round(rawKi * (1 + (tal.kiPct + setPct.maxKiPercent) / 100));
  const attack = Math.round(
    rawAtk * (1 + (tal.atkPct + setPct.atkPercent + (blessActive === "might" ? 10 : 0)) / 100),
  );
  const defense = Math.round(
    rawDef * (1 + (tal.defPct + setPct.defPercent + (blessActive === "might" ? 10 : 0)) / 100),
  );
  const speed = Math.round(
    rawSpd *
      (1 + (tal.spdPct + setPct.moveSpeedPercent + (blessActive === "march" ? 15 : 0)) / 100),
  );
  const critChance = Number(
    Math.min(
      100,
      spec.base.criticalChancePercent +
        spec.perLevel.criticalChancePercent * lvOff +
        (state.bonusStats.crit || 0) * 2 +
        tr.crit +
        tal.critAdd +
        eqCrit,
    ).toFixed(2),
  );
  const kiRegen = Number(
    (
      rawKiRegen *
      (1 + (tal.kiRegenPct + setPct.kiRegenPercent + (blessActive === "focus" ? 25 : 0)) / 100)
    ).toFixed(2),
  );

  return {
    maxHp,
    maxKi,
    attack,
    defense,
    speed,
    critChance,
    kiRegen,
    xpNeeded: xpNeededForLevel(level),
    trainingMasteryTitle: tr.masteryTitle,
    trainingCapPerStat: maxTrainingPerStat(level),
    dojoTitle: computeDojoTitle(state.progress?.dojoTrials ?? []),
    activeSetBonuses: v2Passive.setCounts,
  };
}

export function createInitialAndroidState(
  race: AndroidRace,
  overrides?: Partial<{
    level: number;
    xp: number;
    gold: number;
    unlockedNodes: string[];
    potions: number;
  }>,
): { level: number; gold: number; land: AndroidLand; state: AndroidHeroState } {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(overrides?.level ?? 1)));
  const gold = Math.max(0, Math.min(MAX_GOLD, Math.floor(overrides?.gold ?? 120)));
  const backpack: (ItemStack | null)[] = Array.from({ length: BACKPACK_SIZE }, () => null);
  backpack[0] = { id: "potion_hp_small", qty: Math.max(1, Math.min(99, overrides?.potions ?? 3)) };
  backpack[1] = { id: "potion_ki", qty: 2 };
  backpack[2] = { id: "scroll_tp", qty: 1 };

  const bankItems: (ItemStack | null)[] = Array.from({ length: BANK_SIZE }, () => null);
  const equipment: Record<string, string | null> = {};
  for (let i = 0; i < EQUIP_SLOTS; i++) equipment[String(i)] = null;

  const nodes = Array.from(new Set(["R", ...(overrides?.unlockedNodes ?? [])])).slice(0, 30);

  const state: AndroidHeroState = {
    version: 2,
    position: null,
    positionEpoch: 0,
    pendingLoot: [],
    xp: Math.max(0, Math.min(xpNeededForLevel(level) - 1, Math.floor(overrides?.xp ?? 0))),
    bankGold: 0,
    hp: 1,
    ki: 1,
    freeStatPoints: Math.max(0, (level - 1) * 3 + 5),
    skillPoints: Math.max(0, level - 1 + 1 - Math.max(0, nodes.length - 1)),
    bonusStats: { hp: 0, ki: 0, atk: 0, def: 0, spd: 0, crit: 0 },
    training: { hp: 0, ki: 0, atk: 0, def: 0, spd: 0, crit: 0 },
    lastTrainingAt: 0,
    activeBlessing: null,
    unlockedNodes: nodes,
    hotbarSlots: [...DEFAULT_HOTBAR_SLOTS] as [string, string, string, string],
    equipment,
    equipUpgrades: {},
    heritageStage: 0,
    backpack,
    bankItems,
    completedQuests: {},
    activeQuests: {},
    factions: {},
    lastArenaAt: 0,
    lastRestAt: 0,
    progress: {
      visitedLands: [HOME_LAND_BY_RACE[race]],
      craftedCount: 0,
      arenaCount: 0,
      trainingCount: 0,
      shopCount: 0,
      monsterKills: 0,
      eliteKills: 0,
      bossKills: 0,
      gatherCount: 0,
      lastGatherAt: 0,
      gatheredNodes: {},
      discoveredWaystones: [],
      openedTreasures: [],
      clearedLabyrinths: [],
      lastKillAt: 0,
      recentKillTimes: [],
      recentDefeats: {},
      animalsHunted: 0,
      defeatedBosses: {},
      claimedEvents: {},
      dojoTrials: [],
      discoveredIslands: [],
      speciesKills: {},
    },
  };
  const stats = computeAndroidStats(race, level, state);
  state.hp = stats.maxHp;
  state.ki = stats.maxKi;
  return { level, gold, land: HOME_LAND_BY_RACE[race], state };
}

const itemStackSchema = z
  .object({
    id: z.string().refine((id) => ANDROID_ITEM_MAP.has(id)),
    qty: z.number().int().min(1).max(999),
  })
  .strict();

const worldPointSchema = z.object({ x: z.number().finite(), z: z.number().finite() }).strict();
const savedPositionSchema = worldPointSchema.extend({
  layout: z.literal(ANDROID_POSITION_LAYOUT),
  land: z.enum(ANDROID_LANDS),
});
const storedLootSchema = worldPointSchema.extend({
  token: z.string().uuid(),
  land: z.enum(ANDROID_LANDS),
  room: z.string().min(1).max(64).optional(),
  gold: z.number().int().min(0).max(MAX_GOLD),
  items: z.array(itemStackSchema).max(8),
  expiresAt: z.number().int().positive(),
  claimed: z.boolean(),
});

export function normalizeAndroidState(
  raw: unknown,
  race: AndroidRace,
  level: number,
): AndroidHeroState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bonusRaw = (
    r["bonusStats"] && typeof r["bonusStats"] === "object" ? r["bonusStats"] : {}
  ) as Record<string, unknown>;
  const bonusStats: Record<StatKey, number> = {
    hp: clampInt(bonusRaw["hp"], 0, 500, 0),
    ki: clampInt(bonusRaw["ki"], 0, 500, 0),
    atk: clampInt(bonusRaw["atk"], 0, 500, 0),
    def: clampInt(bonusRaw["def"], 0, 500, 0),
    spd: clampInt(bonusRaw["spd"], 0, 500, 0),
    crit: clampInt(bonusRaw["crit"], 0, 500, 0),
  };

  const trainRaw = (
    r["training"] && typeof r["training"] === "object" ? r["training"] : {}
  ) as Record<string, unknown>;
  const training: Record<StatKey, number> = {
    hp: clampInt(trainRaw["hp"], 0, 300, 0),
    ki: clampInt(trainRaw["ki"], 0, 300, 0),
    atk: clampInt(trainRaw["atk"], 0, 300, 0),
    def: clampInt(trainRaw["def"], 0, 300, 0),
    spd: clampInt(trainRaw["spd"], 0, 300, 0),
    crit: clampInt(trainRaw["crit"], 0, 300, 0),
  };

  let activeBlessing: ActiveBlessing | null = null;
  if (r["activeBlessing"] && typeof r["activeBlessing"] === "object") {
    const ab = r["activeBlessing"] as Record<string, unknown>;
    const kind = ab["kind"];
    const exp = clampInt(ab["expiresAt"], 0, Number.MAX_SAFE_INTEGER, 0);
    if (
      typeof kind === "string" &&
      (BLESSING_KINDS as readonly string[]).includes(kind) &&
      exp > 0
    ) {
      activeBlessing = { kind: kind as BlessingKind, expiresAt: exp };
    }
  }

  const equipment: Record<string, string | null> = {};
  const eqRaw = (
    r["equipment"] && typeof r["equipment"] === "object" ? r["equipment"] : {}
  ) as Record<string, unknown>;
  for (let i = 0; i < EQUIP_SLOTS; i++) {
    const k = String(i);
    const val = eqRaw[k];
    if (typeof val === "string" && ANDROID_ITEM_MAP.has(val)) {
      const def = ANDROID_ITEM_MAP.get(val)!;
      equipment[k] = def.slot === i ? val : null;
    } else {
      equipment[k] = null;
    }
  }

  const equipUpgrades: Record<string, number> = {};
  const upgRaw = (
    r["equipUpgrades"] && typeof r["equipUpgrades"] === "object" ? r["equipUpgrades"] : {}
  ) as Record<string, unknown>;
  for (let i = 0; i < EQUIP_SLOTS; i++) {
    const k = String(i);
    const tier = clampInt(upgRaw[k], 0, ENHANCE_MAX_LEVEL, 0);
    if (tier > 0) equipUpgrades[k] = tier;
  }

  const normalizeSlots = (arr: unknown, len: number): (ItemStack | null)[] => {
    const src = Array.isArray(arr) ? arr : [];
    return Array.from({ length: len }, (_, i) => {
      const entry = src[i];
      if (!entry) return null;
      const parsed = itemStackSchema.safeParse(entry);
      return parsed.success ? parsed.data : null;
    });
  };

  const nodesRaw = Array.isArray(r["unlockedNodes"]) ? r["unlockedNodes"] : ["R"];
  const unlockedNodes = Array.from(
    new Set([
      "R",
      ...nodesRaw.filter((n): n is string => typeof n === "string" && /^[A-Z0-9_-]{1,8}$/.test(n)),
    ]),
  ).slice(0, 40);

  const questsRaw = (
    r["completedQuests"] && typeof r["completedQuests"] === "object" ? r["completedQuests"] : {}
  ) as Record<string, unknown>;
  const completedQuests: Record<string, string> = {};
  for (const [k, v] of Object.entries(questsRaw)) {
    if (k.length <= 80 && typeof v === "string") completedQuests[k] = v.slice(0, 40);
  }

  const activeQuests: Record<string, ActiveQuestProgress> = {};
  const aqRaw = (
    r["activeQuests"] && typeof r["activeQuests"] === "object" ? r["activeQuests"] : {}
  ) as Record<string, unknown>;
  let aqCnt = 0;
  for (const [qid, rec] of Object.entries(aqRaw)) {
    if (aqCnt >= 64 || qid.length > 64 || !rec || typeof rec !== "object") continue;
    const ro = rec as Record<string, unknown>;
    const progObj: Record<string, number> = {};
    if (ro["progress"] && typeof ro["progress"] === "object") {
      for (const [oid, cnt] of Object.entries(ro["progress"] as Record<string, unknown>).slice(
        0,
        16,
      )) {
        if (oid.length <= 64) progObj[oid] = clampInt(cnt, 0, 9999, 0);
      }
    }
    activeQuests[qid] = { stage: clampInt(ro["stage"], 0, 20, 0), progress: progObj };
    aqCnt += 1;
  }

  const factions: Record<string, number> = {};
  const facRaw = (
    r["factions"] && typeof r["factions"] === "object" ? r["factions"] : {}
  ) as Record<string, unknown>;
  for (const [fid, val] of Object.entries(facRaw).slice(0, 24)) {
    if (/^[A-Z0-9_-]{2,16}$/.test(fid)) factions[fid] = clampInt(val, 0, 1000, 0);
  }

  const progRaw = (
    r["progress"] && typeof r["progress"] === "object" ? r["progress"] : {}
  ) as Record<string, unknown>;
  const rawLands = Array.isArray(progRaw["visitedLands"]) ? progRaw["visitedLands"] : [];
  const visitedLands = Array.from(
    new Set<AndroidLand>([
      HOME_LAND_BY_RACE[race],
      ...rawLands.filter(
        (l): l is AndroidLand =>
          typeof l === "string" && (ANDROID_LANDS as readonly string[]).includes(l),
      ),
    ]),
  );

  const normStrList = (rawArr: unknown, cap: number): string[] => {
    if (!Array.isArray(rawArr)) return [];
    const uniq = new Set<string>();
    for (const entry of rawArr) {
      if (typeof entry === "string" && entry.length >= 2 && entry.length <= 64) {
        uniq.add(entry);
        if (uniq.size >= cap) break;
      }
    }
    return [...uniq];
  };

  const normNumMap = (rawMap: unknown, cap: number, maxVal = Number.MAX_SAFE_INTEGER) => {
    const out: Record<string, number> = Object.create(null);
    if (!rawMap || typeof rawMap !== "object") return out;
    let cnt = 0;
    for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
      if (cnt >= cap) break;
      if (/^[a-zA-Z0-9_:-]{1,64}$/.test(k)) {
        const num = clampInt(v, 0, maxVal, 0);
        if (num > 0) {
          out[k] = num;
          cnt += 1;
        }
      }
    }
    return out;
  };

  const gNodesRaw = (
    progRaw["gatheredNodes"] && typeof progRaw["gatheredNodes"] === "object"
      ? progRaw["gatheredNodes"]
      : {}
  ) as Record<string, unknown>;
  const gatheredNodes: Record<string, number> = {};
  let gnCnt = 0;
  let recentGather = 0;
  for (const [k, v] of Object.entries(gNodesRaw)) {
    if (k.length <= 64 && gnCnt < 300) {
      const ts = clampInt(v, 0, Number.MAX_SAFE_INTEGER, 0);
      if (ts > 0) {
        gatheredNodes[k] = ts;
        recentGather = Math.max(recentGather, ts);
        gnCnt += 1;
      }
    }
  }

  const recentRaw = Array.isArray(progRaw["recentKillTimes"]) ? progRaw["recentKillTimes"] : [];
  const recentKillTimes = recentRaw
    .map((x) => clampInt(x, 0, Number.MAX_SAFE_INTEGER, 0))
    .filter((x) => x > 0)
    .slice(-16);

  const recentDefeats: Record<string, number> = Object.create(null);
  const rawDefeats = progRaw["recentDefeats"];
  if (rawDefeats && typeof rawDefeats === "object") {
    for (const [id, ts] of Object.entries(rawDefeats).slice(-2048)) {
      if (
        /^[a-zA-Z0-9_:-]{1,64}$/.test(id) &&
        typeof ts === "number" &&
        Number.isSafeInteger(ts) &&
        ts > 0
      )
        recentDefeats[id] = ts;
    }
  }
  const pendingLoot = Array.isArray(r["pendingLoot"])
    ? r["pendingLoot"].slice(-MAX_PENDING_LOOT).flatMap((entry) => {
        const parsed = storedLootSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const position = savedPositionSchema.safeParse(r["position"]);

  const trainTotal =
    training.hp + training.ki + training.atk + training.def + training.spd + training.crit;

  const rawHotbar = Array.isArray(r["hotbarSlots"]) ? r["hotbarSlots"] : [];
  const hotbarSlots: [string, string, string, string] = [
    DEFAULT_HOTBAR_SLOTS[0],
    DEFAULT_HOTBAR_SLOTS[1],
    DEFAULT_HOTBAR_SLOTS[2],
    DEFAULT_HOTBAR_SLOTS[3],
  ];
  const seenHotbar = new Set<string>();
  for (let i = 0; i < 4; i++) {
    const cand = rawHotbar[i];
    if (
      typeof cand === "string" &&
      (ASSIGNABLE_SKILL_NODES as readonly string[]).includes(cand) &&
      !seenHotbar.has(cand)
    ) {
      hotbarSlots[i] = cand;
      seenHotbar.add(cand);
    }
  }

  const state: AndroidHeroState = {
    version: 2,
    position:
      position.success && walkableAndroidPoint(position.data.land, position.data)
        ? position.data
        : null,
    positionEpoch: clampInt(r["positionEpoch"], 0, Number.MAX_SAFE_INTEGER - 1, 0),
    pendingLoot,
    xp: clampInt(r["xp"], 0, 10_000_000, 0),
    bankGold: clampInt(r["bankGold"], 0, MAX_GOLD, 0),
    hp: clampInt(r["hp"], 1, 1_000_000, 100),
    ki: clampInt(r["ki"], 0, 1_000_000, 50),
    freeStatPoints: clampInt(r["freeStatPoints"], 0, 2000, 0),
    skillPoints: clampInt(r["skillPoints"], 0, 200, 0),
    bonusStats,
    training,
    lastTrainingAt: clampInt(r["lastTrainingAt"], 0, Number.MAX_SAFE_INTEGER, 0),
    activeBlessing,
    unlockedNodes,
    hotbarSlots,
    equipment,
    equipUpgrades,
    heritageStage: clampInt(r["heritageStage"], 0, 6, 0),
    backpack: normalizeSlots(r["backpack"], BACKPACK_SIZE),
    bankItems: normalizeSlots(r["bankItems"], BANK_SIZE),
    completedQuests,
    activeQuests,
    factions,
    lastArenaAt: clampInt(r["lastArenaAt"], 0, Number.MAX_SAFE_INTEGER, 0),
    lastRestAt: clampInt(r["lastRestAt"], 0, Number.MAX_SAFE_INTEGER, 0),
    progress: {
      visitedLands,
      craftedCount: clampInt(progRaw["craftedCount"], 0, 1_000_000, 0),
      arenaCount: clampInt(progRaw["arenaCount"], 0, 1_000_000, 0),
      trainingCount: Math.max(trainTotal, clampInt(progRaw["trainingCount"], 0, 1_000_000, 0)),
      shopCount: clampInt(progRaw["shopCount"], 0, 1_000_000, 0),
      monsterKills: clampInt(progRaw["monsterKills"], 0, 10_000_000, 0),
      eliteKills: clampInt(progRaw["eliteKills"], 0, 1_000_000, 0),
      bossKills: clampInt(progRaw["bossKills"], 0, 1_000_000, 0),
      gatherCount: clampInt(progRaw["gatherCount"], 0, 1_000_000, 0),
      lastGatherAt: Math.max(
        recentGather,
        clampInt(progRaw["lastGatherAt"], 0, Number.MAX_SAFE_INTEGER, 0),
      ),
      gatheredNodes,
      discoveredWaystones: normStrList(progRaw["discoveredWaystones"], 40),
      openedTreasures: normStrList(progRaw["openedTreasures"], 200),
      clearedLabyrinths: normStrList(progRaw["clearedLabyrinths"], 40),
      lastKillAt: clampInt(progRaw["lastKillAt"], 0, Number.MAX_SAFE_INTEGER, 0),
      recentKillTimes,
      recentDefeats,
      animalsHunted: clampInt(progRaw["animalsHunted"], 0, 10_000_000, 0),
      defeatedBosses: normNumMap(progRaw["defeatedBosses"], 32),
      claimedEvents: normNumMap(progRaw["claimedEvents"], 64),
      dojoTrials: normStrList(progRaw["dojoTrials"], 32),
      discoveredIslands: normStrList(progRaw["discoveredIslands"], 12),
      speciesKills: normNumMap(progRaw["speciesKills"], 128, 1_000_000),
    },
  };

  const stats = computeAndroidStats(race, level, state);
  state.hp = Math.max(1, Math.min(stats.maxHp, state.hp));
  state.ki = Math.max(0, Math.min(stats.maxKi, state.ki));
  return state;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function addItemToSlots(slots: (ItemStack | null)[], itemId: string, qty: number): boolean {
  for (const s of slots) {
    if (s && s.id === itemId && s.qty + qty <= 999) {
      s.qty += qty;
      return true;
    }
  }
  const emptyIdx = slots.findIndex((s) => s === null);
  if (emptyIdx === -1) return false;
  slots[emptyIdx] = { id: itemId, qty };
  return true;
}

function countItemInSlots(slots: readonly (ItemStack | null)[], itemId: string): number {
  let total = 0;
  for (const s of slots) {
    if (s && s.id === itemId) total += s.qty;
  }
  return total;
}

function consumeItemFromSlots(slots: (ItemStack | null)[], itemId: string, qty: number): boolean {
  if (countItemInSlots(slots, itemId) < qty) return false;
  let rem = qty;
  for (let i = 0; i < slots.length && rem > 0; i++) {
    const s = slots[i];
    if (!s || s.id !== itemId) continue;
    if (s.qty > rem) {
      s.qty -= rem;
      rem = 0;
    } else {
      rem -= s.qty;
      slots[i] = null;
    }
  }
  return rem === 0;
}

function grantXp(
  race: AndroidRace,
  level: number,
  state: AndroidHeroState,
  deltaXp: number,
  nowMs?: number,
): { level: number; leveledUp: boolean } {
  let curLevel = level;
  let leveledUp = false;
  state.xp += Math.max(0, Math.floor(deltaXp));
  while (curLevel < MAX_LEVEL) {
    const need = xpNeededForLevel(curLevel);
    if (state.xp < need) break;
    state.xp -= need;
    curLevel += 1;
    state.freeStatPoints += 3;
    state.skillPoints += 1;
    leveledUp = true;
  }
  if (leveledUp) {
    const stats = computeAndroidStats(race, curLevel, state, nowMs);
    state.hp = stats.maxHp;
    state.ki = stats.maxKi;
  }
  return { level: curLevel, leveledUp };
}

const REGIONAL_TROPHIES: Record<AndroidLand, { low: string; mid: string; high: string }> = {
  pyra: { low: "tusk_beast", mid: "mat_salamander_scale", high: "mat_magma_plate" },
  verdant: { low: "mat_moss_jelly", mid: "mat_wolf_thorn", high: "mat_spider_silk" },
  aether: { low: "mat_aether_thread", mid: "mat_crystal_wing", high: "mat_temple_stone" },
  nexus: { low: "mat_sensor", mid: "mat_armor_plate", high: "mat_energy_core" },
  "island-1": { low: "mat_moss_jelly", mid: "mat_wolf_thorn", high: "mat_spider_silk" },
  "island-2": { low: "mat_aether_thread", mid: "mat_crystal_wing", high: "mat_temple_stone" },
  "island-3": { low: "mat_sensor", mid: "mat_armor_plate", high: "mat_energy_core" },
  "island-4": { low: "mat_wolf_thorn", mid: "mat_spider_silk", high: "mat_magma_plate" },
  "island-5": { low: "mat_crystal_wing", mid: "mat_temple_stone", high: "mat_energy_core" },
  "island-6": { low: "mat_salamander_scale", mid: "mat_magma_plate", high: "mat_elite_core" },
};

export const androidActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shop_buy"), itemId: z.string().min(1).max(60) }).strict(),
  z
    .object({
      type: z.literal("shop_sell"),
      slotIndex: z
        .number()
        .int()
        .min(0)
        .max(BACKPACK_SIZE - 1),
      sellAll: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("craft"), itemId: z.string().min(1).max(60) }).strict(),
  z.object({ type: z.literal("craft_recipe"), recipeId: z.string().min(1).max(80) }).strict(),
  z
    .object({
      type: z.literal("enhance_equip"),
      equipSlot: z
        .number()
        .int()
        .min(0)
        .max(EQUIP_SLOTS - 1),
    })
    .strict(),
  z.object({ type: z.literal("forge_heritage_weapon") }).strict(),
  z
    .object({ type: z.literal("bank_deposit_gold"), amount: z.number().int().min(1).max(MAX_GOLD) })
    .strict(),
  z
    .object({
      type: z.literal("bank_withdraw_gold"),
      amount: z.number().int().min(1).max(MAX_GOLD),
    })
    .strict(),
  z
    .object({
      type: z.literal("bank_deposit_item"),
      backpackIndex: z
        .number()
        .int()
        .min(0)
        .max(BACKPACK_SIZE - 1),
    })
    .strict(),
  z
    .object({
      type: z.literal("bank_withdraw_item"),
      bankIndex: z
        .number()
        .int()
        .min(0)
        .max(BANK_SIZE - 1),
    })
    .strict(),
  z
    .object({
      type: z.literal("use_item"),
      expectedItemId: z.string().min(1).max(60).optional(),
      backpackIndex: z
        .number()
        .int()
        .min(0)
        .max(BACKPACK_SIZE - 1),
    })
    .strict(),
  z
    .object({
      type: z.literal("unequip_item"),
      equipSlot: z
        .number()
        .int()
        .min(0)
        .max(EQUIP_SLOTS - 1),
    })
    .strict(),
  z.object({ type: z.literal("allocate_stat"), stat: z.enum(STAT_KEYS) }).strict(),
  z
    .object({ type: z.literal("unlock_talent"), nodeId: z.string().regex(/^[A-Z0-9_-]{1,8}$/) })
    .strict(),
  z
    .object({
      type: z.literal("set_hotbar"),
      slot: z.number().int().min(0).max(3),
      nodeId: z.enum(ASSIGNABLE_SKILL_NODES),
    })
    .strict(),
  z
    .object({
      type: z.literal("inn_rest"),
      siteId: z.string().min(2).max(64).optional(),
      position: worldPointSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("campfire_rest"),
      siteId: z.string().min(2).max(64).optional(),
      position: worldPointSchema.optional(),
    })
    .strict(),
  z.object({ type: z.literal("arena_train"), stat: z.enum(STAT_KEYS).optional() }).strict(),
  z.object({ type: z.literal("city_train"), stat: z.enum(STAT_KEYS) }).strict(),
  z.object({ type: z.literal("city_blessing"), kind: z.enum(BLESSING_KINDS) }).strict(),
  z
    .object({
      type: z.literal("complete_dojo_trial"),
      trialId: z.enum([
        "dojo_dodge",
        "dojo_skill",
        "dojo_ki",
        "dojo_heritage_1",
        "dojo_heritage_2",
        "dojo_heritage_3",
        "dojo_heritage_4",
        "dojo_heritage_5",
        "dojo_heritage_6",
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("gather_node"),
      position: worldPointSchema.optional(),
      nodeId: z.string().min(2).max(64),
      itemId: z.string().min(1).max(60).optional(),
      land: z.enum(ANDROID_LANDS).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("discover_waystone"),
      waystoneId: z.string().min(2).max(64),
    })
    .strict(),
  z.object({ type: z.literal("quest_complete"), questId: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("quest_accept"), questId: z.string().min(1).max(64) }).strict(),
  z
    .object({
      type: z.literal("quest_sync_progress"),
      questId: z.string().min(1).max(64),
      stage: z.number().int().min(0).max(20),
      progress: z.record(z.string().max(64), z.number().int().min(0).max(999)),
      complete: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("claim_goal"), goalId: z.string().min(1).max(40) }).strict(),
  z
    .object({
      type: z.literal("claim_treasure"),
      position: worldPointSchema.optional(),
      treasureId: z.string().min(2).max(64),
      labyrinthId: z.string().min(2).max(64).optional(),
      minLevel: z.number().int().min(1).max(MAX_LEVEL).optional(),
      gold: z.number().int().min(0).max(600).optional(),
      xp: z.number().int().min(0).max(520).optional(),
      itemId: z.string().min(1).max(60).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("monster_kill"),
      monsterId: z.string().min(2).max(64),
      level: z.number().int().min(1).max(MAX_LEVEL),
      hpCost: z.number().int().min(0).max(5000).optional(),
      isElite: z.boolean().optional(),
      land: z.enum(ANDROID_LANDS).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("pve_defeat"),
      targetId: z.string().min(1).max(64),
      land: z.enum(ANDROID_LANDS),
      drop: worldPointSchema,
      hpCost: z.number().int().min(0).max(5000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("boss_defeat"),
      bossId: z.string().min(2).max(64),
      land: z.enum(ANDROID_LANDS),
      drop: worldPointSchema,
      hpCost: z.number().int().min(0).max(15000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("complete_world_event"),
      eventId: z.string().min(2).max(80),
      land: z.enum(ANDROID_LANDS),
    })
    .strict(),
  z
    .object({
      type: z.literal("pickup_loot"),
      token: z.string().uuid(),
      land: z.enum(ANDROID_LANDS),
      room: z.string().min(1).max(64).optional(),
      position: worldPointSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("save_position"),
      land: z.enum(ANDROID_LANDS),
      layout: z.literal(ANDROID_POSITION_LAYOUT),
      epoch: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      position: worldPointSchema,
    })
    .strict(),
  z.object({ type: z.literal("hero_defeat") }).strict(),
  z.object({ type: z.literal("travel"), land: z.enum(ANDROID_LANDS) }).strict(),
  z
    .object({
      type: z.literal("gm_action"),
      op: z.enum([
        "give_item",
        "set_level",
        "add_gold",
        "add_stat_points",
        "add_skill_points",
        "set_gold",
        "set_stat_points",
        "set_skill_points",
        "add_attribute",
        "set_attribute",
        "reset_attributes",
        "unlock_talents",
        "reset_talents",
        "set_test_hp",
        "full_heal",
      ]),
      itemId: z.string().min(1).max(60).optional(),
      qty: z.number().int().min(1).max(99).optional(),
      stat: z.enum(STAT_KEYS).optional(),
      value: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    })
    .strict(),
]);

export type AndroidAction = z.infer<typeof androidActionSchema>;

export type ActionResult = {
  land: AndroidLand;
  level: number;
  gold: number;
  state: AndroidHeroState;
  notice: string;
  teleportCapital?: boolean;
  lootDrop?: AndroidLootDrop;
};

function monsterLoot(
  land: AndroidLand,
  level: number,
  elite: boolean,
  kills: number,
  actorId?: string,
): ItemStack[] {
  const items: ItemStack[] = [];
  if (elite) {
    items.push({ id: "mat_elite_core", qty: 1 }, { id: "potion_hp", qty: 1 });
  } else {
    const trophies = REGIONAL_TROPHIES[land];
    const trophy = level >= 6 ? trophies.high : level >= 3 ? trophies.mid : trophies.low;
    if (kills % 3 !== 0) items.push({ id: trophy, qty: 1 });
    if (kills % 2 === 0 && trophy !== "tusk_beast") items.push({ id: "tusk_beast", qty: 1 });
    if (kills % 5 === 0) items.push({ id: "crystal_ki", qty: 1 });
    if (kills % 50 === 0) {
      const weakPool = ["weapon_recruit_sword", "armor_traveler_vest", "helm_traveler"];
      items.push({ id: weakPool[(kills / 50) % weakPool.length]!, qty: 1 });
    }
  }
  // Canonical species-specific trophy drops from monsters.json (feeds 265 V2 recipes!)
  if (actorId) {
    const speciesList = androidSpeciesDrops(actorId);
    for (const sp of speciesList) {
      if (items.length >= 4) break;
      if (!ANDROID_ITEM_MAP.has(sp.itemId)) continue;
      if (items.some((x) => x.id === sp.itemId)) continue;
      if (randomInt(1000) < Math.round(sp.chance * 1000)) {
        items.push({ id: sp.itemId, qty: 1 });
      }
    }
  }
  return items;
}

function requireNearWorldPoint(
  land: AndroidLand,
  position: WorldPoint,
  site: WorldPoint,
  room?: string,
): void {
  if (
    !walkableAndroidPoint(land, position, room) ||
    Math.hypot(position.x - site.x, position.z - site.z) > INTERACTION_RADIUS
  )
    throw new AndroidEconomyError("INVALID_ACTION", "Podejdź do miejsca interakcji.");
}

/** Server-authoritative state transition for economy and progression actions. */
export function applyAndroidAction(
  current: {
    race: AndroidRace;
    land: AndroidLand;
    level: number;
    gold: number;
    state: AndroidHeroState;
  },
  rawAction: unknown,
  opts: { isStaff: boolean; nowMs?: number },
): ActionResult {
  const action = androidActionSchema.parse(rawAction);
  const nowMs = opts.nowMs ?? Date.now();
  const state: AndroidHeroState = normalizeAndroidState(
    structuredClone(current.state),
    current.race,
    current.level,
  );
  let { land, level, gold } = current;
  let notice = "";
  let teleportCapital = false;
  let lootDrop: AndroidLootDrop | undefined;
  state.pendingLoot = state.pendingLoot.filter((drop) => drop.expiresAt > nowMs);

  const clampVitals = () => {
    const s = computeAndroidStats(current.race, level, state, nowMs);
    state.hp = Math.max(1, Math.min(s.maxHp, state.hp));
    state.ki = Math.max(0, Math.min(s.maxKi, state.ki));
  };

  switch (action.type) {
    case "shop_buy": {
      const def = ANDROID_ITEM_MAP.get(action.itemId);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.shopPrice === null)
        throw new AndroidEconomyError(
          "INVALID_ACTION",
          "Ten przedmiot nie jest sprzedawany w sklepie — zdobądź go przez crafting lub ciężkie zadania!",
        );
      if (level < def.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wymagany poziom ${def.minLevel}, aby kupić ten przedmiot (masz ${level}).`,
        );
      if (gold < def.shopPrice)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota! Potrzebujesz ${def.shopPrice} zł.`,
        );
      if (!addItemToSlots(state.backpack, def.id, 1))
        throw new AndroidEconomyError(
          "BACKPACK_FULL",
          `Plecak jest pełny (${BACKPACK_SIZE}/${BACKPACK_SIZE})!`,
        );
      gold -= def.shopPrice;
      state.progress.shopCount += 1;
      notice = `Kupiono: ${def.name} (-${def.shopPrice} zł)`;
      break;
    }

    case "shop_sell": {
      const stack = state.backpack[action.slotIndex];
      if (!stack) throw new AndroidEconomyError("EMPTY_SLOT", "Ten slot plecaka jest pusty.");
      const def = ANDROID_ITEM_MAP.get(stack.id);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.sellPrice <= 0)
        throw new AndroidEconomyError("INVALID_ACTION", "Tego przedmiotu nie można sprzedać.");
      const qtyToSell = action.sellAll ? stack.qty : 1;
      const payout = def.sellPrice * qtyToSell;
      if (stack.qty > qtyToSell) stack.qty -= qtyToSell;
      else state.backpack[action.slotIndex] = null;
      gold = Math.min(MAX_GOLD, gold + payout);
      notice =
        qtyToSell > 1
          ? `Sprzedano: ${def.name} ×${qtyToSell} (+${payout} zł)`
          : `Sprzedano: ${def.name} (+${payout} zł)`;
      break;
    }

    case "craft": {
      const def = ANDROID_ITEM_MAP.get(action.itemId);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.craftCost === null)
        throw new AndroidEconomyError("NOT_CRAFTABLE", "Tego przedmiotu nie można wykuć w kuźni.");
      if (level < def.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wymagany poziom ${def.minLevel} do wykuciu: ${def.name} (masz ${level}).`,
        );
      if (gold < def.craftCost)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota na kucie (${def.craftCost} zł)!`,
        );
      const reqs = def.craftIngredients ?? [];
      for (const ing of reqs) {
        const have = countItemInSlots(state.backpack, ing.id);
        if (have < ing.qty) {
          const idef = ANDROID_ITEM_MAP.get(ing.id);
          throw new AndroidEconomyError(
            "INSUFFICIENT_MATERIALS",
            `Brak składnika: ${idef?.name ?? ing.id} (${have}/${ing.qty}).`,
          );
        }
      }
      // Verify backpack room before mutating (if ingredients free a slot, we simulate on a copy)
      const simSlots = state.backpack.map((s) => (s ? { ...s } : null));
      for (const ing of reqs) consumeItemFromSlots(simSlots, ing.id, ing.qty);
      if (!addItemToSlots(simSlots, def.id, 1))
        throw new AndroidEconomyError("BACKPACK_FULL", "Brak miejsca w plecaku!");
      state.backpack = simSlots;
      gold -= def.craftCost;
      state.progress.craftedCount += 1;
      notice = `Wykuto w kuźni: ${def.name} (-${def.craftCost} zł)`;
      break;
    }

    case "craft_recipe": {
      const rec = ANDROID_CRAFT_RECIPE_MAP.get(action.recipeId);
      if (!rec) throw new AndroidEconomyError("NOT_CRAFTABLE", "Nieznana receptura rzemieślnicza.");
      const outDef = ANDROID_ITEM_MAP.get(rec.resultItemId);
      if (!outDef) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot wynikowy.");
      if (level < rec.requiredLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wymagany poziom ${rec.requiredLevel} do receptury: ${rec.name} (masz ${level}).`,
        );
      if (gold < rec.cost)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota na wytworzenie (${rec.cost} zł)!`,
        );
      for (const ing of rec.ingredients) {
        const have = countItemInSlots(state.backpack, ing.id);
        if (have < ing.qty) {
          const idef = ANDROID_ITEM_MAP.get(ing.id);
          throw new AndroidEconomyError(
            "INSUFFICIENT_MATERIALS",
            `Brak składnika: ${idef?.name ?? ing.id} (${have}/${ing.qty}).`,
          );
        }
      }
      const simSlots = state.backpack.map((s) => (s ? { ...s } : null));
      for (const ing of rec.ingredients) consumeItemFromSlots(simSlots, ing.id, ing.qty);
      if (!addItemToSlots(simSlots, outDef.id, rec.resultCount))
        throw new AndroidEconomyError("BACKPACK_FULL", "Brak miejsca w plecaku!");
      state.backpack = simSlots;
      gold -= rec.cost;
      state.progress.craftedCount += 1;
      const qtyTxt = rec.resultCount > 1 ? ` ×${rec.resultCount}` : "";
      notice = `Wytworzono: ${outDef.name}${qtyTxt} (-${rec.cost} zł)`;
      break;
    }

    case "enhance_equip": {
      const slotKey = String(action.equipSlot);
      const eqId = state.equipment[slotKey];
      if (!eqId)
        throw new AndroidEconomyError(
          "EMPTY_SLOT",
          "Załóż przedmiot w tym slocie, aby go ulepszyć u Kowala.",
        );
      const eqDef = ANDROID_ITEM_MAP.get(eqId);
      if (!eqDef) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      const curTier = Math.max(0, Math.min(ENHANCE_MAX_LEVEL, state.equipUpgrades[slotKey] ?? 0));
      if (curTier >= ENHANCE_MAX_LEVEL)
        throw new AndroidEconomyError(
          "TRAINING_CAP_REACHED",
          `Ten slot osiągnął już maksymalne ulepszenie +${ENHANCE_MAX_LEVEL}!`,
        );
      const spec = enhanceCostForNextTier(curTier);
      if (gold < spec.gold)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota na ulepszenie +${spec.nextTier} (${spec.gold} zł)!`,
        );
      for (const ing of spec.ingredients) {
        const have = countItemInSlots(state.backpack, ing.id);
        if (have < ing.qty) {
          const idef = ANDROID_ITEM_MAP.get(ing.id);
          throw new AndroidEconomyError(
            "INSUFFICIENT_MATERIALS",
            `Brak składnika do +${spec.nextTier}: ${idef?.name ?? ing.id} (${have}/${ing.qty}).`,
          );
        }
      }
      for (const ing of spec.ingredients) consumeItemFromSlots(state.backpack, ing.id, ing.qty);
      gold -= spec.gold;
      state.equipUpgrades[slotKey] = spec.nextTier;
      state.progress.craftedCount += 1;
      clampVitals();
      notice = `✦ Ulepszono ${eqDef.name} do +${spec.nextTier} (+${Math.round(spec.nextTier * ENHANCE_STAT_BONUS_PER_LEVEL * 100)}% statystyk slotu)!`;
      break;
    }

    case "forge_heritage_weapon": {
      const nextStage = state.heritageStage + 1;
      if (nextStage > 6)
        throw new AndroidEconomyError(
          "TRAINING_CAP_REACHED",
          "Twoja Broń Dziedzictwa osiągnęła już maksymalny Etap VI!",
        );
      const spec = HERITAGE_WEAPON_STAGES.find(
        (h) => h.race === current.race && h.stage === nextStage,
      );
      if (!spec) throw new AndroidEconomyError("NOT_CRAFTABLE", "Brak etapu Broni Dziedzictwa.");
      if (level < spec.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Etap ${nextStage}/6 Broni Dziedzictwa wymaga poziomu ${spec.minLevel} (masz ${level}).`,
        );
      if (gold < spec.goldCost)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Potrzebujesz ${spec.goldCost} zł na wykucie Etapu ${nextStage}/6.`,
        );
      for (const ing of spec.ingredients) {
        const have = countItemInSlots(state.backpack, ing.id);
        if (have < ing.qty) {
          const idef = ANDROID_ITEM_MAP.get(ing.id);
          throw new AndroidEconomyError(
            "INSUFFICIENT_MATERIALS",
            `Brak składnika: ${idef?.name ?? ing.id} (${have}/${ing.qty}).`,
          );
        }
      }
      const simSlots = state.backpack.map((s) => (s ? { ...s } : null));
      for (const ing of spec.ingredients) consumeItemFromSlots(simSlots, ing.id, ing.qty);
      // Remove previous heritage stage if carried/equipped and place new stage directly in weapon slot or backpack
      const prevSpec =
        state.heritageStage > 0
          ? HERITAGE_WEAPON_STAGES.find(
              (h) => h.race === current.race && h.stage === state.heritageStage,
            )
          : undefined;
      if (prevSpec) {
        consumeItemFromSlots(simSlots, prevSpec.id, 1);
      }
      const currentWep = state.equipment["2"];
      if (!currentWep || (prevSpec && currentWep === prevSpec.id)) {
        state.equipment["2"] = spec.id;
      } else if (!addItemToSlots(simSlots, spec.id, 1)) {
        throw new AndroidEconomyError(
          "BACKPACK_FULL",
          "Brak miejsca w plecaku na Broń Dziedzictwa!",
        );
      }
      state.backpack = simSlots;
      gold -= spec.goldCost;
      state.heritageStage = nextStage;
      state.progress.craftedCount += 1;
      clampVitals();
      notice = `★ Wykuto Broń Dziedzictwa Etap ${nextStage}/6: ${spec.name}!`;
      break;
    }

    case "bank_deposit_gold": {
      if (gold < action.amount)
        throw new AndroidEconomyError("INSUFFICIENT_GOLD", "Nie masz tyle złota w sakwie.");
      gold -= action.amount;
      state.bankGold = Math.min(MAX_GOLD, state.bankGold + action.amount);
      notice = `Wpłacono ${action.amount} zł do Skarbca Banku.`;
      break;
    }

    case "bank_withdraw_gold": {
      if (state.bankGold < action.amount)
        throw new AndroidEconomyError("INSUFFICIENT_BANK_GOLD", "Za mało złota w Banku.");
      state.bankGold -= action.amount;
      gold = Math.min(MAX_GOLD, gold + action.amount);
      notice = `Wypłacono ${action.amount} zł z Banku.`;
      break;
    }

    case "bank_deposit_item": {
      const stack = state.backpack[action.backpackIndex];
      if (!stack) throw new AndroidEconomyError("EMPTY_SLOT", "Ten slot plecaka jest pusty.");
      if (!addItemToSlots(state.bankItems, stack.id, stack.qty))
        throw new AndroidEconomyError("BANK_FULL", "Skarbiec Banku jest pełny!");
      state.backpack[action.backpackIndex] = null;
      const def = ANDROID_ITEM_MAP.get(stack.id);
      notice = `Zdeponowano w Skarbcu: ${def?.name ?? stack.id}`;
      break;
    }

    case "bank_withdraw_item": {
      const stack = state.bankItems[action.bankIndex];
      if (!stack) throw new AndroidEconomyError("EMPTY_SLOT", "Ten slot banku jest pusty.");
      if (!addItemToSlots(state.backpack, stack.id, stack.qty))
        throw new AndroidEconomyError("BACKPACK_FULL", "Plecak jest pełny!");
      state.bankItems[action.bankIndex] = null;
      const def = ANDROID_ITEM_MAP.get(stack.id);
      notice = `Odebrano z Banku: ${def?.name ?? stack.id}`;
      break;
    }

    case "use_item": {
      const stack = state.backpack[action.backpackIndex];
      if (!stack) throw new AndroidEconomyError("EMPTY_SLOT", "Pusty slot plecaka.");
      if (action.expectedItemId && action.expectedItemId !== stack.id)
        throw new AndroidEconomyError("INVALID_ACTION", "Zawartość slotu uległa zmianie.");
      const def = ANDROID_ITEM_MAP.get(stack.id);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.cat === "material")
        throw new AndroidEconomyError(
          "INVALID_ACTION",
          `${def.name} to surowiec rzemieślniczy — użyj go w Kuźni lub sprzedaj w Sklepie.`,
        );
      if (def.slot >= 0 && def.slot < EQUIP_SLOTS) {
        if (level < def.minLevel)
          throw new AndroidEconomyError(
            "GOAL_NOT_MET",
            `Wymagany poziom ${def.minLevel}, aby założyć: ${def.name} (masz ${level}).`,
          );
        const slotKey = String(def.slot);
        const oldEq = state.equipment[slotKey] ?? null;
        state.equipment[slotKey] = def.id;
        if (stack.qty > 1) {
          stack.qty -= 1;
          if (oldEq && !addItemToSlots(state.backpack, oldEq, 1)) {
            state.equipment[slotKey] = oldEq;
            stack.qty += 1;
            throw new AndroidEconomyError("BACKPACK_FULL", "Brak miejsca na zdjęty przedmiot.");
          }
        } else {
          state.backpack[action.backpackIndex] = oldEq ? { id: oldEq, qty: 1 } : null;
        }
        clampVitals();
        notice = `Założono: ${def.name}`;
      } else {
        const stats = computeAndroidStats(current.race, level, state, nowMs);
        if (def.healHp) state.hp = Math.min(stats.maxHp, state.hp + def.healHp);
        if (def.healKi) state.ki = Math.min(stats.maxKi, state.ki + def.healKi);
        if (def.gold) gold = Math.min(MAX_GOLD, gold + def.gold);
        if (def.id === "scroll_tp") teleportCapital = true;
        if (stack.qty > 1) stack.qty -= 1;
        else state.backpack[action.backpackIndex] = null;
        notice = `Użyto: ${def.name}`;
      }
      break;
    }

    case "unequip_item": {
      const slotKey = String(action.equipSlot);
      const itemId = state.equipment[slotKey];
      if (!itemId) throw new AndroidEconomyError("EMPTY_SLOT", "Ten slot ekwipunku jest pusty.");
      if (!addItemToSlots(state.backpack, itemId, 1))
        throw new AndroidEconomyError("BACKPACK_FULL", "Plecak jest pełny!");
      state.equipment[slotKey] = null;
      clampVitals();
      const def = ANDROID_ITEM_MAP.get(itemId);
      notice = `Zdjęto: ${def?.name ?? itemId}`;
      break;
    }

    case "allocate_stat": {
      if (state.freeStatPoints <= 0)
        throw new AndroidEconomyError("NO_STAT_POINTS", "Brak wolnych punktów statystyk.");
      const before = computeAndroidStats(current.race, level, state, nowMs);
      state.freeStatPoints -= 1;
      state.bonusStats[action.stat] += 1;
      const after = computeAndroidStats(current.race, level, state, nowMs);
      state.hp = Math.min(after.maxHp, state.hp + Math.max(0, after.maxHp - before.maxHp));
      state.ki = Math.min(after.maxKi, state.ki + Math.max(0, after.maxKi - before.maxKi));
      notice = `Zwiększono statystykę: ${action.stat.toUpperCase()}`;
      break;
    }

    case "unlock_talent": {
      if (state.unlockedNodes.includes(action.nodeId))
        throw new AndroidEconomyError("NODE_ALREADY_UNLOCKED", "Ten talent jest już odblokowany.");
      if (state.skillPoints <= 0)
        throw new AndroidEconomyError("NO_SKILL_POINTS", "Brak punktów umiejętności.");
      const raceNodes = KIT_NODES[current.race as RaceId] ?? [];
      const node = raceNodes.find((n) => n.id === action.nodeId);
      if (!node)
        throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany węzeł talentu dla tej rasy.");
      if (level < node.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wymagany poziom ${node.minLevel} dla talentu ${node.name} (masz ${level}).`,
        );
      if (
        node.requires.length > 0 &&
        !node.requires.some((reqId) => state.unlockedNodes.includes(reqId))
      )
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wymaga wcześniejszego talentu: ${node.requires.join(" lub ")}.`,
        );
      if (node.excludes && state.unlockedNodes.includes(node.excludes))
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Ten wybór wyklucza się z odblokowanym talentem ${node.excludes}.`,
        );
      state.skillPoints -= 1;
      state.unlockedNodes.push(action.nodeId);
      const hb =
        state.hotbarSlots ?? ([...DEFAULT_HOTBAR_SLOTS] as [string, string, string, string]);
      if (
        (ASSIGNABLE_SKILL_NODES as readonly string[]).includes(action.nodeId) &&
        !hb.includes(action.nodeId)
      ) {
        const freeIdx = hb.findIndex((nid) => !state.unlockedNodes.includes(nid));
        if (freeIdx >= 0) hb[freeIdx] = action.nodeId;
      }
      state.hotbarSlots = hb;
      clampVitals();
      notice = `Odblokowano talent: ${node.name} [${node.id}]`;
      break;
    }

    case "set_hotbar": {
      if (!state.unlockedNodes.includes(action.nodeId))
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          "Najpierw odblokuj ten talent w drzewku [K].",
        );
      const hb: [string, string, string, string] = state.hotbarSlots
        ? [state.hotbarSlots[0], state.hotbarSlots[1], state.hotbarSlots[2], state.hotbarSlots[3]]
        : [
            DEFAULT_HOTBAR_SLOTS[0],
            DEFAULT_HOTBAR_SLOTS[1],
            DEFAULT_HOTBAR_SLOTS[2],
            DEFAULT_HOTBAR_SLOTS[3],
          ];
      const existingIdx = hb.indexOf(action.nodeId);
      const previous = hb[action.slot]!;
      hb[action.slot] = action.nodeId;
      if (existingIdx >= 0 && existingIdx !== action.slot) hb[existingIdx] = previous;
      state.hotbarSlots = hb;
      notice = `Przypisano [${action.nodeId}] do slotu ${action.slot + 1}.`;
      break;
    }

    case "inn_rest":
    case "campfire_rest": {
      if (action.siteId !== undefined || action.position !== undefined) {
        const node =
          action.siteId && action.type === "campfire_rest"
            ? androidGatherable(land, action.siteId)
            : undefined;
        const site =
          node?.kind === "campfire"
            ? node
            : action.type === "inn_rest" && action.siteId
              ? androidInn(land, action.siteId)
              : undefined;
        if (!site || !action.position)
          throw new AndroidEconomyError("INVALID_ACTION", "Nieznane miejsce odpoczynku.");
        requireNearWorldPoint(land, action.position, site);
      }
      const recent = Math.max(state.lastRestAt, state.progress.lastKillAt);
      if (recent > 0 && nowMs - recent < REST_COOLDOWN_MS) {
        const seconds = Math.ceil((REST_COOLDOWN_MS - (nowMs - recent)) / 1000);
        throw new AndroidEconomyError("ARENA_COOLDOWN", `Możesz odpocząć za ${seconds} s.`);
      }
      const stats = computeAndroidStats(current.race, level, state, nowMs);
      state.hp = stats.maxHp;
      state.ki = stats.maxKi;
      state.lastRestAt = nowMs;
      notice =
        action.type === "inn_rest"
          ? "Wypoczęto w gospodzie! Przywrócono 100% HP i 100% KI."
          : "Odpoczynek przy ognisku! Przywrócono 100% HP i 100% KI.";
      break;
    }

    case "arena_train":
    case "city_train": {
      const stat: StatKey = action.stat ?? "atk";
      const lastT = Math.max(state.lastTrainingAt, state.lastArenaAt);
      if (lastT > 0 && nowMs - lastT < TRAINING_COOLDOWN_MS) {
        const waitS = Math.ceil((TRAINING_COOLDOWN_MS - (nowMs - lastT)) / 1000);
        throw new AndroidEconomyError(
          "ARENA_COOLDOWN",
          `Odpocznij chwilę przed kolejną sesją treningową (${waitS} s).`,
        );
      }
      const cap = maxTrainingPerStat(level);
      const curRank = state.training[stat] ?? 0;
      if (curRank >= cap)
        throw new AndroidEconomyError(
          "TRAINING_CAP_REACHED",
          `Osiągnięto limit treningu ${stat.toUpperCase()} na poziomie ${level} (${curRank}/${cap}). Awansuj poziom, aby trenować dalej!`,
        );
      const cost = trainingSessionCost(curRank);
      if (gold < cost)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota na sesję treningową (${cost} zł).`,
        );
      const before = computeAndroidStats(current.race, level, state, nowMs);
      gold -= cost;
      state.training[stat] = curRank + 1;
      state.lastTrainingAt = nowMs;
      state.lastArenaAt = nowMs;
      state.progress.arenaCount += 1;
      state.progress.trainingCount += 1;
      const after = computeAndroidStats(current.race, level, state, nowMs);
      // Training raises stats WITHOUT granting XP or leveling up!
      state.hp = Math.min(after.maxHp, state.hp + Math.max(0, after.maxHp - before.maxHp));
      state.ki = Math.min(after.maxKi, state.ki + Math.max(0, after.maxKi - before.maxKi));
      const statLabels: Record<StatKey, string> = {
        hp: "+12 HP",
        ki: "+8 KI / +0.08 KI/s",
        atk: "+2 ATK",
        def: "+1-2 DEF",
        spd: "+6 SPD",
        crit: "+0.6% KRYT",
      };
      const costTxt = cost > 0 ? ` (-${cost} zł)` : " (darmowy)";
      notice = `Trening w mieście [${stat.toUpperCase()} ${curRank + 1}/${cap}]: ${statLabels[stat]}${costTxt} — bez wbijania poziomu!`;
      break;
    }

    case "city_blessing": {
      const expiresAt = nowMs + BLESSING_DURATION_MS;
      state.activeBlessing = { kind: action.kind, expiresAt };
      const stats = computeAndroidStats(current.race, level, state, nowMs);
      state.hp = stats.maxHp;
      state.ki = stats.maxKi;
      const bNames: Record<BlessingKind, string> = {
        march: "Błogosławieństwo Marszu (+15% Szybkości ruchu na 15 min)",
        might: "Błogosławieństwo Hartu (+10% Ataku i Obrony na 15 min)",
        focus: "Błogosławieństwo Skupienia (+25% Regeneracji KI na 15 min)",
      };
      notice = `Przyjęto ${bNames[action.kind]} oraz pełne HP/KI!`;
      break;
    }

    case "complete_dojo_trial": {
      const tid = action.trialId;
      const firstTime = !state.progress.dojoTrials.includes(tid);
      if (firstTime) {
        state.progress.dojoTrials.push(tid);
      }
      const dojoTitle = computeDojoTitle(state.progress.dojoTrials);
      const trialLabels: Record<string, string> = {
        dojo_dodge: "Próba I: Krok Poza Strefę",
        dojo_skill: "Próba II: Uderzenie Techniki Ki",
        dojo_ki: "Próba III: Dyscyplina Przepływu Ki",
        dojo_heritage_1: "Próba Dziedzictwa I",
        dojo_heritage_2: "Próba Dziedzictwa II",
        dojo_heritage_3: "Próba Dziedzictwa III",
        dojo_heritage_4: "Próba Dziedzictwa IV",
        dojo_heritage_5: "Próba Dziedzictwa V",
        dojo_heritage_6: "Próba Dziedzictwa VI",
      };
      if (firstTime) {
        gold = Math.min(MAX_GOLD, gold + 35);
        notice = `🥋 Ukończono ${trialLabels[tid] ?? tid}! Ranga Dojo: ${dojoTitle} (+35 zł)`;
      } else {
        notice = `🥋 Powtórzono ${trialLabels[tid] ?? tid} (Ranga Dojo: ${dojoTitle}).`;
      }
      break;
    }

    case "gather_node": {
      const nid = action.nodeId.trim();
      const node = androidGatherable(land, nid);
      if (
        (action.land !== undefined && action.land !== land) ||
        !node ||
        !node.itemId ||
        node.kind === "campfire" ||
        ANDROID_ITEM_MAP.get(node.itemId)?.cat !== "material"
      )
        throw new AndroidEconomyError("INVALID_ACTION", "Nieznane złoże na tym lądzie.");
      if (action.position) requireNearWorldPoint(land, action.position, node);

      const prevNodeTs = state.progress.gatheredNodes[nid] ?? 0;
      if (prevNodeTs > 0 && nowMs - prevNodeTs < GATHER_NODE_COOLDOWN_MS) {
        const waitS = Math.ceil((GATHER_NODE_COOLDOWN_MS - (nowMs - prevNodeTs)) / 1000);
        throw new AndroidEconomyError(
          "ARENA_COOLDOWN",
          `To złoże odnawia się jeszcze przez ${waitS} s.`,
        );
      }
      const lastGather = state.progress.lastGatherAt;
      if (lastGather > 0 && nowMs - lastGather < GATHER_GLOBAL_COOLDOWN_MS)
        throw new AndroidEconomyError("ARENA_COOLDOWN", "Odczekaj chwilę przed następnym zbiorem.");
      const requestedId = node.itemId;
      if (!addItemToSlots(state.backpack, requestedId, 1))
        throw new AndroidEconomyError(
          "BACKPACK_FULL",
          "Plecak jest pełny — zwolnij miejsce przed zbiorem!",
        );
      state.progress.gatheredNodes[nid] = nowMs;
      state.progress.lastGatherAt = nowMs;
      state.progress.gatherCount += 1;
      let bonusNote = "";
      if (state.progress.gatherCount % 2 === 0 && addItemToSlots(state.backpack, "crystal_ki", 1)) {
        bonusNote = " + Kryształ Skupienia Ki";
      }
      const rewardGold = 12;
      const rewardXp = 22;
      gold = Math.min(MAX_GOLD, gold + rewardGold);
      const res = grantXp(current.race, level, state, rewardXp, nowMs);
      level = res.level;
      const matDef = ANDROID_ITEM_MAP.get(requestedId);
      notice = res.leveledUp
        ? `Zebrano: ${matDef?.name ?? requestedId}${bonusNote} (+${rewardXp} PD, +${rewardGold} zł) — AWANS na poziom ${level}!`
        : `Zebrano: ${matDef?.name ?? requestedId}${bonusNote} (+${rewardXp} PD, +${rewardGold} zł)`;
      break;
    }

    case "discover_waystone": {
      const wid = action.waystoneId.trim();
      if (!state.progress.discoveredWaystones.includes(wid)) {
        state.progress.discoveredWaystones.push(wid);
        notice = "Odkryto Kamień Szlaku! Możesz teraz szybko tu wracać z Mapy Świata [M].";
      } else {
        notice = "Ten Kamień Szlaku jest już odblokowany.";
      }
      break;
    }

    case "quest_complete": {
      const qid = action.questId.trim();
      if (state.completedQuests[qid])
        throw new AndroidEconomyError(
          "QUEST_ALREADY_COMPLETED",
          "Nagroda za to zlecenie została już odebrana.",
        );
      state.completedQuests[qid] = new Date(nowMs).toISOString();
      gold = Math.min(MAX_GOLD, gold + QUEST_GOLD_REWARD);
      const res = grantXp(current.race, level, state, QUEST_XP_REWARD, nowMs);
      level = res.level;
      notice = res.leveledUp
        ? `Zlecenie ukończone (+${QUEST_XP_REWARD} PD, +${QUEST_GOLD_REWARD} zł) — AWANS na poziom ${level}!`
        : `Zlecenie ukończone! +${QUEST_XP_REWARD} PD, +${QUEST_GOLD_REWARD} zł.`;
      break;
    }

    case "quest_accept": {
      const qdef = androidPlayableQuest(action.questId);
      if (!qdef) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznane zadanie fabularne.");
      if (qdef.frontierStages && qdef.continent !== land)
        throw new AndroidEconomyError("INVALID_ACTION", "Ta wyprawa należy do innej krainy.");
      if (state.completedQuests[qdef.id] && !qdef.repeatable)
        throw new AndroidEconomyError(
          "QUEST_ALREADY_COMPLETED",
          "To zadanie zostało już ukończone.",
        );
      if (state.activeQuests[qdef.id]) {
        notice = `Zadanie już jest aktywne: ${qdef.title}`;
        break;
      }
      if (level < qdef.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Zadanie „${qdef.title}” wymaga poziomu ${qdef.minLevel} (masz ${level}).`,
        );
      for (const reqId of qdef.prereqs) {
        if (!state.completedQuests[reqId])
          throw new AndroidEconomyError(
            "GOAL_NOT_MET",
            `Najpierw ukończ wymagane zadanie: ${reqId}.`,
          );
      }
      state.activeQuests[qdef.id] = { stage: 0, progress: {} };
      notice = `📜 Przyjęto zadanie: ${qdef.title}`;
      break;
    }

    case "quest_sync_progress": {
      const qdef = androidPlayableQuest(action.questId);
      if (!qdef) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznane zadanie fabularne.");
      if (qdef.frontierStages && qdef.continent !== land)
        throw new AndroidEconomyError("INVALID_ACTION", "Ta wyprawa należy do innej krainy.");
      if (!state.activeQuests[qdef.id]) {
        if (state.completedQuests[qdef.id] && !qdef.repeatable)
          throw new AndroidEconomyError("QUEST_ALREADY_COMPLETED", "To zadanie już ukończono.");
        if (qdef.frontierStages)
          throw new AndroidEconomyError("GOAL_NOT_MET", "Najpierw przyjmij wyprawę u zwiadowcy.");
        if (level < qdef.minLevel)
          throw new AndroidEconomyError("GOAL_NOT_MET", `Wymagany poziom ${qdef.minLevel}.`);
        state.activeQuests[qdef.id] = { stage: 0, progress: {} };
      }
      const cleanProg: Record<string, number> = {};
      for (const [k, v] of Object.entries(action.progress).slice(0, 16)) {
        cleanProg[k] = clampInt(v, 0, 999, 0);
      }
      let stage = clampInt(action.stage, 0, Math.max(0, qdef.stageCount - 1), 0);
      let progress = cleanProg;
      if (qdef.frontierStages) {
        const saved = state.activeQuests[qdef.id]!;
        stage = Math.max(stage, saved.stage);
        progress = {};
        if (action.complete && stage !== qdef.frontierStages.length - 1)
          throw new AndroidEconomyError("GOAL_NOT_MET", "Wyprawa ma dalsze etapy.");
        for (let index = 0; index < qdef.frontierStages.length; index += 1) {
          for (const objective of qdef.frontierStages[index]!) {
            const persisted = saved.progress[objective.id] ?? 0;
            let count = Math.max(persisted, cleanProg[objective.id] ?? 0);
            if (objective.spawnId) count = persisted;
            if (objective.treasureId)
              count = state.progress.openedTreasures.includes(objective.treasureId) ? 1 : 0;
            if ((index < stage || action.complete) && count < objective.count)
              throw new AndroidEconomyError("GOAL_NOT_MET", "Pozostały nieukończone cele wyprawy.");
            if (index <= stage && count > 0)
              progress[objective.id] = Math.min(count, objective.count);
          }
        }
      }
      state.activeQuests[qdef.id] = { stage, progress };
      if (action.complete) {
        const firstTime = !state.completedQuests[qdef.id];
        delete state.activeQuests[qdef.id];
        state.completedQuests[qdef.id] = new Date(nowMs).toISOString();
        if (firstTime || qdef.repeatable) {
          gold = Math.min(MAX_GOLD, gold + qdef.coins);
          const extras: string[] = [];
          if (qdef.itemId && ANDROID_ITEM_MAP.has(qdef.itemId)) {
            const qty = qdef.itemCount ?? 1;
            const idef = ANDROID_ITEM_MAP.get(qdef.itemId)!;
            if (addItemToSlots(state.backpack, idef.id, qty)) {
              extras.push(`+${idef.name}`);
            } else if (addItemToSlots(state.bankItems, idef.id, qty)) {
              extras.push(`+${idef.name} (Bank)`);
            }
          }
          if (qdef.factionId && qdef.factionAmount) {
            state.factions[qdef.factionId] = Math.min(
              1000,
              (state.factions[qdef.factionId] ?? 0) + qdef.factionAmount,
            );
            extras.push(`+${qdef.factionAmount} rep. ${qdef.factionId}`);
          }
          const res = grantXp(current.race, level, state, qdef.xp, nowMs);
          level = res.level;
          const extraTxt = extras.length ? ` • ${extras.join(" • ")}` : "";
          notice = `✓ Ukończono: ${qdef.title} (+${qdef.xp} PD, +${qdef.coins} zł${extraTxt})${res.leveledUp ? ` — AWANS na poziom ${level}!` : ""}`;
        } else {
          notice = `✓ Ukończono: ${qdef.title}`;
        }
      } else {
        notice = `Postęp zadania: ${qdef.title}`;
      }
      break;
    }

    case "claim_goal": {
      const goal = ANDROID_GOALS_MAP.get(action.goalId);
      if (!goal) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany cel rozwoju.");
      const check = evaluateGoalForCharacter(goal, {
        race: current.race,
        land,
        level,
        state,
      });
      if (check.status === "claimed")
        throw new AndroidEconomyError(
          "QUEST_ALREADY_COMPLETED",
          "Ten cel lub rozdział został już ukończony.",
        );
      if (check.status !== "ready")
        throw new AndroidEconomyError("GOAL_NOT_MET", check.progressText);

      state.completedQuests[goal.id] = new Date(nowMs).toISOString();
      gold = Math.min(MAX_GOLD, gold + goal.goldReward);
      if (goal.statPointsReward) state.freeStatPoints += goal.statPointsReward;
      if (goal.skillPointsReward) state.skillPoints += goal.skillPointsReward;
      const extras: string[] = [];
      if (goal.statPointsReward) extras.push(`+${goal.statPointsReward} pkt stat.`);
      if (goal.skillPointsReward) extras.push(`+${goal.skillPointsReward} pkt skilli`);
      if (goal.itemReward && ANDROID_ITEM_MAP.has(goal.itemReward)) {
        const idef = ANDROID_ITEM_MAP.get(goal.itemReward)!;
        if (addItemToSlots(state.backpack, idef.id, 1)) {
          extras.push(`+${idef.name}`);
        } else if (addItemToSlots(state.bankItems, idef.id, 1)) {
          extras.push(`+${idef.name} (wysłano do Banku)`);
        }
      }
      const res = grantXp(current.race, level, state, goal.xpReward, nowMs);
      level = res.level;
      const extraStr = extras.length > 0 ? `, ${extras.join(", ")}` : "";
      notice = res.leveledUp
        ? `${goal.title} — ukończono (+${goal.xpReward} PD, +${goal.goldReward} zł${extraStr}) — AWANS na poziom ${level}!`
        : `${goal.title} — ukończono! +${goal.xpReward} PD, +${goal.goldReward} zł${extraStr}.`;
      break;
    }

    case "claim_treasure": {
      const tid = action.treasureId.trim();
      const treasure = androidTreasure(land, tid);
      if (!treasure || treasure.room !== action.labyrinthId)
        throw new AndroidEconomyError("INVALID_ACTION", "Nieznana skrzynia w tej lokacji.");
      if (action.position) requireNearWorldPoint(land, action.position, treasure, treasure.room);
      if (state.progress.openedTreasures.includes(tid))
        throw new AndroidEconomyError("QUEST_ALREADY_COMPLETED", "Ten skarb został już otwarty.");
      const requiredLevel = Math.max(
        treasure.minLevel,
        treasure.room ? (androidRoom(land, treasure.room)?.minLevel ?? MAX_LEVEL) : 1,
      );
      if (level < requiredLevel)
        throw new AndroidEconomyError("GOAL_NOT_MET", `Skarb wymaga poziomu ${requiredLevel}.`);

      state.progress.openedTreasures.push(tid);
      const { gold: rewardGold, xp: rewardXp } = treasure;
      gold = Math.min(MAX_GOLD, gold + rewardGold);
      let itemNote = "";
      if (treasure.itemId) {
        const def = ANDROID_ITEM_MAP.get(treasure.itemId);
        if (def) {
          if (!addItemToSlots(state.backpack, def.id, 1))
            throw new AndroidEconomyError(
              "BACKPACK_FULL",
              "Zwolnij miejsce w plecaku przed otwarciem skrzyni.",
            );
          itemNote = ` + ${def.name}`;
        }
      }
      if (treasure.room) {
        const prefix = `chest-${treasure.room}-`;
        const labChests = state.progress.openedTreasures.filter((id) =>
          id.startsWith(prefix),
        ).length;
        if (labChests >= 4 && !state.progress.clearedLabyrinths.includes(treasure.room)) {
          state.progress.clearedLabyrinths.push(treasure.room);
          if (
            !addItemToSlots(state.backpack, "mat_labyrinth_relic", 1) &&
            !addItemToSlots(state.bankItems, "mat_labyrinth_relic", 1)
          )
            throw new AndroidEconomyError("BACKPACK_FULL", "Zwolnij miejsce na relikt labiryntu.");
          itemNote += " + Relikt Labiryntu";
        }
      }
      const res = grantXp(current.race, level, state, rewardXp, nowMs);
      level = res.level;
      notice = res.leveledUp
        ? `Otwarto ukryty skarb (+${rewardGold} zł, +${rewardXp} PD${itemNote}) — AWANS na poziom ${level}!`
        : `Otwarto ukryty skarb! +${rewardGold} zł, +${rewardXp} PD${itemNote}.`;
      break;
    }

    case "pve_defeat":
    case "monster_kill": {
      if (action.type === "monster_kill") {
        const minLevel = androidLegacyKillLevel(
          land,
          action.monsterId,
          action.level,
          Boolean(action.isElite),
        );
        if ((action.land !== undefined && land !== action.land) || minLevel === undefined)
          throw new AndroidEconomyError(
            "INVALID_ACTION",
            "Potwór nie występuje tu na podanym poziomie.",
          );
        if (level < minLevel)
          throw new AndroidEconomyError(
            "GOAL_NOT_MET",
            "Wejście do tego labiryntu wymaga wyższego poziomu.",
          );
      }
      const target =
        action.type === "pve_defeat" ? androidTarget(land, action.targetId) : undefined;
      const room = target?.kind === "guardian" ? target.room : undefined;
      const animal = target?.kind === "animal";
      if (action.type === "pve_defeat") {
        if (!target || action.land !== land)
          throw new AndroidEconomyError("INVALID_ACTION", "Nieznany przeciwnik na tym lądzie.");
        if (room && level < (androidRoom(land, room)?.minLevel ?? MAX_LEVEL))
          throw new AndroidEconomyError(
            "GOAL_NOT_MET",
            "Wejście do tego labiryntu wymaga wyższego poziomu.",
          );
        if (
          !walkableAndroidPoint(land, action.drop, room) ||
          (target.kind !== "guardian" &&
            Math.hypot(action.drop.x - target.x, action.drop.z - target.z) > 220)
        )
          throw new AndroidEconomyError("INVALID_ACTION", "Łup musi leżeć w obszarze przeciwnika.");

        const respawnMs = animal
          ? 22_000
          : target.kind === "monster" && target.elite
            ? 45_000
            : target.kind === "guardian"
              ? 45_000
              : 11_000;
        const recentDefeats = state.progress.recentDefeats;
        for (const [id, ts] of Object.entries(recentDefeats)) {
          if (nowMs - ts >= 45_000) delete recentDefeats[id];
        }
        const key = `${land}-${action.targetId}`;
        const last = recentDefeats[key];
        if (last !== undefined && nowMs - last < respawnMs)
          throw new AndroidEconomyError(
            "ARENA_COOLDOWN",
            "Ten przeciwnik jeszcze się nie odrodził.",
          );
        recentDefeats[key] = nowMs;
        if (action.targetId.startsWith("frontier-")) {
          for (const [questId, active] of Object.entries(state.activeQuests)) {
            const quest = androidPlayableQuest(questId);
            const objective = quest?.frontierStages?.[active.stage]?.find(
              (step) => step.spawnId === action.targetId,
            );
            if (objective && quest?.continent === land)
              active.progress[objective.id] = objective.count;
          }
        }
      }

      const recent = state.progress.recentKillTimes.filter(
        (ts) => nowMs - ts >= 0 && nowMs - ts < KILL_WINDOW_MS,
      );
      if (recent.length >= MAX_KILLS_PER_WINDOW)
        throw new AndroidEconomyError("ARENA_COOLDOWN", "Zbyt wiele zabójstw w jednej sekundzie.");
      recent.push(nowMs);
      state.progress.recentKillTimes = recent;
      state.progress.lastKillAt = nowMs;

      const isElite =
        target?.kind === "monster"
          ? target.elite
          : action.type === "monster_kill" && Boolean(action.isElite);
      if (animal) state.progress.animalsHunted += 1;
      else state.progress.monsterKills += 1;
      if (isElite) state.progress.eliteKills += 1;

      const speciesActorId =
        target?.kind === "monster"
          ? target.actorId
          : action.type === "monster_kill"
            ? action.monsterId
            : undefined;
      if (speciesActorId && !animal) {
        state.progress.speciesKills[speciesActorId] =
          (state.progress.speciesKills[speciesActorId] ?? 0) + 1;
      }

      const lvl =
        target && target.kind !== "animal"
          ? target.level
          : action.type === "monster_kill"
            ? action.level
            : 1;
      const eliteMult = isElite ? 3 : 1;
      const baseXp = (18 + lvl * 7) * eliteMult;
      const lvDiff = level - lvl;
      const xpMult = lvDiff >= 5 ? 0.25 : lvDiff >= 3 ? 0.5 : 1.0;
      const rewardXp = animal ? 14 : Math.max(4, Math.round(baseXp * xpMult));
      const rewardGold = animal ? randomInt(6, 15) : (8 + lvl * 4) * eliteMult;
      if (action.hpCost && action.hpCost > 0) state.hp = Math.max(1, state.hp - action.hpCost);
      const dropLand = action.type === "monster_kill" ? (action.land ?? land) : land;
      const items = animal
        ? randomInt(100) < 45
          ? [{ id: "potion_hp_small", qty: 1 }]
          : []
        : monsterLoot(dropLand, lvl, isElite, state.progress.monsterKills, speciesActorId);

      let rewardText: string;
      if (action.type === "pve_defeat") {
        lootDrop = {
          ...action.drop,
          land,
          ...(room ? { room } : {}),
          token: randomUUID(),
          gold: rewardGold,
          items,
          expiresAt: nowMs + LOOT_LIFETIME_MS,
        };
        state.pendingLoot.push({ ...lootDrop, claimed: false });
        if (state.pendingLoot.length > MAX_PENDING_LOOT) state.pendingLoot.shift();
        rewardText = "Podejdź do łupu.";
      } else {
        // Compatibility for the currently published Android client until its OTA is replaced.
        gold = Math.min(MAX_GOLD, gold + rewardGold);
        const received = items.filter((item) => addItemToSlots(state.backpack, item.id, item.qty));
        const names = received.map((item) => ANDROID_ITEM_MAP.get(item.id)?.name ?? item.id);
        rewardText = `+${rewardGold} zł${names.length ? ` • Łup: ${names.join(", ")}` : ""}`;
      }

      const res = grantXp(current.race, level, state, rewardXp, nowMs);
      level = res.level;
      const defeated = animal
        ? "Upolowano zwierzę"
        : isElite
          ? "★ Pokonano Elitę"
          : "Pokonano potwora";
      notice = `${defeated} (+${rewardXp} PD). ${rewardText}${res.leveledUp ? ` Awans na poziom ${level}!` : ""}`;
      break;
    }

    case "boss_defeat": {
      const boss = androidBoss(action.bossId);
      if (!boss || boss.continent !== land || action.land !== land)
        throw new AndroidEconomyError(
          "INVALID_ACTION",
          "Ten Boss nie występuje na tym kontynencie.",
        );
      if (
        !walkableAndroidPoint(land, action.drop) ||
        Math.hypot(action.drop.x - boss.x, action.drop.z - boss.z) > 360
      )
        throw new AndroidEconomyError("INVALID_ACTION", "Łup Bossa musi spaść na jego arenie.");
      const lastBossAt = state.progress.defeatedBosses[boss.id] ?? 0;
      if (lastBossAt > 0 && nowMs - lastBossAt < BOSS_COOLDOWN_MS) {
        const waitS = Math.ceil((BOSS_COOLDOWN_MS - (nowMs - lastBossAt)) / 1000);
        throw new AndroidEconomyError(
          "ARENA_COOLDOWN",
          `${boss.name} odradza się jeszcze przez ${waitS} s.`,
        );
      }
      state.progress.defeatedBosses[boss.id] = nowMs;
      state.progress.bossKills += 1;
      state.progress.eliteKills += 1;
      state.progress.monsterKills += 1;
      state.progress.lastKillAt = nowMs;
      if (action.hpCost && action.hpCost > 0) state.hp = Math.max(1, state.hp - action.hpCost);

      const bossItems: ItemStack[] = [];
      for (const entry of boss.lootTable) {
        if (!ANDROID_ITEM_MAP.has(entry.itemId)) continue;
        if (entry.chancePercent >= 100 || randomInt(100) < entry.chancePercent) {
          const qty =
            entry.maxCount > entry.minCount
              ? randomInt(entry.minCount, entry.maxCount + 1)
              : entry.minCount;
          bossItems.push({ id: entry.itemId, qty: Math.max(1, qty) });
        }
      }
      if (bossItems.length < 6) bossItems.push({ id: "mat_elite_core", qty: 2 });
      const rewardGold = 180 + boss.level * 14;
      lootDrop = {
        ...action.drop,
        land,
        token: randomUUID(),
        gold: rewardGold,
        items: bossItems.slice(0, 8),
        expiresAt: nowMs + LOOT_LIFETIME_MS,
      };
      state.pendingLoot.push({ ...lootDrop, claimed: false });
      if (state.pendingLoot.length > MAX_PENDING_LOOT) state.pendingLoot.shift();

      const res = grantXp(current.race, level, state, boss.xp, nowMs);
      level = res.level;
      notice = `★ POKONANO BOSSA: ${boss.name} (+${boss.xp} PD) — Podejdź po legendarne trofea!${res.leveledUp ? ` AWANS na poziom ${level}!` : ""}`;
      break;
    }

    case "complete_world_event": {
      const ev = androidWorldEvent(action.eventId);
      if (!ev || ev.continent !== land || action.land !== land)
        throw new AndroidEconomyError("INVALID_ACTION", "Nieznane wydarzenie na tym kontynencie.");
      if (level < ev.minLevel)
        throw new AndroidEconomyError(
          "GOAL_NOT_MET",
          `Wydarzenie „${ev.name}” wymaga poziomu ${ev.minLevel}.`,
        );
      const prevTs = state.progress.claimedEvents[ev.id] ?? 0;
      if (ev.repeatability === "once" && prevTs > 0)
        throw new AndroidEconomyError(
          "QUEST_ALREADY_COMPLETED",
          "To jednorazowe wydarzenie świata zostało już ukończone.",
        );
      const cdMs =
        ev.repeatability === "renewable_contract"
          ? WORLD_CONTRACT_COOLDOWN_MS
          : WORLD_EVENT_COOLDOWN_MS;
      if (prevTs > 0 && nowMs - prevTs < cdMs) {
        const waitS = Math.ceil((cdMs - (nowMs - prevTs)) / 1000);
        throw new AndroidEconomyError("ARENA_COOLDOWN", `To wydarzenie odnowi się za ${waitS} s.`);
      }
      state.progress.claimedEvents[ev.id] = nowMs;
      gold = Math.min(MAX_GOLD, gold + ev.coins);
      const extras: string[] = [];
      if (ev.itemId && ANDROID_ITEM_MAP.has(ev.itemId)) {
        const idef = ANDROID_ITEM_MAP.get(ev.itemId)!;
        if (addItemToSlots(state.backpack, idef.id, 1)) {
          extras.push(`+${idef.name}`);
        } else if (addItemToSlots(state.bankItems, idef.id, 1)) {
          extras.push(`+${idef.name} (Bank)`);
        }
      }
      const res = grantXp(current.race, level, state, ev.xp, nowMs);
      level = res.level;
      const extraStr = extras.length ? ` • ${extras.join(", ")}` : "";
      notice = `⚡ Wydarzenie ukończone: ${ev.name} (+${ev.xp} PD, +${ev.coins} zł${extraStr})${res.leveledUp ? ` — AWANS na poziom ${level}!` : ""}`;
      break;
    }

    case "pickup_loot": {
      const drop = state.pendingLoot.find((entry) => entry.token === action.token);
      if (!drop) throw new AndroidEconomyError("NOT_FOUND", "Ten łup wygasł lub został zabrany.");
      if (
        drop.land !== land ||
        action.land !== land ||
        action.room !== drop.room ||
        !walkableAndroidPoint(land, action.position, drop.room) ||
        Math.hypot(action.position.x - drop.x, action.position.z - drop.z) > ANDROID_PICKUP_RADIUS
      )
        throw new AndroidEconomyError("INVALID_ACTION", "Podejdź bliżej łupu.");

      if (drop.claimed) {
        notice = "Łup został już zebrany.";
        break;
      }
      for (const item of drop.items) {
        if (!addItemToSlots(state.backpack, item.id, item.qty))
          throw new AndroidEconomyError(
            "BACKPACK_FULL",
            "Zwolnij miejsce w plecaku i podejdź po łup ponownie.",
          );
      }
      const collectedGold = Math.min(drop.gold, MAX_GOLD - gold);
      gold += collectedGold;
      drop.claimed = true;
      const names = drop.items.map((item) => ANDROID_ITEM_MAP.get(item.id)?.name ?? item.id);
      notice = `Zebrano łup: ${[...(collectedGold ? [`+${collectedGold} zł`] : []), ...names].join(", ") || "limit złota"}.`;
      break;
    }

    case "save_position": {
      if (
        action.land !== land ||
        action.epoch !== state.positionEpoch ||
        !walkableAndroidPoint(land, action.position)
      )
        throw new AndroidEconomyError(
          "INVALID_ACTION",
          "Punkt zapisu jest poza aktualnym terenem.",
        );
      state.position = { ...action.position, layout: action.layout, land };
      break;
    }

    case "hero_defeat": {
      const lostXp = Math.floor(state.xp * 0.1);
      state.xp = Math.max(0, state.xp - lostXp);
      const s = computeAndroidStats(current.race, level, state, nowMs);
      state.hp = Math.max(1, Math.round(s.maxHp * 0.65));
      state.ki = Math.max(0, Math.round(s.maxKi * 0.65));
      teleportCapital = true;
      notice = `Porażka w walce! Tracisz ${lostXp} PD (-10%) i budzisz się w bezpiecznej stolicy.`;
      break;
    }

    case "travel": {
      const isl = androidIsland(action.land);
      let fareNote = "";
      if (isl && land !== action.land) {
        // Canonical sea voyage rule (FABULA-I-EKWIPUNEK.md): first island voyage is FREE, subsequent 10/20/30g.
        const firstIslandVoyage = state.progress.discoveredIslands.length === 0;
        const fare = firstIslandVoyage ? 0 : isl.voyageCost;
        if (fare > 0) {
          if (gold < fare)
            throw new AndroidEconomyError(
              "INSUFFICIENT_GOLD",
              `Rejs na ${isl.name} kosztuje ${fare} zł (powrót do rodzinnego kontynentu jest zawsze darmowy).`,
            );
          gold -= fare;
          fareNote = ` (-${fare} zł rejs)`;
        } else {
          fareNote = " (pierwszy rejs darmowy!)";
        }
        if (!state.progress.discoveredIslands.includes(action.land)) {
          state.progress.discoveredIslands.push(action.land);
        }
      }
      if (land !== action.land) {
        state.position = null;
        state.positionEpoch += 1;
      }
      land = action.land;
      if (!state.progress.visitedLands.includes(land)) {
        state.progress.visitedLands.push(land);
      }
      notice = isl ? `⛵ Rejs morski → ${isl.name}${fareNote}` : `Podróż do kontynentu: ${land}`;
      break;
    }

    case "gm_action": {
      if (!opts.isStaff)
        throw new AndroidEconomyError(
          "FORBIDDEN",
          "Tylko administrator lub GM może użyć panelu GM.",
        );
      switch (action.op) {
        case "give_item": {
          const def = action.itemId ? ANDROID_ITEM_MAP.get(action.itemId) : undefined;
          if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
          const qty = action.qty ?? 1;
          if (!addItemToSlots(state.backpack, def.id, qty))
            throw new AndroidEconomyError("BACKPACK_FULL", "Plecak jest pełny.");
          notice = `GM: Dodano ${def.name} ×${qty}`;
          break;
        }
        case "set_level": {
          level = clampInt(action.value ?? level, 1, MAX_LEVEL, level);
          const stats = computeAndroidStats(current.race, level, state, nowMs);
          state.hp = stats.maxHp;
          state.ki = stats.maxKi;
          notice = `GM: Ustawiono poziom ${level}`;
          break;
        }
        case "add_gold":
        case "set_gold": {
          const value = action.value ?? 0;
          gold = clampInt(action.op === "add_gold" ? gold + value : value, 0, MAX_GOLD, gold);
          notice = `GM: Złoto = ${gold}`;
          break;
        }
        case "add_stat_points":
        case "set_stat_points": {
          const value = action.value ?? 0;
          state.freeStatPoints = clampInt(
            action.op === "add_stat_points" ? state.freeStatPoints + value : value,
            0,
            2000,
            state.freeStatPoints,
          );
          notice = `GM: Punkty statystyk = ${state.freeStatPoints}`;
          break;
        }
        case "add_skill_points":
        case "set_skill_points": {
          const value = action.value ?? 0;
          state.skillPoints = clampInt(
            action.op === "add_skill_points" ? state.skillPoints + value : value,
            0,
            200,
            state.skillPoints,
          );
          notice = `GM: Punkty skilli = ${state.skillPoints}`;
          break;
        }
        case "add_attribute":
        case "set_attribute": {
          if (!action.stat) throw new AndroidEconomyError("INVALID_ACTION", "Wybierz atrybut.");
          const currentValue = state.bonusStats[action.stat];
          const value = action.value ?? 0;
          state.bonusStats[action.stat] = clampInt(
            action.op === "add_attribute" ? currentValue + value : value,
            0,
            500,
            currentValue,
          );
          clampVitals();
          notice = `GM: ${action.stat.toUpperCase()} = ${state.bonusStats[action.stat]} pkt`;
          break;
        }
        case "reset_attributes": {
          for (const stat of STAT_KEYS) state.bonusStats[stat] = 0;
          clampVitals();
          notice = "GM: Wyzerowano punkty atrybutów.";
          break;
        }
        case "unlock_talents":
        case "reset_talents": {
          state.unlockedNodes =
            action.op === "reset_talents"
              ? ["R"]
              : [
                  ...new Set([
                    "R",
                    ...(KIT_NODES[current.race as RaceId] ?? []).map((node) => node.id),
                  ]),
                ];
          if (action.op === "reset_talents") {
            state.hotbarSlots = [...DEFAULT_HOTBAR_SLOTS] as [string, string, string, string];
          }
          clampVitals();
          notice =
            action.op === "reset_talents" ? "GM: Zresetowano talenty." : "GM: Odblokowano talenty.";
          break;
        }
        case "set_test_hp": {
          state.hp = 1;
          state.ki = computeAndroidStats(current.race, level, state, nowMs).maxKi;
          notice = "GM: Ustawiono 1 HP.";
          break;
        }
        case "full_heal": {
          const stats = computeAndroidStats(current.race, level, state, nowMs);
          state.hp = stats.maxHp;
          state.ki = stats.maxKi;
          notice = "GM: Pełne odnowienie HP i KI.";
          break;
        }
      }
      break;
    }
  }

  if (teleportCapital) {
    state.position = null;
    state.positionEpoch += 1;
  }
  return { land, level, gold, state, notice, teleportCapital, ...(lootDrop ? { lootDrop } : {}) };
}

export const adminCharacterPatchSchema = z
  .object({
    name: characterNameSchema.optional(),
    race: z.enum(ANDROID_RACES).optional(),
    land: z.enum(ANDROID_LANDS).optional(),
    level: z.number().int().min(1).max(MAX_LEVEL).optional(),
    gold: z.number().int().min(0).max(MAX_GOLD).optional(),
    xp: z.number().int().min(0).max(10_000_000).optional(),
    bankGold: z.number().int().min(0).max(MAX_GOLD).optional(),
    hp: z.number().int().min(1).max(1_000_000).optional(),
    ki: z.number().int().min(0).max(1_000_000).optional(),
    freeStatPoints: z.number().int().min(0).max(2000).optional(),
    skillPoints: z.number().int().min(0).max(200).optional(),
    bonusStats: z
      .object({
        hp: z.number().int().min(0).max(500).optional(),
        ki: z.number().int().min(0).max(500).optional(),
        atk: z.number().int().min(0).max(500).optional(),
        def: z.number().int().min(0).max(500).optional(),
        spd: z.number().int().min(0).max(500).optional(),
        crit: z.number().int().min(0).max(500).optional(),
      })
      .strict()
      .optional(),
    training: z
      .object({
        hp: z.number().int().min(0).max(300).optional(),
        ki: z.number().int().min(0).max(300).optional(),
        atk: z.number().int().min(0).max(300).optional(),
        def: z.number().int().min(0).max(300).optional(),
        spd: z.number().int().min(0).max(300).optional(),
        crit: z.number().int().min(0).max(300).optional(),
      })
      .strict()
      .optional(),
    unlockedNodes: z
      .array(z.string().regex(/^[A-Z0-9_-]{1,8}$/))
      .max(40)
      .optional(),
    equipment: z.record(z.string(), z.string().nullable()).optional(),
    backpack: z.array(itemStackSchema.nullable()).min(1).max(BACKPACK_SIZE).optional(),
    bankItems: z.array(itemStackSchema.nullable()).min(1).max(BANK_SIZE).optional(),
    completedQuests: z.record(z.string().max(80), z.string().max(40)).optional(),
  })
  .strict();

export type AdminCharacterPatch = z.infer<typeof adminCharacterPatchSchema>;

export function applyAdminCharacterPatch(
  current: {
    name: string;
    race: AndroidRace;
    land: AndroidLand;
    level: number;
    gold: number;
    state: AndroidHeroState;
  },
  rawPatch: unknown,
): {
  name: string;
  race: AndroidRace;
  land: AndroidLand;
  level: number;
  gold: number;
  state: AndroidHeroState;
} {
  const p = adminCharacterPatchSchema.parse(rawPatch);
  const name = p.name ?? current.name;
  const race = p.race ?? current.race;
  const land = p.land ?? current.land;
  const level = p.level ?? current.level;
  const gold = p.gold ?? current.gold;

  const mergedState: AndroidHeroState = normalizeAndroidState(
    structuredClone(current.state),
    race,
    level,
  );
  if (land !== current.land) {
    mergedState.position = null;
    mergedState.positionEpoch += 1;
  }
  if (p.xp !== undefined) mergedState.xp = p.xp;
  if (p.bankGold !== undefined) mergedState.bankGold = p.bankGold;
  if (p.freeStatPoints !== undefined) mergedState.freeStatPoints = p.freeStatPoints;
  if (p.skillPoints !== undefined) mergedState.skillPoints = p.skillPoints;
  if (p.bonusStats) {
    for (const key of STAT_KEYS) {
      if (p.bonusStats[key] !== undefined) mergedState.bonusStats[key] = p.bonusStats[key]!;
    }
  }
  if (p.training) {
    for (const key of STAT_KEYS) {
      if (p.training[key] !== undefined) mergedState.training[key] = p.training[key]!;
    }
  }
  if (p.unlockedNodes !== undefined) {
    mergedState.unlockedNodes = Array.from(new Set(["R", ...p.unlockedNodes]));
  }
  if (p.equipment !== undefined) {
    for (let i = 0; i < EQUIP_SLOTS; i++) {
      const k = String(i);
      if (k in p.equipment) {
        const val = p.equipment[k];
        if (val === undefined || val === null) mergedState.equipment[k] = null;
        else {
          const def = ANDROID_ITEM_MAP.get(val);
          if (!def || def.slot !== i)
            throw new AndroidEconomyError(
              "UNKNOWN_ITEM",
              `Nieprawidłowy przedmiot dla slotu ${i}.`,
            );
          mergedState.equipment[k] = val;
        }
      }
    }
  }
  if (p.backpack !== undefined) {
    mergedState.backpack = Array.from({ length: BACKPACK_SIZE }, (_, i) => p.backpack![i] ?? null);
  }
  if (p.bankItems !== undefined) {
    mergedState.bankItems = Array.from({ length: BANK_SIZE }, (_, i) => p.bankItems![i] ?? null);
  }
  if (p.completedQuests !== undefined) mergedState.completedQuests = p.completedQuests;

  const stats = computeAndroidStats(race, level, mergedState);
  mergedState.hp = Math.max(1, Math.min(stats.maxHp, p.hp ?? mergedState.hp));
  mergedState.ki = Math.max(0, Math.min(stats.maxKi, p.ki ?? mergedState.ki));

  return { name, race, land, level, gold, state: mergedState };
}
