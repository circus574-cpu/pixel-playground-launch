import type { GameSession } from "../../session";
import type { PracticeContact, PracticeTarget } from "../targets";
import type { TrialTier } from "./catalog";

export type CalibrationKind = "ordered-shots" | "moving-shots" | "marked-shots";
const STATIONS = [
  [500, 140],
  [640, 260],
  [820, 300],
  [820, 620],
  [520, 620],
  [240, 620],
  [240, 300],
  [240, 140],
] as const;
/** Real production projectiles and marks; room targets never grant XP or loot. */
export class CalibrationTrial {
  readonly targets: PracticeTarget[] = [];
  readonly target: number;
  readonly speed: number;
  private completed = new Set<string>();
  private pending = new Map<string, { target: PracticeTarget; hits: number }>();
  private phase: "running" | "passed" | "failed" = "running";
  private reason = "";
  private errors = 0;
  private elapsed = 0;
  private previousNow: number;
  private originalUse;
  constructor(
    private readonly session: GameSession,
    readonly kind: CalibrationKind,
    readonly tier: TrialTier,
    private readonly owner: string,
  ) {
    this.target = kind === "ordered-shots" ? [4, 6, 8][tier - 1]! : tier + 2;
    this.speed = [40, 55, 70][tier - 1]!;
    this.previousNow = session.nowMs;
    const total = this.target + (kind === "marked-shots" ? 2 : 0);
    for (let i = 0; i < total; i++) {
      const point =
        kind === "moving-shots"
          ? { x: 500, y: 140 + i * 115 }
          : { x: STATIONS[i]![0], y: STATIONS[i]![1] };
      const label =
        i >= this.target
          ? i === this.target
            ? "CHRONIONY — nie strzelaj"
            : "Wabik — nie strzelaj"
          : `${i + 1}. ${kind === "marked-shots" ? "Znak zgodny z kartą — oznacz A1, potem R" : "Cel kalibracji"}`;
      const t = session.practiceTargets.add(owner, label, point, null, session.nowMs, (contact) =>
        this.hit(i, contact),
      );
      this.targets.push(t);
    }
    this.originalUse = session.kit.use;
    session.kit.use = (id) => {
      const before = session.kit.remaining(id),
        shots = new Set(session.projectiles.active.map((s) => s.id));
      const result = this.originalUse.call(session.kit, id);
      if (id === "R" && !session.paused && this.phase === "running") {
        if (!result.ok && before <= 0) this.miss("Chybienie: sprawdź zasięg i widoczność celu.");
        for (const shot of session.projectiles.active)
          if (!shots.has(shot.id)) {
            const target = this.targets.find((t) => t === shot.target);
            if (target) this.pending.set(shot.id, { target, hits: target.hits });
          }
      }
      return result;
    };
  }
  private miss(reason: string) {
    this.errors++;
    if (this.errors > (this.kind === "marked-shots" ? 0 : 2)) {
      this.phase = "failed";
      this.reason = reason;
    }
  }
  private hit(index: number, contact: PracticeContact) {
    if (this.phase !== "running" || this.session.paused || contact.hit.indirect) return;
    const target = this.targets[index]!;
    if (
      contact.hit.ability !== "R" ||
      index >= this.target ||
      (this.kind === "marked-shots" && !contact.marked)
    ) {
      this.miss("Trafiono chroniony, fałszywy lub nieoznaczony cel.");
      return;
    }
    if (
      this.completed.has(target.id) ||
      (this.kind === "ordered-shots" && index !== this.completed.size)
    ) {
      this.miss("Trafiono cel poza kolejnością albo ponownie zaliczony cel.");
      return;
    }
    this.completed.add(target.id);
    if (this.completed.size === this.target) this.phase = "passed";
  }
  get point() {
    return this.targets.find((t, i) => i < this.target && !this.completed.has(t.id));
  }
  update() {
    const dt = this.session.nowMs - this.previousNow;
    this.previousNow = this.session.nowMs;
    if (dt <= 0 || this.session.paused || this.phase !== "running") return;
    this.elapsed += dt;
    if (this.elapsed > 240000) {
      this.phase = "failed";
      this.reason = "Przekroczono jawny limit sali 240 s.";
      return;
    }
    const live = new Set(this.session.projectiles.active.map((s) => s.id));
    for (const [id, shot] of this.pending)
      if (!live.has(id)) {
        if (shot.target.hits === shot.hits)
          this.miss("Pocisk nie trafił celu. Maksymalnie dwa chybienia.");
        this.pending.delete(id);
      }
    if (this.kind === "moving-shots")
      for (const [i, t] of this.targets.entries()) {
        const travel = ((this.elapsed * this.speed) / 1000 + i * 37) % 460;
        t.x = 420 + (travel <= 230 ? travel : 460 - travel);
      }
  }
  snapshot() {
    return {
      kind: this.kind,
      phase: this.phase,
      completed: this.completed.size,
      target: this.target,
      errors: this.errors,
      reason: this.reason,
      point: this.point ? { x: this.point.x, y: this.point.y } : null,
      targetId: this.point?.id ?? null,
      speed: this.kind === "moving-shots" ? this.speed : 0,
      remainingMs: Math.max(0, 240000 - this.elapsed),
      targets: this.targets.map((t, i) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        name: t.name,
        current: t === this.point,
        protected: i >= this.target,
        completed: this.completed.has(t.id),
      })),
    };
  }
  dispose() {
    this.session.kit.use = this.originalUse;
    this.pending.clear();
    this.session.practiceTargets.removeOwner(this.owner);
  }
}
