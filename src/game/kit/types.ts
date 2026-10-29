import type { CombatTraining } from "../combatTraining";
import type { CharacterStats } from "../characterStats";
import type { DevelopmentState } from "../development/state";
import type { Point } from "../navigation";
import type { DamageTag } from "../monsters/types";

export type NodeType = "starting" | "active" | "passive" | "choice" | "ultimate" | "ki-mode";
export type RaceBase = {
  hp: number;
  ki: number;
  attack: number;
  defense: number;
  speed: number;
  kiRegen: number;
  criticalChancePercent: number;
  attackIntervalMs: number;
};
export type KitNodeData = {
  id: string;
  name: string;
  type: NodeType;
  minLevel: number;
  /** Any one of these is enough. Empty for the root. */
  requires: string[];
  excludes?: string;
  /** Design text from the owner annex. */
  text: string;
};

/** A learned active ability as the HUD sees it. */
export type AbilityInfo = {
  id: string;
  name: string;
  type: NodeType;
  ki: number;
  cd: number;
  remaining: number;
  /** Basic attack and channelled abilities show different affordances. */
  channel: boolean;
  /** Short key label for the hotbar (1–9, 0). */
  key: string;
  ready: boolean;
  reason: string;
};

export type FinalStats = {
  dodgeChance: number;
  technique: number;
  attackSpeedPct: number;
  maxHp: number;
  maxKi: number;
  attack: number;
  defense: number;
  speed: number;
  kiRegen: number;
  crit: number;
  attackInterval: number;
  /** Damage dealt multiplier from buffs (separate from attack). */
  dealt: number;
  /** Ability cooldown multiplier. */
  cooldownMul: number;
  /** Ability Ki cost multiplier. */
  kiCostMul: number;
  /** Duration multiplier for control effects on the player. */
  ccMul: number;
  range: number;
};

/** Racial resource bar shown by the HUD (Ładunek Rdzenia, Żar). */
export type ResourceInfo = {
  label: string;
  value: number;
  max: number;
  state: "" | "overheat" | "full";
};

export type Timed<T> = T & { ms: number };
export type Buff = Timed<{
  id: string;
  dodgeAdd?: number | undefined;
  techniqueAdd?: number | undefined;
  attackSpeedPct?: number | undefined;
  atkPct?: number | undefined;
  defPct?: number | undefined;
  speedPct?: number | undefined;
  dealtPct?: number | undefined;
  intervalPct?: number | undefined;
  noKi?: boolean | undefined;
  ccImmune?: boolean | undefined;
  stunImmune?: boolean | undefined;
  invulnerable?: boolean | undefined;
  /** Next hit bonus consumed on the next basic/active hit. */
  nextHitPct?: number | undefined;
  guaranteedCrit?: boolean | undefined;
  cooldownPct?: number | undefined;
  /** The first lethal hit leaves 1 HP and heals (Ostatni Płomień). */
  lethal?: boolean | undefined;
}>;
export type Shield = Timed<{
  id: string;
  amount: number;
  max: number;
  reflectMelee?: number | undefined;
  reflectProjectile?: number | undefined;
  mirror?: boolean | undefined;
}>;

/** What a kit may ask of the session. Implemented by `GameSession`. */
export type Hit = {
  tags: DamageTag[];
  melee?: boolean;
  ranged?: boolean;
  /** Set by the kit when the hit was a critical (display only; the kit already scaled the damage). */
  crit?: boolean;
  /** Reflected or periodic damage: never triggers on-hit effects. */
  indirect?: boolean;
  /** Ability the damage belongs to, for events. */
  ability?: string;
};
export type Foe = Point & {
  id: string;
  hp: number;
  maxHp: number;
};
export type KitPort = {
  readonly nowMs: number;
  readonly development?: DevelopmentState | undefined;
  /** Equipment bonuses (weapon ATK incl. upgrade, armor DEF). */
  readonly gear: {
    attack: number;
    defense: number;
    dodgeChance?: number;
    technique?: number;
    attackSpeedPct?: number;
  };
  readonly inCombat: boolean;
  terrain(): "forest" | "rock" | "water" | "open";
  readonly player: {
    x: number;
    y: number;
    level: number;
    hp: number;
    ki: number;
    statOverrides?: CharacterStats | undefined;
    combatTraining?: CombatTraining | undefined;
  };
  readonly facing: Point;
  random(): number;
  say(text: string): void;
  foesIn(center: Point, radius: number): Foe[];
  target(): Foe | undefined;
  visible(a: Point, b: Point): boolean;
  /** Deal damage to a foe. `raw` is the already multiplied attack; defense is applied by the session. */
  hurtFoe(foe: Foe, raw: number, hit: Hit): number;
  /** Status effects on foes. */
  stunFoe(foe: Foe, ms: number): void;
  slowFoe(foe: Foe, pct: number, ms: number): void;
  burnFoe(foe: Foe, dps: number, ms: number): void;
  sealFoe(foe: Foe, ms: number, bonusPct: number): void;
  markFoe(foe: Foe, ms: number, critPct: number, defPct: number): void;
  pushFoe(foe: Foe, from: Point, distance: number): void;
  weakenFoe(foe: Foe, pct: number, ms: number): void;
  breakFoeShield(foe: Foe): void;
  isSealed(foe: Foe): boolean;
  isMarked(foe: Foe): boolean;
  foeHpFraction(foe: Foe): number;
  /** Move the player towards `to` by up to `distance`, stopping at obstacles; returns the new position. */
  dash(to: Point, distance: number): Point;
  emit(event: {
    type: "attack" | "hit" | "heal" | "shield" | "circle" | "buff" | "channel" | "burst";
    x: number;
    y: number;
    ability?: string;
    text?: string;
    to?: Point;
    radius?: number;
    ms?: number;
  }): void;
  /** Called by kits to heal / restore. The session clamps to maximums. */
  heal(amount: number): void;
  addKi(amount: number): void;
};
