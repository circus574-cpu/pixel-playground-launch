/**
 * Cloud copy of a logged-in player's browser saves (table public.characters, docs/db/2026-10-26-accounts.sql).
 *
 * The browser stays the game's storage; the cloud mirrors every save key of the game. A full sync
 * (pull + push) runs only while no game is mounted, so the running session never sees its save
 * replaced underneath. During play the client only pushes, guarded by the row revision: a game
 * master's edit raises the revision, the push is refused and the next full sync applies the edit.
 * Whenever the cloud wins over a local change, the local text is kept under a recovery key first.
 */

import { PLAYTEST_ID } from "../playtest";

export type CloudRow = { save_key: string; data: unknown; revision: number };

/** What the sync needs from the database; the browser adapter is in cloudPort.ts. */
export interface CloudPort {
  list(): Promise<CloudRow[]>;
  insert(key: string, data: unknown): Promise<CloudRow>;
  /** Updates only when the row still has `revision`; null when it changed meanwhile. */
  update(key: string, data: unknown, revision: number): Promise<CloudRow | null>;
}

export interface KeyStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const GAME_PREFIX = "ki-legends:";
const QUESTS_KEY = "ki_legends_save_v5";
/** Device-only keys: interface preferences and earlier recovery copies are never uploaded. */
const LOCAL_ONLY = ["ki-legends:ui-preferences:", "ki-legends:recovery:", "ki-legends:cloud:"];
/** Isolated QA saves stay on the device. */
const PLAYTEST_MARK = ":" + PLAYTEST_ID;
export const RECOVERY_PREFIX = "ki-legends:recovery:cloud:";
const MAX_VALUE = 4_000_000;

export function syncableKeys(storage: KeyStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (key === QUESTS_KEY || (key.startsWith(GAME_PREFIX) && !isLocalOnly(key))) keys.push(key);
  }
  return keys.sort();
}
export function isLocalOnly(key: string) {
  return LOCAL_ONLY.some((p) => key.startsWith(p)) || key.includes(PLAYTEST_MARK);
}

/** JSON saves are stored as JSON, so the panel can read and edit them; anything else as text. */
export function toCloud(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { $raw: raw };
  }
}
export function fromCloud(data: unknown): string {
  if (data && typeof data === "object" && "$raw" in data && Object.keys(data).length === 1)
    return String((data as { $raw: unknown }).$raw);
  return JSON.stringify(data);
}

/** Last synced state per key, kept on this device for this account. */
type Ledger = Record<string, { revision: number; text: string }>;
const ledgerKey = (userId: string) => "ki-legends:cloud:" + userId;
function readLedger(storage: KeyStorage, userId: string): Ledger {
  try {
    const value: unknown = JSON.parse(storage.getItem(ledgerKey(userId)) ?? "{}");
    return value && typeof value === "object" ? (value as Ledger) : {};
  } catch {
    return {};
  }
}
function writeLedger(storage: KeyStorage, userId: string, ledger: Ledger) {
  storage.setItem(ledgerKey(userId), JSON.stringify(ledger));
}

export type SyncReport = {
  pulled: string[];
  pushed: string[];
  /** Local changes replaced by a newer cloud version; each kept under RECOVERY_PREFIX. */
  replaced: string[];
  /** Pushes refused because the cloud changed meanwhile (applied at the next full sync). */
  refused: string[];
};

function keepRecovery(storage: KeyStorage, key: string, text: string) {
  try {
    storage.setItem(RECOVERY_PREFIX + key, text);
  } catch {
    // A full device keeps the current save; the cloud copy is still the newer one.
  }
}

/**
 * Two-way sync. Use only while no game is running. Same text on both sides: nothing to do.
 * Only one side changed since the last sync: that side wins. Both changed: the cloud wins and
 * the local text is kept as a recovery copy. A key never synced before on this device: the cloud
 * wins if it has one, otherwise the local save is uploaded.
 */
export async function syncAll(
  storage: KeyStorage,
  userId: string,
  port: CloudPort,
): Promise<SyncReport> {
  const report: SyncReport = { pulled: [], pushed: [], replaced: [], refused: [] };
  const ledger = readLedger(storage, userId);
  const remote = new Map((await port.list()).map((r) => [r.save_key, r]));
  const keys = new Set([...remote.keys(), ...syncableKeys(storage)]);
  for (const key of keys) {
    if (isLocalOnly(key)) continue;
    const row = remote.get(key);
    const local = storage.getItem(key);
    const seen = ledger[key];
    if (row) {
      const text = fromCloud(row.data);
      const localChanged = local !== null && local !== (seen?.text ?? text);
      const cloudChanged = !seen || row.revision !== seen.revision;
      if (local === text) {
        ledger[key] = { revision: row.revision, text };
      } else if (cloudChanged || local === null) {
        if (local !== null && localChanged) {
          keepRecovery(storage, key, local);
          report.replaced.push(key);
        }
        storage.setItem(key, text);
        ledger[key] = { revision: row.revision, text };
        report.pulled.push(key);
      } else if (local !== null && local.length <= MAX_VALUE) {
        const saved = await port.update(key, toCloud(local), row.revision);
        if (saved) {
          ledger[key] = { revision: saved.revision, text: local };
          report.pushed.push(key);
        } else report.refused.push(key);
      }
    } else if (local !== null && local.length <= MAX_VALUE) {
      const saved = await port.insert(key, toCloud(local));
      ledger[key] = { revision: saved.revision, text: local };
      report.pushed.push(key);
    }
  }
  writeLedger(storage, userId, ledger);
  return report;
}

/**
 * Push-only pass for a running game: uploads local changes, never writes local storage except the
 * ledger. A refused push (cloud changed) is left for the next full sync.
 */
export async function pushChanges(
  storage: KeyStorage,
  userId: string,
  port: CloudPort,
): Promise<SyncReport> {
  const report: SyncReport = { pulled: [], pushed: [], replaced: [], refused: [] };
  const ledger = readLedger(storage, userId);
  for (const key of syncableKeys(storage)) {
    const local = storage.getItem(key);
    const seen = ledger[key];
    if (local === null || local.length > MAX_VALUE || local === seen?.text) continue;
    if (!seen) {
      // First upload of this key; a key already in the cloud is reconciled by the next full sync.
      try {
        const saved = await port.insert(key, toCloud(local));
        ledger[key] = { revision: saved.revision, text: local };
        report.pushed.push(key);
      } catch {
        report.refused.push(key);
      }
      continue;
    }
    const saved = await port.update(key, toCloud(local), seen.revision);
    if (saved) {
      ledger[key] = { revision: saved.revision, text: local };
      report.pushed.push(key);
    } else report.refused.push(key);
  }
  writeLedger(storage, userId, ledger);
  return report;
}
