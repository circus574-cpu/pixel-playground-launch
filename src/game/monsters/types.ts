import type { WorldId } from "../world/races";

/** How the player's abilities are classified; monster weaknesses and resistances refer to these. */
export type DamageTag = "physical" | "fire" | "ki" | "water" | "area" | "electric" | "stun";

/** Status effects a monster can put on the player. Runtime only: never saved. */
export type FxSpec =
  | { k: "slow"; pct: number; ms: number }
  | { k: "root"; ms: number }
  | { k: "stun"; ms: number }
  | { k: "fear"; ms: number }
  /** Blocks Cięcie, Impuls and Tarcza; basic attack and potion stay available. */
  | { k: "silence"; ms: number }
  /** Damage over time: `atkPct` of the monster's ATK per second per stack. */
  | { k: "dot"; id: "poison" | "burn" | "bleed"; atkPct: number; ms: number; stacks?: number }
  /** Percentage of the player's attacks that miss (deterministic accumulator, no dice). */
  | { k: "blind"; pct: number; ms: number }
  | { k: "fog"; pct: number; ms: number }
  | { k: "jam"; ms: number }
  | { k: "weaken"; pct: number; ms: number }
  | { k: "armorDown"; pct: number; ms: number; stacks?: number }
  /** The player takes `pct` more damage from monsters (`machine` only from Nexus-9 machines). */
  | { k: "mark"; pct: number; ms: number; from?: "any" | "machine" }
  | { k: "breakShield" }
  | { k: "pull"; dist: number };

export type ZoneKind = "fire" | "poison" | "web" | "metal" | "lava" | "sand" | "ash";
export type ZoneSpec = {
  kind: ZoneKind;
  ms: number;
  radius: number;
  /** Damage per second as a fraction of the owner's ATK (0 = none). */
  dps: number;
  fx?: FxSpec[];
};

export type SkillMode =
  /** Needs to be within `range`; hits one target. */
  | "melee"
  /** Hits from `range` after an optional telegraph. */
  | "ranged"
  /** Area damage around the player's position (or the monster, when `self`) after the telegraph. */
  | "burst"
  /** Jump towards the player and hit on arrival. */
  | "leap"
  /** Telegraph, then run in a straight line; a miss exposes the monster. */
  | "charge"
  /** Buffs, summons, heals and calls for help; no direct damage. */
  | "self";

export type SkillSpec = {
  id: string;
  name: string;
  mode: SkillMode;
  cd: number;
  range: number;
  /** Damage as a multiple of the monster's ATK. */
  dmg?: number;
  radius?: number;
  /** Warning shown to the player before the effect lands. */
  telegraph?: number;
  fx?: FxSpec[];
  zone?: ZoneSpec;
  /** Burst centred on the monster itself rather than on the player. */
  centred?: boolean;
  summon?: { kind: string; count: number };
  /** Wake up to this many idle allies within `range`. */
  call?: number;
  /** Heal allies within `range`: fraction of their max HP per second. */
  heal?: { pct: number; ms: number };
  /** Absorb shield equal to this fraction of max HP. */
  guard?: { pct: number; ms: number };
  /** Reduce all incoming damage while active. */
  reduce?: { pct: number; ms: number };
  /** Allies in range deal more damage. */
  buff?: { pct: number; ms: number };
  /** Used at most once per fight. */
  once?: boolean;
  /** Only when HP is below this fraction. */
  below?: number;
  /** Charge only: stun applied to the monster itself after a miss. */
  missStun?: number;
  /** Charge only: DEF reduction (fraction) while exposed after a miss. */
  exposed?: number;
  /** Does not fire if the monster is not facing the player (turrets). */
  aimed?: boolean;
};

export type Traits = {
  /** Never attacks first; angers after being hit and gives up after `giveUp` ms without a hit. */
  provoked?: boolean;
  giveUp?: number;
  /** Maximum distance from home while chasing. */
  leash: number;
  /** Wander radius around home when idle. */
  wander?: number;
  /** Stays this far from the player and backs away when approached. */
  keep?: number;
  /** Never moves. */
  still?: boolean;
  /** Passes through obstacles. */
  ghost?: boolean;
  /** Follows a fixed route (offsets from home) while idle. */
  route?: [number, number][];
  /** Hidden until the player comes within `reveal`; after the first strike hides for `hide` ms. */
  ambush?: { reveal: number; hide: number; opener: number };
  /** Hides underground, surfaces on the player and returns underground for `under` ms (untouchable). */
  burrow?: { under: number; surfaceBonus?: number };
  /** Group size used by `spawnGroup`. */
  pack?: [number, number];
  /** Circle to the flank before striking. */
  flank?: boolean;
  /** After `attacks` hits, retreats for `away` ms. */
  dive?: { attacks: number; away: number };
  /** Retreats (and regenerates, when `hide`) below this HP fraction. */
  retreat?: { below: number; ms: number; hide?: boolean; regen?: boolean };
  /** Splits on the first damage; parts rejoin after `merge` ms when both live. */
  split?: { hpPct: number; merge: number };
  /** Comes back once with this fraction of max HP. */
  revive?: number;
  /** Explodes on death for `atk` × ATK within `radius`. */
  explode?: { atk: number; radius: number; fx?: FxSpec[] };
  /** Leaves this zone where it dies. */
  deathZone?: ZoneSpec;
  /** After `hits` received hits, curls up for `ms` taking `reduce` less physical damage. */
  curl?: { hits: number; ms: number; reduce: number };
  /** Takes this fraction less damage from the front. */
  frontArmor?: number;
  /** Takes this fraction more damage from behind. */
  backBonus?: number;
  /** Reflects this fraction of physical damage (KI ignores it). */
  reflect?: number;
  /** Stronger as HP falls: up to +`dmg` damage at 30%; below `below` HP attacks `speed` faster. */
  rage?: { dmg: number; below: number; speed: number };
  /** Active at night; by day the agro radius is multiplied by `day`. */
  night?: { day: number };
  /** Only attacks if the player is below this fraction of max HP; otherwise circles. */
  opportunist?: number;
  /** Does not attack while any ally within `range` is hurt. */
  medic?: number;
  /** Lays webs within `radius` of home. */
  webs?: { max: number; radius: number; zone: ZoneSpec; slow: number };
  /** Leaves a damaging trail while moving. */
  trail?: ZoneSpec;
  /** Turret cadence: turns `turn` degrees per second, fires `burst` shots, overheats after `shots`. */
  turret?: { turn: number; burst: number; shots: number; off: number };
  /** Below this HP fraction raises a plasma shield. */
  shieldBelow?: number;
  /** Interrupt: damage of this fraction of max HP during a charge stuns it. */
  interrupt?: { pct: number; stun: number };
  /** Retreats after this many hits taken (support units). */
  fleeAfterHits?: { hits: number; ms: number };
  /** Marks a unit as a Nexus-9 machine (for `mark.from = machine`). */
  machine?: boolean;
  /** Uses the next shot with bonus damage after a Namierzenie. */
  scan?: boolean;
  /** Tail breaks after N hits and disables the sting. */
  brittleTail?: number;
  /** Slow outside own webs. */
  webSlow?: number;
  /** Exposed (damage bonus) for this long after attacking with a dive. */
  diveExposed?: number;
};

export type LootEntry = { name: string; chance: number };
export type MonsterDef = {
  id: string;
  world: WorldId;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  /** Multiplier of the base chase speed (0.12 px/ms). */
  speed: number;
  /** Basic attack reach. */
  range: number;
  agro: number;
  /** Basic attack cooldown, ms. */
  attackCd: number;
  /** "ranged" basic attacks hit from `range` instead of needing contact. */
  basic: "melee" | "ranged";
  weak: Partial<Record<DamageTag, number>>;
  traits: Traits;
  skills: SkillSpec[];
  loot: LootEntry[];
  gold: [number, number];
  /** Not one of the 40 bestiary monsters (summons, split parts). */
  minion?: boolean;
};

export type ZoneState = {
  id: string;
  kind: ZoneKind;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  dps: number;
  atk: number;
  owner: string;
  fx: FxSpec[];
  /** True for webs and traps: removed when burned. */
  burnable: boolean;
};

export type MonsterState = {
  def: MonsterDef;
  /** idle | engage | retreat | hidden | under | recover | stunned */
  phase: "idle" | "engage" | "retreat" | "hidden" | "under" | "recover" | "stunned";
  phaseMs: number;
  hidden: boolean;
  /** Untouchable (underground, between revive and rising). */
  invulnerable: boolean;
  facing: { x: number; y: number };
  cooldowns: Record<string, number>;
  used: Set<string>;
  hitsTaken: number;
  attacksMade: number;
  lastHitMs: number;
  provoked: boolean;
  revived: boolean;
  split: boolean;
  parent?: string;
  /** Absorb shield points. */
  guard: number;
  guardMs: number;
  reduce: number;
  reduceMs: number;
  buff: number;
  buffMs: number;
  curlMs: number;
  exposed: number;
  exposedMs: number;
  stunMs: number;
  shots: number;
  heatMs: number;
  /** Pending telegraphed skill. */
  cast?: {
    skill: SkillSpec;
    ms: number;
    total: number;
    at: { x: number; y: number };
    from: { x: number; y: number };
  };
  /** Active charge. */
  charge?: { to: { x: number; y: number }; ms: number; skill: SkillSpec };
  scanned: boolean;
  scanStacks: number;
  tailBroken: boolean;
  trailMs: number;
  webs: string[];
  orbit: number;
  routeIndex: number;
};
