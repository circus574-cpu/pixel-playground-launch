import { activeVariant, developmentModifiers } from "../development/modifiers";
import { combatTarget } from "../combat/targeting";
import type { RaceId } from "../world/races";
import { speedGrowth } from "./balance";
import { RACE_BASE, KIT_NODES } from "./nodes.generated";
import type {
  AbilityInfo,
  Buff,
  FinalStats,
  Foe,
  Hit,
  KitNodeData,
  KitPort,
  RaceBase,
  ResourceInfo,
  Shield,
} from "./types";

/** Critical hits multiply damage by this factor (not specified by the annex; recorded in DECISIONS.md). */
export const CRIT_MULT = 1.5;
/** Basic-attack combo: extra time after the attack interval to chain the next hit, and the bonus of
 *  the third (finisher) hit. Unik: dash length, invulnerable time and cooldown. Owner 26.10.2026. */
export const COMBO_WINDOW_MS = 450;
export const COMBO_FINISHER_BONUS = 0.6;
export const DODGE_DISTANCE = 170;
export const DODGE_INVULNERABLE_MS = 350;
export const DODGE_COOLDOWN_MS = 900;
export const roundHalfUp = (x: number) => Math.floor(x + 0.5);

/** Passive modifiers a race kit derives from the nodes the player learned. All values are fractions. */
export type Mods = Partial<{
  hpPct: number;
  kiPct: number;
  atkPct: number;
  defPct: number;
  speedPct: number;
  critAdd: number;
  rangePct: number;
  intervalPct: number;
  kiCostPct: number;
  /** Negative: shorter control effects on the player. */
  ccPct: number;
  kiRegenPct: number;
  /** Fraction of max HP per second regenerated outside combat. */
  hpRegenOoc: number;
  /** Fraction of max HP per second regenerated always. */
  hpRegenAlways: number;
  dealtPct: number;
}>;

export type ActiveDef = {
  id: string;
  ki: number;
  cd: number;
  /** Needs a foe: the current target, or the nearest one in reach. */
  needsFoe?: boolean;
  /** Reach to the foe (melee abilities); defaults to the basic range. */
  reach?: number;
  channel?: boolean;
};

export type Channel = {
  id: string;
  ms: number;
  total: number;
  every: number;
  next: number;
  onTick: () => void;
  onEnd: (completed: boolean) => void;
  breakOnMove: boolean;
  breakOnHit: boolean;
};
export type Circle = {
  id: string;
  x: number;
  y: number;
  radius: number;
  ms: number;
  kind: "light" | "slow" | "temple";
  /** Foes inside are slowed by this fraction. */
  slow?: number | undefined;
  /** Foes inside deal this fraction less damage. */
  weaken?: number | undefined;
  /** The player inside gets this much extra defence. */
  defPct?: number | undefined;
  /** Foes inside take this much damage per second (fraction of ATK). */
  dps?: number | undefined;
};
export type UseResult = { ok: boolean; reason?: string };

const BONUS_FIELDS = [
  "atkPct",
  "defPct",
  "speedPct",
  "dealtPct",
  "intervalPct",
  "cooldownPct",
] as const;

export abstract class Kit {
  readonly nodes: KitNodeData[];
  readonly learned: Set<string>;
  cooldowns: Record<string, number> = {};
  buffs: Buff[] = [];
  shields: Shield[] = [];
  circles: Circle[] = [];
  channel: Channel | undefined;
  /** Time during which the player can do nothing (Przeciążenie Systemu shutdown, overheating is separate). */
  lockMs = 0;
  protected timers: { ms: number; fn: () => void }[] = [];
  /** Last time the player made a basic attack (series logic). */
  protected lastBasic = -1e9;
  /** True for a race whose basic attack already has an annex series bonus. */
  protected readonly ownSeries: boolean = false;
  /** Hits in the current basic-attack chain (1–3). */
  protected combo = 0;
  private nextDodgeAt = -1e9;
  /** Unik for every race: a short dash with a moment of invulnerability, no KI. */
  dodge(direction: { x: number; y: number }): UseResult {
    const now = this.port.nowMs;
    if (this.lockMs > 0) return { ok: false, reason: "Układy wyłączone." };
    if (now < this.nextDodgeAt) return { ok: false, reason: "" };
    const p = this.port.player;
    const len = Math.hypot(direction.x, direction.y) || 1;
    this.port.dash(
      {
        x: p.x + (direction.x / len) * DODGE_DISTANCE,
        y: p.y + (direction.y / len) * DODGE_DISTANCE,
      },
      DODGE_DISTANCE,
    );
    this.addBuff({ id: "dodge", ms: DODGE_INVULNERABLE_MS, invulnerable: true });
    this.nextDodgeAt = now + DODGE_COOLDOWN_MS;
    this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "dodge", text: "Unik" });
    return { ok: true };
  }
  private assistedTarget: string | undefined;
  private actionEpoch = 0;
  protected nextBasicAt = 0;
  abstract readonly defs: Record<string, ActiveDef>;
  protected abstract readonly baseRange: number;
  protected abstract readonly ranged: boolean;
  constructor(
    protected port: KitPort,
    readonly race: RaceId,
    learned: Iterable<string>,
  ) {
    this.nodes = KIT_NODES[race];
    this.learned = new Set(learned);
  }
  has(id: string) {
    return this.learned.has(id);
  }
  /** Recomputes anything derived from the learned set; called after learning or forgetting. */
  protected refresh(): void {}
  learn(id: string) {
    this.learned.add(id);
    this.refresh();
  }
  forgetAll(ids: Iterable<string>) {
    this.learned.clear();
    for (const id of ids) this.learned.add(id);
    this.cooldowns = {};
    this.buffs = [];
    this.shields = [];
    this.circles = [];
    this.channel = undefined;
    this.timers = [];
    this.refresh();
  }
  /** Racial resource for the HUD. */
  resource(): ResourceInfo | undefined {
    return undefined;
  }
  node(id: string) {
    return this.nodes.find((n) => n.id === id);
  }
  /** Passive modifiers of the learned nodes. */
  protected abstract mods(): Mods;
  protected abstract cast(id: string): UseResult;
  protected abstract basic(): UseResult;
  protected onTick(_dt: number): void {}
  onKill(_foe: Foe): void {}
  /** Bonus to the crit chance against this foe, in percentage points. */
  protected critVs(_foe: Foe): number {
    return 0;
  }
  /** Extra damage multiplier (fraction) against this foe. */
  protected dealtVs(_foe: Foe): number {
    return 0;
  }
  /** Cooldown multiplier for one ability on top of the global one. */
  protected cooldownOf(id: string): number {
    return this.defs[id]?.cd ?? 0;
  }
  /** Lets a race react to taking damage (e.g. reset series). */
  protected onHurt(_amount: number): void {}
  /** Whether the shot/attack can be made at all (overheating and so on). */
  protected canAttack(): string {
    return "";
  }

  private buffSum(field: (typeof BONUS_FIELDS)[number]) {
    let total = 0;
    for (const b of this.buffs) total += b[field] ?? 0;
    return total;
  }
  hasBuff(flag: "noKi" | "ccImmune" | "stunImmune" | "invulnerable") {
    return this.buffs.some((b) => b[flag]);
  }
  protected get development() {
    return developmentModifiers(this.port.development, this.race);
  }
  protected variant(id: string) {
    return activeVariant(this.port.development, this.race, this.learned) === id;
  }
  get stats(): FinalStats {
    const b: { base: RaceBase; perLevel: RaceBase } = RACE_BASE[this.race];
    const level = this.port.player.level;
    const v = (k: keyof RaceBase) => b.base[k] + b.perLevel[k] * (level - 1);
    const m = this.mods();
    const gear = this.port.gear;
    const dev = this.development;
    const t = dev.training;
    const atkPct = (m.atkPct ?? 0) + this.buffSum("atkPct");
    const defPct = (m.defPct ?? 0) + this.buffSum("defPct") + this.circleDefence();
    return {
      maxHp: roundHalfUp(v("hp") * (1 + (m.hpPct ?? 0)) + v("hp") * 0.005 * t.endurance),
      maxKi: roundHalfUp(
        (v("ki") * (1 + (m.kiPct ?? 0)) + v("ki") * 0.005 * t.kiCapacity) * dev.maxKi,
      ),
      attack: Math.max(
        1,
        roundHalfUp(
          ((v("attack") + gear.attack) * (1 + atkPct) + v("attack") * 0.004 * t.strength) *
            dev.attack,
        ),
      ),
      defense: Math.max(
        0,
        roundHalfUp(
          (v("defense") + gear.defense) * (1 + defPct) + v("defense") * 0.004 * t.defense,
        ),
      ),
      speed: b.base.speed * speedGrowth(level) * (1 + (m.speedPct ?? 0) + this.buffSum("speedPct")),
      kiRegen: v("kiRegen") * (1 + (m.kiRegenPct ?? 0)),
      crit: v("criticalChancePercent") + (m.critAdd ?? 0) * 100 + dev.crit,
      attackInterval: Math.max(
        200,
        b.base.attackIntervalMs * (1 + (m.intervalPct ?? 0) + this.buffSum("intervalPct")),
      ),
      dealt: 1 + (m.dealtPct ?? 0) + this.buffSum("dealtPct"),
      cooldownMul: Math.max(0.1, 1 + this.buffSum("cooldownPct")),
      kiCostMul: this.hasBuff("noKi")
        ? 0
        : Math.max(0, 1 + (m.kiCostPct ?? 0) - 0.002 * t.kiControl - dev.kiReduction),
      ccMul: this.hasBuff("ccImmune") ? 0 : Math.max(0, 1 + (m.ccPct ?? 0)),
      range: this.baseRange * (1 + (m.rangePct ?? 0)),
    };
  }
  /** Regeneration of HP per second as a fraction of max HP. */
  hpRegen(): number {
    const m = this.mods();
    return (m.hpRegenAlways ?? 0) + (this.port.inCombat ? 0 : (m.hpRegenOoc ?? 0));
  }
  protected circleDefence() {
    const p = this.port.player;
    let total = 0;
    for (const c of this.circles)
      if (c.defPct && Math.hypot(c.x - p.x, c.y - p.y) <= c.radius)
        total = Math.max(total, c.defPct);
    return total;
  }

  // --- buffs, shields, timers ------------------------------------------------------------
  addBuff(buff: Buff) {
    this.buffs = this.buffs.filter((b) => b.id !== buff.id);
    this.buffs.push(buff);
  }
  removeBuff(id: string) {
    this.buffs = this.buffs.filter((b) => b.id !== id);
  }
  buff(id: string) {
    return this.buffs.find((b) => b.id === id);
  }
  addShield(shield: Shield) {
    this.shields = this.shields.filter((s) => s.id !== shield.id);
    this.shields.push(shield);
    this.port.emit({
      type: "shield",
      x: this.port.player.x,
      y: this.port.player.y,
      ability: shield.id,
      text: "Tarcza " + Math.round(shield.amount),
    });
  }
  get shieldPoints() {
    return this.shields.reduce((n, s) => n + s.amount, 0);
  }
  removeShields() {
    this.shields = [];
  }
  schedule(ms: number, fn: () => void) {
    this.timers.push({ ms, fn });
  }
  addCircle(c: Circle) {
    this.circles.push(c);
    this.port.emit({ type: "circle", x: c.x, y: c.y, ability: c.id, radius: c.radius, ms: c.ms });
  }
  startChannel(c: Omit<Channel, "next" | "total">) {
    this.channel = { ...c, total: c.ms, next: c.every };
    this.port.emit({
      type: "channel",
      x: this.port.player.x,
      y: this.port.player.y,
      ability: c.id,
      ms: c.ms,
    });
  }
  interruptChannel(reason: "move" | "hit" | "other") {
    const c = this.channel;
    if (!c) return;
    if ((reason === "move" && !c.breakOnMove) || (reason === "hit" && !c.breakOnHit)) return;
    this.channel = undefined;
    c.onEnd(false);
  }

  // --- damage ----------------------------------------------------------------------------
  /** Rolls a crit and deals `mult` × ATK (× buffs) to the foe through the session's damage model. */
  protected strike(foe: Foe, mult: number, hit: Hit, extra = 0, forceCrit = false): number {
    if (!hit.tags.includes("area") && !this.port.visible(this.port.player, foe)) return 0;
    const s = this.stats;
    let raw = s.attack * mult * s.dealt * (1 + extra + this.dealtVs(foe));
    const chance = s.crit + this.critVs(foe);
    const crit = forceCrit || this.port.random() * 100 < chance;
    if (crit) raw *= CRIT_MULT;
    return this.port.hurtFoe(foe, raw, { ...hit, crit });
  }
  /** Consumes one-shot "next hit" buffs and returns their bonus plus whether a crit is guaranteed. */
  protected takeNextHit(): { bonus: number; crit: boolean } {
    let bonus = 0;
    let crit = false;
    for (const b of this.buffs) {
      if (b.nextHitPct) bonus += b.nextHitPct;
      if (b.guaranteedCrit) crit = true;
    }
    this.buffs = this.buffs.filter((b) => !b.nextHitPct && !b.guaranteedCrit);
    return { bonus, crit };
  }
  /** The foe to act on: current target or the nearest within `reach` of the player. */
  protected pickFoe(reach: number): Foe | undefined {
    const candidates = this.port.foesIn(this.port.player, reach);
    const explicit = this.port.target();
    const retained = candidates.find((f) => f.id === this.assistedTarget);
    // Retain only within the same forward cone; deliberate selection takes precedence.
    const assisted =
      retained &&
      combatTarget(this.port.player, this.port.facing, reach, undefined, [retained], (a, b) =>
        this.port.visible(a, b),
      );
    const picked = combatTarget(
      this.port.player,
      this.port.facing,
      reach,
      explicit ?? assisted,
      candidates,
      (a, b) => this.port.visible(a, b),
    );
    this.assistedTarget = picked?.id;
    return picked;
  }
  protected dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Damage the player takes. Returns what is left after shields; reflects to `from` when set. */
  absorb(amount: number, kind: "melee" | "projectile" | "other", from?: Foe): number {
    if (this.hasBuff("invulnerable")) return 0;
    this.onHurt(amount);
    this.interruptChannel("hit");
    let left = amount;
    for (const sh of this.shields) {
      if (sh.amount <= 0) continue;
      if (sh.mirror) {
        sh.mirror = false;
        if (from) this.port.hurtFoe(from, amount, { tags: ["physical"], indirect: true });
        this.port.say("Lustro odbiło atak.");
        return 0;
      }
      const reflect =
        kind === "melee" ? sh.reflectMelee : kind === "projectile" ? sh.reflectProjectile : 0;
      if (reflect && from)
        this.port.hurtFoe(from, amount * reflect, { tags: ["physical"], indirect: true });
      const take = Math.min(left, sh.amount);
      sh.amount -= take;
      left -= take;
      if (left <= 0) break;
    }
    this.shields = this.shields.filter((s) => s.amount > 0.5);
    return left;
  }
  /** Last-chance effects (Ostatni Płomień). Returns the damage actually applied to HP. */
  protected lethalSave(): boolean {
    return false;
  }
  saveFromDeath(): boolean {
    return this.lethalSave();
  }

  // --- use -------------------------------------------------------------------------------
  abilities(): AbilityInfo[] {
    const out: AbilityInfo[] = [];
    let n = 1;
    const basicNode = this.node("R")!;
    out.push({
      id: "R",
      name: basicNode.name,
      type: "starting",
      ki: 0,
      cd: Math.round(this.stats.attackInterval),
      remaining: Math.max(0, this.nextBasicAt - this.port.nowMs),
      channel: false,
      key: "",
      ready: this.nextBasicAt <= this.port.nowMs,
      reason: this.canAttack(),
    });
    for (const node of this.nodes) {
      const def = this.defs[node.id];
      if (!def || !this.has(node.id)) continue;
      const remaining = this.cooldowns[node.id] ?? 0;
      out.push({
        id: node.id,
        name: node.name,
        type: node.type,
        ki: this.abilityCost(node.id),
        cd: this.abilityCooldown(node.id),
        remaining,
        channel: !!def.channel,
        key: n <= 9 ? String(n) : n === 10 ? "0" : "",
        ready: remaining <= 0,
        reason: "",
      });
      n++;
    }
    return out;
  }
  private abilityCost(id: string) {
    const variant = activeVariant(this.port.development, this.race, this.learned);
    const surcharge =
      variant && ["mv-trail", "ma-seal", "mn-mark", "mp-cuts"].includes(variant) && id === "A1"
        ? 1.25
        : 1;
    return Math.round((this.defs[id]?.ki ?? 0) * this.stats.kiCostMul * surcharge);
  }
  private abilityCooldown(id: string) {
    return Math.round(
      this.cooldownOf(id) *
        this.stats.cooldownMul *
        (id === "T" ? 1 : this.development.activeCooldown),
    );
  }
  use(id: string): UseResult {
    if (id === "T" && (this.port.player.level < 20 || !["A9", "B9", "C9"].some((n) => this.has(n))))
      return { ok: false, reason: "Tryb KI wymaga poziomu 20 i zdolności ostatecznej." };
    if (this.lockMs > 0) return { ok: false, reason: "Układy wyłączone." };
    if (id === "R") {
      const why = this.canAttack();
      if (why) return { ok: false, reason: why };
      if (this.nextBasicAt > this.port.nowMs) return { ok: false, reason: "" };
      // Combo: presses in rhythm chain three hits; the third is a heavy finisher that knocks the
      // target back (owner 26.10.2026: an anime brawler, not a click-RPG).
      const now = this.port.nowMs;
      this.combo =
        now - this.lastBasic <= this.stats.attackInterval + COMBO_WINDOW_MS ? this.combo + 1 : 1;
      const finisher = this.combo >= 3;
      // A race with its own series bonus (Planetarni ×1,3 from the annex) keeps that number.
      if (finisher && !this.ownSeries)
        this.addBuff({ id: "combo", ms: 400, nextHitPct: COMBO_FINISHER_BONUS });
      const r = this.basic();
      if (r.ok) {
        // Chained hits come quicker than an opening hit.
        this.nextBasicAt = now + this.stats.attackInterval * (this.combo > 1 ? 0.75 : 1);
        this.lastBasic = now;
        if (finisher) {
          const t = this.port.target();
          const p = this.port.player;
          if (t) this.port.pushFoe(t, p, 70);
          this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "combo", text: "KOMBO!" });
          this.combo = 0;
        }
      } else this.combo = 0;
      return r;
    }
    const def = this.defs[id];
    if (!def || !this.has(id)) return { ok: false, reason: "Nie znasz tej zdolności." };
    const left = this.cooldowns[id] ?? 0;
    if (left > 0) return { ok: false, reason: "Odnowienie: " + Math.ceil(left / 1000) + " s." };
    const cost = this.abilityCost(id);
    if (this.port.player.ki < cost) return { ok: false, reason: "Za mało KI (" + cost + ")." };
    if (this.channel) return { ok: false, reason: "Trwa kanałowanie." };
    if (def.needsFoe) {
      const target = this.port.target();
      if (target && !this.port.visible(this.port.player, target))
        return { ok: false, reason: "Przeszkoda zasłania cel." };
    }
    // Snapshot before cast: the KI form must not shorten its own stated cooldown.
    const cooldown = this.abilityCooldown(id);
    const r = this.cast(id);
    if (!r.ok) return r;
    this.port.addKi(-cost);
    this.cooldowns[id] = cooldown;
    return r;
  }
  /** Runtime actions cannot survive death or a world transition. Cooldowns stay paid. */
  cancelActions() {
    this.actionEpoch++;
    this.assistedTarget = undefined;
    this.interruptChannel("hit");
    this.channel = undefined;
    this.timers = [];
    this.circles = [];
    this.lastBasic = -1e9;
  }
  remaining(id: string) {
    return id === "R" ? Math.max(0, this.nextBasicAt - this.port.nowMs) : (this.cooldowns[id] ?? 0);
  }
  tick(dt: number, moving: boolean) {
    for (const key of Object.keys(this.cooldowns))
      this.cooldowns[key] = Math.max(0, (this.cooldowns[key] ?? 0) - dt);
    this.lockMs = Math.max(0, this.lockMs - dt);
    for (const b of this.buffs) b.ms -= dt;
    this.buffs = this.buffs.filter((b) => b.ms > 0);
    for (const s of this.shields) s.ms -= dt;
    this.shields = this.shields.filter((s) => s.ms > 0 && s.amount > 0.5);
    for (const c of this.circles) {
      const elapsed = Math.min(dt, c.ms);
      c.ms -= dt;
      for (const f of this.port.foesIn(c, c.radius)) {
        if (c.slow) this.port.slowFoe(f, c.slow, 300);
        if (c.weaken) this.port.weakenFoe(f, c.weaken, 300);
        if (c.dps)
          this.port.hurtFoe(f, (this.stats.attack * c.dps * elapsed) / 1000, {
            tags: ["ki"],
            indirect: true,
          });
      }
    }
    this.circles = this.circles.filter((c) => c.ms > 0);
    const epoch = this.actionEpoch;
    const due: (() => void)[] = [];
    for (const t of this.timers) {
      t.ms -= dt;
      if (t.ms <= 0) due.push(t.fn);
    }
    this.timers = this.timers.filter((t) => t.ms > 0);
    for (const fn of due) {
      if (epoch !== this.actionEpoch) break;
      fn();
    }
    if (this.channel) {
      if (moving) this.interruptChannel("move");
      const c = this.channel;
      if (c) {
        const elapsed = Math.min(dt, c.ms);
        c.ms -= dt;
        c.next -= elapsed;
        while (c.next <= 0 && this.channel === c) {
          c.next += c.every;
          c.onTick();
        }
        if (c.ms <= 0) {
          this.channel = undefined;
          c.onEnd(true);
        }
      }
    }
    this.onTick(dt);
  }
}
