import type { FxSpec } from "./types";

type Dot = { id: "poison" | "burn" | "bleed"; dps: number; ms: number };

/** Status effects that monsters put on the player. Runtime only; never saved. */
export class PlayerFx {
  slow = { pct: 0, ms: 0 };
  rootMs = 0;
  stunMs = 0;
  fearMs = 0;
  fearFrom: { x: number; y: number } | undefined;
  silenceMs = 0;
  blind = { pct: 0, ms: 0 };
  fog = { pct: 0, ms: 0 };
  jamMs = 0;
  mark = { pct: 0, ms: 0, machine: false };
  armor = { pct: 0, ms: 0, stacks: 0 };
  weaken = { pct: 0, ms: 0 };
  private dots: (Dot & { stack: number })[] = [];
  private missAcc = 0;

  get speedMul() {
    return this.slow.ms > 0 ? 1 - this.slow.pct : 1;
  }
  get cannotMove() {
    return this.rootMs > 0 || this.stunMs > 0;
  }
  get cannotAct() {
    return this.stunMs > 0 || this.fearMs > 0;
  }
  get silenced() {
    return this.silenceMs > 0;
  }
  get fogPct() {
    return this.fog.ms > 0 ? this.fog.pct : 0;
  }
  get jammed() {
    return this.jamMs > 0;
  }
  markPct(machine: boolean) {
    if (this.mark.ms <= 0) return 0;
    return this.mark.machine && !machine ? 0 : this.mark.pct;
  }
  get armorPct() {
    return this.armor.ms > 0 ? this.armor.pct * this.armor.stacks : 0;
  }
  get weakenPct() {
    return this.weaken.ms > 0 ? this.weaken.pct : 0;
  }
  get active(): { id: string; ms: number; stacks?: number }[] {
    const list: { id: string; ms: number; stacks?: number }[] = [];
    if (this.slow.ms > 0) list.push({ id: "slow", ms: this.slow.ms });
    if (this.rootMs > 0) list.push({ id: "root", ms: this.rootMs });
    if (this.stunMs > 0) list.push({ id: "stun", ms: this.stunMs });
    if (this.fearMs > 0) list.push({ id: "fear", ms: this.fearMs });
    if (this.silenceMs > 0) list.push({ id: "silence", ms: this.silenceMs });
    if (this.blind.ms > 0) list.push({ id: "blind", ms: this.blind.ms });
    if (this.fog.ms > 0) list.push({ id: "fog", ms: this.fog.ms });
    if (this.jamMs > 0) list.push({ id: "jam", ms: this.jamMs });
    if (this.mark.ms > 0) list.push({ id: "mark", ms: this.mark.ms });
    if (this.armor.ms > 0) list.push({ id: "armor", ms: this.armor.ms, stacks: this.armor.stacks });
    if (this.weaken.ms > 0) list.push({ id: "weaken", ms: this.weaken.ms });
    for (const d of this.dots) list.push({ id: d.id, ms: d.ms, stacks: d.stack });
    return list;
  }
  clear() {
    this.slow = { pct: 0, ms: 0 };
    this.rootMs = this.stunMs = this.fearMs = this.silenceMs = this.jamMs = 0;
    this.blind = { pct: 0, ms: 0 };
    this.fog = { pct: 0, ms: 0 };
    this.mark = { pct: 0, ms: 0, machine: false };
    this.armor = { pct: 0, ms: 0, stacks: 0 };
    this.weaken = { pct: 0, ms: 0 };
    this.dots = [];
    this.missAcc = 0;
    this.fearFrom = undefined;
  }
  /**
   * Applies one effect. `cc` scales control durations (Korzenie Odporności, Czysty Umysł); 0 means immune.
   * `stunImmune` ignores stuns only. `atk` is the attacker's ATK for damage over time.
   */
  apply(
    fx: FxSpec,
    opts: {
      cc: number;
      stunImmune: boolean;
      atk: number;
      machine: boolean;
      from?: { x: number; y: number };
    },
  ) {
    const t = (ms: number) => Math.round(ms * opts.cc);
    switch (fx.k) {
      case "slow":
        if (opts.cc > 0)
          this.slow = {
            pct: Math.max(this.slow.ms > 0 ? this.slow.pct : 0, fx.pct),
            ms: Math.max(this.slow.ms, t(fx.ms)),
          };
        break;
      case "root":
        this.rootMs = Math.max(this.rootMs, t(fx.ms));
        break;
      case "stun":
        if (!opts.stunImmune) this.stunMs = Math.max(this.stunMs, t(fx.ms));
        break;
      case "fear":
        if (opts.cc > 0) {
          this.fearMs = Math.max(this.fearMs, t(fx.ms));
          if (opts.from) this.fearFrom = { ...opts.from };
        }
        break;
      case "silence":
        this.silenceMs = Math.max(this.silenceMs, t(fx.ms));
        break;
      case "dot": {
        const dps = fx.atkPct * opts.atk;
        const same = this.dots.filter((d) => d.id === fx.id);
        const max = fx.stacks ?? 1;
        if (same.length >= max) {
          const weakest = same.reduce((a, b) => (a.ms < b.ms ? a : b));
          weakest.ms = fx.ms;
          weakest.dps = Math.max(weakest.dps, dps);
        } else this.dots.push({ id: fx.id, dps, ms: fx.ms, stack: same.length + 1 });
        break;
      }
      case "blind":
        this.blind = { pct: fx.pct, ms: Math.max(this.blind.ms, t(fx.ms)) };
        break;
      case "fog":
        this.fog = { pct: fx.pct, ms: Math.max(this.fog.ms, fx.ms) };
        break;
      case "jam":
        this.jamMs = Math.max(this.jamMs, fx.ms);
        break;
      case "weaken":
        this.weaken = { pct: fx.pct, ms: Math.max(this.weaken.ms, fx.ms) };
        break;
      case "armorDown": {
        const stacks = Math.min(fx.stacks ?? 1, this.armor.ms > 0 ? this.armor.stacks + 1 : 1);
        this.armor = { pct: fx.pct, ms: fx.ms, stacks };
        break;
      }
      case "mark":
        this.mark = { pct: fx.pct, ms: fx.ms, machine: fx.from === "machine" };
        break;
      case "breakShield":
      case "pull":
        break;
    }
    void opts.machine;
  }
  /** Returns damage over time dealt during `dt`. */
  tick(dt: number): number {
    let dot = 0;
    for (const d of this.dots) {
      dot += (d.dps * Math.min(dt, d.ms)) / 1000;
      d.ms -= dt;
    }
    this.dots = this.dots.filter((d) => d.ms > 0);
    this.dots.forEach((d) => {
      d.stack = this.dots.filter((x) => x.id === d.id).indexOf(d) + 1;
    });
    for (const key of ["slow", "blind", "fog", "mark", "armor", "weaken"] as const)
      this[key].ms = Math.max(0, this[key].ms - dt);
    this.rootMs = Math.max(0, this.rootMs - dt);
    this.stunMs = Math.max(0, this.stunMs - dt);
    this.fearMs = Math.max(0, this.fearMs - dt);
    this.silenceMs = Math.max(0, this.silenceMs - dt);
    this.jamMs = Math.max(0, this.jamMs - dt);
    return dot;
  }
  /** True when the next attack of the player misses (accumulator, no randomness). */
  rollMiss(): boolean {
    if (this.blind.ms <= 0) return false;
    this.missAcc += this.blind.pct;
    if (this.missAcc >= 1) {
      this.missAcc -= 1;
      return true;
    }
    return false;
  }
}
