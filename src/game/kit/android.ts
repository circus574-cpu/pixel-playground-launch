import { Kit, type ActiveDef, type Mods, type UseResult } from "./base";
import type { Foe, KitPort, ResourceInfo } from "./types";

/** Androidy: precise shooter with shields. Racial mechanic: Core Charge (Ładunek Rdzenia). */
export class AndroidKit extends Kit {
  readonly defs: Record<string, ActiveDef> = {
    A1: { id: "A1", ki: 8, cd: 8000, needsFoe: true },
    A4: { id: "A4", ki: 18, cd: 10000, needsFoe: true },
    A9: { id: "A9", ki: 35, cd: 30000, needsFoe: true },
    B1: { id: "B1", ki: 12, cd: 10000 },
    B4: { id: "B4", ki: 18, cd: 12000 },
    B9: { id: "B9", ki: 35, cd: 40000 },
    C1: { id: "C1", ki: 15, cd: 8000 },
    C4: { id: "C4", ki: 0, cd: 20000 },
    C9: { id: "C9", ki: 35, cd: 45000 },
    T: { id: "T", ki: 50, cd: 120000 },
  };
  protected readonly baseRange = 360;
  protected readonly ranged = true;
  charge = 0;
  overheatMs = 0;
  private lastShot = -1e9;
  constructor(port: KitPort, learned: Iterable<string>) {
    super(port, "android", learned);
    this.refresh();
  }
  protected override refresh() {
    this.defs["C1"] = { ...this.defs["C1"]!, ki: this.has("C6") ? 12 : 15 };
  }
  get maxCharge() {
    return this.has("C8") ? 70 : this.has("C7") ? 150 : 100;
  }
  protected override mods(): Mods {
    const m: Mods = {};
    if (this.has("A2")) m.critAdd = (m.critAdd ?? 0) + 0.06;
    if (this.has("A3")) m.rangePct = 0.15;
    let interval = 0;
    if (this.has("A6")) interval -= 0.08;
    if (this.has("A7")) interval += 0.1;
    if (interval) m.intervalPct = interval;
    if (this.has("B2")) m.defPct = 0.08;
    if (this.has("B6")) m.hpRegenAlways = 0.005;
    if (this.has("C5")) m.kiPct = 0.12;
    return m;
  }
  protected override cooldownOf(id: string) {
    const base = this.defs[id]?.cd ?? 0;
    return id === "B1" && this.has("B8") ? base * 0.65 : base;
  }
  protected override critVs(foe: Foe) {
    return this.has("A1") && this.port.isMarked(foe) ? 15 : 0;
  }
  protected override dealtVs(foe: Foe) {
    return this.has("A7") && this.port.isMarked(foe) ? 0.4 : 0;
  }
  private get overheatEnabled() {
    return !this.has("C8") && !this.buff("T");
  }
  protected override canAttack() {
    return this.overheatMs > 0 ? "Przegrzanie rdzenia." : "";
  }
  override resource(): ResourceInfo {
    return {
      label: "Ładunek Rdzenia",
      value: Math.round(this.charge),
      max: this.maxCharge,
      state: this.overheatMs > 0 ? "overheat" : this.charge >= this.maxCharge ? "full" : "",
    };
  }
  private addCharge(n: number) {
    this.charge = Math.min(this.maxCharge, this.charge + n * (this.has("C3") ? 0.85 : 1));
    this.lastShot = this.port.nowMs;
    if (this.charge >= this.maxCharge && this.overheatEnabled) {
      this.overheatMs = this.has("C2") ? 1000 : 2000;
      this.port.say("Przegrzanie rdzenia!");
    }
  }
  protected override onTick(dt: number) {
    if (this.overheatMs > 0) {
      this.overheatMs = Math.max(0, this.overheatMs - dt);
      if (this.overheatMs === 0) this.charge = Math.min(this.charge, this.maxCharge * 0.5);
    }
    if (this.port.nowMs - this.lastShot > 1000 && this.charge > 0) {
      const rate = 6 * (this.has("C2") ? 1.5 : 1) * this.development.cooling;
      this.charge = Math.max(0, this.charge - (rate * dt) / 1000);
    }
    if (this.charge > this.maxCharge) this.charge = this.maxCharge;
  }
  protected override basic(): UseResult {
    const s = { ...this.stats, range: this.basicRange };
    const p = this.port.player;
    const foe = this.pickFoe(s.range);
    if (!foe) return { ok: false, reason: "Wybierz cel." };
    if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
    if (!this.port.visible(p, foe)) return { ok: false, reason: "Przeszkoda zasłania cel." };
    const next = this.takeNextHit();
    this.port.emit({ type: "attack", x: p.x, y: p.y, ability: "R", to: { x: foe.x, y: foe.y } });
    this.strike(foe, 1, { tags: ["electric"], ranged: true, ability: "R" }, next.bonus, next.crit);
    if (this.has("A8")) {
      const others = this.port
        .foesIn(foe, 220)
        .filter((f) => f !== foe)
        .sort((a, b) => this.dist(a, foe) - this.dist(b, foe))
        .slice(0, 2);
      for (const o of others)
        this.strike(o, 0.4, { tags: ["electric"], ranged: true, ability: "R" });
    }
    this.addCharge(4);
    return { ok: true };
  }
  private markedFoe(): Foe | string {
    const s = this.stats;
    const foe = this.pickFoe(s.range);
    if (!foe) return "Wybierz cel.";
    if (this.dist(this.port.player, foe) > s.range) return "Cel poza zasięgiem.";
    if (!this.port.isMarked(foe)) return "Najpierw oznacz cel (Namierzanie).";
    return foe;
  }
  protected override cast(id: string): UseResult {
    const p = this.port.player;
    const s = this.stats;
    switch (id) {
      case "A1": {
        const foe = this.pickFoe(s.range);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
        this.port.markFoe(
          foe,
          6000 * (this.variant("mn-mark") ? 1.5 : 1),
          15,
          this.has("A5") ? 0.1 : 0,
        );
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "A1",
          to: { x: foe.x, y: foe.y },
        });
        return { ok: true };
      }
      case "A4": {
        const foe = this.markedFoe();
        if (typeof foe === "string") return { ok: false, reason: foe };
        for (let i = 0; i < 3; i++)
          this.schedule(i * 150, () => {
            if (
              foe.hp <= 0 ||
              this.dist(this.port.player, foe) > this.stats.range ||
              !this.port.visible(this.port.player, foe)
            )
              return;
            this.port.emit({
              type: "attack",
              x: this.port.player.x,
              y: this.port.player.y,
              ability: "A4",
              to: { x: foe.x, y: foe.y },
            });
            this.strike(foe, 2.2 / 3, { tags: ["electric"], ranged: true, ability: "A4" });
          });
        return { ok: true };
      }
      case "A9": {
        const foe = this.markedFoe();
        if (typeof foe === "string") return { ok: false, reason: foe };
        const mult = this.port.foeHpFraction(foe) < 0.3 ? 6 : 4;
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "A9",
          to: { x: foe.x, y: foe.y },
        });
        this.strike(foe, mult, { tags: ["electric"], ranged: true, ability: "A9" });
        return { ok: true };
      }
      case "B1": {
        const amount =
          s.maxHp *
          0.18 *
          (this.has("B3") ? 1.25 : 1) *
          this.development.shieldCapacity *
          (this.variant("mn-barrier") ? 1.15 : 1);
        this.addShield({
          id: "B1",
          ms: 5000 * this.development.shieldDuration * (this.variant("mn-barrier") ? 0.8 : 1),
          amount,
          max: amount,
          reflectProjectile: this.has("B5") ? 0.25 : undefined,
          reflectMelee: this.has("B7") ? 0.3 : undefined,
        });
        return { ok: true };
      }
      case "B4": {
        const foes = this.port.foesIn(p, 160);
        this.port.emit({ type: "burst", x: p.x, y: p.y, ability: "B4", radius: 160 });
        for (const f of foes) {
          this.strike(f, 1.2, { tags: ["electric", "area", "stun"], ranged: true, ability: "B4" });
          this.port.pushFoe(f, p, 120);
          this.port.stunFoe(f, 500);
        }
        return { ok: true };
      }
      case "B9": {
        this.addBuff({ id: "B9", ms: 6000, defPct: 0.6, ccImmune: true });
        this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "B9", text: "Fortyfikacja" });
        return { ok: true };
      }
      case "C1": {
        const used = Math.min(this.charge, this.maxCharge);
        const mult = 1 + used / 50;
        const f = this.port.facing;
        const foes = this.port.foesIn(p, 360).filter((foe) => {
          const dx = foe.x - p.x;
          const dy = foe.y - p.y;
          const along = dx * f.x + dy * f.y;
          const across = Math.abs(dx * f.y - dy * f.x);
          return (
            along > 0 && along <= 360 && across <= 50 * (this.variant("mn-discharge") ? 1.25 : 1)
          );
        });
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "C1",
          to: { x: p.x + f.x * 360, y: p.y + f.y * 360 },
        });
        for (const foe of foes)
          this.strike(foe, mult * (this.variant("mn-discharge") ? 0.9 : 1), {
            tags: ["electric", "area"],
            ranged: true,
            ability: "C1",
          });
        this.charge = 0;
        return { ok: true };
      }
      case "C4": {
        this.charge = 0;
        this.overheatMs = 0;
        this.port.heal(s.maxHp * 0.1);
        this.port.emit({ type: "heal", x: p.x, y: p.y, ability: "C4", text: "Rozładowanie" });
        return { ok: true };
      }
      case "C9": {
        this.addBuff({ id: "C9", ms: 6000, noKi: true, dealtPct: 0.4 });
        this.schedule(6000, () => {
          this.lockMs = 2000;
          this.port.say("Przeciążenie: układy wyłączone na 2 s.");
        });
        this.port.emit({
          type: "buff",
          x: p.x,
          y: p.y,
          ability: "C9",
          text: "Przeciążenie Systemu",
        });
        return { ok: true };
      }
      case "T": {
        this.addBuff({ id: "T", ms: 20000, atkPct: 0.25, defPct: 0.15 });
        this.overheatMs = 0;
        this.port.emit({
          type: "buff",
          x: p.x,
          y: p.y,
          ability: "T",
          text: "Forma Pełnego Rdzenia",
        });
        return { ok: true };
      }
    }
    return { ok: false, reason: "Nieznana zdolność." };
  }
}
