import { Kit, type ActiveDef, type Mods, type UseResult } from "./base";
import type { Foe, KitPort } from "./types";

/** Planetarni: mobile melee fighter. Racial mechanic: adaptation to terrain (B2). */
export class PlanetaryKit extends Kit {
  readonly defs: Record<string, ActiveDef> = {
    A1: { id: "A1", ki: 8, cd: 6000 },
    A4: { id: "A4", ki: 18, cd: 10000 },
    A9: { id: "A9", ki: 35, cd: 30000, needsFoe: true },
    B1: { id: "B1", ki: 10, cd: 6000 },
    B4: { id: "B4", ki: 18, cd: 10000, needsFoe: true },
    B9: { id: "B9", ki: 35, cd: 30000 },
    C1: { id: "C1", ki: 12, cd: 12000 },
    C4: { id: "C4", ki: 18, cd: 12000 },
    C9: { id: "C9", ki: 35, cd: 45000 },
    T: { id: "T", ki: 50, cd: 120000 },
  };
  protected readonly baseRange = 78;
  protected readonly ranged = false;
  /** Third hit of a series deals ×1.3. */
  private series = 0;
  private lastHealed = 0;
  constructor(port: KitPort, learned: Iterable<string>) {
    super(port, "planetary", learned);
  }
  protected override mods(): Mods {
    const m: Mods = {};
    const terrain = this.has("B2") ? this.port.terrain() : "open";
    if (this.has("A2")) m.speedPct = (m.speedPct ?? 0) + 0.06;
    if (this.has("A6")) m.critAdd = 0.05;
    if (this.has("B3")) m.defPct = (m.defPct ?? 0) + 0.08;
    if (this.has("C2")) m.hpPct = 0.1;
    if (this.has("C3")) m.hpRegenOoc = 0.01;
    if (this.has("C5")) m.ccPct = -0.25;
    if (terrain === "forest") m.kiRegenPct = 0.3;
    if (terrain === "rock") m.defPct = (m.defPct ?? 0) + 0.1;
    if (terrain === "water") m.speedPct = (m.speedPct ?? 0) + 0.08;
    return m;
  }
  protected override cooldownOf(id: string) {
    const base = this.defs[id]?.cd ?? 0;
    return id === "A1" && this.has("A8") ? base * 0.7 : base;
  }
  protected override basic(): UseResult {
    const s = this.stats;
    const foe = this.pickFoe(s.range);
    const p = this.port.player;
    if (!foe) return { ok: false, reason: "Wybierz cel." };
    if (this.dist(p, foe) > s.range) return { ok: false, reason: "Cel poza zasięgiem." };
    if (!this.port.visible(p, foe)) return { ok: false, reason: "Przeszkoda zasłania cel." };
    this.series = this.port.nowMs - this.lastBasic > 1800 ? 1 : this.series + 1;
    const third = this.series % 3 === 0;
    const next = this.takeNextHit();
    this.port.emit({ type: "attack", x: p.x, y: p.y, ability: "R", to: { x: foe.x, y: foe.y } });
    this.strike(
      foe,
      third ? 1.3 : 1,
      { tags: ["physical"], melee: true, ability: "R" },
      next.bonus,
      next.crit,
    );
    return { ok: true };
  }
  override onKill(_foe: Foe) {
    if (this.has("A5")) this.addBuff({ id: "A5", ms: 4000, speedPct: 0.15 });
  }
  private aoe(
    id: string,
    center: { x: number; y: number },
    radius: number,
    mult: number,
    extra: (f: Foe) => void,
  ) {
    const next = this.takeNextHit();
    const foes = this.port.foesIn(center, radius);
    this.port.emit({ type: "burst", x: center.x, y: center.y, ability: id, radius });
    for (const f of foes) {
      this.strike(
        f,
        mult,
        { tags: ["physical", "area"], melee: true, ability: id },
        next.bonus,
        next.crit,
      );
      extra(f);
    }
    return foes;
  }
  protected override cast(id: string): UseResult {
    const p = this.port.player;
    const f = this.port.facing;
    switch (id) {
      case "A1": {
        this.port.dash({ x: p.x + f.x * 160, y: p.y + f.y * 160 }, 160);
        this.addBuff({ id: "dodge", ms: 400, invulnerable: true });
        if (this.has("A3")) this.addBuff({ id: "A3", ms: 5000, nextHitPct: 0.25 });
        if (this.has("A7")) this.addBuff({ id: "A7", ms: 5000, guaranteedCrit: true });
        if (this.has("A8")) this.addBuff({ id: "A8", ms: 1000, defPct: 0.2 });
        this.port.emit({ type: "buff", x: p.x, y: p.y, ability: "A1", text: "Unik" });
        return { ok: true };
      }
      case "A4": {
        this.aoe("A4", p, 140, 1.8, () => {});
        return { ok: true };
      }
      case "A9": {
        const near = this.port.foesIn(p, 160);
        if (!near.length) return { ok: false, reason: "Brak wrogów w pobliżu." };
        this.port.emit({ type: "burst", x: p.x, y: p.y, ability: "A9", radius: 160 });
        for (let i = 0; i < 5; i++)
          this.schedule(i * 150, () => {
            const alive = this.port.foesIn(this.port.player, 160);
            const foe = alive[i % Math.max(1, alive.length)];
            if (foe) this.strike(foe, 0.8, { tags: ["physical"], melee: true, ability: "A9" });
          });
        return { ok: true };
      }
      case "B1": {
        const radius = 120 * (this.has("B8") ? 1.4 : 1);
        let got = 0;
        const hitAll = (mult: number, first: boolean) => {
          const foes = this.port.foesIn(this.port.player, radius);
          this.port.emit({
            type: "burst",
            x: this.port.player.x,
            y: this.port.player.y,
            ability: "B1",
            radius,
          });
          for (const foe of foes) {
            this.strike(foe, mult, { tags: ["physical", "area"], melee: true, ability: "B1" });
            if (first) {
              this.port.slowFoe(foe, 0.3, 2000);
              if (this.has("B8")) this.port.stunFoe(foe, 500);
            }
          }
          return foes.length;
        };
        got = hitAll(1.4, true);
        if (this.has("B6")) this.port.addKi(Math.min(15, got * 5));
        if (this.has("B5")) this.schedule(500, () => hitAll(1.4 * 0.6, false));
        return { ok: true };
      }
      case "B4": {
        const foe = this.pickFoe(300);
        if (!foe) return { ok: false, reason: "Wybierz cel." };
        const gap = Math.max(0, this.dist(p, foe) - 40);
        if (gap > 220) return { ok: false, reason: "Cel zbyt daleko (220)." };
        this.port.dash(foe, gap);
        const q = this.port.player;
        const foes = this.port.foesIn(q, 100);
        this.port.emit({ type: "burst", x: q.x, y: q.y, ability: "B4", radius: 100 });
        for (const x of foes) {
          this.strike(x, 2, { tags: ["physical", "area", "stun"], melee: true, ability: "B4" });
          this.port.stunFoe(x, 1000);
        }
        if (this.has("B7"))
          this.addShield({
            id: "B7",
            ms: 5000,
            amount: this.stats.maxHp * 0.15,
            max: this.stats.maxHp * 0.15,
          });
        return { ok: true };
      }
      case "B9": {
        const foes = this.aoe("B9", p, 220, 4, (x) => this.port.stunFoe(x, 1500));
        return foes.length ? { ok: true } : { ok: true };
      }
      case "C1": {
        const total = this.stats.maxHp * 0.12 * (this.has("C6") ? 1.3 : 1);
        this.hot(total, 4000);
        if (this.has("C8")) this.port.addKi(15);
        this.port.emit({ type: "heal", x: p.x, y: p.y, ability: "C1", text: "Oddech" });
        return { ok: true };
      }
      case "C4": {
        const amount = this.stats.maxHp * 0.18;
        this.addShield({
          id: "C4",
          ms: 5000,
          amount,
          max: amount,
          reflectMelee: this.has("C7") ? 0.2 : undefined,
        });
        return { ok: true };
      }
      case "C9": {
        this.port.heal(this.stats.maxHp * 0.4);
        const amount = this.stats.maxHp * 0.2;
        this.addShield({ id: "C9", ms: 6000, amount, max: amount });
        return { ok: true };
      }
      case "T": {
        this.addBuff({ id: "T", ms: 20000, atkPct: 0.2, defPct: 0.15, speedPct: 0.1 });
        this.port.emit({
          type: "buff",
          x: p.x,
          y: p.y,
          ability: "T",
          text: "Forma Rezonansu Świata",
        });
        return { ok: true };
      }
    }
    return { ok: false, reason: "Nieznana zdolność." };
  }
  /** Heal over time spread across `ms` in 4 equal steps. */
  private hot(total: number, ms: number) {
    const step = total / 4;
    for (let i = 1; i <= 4; i++) this.schedule((ms / 4) * i, () => this.port.heal(step));
    this.lastHealed = total;
  }
  get lastHeal() {
    return this.lastHealed;
  }
}
