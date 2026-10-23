import { Kit, type ActiveDef, type Mods, type UseResult } from "./base";
import type { Foe, Hit, KitPort, ResourceInfo } from "./types";

/** Legendy: melee burst warrior. Racial mechanic: Ember (Żar). */
export class LegendKit extends Kit {
  readonly defs: Record<string, ActiveDef> = {
    A1: { id: "A1", ki: 10, cd: 6000, needsFoe: true },
    A4: { id: "A4", ki: 18, cd: 10000, needsFoe: true },
    A9: { id: "A9", ki: 35, cd: 30000, needsFoe: true },
    B1: { id: "B1", ki: 12, cd: 8000, needsFoe: true },
    B4: { id: "B4", ki: 18, cd: 25000 },
    B9: { id: "B9", ki: 35, cd: 90000 },
    C1: { id: "C1", ki: 15, cd: 8000 },
    C4: { id: "C4", ki: 20, cd: 12000 },
    C9: { id: "C9", ki: 35, cd: 30000 },
    T: { id: "T", ki: 50, cd: 120000 },
  };
  protected readonly baseRange = 78;
  protected readonly ranged = false;
  ember = 0;
  private streak = 0;
  private lastHitAt = -1e9;
  private wasInCombat = false;
  constructor(port: KitPort, learned: Iterable<string>) {
    super(port, "legend", learned);
  }
  protected override mods(): Mods {
    const m: Mods = {};
    if (this.has("A5")) m.atkPct = 0.08;
    if (this.has("A6")) m.critAdd = 0.06;
    if (this.has("B2")) m.defPct = 0.08;
    if (this.has("B3")) m.hpPct = 0.1;
    if (this.has("C6") && this.ember >= 100) m.kiRegenPct = 0.5;
    return m;
  }
  protected override dealtVs(_foe: Foe) {
    let bonus = Math.min(0.1, this.ember * 0.001);
    if (this.has("A8") && this.port.foesIn(this.port.player, 200).length === 1) bonus += 0.25;
    return bonus;
  }
  override resource(): ResourceInfo {
    return {
      label: "Żar",
      value: Math.round(this.ember),
      max: 100,
      state: this.ember >= 100 ? "full" : "",
    };
  }
  private gainEmber(n: number) {
    this.ember = Math.min(100, this.ember + n * (this.has("C2") ? 1.5 : 1));
  }
  protected override strike(foe: Foe, mult: number, hit: Hit, extra = 0, forceCrit = false) {
    const dealt = super.strike(foe, mult, hit, extra, forceCrit);
    if (!hit.indirect) {
      this.gainEmber(4);
      const now = this.port.nowMs;
      this.streak = now - this.lastHitAt > 2500 ? 1 : this.streak + 1;
      this.lastHitAt = now;
      if (this.has("A3") && this.streak >= 3) {
        this.streak = 0;
        this.addBuff({ id: "A3", ms: 4000, intervalPct: -0.1 });
      }
    }
    return dealt;
  }
  protected override onTick(dt: number) {
    const inCombat = this.port.inCombat;
    if (this.buff("T")) this.ember = 100;
    else if (inCombat && !this.wasInCombat && this.has("C5")) this.ember = Math.max(this.ember, 20);
    else if (!inCombat)
      this.ember = Math.max(0, this.ember - ((this.has("C2") ? 2.5 : 5) * dt) / 1000);
    this.wasInCombat = inCombat;
  }
  protected override lethalSave() {
    const b = this.buff("B9");
    if (!b?.lethal) return false;
    this.removeBuff("B9");
    this.port.heal(this.stats.maxHp * 0.3);
    this.port.say("Ostatni Płomień ocalił Cię przed śmiercią.");
    return true;
  }
  override onKill(_foe: Foe) {
    if (this.has("B6")) this.port.heal(this.stats.maxHp * 0.03);
  }
  private ignite(foe: Foe, totalAtk: number, ms: number) {
    this.port.burnFoe(foe, (this.stats.attack * totalAtk) / (ms / 1000), ms);
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
    this.strike(
      foe,
      1,
      { tags: ["physical", "fire"], melee: true, ability: "R" },
      next.bonus,
      next.crit,
    );
    return { ok: true };
  }
  private cuts(
    id: string,
    foe: Foe,
    count: number,
    total: number,
    gap: number,
    burn?: [number, number],
  ) {
    const each = total / count;
    for (let i = 0; i < count; i++)
      this.schedule(i * gap, () => {
        if (foe.hp <= 0) return;
        const p = this.port.player;
        this.port.emit({ type: "attack", x: p.x, y: p.y, ability: id, to: { x: foe.x, y: foe.y } });
        this.strike(foe, each, { tags: ["physical", "fire"], melee: true, ability: id });
        if (burn && i === count - 1) this.ignite(foe, burn[0], burn[1]);
      });
  }
  protected override cast(id: string): UseResult {
    const p = this.port.player;
    const s = this.stats;
    const reach = s.range + 14;
    const near = (): Foe | string => {
      const foe = this.pickFoe(reach);
      if (!foe) return "Wybierz cel.";
      if (this.dist(p, foe) > reach) return "Cel poza zasięgiem.";
      return foe;
    };
    switch (id) {
      case "A1": {
        const foe = near();
        if (typeof foe === "string") return { ok: false, reason: foe };
        const five = this.has("A7");
        this.cuts(
          "A1",
          foe,
          five ? 5 : 3,
          five ? 2.6 : 1.8,
          150,
          this.has("A2") ? [0.3, 3000] : undefined,
        );
        return { ok: true };
      }
      case "A4": {
        const foe = this.pickFoe(300);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        const gap = Math.max(0, this.dist(p, foe) - 50);
        if (gap > 220) return { ok: false, reason: "Cel zbyt daleko (200)." };
        this.port.dash(foe, Math.min(200, gap));
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "A4",
          to: { x: foe.x, y: foe.y },
        });
        this.strike(foe, 2.2, { tags: ["physical", "fire"], melee: true, ability: "A4" });
        return { ok: true };
      }
      case "A9": {
        const foe = near();
        if (typeof foe === "string") return { ok: false, reason: foe };
        this.cuts("A9", foe, 8, 4.2, 120);
        return { ok: true };
      }
      case "B1": {
        const foe = near();
        if (typeof foe === "string") return { ok: false, reason: foe };
        this.port.emit({
          type: "attack",
          x: p.x,
          y: p.y,
          ability: "B1",
          to: { x: foe.x, y: foe.y },
        });
        this.strike(foe, 1.5, { tags: ["physical", "stun"], melee: true, ability: "B1" });
        this.port.stunFoe(foe, 1200);
        this.port.breakFoeShield(foe);
        return { ok: true };
      }
      case "B4": {
        this.addBuff({
          id: "B4",
          ms: 8000 + (this.has("B7") ? 4000 : 0),
          atkPct: 0.3 + (this.has("B7") ? 0.1 : 0),
          defPct: this.has("B8") ? 0 : -0.2,
          stunImmune: this.has("B5") ? true : undefined,
        });
        this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "B4", text: "Płomienny Szał" });
        return { ok: true };
      }
      case "B9": {
        this.addBuff({ id: "B9", ms: 5000, lethal: true });
        this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "B9", text: "Ostatni Płomień" });
        return { ok: true };
      }
      case "C1": {
        const foes = this.port.foesIn(p, 150);
        this.port.emit({ type: "burst", x: p.x, y: p.y, ability: "C1", radius: 150 });
        for (const f of foes) {
          this.strike(f, 1.8, { tags: ["fire", "area"], melee: true, ability: "C1" });
          if (this.has("C3")) this.ignite(f, 0.4, 4000);
        }
        return { ok: true };
      }
      case "C4": {
        const mult = (1 + Math.min(100, this.ember) / 50) * (this.has("C8") ? 1.25 : 1);
        const radius = 160 * (this.has("C7") ? 1.5 : this.has("C8") ? 0.8 : 1);
        const foes = this.port.foesIn(p, radius);
        this.port.emit({ type: "burst", x: p.x, y: p.y, ability: "C4", radius });
        for (const f of foes)
          this.strike(f, mult, { tags: ["fire", "area"], melee: true, ability: "C4" });
        this.ember = 0;
        return { ok: true };
      }
      case "C9": {
        const foe = this.port.target();
        const f = this.port.facing;
        const at = foe ? { x: foe.x, y: foe.y } : { x: p.x + f.x * 150, y: p.y + f.y * 150 };
        const foes = this.port.foesIn(at, 240);
        this.port.emit({ type: "burst", x: at.x, y: at.y, ability: "C9", radius: 240 });
        for (const x of foes) {
          this.strike(x, 4.5, { tags: ["fire", "area"], melee: true, ability: "C9" });
          this.ignite(x, 0.5, 5000);
        }
        return { ok: true };
      }
      case "T": {
        this.addBuff({ id: "T", ms: 20000, atkPct: 0.3 });
        this.ember = 100;
        this.port.emit({
          type: "buff",
          x: p.x,
          y: p.y,
          ability: "T",
          text: "Forma Płomiennego Legendy",
        });
        return { ok: true };
      }
    }
    return { ok: false, reason: "Nieznana zdolność." };
  }
}
