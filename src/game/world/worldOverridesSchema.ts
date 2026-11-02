/**
 * Shared validation of world edits (browser editor and game server use the same rules).
 * Accepts only the known sections, plain JSON values, finite numbers and bounded sizes;
 * custom spawns must name a known land and monster so the server simulation never throws.
 */
import { MONSTER_DEFS } from "../monsters/catalog";
import { FEATURE_IDS } from "./generated/superiorSave";
import { emptyAdminWorldOverrides, type AdminWorldOverrides } from "./adminWorldStore";

export const WORLD_OVERRIDES_MAX_BYTES = 1_000_000;

const SECTIONS = Object.keys(emptyAdminWorldOverrides()).filter(
  (k) => k !== "version" && k !== "updatedAt",
) as (keyof AdminWorldOverrides)[];

const NON_NEGATIVE = new Set([
  "level",
  "hp",
  "atk",
  "def",
  "xp",
  "speed",
  "range",
  "agro",
  "attackCd",
  "respawn",
  "price",
  "sell",
  "radius",
  "rewardXp",
  "rewardCoins",
  "minLevel",
  "requiredLevel",
  "craftingCostCoins",
  "resultCount",
  "recommendedLevel",
  "dangerLevel",
  "homeLeash",
  "respawnMs",
]);

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function checkValue(value: unknown, key: string, depth: number): string | null {
  if (depth > 8) return "too deep";
  if (value === null || typeof value === "boolean") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return `${key}: number is not finite`;
    if (NON_NEGATIVE.has(key) && value < 0) return `${key}: must not be negative`;
    return null;
  }
  if (typeof value === "string") return value.length > 4000 ? `${key}: text too long` : null;
  if (Array.isArray(value)) {
    if (value.length > 500) return `${key}: list too long`;
    for (const item of value) {
      const e = checkValue(item, key, depth + 1);
      if (e) return e;
    }
    return null;
  }
  if (isPlain(value)) {
    const keys = Object.keys(value);
    if (keys.length > 2000) return `${key}: too many entries`;
    for (const k of keys) {
      if (k === "__proto__" || k === "constructor" || k === "prototype")
        return `${key}: forbidden key`;
      const e = checkValue(value[k], k, depth + 1);
      if (e) return e;
    }
    return null;
  }
  return `${key}: unsupported value`;
}

export type OverridesCheck =
  { ok: true; value: AdminWorldOverrides } | { ok: false; error: string };

export function validateWorldOverrides(input: unknown): OverridesCheck {
  if (!isPlain(input)) return { ok: false, error: "not an object" };
  const out = emptyAdminWorldOverrides();
  if (typeof input["updatedAt"] === "string" && input["updatedAt"].length <= 40)
    out.updatedAt = input["updatedAt"];
  for (const section of SECTIONS) {
    const value = input[section];
    if (value === undefined) continue;
    if (!isPlain(value)) return { ok: false, error: `${section}: not an object` };
    for (const [id, entry] of Object.entries(value)) {
      if (id.length > 200) return { ok: false, error: `${section}: id too long` };
      if (!isPlain(entry)) return { ok: false, error: `${section}.${id}: not an object` };
    }
    const e = checkValue(value, section, 0);
    if (e) return { ok: false, error: e };
    (out as unknown as Record<string, unknown>)[section] = value;
  }
  for (const [id, s] of Object.entries(out.customSpawns)) {
    if (!(FEATURE_IDS as readonly string[]).includes(s.feature))
      return { ok: false, error: `customSpawns.${id}: unknown land` };
    if (s.deleted) continue;
    if (typeof s.kind !== "string" || !MONSTER_DEFS[s.kind])
      return { ok: false, error: `customSpawns.${id}: unknown monster` };
    for (const k of ["x", "y", "homeLeash", "respawnMs"] as const)
      if (typeof s[k] !== "number") return { ok: false, error: `customSpawns.${id}.${k}: number` };
  }
  if (JSON.stringify(out).length > WORLD_OVERRIDES_MAX_BYTES)
    return { ok: false, error: "too large" };
  return { ok: true, value: out };
}

/** Stable comparison of two override sets, ignoring the timestamp. */
export function sameWorldOverrides(a: AdminWorldOverrides, b: AdminWorldOverrides): boolean {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : isPlain(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical(v[k])]),
          )
        : v;
  const strip = (o: AdminWorldOverrides) => JSON.stringify(canonical({ ...o, updatedAt: "" }));
  return strip(a) === strip(b);
}
