import { CharacterStatsSchema, type CharacterStats } from "../characterStats";
/**
 * Game-master edits of a saved character. The game rejects a save it finds inconsistent
 * (superiorSave.ts load), so every edit is checked here with the same rules before it is stored.
 */
import { isMaterial, MATERIAL_IDS } from "../monsters/materials";
import {
  ITEM_IDS,
  MATERIAL_CAPACITY,
  PlayerSchema,
  stats,
  xpNeeded,
  type ItemId,
  type Player,
  type QuestId,
} from "../session";
import { validLearned } from "../kit/progression";
import { FEATURE_IDS, type FeatureId } from "../world/generated/superiorSave";
import { WORLD_INDEX } from "../world/generated/worldVersion";
import { RACES, WORLD_IDS, type RaceId, type WorldId } from "../world/races";

export type QuestStatus = "locked" | "active" | "ready" | "done";

export type CharacterSummary = {
  statOverrides: CharacterStats;
  currentStats: ReturnType<typeof stats> | null;
  name?: string;
  race: RaceId;
  continent: string;
  feature?: FeatureId;
  town?: string | null;
  x: number;
  y: number;
  level: number;
  xp: number;
  hp: number;
  ki: number;
  gold: number;
  weapon: Player["weapon"];
  armor: "vest" | null;
  upgrade: number;
  items: Record<ItemId, number>;
  materials: Record<string, number>;
  depotItems: Record<ItemId, number>;
  depotMaterials: Record<string, number>;
  depotUpgrade: number;
  skills: string[];
  respecs: number;
  quests: Record<QuestId, QuestStatus>;
};

// Same saved-player calculation as the game; never invent zero/default values for corrupt data.
// Position is intentionally excluded: Superior coordinates have a larger valid range.
const statPlayer = PlayerSchema.pick({
  race: true,
  level: true,
  weapon: true,
  armor: true,
  upgrade: true,
  skills: true,
  statOverrides: true,
  combatTraining: true,
  development: true,
});

type Envelope = {
  format?: string;
  feature?: FeatureId;
  town?: string | null;
  player?: Record<string, unknown>;
};

/** A save of one character (Superior world), as opposed to slot lists and other keys. */
export function isCharacterSave(
  data: unknown,
): data is Envelope & { player: Record<string, unknown> } {
  const e = data as Envelope | null;
  return !!e && typeof e === "object" && !!e.player && typeof e.player === "object";
}

export function summarize(data: unknown): CharacterSummary | null {
  if (!isCharacterSave(data)) return null;
  const p = data.player;
  const items = (p["items"] ?? {}) as Record<string, number>;
  const materials = (p["materials"] ?? {}) as Record<string, number>;
  const depot = (p["depot"] ?? {}) as {
    items?: Record<string, number>;
    materials?: Record<string, number>;
    upgrade?: number;
  };
  const quests = (p["quests"] ?? {}) as Record<string, string>;
  const parsed = statPlayer.safeParse(p);
  return {
    ...(typeof p["name"] === "string" ? { name: p["name"] } : {}),
    statOverrides: CharacterStatsSchema.safeParse(p["statOverrides"] ?? {}).data ?? {},
    currentStats: parsed.success ? stats(parsed.data) : null,
    race: p["race"] as RaceId,
    continent: String(p["continent"] ?? ""),
    ...(data.feature ? { feature: data.feature } : {}),
    ...(data.town !== undefined ? { town: data.town } : {}),
    x: Number(p["x"] ?? 0),
    y: Number(p["y"] ?? 0),
    level: Number(p["level"] ?? 1),
    xp: Number(p["xp"] ?? 0),
    hp: Number(p["hp"] ?? 1),
    ki: Number(p["ki"] ?? 0),
    gold: Number(p["gold"] ?? 0),
    weapon: p["weapon"] === "sword" || p["weapon"] === "heritage" ? p["weapon"] : null,
    armor: p["armor"] === "vest" ? "vest" : null,
    upgrade: Number(p["upgrade"] ?? 0),
    items: Object.fromEntries(ITEM_IDS.map((id) => [id, Number(items[id] ?? 0)])) as Record<
      ItemId,
      number
    >,
    materials: Object.fromEntries(
      Object.entries(materials)
        .filter(([id, n]) => isMaterial(id) && Number(n) > 0)
        .map(([id, n]) => [id, Number(n)]),
    ),
    depotItems: Object.fromEntries(
      ITEM_IDS.map((id) => [id, Number(depot.items?.[id] ?? 0)]),
    ) as Record<ItemId, number>,
    depotMaterials: Object.fromEntries(
      Object.entries(depot.materials ?? {})
        .filter(([id, n]) => isMaterial(id) && Number(n) > 0)
        .map(([id, n]) => [id, Number(n)]),
    ),
    depotUpgrade: Number(depot.upgrade ?? 0),
    skills: Array.isArray(p["skills"]) ? (p["skills"] as string[]) : ["R"],
    respecs: Number(p["respecs"] ?? 0),
    quests: {
      steps: (quests["steps"] as QuestStatus) ?? "locked",
      boars: (quests["boars"] as QuestStatus) ?? "locked",
      gear: (quests["gear"] as QuestStatus) ?? "locked",
    },
  };
}

export type CharacterEdit = Partial<
  Pick<
    CharacterSummary,
    | "statOverrides"
    | "level"
    | "xp"
    | "hp"
    | "ki"
    | "gold"
    | "x"
    | "y"
    | "weapon"
    | "armor"
    | "upgrade"
    | "depotUpgrade"
    | "skills"
    | "respecs"
    | "feature"
    | "town"
  >
> & {
  items?: Partial<Record<ItemId, number>>;
  materials?: Record<string, number>;
  depotItems?: Partial<Record<ItemId, number>>;
  depotMaterials?: Record<string, number>;
  quests?: Partial<Record<QuestId, QuestStatus>>;
};

const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** Applies an edit; returns the new save data or the reason it would break the character. */
export function applyEdit(
  data: unknown,
  edit: CharacterEdit,
): { ok: true; data: unknown } | { ok: false; reason: string } {
  if (!isCharacterSave(data)) return { ok: false, reason: "To nie jest zapis postaci." };
  if (
    edit.statOverrides !== undefined &&
    !CharacterStatsSchema.safeParse(edit.statOverrides).success
  )
    return {
      ok: false,
      reason: "Parametry postaci poza dozwolonym zakresem; wpisz skończone liczby.",
    };
  const next = structuredClone(data);
  const p = next.player;
  const race = p["race"] as RaceId;
  if (!RACES[race]) return { ok: false, reason: "Nieznane pochodzenie postaci." };

  const level = edit.level ?? Number(p["level"]);
  const xp = edit.xp ?? Number(p["xp"]);
  if (!whole(level, 1, 100)) return { ok: false, reason: "Poziom musi być liczbą 1–100." };
  if (!whole(xp, 0, xpNeeded(level) - 1))
    return { ok: false, reason: `Doświadczenie na poziomie ${level}: 0–${xpNeeded(level) - 1}.` };

  const skills = edit.skills ?? (Array.isArray(p["skills"]) ? (p["skills"] as string[]) : ["R"]);
  if (!skills.includes("R") || !validLearned(race, level, skills))
    return {
      ok: false,
      reason: "Poznane umiejętności wymagają wyższego poziomu lub mają niepoprawne zależności.",
    };

  if (edit.gold !== undefined && !whole(edit.gold, 0, 1_000_000))
    return { ok: false, reason: "Złoto: 0–1 000 000." };
  if (edit.hp !== undefined && !whole(edit.hp, 1, 100_000))
    return { ok: false, reason: "Życie: co najmniej 1 (gra przytnie je do maksimum)." };
  if (edit.ki !== undefined && !whole(edit.ki, 0, 100_000))
    return { ok: false, reason: "Energia KI: 0–100 000." };
  if (edit.respecs !== undefined && !whole(edit.respecs, 0, 100_000))
    return { ok: false, reason: "Liczba resetów drzewka: 0–100 000." };

  if (edit.feature !== undefined) {
    if (!FEATURE_IDS.includes(edit.feature))
      return { ok: false, reason: "Nieznany ląd: " + edit.feature };
    const fInfo = WORLD_INDEX.features.find((f) => f.id === edit.feature);
    if (fInfo) {
      next.feature = edit.feature;
      p["continent"] = fInfo.affinity;
      p["interior"] = null;
      if (edit.x === undefined && edit.y === undefined) {
        p["x"] = fInfo.arrival.x;
        p["y"] = fInfo.arrival.y;
      }
    }
  }
  if (edit.town !== undefined) {
    next.town = edit.town;
  }

  const featureId = (next.feature ?? p["continent"] ?? "verdant") as FeatureId;
  const featureInfo = WORLD_INDEX.features.find((f) => f.id === featureId);
  const maxX = featureInfo?.width ?? 131072;
  const maxY = featureInfo?.height ?? 131072;

  if (edit.x !== undefined) {
    if (!Number.isFinite(edit.x) || edit.x < 0 || edit.x > maxX)
      return { ok: false, reason: `Współrzędna X poza zakresem lądu (0–${maxX}).` };
    p["x"] = edit.x;
    p["interior"] = null;
  }
  if (edit.y !== undefined) {
    if (!Number.isFinite(edit.y) || edit.y < 0 || edit.y > maxY)
      return { ok: false, reason: `Współrzędna Y poza zakresem lądu (0–${maxY}).` };
    p["y"] = edit.y;
    p["interior"] = null;
  }

  const items = { ...((p["items"] ?? {}) as Record<string, number>) };
  for (const [id, n] of Object.entries(edit.items ?? {})) {
    if (!ITEM_IDS.includes(id as ItemId)) return { ok: false, reason: "Nieznany przedmiot: " + id };
    if (!whole(n, 0, 99)) return { ok: false, reason: "Liczba przedmiotów: 0–99." };
    items[id] = n;
  }

  const weapon = edit.weapon !== undefined ? edit.weapon : (p["weapon"] as Player["weapon"]);
  const armor = edit.armor !== undefined ? edit.armor : (p["armor"] as "vest" | null);
  const upgrade = edit.upgrade !== undefined ? edit.upgrade : Number(p["upgrade"] ?? 0);
  if (!whole(upgrade, 0, 1)) return { ok: false, reason: "Ulepszenie miecza: 0 lub 1." };
  if (weapon === "sword" && !items["sword"])
    return { ok: false, reason: "Postać ma założony miecz: zostaw co najmniej 1." };
  if (
    weapon === "heritage" &&
    statPlayer.safeParse(p).data?.development?.heritage.weapon?.location !== "bag"
  )
    return { ok: false, reason: "Broń dziedzictwa musi znajdować się w plecaku postaci." };
  if (armor && !items["vest"])
    return { ok: false, reason: "Postać ma założony pancerz: zostaw co najmniej 1." };

  const materials = { ...((p["materials"] ?? {}) as Record<string, number>) };
  if (edit.materials) {
    for (const [id, n] of Object.entries(edit.materials)) {
      if (!isMaterial(id)) return { ok: false, reason: "Nieznany materiał: " + id };
      if (!whole(n, 0, 99)) return { ok: false, reason: "Liczba materiałów: 0–99." };
      if (n === 0) delete materials[id];
      else materials[id] = n;
    }
    if (Object.keys(materials).length > MATERIAL_CAPACITY)
      return { ok: false, reason: `Limit różnych materiałów w plecaku: ${MATERIAL_CAPACITY}.` };
  }

  const rawDepot = (p["depot"] ?? {
    items: { potion: 0, tusk: 0, sword: 0, vest: 0 },
    materials: {},
    upgrade: 0,
  }) as {
    items: Record<string, number>;
    materials: Record<string, number>;
    upgrade: number;
  };
  const depotItems = { ...rawDepot.items };
  for (const [id, n] of Object.entries(edit.depotItems ?? {})) {
    if (!ITEM_IDS.includes(id as ItemId)) return { ok: false, reason: "Nieznany przedmiot: " + id };
    if (!whole(n, 0, 99)) return { ok: false, reason: "Liczba przedmiotów w depozycie: 0–99." };
    depotItems[id] = n;
  }
  const depotMaterials = { ...rawDepot.materials };
  if (edit.depotMaterials) {
    for (const [id, n] of Object.entries(edit.depotMaterials)) {
      if (!isMaterial(id)) return { ok: false, reason: "Nieznany materiał: " + id };
      if (!whole(n, 0, 99)) return { ok: false, reason: "Liczba materiałów w depozycie: 0–99." };
      if (n === 0) delete depotMaterials[id];
      else depotMaterials[id] = n;
    }
    if (Object.keys(depotMaterials).length > MATERIAL_CAPACITY)
      return { ok: false, reason: `Limit różnych materiałów w depozycie: ${MATERIAL_CAPACITY}.` };
  }
  const depotUpgrade = edit.depotUpgrade ?? rawDepot.upgrade ?? 0;
  if (!whole(depotUpgrade, 0, 1)) return { ok: false, reason: "Ulepszenie w depozycie: 0 lub 1." };
  if (depotUpgrade > 0 && !depotItems["sword"])
    return { ok: false, reason: "Ulepszone ostrze w depozycie wymaga co najmniej 1 miecza." };

  const currentQuests = (p["quests"] ?? {
    steps: "locked",
    boars: "locked",
    gear: "locked",
  }) as Record<QuestId, QuestStatus>;
  const quests: Record<QuestId, QuestStatus> = {
    steps: edit.quests?.steps ?? currentQuests.steps,
    boars: edit.quests?.boars ?? currentQuests.boars,
    gear: edit.quests?.gear ?? currentQuests.gear,
  };
  if (quests.boars !== "locked" && quests.steps !== "done")
    return {
      ok: false,
      reason: "Zadanie 'Zagrożenie w lesie' wymaga ukończenia 'Pierwszych kroków'.",
    };
  if (
    quests.gear !== "locked" &&
    quests.boars !== "done" &&
    !(quests.boars === "locked" && quests.steps === "done")
  )
    return {
      ok: false,
      reason: "Zadanie 'Pierwsze wyposażenie' wymaga ukończenia polowania.",
    };

  if (edit.statOverrides !== undefined)
    p["statOverrides"] = CharacterStatsSchema.parse(edit.statOverrides);
  p["level"] = level;
  p["xp"] = xp;
  p["skills"] = skills;
  if (edit.gold !== undefined) p["gold"] = edit.gold;
  if (edit.hp !== undefined) p["hp"] = edit.hp;
  if (edit.ki !== undefined) p["ki"] = edit.ki;
  if (edit.respecs !== undefined) p["respecs"] = edit.respecs;
  p["weapon"] = weapon;
  p["armor"] = armor;
  p["upgrade"] = upgrade;
  p["items"] = items;
  p["materials"] = materials;
  p["depot"] = {
    items: depotItems,
    materials: depotMaterials,
    upgrade: depotUpgrade,
  };
  p["quests"] = quests;
  return { ok: true, data: next };
}

export { MATERIAL_IDS, WORLD_IDS };
