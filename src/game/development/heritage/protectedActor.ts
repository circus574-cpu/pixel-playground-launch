import type { GameSession } from "../../session";
import { PlayerFx, statusText } from "../../monsters/fx";
import type { MonsterReceiver } from "../../monsters/receivers";
import type { Enemy, FxSpec } from "../../monsters/types";
import type { HurtKind } from "../../monsters/system";
import type { Point } from "../../navigation";

/** A friendly body using the existing incoming damage/FX rules, not a second combat simulation. */
export class ProtectedActor implements MonsterReceiver {
  readonly id = "protected-actor:" + crypto.randomUUID();
  readonly body: Point & { hp: number; dead: boolean };
  readonly fx = new PlayerFx();
  private active = true;
  private dotCarry = 0;
  constructor(
    private readonly session: GameSession,
    readonly name: string,
    point: Point,
    readonly maxHp: number,
    readonly defense: number,
    readonly mobile: boolean,
  ) {
    if (
      !name ||
      ![point.x, point.y, maxHp, defense].every(Number.isFinite) ||
      maxHp <= 0 ||
      defense < 0
    )
      throw Error("Invalid protected actor");
    this.body = { ...point, hp: maxHp, dead: false };
    session.monsters.registerCombatTarget(this);
  }
  valid() {
    return this.active && !this.body.dead;
  }
  hurt(raw: number, from: Enemy, kind: HurtKind, fixed = false) {
    if (!this.valid() || !Number.isFinite(raw) || raw <= 0) return { dealt: 0, evaded: true };
    let amount = raw;
    if (from.fx.weaken.ms > 0) amount *= 1 - from.fx.weaken.pct;
    if (!fixed) {
      amount *= 1 + this.fx.markPct(!!from.m.def.traits.machine);
      amount -= (this.defense * (1 - this.fx.armorPct)) / 2;
    }
    const dealt = this.takeDamage(Math.max(1, amount));
    void kind;
    return { dealt, evaded: false };
  }
  private takeDamage(amount: number) {
    if (!this.valid()) return 0;
    const dealt = Math.min(this.body.hp, amount);
    this.body.hp -= dealt;
    this.session.emit({
      type: "hit",
      ...this.body,
      target: this.id,
      text: "−" + Math.round(dealt),
    });
    if (this.body.hp <= 0) {
      this.body.hp = 0;
      this.body.dead = true;
      this.fx.clear();
      this.session.emit({ type: "death", ...this.body, target: this.id });
    }
    return dealt;
  }
  applyFx(spec: FxSpec, from: Enemy) {
    if (!this.valid()) return;
    if (spec.k === "pull") {
      if (this.mobile) Object.assign(this.body, this.session.nav.step(this.body, from, spec.dist));
      return;
    }
    if (spec.k === "breakShield") return; // No borrowed player shields or healing are present on this body.
    this.fx.apply(spec, {
      cc: this.mobile ? 1 : 0,
      stunImmune: !this.mobile,
      atk: from.m.def.atk,
      machine: !!from.m.def.traits.machine,
      from: { x: from.x, y: from.y },
    });
    const text = statusText(spec);
    const id = spec.k === "armorDown" ? "armor" : spec.k === "dot" ? spec.id : spec.k;
    if (text && this.fx.active.some((effect) => effect.id === id))
      this.session.emit({ type: "status", ...this.body, target: this.id, text });
  }
  tick(dt: number) {
    if (!this.valid() || !Number.isFinite(dt) || dt <= 0) return;
    this.dotCarry += this.fx.tick(dt);
    if (this.dotCarry >= 1) {
      const whole = Math.floor(this.dotCarry);
      this.dotCarry -= whole;
      this.takeDamage(whole);
    }
  }
  snapshot() {
    return { id: this.id, name: this.name, ...this.body, maxHp: this.maxHp, mobile: this.mobile };
  }
  dispose() {
    if (!this.active) return;
    this.active = false;
    this.fx.clear();
    this.dotCarry = 0;
    this.session.monsters.unregisterCombatTarget(this.id);
  }
}
