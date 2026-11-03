import type { GameSession } from "../../session";
import { distance, type Point } from "../../navigation";
import type { HeritageTarget } from "./bindings";
import type { HeritageGoal } from "./types";
import type { ApprovedActivity } from "./reducer";
import { HeritageEncounter, combatGround } from "./encounter";
import { escortRoute } from "./escort";

type ProtectionGoal = Extract<HeritageGoal, { kind: "protect" }>;
/** Sequential outpost defense. Each completed outpost is persisted, never inferred from a timer. */
export class ProtectionActivity {
  readonly id = "protection:" + crypto.randomUUID();
  private phase: "protect" | "passed" | "failed" = "protect";
  private encounter: HeritageEncounter | null = null;
  private completed: number;
  private wave = 0;
  private lastNow: number;
  private message = "";
  readonly points: readonly Point[];
  constructor(
    private readonly session: GameSession,
    readonly goal: ProtectionGoal,
    readonly owner: string,
    readonly base: HeritageTarget,
    completed: number,
    private readonly confirm: (proof: ApprovedActivity) => boolean,
    points?: readonly Point[],
  ) {
    if (
      base.interior ||
      !Number.isInteger(completed) ||
      completed < 0 ||
      completed >= goal.points ||
      goal.waves < goal.points ||
      !combatGround(session, base.point)
    )
      throw Error("Obrona wymaga terenu poza miastem i prawidłowego punktu wznowienia.");
    this.points =
      points ??
      (goal.points === 1
        ? [base.point]
        : [
            base.point,
            ...escortRoute(
              session.enemyNavigation ?? session.nav,
              base.point,
              Math.max(1, goal.points - 1),
              goal.id,
              (p) => combatGround(session, p),
            ),
          ].slice(0, goal.points));
    if (this.points.length !== goal.points || this.points.some((p) => !combatGround(session, p)))
      throw Error("Nieprawidłowe punkty obrony.");
    this.completed = completed;
    this.lastNow = session.nowMs;
  }
  nextTarget(): HeritageTarget {
    return {
      ...this.base,
      point: this.points[Math.min(this.completed, this.points.length - 1)]!,
      label: this.goal.label + " · punkt " + (this.completed + 1) + "/" + this.goal.points,
    };
  }
  private fail(message: string) {
    this.phase = "failed";
    this.message = message;
    this.encounter?.dispose();
    this.encounter = null;
  }
  update() {
    const s = this.session,
      dt = Math.max(0, s.nowMs - this.lastNow);
    this.lastNow = s.nowMs;
    if (this.phase !== "protect" || !dt) return;
    const point = this.points[this.completed]!;
    if (
      s.player.dead ||
      s.player.interior !== this.base.interior ||
      distance(s.player, point) > 650
    )
      return this.fail("Obrona przerwana. Ukończone punkty zachowano; wróć do punktu wznowienia.");
    if (!this.encounter) {
      if (distance(s.player, point) > 180) {
        this.message = "Podejdź do kolejnego punktu obrony.";
        return;
      }
      try {
        this.encounter = new HeritageEncounter(s, this.goal.id, "Węzeł ochronny", point, false);
      } catch (error) {
        return this.fail(
          error instanceof Error ? error.message : "Nie udało się rozpocząć obrony.",
        );
      }
    }
    this.encounter.update(dt);
    if (
      !this.encounter.actor.valid() ||
      this.encounter.healthFraction < this.goal.minHealthFraction
    )
      return this.fail(
        "Węzeł utracił wymagane zdrowie. Powtórz bieżący punkt; wcześniejsze zachowano.",
      );
    const waves =
      Math.ceil(((this.completed + 1) * this.goal.waves) / this.goal.points) -
      Math.ceil((this.completed * this.goal.waves) / this.goal.points);
    try {
      this.encounter.startWave(this.wave);
    } catch (error) {
      return this.fail(error instanceof Error ? error.message : "Nie udało się rozpocząć fali.");
    }
    this.message =
      "Broń węzła · fala " +
      (this.wave + 1) +
      "/" +
      waves +
      " · zdrowie " +
      Math.ceil(this.encounter.healthFraction * 100) +
      "%";
    if (!this.encounter.cleared) return;
    if (this.wave + 1 < waves) {
      this.wave++;
      return;
    }
    if (distance(s.player, point) > 180 || !s.nav.visible(s.player, point)) {
      this.message = "Wróć do obronionego węzła, aby zapisać punkt.";
      return;
    }
    if (
      !this.confirm({
        owner: this.owner,
        goalId: this.goal.id,
        outcome: "passed",
        checkpoints: 0,
        protectedPoints: this.completed + 1,
        windows: 0,
        healthFraction: this.encounter.healthFraction,
        errors: 0,
        surrendered: false,
      })
    )
      return;
    this.completed++;
    this.wave = 0;
    this.encounter.dispose();
    this.encounter = null;
    if (this.completed === this.goal.points) {
      this.phase = "passed";
      this.message = "Wszystkie punkty obronione i zapisane.";
    }
  }
  snapshot() {
    return {
      id: this.id,
      goalId: this.goal.id,
      title: "Obrona punktów",
      phase: this.phase,
      windows: this.completed,
      target: this.goal.points,
      errors: 0,
      remainingMs: 0,
      message: this.message,
      node:
        this.phase === "protect"
          ? { ...this.points[this.completed]!, healthFraction: this.encounter?.healthFraction ?? 1 }
          : null,
    };
  }
  dispose() {
    this.encounter?.dispose();
    this.encounter = null;
    this.phase = "failed";
  }
}
