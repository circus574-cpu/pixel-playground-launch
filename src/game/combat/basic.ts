import type { Point } from "../navigation";

/** Prototype timings, not approved racial canon. Damage/range/interval remain kit data. */
export const BASIC_PROTOTYPE = { windupMs: 100, activeMs: 80, minimumDot: 0.5 } as const;
export type CombatInput =
  | { kind: "hold"; value: boolean }
  | { kind: "press" }
  | { kind: "aim"; direction: Point }
  | { kind: "cancel" };
export type AttackPhase = "ready" | "windup" | "active" | "recovery";
export type BasicHost = {
  canStart(): boolean;
  interval(): number;
  facing(): Point;
  started(id: string, facing: Point): void;
  /** Returns true after one resolved hit (including miss/shield), false if no legal target. */
  hit(id: string, facing: Point): boolean;
};

/** One bounded input queue and one action. No renderer, frame callbacks or persistent saves. */
export class BasicCombat {
  phase: AttackPhase = "ready";
  actionId = "";
  private sequence = 0;
  private actionSequence = 0;
  private queue: { sequence: number; input: CombatInput }[] = [];
  private held = false;
  private pressed = false;
  private elapsed = 0;
  private duration = 0;
  private resolved = false;
  private direction: Point = { x: 0, y: 1 };
  private aim: Point | undefined;
  enqueue(input: CombatInput) {
    // Bounded queue; overflow cancels rather than retaining a potentially stuck hold.
    if (this.queue.length >= 64) {
      this.cancel();
      return;
    }
    this.queue.push({ sequence: ++this.sequence, input });
  }
  cancel() {
    this.queue = [];
    this.held = this.pressed = false;
    this.phase = "ready";
    this.aim = undefined;
  }
  step(dt: number, host: BasicHost) {
    for (const { input } of this.queue.splice(0)) {
      if (input.kind === "cancel") {
        this.cancel();
        break;
      }
      if (input.kind === "hold") this.held = input.value;
      if (input.kind === "press") this.pressed = true;
      if (input.kind === "aim") {
        const length = Math.hypot(input.direction.x, input.direction.y);
        if (Number.isFinite(length) && length > 0)
          this.aim = { x: input.direction.x / length, y: input.direction.y / length };
      }
    }
    if (this.phase === "ready") {
      if (!(this.held || this.pressed)) return;
      this.pressed = false;
      if (!host.canStart()) return;
      this.actionId = `player:basic:${++this.actionSequence}`;
      this.direction = { ...(this.aim ?? host.facing()) };
      this.duration = Math.max(
        BASIC_PROTOTYPE.windupMs + BASIC_PROTOTYPE.activeMs,
        host.interval(),
      );
      this.elapsed = 0;
      this.resolved = false;
      this.phase = "windup";
      host.started(this.actionId, this.direction);
      return;
    }
    this.elapsed += dt;
    if (this.elapsed + 1e-7 >= this.duration) {
      this.phase = "ready";
      return;
    }
    if (this.elapsed + 1e-7 >= BASIC_PROTOTYPE.windupMs + BASIC_PROTOTYPE.activeMs) {
      this.phase = "recovery";
    } else if (this.elapsed + 1e-7 >= BASIC_PROTOTYPE.windupMs) {
      this.phase = "active";
      if (!this.resolved) this.resolved = host.hit(this.actionId, this.direction);
    }
  }
}

/** A facing cone with a hard range cutoff. LOS is checked by the navigation adapter. */
export function inBasicHitbox(origin: Point, target: Point, facing: Point, range: number) {
  const dx = target.x - origin.x,
    dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  return (
    length <= range &&
    (length < 1e-7 || (dx * facing.x + dy * facing.y) / length >= BASIC_PROTOTYPE.minimumDot)
  );
}
