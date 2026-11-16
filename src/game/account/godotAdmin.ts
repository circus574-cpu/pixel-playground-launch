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
export type GodotOverview = {
  settings: GodotSettings;
  releases: GodotRelease[];
  stats: { saves: number; accounts: number; bytes: number; lastWriteAt: string | null };
  online: { count: number; byLand: Record<string, number> };
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

export const formatMegabytes = (bytes: number) => (bytes / 1048576).toFixed(1) + " MB";
