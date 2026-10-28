/** Per-character GM overrides; canonical race/skill definitions remain unchanged. */
import { z } from "zod";
export const CHARACTER_STAT_FIELDS = {
  maxHp: { label: "Maksymalne HP", min: 1, max: 100000 },
  maxKi: { label: "Maksymalne KI", min: 1, max: 100000 },
  attack: { label: "Atak", min: 1, max: 100000 },
  defense: { label: "Obrona", min: 0, max: 100000 },
  speed: { label: "Szybkość ruchu (jednostki/s)", min: 1, max: 2000 },
  kiRegen: { label: "Regeneracja KI / s", min: 0, max: 10000 },
  crit: { label: "Szansa krytyczna (%)", min: 0, max: 100 },
  attackInterval: { label: "Odstęp ataków (ms)", min: 200, max: 10000 },
  range: { label: "Zasięg ataku", min: 16, max: 2000 },
} as const;
const n = (key: keyof typeof CHARACTER_STAT_FIELDS) =>
  z
    .number()
    .finite()
    .min(CHARACTER_STAT_FIELDS[key].min)
    .max(CHARACTER_STAT_FIELDS[key].max)
    .optional();
export const CharacterStatsSchema = z
  .object({
    maxHp: n("maxHp"),
    maxKi: n("maxKi"),
    attack: n("attack"),
    defense: n("defense"),
    speed: n("speed"),
    kiRegen: n("kiRegen"),
    crit: n("crit"),
    attackInterval: n("attackInterval"),
    range: n("range"),
  })
  .strict();
export type CharacterStats = z.infer<typeof CharacterStatsSchema>;

const statKeys = Object.keys(CHARACTER_STAT_FIELDS) as (keyof CharacterStats)[];
export function applyCharacterStats<T extends Required<CharacterStats>>(
  stats: T,
  overrides?: CharacterStats,
): T {
  if (overrides)
    for (const key of statKeys) {
      const value = overrides[key];
      if (value !== undefined) stats[key] = value;
    }
  return stats;
}
