import { monsterDef, MONSTER_DEFS } from "../../monsters/catalog";
import type { MonsterDef } from "../../monsters/types";
import { RACES, type RaceId } from "../../world/races";

export const EXPEDITION_LEVELS = [22, 28, 34, 40] as const;
export const EXPEDITION_LAYOUTS = ["single", "pair", "protection"] as const;
export type ExpeditionLevel = (typeof EXPEDITION_LEVELS)[number];
export type ExpeditionLayout = (typeof EXPEDITION_LAYOUTS)[number];
type Role = "fast" | "ranged" | "heavy";
/** Exact existing IDs; no canonical species definition is overwritten. Owner source §10.2. */
export const DEVELOPMENT_ARCHETYPES = [
  { race: "planetary", species: "verdant-straznik-ruin", role: "heavy" },
  { race: "planetary", species: "verdant-lesny-pajak", role: "ranged" },
  { race: "sage", species: "aether-lew-swiatyni", role: "heavy" },
  { race: "sage", species: "aether-marionetka-rytualu", role: "ranged" },
  { race: "android", species: "nexus-straznik-rdzenia", role: "heavy" },
  { race: "android", species: "nexus-pies-lowca", role: "fast" },
  { race: "legend", species: "pyra-golem-ruin", role: "heavy" },
  { race: "legend", species: "pyra-byk-areny", role: "fast" },
] as const satisfies readonly { race: RaceId; species: string; role: Role }[];
const FACTORS: Record<Role, readonly [number, number, number, number]> = {
  fast: [0.75, 0.9, 0.85, 800],
  ranged: [0.9, 1, 1, 1100],
  heavy: [1.6, 1.15, 1.3, 1500],
};
export const DEVELOPMENT_ENCOUNTERS = DEVELOPMENT_ARCHETYPES.flatMap((a) =>
  EXPEDITION_LEVELS.map((level) => {
    const [hp, atk, def, attackCd] = FACTORS[a.role];
    const source = MONSTER_DEFS[a.species];
    if (!source || source.world !== RACES[a.race].world)
      throw Error("Unknown development archetype: " + a.species);
    return {
      id: `${a.species}@${level}`,
      race: a.race,
      species: a.species,
      world: source.world,
      name: `${source.name} · poziom ${level}`,
      role: a.role,
      level,
      hp: Math.round((180 + 42 * level) * hp),
      atk: Math.round((12 + 3.2 * level) * atk),
      def: Math.round((5 + 1.3 * level) * def),
      xp: Math.round((100 + 60 * (level - 1)) * 0.08),
      attackCd,
    };
  }),
);
export const DEVELOPMENT_ENCOUNTER_BY_ID = new Map(DEVELOPMENT_ENCOUNTERS.map((d) => [d.id, d]));
export type DevelopmentEncounter = (typeof DEVELOPMENT_ENCOUNTERS)[number];
export const EXPEDITIONS = (Object.keys(RACES) as RaceId[]).flatMap((race) =>
  EXPEDITION_LEVELS.flatMap((level) =>
    EXPEDITION_LAYOUTS.map((layout) => ({
      id: `E-${RACES[race].world}-${level}-${layout}`,
      race,
      world: RACES[race].world,
      level,
      layout,
      name: `Wyprawa ${level} · ${layout === "single" ? "samotny strażnik" : layout === "pair" ? "para przeciwników" : "ochrona punktu"}`,
      prerequisite: `H-${{ planetary: "V", sage: "A", android: "N", legend: "P" }[race]}0${level < 34 ? 4 : 5}`,
    })),
  ),
);
export const EXPEDITION_BY_ID = new Map(EXPEDITIONS.map((d) => [d.id, d]));
export type ExpeditionDefinition = (typeof EXPEDITIONS)[number];
/** A per-encounter copy with inherited real AI/weaknesses, no loot or ordinary spawn timer. */
export function developmentMonster(d: DevelopmentEncounter): MonsterDef {
  const base = monsterDef(d.species);
  return {
    ...base,
    name: d.name,
    level: d.level,
    hp: d.hp,
    atk: d.atk,
    def: d.def,
    xp: d.xp,
    attackCd: d.attackCd,
    traits: structuredClone(base.traits),
    skills: structuredClone(base.skills),
    weak: { ...base.weak },
    loot: [],
    gold: [0, 0],
    respawn: 0,
  };
}
