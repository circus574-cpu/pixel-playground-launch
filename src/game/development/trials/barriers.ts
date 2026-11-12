import { distance } from "../../navigation";
import type { GameSession } from "../../session";
import { ProtectedActor } from "../heritage/protectedActor";
import type { TrialTier } from "./catalog";

/** Local environmental waves use the real borrowed B1 shield and common object damage. */
export class BarrierWaves {
  readonly actor: ProtectedActor;
  private phase: "prepare" | "warning" | "passed" | "failed" = "prepare";
  private until = 1500;
  private completed = 0;
  readonly target: number;
  constructor(
    private readonly session: GameSession,
    tier: TrialTier,
  ) {
    this.target = tier + 2;
    this.actor = new ProtectedActor(
      session,
      "Rdzeń archiwalny",
      { x: 550, y: 470 },
      100,
      0,
      false,
      false,
    );
  }
  get origin() {
    return { x: 550, y: this.completed % 2 === 0 ? 170 : 650 };
  }
  get point() {
    return { x: 550, y: this.completed % 2 === 0 ? 400 : 540 };
  }
  update() {
    const s = this.session;
    if (this.phase === "prepare" && s.nowMs >= this.until) {
      this.phase = "warning";
      this.until = s.nowMs + 1800;
      s.emit({ type: "telegraph", ...this.actor.body, radius: 75, ms: 1800 });
    } else if (this.phase === "warning" && s.nowMs >= this.until) {
      // B1 is a self shield. In this drill the marked interception position stands in the ray.
      const intercept =
        distance(s.player, this.point) <= 40 && s.nav.visible(s.player, this.actor.body);
      const before = s.kit.shields.find((shield) => shield.id === "B1")?.amount ?? 0;
      let damage = 30;
      if (intercept && before > 0) {
        s.kit.absorb(30, "projectile");
        const after = s.kit.shields.find((shield) => shield.id === "B1")?.amount ?? 0;
        // Dodge/invulnerability cannot substitute for actually spending the barrier's capacity.
        damage -= Math.min(30, Math.max(0, before - after));
      }
      this.actor.hurtEnvironment(damage);
      this.completed++;
      if (this.actor.body.hp < 50) this.phase = "failed";
      else if (this.completed >= this.target) this.phase = "passed";
      else {
        this.phase = "prepare";
        this.until = s.nowMs + 11000;
      }
    }
  }
  snapshot() {
    return {
      phase: this.phase,
      completed: this.completed,
      target: this.target,
      remainingMs: Math.max(0, this.until - this.session.nowMs),
      origin: this.origin,
      point: this.point,
      object: this.actor.snapshot(),
    };
  }
  dispose() {
    this.actor.dispose();
    if (this.phase !== "passed") this.phase = "failed";
  }
}

/** Every window requires both movement after the warning and a real terrain occluder. */
export class CoverWindows {
  readonly reactionMs: number;
  readonly target: number;
  private phase: "prepare" | "warning" | "passed" | "failed" = "prepare";
  private until = 1200;
  private completed = 0;
  private start = { x: 0, y: 0 };
  constructor(
    private readonly session: GameSession,
    tier: TrialTier,
  ) {
    this.reactionMs = [1800, 1500, 1300][tier - 1]!;
    this.target = tier + 2;
    Object.assign(session.player, { x: 400, y: 480 });
    if (!session.nav.walkable(this.point) || session.nav.visible(this.origin, this.point))
      throw Error("Brak rzeczywistej osłony okna.");
  }
  get origin() {
    return this.completed % 2 === 0 ? { x: 470, y: 410 } : { x: 310, y: 250 };
  }
  get point() {
    return this.completed % 2 === 0 ? { x: 310, y: 410 } : { x: 400, y: 480 };
  }
  update() {
    const s = this.session;
    if (this.phase === "prepare" && s.nowMs >= this.until) {
      this.phase = "warning";
      this.start = { x: s.player.x, y: s.player.y };
      this.until = s.nowMs + this.reactionMs;
      s.emit({ type: "telegraph", ...this.start, radius: 55, ms: this.reactionMs });
    } else if (this.phase === "warning" && s.nowMs >= this.until) {
      if (
        distance(s.player, this.point) > 50 ||
        distance(s.player, this.start) < 30 ||
        s.nav.visible(this.origin, s.player)
      ) {
        this.phase = "failed";
        return;
      }
      this.completed++;
      if (this.completed >= this.target) this.phase = "passed";
      else {
        this.phase = "prepare";
        this.until = s.nowMs + 1200;
      }
    }
  }
  snapshot() {
    return {
      phase: this.phase,
      completed: this.completed,
      target: this.target,
      reactionMs: this.reactionMs,
      remainingMs: Math.max(0, this.until - this.session.nowMs),
      origin: this.origin,
      point: this.point,
    };
  }
  dispose() {
    if (this.phase !== "passed") this.phase = "failed";
  }
}
