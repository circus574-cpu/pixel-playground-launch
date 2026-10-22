import { z } from "zod";
import { type RaceId, RACE_IDS } from "../world/races";
import { NODES, TREES, skillId, isCastable, type SkillNode } from "./catalog";

export const PROGRESSION_CAP = 20;
export const ProgressionSchema = z
  .object({
    version: z.literal(1),
    learned: z.array(z.string().max(40)).min(1).max(26),
    loadout: z.array(z.string().max(40).nullable()).length(4),
    cooldowns: z.record(z.number().finite().min(0).max(120000)),
    resource: z.number().finite().min(0).max(150),
    overheat: z.number().finite().min(0).max(2000),
    shutdown: z.number().finite().min(0).max(8000).default(0),
    buffs: z
      .record(
        z.object({
          left: z.number().finite().min(0).max(20000),
          value: z.number().finite().min(0).max(1000000),
        }),
      )
      .default({}),
    barrier: z
      .object({
        left: z.number().finite().min(0).max(6000),
        hp: z.number().finite().min(0).max(10000),
        melee: z.number().min(0).max(1),
        projectile: z.number().min(0).max(1),
        mirror: z.boolean(),
      })
      .optional(),
  })
  .strict();
export type Progression = z.infer<typeof ProgressionSchema>;
export const newProgression = (race: RaceId): Progression => ({
  version: 1,
  learned: [skillId(race, "R")],
  loadout: [null, null, null, null],
  cooldowns: {},
  resource: 0,
  overheat: 0,
  shutdown: 0,
  buffs: {},
});
export const availablePoints = (level: number, p: Progression) =>
  Math.min(PROGRESSION_CAP, level) - p.learned.length;
export function learnReason(race: RaceId, level: number, p: Progression, id: string): string {
  const n = NODES[id];
  if (!n || n.race !== race) return "To umiejętność innej rasy.";
  if (p.learned.includes(id)) return "Umiejętność już poznana.";
  if (n.excludes && p.learned.includes(n.excludes)) return "Wybrano przeciwne ulepszenie.";
  if (level < n.level) return `Wymagany poziom ${n.level}.`;
  if (!n.requires.some((r) => p.learned.includes(r))) return "Najpierw poznaj wymagany poprzednik.";
  if (availablePoints(level, p) <= 0) return "Brak wolnych punktów.";
  return "";
}
export function validateProgression(race: RaceId, level: number, p: Progression): boolean {
  const known = new Set(p.learned);
  if (
    known.size !== p.learned.length ||
    !known.has(skillId(race, "R")) ||
    availablePoints(level, p) < 0
  )
    return false;
  for (const id of known) {
    const n = NODES[id];
    if (
      !n ||
      n.race !== race ||
      n.level > level ||
      (n.excludes && known.has(n.excludes)) ||
      (n.requires.length > 0 && !n.requires.some((r) => known.has(r)))
    )
      return false;
  }
  const equipped = p.loadout.filter((id): id is string => id !== null);
  if (new Set(equipped).size !== equipped.length) return false;
  if (
    !p.loadout.every((id) => {
      if (id === null) return true;
      const n = NODES[id];
      return n && known.has(id) && (n.kind === "ultimate" || n.kind === "active");
    })
  )
    return false;
  return Object.keys(p.cooldowns).every((id) => NODES[id]?.race === race && isCastable(NODES[id]!));
}
export function equipSkill(p: Progression, id: string, slot: number): boolean {
  const n = NODES[id];
  if (
    !n ||
    !p.learned.includes(id) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot > 3 ||
    (n.kind !== "ultimate" && n.kind !== "active")
  )
    return false;
  const previous = p.loadout.indexOf(id);
  if (previous !== -1) p.loadout[previous] = null;
  p.loadout[slot] = id;
  return true;
}
export function learnSkill(race: RaceId, level: number, p: Progression, id: string): boolean {
  if (learnReason(race, level, p, id)) return false;
  p.learned.push(id);
  const n = NODES[id]!;
  const slot = n.kind === "ultimate" || n.kind === "active" ? p.loadout.indexOf(null) : -1;
  if (slot !== -1) equipSkill(p, id, slot);
  return true;
}
export function resetSkills(race: RaceId, p: Progression) {
  p.learned = [skillId(race, "R")];
  p.loadout = [null, null, null, null];
  // Cooldowns intentionally survive resetting and swapping skills.
}
export function graphErrors(): string[] {
  const errors: string[] = [];
  for (const race of RACE_IDS) {
    const tree = TREES[race];
    if (tree.length !== 29) errors.push(`${race}: expected 29 nodes`);
    for (const n of tree) {
      for (const r of n.requires)
        if (!NODES[r] || NODES[r]!.race !== race || NODES[r]!.level >= n.level)
          errors.push(`${n.id}: invalid predecessor ${r}`);
      if (n.excludes && NODES[n.excludes]?.excludes !== n.id)
        errors.push(`${n.id}: asymmetric exclusion`);
    }
  }
  return errors;
}

type StatLine = {
  hp: number;
  ki: number;
  attack: number;
  defense: number;
  speed: number;
  regen: number;
  crit: number;
  interval: number;
};
export const BASE_STATS: Record<RaceId, StatLine> = {
  planetary: {
    hp: 125,
    ki: 50,
    attack: 12,
    defense: 5,
    speed: 185,
    regen: 1,
    crit: 5,
    interval: 650,
  },
  sage: { hp: 100, ki: 80, attack: 14, defense: 3, speed: 170, regen: 2, crit: 5, interval: 800 },
  android: {
    hp: 115,
    ki: 60,
    attack: 12,
    defense: 7,
    speed: 175,
    regen: 1.2,
    crit: 8,
    interval: 700,
  },
  legend: {
    hp: 140,
    ki: 40,
    attack: 14,
    defense: 4,
    speed: 170,
    regen: 0.8,
    crit: 6,
    interval: 750,
  },
};
export const GROWTH: Record<
  RaceId,
  Pick<StatLine, "hp" | "ki" | "attack" | "defense" | "regen" | "crit">
> = {
  planetary: { hp: 36, ki: 4, attack: 4, defense: 2.4, regen: 0.05, crit: 0.25 },
  sage: { hp: 28, ki: 7, attack: 4.6, defense: 1.6, regen: 0.1, crit: 0.2 },
  android: { hp: 34, ki: 5, attack: 3.8, defense: 3, regen: 0.06, crit: 0.4 },
  legend: { hp: 42, ki: 3, attack: 4.6, defense: 2, regen: 0.04, crit: 0.3 },
};
export function raceStats(
  race: RaceId,
  level: number,
  progression?: Progression,
  weapon = 0,
  armor = 0,
) {
  const b = BASE_STATS[race],
    g = GROWTH[race],
    l = Math.max(0, Math.min(20, level) - 1);
  const has = (code: string) => progression?.learned.includes(skillId(race, code)) ?? false;
  const hpBonus = (race === "planetary" && has("C2")) || (race === "legend" && has("B3")) ? 0.1 : 0;
  const kiBonus = race === "sage" && has("C2") ? 0.15 : race === "android" && has("C5") ? 0.12 : 0;
  const defBonus =
    (race === "planetary" && has("B3")) || ((race === "android" || race === "legend") && has("B2"))
      ? 0.08
      : 0;
  return {
    maxHp: Math.round((b.hp + g.hp * l) * (1 + hpBonus)),
    maxKi: Math.round((b.ki + g.ki * l) * (1 + kiBonus)),
    attack: Math.round(
      (Math.round(b.attack + g.attack * l) + weapon) * (race === "legend" && has("A5") ? 1.08 : 1),
    ),
    defense: Math.round((Math.round(b.defense + g.defense * l) + armor) * (1 + defBonus)),
    speed: b.speed * (race === "planetary" && has("A2") ? 1.06 : 1),
    kiRegen: b.regen + g.regen * l,
    crit: Math.min(
      100,
      b.crit +
        g.crit * l +
        (has(race === "android" ? "A2" : "A6")
          ? { planetary: 5, sage: 8, android: 6, legend: 6 }[race]
          : 0),
    ),
    interval:
      b.interval *
      (race === "android" && has("A6") ? 0.92 : 1) *
      (race === "android" && has("A7") ? 1.1 : 1),
    range: race === "sage" ? 420 : race === "android" ? 360 * (has("A3") ? 1.15 : 1) : 78,
  };
}
/** Defense is charged proportionally to a hit's share of the total cast. */
export function raceDamage(
  attack: number,
  multiplier: number,
  defense: number,
  share = 1,
  critical = false,
): number {
  return Math.max(1 * share, (attack * multiplier - defense * 0.5 * share) * (critical ? 1.5 : 1));
}
export function skillCost(n: SkillNode, p: Progression, free: boolean) {
  if (free && n.kind !== "form") return 0;
  return (
    n.cost *
    (n.race === "sage" && p.learned.includes("sage.C3") ? 0.92 : 1) *
    (n.id === "android.C1" && p.learned.includes("android.C6") ? 0.8 : 1)
  );
}
