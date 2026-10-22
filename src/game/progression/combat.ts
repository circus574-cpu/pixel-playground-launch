import { stats, type Enemy, type GameEvent, type GameSession } from "../session";
import { distance, type Point } from "../navigation";
import { skillId, NODES, type SkillNode } from "./catalog";
import { raceDamage, skillCost } from "./model";

type Timed = { left: number; value: number };
type GroundCircle = Point & { radius: number; left: number; defense: number; slow: number };
/** Uses only simulation time. Rendering and React never determine a hit or cooldown. */
export class RaceCombat {
  private buffs = new Map<string, Timed>();
  private marks = new Map<string, number>();
  private slows = new Map<string, Timed>();
  private stuns = new Map<string, number>();
  private jobs: { left: number; run: () => void; channel: number | null }[] = [];
  private circles: GroundCircle[] = [];
  private channel: { id: number; code: string; left: number } | null = null;
  private channelId = 0;
  private shield = { left: 0, hp: 0, melee: 0, projectile: 0, mirror: false };
  private silence = 0;
  private combo = 0;
  private comboIn = 0;
  private shotIn = 0;
  private combatTime = 0;
  private lastCombat = 6000;
  private lifeGuardUsed = false;
  constructor(
    private game: GameSession,
    private hurt: (e: Enemy, damage: number) => void,
    private emit: (e: GameEvent) => void,
  ) {
    const t = this.tree;
    if (t) {
      this.buffs = new Map(Object.entries(t.buffs));
      if (t.barrier) this.shield = { ...t.barrier };
    }
  }
  private get p() {
    return this.game.player;
  }
  private get tree() {
    return this.p.progression;
  }
  private has(code: string) {
    return this.tree?.learned.includes(skillId(this.p.race, code)) ?? false;
  }
  private buff(name: string) {
    return (this.buffs.get(name)?.left ?? 0) > 0;
  }
  private addBuff(name: string, left: number, value = 1) {
    this.buffs.set(name, { left, value });
    this.persist();
  }
  get busy() {
    return this.channel !== null;
  }
  get locked() {
    return (
      this.silence > 0 ||
      this.buff("stun") ||
      ((this.tree?.shutdown ?? 0) > 0 && (this.tree?.shutdown ?? 0) <= 2000)
    );
  }
  get inCombat() {
    return this.combatTime > 0;
  }
  get hasEffects() {
    return (
      this.jobs.length > 0 || this.buffs.size > 0 || this.shield.left > 0 || this.circles.length > 0
    );
  }
  get speed() {
    let v = stats(this.p).speed;
    if (this.buff("slow")) v *= 1 - (this.buffs.get("slow")?.value ?? 0);
    if (this.p.race === "planetary") {
      if (this.buff("wind")) v *= 1.15;
      if (this.buff("form")) v *= 1.1;
      if (this.has("B2") && this.terrain === "water") v *= 1.08;
    }
    return v;
  }
  get kiRegen() {
    let v = stats(this.p).kiRegen;
    if (this.p.race === "planetary" && this.has("B2") && this.terrain === "forest") v *= 1.3;
    if (this.p.race === "legend" && this.has("C6") && (this.tree?.resource ?? 0) >= 100) v *= 1.5;
    return v;
  }
  get terrain(): "forest" | "rock" | "water" {
    const patches = this.game.world.adaptationZones;
    const found = patches?.find(
      (z) =>
        this.p.x >= z.x &&
        this.p.x <= z.x + z.width &&
        this.p.y >= z.y &&
        this.p.y <= z.y + z.height,
    );
    return found?.kind ?? (this.game.world.id === "verdant" ? "forest" : "rock");
  }
  private get defense() {
    let defense = stats(this.p).defense;
    if (this.buff("form") && this.p.race !== "legend") defense *= 1.15;
    if (this.buff("fortify")) defense *= 1.6;
    if (this.buff("dodge-defense")) defense *= 1.2;
    if (this.p.race === "planetary" && this.has("B2") && this.terrain === "rock") defense *= 1.1;
    if (this.buff("rage") && !this.has("B8")) defense *= 0.8;
    const circle = Math.max(
      0,
      ...this.circles.filter((c) => distance(c, this.p) <= c.radius).map((c) => c.defense),
    );
    return defense * (1 + circle);
  }
  private attack() {
    let a = stats(this.p).attack;
    if (this.buff("form"))
      a *= this.p.race === "planetary" ? 1.2 : this.p.race === "legend" ? 1.3 : 1.25;
    if (this.buff("rage")) a *= this.has("B7") ? 1.4 : 1.3;
    if (this.p.race === "legend") a *= 1 + (this.tree?.resource ?? 0) * 0.001;
    return a;
  }
  private enterCombat() {
    if (
      this.combatTime <= 0 &&
      this.lastCombat >= 5000 &&
      this.p.race === "legend" &&
      this.has("C5") &&
      this.tree
    )
      this.tree.resource = Math.max(20, this.tree.resource);
    this.combatTime = 4500;
    this.lastCombat = 0;
  }
  private schedule(ms: number, run: () => void, channel: number | null = null) {
    this.jobs.push({ left: ms, run, channel });
  }
  private heal(fraction: number) {
    const s = stats(this.p),
      before = this.p.hp;
    this.p.hp = Math.min(s.maxHp, this.p.hp + s.maxHp * fraction);
    this.emit({ type: "heal", ...this.p, text: `+${Math.round(this.p.hp - before)} HP` });
  }
  private restoreKi(value: number) {
    this.p.ki = Math.min(stats(this.p).maxKi, this.p.ki + value);
  }
  private giveShield(fraction: number, seconds: number, melee = 0, projectile = 0, mirror = false) {
    // Strongest remainder replaces; recasting never adds capacities together.
    const hp = stats(this.p).maxHp * fraction;
    this.shield = {
      left: seconds * 1000,
      hp: Math.max(hp, this.shield.hp),
      melee,
      projectile,
      mirror,
    };
    this.persist();
    this.emit({ type: "shield", ...this.p, text: `Osłona ${Math.round(hp)} HP` });
  }
  private circle(
    seconds: number,
    defense: number,
    slow: number,
    radius = 160,
    center: Point = this.p,
  ) {
    this.circles.push({ x: center.x, y: center.y, radius, left: seconds * 1000, defense, slow });
    if (this.circles.length > 12) this.circles.shift();
  }
  private get free() {
    return this.buff("free");
  }
  private cooldown(n: SkillNode) {
    let v = n.cooldown;
    if (n.id === "planetary.A1" && this.has("A8")) v *= 0.7;
    if (n.id === "sage.A1" && this.has("A3")) v *= 0.8;
    if (n.id === "android.B1" && this.has("B8")) v *= 0.65;
    if (n.race === "sage" && this.buff("form") && n.kind !== "form") v *= 0.7;
    return Math.max(1000, v);
  }
  private targets(range: number, center: Point = this.p) {
    return this.game.enemies.filter(
      (e) =>
        e.hp > 0 &&
        e.mode !== "return" &&
        distance(e, center) <= range &&
        this.game.nav.visible(center, e),
    );
  }
  private pick(range: number) {
    const target = this.game.target;
    if (target)
      return distance(this.p, target) <= range &&
        this.game.nav.visible(this.p, target) &&
        target.mode !== "return"
        ? target
        : undefined;
    const e = this.targets(range).sort((a, b) => distance(a, this.p) - distance(b, this.p))[0];
    if (e) this.game.targetId = e.id;
    return e;
  }
  private strike(
    e: Enemy,
    multiplier: number,
    share = 1,
    bonus = 1,
    forcedCrit = false,
    generateResource = true,
  ) {
    if (e.hp <= 0 || e.mode === "return" || this.p.dead) return;
    this.enterCombat();
    let attack = this.attack() * bonus;
    if (this.p.race === "sage" && this.has("A2") && this.marks.has(e.id)) attack *= 1.1;
    if (this.p.race === "android" && this.has("A7") && this.marks.has(e.id)) attack *= 1.4;
    if (this.p.race === "legend" && this.has("A8") && this.targets(200).length === 1)
      attack *= 1.25;
    const crit = stats(this.p).crit + (this.p.race === "android" && this.marks.has(e.id) ? 15 : 0);
    const critical = generateResource && (forcedCrit || Math.random() < Math.min(100, crit) / 100);
    // Current field enemies are legacy boars. Their provisional defense is 3.
    const defense =
      (e.defense ?? 3) *
      (this.p.race === "android" && this.has("A5") && this.marks.has(e.id) ? 0.9 : 1);
    this.hurt(e, raceDamage(attack, multiplier, defense, share, critical));
    if (this.p.race === "legend" && generateResource && this.tree)
      this.tree.resource = Math.min(100, this.tree.resource + (this.has("C2") ? 6 : 4));
  }
  private multi(
    targets: Enemy[],
    total: number,
    hits: number,
    interval: number,
    bonus = 1,
    channel: number | null = null,
  ) {
    for (let i = 0; i < hits; i++) {
      const hit = () => targets.forEach((e) => this.strike(e, total / hits, 1 / hits, bonus));
      if (i === 0) hit();
      else this.schedule(i * interval, hit, channel);
    }
  }
  private control(e: Enemy, stun: number, slow = 0, duration = 0) {
    if (stun) this.stuns.set(e.id, Math.max(stun, this.stuns.get(e.id) ?? 0));
    if (slow) this.slows.set(e.id, { left: duration, value: slow });
  }
  private dot(e: Enemy, multiplier: number, seconds: number) {
    // Same source/target refresh is deduplicated with a generation token.
    const key = "dot:" + e.id,
      token = ++this.channelId;
    this.addBuff(key, seconds * 1000, token);
    for (let i = 1; i <= seconds; i++)
      this.schedule(i * 1000, () => {
        if (this.buffs.get(key)?.value === token)
          this.strike(e, multiplier / seconds, 1 / seconds, 1, false, false);
      });
  }
  private dash(length: number, target?: Enemy) {
    const dx = target ? target.x - this.p.x : this.game.facing.x,
      dy = target ? target.y - this.p.y : this.game.facing.y;
    const norm = Math.hypot(dx, dy) || 1,
      max = target ? Math.min(length, Math.max(0, norm - 45)) : length;
    const start = { x: this.p.x, y: this.p.y };
    // Sweep instead of safe(endpoint), which could jump through a wall.
    for (let at = 8; at <= max + 8; at += 8) {
      const amount = Math.min(max, at),
        next = { x: start.x + (dx / norm) * amount, y: start.y + (dy / norm) * amount };
      if (!this.game.nav.walkable(next) || !this.game.nav.visible(this.p, next)) break;
      Object.assign(this.p, next);
    }
  }
  onMove() {
    if (this.channel && !(this.p.race === "sage" && this.channel.code === "C1" && this.has("C8")))
      this.cancelChannel();
  }
  private cancelChannel() {
    if (!this.channel) return;
    const id = this.channel.id;
    this.jobs = this.jobs.filter((j) => j.channel !== id);
    this.channel = null;
    this.game.say("Kanałowanie przerwane; koszt i odnowienie pozostają.");
  }
  basic() {
    const p = this.p,
      t = this.tree,
      s = stats(p);
    if (!t || this.locked || this.busy || t.overheat > 0 || p.cooldowns.attack > 0) return;
    const e = this.pick(s.range);
    if (!e) {
      this.game.autoAttack = true;
      return;
    }
    this.enterCombat();
    const d = distance(p, e) || 1;
    this.game.facing = { x: (e.x - p.x) / d, y: (e.y - p.y) / d };
    this.emit({ type: "attack", ...p, ability: "attack", target: e.id, to: { x: e.x, y: e.y } });
    this.combo = this.comboIn > 0 ? this.combo + 1 : 1;
    this.comboIn = 4000;
    const bonus = this.buff("after-dodge") ? 1.25 : 1;
    this.strike(
      e,
      p.race === "planetary" && this.combo % 3 === 0 ? 1.3 : 1,
      1,
      bonus,
      this.buff("dodge-crit"),
    );
    this.buffs.delete("after-dodge");
    this.buffs.delete("dodge-crit");
    if (p.race === "legend") {
      if (this.has("A3") && this.combo % 3 === 0) this.addBuff("combo-speed", 4000);
    }
    if (p.race === "android") {
      this.shotIn = 1200;
      t.resource = Math.min(this.resourceMax, t.resource + 4 * (this.has("C3") ? 0.85 : 1));
      if (this.has("A8"))
        this.targets(s.range)
          .filter((other) => other !== e && distance(other, e) < 150)
          .slice(0, 2)
          .forEach((other) => this.strike(other, 0.4, 0.4, 1, false, false));
      if (t.resource >= this.resourceMax && !this.has("C8") && !this.buff("form"))
        t.overheat = this.has("C2") ? 1000 : 2000;
    }
    p.cooldowns.attack = s.interval * (this.buff("combo-speed") ? 0.9 : 1);
    this.game.flush();
  }
  cast(id: string) {
    const p = this.p,
      t = this.tree,
      n = NODES[id];
    if (
      !t ||
      !n ||
      n.race !== p.race ||
      !t.learned.includes(id) ||
      (!t.loadout.includes(id) && n.kind !== "form")
    )
      return this.game.say("Umiejętność nie jest wyposażona.");
    if (this.locked || this.busy) return this.game.say("Poczekaj na zakończenie bieżącej akcji.");
    if ((t.cooldowns[id] ?? 0) > 0) return this.game.say("Umiejętność jeszcze się odnawia.");
    const cost = skillCost(n, t, this.free);
    if (p.ki < cost) return this.game.say(`Za mało Ki (${Math.ceil(cost)}).`);
    const code = n.code;
    const targetRequired =
      (p.race === "sage" && ["A1", "A4", "A9"].includes(code)) ||
      (p.race === "android" && ["A1", "A4", "A9"].includes(code)) ||
      (p.race === "legend" && ["A1", "A4", "A9", "B1"].includes(code));
    const range =
      p.race === "sage" ? 420 : p.race === "android" ? stats(p).range : code === "A4" ? 260 : 110;
    const target = targetRequired ? this.pick(range) : undefined;
    if (targetRequired && !target)
      return this.game.say("Wybierz żywy cel w zasięgu i linii widzenia.");
    if (
      p.race === "android" &&
      ["A4", "A9"].includes(code) &&
      (!target || !this.marks.has(target.id))
    )
      return this.game.say("Najpierw oznacz cel Namierzaniem.");
    if (p.race === "android" && code === "C1" && t.resource <= 0)
      return this.game.say("Zgromadź Ładunek strzałami.");
    if (p.race === "legend" && code === "C4" && t.resource <= 0)
      return this.game.say("Zgromadź Żar trafieniami.");
    p.ki -= cost;
    t.cooldowns[id] = this.cooldown(n);
    this.emit({
      type: "attack",
      ...p,
      ability: target && range > 300 ? "pulse" : "flame",
      ...(target ? { target: target.id, to: { x: target.x, y: target.y } } : {}),
    });
    const damageBonus =
      (this.buff("free") ? (p.race === "sage" ? 1.3 : 1.4) : 1) *
      (this.buff("next-spell") ? 1.25 : 1);
    if (this.buff("next-spell") && n.kind !== "form") this.buffs.delete("next-spell");
    if (code === "T") {
      this.addBuff("form", 20000);
      if (p.race === "legend") t.resource = 100;
      if (p.race === "android") t.overheat = 0;
      this.game.say(n.name + " · 20 s");
      this.game.flush();
      return;
    }
    if (p.race === "planetary") this.planetary(code, damageBonus);
    else if (p.race === "sage") this.sage(code, target, damageBonus);
    else if (p.race === "android") this.android(code, target, damageBonus);
    else this.legend(code, target, damageBonus);
    if (p.race === "sage" && this.has("B2")) this.circle(5, 0.1, 0);
    this.game.flush();
  }
  private planetary(code: string, bonus: number) {
    if (code === "A1") {
      this.dash(160);
      this.addBuff("invulnerable", 400);
      if (this.has("A3")) this.addBuff("after-dodge", 5000);
      if (this.has("A7")) this.addBuff("dodge-crit", 5000);
      if (this.has("A8")) this.addBuff("dodge-defense", 1000);
    } else if (["A4", "A9", "B1", "B4", "B9"].includes(code)) {
      const power = ({ A4: 1.8, A9: 4, B1: 1.4, B4: 2, B9: 4 } as Record<string, number>)[code]!;
      const radius = code === "B1" ? 120 * (this.has("B8") ? 1.4 : 1) : code === "A4" ? 140 : 180;
      const targets = this.targets(radius);
      this.multi(targets, power, code === "A9" ? 5 : 1, 100, bonus);
      for (const e of targets)
        this.control(
          e,
          code === "B9" ? 1500 : code === "B4" ? 1000 : code === "B1" && this.has("B8") ? 500 : 0,
          code === "B1" ? 0.3 : 0,
          2000,
        );
      if (code === "B1") {
        if (this.has("B5"))
          this.schedule(500, () => targets.forEach((e) => this.strike(e, 1.4 * 0.6, 1, bonus)));
        if (this.has("B6") && targets.length) this.restoreKi(Math.min(15, targets.length * 5));
      }
      if (code === "B4" && this.has("B7")) this.giveShield(0.15, 5);
    } else if (code === "C1") {
      const fraction = 0.12 * (this.has("C6") ? 1.3 : 1);
      for (let i = 1; i <= 4; i++) this.schedule(i * 1000, () => this.heal(fraction / 4));
      if (this.has("C8")) this.schedule(4000, () => this.restoreKi(15));
    } else if (code === "C4") this.giveShield(0.18, 5, this.has("C7") ? 0.2 : 0);
    else if (code === "C9") {
      this.heal(0.4);
      this.giveShield(0.2, 6);
    }
  }
  private sage(code: string, target: Enemy | undefined, bonus: number) {
    if (code === "A1" && target) {
      this.marks.set(target.id, 3001);
      this.schedule(3000, () => {
        if (target.hp <= 0 || target.mode === "return") return;
        const center = { x: target.x, y: target.y };
        this.strike(target, 2, 1, bonus);
        if (this.has("A5"))
          this.targets(120, center)
            .filter((e) => e !== target)
            .forEach((e) => this.strike(e, 1, 1, bonus));
        if (this.has("A7")) {
          this.circle(3, 0, 0, 120, center);
          for (let i = 1; i <= 3; i++)
            this.schedule(i * 1000, () =>
              this.targets(120, center).forEach((e) => this.strike(e, 0.2, 1 / 3, bonus)),
            );
        }
        if (this.has("A8")) this.restoreKi(15);
      });
    } else if (code === "A4" && target) {
      const token = ++this.channelId;
      this.channel = { id: token, code, left: 3000 };
      for (let i = 1; i <= 6; i++)
        this.schedule(
          i * 500,
          () => {
            if (distance(this.p, target) <= 420 && this.game.nav.visible(this.p, target))
              this.strike(target, 2.4 / 6, 1 / 6, bonus);
          },
          token,
        );
    } else if (code === "A9" && target) {
      const center = { x: target.x, y: target.y };
      this.schedule(1500, () =>
        this.targets(200, center).forEach((e) => this.strike(e, 4.2, 1, bonus)),
      );
    } else if (code === "B1")
      this.giveShield(
        0.15 * (this.has("B7") ? 1.3 : 1),
        4 + (this.has("B3") ? 2 : 0),
        0,
        this.has("B5") ? 0.15 : 0,
        this.has("B8"),
      );
    else if (code === "B4") this.circle(5, 0, 0.4);
    else if (code === "B9") this.circle(8, 0.3, 0.3);
    else if (code === "C1" || code === "C4") {
      const token = ++this.channelId;
      this.channel = { id: token, code, left: 3000 };
      this.schedule(
        3000,
        () => {
          if (code === "C1") {
            this.restoreKi(stats(this.p).maxKi * 0.3);
            if (this.has("C6")) this.addBuff("next-spell", 6000);
          } else this.heal(0.2 * (this.has("C7") ? 1.5 : 1));
        },
        token,
      );
    } else if (code === "C9") this.addBuff("free", 8000);
  }
  private android(code: string, target: Enemy | undefined, bonus: number) {
    const t = this.tree!;
    if (code === "A1" && target) this.marks.set(target.id, 6000);
    else if (code === "A4" && target) this.multi([target], 2.2, 3, 150, bonus);
    else if (code === "A9" && target)
      this.strike(target, target.hp / target.maxHp < 0.3 ? 6 : 4, 1, bonus);
    else if (code === "B1")
      this.giveShield(
        0.18 * (this.has("B3") ? 1.25 : 1),
        5,
        this.has("B7") ? 0.3 : 0,
        this.has("B5") ? 0.25 : 0,
      );
    else if (code === "B4")
      for (const e of this.targets(150)) {
        this.strike(e, 1.2, 1, bonus);
        this.control(e, 500);
        const d = distance(e, this.p) || 1,
          next = this.game.nav.step(
            e,
            { x: e.x + ((e.x - this.p.x) / d) * 70, y: e.y + ((e.y - this.p.y) / d) * 70 },
            70,
          );
        Object.assign(e, next);
      }
    else if (code === "B9") this.addBuff("fortify", 6000);
    else if (code === "C1") {
      const power = 1 + t.resource / 50;
      t.resource = 0;
      for (const e of this.targets(360)) {
        const dx = e.x - this.p.x,
          dy = e.y - this.p.y,
          f = this.game.facing;
        if (dx * f.x + dy * f.y > 0 && Math.abs(dx * f.y - dy * f.x) < 70)
          this.strike(e, power, 1, bonus);
      }
    } else if (code === "C4") {
      t.resource = 0;
      this.heal(0.1);
    } else if (code === "C9") {
      t.shutdown = 8000;
      this.addBuff("free", 6000);
    }
  }
  private legend(code: string, target: Enemy | undefined, bonus: number) {
    if (code === "A1" && target) {
      this.multi([target], this.has("A7") ? 2.6 : 1.8, this.has("A7") ? 5 : 3, 100, bonus);
      if (this.has("A2")) this.dot(target, 0.3, 3);
    } else if (code === "A4" && target) {
      this.dash(200, target);
      if (distance(this.p, target) <= 110) this.strike(target, 2.2, 1, bonus);
    } else if (code === "A9" && target) this.multi([target], 4.2, 8, 85, bonus);
    else if (code === "B1" && target) {
      target.barrier = 0;
      this.strike(target, 1.5, 1, bonus);
      this.control(target, 1200);
    } else if (code === "B4") this.addBuff("rage", this.has("B7") ? 12000 : 8000);
    else if (code === "B9") {
      this.addBuff("life-guard", 5000);
      this.lifeGuardUsed = false;
    } else if (code === "C1" || code === "C4" || code === "C9") {
      const resource = this.tree!.resource;
      const radius =
        code === "C9"
          ? 220
          : code === "C4"
            ? 150 * (this.has("C7") ? 1.5 : this.has("C8") ? 0.8 : 1)
            : 150;
      const power =
        code === "C9"
          ? 4.5
          : code === "C4"
            ? (1 + resource / 50) * (this.has("C8") ? 1.25 : 1)
            : 1.8;
      const targets = this.targets(radius);
      for (const e of targets) this.strike(e, power, 1, bonus);
      if (code === "C4") this.tree!.resource = this.buff("form") ? 100 : 0;
      if (code === "C9" || (code === "C1" && this.has("C3")))
        targets.forEach((e) => this.dot(e, code === "C9" ? 0.5 : 0.4, code === "C9" ? 5 : 4));
    }
  }
  receive(enemy: Enemy, raw: number, projectile = false): number {
    this.enterCombat();
    if (this.buff("invulnerable")) return 0;
    this.cancelChannel();
    let damage = Math.max(1, raw - this.defense * 0.5);
    if (
      this.p.race === "sage" &&
      this.has("B6") &&
      this.circles.some((c) => distance(c, enemy) <= c.radius)
    )
      damage *= 0.9;
    if (this.shield.left > 0 && this.shield.hp > 0) {
      const reflected = this.shield.mirror
        ? damage
        : damage * (projectile ? this.shield.projectile : this.shield.melee);
      if (this.shield.mirror) {
        this.shield.mirror = false;
        damage = 0;
      }
      const absorbed = Math.min(this.shield.hp, damage);
      this.shield.hp -= absorbed;
      damage -= absorbed;
      if (reflected > 0) this.hurt(enemy, reflected); // no reflection/proc recursion
      this.persist();
    }
    if (this.buff("life-guard") && !this.lifeGuardUsed && damage >= this.p.hp) {
      this.lifeGuardUsed = true;
      this.buffs.delete("life-guard");
      this.persist();
      this.p.hp = 1;
      this.heal(0.3);
      return 0;
    }
    this.p.hp = Math.max(0, this.p.hp - damage);
    return Math.round(damage);
  }
  receiveControl(kind: "stun" | "slow", duration: number, strength = 0.3) {
    if (
      !this.tree ||
      this.buff("fortify") ||
      (kind === "stun" && this.p.race === "legend" && this.buff("rage") && this.has("B5"))
    )
      return;
    const resistant = (this.p.race === "planetary" || this.p.race === "sage") && this.has("C5");
    this.addBuff(
      kind,
      Math.min(20000, Math.max(0, duration)) * (resistant ? 0.75 : 1),
      kind === "slow" ? Math.min(0.8, Math.max(0, strength)) : 1,
    );
    if (kind === "stun") this.cancelChannel();
  }
  onKill() {
    if (!this.tree) return;
    if (this.p.race === "planetary" && this.has("A5")) this.addBuff("wind", 4000);
    if (this.p.race === "legend" && this.has("B6")) this.heal(0.03);
  }
  stunned(id: string) {
    return (this.stuns.get(id) ?? 0) > 0;
  }
  enemySpeed(id: string) {
    const enemy = this.game.enemies.find((e) => e.id === id);
    return (
      1 -
      Math.max(
        this.slows.get(id)?.value ?? 0,
        ...this.circles.filter((c) => enemy && distance(c, enemy) <= c.radius).map((c) => c.slow),
        0,
      )
    );
  }
  private get resourceMax() {
    return this.p.race === "android" ? (this.has("C8") ? 70 : this.has("C7") ? 150 : 100) : 100;
  }
  tick(dt: number) {
    const t = this.tree;
    if (!t) return;
    const overheat = t.overheat;
    t.shutdown = Math.max(0, t.shutdown - dt);
    t.overheat = Math.max(0, t.overheat - dt);
    if (overheat > 0 && t.overheat === 0) t.resource = 0;
    for (const key of Object.keys(t.cooldowns))
      t.cooldowns[key] = Math.max(0, t.cooldowns[key]! - dt);
    this.shotIn = Math.max(0, this.shotIn - dt);
    this.comboIn = Math.max(0, this.comboIn - dt);
    this.combatTime = Math.max(0, this.combatTime - dt);
    this.lastCombat += dt;
    this.silence = Math.max(0, this.silence - dt);
    // Run due jobs before expiring their final tick buffs/channel tokens.
    const due = this.jobs;
    this.jobs = [];
    for (const j of due) {
      j.left -= dt;
      if (j.left <= 0 && !this.p.dead) j.run();
      else if (j.left > 0) this.jobs.push(j);
    }
    for (const [key, b] of this.buffs) {
      b.left -= dt;
      if (b.left <= 0) this.buffs.delete(key);
    }
    for (const [id, left] of this.marks) {
      if (left <= dt) this.marks.delete(id);
      else this.marks.set(id, left - dt);
    }
    for (const [id, left] of this.stuns) {
      if (left <= dt) this.stuns.delete(id);
      else this.stuns.set(id, left - dt);
    }
    for (const [id, b] of this.slows) {
      b.left -= dt;
      if (b.left <= 0) this.slows.delete(id);
    }
    if (this.channel) {
      this.channel.left -= dt;
      if (this.channel.left <= 0) this.channel = null;
    }
    this.circles.forEach((c) => (c.left -= dt));
    this.circles = this.circles.filter((c) => c.left > 0);
    this.shield.left = Math.max(0, this.shield.left - dt);
    if (!this.shield.left) this.shield.hp = 0;
    if (this.p.race === "android" && !this.shotIn && !t.overheat)
      t.resource = Math.max(0, t.resource - dt * 0.006 * (this.has("C2") ? 1.5 : 1));
    if (this.p.race === "legend") {
      if (this.buff("form")) t.resource = 100;
      else if (!this.combatTime)
        t.resource = Math.max(0, t.resource - dt * 0.005 * (this.has("C2") ? 0.5 : 1));
    }
    const s = stats(this.p);
    if (this.p.race === "android" && this.has("B6"))
      this.p.hp = Math.min(s.maxHp, this.p.hp + (s.maxHp * 0.005 * dt) / 1000);
    if (this.p.race === "planetary" && this.has("C3") && !this.combatTime)
      this.p.hp = Math.min(s.maxHp, this.p.hp + (s.maxHp * 0.01 * dt) / 1000);
    this.persist();
  }
  clear() {
    this.buffs.clear();
    this.jobs = [];
    this.channel = null;
    this.circles = [];
    this.marks.clear();
    this.slows.clear();
    this.stuns.clear();
    this.shield = { left: 0, hp: 0, melee: 0, projectile: 0, mirror: false };
    this.combo = 0;
    this.silence = 0;
    if (this.tree) {
      this.tree.resource = 0;
      this.tree.overheat = 0;
      this.tree.shutdown = 0;
      this.tree.buffs = {};
      delete this.tree.barrier;
    }
  }
  private persist() {
    if (!this.tree) return;
    this.tree.buffs = Object.fromEntries(
      [...this.buffs].filter(([key]) => !key.startsWith("dot:")),
    );
    this.tree.barrier = { ...this.shield };
  }
  view() {
    if (!this.tree) return null;
    return {
      resource: this.tree.resource,
      maxResource: this.resourceMax,
      label: this.p.race === "android" ? "Ładunek Rdzenia" : this.p.race === "legend" ? "Żar" : "",
      shield: Math.round(this.shield.hp),
      form: this.buffs.get("form")?.left ?? 0,
      channel: this.channel ? NODES[skillId(this.p.race, this.channel.code)]!.name : null,
      blocked: this.combatTime > 0 || this.busy || this.hasEffects,
      terrain: this.terrain,
      locked: this.locked,
      free: this.free,
      circles: this.circles.map((c) => ({ ...c })),
      attack: Math.round(this.attack()),
      defense: Math.round(this.defense),
      speed: this.speed,
      kiRegen: this.kiRegen,
    };
  }
}
