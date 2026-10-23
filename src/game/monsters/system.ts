import { distance, type Navigation, type Point } from "../navigation";
import type { WorldDefinition } from "../world/types";
import { monsterDef } from "./catalog";
import { slug } from "./materials";
import type {
  Enemy,
  FoeFx,
  FxSpec,
  MonsterDef,
  MonsterState,
  SkillSpec,
  ZoneSpec,
  ZoneState,
} from "./types";

export const BASE_SPEED = 0.12;
export type HurtKind = "melee" | "projectile" | "area" | "dot" | "other";
export type MonsterEvent = Point & {
  type: "hit" | "attack" | "death" | "respawn" | "telegraph" | "zone" | "status";
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
/** What the monster system needs from the game session. */
export interface MonsterHost {
  readonly nowMs: number;
  readonly world: WorldDefinition;
  readonly nav: Navigation;
  readonly enemies: Enemy[];
  readonly player: { x: number; y: number; hp: number; dead: boolean };
  readonly playerMaxHp: number;
  /** Reach of the player's basic attack; ranged races can shoot from far beyond a monster's leash. */
  readonly playerRange: number;
  isNight(): boolean;
  random(): number;
  hurtPlayer(
    raw: number,
    from: Enemy,
    kind: HurtKind,
    fixed?: boolean,
  ): { dealt: number; evaded: boolean };
  applyPlayerFx(fx: FxSpec, from: Enemy): void;
  emit(event: MonsterEvent): void;
  say(text: string): void;
  killed(enemy: Enemy): void;
}

export const newFx = (): FoeFx => ({
  stunMs: 0,
  slow: { pct: 0, ms: 0 },
  weaken: { pct: 0, ms: 0 },
  dots: [],
  seal: null,
  mark: null,
});
export function newState(def: MonsterDef, now: number): MonsterState {
  const hidden = !!(def.traits.ambush || def.traits.burrow);
  return {
    def,
    phase: hidden ? "hidden" : "idle",
    phaseMs: 0,
    hidden,
    invulnerable: false,
    facing: { x: 0, y: 1 },
    cooldowns: {},
    used: new Set(),
    hitsTaken: 0,
    attacksMade: 0,
    sinceHit: 1e9,
    provoked: false,
    engaged: false,
    revived: false,
    split: false,
    parent: undefined,
    guard: 0,
    guardMs: 0,
    reduce: 0,
    reduceMs: 0,
    buff: 0,
    buffMs: 0,
    regen: 0,
    regenMs: 0,
    curlMs: 0,
    curlHits: 0,
    exposed: 0,
    exposedMs: 0,
    stunMs: 0,
    shots: 0,
    heatMs: 0,
    castDamage: 0,
    cast: undefined,
    charge: undefined,
    volley: undefined,
    scanStacks: 0,
    scanReady: false,
    tailHits: 0,
    tailBroken: false,
    trailMs: 0,
    webs: [],
    orbit: 1,
    routeIndex: 0,
    aim: 0,
    nextWander: 0,
    attackCount: 0,
    nextAttack: 0,
    spawnedAt: now,
  };
}
const unit = (a: Point, b: Point): Point => {
  const d = distance(a, b);
  return d < 1e-6 ? { x: 0, y: 1 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type DropRoll = { item: string; quantity: number; gold: number };

export class MonsterSystem {
  zones: ZoneState[] = [];
  private seq = 0;
  private zoneSeq = 0;
  private paths = new Map<string, { goal: Point; points: Point[]; remaining: number }>();
  private splits = new Map<string, { cloneId: string; origMax: number; ms: number }>();
  constructor(private host: MonsterHost) {}

  // --- spawning -----------------------------------------------------------------------------
  spawn(kind: string, at: Point, id?: string): Enemy {
    const def = monsterDef(kind);
    const home = this.host.nav.safe(at);
    const e: Enemy = {
      id: id ?? kind + "#" + this.seq++,
      kind,
      ...home,
      home,
      hp: def.hp,
      maxHp: def.hp,
      mode: "patrol",
      timer: 0,
      attackIn: 900,
      patrol: { ...home },
      m: newState(def, this.host.nowMs),
      fx: newFx(),
    };
    this.host.enemies.push(e);
    if (def.traits.webs) this.layWebs(e);
    return e;
  }
  /** Spawns a pack (wolves, bats) around a point. Returns the members. */
  spawnGroup(kind: string, at: Point): Enemy[] {
    const def = monsterDef(kind);
    const [lo, hi] = def.traits.pack ?? [1, 1];
    const n = lo + Math.floor(this.host.random() * (hi - lo + 1));
    const out: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, n);
      out.push(this.spawn(kind, { x: at.x + Math.cos(a) * 55, y: at.y + Math.sin(a) * 55 }));
    }
    return out;
  }
  /** Monsters that can be hit or targeted. */
  get targetable() {
    return this.host.enemies.filter((e) => e.mode !== "dead" && !e.m.hidden && !e.m.invulnerable);
  }

  // --- damage from the player ---------------------------------------------------------------
  /** Player → monster damage after the annex model `max(1, raw − DEF/2)` and monster modifiers. */
  damage(
    e: Enemy,
    raw: number,
    hit: { tags: string[]; ranged?: boolean; melee?: boolean; indirect?: boolean; crit?: boolean },
  ): number {
    const m = e.m;
    const def = m.def;
    if (e.mode === "dead" || m.hidden || m.invulnerable) return 0;
    if (m.phase === "return" && !hit.indirect) {
      this.host.say(def.name + " wraca na swoje terytorium.");
      return 0;
    }
    const p = this.host.player;
    const toPlayer = unit(e, p);
    const rel = m.facing.x * toPlayer.x + m.facing.y * toPlayer.y;
    let mult = 1;
    for (const tag of hit.tags) {
      const w = def.weak[tag as keyof MonsterDef["weak"]];
      if (w === undefined) continue;
      mult = w > 1 ? Math.max(mult, w) : Math.min(mult, w);
    }
    if (hit.ranged && def.weakRanged) mult = Math.max(mult, def.weakRanged);
    if (e.fx.seal && e.fx.seal.ms > 0) mult *= 1 + e.fx.seal.bonus;
    if (def.traits.frontArmor && rel > 0.5) mult *= 1 - def.traits.frontArmor;
    if (def.traits.backBonus && rel < -0.5) mult *= 1 + def.traits.backBonus;
    const retreating = m.phase === "retreat" && !!def.traits.dive;
    if (def.traits.exposedBonus && (retreating || m.heatMs > 0))
      mult *= 1 + def.traits.exposedBonus;
    if (def.traits.burrow?.bonus && m.phase === "engage") mult *= 1 + def.traits.burrow.bonus;
    if (m.curlMs > 0 && !hit.tags.includes("ki") && def.traits.curl)
      mult *= 1 - def.traits.curl.reduce;
    if (m.reduceMs > 0) mult *= 1 - m.reduce;
    let defense = def.def;
    if (e.fx.mark && e.fx.mark.ms > 0) defense *= 1 - e.fx.mark.def;
    if (m.exposedMs > 0) defense *= 1 - m.exposed;
    // The annex model is fractional: rounding every hit would break its control duels.
    let dmg = Math.max(1, raw * mult - defense / 2);
    if (m.guard > 0) {
      const absorbed = Math.min(m.guard, dmg);
      m.guard -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) {
        this.host.emit({ type: "hit", ...e, target: e.id, text: "Tarcza" });
        return 0;
      }
    }
    e.hp = Math.max(0, e.hp - dmg);
    m.sinceHit = 0;
    this.host.emit({
      type: "hit",
      x: e.x,
      y: e.y,
      target: e.id,
      text: "-" + Math.round(dmg) + (hit.crit ? "!" : ""),
      crit: !!hit.crit,
    });
    if (def.traits.webs && hit.tags.includes("fire")) this.burnWebs(e);
    if (!hit.indirect) {
      m.hitsTaken++;
      if (def.traits.brittleTail && rel < -0.5 && !m.tailBroken) {
        m.tailHits++;
        if (m.tailHits >= def.traits.brittleTail) {
          m.tailBroken = true;
          this.host.say(def.name + ": ogon pęka — żądło wyłączone.");
        }
      }
      if (def.traits.curl && m.curlMs <= 0 && !hit.tags.includes("ki")) {
        m.curlHits++;
        if (m.curlHits >= def.traits.curl.hits) {
          m.curlHits = 0;
          m.curlMs = def.traits.curl.ms;
          m.cast = undefined;
        }
      }
      if (def.traits.reflect && !hit.tags.includes("ki") && !hit.tags.includes("area")) {
        const back = Math.round(dmg * def.traits.reflect);
        if (back > 0) this.host.hurtPlayer(back, e, "other", true);
      }
    }
    m.castDamage += dmg;
    if (m.cast && def.traits.interrupt && m.castDamage >= e.maxHp * def.traits.interrupt.pct) {
      m.cast = undefined;
      m.stunMs = def.traits.interrupt.stun;
      this.host.say(def.name + ": ładowanie przerwane!");
    }
    if (def.traits.split && !m.split && e.hp > 0) this.split(e);
    if (e.hp <= 0) {
      if (def.traits.revive && !m.revived) {
        m.revived = true;
        e.hp = Math.max(1, Math.round(e.maxHp * def.traits.revive));
        m.invulnerable = true;
        m.phase = "recover";
        m.phaseMs = 1500;
        m.cast = undefined;
        m.charge = undefined;
        this.host.emit({ type: "respawn", x: e.x, y: e.y, target: e.id });
        this.host.say(def.name + " powraca!");
      } else this.die(e);
      return dmg;
    }
    if (!m.provoked) m.provoked = true;
    if (m.phase === "idle" && !hit.indirect) this.engage(e);
    if (
      def.traits.fleeAfterHits &&
      m.hitsTaken >= def.traits.fleeAfterHits.hits &&
      m.phase === "engage"
    ) {
      m.hitsTaken = 0;
      this.retreat(e, def.traits.fleeAfterHits.ms);
    }
    return dmg;
  }
  private engage(e: Enemy) {
    e.m.phase = "engage";
    e.m.engaged = true;
    e.m.hidden = false;
    e.mode = "chase";
  }
  private split(e: Enemy) {
    const t = e.m.def.traits.split!;
    const origMax = e.maxHp;
    const part = Math.max(1, Math.round(origMax * t.hpPct));
    e.maxHp = part;
    e.hp = Math.min(e.hp, part);
    e.m.split = true;
    const clone = this.spawn(e.kind, { x: e.x + 30, y: e.y + 20 });
    clone.maxHp = part;
    clone.hp = part;
    clone.m.split = true;
    clone.m.parent = e.id;
    clone.home = { ...e.home };
    this.engage(clone);
    this.splits.set(e.id, { cloneId: clone.id, origMax, ms: t.merge });
    this.host.say(e.m.def.name + " rozdziela się!");
  }
  private die(e: Enemy) {
    const m = e.m;
    const def = m.def;
    e.hp = 0;
    e.mode = "dead";
    e.timer = def.respawn;
    m.phase = "idle";
    m.hidden = false;
    m.invulnerable = false;
    m.cast = undefined;
    m.charge = undefined;
    m.volley = undefined;
    this.paths.delete(e.id);
    this.burnWebs(e);
    this.host.emit({ type: "death", x: e.x, y: e.y, target: e.id });
    const t = def.traits;
    if (t.explode) {
      this.host.emit({
        type: "telegraph",
        x: e.x,
        y: e.y,
        radius: t.explode.radius,
        ms: 0,
        ability: "explode",
      });
      if (distance(e, this.host.player) <= t.explode.radius && !this.host.player.dead) {
        const r = this.host.hurtPlayer(def.atk * t.explode.atk, e, "area");
        if (!r.evaded) for (const fx of t.explode.fx ?? []) this.host.applyPlayerFx(fx, e);
      }
    }
    if (t.deathZone) this.addZone(t.deathZone, e, e);
    this.host.killed(e);
  }

  // --- status effects from the player's abilities ----------------------------------------------
  stun(e: Enemy, ms: number) {
    if (e.mode === "dead" || e.m.hidden) return;
    e.fx.stunMs = Math.max(e.fx.stunMs, ms);
    e.m.cast = undefined;
    e.m.charge = undefined;
  }
  slow(e: Enemy, pct: number, ms: number) {
    e.fx.slow = {
      pct: Math.max(e.fx.slow.ms > 0 ? e.fx.slow.pct : 0, pct),
      ms: Math.max(e.fx.slow.ms, ms),
    };
  }
  weaken(e: Enemy, pct: number, ms: number) {
    e.fx.weaken = { pct, ms: Math.max(e.fx.weaken.ms, ms) };
  }
  burn(e: Enemy, dps: number, ms: number) {
    e.fx.dots.push({ dps, ms });
  }
  seal(e: Enemy, ms: number, bonus: number) {
    e.fx.seal = { ms, bonus };
  }
  mark(e: Enemy, ms: number, crit: number, def: number) {
    e.fx.mark = { ms, crit, def };
  }
  push(e: Enemy, from: Point, distancePx: number) {
    if (e.mode === "dead" || e.m.hidden || e.m.def.traits.still) return;
    const u = unit(from, e);
    const to = { x: e.x + u.x * distancePx, y: e.y + u.y * distancePx };
    if (e.m.def.traits.fly || e.m.def.traits.ghost) Object.assign(e, this.clampWorld(to));
    else Object.assign(e, this.host.nav.step(e, to, distancePx));
  }
  breakShield(e: Enemy) {
    e.m.guard = 0;
    e.m.guardMs = 0;
  }

  // --- zones --------------------------------------------------------------------------------
  addZone(spec: ZoneSpec, at: Point, owner: Enemy) {
    const z: ZoneState = {
      id: "z" + this.zoneSeq++,
      kind: spec.kind,
      x: at.x,
      y: at.y,
      radius: spec.radius,
      ms: spec.ms,
      dps: spec.dps,
      atk: owner.m.def.atk,
      owner: owner.id,
      machine: !!owner.m.def.traits.machine,
      fx: spec.fx ?? [],
      fxMs: 0,
    };
    this.zones.push(z);
    this.host.emit({
      type: "zone",
      x: z.x,
      y: z.y,
      radius: z.radius,
      ms: z.ms,
      kind: z.kind,
      ability: z.id,
    });
    return z;
  }
  private burnWebs(e: Enemy) {
    const ids = new Set(e.m.webs);
    this.zones = this.zones.filter((z) => !ids.has(z.id));
    e.m.webs = [];
  }
  private layWebs(e: Enemy) {
    const w = e.m.def.traits.webs!;
    for (let i = 0; i < w.max; i++) {
      const a = this.host.random() * Math.PI * 2;
      const r = 90 + this.host.random() * (w.radius - 90);
      const at = this.host.nav.safe({
        x: e.home.x + Math.cos(a) * r,
        y: e.home.y + Math.sin(a) * r,
      });
      e.m.webs.push(this.addZone(w.zone, at, e).id);
    }
  }
  private tickZones(dt: number) {
    const p = this.host.player;
    for (const z of this.zones) {
      z.ms -= dt;
      z.fxMs -= dt;
      if (p.dead || distance(z, p) > z.radius) continue;
      const owner = this.host.enemies.find((x) => x.id === z.owner);
      if (!owner) continue;
      if (z.dps > 0) this.host.hurtPlayer((z.atk * z.dps * dt) / 1000, owner, "dot", true);
      if (z.fx.length && z.fxMs <= 0) {
        z.fxMs = 400;
        for (const fx of z.fx) this.host.applyPlayerFx(fx, owner);
      }
    }
    this.zones = this.zones.filter((z) => z.ms > 0);
  }

  // --- the main loop ------------------------------------------------------------------------
  tick(dt: number) {
    this.tickZones(dt);
    for (const [pid, s] of [...this.splits]) {
      s.ms -= dt;
      if (s.ms > 0) continue;
      this.splits.delete(pid);
      const a = this.host.enemies.find((x) => x.id === pid);
      const b = this.host.enemies.find((x) => x.id === s.cloneId);
      if (a && b && a.mode !== "dead" && b.mode !== "dead") {
        a.maxHp = s.origMax;
        a.hp = Math.min(s.origMax, a.hp + b.hp);
        a.m.split = true;
        this.host.enemies.splice(this.host.enemies.indexOf(b), 1);
        this.host.say(a.m.def.name + " łączy się z powrotem.");
      }
    }
    for (const e of [...this.host.enemies]) this.step(e, dt);
    // summons and split parts that died are removed once their death has been reported
    this.host.enemies.splice(
      0,
      this.host.enemies.length,
      ...this.host.enemies.filter(
        (e) => !(e.mode === "dead" && e.m.def.respawn <= 0 && e.timer <= -1000),
      ),
    );
  }

  private decay(e: Enemy, dt: number) {
    const m = e.m;
    e.attackIn = Math.max(0, e.attackIn - dt);
    m.sinceHit += dt;
    for (const k of Object.keys(m.cooldowns))
      m.cooldowns[k] = Math.max(0, (m.cooldowns[k] ?? 0) - dt);
    if (m.guardMs > 0 && (m.guardMs -= dt) <= 0) m.guard = 0;
    if (m.reduceMs > 0 && (m.reduceMs -= dt) <= 0) m.reduce = 0;
    if (m.buffMs > 0 && (m.buffMs -= dt) <= 0) m.buff = 0;
    if (m.regenMs > 0) {
      m.regenMs -= dt;
      e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * m.regen * dt) / 1000);
    }
    if (m.curlMs > 0) m.curlMs -= dt;
    if (m.exposedMs > 0) m.exposedMs -= dt;
    if (m.heatMs > 0) m.heatMs -= dt;
    if (m.stunMs > 0) m.stunMs -= dt;
    const f = e.fx;
    f.stunMs = Math.max(0, f.stunMs - dt);
    f.slow.ms = Math.max(0, f.slow.ms - dt);
    f.weaken.ms = Math.max(0, f.weaken.ms - dt);
    if (f.seal && (f.seal.ms -= dt) <= 0) f.seal = null;
    if (f.mark && (f.mark.ms -= dt) <= 0) f.mark = null;
    if (f.dots.length) {
      let sum = 0;
      for (const d of f.dots) {
        sum += (d.dps * Math.min(dt, d.ms)) / 1000;
        d.ms -= dt;
      }
      f.dots = f.dots.filter((d) => d.ms > 0);
      if (sum > 0 && e.mode !== "dead") this.damage(e, sum, { tags: ["fire"], indirect: true });
    }
  }

  private step(e: Enemy, dt: number) {
    const m = e.m;
    const def = m.def;
    const host = this.host;
    const p = host.player;
    this.decay(e, dt);
    if (e.mode === "dead") {
      e.timer -= dt;
      if (def.respawn > 0 && e.timer <= 0 && distance(p, e.home) > 160) this.reset(e);
      return;
    }
    if (m.stunMs > 0 || e.fx.stunMs > 0) return;
    if (m.curlMs > 0) return;
    // phases that do not need a target
    if (m.phase === "recover") {
      m.phaseMs -= dt;
      if (m.phaseMs <= 0) {
        m.invulnerable = false;
        m.phase = "engage";
      }
      return;
    }
    const d = distance(e, p);
    if (m.phase === "under") {
      m.phaseMs -= dt;
      if (m.phaseMs <= 0) {
        m.invulnerable = false;
        m.phase = "hidden";
        m.hidden = true;
      }
      return;
    }
    if (m.phase === "hidden") return this.stepHidden(e, dt, d);
    if (m.phase === "retreat") return this.stepRetreat(e, dt, d);
    if (m.phase === "return") return this.stepReturn(e, dt);
    // detection
    if (m.phase === "idle") {
      const radius = def.agro * (def.traits.night && !host.isNight() ? def.traits.night.day : 1);
      const calm = def.traits.provoked && !m.provoked;
      if (!calm && !p.dead && d <= radius && host.nav.visible(e, p)) this.engage(e);
      else return this.stepIdle(e, dt);
    }
    // engaged
    // A ranged player may stand far from the monster's home; the leash grows by that reach so the
    // monster can still come to the shooter instead of returning and becoming untouchable.
    const reachBonus = Math.max(0, host.playerRange - 100);
    if (p.dead || distance(e, e.home) > def.traits.leash + reachBonus + 10) {
      if (def.traits.still && !p.dead) {
        /* turrets and plants never leave their place */
      } else return this.beginReturn(e);
    }
    if (d > Math.max(def.agro * 2 + 100, host.playerRange + 180) && !def.traits.still)
      return this.beginReturn(e);
    if (def.traits.provoked && m.sinceHit > (def.traits.giveUp ?? 6000) && !m.cast)
      return this.beginReturn(e);
    this.stepEngaged(e, dt, d);
  }

  private reset(e: Enemy) {
    const def = e.m.def;
    Object.assign(e, e.home);
    e.hp = e.maxHp = def.hp;
    e.m = newState(def, this.host.nowMs);
    e.fx = newFx();
    e.mode = "patrol";
    e.attackIn = 1000;
    e.timer = 1000;
    this.host.emit({ type: "respawn", x: e.x, y: e.y, target: e.id });
    if (def.traits.webs) this.layWebs(e);
  }

  // --- idle, return, hidden, retreat -----------------------------------------------------------
  private stepIdle(e: Enemy, dt: number) {
    const m = e.m;
    const t = m.def.traits;
    e.mode = "patrol";
    if (t.still) return;
    if (t.route) {
      const [ox, oy] = t.route[m.routeIndex % t.route.length]!;
      const goal = this.host.nav.safe({ x: e.home.x + ox, y: e.home.y + oy });
      this.moveTo(e, goal, BASE_SPEED * 0.4 * dt);
      if (distance(e, goal) < 12) m.routeIndex++;
      return;
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = 2800;
      const phase = (this.seq++ + e.id.length) * 2.4;
      const r = t.wander ?? 65;
      e.patrol = this.host.nav.safe({
        x: e.home.x + Math.cos(phase) * r,
        y: e.home.y + Math.sin(phase) * r,
      });
    }
    this.moveTo(e, e.patrol, dt * 0.035);
  }
  private beginReturn(e: Enemy) {
    e.m.phase = "return";
    e.m.cast = undefined;
    e.m.charge = undefined;
    e.m.volley = undefined;
    e.mode = "return";
    this.paths.delete(e.id);
  }
  private stepReturn(e: Enemy, dt: number) {
    this.moveTo(e, e.home, dt * 0.14);
    if (distance(e, e.home) < 8) {
      e.m.phase = e.m.def.traits.ambush ? "hidden" : "idle";
      e.m.hidden = !!e.m.def.traits.ambush;
      e.m.provoked = false;
      e.m.engaged = false;
      e.mode = "patrol";
      if (!e.m.def.traits.noRegen) e.hp = e.maxHp;
      e.timer = 1000;
    }
  }
  private stepHidden(e: Enemy, dt: number, d: number) {
    const m = e.m;
    const t = m.def.traits;
    const p = this.host.player;
    if (m.cast) {
      m.cast.ms -= dt;
      if (m.cast.ms <= 0) this.resolveCast(e);
      return;
    }
    if (m.phaseMs > 0) {
      m.phaseMs -= dt;
      return;
    }
    if (p.dead) return;
    if (t.ambush && d <= t.ambush.reveal && this.host.nav.visible(e, p)) {
      m.hidden = false;
      m.phase = "engage";
      m.engaged = true;
      e.mode = "chase";
      m.nextAttack = 0;
      m.cooldowns = {};
      return;
    }
    if (t.burrow && d <= m.def.agro) {
      const skill = m.def.skills[0];
      const away = unit(p, e);
      const at =
        skill?.mode === "burst"
          ? { x: p.x, y: p.y }
          : this.host.nav.safe({ x: p.x + away.x * 50, y: p.y + away.y * 50 });
      const telegraph = skill?.telegraph ?? 600;
      m.cast = {
        skill: skill ?? { id: "surface", name: "", mode: "burst", cd: 0, range: 0 },
        ms: telegraph,
        at,
        opener: false,
      };
      m.castDamage = 0;
      this.host.emit({
        type: "telegraph",
        x: at.x,
        y: at.y,
        radius: skill?.radius ?? 60,
        ms: telegraph,
        ability: "surface",
      });
    }
  }
  private retreat(e: Enemy, ms: number, hide = false, regen = 0) {
    const m = e.m;
    m.phase = "retreat";
    m.phaseMs = ms;
    m.cast = undefined;
    m.charge = undefined;
    m.volley = undefined;
    if (hide) {
      m.hidden = true;
      m.invulnerable = true;
      m.regen = regen;
      m.regenMs = ms;
    }
  }
  private stepRetreat(e: Enemy, dt: number, d: number) {
    const m = e.m;
    const t = m.def.traits;
    m.phaseMs -= dt;
    const p = this.host.player;
    if (!m.hidden && !t.still) {
      const u = unit(p, e);
      const goal = { x: e.x + u.x * 160, y: e.y + u.y * 160 };
      if (distance(goal, e.home) <= t.leash * 1.3) this.moveTo(e, goal, this.speed(e) * dt * 1.1);
      else this.moveTo(e, e.home, this.speed(e) * dt);
    }
    if (m.phaseMs > 0) return;
    m.invulnerable = false;
    m.hidden = false;
    m.regenMs = 0;
    if (t.ambush) {
      m.phase = "hidden";
      m.hidden = true;
      m.phaseMs = t.ambush.hide;
      m.nextAttack = 0;
    } else m.phase = d > 0 ? "engage" : "engage";
  }

  // --- engaged: choosing and executing actions --------------------------------------------------
  private speed(e: Enemy) {
    const m = e.m;
    const t = m.def.traits;
    let s = BASE_SPEED * m.def.speed;
    if (e.fx.slow.ms > 0) s *= 1 - e.fx.slow.pct;
    if (t.rage && e.hp / e.maxHp < t.rage.below) s *= 1 + t.rage.speed * 0.5;
    if (t.slowBelow && e.hp / e.maxHp < t.slowBelow.hp) s *= t.slowBelow.mult;
    if (
      t.webSlow &&
      !m.webs.some((id) => {
        const z = this.zones.find((x) => x.id === id);
        return z && distance(z, e) < z.radius + 10;
      })
    )
      s *= t.webSlow;
    return s;
  }
  private clampWorld(p: Point): Point {
    const w = this.host.world;
    return { x: clamp(p.x, 20, w.width - 20), y: clamp(p.y, 20, w.height - 20) };
  }
  private moveTo(e: Enemy, goal: Point, amount: number) {
    const t = e.m.def.traits;
    if (e.m.hidden) return;
    const before = { x: e.x, y: e.y };
    if (t.fly || t.ghost) {
      const d = distance(e, goal);
      if (d < 1e-6) return;
      const k = Math.min(1, amount / d);
      Object.assign(
        e,
        this.clampWorld({ x: e.x + (goal.x - e.x) * k, y: e.y + (goal.y - e.y) * k }),
      );
    } else {
      let route = this.paths.get(e.id);
      if (!route || distance(route.goal, goal) > 36 || route.remaining <= 0) {
        route = {
          goal: { x: goal.x, y: goal.y },
          points: this.host.nav.path(e, goal),
          remaining: 700,
        };
        this.paths.set(e.id, route);
      }
      route.remaining -= amount / Math.max(0.001, BASE_SPEED);
      if (!route.points.length) return;
      const next = route.points[0]!;
      Object.assign(e, this.host.nav.step(e, next, amount));
      if (distance(e, next) < 5) route.points.shift();
    }
    const moved = distance(before, e);
    if (moved > 0.01) {
      e.m.facing = unit(before, e);
      if (t.trail) {
        e.m.trailMs -= moved / BASE_SPEED;
        if (e.m.trailMs <= 0) {
          e.m.trailMs = 400;
          this.addZone(t.trail, e, e);
        }
      }
    }
  }
  private face(e: Enemy, to: Point) {
    e.m.facing = unit(e, to);
  }
  private damageMult(e: Enemy) {
    const m = e.m;
    const t = m.def.traits;
    let k = 1;
    if (m.buffMs > 0) k += m.buff;
    if (t.rage) {
      const frac = e.hp / e.maxHp;
      k += t.rage.dmg * clamp((1 - frac) / 0.7, 0, 1);
    }
    if (m.nextAttack) {
      k += m.nextAttack;
      m.nextAttack = 0;
    }
    return k;
  }
  /** Hits the player. Returns false when the player evaded (invulnerable), so effects are skipped. */
  private hitPlayer(e: Enemy, mult: number, kind: HurtKind, fx: FxSpec[] | undefined, extra = 1) {
    const raw = e.m.def.atk * mult * this.damageMult(e) * extra;
    this.host.emit({
      type: "attack",
      x: e.x,
      y: e.y,
      source: e.id,
      target: "player",
      to: { x: this.host.player.x, y: this.host.player.y },
      kind,
    });
    const r = this.host.hurtPlayer(raw, e, kind);
    if (!r.evaded) for (const f of fx ?? []) this.host.applyPlayerFx(f, e);
    return !r.evaded;
  }

  private ready(e: Enemy, s: SkillSpec) {
    const m = e.m;
    if (m.cooldowns[s.id]! > 0) return false;
    if (s.once && m.used.has(s.id)) return false;
    if (s.below !== undefined && e.hp / e.maxHp >= s.below) return false;
    if (s.opener && !(m.attackCount === 0)) return false;
    if (m.tailBroken && s.id === "zadlo") return false;
    return true;
  }
  private allies(e: Enemy, range: number) {
    return this.host.enemies.filter(
      (x) => x !== e && x.mode !== "dead" && !x.m.hidden && distance(x, e) <= range,
    );
  }
  private stepEngaged(e: Enemy, dt: number, d: number) {
    const m = e.m;
    const def = m.def;
    const t = def.traits;
    const p = this.host.player;
    e.mode = "chase";
    if (t.burrow) {
      m.phaseMs -= dt;
      if (m.phaseMs <= 0 && !m.cast && !m.charge) {
        m.phase = "under";
        m.phaseMs = t.burrow.under;
        m.hidden = true;
        m.invulnerable = true;
        this.host.emit({ type: "status", x: e.x, y: e.y, target: e.id, text: "Zakopuje się" });
        return;
      }
    }
    if (m.cast) {
      m.cast.ms -= dt;
      if (!t.still) this.face(e, p);
      if (m.cast.ms <= 0) this.resolveCast(e);
      return;
    }
    if (m.charge) return this.runCharge(e, dt);
    if (m.volley) return this.runVolley(e, dt);
    // turret aim
    if (t.turret) this.aimTurret(e, dt);
    else this.face(e, p);
    // triggers that change phase
    if (t.retreat && e.hp / e.maxHp < t.retreat.below && !m.used.has("retreat")) {
      m.used.add("retreat");
      if (t.retreat.hide) {
        this.retreat(e, t.retreat.ms, true, t.retreat.regen ?? 0);
        this.host.emit({ type: "status", x: e.x, y: e.y, target: e.id, text: "Ukrywa się" });
      } else this.retreat(e, t.retreat.ms);
      return;
    }
    if (t.dive && m.attacksMade >= t.dive.attacks) {
      m.attacksMade = 0;
      this.retreat(e, t.dive.away);
      return;
    }
    if (t.turret && m.heatMs > 0) return;
    // skills
    const action = this.pickSkill(e, d);
    if (action) return this.useSkill(e, action, d);
    // basic attack
    const medicBusy =
      t.medic !== undefined && this.allies(e, t.medic).some((a) => a.hp < a.maxHp * 0.95);
    const opportunistic =
      t.opportunist !== undefined && p.hp >= this.host.playerMaxHp * t.opportunist;
    if (def.basic !== "none" && def.range > 0 && !medicBusy && !opportunistic) {
      const inReach =
        d <= def.range &&
        (def.basic === "melee"
          ? this.host.nav.visible(e, p) || t.ghost || t.fly
          : this.host.nav.visible(e, p) || t.fly);
      if (inReach && e.attackIn <= 0) return this.basicAttack(e);
    }
    this.positioning(e, dt, d, medicBusy || opportunistic);
  }
  private aimTurret(e: Enemy, dt: number) {
    const m = e.m;
    const p = this.host.player;
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    let diff = want - m.aim;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = ((m.def.traits.turret!.turn * Math.PI) / 180) * (dt / 1000);
    m.aim += clamp(diff, -maxTurn, maxTurn);
    m.facing = { x: Math.cos(m.aim), y: Math.sin(m.aim) };
  }
  private aimed(e: Enemy) {
    const p = this.host.player;
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    const diff = Math.atan2(Math.sin(want - e.m.aim), Math.cos(want - e.m.aim));
    return Math.abs(diff) < (12 * Math.PI) / 180;
  }
  private positioning(e: Enemy, dt: number, d: number, circle: boolean) {
    const m = e.m;
    const t = m.def.traits;
    const p = this.host.player;
    if (t.still || m.heatMs > 0) return;
    const spd = this.speed(e) * dt;
    const reach = Math.max(30, m.def.range * 0.8);
    if (circle) {
      const around = Math.atan2(e.y - p.y, e.x - p.x) + 0.5 * m.orbit;
      const ring = Math.max(120, t.keep ?? 150);
      this.moveTo(e, { x: p.x + Math.cos(around) * ring, y: p.y + Math.sin(around) * ring }, spd);
      return;
    }
    if (t.keep) {
      if (d < t.keep - 30) {
        const u = unit(p, e);
        this.moveTo(e, { x: e.x + u.x * 100, y: e.y + u.y * 100 }, spd);
      } else if (d > t.keep + 25) this.moveTo(e, p, spd);
      return;
    }
    if (t.flank && d > m.def.range * 1.5) {
      const around = Math.atan2(e.y - p.y, e.x - p.x) + 0.45 * m.orbit;
      this.moveTo(
        e,
        { x: p.x + Math.cos(around) * d * 0.9, y: p.y + Math.sin(around) * d * 0.9 },
        spd,
      );
      return;
    }
    if (d > reach) this.moveTo(e, p, spd);
  }

  private pickSkill(e: Enemy, d: number): SkillSpec | undefined {
    const m = e.m;
    const t = m.def.traits;
    const p = this.host.player;
    for (const s of m.def.skills) {
      if (!this.ready(e, s)) continue;
      if (s.mode === "self") {
        if (s.call !== undefined) return s;
        if (s.summon) return s;
        if (s.heal) {
          if (this.allies(e, s.range).some((a) => a.hp < a.maxHp * 0.95)) return s;
          continue;
        }
        if (s.guard) {
          if (m.guard <= 0) return s;
          continue;
        }
        if (s.reduce) {
          if (d <= 260) return s;
          continue;
        }
        if (s.buff) {
          if (this.allies(e, s.range).length) return s;
          continue;
        }
        if (s.nextAttack) {
          if (!m.nextAttack && d <= m.def.range + 40) return s;
          continue;
        }
        continue;
      }
      if (t.opportunist !== undefined && p.hp >= this.host.playerMaxHp * t.opportunist) continue;
      if (s.aimed && !this.aimed(e)) continue;
      if (d > s.range) continue;
      if (!(t.fly || t.ghost) && !this.host.nav.visible(e, p) && s.mode !== "burst") continue;
      if (t.medic !== undefined && this.allies(e, t.medic).some((a) => a.hp < a.maxHp * 0.95))
        continue;
      return s;
    }
    return undefined;
  }
  private basicAttack(e: Enemy) {
    const m = e.m;
    const def = m.def;
    const t = def.traits;
    let cd = def.attackCd;
    if (t.rage && e.hp / e.maxHp < t.rage.below) cd *= 1 - t.rage.speed;
    e.attackIn = cd;
    this.face(e, this.host.player);
    let extra = 1;
    if (t.ramp) {
      extra += t.ramp * m.scanStacks;
      m.scanStacks = Math.min(4, m.scanStacks + 1);
    }
    const kind: HurtKind = def.basic === "ranged" ? "projectile" : "melee";
    this.hitPlayer(e, 1, kind, def.basicFx, extra);
    m.attackCount++;
    m.attacksMade++;
  }
  private useSkill(e: Enemy, s: SkillSpec, d: number) {
    const m = e.m;
    const t = m.def.traits;
    let cd = s.cd;
    if (t.rage && e.hp / e.maxHp < t.rage.below) cd *= 1 - t.rage.speed;
    m.cooldowns[s.id] = cd;
    if (s.once) m.used.add(s.id);
    const p = this.host.player;
    this.face(e, p);
    if (s.mode === "self") return this.useSelf(e, s);
    const opener = !!s.opener && m.attackCount === 0;
    const at = s.centred ? { x: e.x, y: e.y } : { x: p.x, y: p.y };
    if (s.mode === "leap") {
      m.charge = { to: { x: p.x, y: p.y }, skill: s, hit: false };
      return;
    }
    if (s.telegraph && s.telegraph > 0) {
      m.cast = { skill: s, ms: s.telegraph, at, opener };
      m.castDamage = 0;
      const radius = s.mode === "burst" ? (s.radius ?? 100) : Math.max(40, s.range * 0.6);
      this.host.emit({
        type: "telegraph",
        x: s.mode === "charge" ? e.x : at.x,
        y: s.mode === "charge" ? e.y : at.y,
        radius,
        ms: s.telegraph,
        ability: s.id,
        ...(s.mode === "charge" ? { to: { x: p.x, y: p.y } } : {}),
      });
      void d;
      return;
    }
    m.cast = { skill: s, ms: 0, at, opener };
    this.resolveCast(e);
  }
  private useSelf(e: Enemy, s: SkillSpec) {
    const m = e.m;
    this.host.emit({ type: "status", x: e.x, y: e.y, target: e.id, text: s.name, ability: s.id });
    if (s.call !== undefined) {
      let n = s.call;
      const near = this.host.enemies
        .filter((x) => x !== e && x.mode !== "dead" && !x.m.engaged && distance(x, e) <= 600)
        .sort((a, b) => distance(a, e) - distance(b, e));
      for (const x of near) {
        if (n-- <= 0) break;
        x.m.provoked = true;
        x.m.hidden = false;
        this.engage(x);
      }
    }
    if (s.summon) {
      for (let i = 0; i < s.summon.count; i++) {
        const a = (Math.PI * 2 * i) / s.summon.count + 0.5;
        const minion = this.spawn(s.summon.kind, {
          x: e.x + Math.cos(a) * 40,
          y: e.y + Math.sin(a) * 40,
        });
        minion.m.parent = e.id;
        this.engage(minion);
      }
    }
    if (s.heal)
      for (const a of this.allies(e, s.range)) {
        a.m.regen = s.heal.pct;
        a.m.regenMs = s.heal.ms;
      }
    if (s.guard) {
      m.guard = e.maxHp * s.guard.pct;
      m.guardMs = s.guard.ms;
    }
    if (s.reduce) {
      m.reduce = s.reduce.pct;
      m.reduceMs = s.reduce.ms;
    }
    if (s.buff) {
      const targets = s.range > 0 ? this.allies(e, s.range) : [e];
      for (const a of targets) {
        a.m.buff = s.buff.pct;
        a.m.buffMs = s.buff.ms;
      }
    }
    if (s.nextAttack) m.nextAttack = s.nextAttack;
  }
  private resolveCast(e: Enemy) {
    const m = e.m;
    const c = m.cast;
    if (!c) return;
    m.cast = undefined;
    const s = c.skill;
    const p = this.host.player;
    if (m.phase === "hidden") {
      // surfacing from underground / out of the bushes
      Object.assign(e, c.at);
      m.hidden = false;
      m.phase = "engage";
      m.engaged = true;
      m.phaseMs = m.def.traits.burrow?.up ?? 0;
      e.mode = "chase";
      m.cooldowns = { [s.id]: s.cd };
    }
    switch (s.mode) {
      case "melee":
      case "ranged": {
        const reach = s.mode === "melee" ? s.range + 24 : s.range + 40;
        const total = s.volley ?? 1;
        const first = distance(e, p) <= reach && !p.dead;
        if (first) this.hitSkill(e, s, c.opener);
        else if (s.mode === "melee") {
          /* the player stepped out of reach during the wind-up */
        }
        if (total > 1)
          m.volley = {
            skill: s,
            left: total - 1,
            next: s.mode === "melee" ? 260 : 220,
            opener: false,
          };
        this.finishAttack(e);
        break;
      }
      case "burst": {
        const radius = s.radius ?? 100;
        this.host.emit({
          type: "telegraph",
          x: c.at.x,
          y: c.at.y,
          radius,
          ms: 0,
          ability: s.id + ":hit",
        });
        if (!p.dead && distance(c.at, p) <= radius + 12) {
          if ((s.dmg ?? 0) > 0) {
            const evaded = !this.hitPlayer(e, s.dmg!, "area", s.fx);
            void evaded;
          } else for (const f of s.fx ?? []) this.host.applyPlayerFx(f, e);
        }
        if (s.zone) this.addZone(s.zone, c.at, e);
        this.finishAttack(e);
        break;
      }
      case "charge": {
        const u = unit(e, p);
        const run = Math.max(distance(e, p) + 120, s.range);
        m.charge = {
          to: this.clampWorld({ x: e.x + u.x * run, y: e.y + u.y * run }),
          skill: s,
          hit: false,
        };
        break;
      }
      default:
        break;
    }
  }
  private hitSkill(e: Enemy, s: SkillSpec, opener: boolean) {
    const kind: HurtKind = s.mode === "ranged" ? "projectile" : "melee";
    const connected =
      (s.dmg ?? 0) > 0
        ? this.hitPlayer(e, s.dmg!, kind, s.fx, opener && s.opener ? s.opener : 1)
        : (this.applyOnly(e, s), true);
    void connected;
  }
  private applyOnly(e: Enemy, s: SkillSpec) {
    this.host.emit({
      type: "attack",
      x: e.x,
      y: e.y,
      source: e.id,
      target: "player",
      to: { x: this.host.player.x, y: this.host.player.y },
      kind: "projectile",
    });
    for (const f of s.fx ?? []) this.host.applyPlayerFx(f, e);
  }
  private finishAttack(e: Enemy) {
    const m = e.m;
    m.attackCount++;
    m.attacksMade++;
    const t = m.def.traits;
    if (t.ambush && m.attackCount >= 1 && m.phase === "engage") {
      m.attackCount = 0;
      this.retreat(e, 1200);
    }
    if (t.turret) {
      m.shots += m.def.skills[0]?.volley ?? 1;
      if (m.shots >= t.turret.shots) {
        m.shots = 0;
        m.heatMs = t.turret.off;
        this.host.say(m.def.name + " przegrzewa się!");
      }
    }
  }
  private runVolley(e: Enemy, dt: number) {
    const m = e.m;
    const v = m.volley!;
    v.next -= dt;
    this.face(e, this.host.player);
    if (v.next > 0) return;
    const s = v.skill;
    v.left--;
    v.next = s.mode === "melee" ? 260 : 220;
    const p = this.host.player;
    if (!p.dead && distance(e, p) <= s.range + 40) this.hitSkill(e, s, false);
    if (m.def.traits.turret) {
      m.shots++;
      if (m.shots >= m.def.traits.turret.shots) {
        m.shots = 0;
        m.heatMs = m.def.traits.turret.off;
        v.left = 0;
        this.host.say(m.def.name + " przegrzewa się!");
      }
    }
    if (v.left <= 0) m.volley = undefined;
  }
  private runCharge(e: Enemy, dt: number) {
    const m = e.m;
    const c = m.charge!;
    const p = this.host.player;
    const leap = c.skill.mode === "leap";
    const speed = (leap ? 0.55 : 0.5) * dt;
    const before = { x: e.x, y: e.y };
    const goal = leap ? { x: p.x, y: p.y } : c.to;
    const left = distance(e, goal);
    const step = Math.min(speed, left);
    const u = unit(e, goal);
    let to = { x: e.x + u.x * step, y: e.y + u.y * step };
    if (!m.def.traits.fly && !m.def.traits.ghost) {
      const moved = this.host.nav.step(e, to, step);
      to = moved;
    } else to = this.clampWorld(to);
    Object.assign(e, to);
    m.facing = unit(before, e);
    const blocked = distance(before, e) < step * 0.4 && step > 0.5;
    const reach = leap ? 70 : 52;
    if (!c.hit && !p.dead && distance(e, p) <= reach) {
      c.hit = true;
      this.hitPlayer(e, c.skill.dmg ?? 1, "melee", c.skill.fx);
      m.charge = undefined;
      m.attackCount++;
      m.attacksMade++;
      if (!leap) m.exposedMs = 0;
      return;
    }
    if (left <= step + 1 || blocked) {
      m.charge = undefined;
      m.attackCount++;
      m.attacksMade++;
      if (!leap) {
        const s = c.skill;
        if (s.missStun) m.stunMs = s.missStun;
        if (s.exposed) {
          m.exposed = s.exposed;
          m.exposedMs = Math.max(s.missStun ?? 0, 2000);
        }
        this.host.emit({ type: "status", x: e.x, y: e.y, target: e.id, text: "Chybił!" });
      }
    }
  }

  /** Loot rolls for a dead monster (the session creates the drop). Deterministic through `random()`. */
  rollLoot(e: Enemy): DropRoll[] {
    const def = e.m.def;
    const out: DropRoll[] = [];
    for (const entry of def.loot) {
      if (this.host.random() > entry.chance) continue;
      out.push({ item: entry.name === "tusk" ? "tusk" : slug(entry.name), quantity: 1, gold: 0 });
    }
    const [lo, hi] = def.gold;
    const gold = hi > 0 ? lo + Math.floor(this.host.random() * (hi - lo + 1)) : 0;
    if (gold > 0) {
      if (out.length) out[0]!.gold = gold;
      else out.push({ item: "", quantity: 0, gold });
    }
    return out;
  }
}
