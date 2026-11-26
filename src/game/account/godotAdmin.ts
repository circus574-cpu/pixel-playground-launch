/** Admin client of the Android game backend (/ws/godot/admin/*): content releases, client gating, cloud saves, presence. */
import { accessToken } from "./vpsAuth";

const BASE = "/ws/godot";

export type GodotSettings = {
  activeVersion: string | null;
  minClientCode: number;
  maintenance: boolean;
  maintenanceMessage: string | null;
  news: string | null;
  updatedAt: string;
};
export type GodotRelease = {
  version: string;
  note: string | null;
  createdAt: string;
  packs: number;
  bytes: number;
};
export type GodotLivePlayer = {
  id: string;
  nick: string;
  name: string;
  race: string;
  level: number;
  land: string;
  guildTag: string | null;
  power: number;
  ki: boolean;
};
export type GodotOverview = {
  settings: GodotSettings;
  releases: GodotRelease[];
  stats: { saves: number; accounts: number; bytes: number; lastWriteAt: string | null };
  online: { count: number; byLand: Record<string, number> };
  onlinePlayers?: GodotLivePlayer[];
};
export type GodotSaveRow = {
  accountId: string;
  nick: string;
  email: string;
  slot: number;
  revision: number;
  race: string;
  land: string;
  level: number;
  bytes: number;
  clientCode: number;
  contentVersion: string | null;
  updatedAt: string;
};
export type PackEntry = { file: string; bytes: number; sha256: string; files?: number };
export type ContentManifest = {
  format: "ki-godot-content-1";
  version: string;
  packs: Record<string, PackEntry>;
  lands: Record<string, string[]>;
};

export class GodotAdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  FORBIDDEN: "Brak uprawnień (wymagana rola administratora).",
  HASH_MISMATCH: "Suma SHA-256 lub rozmiar paczki się nie zgadza.",
  MISSING_PACK: "Brakuje paczki z manifestu na serwerze.",
  BAD_MANIFEST: "Manifest jest niepoprawny.",
  BAD_VERSION: "Nieprawidłowa wersja lub wydanie jest aktywne.",
  NOT_FOUND: "Nie znaleziono.",
  RATE_LIMITED: "Za dużo żądań. Spróbuj za chwilę.",
  INVALID_INPUT: "Nieprawidłowe dane.",
};

async function call<T>(
  method: string,
  path: string,
  init: { body?: unknown; raw?: Blob; headers?: Record<string, string> } = {},
): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + (await accessToken()),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init.raw ? { "Content-Type": "application/octet-stream" } : {}),
      ...init.headers,
    },
    ...(init.raw
      ? { body: init.raw }
      : init.body !== undefined
        ? { body: JSON.stringify(init.body) }
        : {}),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok)
    throw new GodotAdminError(
      response.status,
      data.message ?? MESSAGES[data.error ?? ""] ?? `Błąd ${response.status}`,
    );
  return data as T;
}

export const godotOverview = () => call<GodotOverview>("GET", "/admin/overview");
export const godotSaves = (query = "") =>
  call<{ saves: GodotSaveRow[] }>("GET", "/admin/saves?q=" + encodeURIComponent(query)).then(
    (r) => r.saves,
  );
export const godotSaveDetail = (account: string, slot: number) =>
  call<{ revision: number; save: unknown }>("GET", `/admin/save?account=${account}&slot=${slot}`);
export const godotDeleteSave = (account: string, slot: number) =>
  call<{ deleted: boolean }>("DELETE", "/admin/save", { body: { account, slot } });
export const godotUpdateSettings = (
  patch: Partial<
    Pick<GodotSettings, "minClientCode" | "maintenance" | "maintenanceMessage" | "news">
  >,
) => call<{ settings: GodotSettings }>("POST", "/admin/settings", { body: patch });
export const godotActivate = (version: string) =>
  call("POST", "/admin/activate", { body: { version } });
export const godotDeleteRelease = (version: string) =>
  call("DELETE", `/admin/releases/${encodeURIComponent(version)}`);
export const godotBroadcast = (message: string) =>
  call<{ ok: boolean; delivered: number }>("POST", "/admin/broadcast", { body: { message } });

/** Uploads the packs of a manifest (skipping none: the server verifies size and SHA-256), then registers the release. */
export async function godotPublish(
  manifest: ContentManifest,
  files: Map<string, File>,
  note: string,
  progress: (done: number, total: number, file: string) => void,
) {
  const entries = Object.values(manifest.packs);
  const total = entries.reduce((sum, p) => sum + p.bytes, 0);
  let done = 0;
  for (const entry of entries) {
    const file = files.get(entry.file);
    if (!file) throw new GodotAdminError(422, `Brak pliku ${entry.file} wśród wybranych.`);
    progress(done, total, entry.file);
    await call(
      "PUT",
      `/admin/releases/${encodeURIComponent(manifest.version)}/files/${encodeURIComponent(entry.file)}`,
      {
        raw: file,
        headers: { "X-Pack-Sha256": entry.sha256 },
      },
    );
    done += entry.bytes;
  }
  progress(total, total, "");
  await call("POST", "/admin/releases", { body: { manifest, note } });
}

export type AndroidItemDef = {
  id: string;
  name: string;
  cat: "weapon" | "armor" | "jewelry" | "consumable" | "material";
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  minLevel?: number;
  icon: string;
  slot: number;
  desc: string;
  shopPrice: number | null;
  sellPrice?: number;
  craftCost: number | null;
};

export type AndroidItemStack = { id: string; qty: number };

export type AndroidCharacterAdmin = {
  id: string;
  accountId: string;
  ownerNick?: string;
  ownerEmail?: string;
  name: string;
  race: "legend" | "planetary" | "sage" | "android";
  land: "pyra" | "verdant" | "aether" | "nexus";
  level: number;
  gold: number;
  revision: number;
  state: {
    version: 1 | 2;
    xp: number;
    bankGold: number;
    hp: number;
    ki: number;
    freeStatPoints: number;
    skillPoints: number;
    bonusStats: { hp: number; ki: number; atk: number; def: number; spd: number; crit: number };
    training?: { hp: number; ki: number; atk: number; def: number; spd: number; crit: number };
    unlockedNodes: string[];
    equipment: Record<string, string | null>;
    backpack: (AndroidItemStack | null)[];
    bankItems: (AndroidItemStack | null)[];
    completedQuests: Record<string, string>;
    lastArenaAt: number;
  };
  stats: {
    maxHp: number;
    maxKi: number;
    kiRegen?: number;
    attack: number;
    defense: number;
    speed: number;
    critChance: number;
    xpNeeded: number;
  };
  browserCharacterId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const godotAdminCharacters = (query = "", accountId?: string) => {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (accountId) params.set("account", accountId);
  const qs = params.toString();
  return call<{ characters: AndroidCharacterAdmin[]; catalog: AndroidItemDef[] }>(
    "GET",
    "/admin/characters" + (qs ? "?" + qs : ""),
  );
};

export const godotAdminCreateCharacter = (body: {
  accountId: string;
  name: string;
  race: AndroidCharacterAdmin["race"];
  land?: AndroidCharacterAdmin["land"];
  level?: number;
  gold?: number;
}) => call<{ character: AndroidCharacterAdmin }>("POST", "/admin/characters", { body });

export const godotAdminUpdateCharacter = (id: string, patch: Record<string, unknown>) =>
  call<{ character: AndroidCharacterAdmin }>(
    "PATCH",
    `/admin/characters/${encodeURIComponent(id)}`,
    { body: patch },
  );

export const godotAdminDeleteCharacter = (id: string) =>
  call<{ deleted: boolean }>("DELETE", `/admin/characters/${encodeURIComponent(id)}`);

export const formatMegabytes = (bytes: number) => (bytes / 1048576).toFixed(1) + " MB";
