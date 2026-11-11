import type { GameSession } from "../../session";
import { distance } from "../../navigation";
import type { TrialTier } from "./catalog";
import type { PracticeTarget } from "../targets";

export const BODY_ROOM = {
  loadPenalty: 0.2,
  hazardHp: 0.1,
  cueMs: 1500,
  windowMs: 4000,
  breakLimitMs: 240000,
} as const;
const ROUTE = [
  { x: 230, y: 550 },
  { x: 240, y: 170 },
  { x: 520, y: 130 },
  { x: 810, y: 250 },
  { x: 820, y: 620 },
  { x: 520, y: 620 },
  { x: 520, y: 350 },
  { x: 230, y: 550 },
];
export class BurdenRoute {
  readonly route;
  readonly hazards = [{ x: 600, y: 440, radius: 50 }];
  readonly limitMs: number;
  private elapsed = 0;
  private previousNow: number;
  private completed = 0;
  private inside = false;
  private phase: "running" | "passed" | "failed" = "running";
  private reason = "";
  constructor(
    private readonly session: GameSession,
    tier: TrialTier,
  ) {
    this.route = ROUTE.slice(0, [4, 6, 8][tier - 1]);
    this.limitMs = [180000, 210000, 240000][tier - 1]!;
    this.previousNow = session.nowMs;
    session.kit.addBuff({
      id: "trial-burden",
      ms: this.limitMs + 1000,
      speedPct: -BODY_ROOM.loadPenalty,
    });
  }
  get point() {
    return this.phase === "running" ? this.route[this.completed] : undefined;
  }
  update() {
    const s = this.session,
      dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (dt <= 0 || s.paused || this.phase !== "running") return;
    this.elapsed += dt;
    if (this.elapsed > this.limitMs) {
      this.phase = "failed";
      this.reason = "Przekroczono limit trasy z obciążeniem.";
      return;
    }
    const inside = this.hazards.some((h) => distance(s.player, h) < h.radius);
    if (inside && !this.inside) {
      const dealt = s.kit.absorb(s.kit.stats.maxHp * BODY_ROOM.hazardHp, "other");
      s.player.hp = Math.max(0, s.player.hp - dealt);
      s.emit({
        type: "hit",
        ...s.player,
        target: "player",
        text: "Obciążona trasa: −" + Math.round(dealt),
      });
    }
    this.inside = inside;
    if (this.point && distance(s.player, this.point) <= 45 && s.nav.visible(s.player, this.point)) {
      this.completed++;
      if (this.completed === this.route.length) {
        this.phase = s.player.hp >= s.kit.stats.maxHp * 0.3 ? "passed" : "failed";
        if (this.phase === "failed") this.reason = "Pozostało mniej niż 30% HP.";
      }
    }
  }
  snapshot() {
    return {
      kind: "burden-route" as const,
      phase: this.phase,
      completed: this.completed,
      target: this.route.length,
      point: this.point ?? null,
      reason: this.reason,
      remainingMs: Math.max(0, this.limitMs - this.elapsed),
      loadPenalty: BODY_ROOM.loadPenalty,
      healthFraction: this.session.player.hp / this.session.kit.stats.maxHp,
      hazards: this.hazards,
      route: this.route,
    };
  }
  dispose() {
    this.session.kit.removeBuff("trial-burden");
  }
}
/** The real B1 must hit AND invoke the production shield-breaking port during the window. */
export class BreakWindows {
  readonly target: PracticeTarget;
  readonly goal: number;
  private phase: "prepare" | "cue" | "window" | "passed" | "failed" = "prepare";
  private completed = 0;
  private errors = 0;
  private elapsed = 0;
  private until = 0;
  private previousNow: number;
  private eligible = false;
  private reason = "";
  private originalUse;
  constructor(
    private readonly session: GameSession,
    tier: TrialTier,
    private readonly owner: string,
  ) {
    this.goal = tier + 2;
    this.previousNow = session.nowMs;
    this.target = session.practiceTargets.add(
      owner,
      "Osłona przełamania — użyj B1 w oknie",
      { x: 600, y: 300 },
      null,
      session.nowMs,
      (c) => {
        if (this.phase === "passed" || this.phase === "failed" || session.paused || c.hit.indirect)
          return;
        this.eligible = this.phase === "window" && c.at <= this.until && c.hit.ability === "B1";
        if (!this.eligible) this.miss("Chybiona akcja: przełamanie wymaga B1 w aktywnym oknie.");
      },
    );
    this.originalUse = session.kit.use;
    session.kit.use = (id) => {
      const remaining = session.kit.remaining(id);
      const result = this.originalUse.call(session.kit, id);
      if (
        !result.ok &&
        id === "B1" &&
        remaining <= 0 &&
        !session.paused &&
        this.phase !== "passed" &&
        this.phase !== "failed"
      )
        this.miss("B1 nie trafiło osłony.");
      return result;
    };
  }
  private miss(reason: string) {
    this.errors++;
    if (this.errors > 2) {
      this.phase = "failed";
      this.reason = reason;
    }
  }
  get point() {
    return { x: 540, y: 300 };
  }
  update() {
    const s = this.session,
      dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (dt <= 0 || s.paused || this.phase === "passed" || this.phase === "failed") return;
    this.elapsed += dt;
    if (this.elapsed > BODY_ROOM.breakLimitMs) {
      this.phase = "failed";
      this.reason = "Przekroczono limit przełamań 240 s.";
      return;
    }
    if (this.phase === "prepare" && !s.kit.remaining("B1")) {
      this.phase = "cue";
      this.until = s.nowMs + BODY_ROOM.cueMs;
    } else if (this.phase === "cue" && s.nowMs >= this.until) {
      this.phase = "window";
      this.until = s.nowMs + BODY_ROOM.windowMs;
      this.eligible = false;
      s.practiceTargets.armShield(this.target, () => {
        if (!this.eligible || this.phase !== "window" || s.nowMs > this.until) return;
        this.completed++;
        this.eligible = false;
        this.phase = this.completed >= this.goal ? "passed" : "prepare";
        s.emit({ type: "buff", ...this.target, ability: "trial-break", text: "Osłona przełamana" });
      });
      s.emit({ type: "buff", ...this.target, ability: "trial-window", text: "TERAZ — B1" });
    } else if (this.phase === "window" && s.nowMs > this.until) {
      this.miss("Przegapiono okno przełamania.");
      if (this.errors <= 2) this.phase = "prepare";
    }
  }
  snapshot() {
    return {
      kind: "break-windows" as const,
      phase: this.phase,
      completed: this.completed,
      target: this.goal,
      point: this.point,
      targetId: this.target.id,
      errors: this.errors,
      reason: this.reason,
      shielded: this.session.practiceTargets.shielded(this.target),
      remainingMs: Math.max(0, this.until - this.session.nowMs),
    };
  }
  dispose() {
    this.session.kit.use = this.originalUse;
    this.session.practiceTargets.removeOwner(this.owner);
  }
}
