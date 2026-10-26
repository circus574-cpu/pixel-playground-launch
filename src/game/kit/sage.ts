import { Kit, type ActiveDef, type Mods, type UseResult } from "./base";
import type { Foe, KitPort } from "./types";

/** Mędrcy: ranged mage and support. Racial mechanic: circles of light. */
export class SageKit extends Kit {
  readonly defs: Record<string, ActiveDef> = {
    A1: { id: "A1", ki: 12, cd: 8000, needsFoe: true },
    A4: { id: "A4", ki: 20, cd: 12000, needsFoe: true, channel: true },
    A9: { id: "A9", ki: 35, cd: 30000, needsFoe: true },
    B1: { id: "B1", ki: 12, cd: 10000 },
    B4: { id: "B4", ki: 18, cd: 12000 },
    B9: { id: "B9", ki: 35, cd: 40000 },
    C1: { id: "C1", ki: 0, cd: 15000, channel: true },
    C4: { id: "C4", ki: 10, cd: 15000, channel: true },
    C9: { id: "C9", ki: 20, cd: 60000 },
    T: { id: "T", ki: 50, cd: 120000 },
  };
  protected readonly baseRange = 420;
  protected readonly ranged = true;
  constructor(port: KitPort, learned: Iterable<string>) {
    super(port, "sage", learned);
  }
  protected override mods(): Mods {
    const m: Mods = {};
    if (this.has("A6")) m.critAdd = 0.08;
    if (this.has("C2")) m.kiPct = 0.15;
    if (this.has("C3")) m.kiCostPct = -0.08;
    if (this.has("C5")) m.ccPct = -0.25;
    return m;
  }
  protected override cooldownOf(id: string) {
    const base = this.defs[id]?.cd ?? 0;
    return id === "A1" && this.has("A3") ? base * 0.8 : base;
  }
  /** Bonus for the next damaging ability after Skupienie KI (C6). */
  private abilityBonus() {
    const b = this.buff("C6");
    if (!b) return 0;
    this.removeBuff("C6");
    return 0.25;
  }
  protected override basic(): UseResult {
    const s = this.stats;
    const p = this.port.player;
    const foe = this.pickFoe(s.range);
    if (!foe) return { ok: false, reason: "Wybierz cel." };
    if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
    if (!this.port.visible(p, foe)) return { ok: false, reason: "Przeszkoda zasłania cel." };
    const next = this.takeNextHit();
    this.port.emit({ type: "attack", x: p.x, y: p.y, ability: "R", to: { x: foe.x, y: foe.y } });
    this.strike(foe, 1, { tags: ["ki"], ranged: true, ability: "R" }, next.bonus, next.crit);
    return { ok: true };
  }
  private leaveCircle(radius: number, x = this.port.player.x, y = this.port.player.y) {
    if (!this.has("B2")) return;
    this.addCircle({
      id: "B2",
      x,
      y,
      radius,
      ms: 5000,
      kind: "light",
      defPct: 0.1,
      weaken: this.has("B6") ? 0.1 : undefined,
    });
  }
  private explodeSeal(foe: Foe, id: string, bonus: number) {
    if (foe.hp <= 0) return;
    this.port.emit({ type: "burst", x: foe.x, y: foe.y, ability: id, radius: 120 });
    this.strike(foe, 2, { tags: ["ki", "area"], ranged: true, ability: id }, bonus);
    if (this.has("A5"))
      for (const other of this.port.foesIn(foe, 150))
        if (other !== foe)
          this.strike(other, 1, { tags: ["ki", "area"], ranged: true, ability: id });
    if (this.has("A7"))
      this.addCircle({
        id: "A7",
        x: foe.x,
        y: foe.y,
        radius: 120,
        ms: 3000,
        kind: "light",
        dps: 0.4,
      });
    if (this.has("A8")) this.port.addKi(15);
  }
  override use(id: string): UseResult {
    const result = super.use(id);
    if (result.ok && id !== "R") this.leaveCircle(100);
    return result;
  }
  protected override cast(id: string): UseResult {
    const p = this.port.player;
    const s = this.stats;
    switch (id) {
      case "A1": {
        const foe = this.pickFoe(s.range);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
        this.port.sealFoe(foe, 3000, this.has("A2") ? 0.1 : 0);
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "A1",
          to: { x: foe.x, y: foe.y },
        });
        const bonus = this.abilityBonus();
        this.schedule(3000, () => this.explodeSeal(foe, "A1", bonus));
        return { ok: true };
      }
      case "A4": {
        const foe = this.pickFoe(s.range);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
        const bonus = this.abilityBonus();
        this.startChannel({
          id: "A4",
          ms: 3000,
          every: 500,
          breakOnMove: false,
          breakOnHit: false,
          onTick: () => {
            if (foe.hp <= 0) return this.interruptChannel("other");
            this.port.emit({
              type: "attack",
              x: p.x,
              y: p.y,
              ability: "A4",
              to: { x: foe.x, y: foe.y },
            });
            this.strike(foe, 0.4, { tags: ["ki"], ranged: true, ability: "A4" }, bonus);
          },
          onEnd: () => {},
        });
        return { ok: true };
      }
      case "A9": {
        const foe = this.pickFoe(s.range);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
        const at = { x: foe.x, y: foe.y };
        const bonus = this.abilityBonus();
        this.port.emit({ type: "burst", x: at.x, y: at.y, ability: "A9", radius: 200, ms: 1500 });
        this.schedule(1500, () => {
          for (const f of this.port.foesIn(at, 200))
            this.strike(f, 4.2, { tags: ["ki", "area"], ranged: true, ability: "A9" }, bonus);
        });
        return { ok: true };
      }
      case "B1": {
        const amount = s.maxHp * 0.15 * (this.has("B7") ? 1.3 : 1);
        this.addShield({
          id: "B1",
          ms: 4000 + (this.has("B3") ? 2000 : 0),
          amount,
          max: amount,
          reflectProjectile: this.has("B5") ? 0.15 : undefined,
          mirror: this.has("B8") ? true : undefined,
        });
        return { ok: true };
      }
      case "B4": {
        const foe = this.port.target();
        const at =
          foe && this.dist(p, foe) <= s.range ? { x: foe.x, y: foe.y } : { x: p.x, y: p.y };
        this.addCircle({
          id: "B4",
          x: at.x,
          y: at.y,
          radius: 140,
          ms: 5000,
          kind: "slow",
          slow: 0.4,
          weaken: this.has("B6") ? 0.1 : undefined,
        });
        return { ok: true };
      }
      case "B9": {
        this.addCircle({
          id: "B9",
          x: p.x,
          y: p.y,
          radius: 220,
          ms: 8000,
          kind: "temple",
          slow: 0.3,
          defPct: 0.3,
          weaken: this.has("B6") ? 0.1 : undefined,
        });
        return { ok: true };
      }
      case "C1": {
        this.startChannel({
          id: "C1",
          ms: 3000,
          every: 500,
          breakOnMove: !this.has("C8"),
          breakOnHit: true,
          onTick: () => this.port.addKi(this.stats.maxKi * 0.05),
          onEnd: (done) => {
            if (done && this.has("C6")) this.addBuff({ id: "C6", ms: 6000 });
          },
        });
        return { ok: true };
      }
      case "C4": {
        const share = (this.has("C7") ? 1.5 : 1) * 0.2;
        this.startChannel({
          id: "C4",
          ms: 3000,
          every: 500,
          breakOnMove: true,
          breakOnHit: true,
          onTick: () => this.port.heal((this.stats.maxHp * share) / 6),
          onEnd: () => {},
        });
        return { ok: true };
      }
      case "C9": {
        this.addBuff({ id: "C9", ms: 8000, noKi: true, dealtPct: 0.3 });
        return { ok: true };
      }
      case "T": {
        this.addBuff({ id: "T", ms: 20000, atkPct: 0.25, cooldownPct: -0.3, defPct: 0.15 });
        this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "T", text: "Forma Oświecenia" });
        return { ok: true };
      }
    }
    return { ok: false, reason: "Nieznana zdolność." };
  }
}
