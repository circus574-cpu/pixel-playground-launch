import type { GameSession } from "../../session";
import { distance, type Navigation, type Point } from "../../navigation";
import type { HeritageGoal } from "./types";
import type { HeritageTarget } from "./bindings";

type EscortGoal = Extract<HeritageGoal, { kind: "escort" }>;
export type EscortCheckpoint = {
  owner: string;
  goalId: string;
  checkpoint: number;
  actor: Point;
  player: Point;
  healthFraction: number;
};
/** Stable local route; every leg is checked against the existing navigation. */
export function escortRoute(nav: Navigation, start: Point, count: number, id: string): Point[] {
  if (!Number.isInteger(count) || count < 1 || count > 8) throw Error("Invalid escort route");
  const angle = ([...id].reduce((n, c) => n + c.charCodeAt(0), 0) * Math.PI) / 180;
  const points: Point[] = [];
  let previous = start;
  for (let i = 0; i < count; i++) {
    let selected: Point | undefined;
    for (let choice = 0; choice < 24; choice++) {
      const a = angle + (choice * Math.PI) / 12;
      const point = nav.safe({
        x: previous.x + Math.cos(a) * 210,
        y: previous.y + Math.sin(a) * 210,
      });
      const path = nav.path(previous, point);
      if (
        distance(previous, point) >= 140 &&
        path.length &&
        distance(path.at(-1)!, point) < 20 &&
        !points.some((p) => distance(p, point) < 90) &&
        distance(start, point) < 900
      ) {
        selected = point;
        break;
      }
    }
    if (!selected) throw Error("Brak bezpiecznej trasy eskorty w bieżącym miejscu.");
    points.push(selected);
    previous = selected;
  }
  return points;
}
/** Non-combat delivery only. Combat escorts must use actual protected-actor damage, not this controller. */
export class EscortActivity {
  readonly id = "escort:" + crypto.randomUUID();
  readonly actor: Point;
  private phase: "escort" | "passed" | "failed" = "escort";
  private completed: number;
  private lastNow: number;
  private repathAt = 0;
  private path: Point[] = [];
  private reason = "";
  private moving = false;
  private facing = { x: 0, y: 1 };
  constructor(
    private readonly session: GameSession,
    readonly goal: EscortGoal,
    readonly owner: string,
    readonly base: HeritageTarget,
    readonly route: readonly Point[],
    completed: number,
    private readonly confirm: (proof: EscortCheckpoint) => boolean,
  ) {
    if (
      goal.combat ||
      route.length !== goal.checkpoints ||
      !Number.isInteger(completed) ||
      completed < 0 ||
      completed >= route.length
    )
      throw Error("Invalid peaceful escort");
    this.completed = completed;
    this.actor = { ...(completed ? route[completed - 1]! : base.point) };
    this.lastNow = session.nowMs;
  }
  nextTarget(): HeritageTarget {
    return {
      ...this.base,
      id: this.goal.id + ":checkpoint:" + this.completed,
      label:
        this.goal.actor +
        " · punkt " +
        Math.min(this.completed + 1, this.goal.checkpoints) +
        "/" +
        this.goal.checkpoints,
      point: this.route[Math.min(this.completed, this.route.length - 1)]!,
      witness: false,
    };
  }
  update() {
    const s = this.session,
      dt = Math.min(100, Math.max(0, s.nowMs - this.lastNow));
    this.lastNow = s.nowMs;
    this.moving = false;
    if (this.phase !== "escort" || dt === 0) return;
    if (
      s.player.dead ||
      s.player.interior !== this.base.interior ||
      distance(s.player, this.actor) > 650
    ) {
      this.phase = "failed";
      this.reason = "Eskortę przerwano. Ostatni zapisany punkt pozostaje do wznowienia.";
      return;
    }
    // A companion waits for the player. Time alone never completes a checkpoint.
    if (distance(s.player, this.actor) > 220) return;
    const next = this.route[this.completed]!;
    if (distance(this.actor, next) < 20) {
      if (distance(s.player, next) > 130 || !s.nav.visible(s.player, next)) return;
      const proof = {
        owner: this.owner,
        goalId: this.goal.id,
        checkpoint: this.completed + 1,
        actor: { ...this.actor },
        player: { x: s.player.x, y: s.player.y },
        healthFraction: 1,
      };
      if (!this.confirm(proof)) return;
      this.completed++;
      this.path = [];
      if (this.completed === this.route.length) {
        this.phase = "passed";
        this.reason = "Dostawa dotarła do celu. Punkty zapisano.";
      }
      return;
    }
    if (s.nowMs >= this.repathAt || !this.path.length) {
      this.path = s.nav.path(this.actor, next);
      this.repathAt = s.nowMs + 750;
    }
    const waypoint = this.path[0];
    if (!waypoint) return;
    const before = { ...this.actor },
      position = s.nav.step(this.actor, waypoint, (100 * dt) / 1000);
    Object.assign(this.actor, position);
    this.moving = distance(before, position) > 0.01;
    if (this.moving) this.facing = { x: position.x - before.x, y: position.y - before.y };
    if (distance(this.actor, waypoint) < 5) this.path.shift();
  }
  snapshot() {
    return {
      id: this.id,
      goalId: this.goal.id,
      title: "Eskorta dostawy",
      phase: this.phase,
      windows: this.completed,
      target: this.goal.checkpoints,
      errors: 0,
      remainingMs: 0,
      message:
        this.phase === "escort"
          ? "Prowadź towarzysza do kolejnego punktu. Czeka, gdy odejdziesz."
          : this.reason,
      actor: {
        ...this.actor,
        name: this.goal.actor,
        moving: this.moving,
        facing: { ...this.facing },
      },
    };
  }
  dispose() {
    this.phase = "failed";
    this.path = [];
  }
}
