import type { Point } from "../navigation";
import type { WorldId } from "../world/races";

/** How the player's abilities are classified; monster weaknesses and resistances refer to these. */
export type DamageTag = "physical" | "fire" | "ki" | "water" | "area" | "electric" | "stun";

/** Status effects a monster can put on the player. Runtime only: never saved. */
export type FxSpec =
  | { k: "slow"; pct: number; ms: number }
  | { k: "root"; ms: number }
  | { k: "stun"; ms: number }
  | { k: "fear"; ms: number }
  /** Blocks every active ability; basic attack and potion stay available. */
  | { k: "silence"; ms: number }
  /** Damage over time: `atkPct` of the monster's ATK per second per stack. */
  | { k: "dot"; id: "poison" | "burn" | "bleed"; atkPct: number; ms: number; stacks?: number }
  /** Percentage of the player's attacks that miss (deterministic accumulator, no dice). */
  | { k: "blind"; pct: number; ms: number }
  | { k: "fog"; pct: number; ms: number }
  | { k: "jam"; ms: number }
  | { k: "weaken"; pct: number; ms: number }
  | { k: "armorDown"; pct: number; ms: number; stacks?: number }
  /** The player takes `pct` more damage from monsters (`machine`: only from Nexus-9 machines). */
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

export type SkillMode = "melee" | "ranged" | "burst" | "leap" | "charge" | "self";

export type SkillSpec = {
  id: string;
  name: string;
  mode: SkillMode;
  cd: number;
  /** Distance to the player at which the monster may start it. */
  range: number;
  /** Damage as a multiple of the monster's ATK. */
  dmg?: number;
  radius?: number;
  /** Warning shown to the player before the effect lands. */
  telegraph?: number;
  /** Several equal hits in a row (damage applies to each). */
  volley?: number;
  fx?: FxSpec[];
  zone?: ZoneSpec;
  /** The burst is centred on the monster instead of the player's position. */
  centred?: boolean;
  summon?: { kind: string; count: number };
  /** Wakes up to this many idle monsters within 600 j. */
  call?: number;
  /** Allies within `range` regenerate this fraction of max HP per second. */
  heal?: { pct: number; ms: number };
  /** Absorb shield equal to this fraction of max HP. */
  guard?: { pct: number; ms: number };
  /** Reduces all damage taken while active. */
  reduce?: { pct: number; ms: number };
  /** Allies within `range` deal more damage. */
  buff?: { pct: number; ms: number };
  /** Used at most once per fight. */
  once?: boolean;
  /** Only when HP is below this fraction. */
  below?: number;
  /** Only the first attack out of hiding; deals extra damage. */
  opener?: number;
  /** Charge: stun applied to the monster after a miss. */
  missStun?: number;
  /** Charge: DEF reduction (fraction) while exposed after a miss. */
  exposed?: number;
  /** Fires only when the monster faces the player (turrets). */
  aimed?: boolean;
  /** Self buff: the next attack deals this fraction more (Namierzenie). */
  nextAttack?: number;
  /** Needs the player not to be hit by anything else first: marks only. */
  markOnly?: boolean;
};

export type Traits = {
  /** Never attacks first; angers after being hit and gives up after `giveUp` ms without a hit. */
  provoked?: boolean;
  giveUp?: number;
  /** Maximum distance from home while chasing. */
  leash: number;
  /** Wander radius around home when idle. */
  wander?: number;
  /** Preferred distance: backs away when the player is closer. */
  keep?: number;
  /** Never moves. */
  still?: boolean;
  /** Passes through obstacles. */
  ghost?: boolean;
  /** Follows a fixed route (offsets from home) while idle. */
  route?: [number, number][];
  /** Hidden until the player comes within `reveal`; after striking hides for `hide` ms. */
  ambush?: { reveal: number; hide: number };
  /** Hides underground, surfaces next to the player and goes back for `under` ms (untouchable). */
  burrow?: { under: number; up: number; bonus?: number; root?: number };
  /** Group size used by `spawnGroup`. */
  pack?: [number, number];
  /** Circles to the flank before striking. */
  flank?: boolean;
  /** After `attacks` hits, retreats for `away` ms. */
  dive?: { attacks: number; away: number };
  /** Retreats below this HP fraction; `hide` makes it untouchable while it regenerates. */
  retreat?: { below: number; ms: number; hide?: boolean; regen?: number };
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
  /** Stronger as HP falls: up to +`dmg` damage at 30% HP; below `below` attacks `speed` faster. */
  rage?: { dmg: number; below: number; speed: number };
  /** Active at night; by day the agro radius is multiplied by `day`. */
  night?: { day: number };
  /** Only attacks if the player is below this fraction of max HP; otherwise circles. */
  opportunist?: number;
  /** Does not attack while any hurt ally is within this range. */
  medic?: number;
  /** Lays webs within `radius` of home. */
  webs?: { max: number; radius: number; zone: ZoneSpec };
  /** Leaves a damaging trail while moving. */
  trail?: ZoneSpec;
  /** Turret: turns `turn` degrees per second, overheats after `shots`, switched off for `off` ms. */
  turret?: { turn: number; shots: number; off: number };
  /** Interrupt: damage of this fraction of max HP during a cast stuns it. */
  interrupt?: { pct: number; stun: number };
  /** Retreats after this many hits taken. */
  fleeAfterHits?: { hits: number; ms: number };
  /** Marks a unit as a Nexus-9 machine (for `mark.from = machine`). */
  machine?: boolean;
  /** Tail breaks after N hits and disables the sting. */
  brittleTail?: number;
  /** Slow outside own webs. */
  webSlow?: number;
  /** Extra damage taken while recovering after a dive/charge/turret overheating. */
  exposedBonus?: number;
  /** Flies: ignores obstacles on the ground. */
  fly?: boolean;
  /** Stays in place (guard): leash is the radius it defends. */
  guard?: boolean;
  /** Does not heal when it returns home (default heals). */
  noRegen?: boolean;
  /** Attacks only when the player is within this angle of its facing (turrets), degrees. */
  arc?: number;
  /** Consecutive basic hits add this fraction to the next hit (max 4 stacks). */
  ramp?: number;
  /** Below this HP fraction its speed is multiplied by `mult`. */
  slowBelow?: { hp: number; mult: number };
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
  /** "ranged" basic attacks hit from `range` instead of needing contact; "none" disables them. */
  basic: "melee" | "ranged" | "none";
  /** Effects the basic attack puts on the player. */
  basicFx?: FxSpec[];
  /** Multiplier of damage from ranged player attacks. */
  weakRanged?: number;
  weak: Partial<Record<DamageTag, number>>;
  traits: Traits;
  skills: SkillSpec[];
  loot: LootEntry[];
  gold: [number, number];
  /** Respawn delay after death, ms. */
  respawn: number;
  /** Not one of the 40 bestiary monsters (summons, split parts, the legacy boar). */
  minion?: boolean;
};

export type ZoneState = {
  id: string;
  kind: ZoneKind;
  x: number;
  y: number;
  radius: number;
  ms: number;
  dps: number;
  atk: number;
  owner: string;
  machine: boolean;
  fx: FxSpec[];
  /** Time until the zone applies its effects again. */
  fxMs: number;
};

export type Phase = "idle" | "engage" | "retreat" | "hidden" | "under" | "recover" | "return";

/** Status effects the player's abilities put on a monster. */
export type FoeFx = {
  stunMs: number;
  slow: { pct: number; ms: number };
  weaken: { pct: number; ms: number };
  dots: { dps: number; ms: number }[];
  seal: { ms: number; bonus: number } | null;
  mark: { ms: number; crit: number; def: number } | null;
};

export type MonsterState = {
  def: MonsterDef;
  phase: Phase;
  phaseMs: number;
  /** Not drawn and not targetable. */
  hidden: boolean;
  /** Takes no damage (underground, regenerating, reviving). */
  invulnerable: boolean;
  facing: Point;
  cooldowns: Record<string, number>;
  used: Set<string>;
  hitsTaken: number;
  attacksMade: number;
  sinceHit: number;
  provoked: boolean;
  engaged: boolean;
  revived: boolean;
  split: boolean;
  parent: string | undefined;
  /** Absorb shield points. */
  guard: number;
  guardMs: number;
  reduce: number;
  reduceMs: number;
  buff: number;
  buffMs: number;
  regen: number;
  regenMs: number;
  curlMs: number;
  curlHits: number;
  exposed: number;
  exposedMs: number;
  stunMs: number;
  shots: number;
  heatMs: number;
  /** Damage taken since the cast began (interrupts). */
  castDamage: number;
  cast: { skill: SkillSpec; ms: number; at: Point; opener: boolean } | undefined;
  charge: { to: Point; skill: SkillSpec; hit: boolean } | undefined;
  volley: { skill: SkillSpec; left: number; next: number; opener: boolean } | undefined;
  scanStacks: number;
  scanReady: boolean;
  tailHits: number;
  tailBroken: boolean;
  trailMs: number;
  webs: string[];
  orbit: number;
  routeIndex: number;
  aim: number;
  nextWander: number;
  attackCount: number;
  nextAttack: number;
  /** Basic swing commits aim before contact; cooldown is paid at wind-up start. */
  basicWindup?: { ms: number; aim: Point; extra: number } | undefined;
  recoveryMs?: number;
  spawnedAt: number;
};

export type Enemy = Point & {
  boss?: import("../bosses/runtime").BossRuntime;
  /** Outside the deterministic AI budget; no actions are executed. */
  sleeping?: boolean;
  id: string;
  /** Monster definition id. */
  kind: string;
  home: Point;
  hp: number;
  maxHp: number;
  mode: "patrol" | "chase" | "return" | "dead";
  timer: number;
  attackIn: number;
  patrol: Point;
  m: MonsterState;
  fx: FoeFx;
};
