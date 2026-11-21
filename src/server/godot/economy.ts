import { z } from "zod";
import { RACE_BASE } from "../../game/kit/nodes.generated";
import type { RaceId } from "../../game/world/races";
import { ANDROID_GOALS_MAP, evaluateGoalForCharacter, type AndroidGoalProgressView } from "./goals";

export const ANDROID_RACES = ["legend", "planetary", "sage", "android"] as const;
export type AndroidRace = (typeof ANDROID_RACES)[number];

export const ANDROID_LANDS = ["pyra", "verdant", "aether", "nexus"] as const;
export type AndroidLand = (typeof ANDROID_LANDS)[number];

export const HOME_LAND_BY_RACE: Record<AndroidRace, AndroidLand> = {
  legend: "pyra",
  planetary: "verdant",
  sage: "aether",
  android: "nexus",
};

export const BACKPACK_SIZE = 15;
export const BANK_SIZE = 12;
export const EQUIP_SLOTS = 8;
export const MAX_LEVEL = 100;
export const MAX_GOLD = 10_000_000;
export const ARENA_COOLDOWN_MS = 5_000;
export const ARENA_XP_REWARD = 60;
export const QUEST_GOLD_REWARD = 80;
export const QUEST_XP_REWARD = 45;
export const MAX_PLAYER_ANDROID_CHARACTERS = 12;

export type AndroidItemCategory = "weapon" | "armor" | "jewelry" | "consumable";

export type AndroidItemDef = {
  id: string;
  name: string;
  cat: AndroidItemCategory;
  icon: string;
  slot: number; // -1 consumable, 0..7 equip slot
  desc: string;
  shopPrice: number;
  craftCost: number | null;
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

/** Canonical item catalog matching ports/godot-isometric-world/scripts/gm_panel.gd. Prices & bonuses live here on the server. */
export const ANDROID_ITEM_CATALOG: readonly AndroidItemDef[] = [
  {
    id: "sword_superior",
    name: "Ostrze Superior",
    cat: "weapon",
    icon: "gear-sword.webp",
    slot: 2,
    desc: "+28 Atak • +4% Kryt",
    shopPrice: 340,
    craftCost: 200,
    atk: 28,
    crit: 4,
  },
  {
    id: "blade_pyra",
    name: "Obsydianowy Miecz Żaru",
    cat: "weapon",
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "+42 Atak • Ogień Pyry",
    shopPrice: 340,
    craftCost: 200,
    atk: 42,
    crit: 5,
  },
  {
    id: "staff_aether",
    name: "Kostur Tysiąca Źródeł",
    cat: "weapon",
    icon: "emblem_crystal.webp",
    slot: 2,
    desc: "+30 Atak • +45 KI",
    shopPrice: 340,
    craftCost: 200,
    atk: 30,
    ki: 45,
  },
  {
    id: "blade_nexus",
    name: "Klinga Plazmowa MK-IX",
    cat: "weapon",
    icon: "emblem_slash.webp",
    slot: 2,
    desc: "+38 Atak • +8% Kryt",
    shopPrice: 340,
    craftCost: 200,
    atk: 38,
    crit: 8,
  },
  {
    id: "helm_pyra",
    name: "Hełm Żaru Cytadeli",
    cat: "armor",
    icon: "gear-helmet.webp",
    slot: 0,
    desc: "+16 Obrona • +60 HP",
    shopPrice: 340,
    craftCost: 200,
    def: 16,
    hp: 60,
  },
  {
    id: "vest_guardian",
    name: "Kirys Strażnika Gaju",
    cat: "armor",
    icon: "gear-vest.webp",
    slot: 4,
    desc: "+26 Obrona • +120 HP",
    shopPrice: 340,
    craftCost: 200,
    def: 26,
    hp: 120,
  },
  {
    id: "shield_basalt",
    name: "Tarcza Bazaltowej Grani",
    cat: "armor",
    icon: "gear-shield.webp",
    slot: 5,
    desc: "+32 Obrona • +90 HP",
    shopPrice: 340,
    craftCost: 200,
    def: 32,
    hp: 90,
  },
  {
    id: "gloves_clan",
    name: "Rękawice Mistrza Ki",
    cat: "armor",
    icon: "gear-gloves.webp",
    slot: 3,
    desc: "+14 Atak • +12 Obrona",
    shopPrice: 340,
    craftCost: 200,
    atk: 14,
    def: 12,
  },
  {
    id: "boots_wind",
    name: "Buty Wichru Superior",
    cat: "jewelry",
    icon: "gear-boots.webp",
    slot: 7,
    desc: "+35 Szybkość • +10 Obrona",
    shopPrice: 340,
    craftCost: 200,
    spd: 35,
    def: 10,
  },
  {
    id: "amulet_ki",
    name: "Amulet Czystego Ki",
    cat: "jewelry",
    icon: "gear-amulet.webp",
    slot: 1,
    desc: "+65 KI • +5% Kryt",
    shopPrice: 340,
    craftCost: 200,
    ki: 65,
    crit: 5,
  },
  {
    id: "ring_aether",
    name: "Pierścień Eteru",
    cat: "jewelry",
    icon: "gear-ring.webp",
    slot: 6,
    desc: "+18 Atak • +35 KI",
    shopPrice: 340,
    craftCost: 200,
    atk: 18,
    ki: 35,
  },
  {
    id: "ring_titan",
    name: "Sygnet Tytana",
    cat: "jewelry",
    icon: "emblem_shield.webp",
    slot: 6,
    desc: "+140 HP • +22 Obrona",
    shopPrice: 340,
    craftCost: 200,
    hp: 140,
    def: 22,
  },
  {
    id: "potion_hp",
    name: "Wielki Eliksir Życia",
    cat: "consumable",
    icon: "gear-potion.webp",
    slot: -1,
    desc: "Przywraca +150 HP",
    shopPrice: 120,
    craftCost: null,
    healHp: 150,
  },
  {
    id: "potion_ki",
    name: "Eliksir Energii Ki",
    cat: "consumable",
    icon: "emblem_potion.webp",
    slot: -1,
    desc: "Przywraca +80 KI",
    shopPrice: 120,
    craftCost: null,
    healKi: 80,
  },
  {
    id: "scroll_tp",
    name: "Zwój Powrotu do Stolicy",
    cat: "consumable",
    icon: "emblem_scroll.webp",
    slot: -1,
    desc: "Natychmiastowy powrót",
    shopPrice: 120,
    craftCost: null,
  },
  {
    id: "crystal_ki",
    name: "Kryształ Skupienia Ki",
    cat: "consumable",
    icon: "emblem_crystal.webp",
    slot: -1,
    desc: "Surowiec alchemiczny",
    shopPrice: 120,
    craftCost: null,
  },
  {
    id: "tusk_beast",
    name: "Kieł Płomiennego Wilka",
    cat: "consumable",
    icon: "gear-tusk.webp",
    slot: -1,
    desc: "Trofeum rzemieślnicze",
    shopPrice: 120,
    craftCost: null,
  },
  {
    id: "pouch_gold",
    name: "Sakiewka Złota (+500)",
    cat: "consumable",
    icon: "gear-coin.webp",
    slot: -1,
    desc: "Dodaje 500 złota",
    shopPrice: 120,
    craftCost: null,
    gold: 500,
  },
] as const;

export const ANDROID_ITEM_MAP = new Map<string, AndroidItemDef>(
  ANDROID_ITEM_CATALOG.map((item) => [item.id, item]),
);

export const STAT_KEYS = ["hp", "ki", "atk", "def", "spd", "crit"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type ItemStack = { id: string; qty: number };

export type AndroidProgressState = {
  visitedLands: AndroidLand[];
  craftedCount: number;
  arenaCount: number;
  shopCount: number;
  monsterKills: number;
  openedTreasures: string[];
  clearedLabyrinths: string[];
  lastKillAt: number;
};

export type AndroidHeroState = {
  version: 1;
  xp: number;
  bankGold: number;
  hp: number;
  ki: number;
  freeStatPoints: number;
  skillPoints: number;
  bonusStats: Record<StatKey, number>;
  unlockedNodes: string[];
  equipment: Record<string, string | null>;
  backpack: (ItemStack | null)[];
  bankItems: (ItemStack | null)[];
  completedQuests: Record<string, string>;
  lastArenaAt: number;
  progress: AndroidProgressState;
};

export type AndroidComputedStats = {
  maxHp: number;
  maxKi: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  xpNeeded: number;
};

export type AndroidCharacterView = {
  id: string;
  accountId: string;
  ownerNick?: string;
  ownerEmail?: string;
  name: string;
  race: AndroidRace;
  land: AndroidLand;
  level: number;
  gold: number;
  revision: number;
  state: AndroidHeroState;
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
      | "INSUFFICIENT_BANK_GOLD"
      | "BACKPACK_FULL"
      | "BANK_FULL"
      | "EMPTY_SLOT"
      | "NO_STAT_POINTS"
      | "NO_SKILL_POINTS"
      | "NODE_ALREADY_UNLOCKED"
      | "QUEST_ALREADY_COMPLETED"
      | "GOAL_NOT_MET"
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

export function xpNeededForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 200 + (lv - 1) * 160;
}

export function computeAndroidStats(
  race: AndroidRace,
  level: number,
  state: AndroidHeroState,
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
  for (let s = 0; s < EQUIP_SLOTS; s++) {
    const itemId = state.equipment[String(s)];
    const def = itemId ? ANDROID_ITEM_MAP.get(itemId) : undefined;
    if (!def) continue;
    eqHp += def.hp ?? 0;
    eqKi += def.ki ?? 0;
    eqAtk += def.atk ?? 0;
    eqDef += def.def ?? 0;
    eqSpd += def.spd ?? 0;
    eqCrit += def.crit ?? 0;
  }

  const maxHp = Math.round(
    spec.base.hp + spec.perLevel.hp * lvOff + (state.bonusStats.hp || 0) * 25 + eqHp,
  );
  const maxKi = Math.round(
    spec.base.ki + spec.perLevel.ki * lvOff + (state.bonusStats.ki || 0) * 15 + eqKi,
  );
  const attack = Math.round(
    spec.base.attack + spec.perLevel.attack * lvOff + (state.bonusStats.atk || 0) * 5 + eqAtk,
  );
  const defense = Math.round(
    spec.base.defense + spec.perLevel.defense * lvOff + (state.bonusStats.def || 0) * 4 + eqDef,
  );
  const speed = Math.round(
    spec.base.speed * (1 + 0.05 * spdLvOff) + (state.bonusStats.spd || 0) * 15 + eqSpd,
  );
  const critChance = Number(
    (
      spec.base.criticalChancePercent +
      spec.perLevel.criticalChancePercent * lvOff +
      (state.bonusStats.crit || 0) * 2 +
      eqCrit
    ).toFixed(2),
  );

  return {
    maxHp,
    maxKi,
    attack,
    defense,
    speed,
    critChance,
    xpNeeded: xpNeededForLevel(level),
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
  backpack[0] = { id: "potion_hp", qty: Math.max(1, Math.min(99, overrides?.potions ?? 3)) };
  backpack[1] = { id: "potion_ki", qty: 2 };
  backpack[2] = { id: "scroll_tp", qty: 1 };

  const bankItems: (ItemStack | null)[] = Array.from({ length: BANK_SIZE }, () => null);
  const equipment: Record<string, string | null> = {};
  for (let i = 0; i < EQUIP_SLOTS; i++) equipment[String(i)] = null;

  const nodes = Array.from(new Set(["R", ...(overrides?.unlockedNodes ?? [])])).slice(0, 30);

  const state: AndroidHeroState = {
    version: 1,
    xp: Math.max(0, Math.min(xpNeededForLevel(level) - 1, Math.floor(overrides?.xp ?? 0))),
    bankGold: 0,
    hp: 1,
    ki: 1,
    freeStatPoints: Math.max(0, (level - 1) * 3 + 5),
    skillPoints: Math.max(0, level - 1 + 4 - Math.max(0, nodes.length - 1)),
    bonusStats: { hp: 0, ki: 0, atk: 0, def: 0, spd: 0, crit: 0 },
    unlockedNodes: nodes,
    equipment,
    backpack,
    bankItems,
    completedQuests: {},
    lastArenaAt: 0,
    progress: {
      visitedLands: [HOME_LAND_BY_RACE[race]],
      craftedCount: 0,
      arenaCount: 0,
      shopCount: 0,
      monsterKills: 0,
      openedTreasures: [],
      clearedLabyrinths: [],
      lastKillAt: 0,
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

  const state: AndroidHeroState = {
    version: 1,
    xp: clampInt(r["xp"], 0, 10_000_000, 0),
    bankGold: clampInt(r["bankGold"], 0, MAX_GOLD, 0),
    hp: clampInt(r["hp"], 1, 1_000_000, 100),
    ki: clampInt(r["ki"], 0, 1_000_000, 50),
    freeStatPoints: clampInt(r["freeStatPoints"], 0, 2000, 0),
    skillPoints: clampInt(r["skillPoints"], 0, 200, 0),
    bonusStats,
    unlockedNodes,
    equipment,
    backpack: normalizeSlots(r["backpack"], BACKPACK_SIZE),
    bankItems: normalizeSlots(r["bankItems"], BANK_SIZE),
    completedQuests,
    lastArenaAt: clampInt(r["lastArenaAt"], 0, Number.MAX_SAFE_INTEGER, 0),
    progress: {
      visitedLands,
      craftedCount: clampInt(progRaw["craftedCount"], 0, 1_000_000, 0),
      arenaCount: clampInt(progRaw["arenaCount"], 0, 1_000_000, 0),
      shopCount: clampInt(progRaw["shopCount"], 0, 1_000_000, 0),
      monsterKills: clampInt(progRaw["monsterKills"], 0, 10_000_000, 0),
      openedTreasures: normStrList(progRaw["openedTreasures"], 200),
      clearedLabyrinths: normStrList(progRaw["clearedLabyrinths"], 40),
      lastKillAt: clampInt(progRaw["lastKillAt"], 0, Number.MAX_SAFE_INTEGER, 0),
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

function grantXp(
  race: AndroidRace,
  level: number,
  state: AndroidHeroState,
  deltaXp: number,
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
    const stats = computeAndroidStats(race, curLevel, state);
    state.hp = stats.maxHp;
    state.ki = stats.maxKi;
  }
  return { level: curLevel, leveledUp };
}

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
    })
    .strict(),
  z.object({ type: z.literal("craft"), itemId: z.string().min(1).max(60) }).strict(),
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
  z.object({ type: z.literal("inn_rest") }).strict(),
  z.object({ type: z.literal("arena_train") }).strict(),
  z.object({ type: z.literal("quest_complete"), questId: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("claim_goal"), goalId: z.string().min(1).max(40) }).strict(),
  z
    .object({
      type: z.literal("claim_treasure"),
      treasureId: z.string().min(2).max(64),
      labyrinthId: z.string().min(2).max(64).optional(),
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
    })
    .strict(),
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
        "full_heal",
      ]),
      itemId: z.string().min(1).max(60).optional(),
      qty: z.number().int().min(1).max(99).optional(),
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
};

/** Pure, server-authoritative state transition for every economy & progression action. */
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
  const state: AndroidHeroState = structuredClone(current.state);
  let { land, level, gold } = current;
  let notice = "";
  let teleportCapital = false;

  const clampVitals = () => {
    const s = computeAndroidStats(current.race, level, state);
    state.hp = Math.max(1, Math.min(s.maxHp, state.hp));
    state.ki = Math.max(0, Math.min(s.maxKi, state.ki));
  };

  switch (action.type) {
    case "shop_buy": {
      const def = ANDROID_ITEM_MAP.get(action.itemId);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (gold < def.shopPrice)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota! Potrzebujesz ${def.shopPrice} zł.`,
        );
      if (!addItemToSlots(state.backpack, def.id, 1))
        throw new AndroidEconomyError("BACKPACK_FULL", "Plecak jest pełny (15/15)!");
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
      const payout = Math.max(1, Math.floor(def.shopPrice * 0.5));
      if (stack.qty > 1) stack.qty -= 1;
      else state.backpack[action.slotIndex] = null;
      gold = Math.min(MAX_GOLD, gold + payout);
      notice = `Sprzedano: ${def.name} (+${payout} zł)`;
      break;
    }

    case "craft": {
      const def = ANDROID_ITEM_MAP.get(action.itemId);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.craftCost === null)
        throw new AndroidEconomyError("NOT_CRAFTABLE", "Tego przedmiotu nie można wykuć w kuźni.");
      if (gold < def.craftCost)
        throw new AndroidEconomyError(
          "INSUFFICIENT_GOLD",
          `Za mało złota na kucie (${def.craftCost} zł)!`,
        );
      if (!addItemToSlots(state.backpack, def.id, 1))
        throw new AndroidEconomyError("BACKPACK_FULL", "Brak miejsca w plecaku!");
      gold -= def.craftCost;
      state.progress.craftedCount += 1;
      notice = `Wykuto w kuźni: ${def.name} (-${def.craftCost} zł)`;
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
      const emptyBank = state.bankItems.findIndex((b) => b === null);
      if (emptyBank === -1)
        throw new AndroidEconomyError("BANK_FULL", "Skarbiec Banku jest pełny!");
      state.bankItems[emptyBank] = { ...stack };
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
      const def = ANDROID_ITEM_MAP.get(stack.id);
      if (!def) throw new AndroidEconomyError("UNKNOWN_ITEM", "Nieznany przedmiot.");
      if (def.slot >= 0 && def.slot < EQUIP_SLOTS) {
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
        const stats = computeAndroidStats(current.race, level, state);
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
      const before = computeAndroidStats(current.race, level, state);
      state.freeStatPoints -= 1;
      state.bonusStats[action.stat] += 1;
      const after = computeAndroidStats(current.race, level, state);
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
      state.skillPoints -= 1;
      state.unlockedNodes.push(action.nodeId);
      notice = `Odblokowano talent: ${action.nodeId}`;
      break;
    }

    case "inn_rest": {
      const stats = computeAndroidStats(current.race, level, state);
      state.hp = stats.maxHp;
      state.ki = stats.maxKi;
      notice = "Wypoczęto w gospodzie! Przywrócono 100% HP i 100% KI.";
      break;
    }

    case "arena_train": {
      if (nowMs - state.lastArenaAt < ARENA_COOLDOWN_MS)
        throw new AndroidEconomyError(
          "ARENA_COOLDOWN",
          "Odpocznij chwilę przed kolejnym treningiem (5 s).",
        );
      state.lastArenaAt = nowMs;
      state.progress.arenaCount += 1;
      const res = grantXp(current.race, level, state, ARENA_XP_REWARD);
      level = res.level;
      notice = res.leveledUp
        ? `Trening ukończony (+${ARENA_XP_REWARD} PD) — AWANS na poziom ${level}!`
        : `Trening bojowy ukończony! +${ARENA_XP_REWARD} PD.`;
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
      const res = grantXp(current.race, level, state, QUEST_XP_REWARD);
      level = res.level;
      notice = res.leveledUp
        ? `Zlecenie ukończone (+${QUEST_XP_REWARD} PD, +${QUEST_GOLD_REWARD} zł) — AWANS na poziom ${level}!`
        : `Zlecenie ukończone! +${QUEST_XP_REWARD} PD, +${QUEST_GOLD_REWARD} zł.`;
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
      const res = grantXp(current.race, level, state, goal.xpReward);
      level = res.level;
      const extras: string[] = [];
      if (goal.statPointsReward) extras.push(`+${goal.statPointsReward} pkt stat.`);
      if (goal.skillPointsReward) extras.push(`+${goal.skillPointsReward} pkt skilli`);
      const extraStr = extras.length > 0 ? `, ${extras.join(", ")}` : "";
      notice = res.leveledUp
        ? `${goal.title} — ukończono (+${goal.xpReward} PD, +${goal.goldReward} zł${extraStr}) — AWANS na poziom ${level}!`
        : `${goal.title} — ukończono! +${goal.xpReward} PD, +${goal.goldReward} zł${extraStr}.`;
      break;
    }

    case "claim_treasure": {
      const tid = action.treasureId.trim();
      if (state.progress.openedTreasures.includes(tid)) {
        throw new AndroidEconomyError("QUEST_ALREADY_COMPLETED", "Ten skarb został już otwarty.");
      }
      state.progress.openedTreasures.push(tid);
      const rewardGold = clampInt(action.gold ?? 150, 20, 600, 150);
      const rewardXp = clampInt(action.xp ?? 120, 20, 520, 120);
      gold = Math.min(MAX_GOLD, gold + rewardGold);
      let itemNote = "";
      if (action.itemId && ANDROID_ITEM_MAP.has(action.itemId)) {
        const def = ANDROID_ITEM_MAP.get(action.itemId)!;
        if (addItemToSlots(state.backpack, def.id, 1)) {
          itemNote = ` + ${def.name}`;
        }
      }
      if (action.labyrinthId) {
        const prefix = `chest-${action.labyrinthId}-`;
        const labChests = state.progress.openedTreasures.filter((id) =>
          id.startsWith(prefix),
        ).length;
        if (labChests >= 4 && !state.progress.clearedLabyrinths.includes(action.labyrinthId)) {
          state.progress.clearedLabyrinths.push(action.labyrinthId);
        }
      }
      const res = grantXp(current.race, level, state, rewardXp);
      level = res.level;
      notice = res.leveledUp
        ? `Otwarto ukryty skarb (+${rewardGold} zł, +${rewardXp} PD${itemNote}) — AWANS na poziom ${level}!`
        : `Otwarto ukryty skarb! +${rewardGold} zł, +${rewardXp} PD${itemNote}.`;
      break;
    }

    case "monster_kill": {
      if (nowMs - state.progress.lastKillAt < 1200) {
        throw new AndroidEconomyError("ARENA_COOLDOWN", "Zbyt szybkie kolejne zabicie potwora.");
      }
      state.progress.lastKillAt = nowMs;
      state.progress.monsterKills += 1;
      const lvl = clampInt(action.level, 1, MAX_LEVEL, 1);
      const rewardXp = 26 + lvl * 16;
      const rewardGold = 10 + lvl * 6;
      gold = Math.min(MAX_GOLD, gold + rewardGold);
      const res = grantXp(current.race, level, state, rewardXp);
      level = res.level;
      notice = res.leveledUp
        ? `Pokonano potwora (+${rewardXp} PD, +${rewardGold} zł) — AWANS na poziom ${level}!`
        : `Pokonano potwora! +${rewardXp} PD, +${rewardGold} zł.`;
      break;
    }

    case "travel": {
      land = action.land;
      if (!state.progress.visitedLands.includes(land)) {
        state.progress.visitedLands.push(land);
      }
      notice = `Podróż do kontynentu: ${land}`;
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
          const stats = computeAndroidStats(current.race, level, state);
          state.hp = stats.maxHp;
          state.ki = stats.maxKi;
          notice = `GM: Ustawiono poziom ${level}`;
          break;
        }
        case "add_gold": {
          gold = clampInt(gold + (action.value ?? 0), 0, MAX_GOLD, gold);
          notice = `GM: Złoto = ${gold}`;
          break;
        }
        case "add_stat_points": {
          state.freeStatPoints = clampInt(
            state.freeStatPoints + (action.value ?? 0),
            0,
            2000,
            state.freeStatPoints,
          );
          notice = `GM: Punkty statystyk = ${state.freeStatPoints}`;
          break;
        }
        case "add_skill_points": {
          state.skillPoints = clampInt(
            state.skillPoints + (action.value ?? 0),
            0,
            200,
            state.skillPoints,
          );
          notice = `GM: Punkty skilli = ${state.skillPoints}`;
          break;
        }
        case "full_heal": {
          const stats = computeAndroidStats(current.race, level, state);
          state.hp = stats.maxHp;
          state.ki = stats.maxKi;
          notice = "GM: Pełne odnowienie HP i KI.";
          break;
        }
      }
      break;
    }
  }

  return { land, level, gold, state, notice, teleportCapital };
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
    unlockedNodes: z
      .array(z.string().regex(/^[A-Z0-9_-]{1,8}$/))
      .max(40)
      .optional(),
    equipment: z.record(z.string(), z.string().nullable()).optional(),
    backpack: z.array(itemStackSchema.nullable()).length(BACKPACK_SIZE).optional(),
    bankItems: z.array(itemStackSchema.nullable()).length(BANK_SIZE).optional(),
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

  const mergedState: AndroidHeroState = structuredClone(current.state);
  if (p.xp !== undefined) mergedState.xp = p.xp;
  if (p.bankGold !== undefined) mergedState.bankGold = p.bankGold;
  if (p.freeStatPoints !== undefined) mergedState.freeStatPoints = p.freeStatPoints;
  if (p.skillPoints !== undefined) mergedState.skillPoints = p.skillPoints;
  if (p.bonusStats) {
    for (const key of STAT_KEYS) {
      if (p.bonusStats[key] !== undefined) mergedState.bonusStats[key] = p.bonusStats[key]!;
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
  if (p.backpack !== undefined) mergedState.backpack = p.backpack;
  if (p.bankItems !== undefined) mergedState.bankItems = p.bankItems;
  if (p.completedQuests !== undefined) mergedState.completedQuests = p.completedQuests;

  const stats = computeAndroidStats(race, level, mergedState);
  mergedState.hp = Math.max(1, Math.min(stats.maxHp, p.hp ?? mergedState.hp));
  mergedState.ki = Math.max(0, Math.min(stats.maxKi, p.ki ?? mergedState.ki));

  return { name, race, land, level, gold, state: mergedState };
}
