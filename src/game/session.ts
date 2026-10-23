import { z } from "zod";
import { WORLDS, worldObstacles } from "./world/worlds";
import { RACES, RACE_IDS, WORLD_IDS, type RaceId } from "./world/races";
import type { WorldDefinition } from "./world/types";
import { terrainAt } from "./world/terrain";
import { Navigation, distance, type Point } from "./navigation";
import {
  KIT_NODES,
  canLearn,
  createKit,
  freePoints,
  validLearned,
  type AbilityInfo,
  type Foe,
  type Hit,
  type Kit,
  type KitPort,
  type ResourceInfo,
} from "./kit";
import { MATERIALS, MATERIAL_IDS, isMaterial } from "./monsters/materials";
import {
  MonsterSystem,
  type HurtKind,
  type MonsterEvent,
  type MonsterHost,
} from "./monsters/system";
import { PlayerFx } from "./monsters/fx";
import type { Enemy, FxSpec, ZoneState } from "./monsters/types";

export type { Enemy } from "./monsters/types";
export { MATERIALS, MATERIAL_IDS } from "./monsters/materials";

export const ITEMS = {
  potion: {
    name: "Mikstura życia",
    type: "consumable",
    icon: 4,
    attack: 0,
    defense: 0,
    price: 8,
    sell: 3,
  },
  tusk: { name: "Kieł dzika", type: "material", icon: 8, attack: 0, defense: 0, price: 0, sell: 5 },
  sword: {
    name: "Ostrze strażnika",
    type: "weapon",
    icon: 2,
    attack: 8,
    defense: 0,
    price: 40,
    sell: 18,
  },
  vest: {
    name: "Kamizelka podróżnika",
    type: "armor",
    icon: 3,
    attack: 0,
    defense: 3,
    price: 25,
    sell: 10,
  },
} as const;
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const BAG_CAPACITY = 12;
/** Distinct loot materials the bag can hold (each stack up to 99). */
export const MATERIAL_CAPACITY = 30;
/** A basic attack ("R"), a skill-tree node id ("A1", "T", …) or the potion. */
export type Ability = string;
export const POTION = { cooldown: 6000, heal: 0.4 };
export type QuestId = "steps" | "boars" | "gear";
export const QUEST_NAMES: Record<QuestId, string> = {
  steps: "Pierwsze kroki",
  boars: "Zagrożenie w lesie",
  gear: "Pierwsze wyposażenie",
};
/** Baseline out-of-combat regeneration (fraction of max HP per second); Leśna Cierpliwość adds to it. */
export const BASE_HP_REGEN = 0.003;
const status = z.enum(["locked", "active", "ready", "done"]);
const finite = (max: number) => z.number().finite().min(0).max(max);
const itemSchema = z.enum(["potion", "tusk", "sword", "vest"]);
const PlayerSchema = z.object({
  race: z.enum(RACE_IDS),
  continent: z.enum(WORLD_IDS),
  startContinent: z.enum(WORLD_IDS),
  level: z.number().int().min(1).max(100),
  xp: finite(1000000).int(),
  hp: finite(100000),
  ki: finite(100000),
  gold: finite(1000000).int(),
  x: finite(8192),
  y: finite(6144),
  /** Open-world layout revision the position belongs to; older saves are shifted on load. */
  layout: z.number().int().min(1).max(99).optional(),
  items: z.object({
    potion: finite(99).int(),
    tusk: finite(99).int(),
    sword: finite(99).int(),
    vest: finite(99).int(),
  }),
  weapon: z.literal("sword").nullable(),
  armor: z.literal("vest").nullable(),
  upgrade: z.number().int().min(0).max(1),
  quests: z.object({ steps: status, boars: status, gear: status }),
  visited: z.boolean(),
  kills: z.number().int().min(0).max(3),
  dead: z.boolean(),
  /** Skill-tree nodes learned (the root "R" is always among them). */
  skills: z.array(z.string().max(4)).max(30).default(["R"]),
  /** Loot materials by id. */
  materials: z.record(z.string().max(60), finite(99).int()).default({}),
  /** How many times the skill tree was reset. */
  respecs: z.number().int().min(0).max(100000).default(0),
});
export type Player = z.infer<typeof PlayerSchema>;
export type NpcId = "guide" | "hunter" | "merchant" | "smith";
export const NPCS = WORLDS.verdant.npcs;
export type Loot = Point & { id: string; item: string; quantity: number; gold: number };
export type GameEventType =
  | "hit"
  | "attack"
  | "death"
  | "respawn"
  | "level"
  | "loot"
  | "shield"
  | "heal"
  | "circle"
  | "buff"
  | "channel"
  | "burst"
  | "telegraph"
  | "zone"
  | "status";
export type GameEvent = Point & {
  type: GameEventType;
  text?: string;
  target?: string;
  source?: string;
  ability?: string;
  to?: Point;
  radius?: number;
  ms?: number;
  kind?: string;
  crit?: boolean;
};
export type Command =
  | { type: "move"; x: number; y: number }
  | { type: "target"; id: string }
  | { type: "ability"; ability: Ability }
  | { type: "interact"; npc: NpcId }
  | { type: "dialogue"; action: "close" | "accept" | "claim" | "upgrade" }
  | { type: "equip"; item: ItemId }
  | { type: "unequip"; slot: "weapon" | "armor" }
  | { type: "trade"; item: string; buy: boolean }
  | { type: "loot"; id: string }
  | { type: "learn"; node: string }
  | { type: "respec" }
  | { type: "pause"; value: boolean }
  | { type: "cancel" };
export const xpNeeded = (level: number) => 100 + (level - 1) * 60;

const noop = () => {};
/** A port that lets a kit compute statistics without a running game (saves, HUD at load time). */
function statsPort(p: Pick<Player, "level" | "weapon" | "armor" | "upgrade">): KitPort {
  return {
    nowMs: 0,
    gear: {
      attack: p.weapon ? ITEMS[p.weapon].attack + p.upgrade * 4 : 0,
      defense: p.armor ? ITEMS[p.armor].defense : 0,
    },
    inCombat: false,
    terrain: () => "open",
    player: { x: 0, y: 0, level: p.level, hp: 0, ki: 0 },
    facing: { x: 1, y: 0 },
    random: () => 0.5,
    say: noop,
    foesIn: () => [],
    target: () => undefined,
    visible: () => true,
    hurtFoe: () => 0,
    stunFoe: noop,
    slowFoe: noop,
    burnFoe: noop,
    sealFoe: noop,
    markFoe: noop,
    pushFoe: noop,
    weakenFoe: noop,
    breakFoeShield: noop,
    isSealed: () => false,
    isMarked: () => false,
    foeHpFraction: () => 1,
    dash: (to) => to,
    emit: noop,
    heal: noop,
    addKi: noop,
  };
}
export const stats = (
  p: Pick<Player, "race" | "level" | "weapon" | "armor" | "upgrade" | "skills">,
) => {
  const s = createKit(p.race, statsPort(p), p.skills).stats;
  return {
    maxHp: s.maxHp,
    maxKi: s.maxKi,
    attack: s.attack,
    defense: s.defense,
    speed: s.speed,
    crit: s.crit,
    kiRegen: s.kiRegen,
    attackInterval: s.attackInterval,
    range: s.range,
  };
};
export function newPlayer(race: RaceId = "planetary"): Player {
  const continent = RACES[race].world;
  const base = { race, level: 1, weapon: null, armor: null, upgrade: 0, skills: ["R"] };
  const s = stats(base);
  return {
    level: 1,
    xp: 0,
    hp: s.maxHp,
    ki: s.maxKi,
    gold: 20,
    race,
    continent,
    startContinent: continent,
    ...WORLDS[continent].spawn,
    ...(WORLDS[continent].layout ? { layout: WORLDS[continent].layout } : {}),
    items: { potion: 3, tusk: 0, sword: 0, vest: 0 },
    weapon: null,
    armor: null,
    upgrade: 0,
    quests: { steps: "locked", boars: "locked", gear: "locked" },
    visited: false,
    kills: 0,
    dead: false,
    skills: ["R"],
    materials: {},
    respecs: 0,
  };
}
/** Moves a position saved on an older map layout into the enlarged open world. */
export function migrateLayout(p: Pick<Player, "continent" | "x" | "y" | "layout">) {
  const world = WORLDS[p.continent],
    want = world.layout ?? 1;
  if ((p.layout ?? 1) >= want) return;
  p.x += world.legacyShift?.x ?? 0;
  p.y += world.legacyShift?.y ?? 0;
  p.layout = want;
}
export const SAVE_KEY = "ki-legends:adventure:v1";
const LegacyPlayerSchema = PlayerSchema.extend({
  race: z.enum(RACE_IDS).default("planetary"),
  continent: z.enum(WORLD_IDS).default("verdant"),
  startContinent: z.enum(WORLD_IDS).default("verdant"),
});
const SaveSchema = z.discriminatedUnion("version", [
  z.object({ version: z.literal(1), revision: z.string(), player: LegacyPlayerSchema }),
  z.object({ version: z.literal(3), revision: z.string(), player: PlayerSchema }),
  z.object({ version: z.literal(4), revision: z.string(), player: PlayerSchema }),
]);
export type StoragePort = Pick<Storage, "getItem" | "setItem">;

/** Dedicated local demo save. Invalid/newer saves and other tabs are never overwritten. */
export class SaveStore {
  private expected: string | null = null;
  private writable = true;
  warning = "";
  constructor(
    private storage: StoragePort | null,
    private key = SAVE_KEY,
  ) {}
  load(): Player | undefined {
    try {
      if (!this.storage) throw new Error("storage unavailable");
      const raw = this.storage.getItem(this.key);
      this.expected = raw;
      if (raw === null) return undefined;
      const data = SaveSchema.safeParse(JSON.parse(raw));
      if (!data.success) {
        this.writable = false;
        this.warning =
          "Nieprawidłowy lub nowszy zapis. Zachowano oryginał; zapis tej sesji wyłączony.";
        return undefined;
      }
      const p = data.data.player;
      migrateLayout(p);
      const s = stats(p);
      if (
        p.startContinent !== RACES[p.race].world ||
        p.continent !== p.startContinent ||
        p.x > WORLDS[p.continent].width ||
        p.y > WORLDS[p.continent].height ||
        p.xp >= xpNeeded(p.level) ||
        (p.weapon && !p.items.sword) ||
        (p.armor && !p.items.vest) ||
        (p.quests.boars !== "locked" && p.quests.steps !== "done") ||
        (p.quests.gear !== "locked" && p.quests.boars !== "done") ||
        !p.skills.includes("R") ||
        !validLearned(p.race, p.level, p.skills) ||
        Object.keys(p.materials).some((id) => !isMaterial(id))
      ) {
        this.writable = false;
        this.warning = "Niespójny zapis. Oryginał zachowany; zapis tej sesji wyłączony.";
        return undefined;
      }
      p.hp = Math.min(p.hp, s.maxHp);
      p.ki = Math.min(p.ki, s.maxKi);
      return p;
    } catch {
      this.writable = false;
      this.warning = "Zapis lokalny niedostępny. Postęp tej sesji nie będzie zachowany.";
      return undefined;
    }
  }
  /** Keeps the last pre-v4 payload under a recovery key before the first v4 write replaces it. */
  private backupBeforeV4() {
    if (!this.storage || this.expected === null) return;
    const backupKey = "ki-legends:recovery:before-v4:" + this.key;
    if (this.storage.getItem(backupKey) !== null) return;
    let version: unknown;
    try {
      version = JSON.parse(this.expected)?.version;
    } catch {
      version = undefined;
    }
    if (version !== 4) this.storage.setItem(backupKey, this.expected);
  }
  save(p: Player): boolean {
    if (!this.storage || !this.writable) return false;
    try {
      if (this.storage.getItem(this.key) !== this.expected) {
        this.writable = false;
        this.warning =
          "Zapis zmienił się w innej karcie. Odśwież grę; ta karta nie nadpisze postępu.";
        return false;
      }
      this.backupBeforeV4();
      const next = JSON.stringify({
        version: 4,
        revision: Date.now().toString(36) + Math.random().toString(36).slice(2),
        player: p,
      });
      this.storage.setItem(this.key, next);
      this.expected = next;
      return true;
    } catch {
      this.warning = "Nie udało się zapisać postępu. Sprawdź dostęp do pamięci przeglądarki.";
      return false;
    }
  }
}

export type SessionOptions = { random?: () => number };
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** A day lasts 8 minutes of play; the last 3 minutes are night. */
export const DAY_MS = 480000;
export const NIGHT_FROM = 300000;

export class GameSession implements MonsterHost {
  player: Player;
  readonly nav: Navigation;
  readonly world: WorldDefinition;
  readonly npcs: typeof NPCS;
  enemies: Enemy[] = [];
  readonly monsters: MonsterSystem;
  readonly kit: Kit;
  readonly fx = new PlayerFx();
  loot: Loot[] = [];
  targetId: string | null = null;
  dialogue: NpcId | null = null;
  paused = false;
  autoAttack = false;
  notice = "Porozmawiaj z Airą. Klikaj postacie lub użyj przycisku Rozmowa.";
  noticeId = 0;
  log: string[] = [];
  events: GameEvent[] = [];
  moving = false;
  facing: Point = { x: 0, y: 1 };
  nowMs = 0;
  route: Point[] = [];
  private pendingNpc: NpcId | null = null;
  private pendingLoot: string | null = null;
  private pathIn = 0;
  private saveIn = 0;
  combatIn = 0;
  private respawnIn = 0;
  private counter = 0;
  private potionIn = 0;
  readonly rng: () => number;
  constructor(
    readonly saves?: SaveStore,
    race: RaceId = "planetary",
    options: SessionOptions = {},
  ) {
    this.rng = options.random ?? mulberry(Date.now() & 0x7fffffff);
    this.player = saves?.load() ?? newPlayer(race);
    this.world = WORLDS[this.player.continent];
    this.nav = new Navigation(this.world.width, this.world.height, worldObstacles(this.world));
    this.kit = createKit(this.player.race, makePort(this), this.player.skills);
    const safe = this.nav.safe(this.player.dead ? this.world.spawn : this.player);
    Object.assign(this.player, safe);
    if (this.player.dead || this.player.hp <= 0) {
      this.player.dead = false;
      this.player.hp = this.kit.stats.maxHp;
      this.player.ki = this.kit.stats.maxKi;
    }
    this.npcs = this.world.npcs.map((n) => ({ ...n, ...this.nav.safe(n) }));
    this.monsters = new MonsterSystem(this);
    this.world.enemies.forEach((p, i) => this.monsters.spawn("boar", p, "boar-" + i));
    for (const sp of this.world.monsters ?? [])
      this.monsters.spawnGroup(sp.kind, { x: sp.x, y: sp.y });
    const nextQuest = (Object.keys(QUEST_NAMES) as QuestId[]).find(
      (id) => this.player.quests[id] !== "done",
    );
    this.notice = nextQuest
      ? this.questText(nextQuest)
      : this.world.id === "verdant"
        ? "Wioska ocalona! Trenuj i zdobywaj wyposażenie."
        : "Region ocalony! Trenuj i odkrywaj świat.";
    if (saves?.warning) this.say(saves.warning);
  }

  // --- MonsterHost -------------------------------------------------------------------------------
  get playerMaxHp() {
    return this.kit.stats.maxHp;
  }
  get playerRange() {
    return this.kit.stats.range;
  }
  isNight() {
    return this.nowMs % DAY_MS >= NIGHT_FROM;
  }
  random() {
    return this.rng();
  }
  hurtPlayer(
    raw: number,
    from: Enemy,
    kind: HurtKind,
    fixed = false,
  ): { dealt: number; evaded: boolean } {
    const p = this.player;
    if (p.dead) return { dealt: 0, evaded: true };
    if (this.kit.hasBuff("invulnerable")) {
      this.emit({ type: "hit", x: p.x, y: p.y, target: "player", text: "Unik" });
      return { dealt: 0, evaded: true };
    }
    let amount = raw;
    if (from.fx.weaken.ms > 0) amount *= 1 - from.fx.weaken.pct;
    let dmg: number;
    if (fixed) dmg = Math.max(1, amount);
    else {
      amount *= 1 + this.fx.markPct(!!from.m.def.traits.machine);
      dmg = Math.max(1, amount - this.kit.stats.defense / 2);
    }
    const through = this.kit.absorb(
      dmg,
      kind === "melee" ? "melee" : kind === "projectile" ? "projectile" : "other",
      from,
    );
    this.combatIn = 4500;
    if (through <= 0) {
      this.emit({ type: "hit", x: p.x, y: p.y, target: "player", text: "Tarcza" });
      return { dealt: 0, evaded: false };
    }
    this.damagePlayer(through);
    return { dealt: through, evaded: false };
  }
  private damagePlayer(amount: number) {
    const p = this.player;
    if (p.dead) return;
    p.hp = Math.max(0, p.hp - amount);
    this.emit({ type: "hit", x: p.x, y: p.y, target: "player", text: "-" + Math.round(amount) });
    if (p.hp > 0) return;
    p.hp = 1;
    if (this.kit.saveFromDeath()) return;
    p.hp = 0;
    p.dead = true;
    this.respawnIn = 3000;
    this.targetId = null;
    this.autoAttack = false;
    this.route = [];
    this.fx.clear();
    this.emit({ type: "death", x: p.x, y: p.y, target: "player" });
    this.say("Zostałeś pokonany. Odrodzenie za 3 sekundy.");
    this.flush();
  }
  applyPlayerFx(spec: FxSpec, from: Enemy) {
    const s = this.kit.stats;
    if (spec.k === "breakShield") {
      if (this.kit.shieldPoints > 0) this.say(from.m.def.name + " rozbija Twoją osłonę!");
      this.kit.removeShields();
      return;
    }
    if (spec.k === "pull") {
      const to = this.nav.step(this.player, from, spec.dist);
      Object.assign(this.player, to);
      this.route = [];
      return;
    }
    this.fx.apply(spec, {
      cc: s.ccMul,
      stunImmune: this.kit.hasBuff("stunImmune"),
      atk: from.m.def.atk,
      machine: !!from.m.def.traits.machine,
      from: { x: from.x, y: from.y },
    });
    if (spec.k === "stun" || spec.k === "fear" || spec.k === "root") {
      this.kit.interruptChannel("hit");
      this.route = [];
    }
    this.emit({
      type: "status",
      x: this.player.x,
      y: this.player.y,
      target: "player",
      text: statusText(spec),
    });
  }
  killed(e: Enemy) {
    const def = e.m.def;
    this.kit.onKill(e);
    if (this.targetId === e.id) {
      this.targetId = null;
      this.autoAttack = false;
      this.route = [];
    }
    for (const drop of this.monsters.rollLoot(e)) {
      this.loot.push({
        id: "loot-" + ++this.counter,
        x: e.x + (this.counter % 3) * 8,
        y: e.y + (this.counter % 2) * 6,
        item: drop.item,
        quantity: drop.quantity,
        gold: drop.gold,
      });
    }
    if (e.kind === "boar" && this.player.quests.boars === "active") {
      this.player.kills = Math.min(3, this.player.kills + 1);
      if (this.player.kills === 3) {
        this.player.quests.boars = "ready";
        this.say(
          "3/3 dzików. Wróć do " +
            (this.world.id === "verdant" ? "Rena" : this.npcs[1]!.name) +
            " po nagrodę.",
        );
      }
    }
    if (def.xp > 0) this.award(def.xp);
  }

  get target() {
    return this.enemies.find(
      (e) => e.id === this.targetId && e.hp > 0 && !e.m.hidden && !e.m.invulnerable,
    );
  }
  say(text: string) {
    this.noticeId++;
    this.notice = text;
    this.log = [...this.log.slice(-19), text];
  }
  flush() {
    this.saves?.save(this.player);
  }
  emit(event: GameEvent | MonsterEvent) {
    this.events.push(event as GameEvent);
  }
  private award(xp: number) {
    this.player.xp += xp;
    this.say("+" + xp + " XP");
    while (this.player.level < 100 && this.player.xp >= xpNeeded(this.player.level)) {
      this.player.xp -= xpNeeded(this.player.level);
      this.player.level++;
      const s = this.kit.stats;
      this.player.hp = s.maxHp;
      this.player.ki = s.maxKi;
      this.emit({ type: "level", ...this.player, text: "Poziom " + this.player.level });
      const gained = this.player.level <= 20 ? " Nowy punkt umiejętności." : "";
      this.say("Awans! Poziom " + this.player.level + "." + gained);
    }
    if (this.player.level === 100) this.player.xp = Math.min(this.player.xp, xpNeeded(100) - 1);
  }
  private add(item: ItemId, n = 1) {
    if (
      this.player.items[item] + n > 99 ||
      (!this.player.items[item] &&
        ITEM_IDS.filter((id) => this.player.items[id] > 0).length >= BAG_CAPACITY)
    ) {
      this.say("Brak miejsca w plecaku lub pełny stos (99).");
      return false;
    }
    this.player.items[item] += n;
    return true;
  }
  private addMaterial(id: string, n: number) {
    const mats = this.player.materials;
    const have = mats[id] ?? 0;
    if (have + n > 99 || (!have && Object.keys(mats).length >= MATERIAL_CAPACITY)) {
      this.say("Brak miejsca na materiały lub pełny stos (99).");
      return false;
    }
    mats[id] = have + n;
    return true;
  }
  private nearbyNpc() {
    return this.npcs.find((n) => n.id === this.dialogue && distance(n, this.player) <= 115);
  }
  private go(to: Point, silent = false) {
    this.route = this.nav.path(this.player, to);
    if (!this.route.length && !silent) this.say("Brak przejścia. Wybierz inne miejsce.");
  }
  /** Skill points the player may still spend. */
  get skillPoints() {
    return freePoints(this.player.level, this.player.skills);
  }
  respecCost() {
    return this.player.respecs === 0 && this.player.level <= 10 ? 0 : 50 * this.player.level;
  }
  command(c: Command) {
    const p = this.player;
    if (c.type === "pause") {
      this.paused = c.value;
      if (c.value) {
        this.route = [];
        this.autoAttack = false;
      }
      return;
    }
    if (c.type === "cancel") {
      this.dialogue = null;
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.route = [];
      this.targetId = null;
      this.autoAttack = false;
      return;
    }
    if (c.type === "dialogue" && c.action === "close") {
      this.dialogue = null;
      return;
    }
    if (p.dead) {
      this.say("Odradzasz się w wiosce…");
      return;
    }
    if (c.type === "learn") {
      const check = canLearn(p.race, p.level, p.skills, c.node);
      if (!check.ok) return this.say(check.reason);
      p.skills = [...p.skills, c.node];
      this.kit.learn(c.node);
      const node = KIT_NODES[p.race].find((n) => n.id === c.node)!;
      this.say("Poznano: " + node.name + ".");
      p.hp = Math.min(p.hp, this.kit.stats.maxHp);
      this.flush();
      return;
    }
    if (c.type === "respec") {
      const cost = this.respecCost();
      if (p.gold < cost) return this.say("Reset drzewka kosztuje " + cost + " monet.");
      p.gold -= cost;
      p.respecs++;
      p.skills = ["R"];
      this.kit.forgetAll(p.skills);
      p.hp = Math.min(p.hp, this.kit.stats.maxHp);
      p.ki = Math.min(p.ki, this.kit.stats.maxKi);
      this.say(
        cost ? "Drzewko zresetowane za " + cost + " monet." : "Drzewko zresetowane za darmo.",
      );
      this.flush();
      return;
    }
    if (c.type === "dialogue") {
      const npc = this.nearbyNpc();
      if (!npc) return this.say("Podejdź do rozmówcy.");
      if (c.action === "accept") {
        if (npc.id === "guide" && p.quests.steps === "locked") {
          p.quests.steps = "active";
          this.say(this.world.market.instruction + ", potem wróć do " + this.npcs[0]!.name + ".");
        } else if (
          npc.id === "hunter" &&
          p.quests.steps === "done" &&
          p.quests.boars === "locked"
        ) {
          p.quests.boars = "active";
          this.say(this.world.huntName + ": pokonaj 3 dziki i wróć do " + this.npcs[1]!.name + ".");
        } else if (npc.id === "smith" && p.quests.boars === "done" && p.quests.gear === "locked") {
          p.quests.gear = p.weapon === "sword" ? "ready" : "active";
          this.say("Załóż Ostrze strażnika w ekwipunku, potem wróć do " + this.npcs[3]!.name + ".");
        } else this.say("To zadanie jest już przyjęte albo wymaga poprzedniego zadania.");
      }
      if (c.action === "claim") {
        if (npc.id === "guide" && p.quests.steps === "ready") {
          p.quests.steps = "done";
          this.award(40);
          this.say(
            this.world.id === "verdant"
              ? "Pierwsze kroki ukończone. +40 XP. Ren przy wschodniej drodze potrzebuje pomocy."
              : "Pierwsze kroki ukończone. +40 XP. Odwiedź: " + this.npcs[1]!.name,
          );
        } else if (npc.id === "hunter" && p.quests.boars === "ready") {
          if (!this.add("sword")) return;
          p.quests.boars = "done";
          p.gold += 30;
          this.award(80);
          this.say("Zagrożenie ukończone: +80 XP, +30 monet, Ostrze strażnika. Odwiedź kowala.");
        } else if (npc.id === "smith" && p.quests.gear === "ready") {
          p.quests.gear = "done";
          this.award(40);
          this.say("Pierwsze wyposażenie ukończone. +40 XP. Możesz dalej trenować i handlować.");
        } else this.say("Najpierw wykonaj cele. Odebranej nagrody nie można odebrać ponownie.");
      }
      if (c.action === "upgrade") {
        if (npc.id !== "smith" || !p.weapon) return this.say("Najpierw załóż ostrze.");
        if (p.upgrade) return this.say("Ostrze zostało już ulepszone.");
        if (p.gold < 15) return this.say("Ulepszenie kosztuje 15 monet.");
        p.gold -= 15;
        p.upgrade = 1;
        this.say("Ostrze ulepszone: +4 ataku.");
      }
      this.flush();
      return;
    }
    if (c.type === "trade") {
      if (this.nearbyNpc()?.id !== "merchant")
        return this.say("Porozmawiaj z kupcem, aby handlować.");
      if (isMaterial(c.item)) {
        const mat = MATERIALS[c.item]!;
        if (c.buy) return;
        if (!(p.materials[c.item] ?? 0)) return this.say("Brak materiału do sprzedaży.");
        p.materials[c.item]!--;
        if (!p.materials[c.item]) delete p.materials[c.item];
        p.gold += mat.sell;
        this.say("Sprzedano: " + mat.name);
        this.flush();
        return;
      }
      if (!(c.item in ITEMS)) return;
      const id = c.item as ItemId;
      const item = ITEMS[id];
      if (c.buy) {
        if (!item.price) return;
        if (p.gold < item.price) return this.say("Za mało monet.");
        if (!this.add(id)) return;
        p.gold -= item.price;
        this.say("Kupiono: " + item.name);
      } else {
        const reserved = p.weapon === id || p.armor === id ? 1 : 0;
        if (p.items[id] <= reserved)
          return this.say("Brak przedmiotu do sprzedaży. Najpierw zdejmij wyposażenie.");
        p.items[id]--;
        p.gold += item.sell;
        this.say("Sprzedano: " + item.name);
      }
      this.flush();
      return;
    }
    if (c.type === "equip") {
      if (!p.items[c.item]) return this.say("Nie masz tego przedmiotu.");
      if (c.item === "potion") return this.use("potion");
      if (c.item === "sword") p.weapon = "sword";
      else if (c.item === "vest") p.armor = "vest";
      else return this.say("Ten materiał możesz sprzedać kupcowi.");
      if (p.quests.gear === "active" && p.weapon) p.quests.gear = "ready";
      this.say("Założono: " + ITEMS[c.item].name);
      this.flush();
      return;
    }
    if (c.type === "unequip") {
      p[c.slot] = null;
      p.hp = Math.min(p.hp, this.kit.stats.maxHp);
      this.say("Zdjęto wyposażenie.");
      this.flush();
      return;
    }
    if (this.dialogue || this.paused) return this.say("Zamknij okno, aby kontynuować.");
    if (c.type === "ability") return this.use(c.ability);
    if (this.fx.cannotAct && c.type !== "loot") return this.say("Nie możesz działać.");
    if (c.type === "move") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      this.targetId = null;
      this.autoAttack = false;
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.go(c);
      return;
    }
    if (c.type === "target") {
      const enemy = this.enemies.find(
        (e) => e.id === c.id && e.hp > 0 && !e.m.hidden && !e.m.invulnerable,
      );
      if (!enemy) return this.say("Brak żywego przeciwnika.");
      this.pendingNpc = null;
      this.pendingLoot = null;
      this.targetId = c.id;
      this.autoAttack = true;
      this.pathIn = 0;
      this.say("Cel: " + enemy.m.def.name + ". Autoatak aktywny.");
      return;
    }
    if (c.type === "interact") {
      const npc = this.npcs.find((n) => n.id === c.npc);
      if (!npc) return;
      this.targetId = null;
      this.autoAttack = false;
      this.pendingNpc = npc.id;
      this.pendingLoot = null;
      this.go(npc);
      return;
    }
    if (c.type === "loot") {
      const loot = this.loot.find((l) => l.id === c.id);
      if (!loot) return this.say("Ten łup został już podniesiony.");
      if (distance(p, loot) > 90) {
        this.pendingLoot = loot.id;
        this.targetId = null;
        this.autoAttack = false;
        this.go(loot);
        return;
      }
      let name = "";
      if (loot.quantity > 0) {
        if (isMaterial(loot.item)) {
          if (!this.addMaterial(loot.item, loot.quantity)) return;
          name = MATERIALS[loot.item]!.name;
        } else {
          if (!this.add(loot.item as ItemId, loot.quantity)) return;
          name = ITEMS[loot.item as ItemId].name;
        }
      }
      p.gold += loot.gold;
      this.loot = this.loot.filter((l) => l.id !== loot.id);
      this.pendingLoot = null;
      this.emit({
        type: "loot",
        x: loot.x,
        y: loot.y,
        text: name ? "+" + loot.quantity + " " + name : "+" + loot.gold + " monet",
      });
      this.say(
        name ? "Łup: " + name + ", +" + loot.gold + " monet." : "Łup: +" + loot.gold + " monet.",
      );
      this.flush();
    }
  }
  /** Basic attack, tree abilities and the potion. */
  private use(id: Ability) {
    const p = this.player;
    if (this.fx.cannotAct) return this.say("Nie możesz działać.");
    if (id === "potion") {
      if (this.potionIn > 0)
        return this.say("Odnowienie: " + Math.ceil(this.potionIn / 1000) + " s.");
      if (!p.items.potion) return this.say("Brak mikstury. Kup ją u Mio.");
      const max = this.kit.stats.maxHp;
      if (p.hp >= max) return this.say("Masz pełne HP.");
      p.items.potion--;
      this.potionIn = POTION.cooldown;
      makePort(this).heal(Math.round(max * POTION.heal));
      this.flush();
      return;
    }
    if (id !== "R" && this.fx.silenced) return this.say("Uciszony: nie możesz używać zdolności.");
    const r = this.kit.use(id);
    if (!r.ok) {
      if (r.reason) this.say(r.reason);
      if (id === "R" && this.target && !r.reason) return;
      if (id === "R" && r.reason === "Cel poza zasięgiem." && this.target) {
        this.autoAttack = true;
        this.pathIn = 0;
        this.say("Podchodzisz do celu.");
      }
      return;
    }
    this.combatIn = 4500;
    if (id !== "R") this.flush();
  }
  manual(dx: number, dy: number, dt: number) {
    if (this.paused || this.dialogue || this.player.dead || this.fx.cannotAct) return;
    this.route = [];
    this.pendingNpc = null;
    this.pendingLoot = null;
    this.autoAttack = false;
    this.movePlayer({ x: this.player.x + dx * 100, y: this.player.y + dy * 100 }, dt);
  }
  private movePlayer(to: Point, dt: number) {
    if (this.fx.cannotMove || this.kit.lockMs < 0) return;
    const before = { x: this.player.x, y: this.player.y };
    const speed = this.kit.stats.speed * this.fx.speedMul;
    const next = this.nav.step(before, to, (speed * dt) / 1000);
    Object.assign(this.player, next);
    this.moving = distance(before, next) > 0.01;
    if (this.moving) {
      const d = distance(before, next);
      this.facing = { x: (next.x - before.x) / d, y: (next.y - before.y) / d };
    }
  }
  tick(milliseconds: number) {
    const dt = Math.max(0, Math.min(100, milliseconds));
    const wasMoving = this.moving;
    this.moving = false;
    if (this.dialogue || this.paused) return;
    this.nowMs += dt;
    const p = this.player,
      s = this.kit.stats;
    this.potionIn = Math.max(0, this.potionIn - dt);
    this.combatIn = Math.max(0, this.combatIn - dt);
    if (p.dead) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) {
        Object.assign(p, this.nav.safe(this.world.spawn));
        p.dead = false;
        const fresh = this.kit.stats;
        p.hp = fresh.maxHp;
        p.ki = fresh.maxKi;
        this.combatIn = 0;
        this.emit({ type: "respawn", ...p });
        this.say("Odrodzono w bezpiecznej wiosce. Zachowano przedmioty i zadania.");
        this.flush();
      }
      return;
    }
    this.kit.tick(dt, wasMoving);
    this.syncFxBuffs();
    const dot = this.fx.tick(dt);
    if (dot > 0) {
      this.dotCarry += dot;
      if (this.dotCarry >= 1) {
        const whole = Math.floor(this.dotCarry);
        this.dotCarry -= whole;
        this.damagePlayer(whole);
        if (p.dead) return;
      }
    }
    const live = this.kit.stats;
    p.hp = Math.min(p.hp, live.maxHp);
    p.ki = Math.min(live.maxKi, p.ki + (live.kiRegen * dt) / 1000);
    p.hp = Math.min(
      live.maxHp,
      p.hp + (live.maxHp * (this.kit.hpRegen() + (this.combatIn ? 0 : BASE_HP_REGEN)) * dt) / 1000,
    );
    void s;
    if (this.fx.fearMs > 0 && this.fx.fearFrom) {
      const from = this.fx.fearFrom;
      const d = distance(from, p) || 1;
      this.route = [];
      this.autoAttack = false;
      this.movePlayer(
        { x: p.x + ((p.x - from.x) / d) * 100, y: p.y + ((p.y - from.y) / d) * 100 },
        dt,
      );
    }
    this.pathIn -= dt;
    const target = this.target;
    if (this.autoAttack && target && !this.fx.cannotAct) {
      if (target.mode === "return") {
        this.autoAttack = false;
        this.targetId = null;
        this.route = [];
        this.say(target.m.def.name + " wraca na swoje terytorium.");
      } else if (distance(p, target) <= live.range && this.nav.visible(p, target)) {
        this.route = [];
        this.use("R");
      } else if (this.pathIn <= 0) {
        this.go(target, true);
        this.pathIn = 600;
      }
    } else if (this.autoAttack && !target) this.autoAttack = false;
    if (this.route.length && !this.fx.cannotAct) {
      this.movePlayer(this.route[0]!, dt);
      if (distance(p, this.route[0]!) < 5) this.route.shift();
    }
    if (this.pendingNpc) {
      const npc = this.npcs.find((n) => n.id === this.pendingNpc)!;
      if (distance(p, npc) <= 100) {
        this.dialogue = npc.id;
        this.pendingNpc = null;
        this.route = [];
        this.say(npc.name + ": " + npc.role);
        this.flush();
        return;
      }
    }
    if (this.pendingLoot) {
      const loot = this.loot.find((l) => l.id === this.pendingLoot);
      if (!loot) this.pendingLoot = null;
      else if (distance(p, loot) <= 90) this.command({ type: "loot", id: loot.id });
    }
    if (p.quests.steps === "active" && distance(p, this.world.market) < this.world.market.radius) {
      p.visited = true;
      p.quests.steps = "ready";
      this.say(
        this.world.id === "verdant"
          ? "Rynek odwiedzony. Wróć do Airy po nagrodę."
          : this.world.market.label + " — odkryto. Wróć do: " + this.npcs[0]!.name,
      );
      this.flush();
    }
    this.monsters.tick(dt);
    this.saveIn += dt;
    if (this.saveIn >= 2000) {
      this.saveIn = 0;
      this.flush();
    }
  }
  private dotCarry = 0;
  /** Debuffs that change the player's own numbers are mirrored into the kit as timed buffs. */
  private syncFxBuffs() {
    if (this.fx.armor.ms > 0)
      this.kit.addBuff({ id: "fx-armor", ms: this.fx.armor.ms, defPct: -this.fx.armorPct });
    else this.kit.removeBuff("fx-armor");
    if (this.fx.weaken.ms > 0)
      this.kit.addBuff({ id: "fx-weaken", ms: this.fx.weaken.ms, dealtPct: -this.fx.weakenPct });
    else this.kit.removeBuff("fx-weaken");
  }
  questText(id: QuestId): string {
    const q = this.player.quests[id];
    const forest = this.world.id === "verdant";
    const names = forest
      ? { steps: "Airy", boars: "Rena", gear: "Taro" }
      : {
          steps: this.npcs[0]!.name,
          boars: this.npcs[1]!.name,
          gear: this.npcs[3]!.name,
        };
    if (q === "done") return "Ukończone · nagroda odebrana";
    if (q === "ready") return "Wróć do " + names[id] + " po nagrodę";
    if (id === "steps")
      return q === "locked"
        ? "Porozmawiaj z " + names.steps + " przy miejscu startowym"
        : this.world.market.instruction;
    if (id === "boars")
      return q === "locked"
        ? "Po Pierwszych krokach porozmawiaj z " + names.boars
        : "Pokonaj dziki: " + this.player.kills + "/3";
    return q === "locked"
      ? "Po polowaniu porozmawiaj z kowalem " + names.gear
      : "Załóż Ostrze strażnika w ekwipunku";
  }
  snapshot() {
    const live = this.kit.stats;
    const target = this.target;
    const abilities: AbilityInfo[] = this.kit.abilities();
    return {
      x: this.player.x,
      y: this.player.y,
      player: structuredClone(this.player),
      stats: {
        maxHp: live.maxHp,
        maxKi: live.maxKi,
        attack: live.attack,
        defense: live.defense,
        speed: Math.round(live.speed),
        crit: Math.round(live.crit * 10) / 10,
        kiRegen: Math.round(live.kiRegen * 100) / 100,
        attackInterval: Math.round(live.attackInterval),
        range: Math.round(live.range),
      },
      target: target
        ? {
            name: target.m.def.name,
            level: target.m.def.level,
            hp: target.hp,
            maxHp: target.maxHp,
            inRange:
              distance(this.player, target) <= live.range && this.nav.visible(this.player, target),
          }
        : null,
      defeated: this.player.kills,
      ready: true,
      dialogue: this.dialogue,
      notice: this.notice,
      noticeId: this.noticeId,
      log: [...this.log],
      saveWarning: this.saves?.warning ?? "",
      quests: (Object.keys(QUEST_NAMES) as QuestId[]).map((id) => ({
        id,
        name: id === "boars" ? this.world.huntName : QUEST_NAMES[id],
        status: this.player.quests[id],
        text: this.questText(id),
      })),
      nearbyLoot: this.loot.filter((l) => distance(l, this.player) < 140).map((l) => ({ ...l })),
      nearestNpc:
        [...this.npcs].sort((a, b) => distance(a, this.player) - distance(b, this.player))[0]?.id ??
        ("guide" as NpcId),
      autoAttack: this.autoAttack,
      abilities,
      potion: { remaining: this.potionIn, count: this.player.items.potion },
      resource: this.kit.resource() as ResourceInfo | undefined,
      shieldPoints: Math.round(this.kit.shieldPoints),
      buffs: this.kit.buffs.map((b) => ({ id: b.id, ms: Math.round(b.ms) })),
      statuses: this.fx.active.map((a) => ({ ...a, ms: Math.round(a.ms) })),
      channel: this.kit.channel
        ? {
            id: this.kit.channel.id,
            ms: Math.round(this.kit.channel.ms),
            total: this.kit.channel.total,
          }
        : null,
      skillPoints: this.skillPoints,
      respecCost: this.respecCost(),
      minimapJammed: this.fx.jammed,
      fog: this.fx.fogPct,
      locked: this.kit.lockMs > 0,
      night: this.isNight(),
    };
  }
  get zones(): ZoneState[] {
    return this.monsters.zones;
  }
}
const statusText = (fx: FxSpec): string => {
  switch (fx.k) {
    case "slow":
      return "Spowolnienie";
    case "root":
      return "Unieruchomienie";
    case "stun":
      return "Ogłuszenie";
    case "fear":
      return "Strach";
    case "silence":
      return "Uciszenie";
    case "dot":
      return fx.id === "poison" ? "Trucizna" : fx.id === "burn" ? "Podpalenie" : "Krwawienie";
    case "blind":
      return "Oślepienie";
    case "fog":
      return "Mgła";
    case "jam":
      return "Zakłócenia";
    case "weaken":
      return "Osłabienie";
    case "armorDown":
      return "Obrona w dół";
    case "mark":
      return "Znak";
    default:
      return "";
  }
};
/** The surface a race kit uses to act on the game; implemented on top of the session. */
function makePort(s: GameSession): KitPort {
  return {
    get nowMs() {
      return s.nowMs;
    },
    get gear() {
      const p = s.player;
      return {
        attack: p.weapon ? ITEMS[p.weapon].attack + p.upgrade * 4 : 0,
        defense: p.armor ? ITEMS[p.armor].defense : 0,
      };
    },
    get inCombat() {
      return s.combatIn > 0;
    },
    terrain: () => terrainAt(s.world, s.player),
    get player() {
      return s.player;
    },
    get facing() {
      return s.facing;
    },
    random: () => s.rng(),
    say: (t) => s.say(t),
    foesIn: (c, r) => s.monsters.targetable.filter((e) => distance(e, c) <= r),
    target: () => s.target,
    visible: (a, b) => s.nav.visible(a, b),
    hurtFoe: (foe, raw, hit: Hit) => {
      if (!hit.indirect && s.fx.rollMiss()) {
        s.emit({ type: "hit", x: foe.x, y: foe.y, target: foe.id, text: "Pudło" });
        return 0;
      }
      const dealt = s.monsters.damage(foe as Enemy, raw, hit);
      if (!hit.indirect && dealt > 0) s.combatIn = 4500;
      return dealt;
    },
    stunFoe: (f, ms) => s.monsters.stun(f as Enemy, ms),
    slowFoe: (f, pct, ms) => s.monsters.slow(f as Enemy, pct, ms),
    burnFoe: (f, dps, ms) => s.monsters.burn(f as Enemy, dps, ms),
    sealFoe: (f, ms, bonus) => s.monsters.seal(f as Enemy, ms, bonus),
    markFoe: (f, ms, crit, def) => s.monsters.mark(f as Enemy, ms, crit, def),
    pushFoe: (f, from, d) => s.monsters.push(f as Enemy, from, d),
    weakenFoe: (f, pct, ms) => s.monsters.weaken(f as Enemy, pct, ms),
    breakFoeShield: (f) => s.monsters.breakShield(f as Enemy),
    isSealed: (f) => !!(f as Enemy).fx.seal,
    isMarked: (f) => !!(f as Enemy).fx.mark,
    foeHpFraction: (f) => f.hp / f.maxHp,
    dash: (to, d) => {
      const next = s.nav.step(s.player, to, d);
      const len = distance(s.player, next);
      if (len > 0.01) s.facing = { x: (next.x - s.player.x) / len, y: (next.y - s.player.y) / len };
      Object.assign(s.player, next);
      s.route = [];
      return next;
    },
    emit: (e) => {
      if (e.type === "attack" && e.to) {
        const d = distance(s.player, e.to);
        if (d > 0) s.facing = { x: (e.to.x - s.player.x) / d, y: (e.to.y - s.player.y) / d };
      }
      s.emit({ ...e });
    },
    heal: (n) => {
      const max = s.kit.stats.maxHp;
      const before = s.player.hp;
      s.player.hp = Math.min(max, s.player.hp + n);
      if (s.player.hp > before)
        s.emit({
          type: "heal",
          x: s.player.x,
          y: s.player.y,
          text: "+" + Math.round(s.player.hp - before),
        });
    },
    addKi: (n) => {
      s.player.ki = Math.max(0, Math.min(s.kit.stats.maxKi, s.player.ki + n));
    },
  };
}

export type GameViewState = ReturnType<GameSession["snapshot"]>;
export function initialView(player?: Player): GameViewState {
  const p = player ? structuredClone(player) : newPlayer();
  const s = stats(p);
  return {
    ...p,
    player: p,
    stats: {
      maxHp: s.maxHp,
      maxKi: s.maxKi,
      attack: s.attack,
      defense: s.defense,
      speed: Math.round(s.speed),
      crit: Math.round(s.crit * 10) / 10,
      kiRegen: Math.round(s.kiRegen * 100) / 100,
      attackInterval: Math.round(s.attackInterval),
      range: Math.round(s.range),
    },
    target: null,
    defeated: 0,
    ready: false,
    dialogue: null,
    notice: "",
    noticeId: 0,
    log: [],
    saveWarning: "",
    quests: [],
    nearbyLoot: [],
    nearestNpc: "guide",
    autoAttack: false,
    abilities: [],
    potion: { remaining: 0, count: p.items.potion },
    resource: undefined,
    shieldPoints: 0,
    buffs: [],
    statuses: [],
    channel: null,
    skillPoints: 0,
    respecCost: 0,
    minimapJammed: false,
    fog: 0,
    locked: false,
    night: false,
  };
}
export function decodeItem(value: unknown) {
  return itemSchema.safeParse(value);
}
export type { Foe };
