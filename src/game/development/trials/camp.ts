import { distance, type Point } from "../../navigation";
import type { GameSession } from "../../session";
import type { TrialTier } from "./catalog";

/** Timed terrain-cover drill in the existing loan room, without a new combat simulation. */
export class CampTrial {
  readonly duration: number;
  readonly points: readonly Point[];
  readonly origins: readonly Point[];
  private index = 0;
  private next = 10000;
  private guarded = false;
  private completed = new Set<number>();
  private phase: "running" | "passed" | "failed" = "running";
  private elapsed = 0;
  constructor(
    private readonly session: GameSession,
    tier: TrialTier,
  ) {
    this.duration = [45000, 60000, 75000][tier - 1]!;
    this.points = [
      { x: 280, y: 290 },
      { x: 650, y: 470 },
      { x: 400, y: 310 },
      { x: 780, y: 470 },
    ].slice(0, tier + 1);
    this.origins = [
      { x: 480, y: 290 },
      { x: 820, y: 470 },
      { x: 230, y: 310 },
      { x: 650, y: 470 },
    ].slice(0, tier + 1);
    if (
      this.points.some(
        (p, i) => !session.nav.walkable(p) || session.nav.visible(this.origins[i]!, p),
      )
    )
      throw Error("Brak rzeczywistej osłony terenu dla obozu.");
  }
  get point() {
    return this.phase === "running" ? this.points[this.index] : undefined;
  }
  update(activeMs: number) {
    if (this.phase !== "running") return;
    this.elapsed = activeMs;
    const point = this.point!;
    if (
      distance(this.session.player, point) <= 60 &&
      !this.session.nav.visible(this.origins[this.index]!, this.session.player)
    )
      this.guarded = true;
    while (activeMs >= Math.min(this.next, this.duration)) {
      if (!this.guarded) {
        this.phase = "failed";
        return;
      }
      this.completed.add(this.index);
      if (this.next >= this.duration) {
        this.phase = this.completed.size === this.points.length ? "passed" : "failed";
        return;
      }
      this.next += 10000;
      this.index = (this.index + 1) % this.points.length;
      this.guarded = false;
    }
  }
  dispose() {
    if (this.phase === "running") this.phase = "failed";
  }
  snapshot() {
    return {
      phase: this.phase,
      completed: this.completed.size,
      remainingMs: Math.max(0, this.duration - this.elapsed),
      windowMs: Math.max(0, Math.min(this.next, this.duration) - this.elapsed),
      guarded: this.guarded,
      points: this.points.map((p, i) => ({
        ...p,
        current: i === this.index,
        guarded: this.completed.has(i),
      })),
      origin: this.origins[this.index]!,
    };
  }
}
