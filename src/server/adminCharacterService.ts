/**
 * Serwis zarządzania postaciami na dedykowanym serwerze gry (Game Server / PostgreSQL).
 * Zapewnia pełną, bezkompromisową edycję wszystkich statystyk, ekwipunku, torby,
 * depozytu, zadań oraz akcje na żywo (leczenie, teleportacja, ożywienie, kick).
 */
import { z } from "zod";
import { getGameDb } from "./db";
import { getActiveGameServer } from "./managedServer";
import { StoredCharacter, type CharacterState } from "./characters/repository";
import { stats, characterFullStats, type CharacterFullStatsResult, type Player } from "../game/session";
import { emptyCombatTraining, trainingRequirement, type CombatTraining } from "../game/combatTraining";
import { BUILDING_IDS, type BuildingId } from "../game/city/types";
import type { CharacterStats } from "../game/characterStats";
import type { RaceId, WorldId } from "../game/world/races";
import { supabase } from "../integrations/supabase/client";

export type QuestStatus = "locked" | "active" | "ready" | "done";

export type JsonSerializable =
  | null
  | boolean
  | number
  | string
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

export interface ServerCharacterSummary {
  characterId: string;
  accountId: string;
  authSubject: string;
  playerNick: string;
  characterName: string;
  race: RaceId;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  gold: number;
  depotGold: number;
  continent: string;
  x: number;
  y: number;
  isOnline: boolean;
  dead: boolean;
  retired: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface ServerCharacterDetail {
  characterId: string;
  accountId: string;
  authSubject: string;
  playerNick: string;
  revision: number;
  leaseId: string | null;
  leaseUntil: string | null;
  retiredAt: string | null;
  isOnline: boolean;
  player: Player;
  maxHp: number;
  maxKi: number;
  fullStats: CharacterFullStatsResult;
  runtime: Record<string, JsonSerializable>;
  updatedAt: string;
  createdAt: string;
}

export interface ServerCharacterUpdatePatch {
  name?: string | undefined;
  level?: number | undefined;
  xp?: number | undefined;
  hp?: number | undefined;
  ki?: number | undefined;
  gold?: number | undefined;
  depotGold?: number | undefined;
  dead?: boolean | undefined;
  respecs?: number | undefined;
  continent?: WorldId | undefined;
  x?: number | undefined;
  y?: number | undefined;
  interior?: BuildingId | null | undefined;

  statOverrides?: {
    maxHp?: number | null | undefined;
    maxKi?: number | null | undefined;
    attack?: number | null | undefined;
    defense?: number | null | undefined;
    speed?: number | null | undefined;
    kiRegen?: number | null | undefined;
    crit?: number | null | undefined;
    attackInterval?: number | null | undefined;
    range?: number | null | undefined;
  } | undefined;

  equipment?: {
    head?: string | null | undefined;
    weapon?: string | null | undefined;
    armor?: string | null | undefined;
    offhand?: string | null | undefined;
    hands?: string | null | undefined;
    ring?: string | null | undefined;
    amulet?: string | null | undefined;
    feet?: string | null | undefined;
    weaponUpgradeTier?: number | undefined;
  } | undefined;

  bagItems?: Record<string, number> | undefined;

  items?: {
    potion?: number | undefined;
    tusk?: number | undefined;
    sword?: number | undefined;
    vest?: number | undefined;
  } | undefined;

  depotItems?: {
    items?: {
      potion?: number | undefined;
      tusk?: number | undefined;
      sword?: number | undefined;
      vest?: number | undefined;
    } | undefined;
    materials?: Record<string, number> | undefined;
    bagItems?: Record<string, number> | undefined;
  } | undefined;

  quests?: {
    steps?: QuestStatus | undefined;
    boars?: QuestStatus | undefined;
    gear?: QuestStatus | undefined;
  } | undefined;

  skills?: string[] | undefined;

  combatTraining?: {
    dodge?: { rank?: number | undefined; progress?: number | undefined } | undefined;
    attackSpeed?: { rank?: number | undefined; progress?: number | undefined } | undefined;
    technique?: { rank?: number | undefined; progress?: number | undefined } | undefined;
  } | undefined;
}

export type LiveAdminAction =
  | { type: "heal" }
  | { type: "teleport"; continent?: WorldId | undefined; x: number; y: number }
  | { type: "teleport_city"; destination: "verdant" | "aether" | "nexus" | "pyra" }
  | { type: "giveGold"; amount: number }
  | { type: "setLevel"; level: number }
  | { type: "revive" }
  | { type: "kick"; reason?: string | undefined }
  | { type: "retire"; retired: boolean };

const CITY_COORDINATES: Record<string, { continent: WorldId; x: number; y: number }> = {
  verdant: { continent: "verdant", x: 4200, y: 2500 },
  aether: { continent: "aether", x: 4200, y: 2500 },
  nexus: { continent: "nexus", x: 4200, y: 2500 },
  pyra: { continent: "pyra", x: 4200, y: 2500 },
};

/** Pobiera profile graczy z Supabase jako mapę [auth_subject -> nick] */
async function getProfilesNickMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await supabase.from("profiles").select("id, nick");
    if (data) {
      for (const row of data) {
        if (row.id && row.nick) {
          map.set(row.id, row.nick);
        }
      }
    }
  } catch {
    // ignoruj błędy jeśli brak dostępu do Supabase
  }
  return map;
}

/**
 * Zwraca listę wszystkich postaci serwerowych z bazy PostgreSQL
 * wraz z ich statystykami i statusem Online na serwerze gry.
 */
export async function listAllServerCharacters(filters?: {
  search?: string | undefined;
  race?: string | undefined;
  onlyOnline?: boolean | undefined;
}): Promise<ServerCharacterSummary[]> {
  const db = getGameDb();
  if (!db) {
    return [];
  }

  const rows = await db`
    SELECT
      c.id AS character_id,
      c.account_id,
      c.race,
      c.created_at,
      c.retired_at,
      a.auth_project,
      a.auth_subject,
      s.revision,
      s.state,
      s.lease_id,
      s.lease_until,
      s.updated_at
    FROM game.characters c
    JOIN game.accounts a ON a.id = c.account_id
    LEFT JOIN game.online_character_state s ON s.character_id = c.id
    ORDER BY c.created_at DESC
  `;

  const profilesMap = await getProfilesNickMap();
  const gameServer = getActiveGameServer();

  const results: ServerCharacterSummary[] = [];

  for (const r of rows) {
    const characterId = r["character_id"] as string;
    const authSubject = r["auth_subject"] as string;
    const race = r["race"] as RaceId;
    const retired = r["retired_at"] !== null;

    let player: Player | null = null;
    if (r["state"] && typeof r["state"] === "object") {
      player = (r["state"] as { player?: Player }).player ?? null;
    }

    const isOnline = gameServer ? gameServer.isCharacterOnline(characterId) : false;

    if (filters?.onlyOnline && !isOnline) continue;
    if (filters?.race && filters.race !== "all" && race !== filters.race) continue;

    const playerNick = profilesMap.get(authSubject) || `Konto ${authSubject.slice(0, 8)}`;
    const characterName = player?.name || `Bohater ${race}`;

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      const matchName = characterName.toLowerCase().includes(q);
      const matchNick = playerNick.toLowerCase().includes(q);
      const matchId = characterId.toLowerCase().includes(q);
      if (!matchName && !matchNick && !matchId) continue;
    }

    const calculatedStats = player ? stats(player) : { maxHp: 100, maxKi: 50 };

    results.push({
      characterId,
      accountId: r["account_id"] as string,
      authSubject,
      playerNick,
      characterName,
      race,
      level: player?.level ?? 1,
      xp: player?.xp ?? 0,
      hp: player?.hp ?? calculatedStats.maxHp,
      maxHp: calculatedStats.maxHp,
      ki: player?.ki ?? calculatedStats.maxKi,
      maxKi: calculatedStats.maxKi,
      gold: player?.gold ?? 0,
      depotGold: player?.depot?.gold ?? 0,
      continent: player?.continent ?? "verdant",
      x: Math.round(player?.x ?? 0),
      y: Math.round(player?.y ?? 0),
      isOnline,
      dead: !!player?.dead,
      retired,
      updatedAt: r["updated_at"] ? new Date(r["updated_at"]).toISOString() : "",
      createdAt: r["created_at"] ? new Date(r["created_at"]).toISOString() : "",
    });
  }

  return results;
}

/**
 * Zwraca szczegółowe dane konkretnej postaci z bazy PostgreSQL (wraz z runtime i pełnym Player)
 */
export async function getServerCharacterDetails(
  characterId: string,
): Promise<ServerCharacterDetail | null> {
  const db = getGameDb();
  if (!db) return null;

  try {
    z.string().uuid().parse(characterId);
  } catch {
    return null;
  }

  const rows = await db`
    SELECT
      c.id AS character_id,
      c.account_id,
      c.race,
      c.created_at,
      c.retired_at,
      a.auth_project,
      a.auth_subject,
      s.revision,
      s.state,
      s.lease_id,
      s.lease_until,
      s.updated_at
    FROM game.characters c
    JOIN game.accounts a ON a.id = c.account_id
    LEFT JOIN game.online_character_state s ON s.character_id = c.id
    WHERE c.id = ${characterId}
  `;

  if (!rows[0] || !rows[0]["state"]) return null;

  const authSubject = rows[0]["auth_subject"] as string;
  const profilesMap = await getProfilesNickMap();
  const playerNick = profilesMap.get(authSubject) || `Konto ${authSubject.slice(0, 8)}`;

  const parsedState = StoredCharacter.parse(rows[0]["state"]);
  const player = parsedState.player as Player;
  const calculatedStats = stats(player);
  const fullStats = characterFullStats(player);
  const gameServer = getActiveGameServer();
  const isOnline = gameServer ? gameServer.isCharacterOnline(characterId) : false;

  return {
    characterId,
    accountId: rows[0]["account_id"] as string,
    authSubject,
    playerNick,
    revision: Number(rows[0]["revision"]),
    leaseId: (rows[0]["lease_id"] as string) || null,
    leaseUntil: rows[0]["lease_until"] ? new Date(rows[0]["lease_until"]).toISOString() : null,
    retiredAt: rows[0]["retired_at"] ? new Date(rows[0]["retired_at"]).toISOString() : null,
    isOnline,
    player,
    maxHp: calculatedStats.maxHp,
    maxKi: calculatedStats.maxKi,
    fullStats,
    runtime: parsedState.runtime as Record<string, JsonSerializable>,
    updatedAt: rows[0]["updated_at"] ? new Date(rows[0]["updated_at"]).toISOString() : "",
    createdAt: rows[0]["created_at"] ? new Date(rows[0]["created_at"]).toISOString() : "",
  };
}

/**
 * Aktualizuje stan postaci w bazie PostgreSQL z atomowym zwiększeniem revision.
 * Jeśli postać jest obecnie podłączona do serwera gry, serwer zostaje zsynchronizowany.
 */
export async function updateServerCharacter(
  characterId: string,
  patch: ServerCharacterUpdatePatch,
  adminUserId: string,
): Promise<{ ok: boolean; revision: number; error?: string }> {
  const db = getGameDb();
  if (!db) return { ok: false, revision: 0, error: "Brak połączenia z bazą PostgreSQL" };

  try {
    z.string().uuid().parse(characterId);
  } catch {
    return { ok: false, revision: 0, error: "Nieprawidłowy format UUID postaci" };
  }

  return await db.begin(async (tx) => {
    const rows = await tx`
      SELECT s.revision, s.state, c.race
      FROM game.online_character_state s
      JOIN game.characters c ON c.id = s.character_id
      WHERE s.character_id = ${characterId}
      FOR UPDATE OF s
    `;

    if (!rows[0]) {
      return { ok: false, revision: 0, error: "Postać nie istnieje w bazie" };
    }

    const currentRecord = StoredCharacter.parse(rows[0]["state"]);
    const player = currentRecord.player as Player;

    // Aplikacja zmian z patcha
    if (patch.name !== undefined) player.name = patch.name.trim();
    if (patch.level !== undefined) player.level = Math.max(1, Math.min(20, Math.floor(patch.level)));
    if (patch.xp !== undefined) player.xp = Math.max(0, Math.floor(patch.xp));
    if (patch.hp !== undefined) player.hp = Math.max(0, Math.round(patch.hp));
    if (patch.ki !== undefined) player.ki = Math.max(0, Math.round(patch.ki));
    if (patch.gold !== undefined) player.gold = Math.max(0, Math.floor(patch.gold));
    if (patch.dead !== undefined) player.dead = patch.dead;
    if (patch.respecs !== undefined) player.respecs = Math.max(0, Math.floor(patch.respecs));
    if (patch.continent !== undefined) player.continent = patch.continent;
    if (patch.x !== undefined) player.x = patch.x;
    if (patch.y !== undefined) player.y = patch.y;
    if (patch.interior !== undefined) player.interior = patch.interior;

    // Depozyt miejski
    if (patch.depotGold !== undefined || patch.depotItems !== undefined) {
      player.depot = player.depot ?? {
        items: { potion: 0, tusk: 0, sword: 0, vest: 0 },
        materials: {},
        upgrade: 0,
        gold: 0,
        bagItems: {},
      };
      if (patch.depotGold !== undefined) {
        player.depot.gold = Math.max(0, Math.floor(patch.depotGold));
      }
      if (patch.depotItems?.items) {
        if (patch.depotItems.items.potion !== undefined)
          player.depot.items.potion = patch.depotItems.items.potion;
        if (patch.depotItems.items.tusk !== undefined)
          player.depot.items.tusk = patch.depotItems.items.tusk;
        if (patch.depotItems.items.sword !== undefined)
          player.depot.items.sword = patch.depotItems.items.sword;
        if (patch.depotItems.items.vest !== undefined)
          player.depot.items.vest = patch.depotItems.items.vest;
      }
      if (patch.depotItems?.materials) {
        player.depot.materials = { ...player.depot.materials, ...patch.depotItems.materials };
      }
      if (patch.depotItems?.bagItems) {
        player.depot.bagItems = { ...player.depot.bagItems, ...patch.depotItems.bagItems };
      }
    }

    // Nadpisania statystyk bojowych (CharacterStatsSchema)
    if (patch.statOverrides !== undefined) {
      const cleanOverrides: CharacterStats = {};
      for (const [key, val] of Object.entries(patch.statOverrides)) {
        if (val !== null && val !== undefined && val !== 0) {
          (cleanOverrides as Record<string, number>)[key] = Number(val);
        }
      }
      player.statOverrides = Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined;
    }

    // Ekwipunek (PlayerEquipmentSchema)
    if (patch.equipment !== undefined) {
      player.equipment = player.equipment ?? {
        head: null,
        weapon: null,
        armor: null,
        offhand: null,
        hands: null,
        ring: null,
        amulet: null,
        feet: null,
      };
      for (const [slot, item] of Object.entries(patch.equipment)) {
        if (slot === "weaponUpgradeTier") {
          player.upgrade = Math.max(0, Math.min(1, Number(item ?? 0)));
        } else {
          (player.equipment as Record<string, unknown>)[slot] = item || null;
          if (slot === "weapon") player.weapon = typeof item === "string" ? item : null;
          if (slot === "armor") player.armor = typeof item === "string" ? item : null;
        }
      }
    }

    // Torba postaci (bagItems)
    if (patch.bagItems !== undefined) {
      player.bagItems = { ...patch.bagItems };
    }

    // Klasyczne przedmioty (items)
    if (patch.items !== undefined) {
      if (patch.items.potion !== undefined) player.items.potion = patch.items.potion;
      if (patch.items.tusk !== undefined) player.items.tusk = patch.items.tusk;
      if (patch.items.sword !== undefined) player.items.sword = patch.items.sword;
      if (patch.items.vest !== undefined) player.items.vest = patch.items.vest;
    }

    // Zadania (quests)
    if (patch.quests !== undefined) {
      player.quests = player.quests ?? { steps: "locked", boars: "locked", gear: "locked" };
      if (patch.quests.steps !== undefined) player.quests.steps = patch.quests.steps;
      if (patch.quests.boars !== undefined) player.quests.boars = patch.quests.boars;
      if (patch.quests.gear !== undefined) player.quests.gear = patch.quests.gear;
    }

    // Drzewko umiejętności (skills - tablica unikalnych stringów z korzeniem "R")
    if (patch.skills !== undefined) {
      const uniqueSkills = Array.from(new Set(["R", ...patch.skills]));
      player.skills = uniqueSkills;
    }

    // Trening bojowy (combatTraining: dodge, attackSpeed, technique)
    if (patch.combatTraining !== undefined) {
      const ct = player.combatTraining ?? emptyCombatTraining();
      const normalizeTrack = (stat: "dodge" | "attackSpeed" | "technique") => {
        const input = patch.combatTraining?.[stat];
        if (!input) return;
        const rank = Math.max(0, Math.min(100, Math.floor(input.rank ?? ct[stat].rank)));
        const req = trainingRequirement(rank);
        const maxProg = rank === 100 ? 0 : Math.max(0, req - 1);
        const progress = Math.max(0, Math.min(maxProg, Math.floor(input.progress ?? 0)));
        ct[stat] = { rank, progress };
      };
      normalizeTrack("dodge");
      normalizeTrack("attackSpeed");
      normalizeTrack("technique");
      player.combatTraining = ct;
    }

    const nextState: CharacterState = {
      format: "server-character-1",
      player,
      runtime: currentRecord.runtime,
    };

    // Ścisła walidacja schematu
    const validatedState = StoredCharacter.parse(nextState);
    const nextRevision = Number(rows[0]["revision"]) + 1;

    await tx`
      UPDATE game.online_character_state
      SET revision = ${nextRevision},
          state = ${tx.json(validatedState)},
          updated_at = now()
      WHERE character_id = ${characterId}
    `;

    // Powiadomienie lub bezpieczne rozłączenie aktywnego gniazda serwera,
    // aby po natychmiastowym reconnectcie gracz zaciągnął świeży stan
    const gameServer = getActiveGameServer();
    if (gameServer && gameServer.isCharacterOnline(characterId)) {
      gameServer.kickOnlinePlayer(characterId, "Dane postaci zaktualizowane przez administratora.");
    }

    // Zapis do logu audytu (jeśli istnieje tabela admin_audit)
    try {
      await (supabase.from("admin_audit") as any).insert({
        admin_id: adminUserId,
        action: "UPDATE_SERVER_CHARACTER",
        target_id: characterId,
        details: patch,
      });
    } catch {
      // Ignoruj błąd audytu
    }

    return { ok: true, revision: nextRevision };
  });
}

/**
 * Wykonuje szybką akcję live na postaci serwerowej (leczenie, teleport, złoto, ożywienie, kick itp.)
 */
export async function executeLiveAdminAction(
  characterId: string,
  action: LiveAdminAction,
  adminUserId: string,
): Promise<{ ok: boolean; message: string }> {
  const gameServer = getActiveGameServer();

  if (action.type === "kick") {
    if (gameServer && gameServer.isCharacterOnline(characterId)) {
      const kicked = gameServer.kickOnlinePlayer(characterId, action.reason || "Wyrzucono przez administratora");
      return { ok: kicked, message: kicked ? "Gracz został pomyślnie rozłączony z serwera gry." : "Gracz nie jest online." };
    }
    return { ok: true, message: "Gracz nie był połączony z serwerem." };
  }

  const db = getGameDb();
  if (!db) return { ok: false, message: "Brak bazy danych PostgreSQL" };

  try {
    z.string().uuid().parse(characterId);
  } catch {
    return { ok: false, message: "Nieprawidłowy format UUID postaci" };
  }

  if (action.type === "retire") {
    await db`
      UPDATE game.characters
      SET retired_at = ${action.retired ? db`now()` : null}
      WHERE id = ${characterId}
    `;
    if (action.retired && gameServer && gameServer.isCharacterOnline(characterId)) {
      gameServer.kickOnlinePlayer(characterId, "Postać została wycofana.");
    }
    return {
      ok: true,
      message: action.retired ? "Postać została wycofana (soft-delete)." : "Postać została przywrcona.",
    };
  }

  const char = await getServerCharacterDetails(characterId);
  if (!char) return { ok: false, message: "Postać nie znaleziona w bazie" };

  const playerPatch: ServerCharacterUpdatePatch = {};

  switch (action.type) {
    case "heal": {
      playerPatch.hp = char.maxHp;
      playerPatch.ki = char.maxKi;
      playerPatch.dead = false;
      break;
    }
    case "revive": {
      playerPatch.dead = false;
      playerPatch.hp = char.maxHp;
      playerPatch.ki = char.maxKi;
      break;
    }
    case "giveGold": {
      playerPatch.gold = Math.max(0, (char.player.gold ?? 0) + action.amount);
      break;
    }
    case "setLevel": {
      playerPatch.level = Math.max(1, Math.min(20, Math.floor(action.level)));
      break;
    }
    case "teleport": {
      if (action.continent) playerPatch.continent = action.continent;
      playerPatch.x = action.x;
      playerPatch.y = action.y;
      break;
    }
    case "teleport_city": {
      const city = CITY_COORDINATES[action.destination];
      if (city) {
        playerPatch.continent = city.continent;
        playerPatch.x = city.x;
        playerPatch.y = city.y;
      }
      break;
    }
  }

  const updateResult = await updateServerCharacter(characterId, playerPatch, adminUserId);
  if (!updateResult.ok) {
    return { ok: false, message: updateResult.error || "Błąd wykonania akcji na postaci" };
  }

  return { ok: true, message: "Akcja wykonana pomyślnie i zapisana w bazie serwera." };
}
