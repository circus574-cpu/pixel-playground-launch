import { BOSS_CATALOG } from "./catalog";
import type { BossDefinition, BossLootDrop } from "./types";
import type { Enemy, MonsterDef, SkillSpec } from "../monsters/types";

/** Combat-only preview values missing from the design catalog; not approved world placement. */
export const BOSS_PREVIEW = { areaRadius: 250, leash: 1200 } as const;
export type BossRuntime = { definition: BossDefinition; phase: number; lootRolled: boolean };
export type BossReward = { itemId: string; itemName: string; quantity: number };
/** Explicit preview translations of named support/charge attacks, never inferred from prose at runtime. */
const attackOverrides: Record<string, Partial<SkillSpec>> = {
  "ygdrasha-szlamaki": {
    mode: "self",
    dmg: 0,
    summon: { kind: "verdant-mchowy-szlamak", count: 2 },
  },
  "thorgar-szarza": { mode: "charge", missStun: 1500 },
  "thorgar-rozdarcie": { fx: [{ k: "dot", id: "bleed", atkPct: 0.1, ms: 5000 }] },
  "thorgar-wycie": {
    summon: { kind: "verdant-cierniowy-wilk", count: 3 },
    mode: "self",
    dmg: 0,
    once: true,
  },
  "arbiter-salwa": { volley: 3 },
  "arbiter-tarcza": { mode: "self", dmg: 0, guard: { pct: 0.15, ms: 5000 } },
  "hydra-nanity": { mode: "self", dmg: 0, summon: { kind: "nexus-roj-nanitow", count: 1 } },
  "kharzul-przelamanie": { fx: [{ k: "breakShield" }] },
  "kharzul-szal": { mode: "self", dmg: 0, buff: { pct: 0.2, ms: 6000 }, range: 0 },
};
export function bossDefinition(id: string) {
  const def = BOSS_CATALOG.find((b) => b.id === id);
  if (!def) throw Error("Nieznany boss: " + id);
  return def;
}
export function bossMonster(def: BossDefinition): MonsterDef {
  return {
    id: "boss:" + def.id,
    world: def.continent,
    name: def.name,
    level: def.level,
    hp: def.stats.hp,
    atk: def.stats.atk,
    def: def.stats.def,
    xp: def.stats.xp,
    speed: def.speed,
    range: def.range,
    agro: def.agro,
    attackCd: 1000,
    basic: "none",
    weak: {},
    traits: { leash: BOSS_PREVIEW.leash, ...(def.speed === 0 ? { still: true } : {}) },
    skills: def.attacks.map((a) => ({
      id: a.id,
      name: a.name,
      cd: a.cooldownSeconds * 1000,
      telegraph: (a.telegraphSeconds ?? 0) * 1000,
      mode: a.isAoe ? "burst" : def.range > 150 ? "ranged" : "melee",
      range: Math.max(def.range, def.agro),
      dmg: a.damageMultiplier,
      ...(a.isAoe ? { radius: BOSS_PREVIEW.areaRadius } : {}),
      ...attackOverrides[a.id],
    })),
    loot: [],
    gold: [0, 0],
    respawn: 0,
    minion: true,
  };
}
/** Monotonic phases, including skipping multiple thresholds in one hit. */
export function updateBossPhase(enemy: Enemy): boolean {
  const boss = enemy.boss;
  if (!boss || enemy.hp <= 0) return false;
  const fraction = (enemy.hp / enemy.maxHp) * 100;
  const phase =
    [...boss.definition.phases]
      .sort((a, b) => b.hpThresholdPercent - a.hpThresholdPercent)
      .filter((p) => fraction <= p.hpThresholdPercent)
      .at(-1) ?? boss.definition.phases[0]!;
  if (phase.phaseNumber <= boss.phase) return false;
  boss.phase = phase.phaseNumber;
  const base = bossMonster(boss.definition),
    mods = phase.statModifiers;
  enemy.m.def = {
    ...base,
    atk: base.atk * (mods?.atkMultiplier ?? 1),
    speed: base.speed * (mods?.speedMultiplier ?? 1),
    skills: base.skills.filter((s) => phase.unlockedAttacks.includes(s.id)),
  };
  if (enemy.m.cast && !phase.unlockedAttacks.includes(enemy.m.cast.skill.id))
    enemy.m.cast = undefined;
  return true;
}
export function bossDamageMultiplier(enemy: Enemy) {
  return (
    enemy.boss?.definition.phases.find((p) => p.phaseNumber === enemy.boss!.phase)?.statModifiers
      ?.damageTakenMultiplier ?? 1
  );
}
export function rollBossLoot(table: BossLootDrop[], random: () => number): BossReward[] {
  return table
    .filter((d) => random() * 100 < d.chancePercent)
    .map((d) => ({
      itemId: d.itemId,
      itemName: d.itemName,
      quantity: d.minCount + Math.floor(random() * (d.maxCount - d.minCount + 1)),
    }));
}
export { bossPreviewEnabled } from "./preview";
