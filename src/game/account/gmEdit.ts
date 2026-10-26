/**
 * Game-master edits of a saved character. The game rejects a save it finds inconsistent
 * (superiorSave.ts load), so every edit is checked here with the same rules before it is stored.
 */
import { ITEM_IDS, xpNeeded, type ItemId } from "../session";
import { validLearned } from "../kit/progression";
import type { RaceId } from "../world/races";

export type CharacterSummary = {
  race: RaceId;
  continent: string;
  level: number;
  xp: number;
  hp: number;
  gold: number;
  items: Record<ItemId, number>;
  skills: string[];
};

type Envelope = { format?: string; player?: Record<string, unknown> };

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
  return {
    race: p["race"] as RaceId,
    continent: String(p["continent"] ?? ""),
    level: Number(p["level"] ?? 1),
    xp: Number(p["xp"] ?? 0),
    hp: Number(p["hp"] ?? 0),
    gold: Number(p["gold"] ?? 0),
    items: Object.fromEntries(ITEM_IDS.map((id) => [id, Number(items[id] ?? 0)])) as Record<
      ItemId,
      number
    >,
    skills: Array.isArray(p["skills"]) ? (p["skills"] as string[]) : ["R"],
  };
}

export type CharacterEdit = Partial<Pick<CharacterSummary, "level" | "xp" | "hp" | "gold">> & {
  items?: Partial<Record<ItemId, number>>;
};

const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** Applies an edit; returns the new save data or the reason it would break the character. */
export function applyEdit(
  data: unknown,
  edit: CharacterEdit,
): { ok: true; data: unknown } | { ok: false; reason: string } {
  if (!isCharacterSave(data)) return { ok: false, reason: "To nie jest zapis postaci." };
  const next = structuredClone(data);
  const p = next.player;
  const level = edit.level ?? Number(p["level"]);
  const xp = edit.xp ?? Number(p["xp"]);
  if (!whole(level, 1, 100)) return { ok: false, reason: "Poziom musi być liczbą 1–100." };
  if (!whole(xp, 0, xpNeeded(level) - 1))
    return { ok: false, reason: `Doświadczenie na poziomie ${level}: 0–${xpNeeded(level) - 1}.` };
  const skills = Array.isArray(p["skills"]) ? (p["skills"] as string[]) : ["R"];
  if (!validLearned(p["race"] as RaceId, level, skills))
    return {
      ok: false,
      reason: "Poznane umiejętności wymagają wyższego poziomu. Najpierw zresetuj drzewko postaci.",
    };
  if (edit.gold !== undefined && !whole(edit.gold, 0, 1_000_000))
    return { ok: false, reason: "Złoto: 0–1 000 000." };
  if (edit.hp !== undefined && !whole(edit.hp, 1, 100_000))
    return { ok: false, reason: "Życie: co najmniej 1 (gra przytnie je do maksimum)." };
  const items = { ...((p["items"] ?? {}) as Record<string, number>) };
  for (const [id, n] of Object.entries(edit.items ?? {})) {
    if (!ITEM_IDS.includes(id as ItemId)) return { ok: false, reason: "Nieznany przedmiot: " + id };
    if (!whole(n, 0, 99)) return { ok: false, reason: "Liczba przedmiotów: 0–99." };
    items[id] = n;
  }
  if (p["weapon"] && !items["sword"])
    return { ok: false, reason: "Postać ma założony miecz: zostaw co najmniej 1." };
  if (p["armor"] && !items["vest"])
    return { ok: false, reason: "Postać ma założony pancerz: zostaw co najmniej 1." };
  p["level"] = level;
  p["xp"] = xp;
  if (edit.gold !== undefined) p["gold"] = edit.gold;
  if (edit.hp !== undefined) p["hp"] = edit.hp;
  p["items"] = items;
  return { ok: true, data: next };
}
