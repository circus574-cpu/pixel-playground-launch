import type { GameSession } from "../../session";
import type { PracticeTarget } from "../targets";
import type { HeritageGoal } from "./types";
import type { ApprovedActivity } from "./reducer";
import type { Point } from "../../navigation";

/** Real attacks between explicit no-hit windows; the yielding master is never a killable NPC. */
export class RestraintActivity {
  readonly id = "restraint:" + crypto.randomUUID();
  readonly target: PracticeTarget;
  private phase: "strike" | "hold" | "surrender" | "passed" | "failed" = "strike";
  private until: number;
  private cycleHit = false;
  private windows = 0;
  private errors = 0;
  private reason = "";
  constructor(
    readonly session: GameSession,
    readonly goal: Extract<HeritageGoal, { kind: "restraint" }>,
    readonly owner: string,
    point: Point,
  ) {
    this.until = session.nowMs + 4000;
    this.target = session.practiceTargets.add(
      this.id,
      goal.surrender ? "Mistrz próby — bezpieczny cel" : "Cel opanowania",
      point,
      session.player.interior,
      session.nowMs,
      (contact) => {
        if (contact.hit.indirect) return;
        if (this.phase === "strike") this.cycleHit = true;
        else if (this.phase === "hold" || this.phase === "surrender") {
          this.errors++;
          if (this.phase === "surrender" || this.errors > goal.maxErrors)
            this.fail("Cios po sygnale zatrzymania. Mistrz nie ginie; ponów ćwiczebny etap.");
        }
      },
    );
    session.targetId = this.target.id;
  }
  private fail(reason: string) {
    this.phase = "failed";
    this.reason = reason;
    this.session.practiceTargets.removeOwner(this.id);
  }
  update() {
    const s = this.session;
    if (this.phase === "passed" || this.phase === "failed") return;
    if (s.player.dead || s.player.interior !== this.target.interior)
      return this.fail("Próbę przerwano przez śmierć lub opuszczenie sali.");
    if (s.nowMs < this.until) return;
    if (this.phase === "strike") {
      if (!this.cycleHit) {
        this.errors++;
        if (this.errors > this.goal.maxErrors)
          return this.fail("Zabrakło celnego ciosu między oknami zatrzymania.");
      }
      this.phase = "hold";
      this.until = s.nowMs + 2000;
    } else if (this.phase === "hold") {
      if (this.cycleHit) this.windows++;
      this.cycleHit = false;
      if (this.windows >= this.goal.windows) {
        if (this.goal.surrender) {
          this.phase = "surrender";
          this.until = s.nowMs + 2000;
        } else this.pass();
      } else {
        this.phase = "strike";
        this.until = s.nowMs + 4000;
      }
    } else this.pass();
  }
  private pass() {
    this.phase = "passed";
    this.reason = "Próba ukończona bez zabijania mistrza.";
    this.session.practiceTargets.removeOwner(this.id);
  }
  snapshot() {
    return {
      id: this.id,
      goalId: this.goal.id,
      title: "Próba kontroli",
      phase: this.phase,
      windows: this.windows,
      target: this.goal.windows,
      errors: this.errors,
      remainingMs: Math.max(0, this.until - this.session.nowMs),
      message:
        this.phase === "strike"
          ? "CIOS DOZWOLONY — traf raz zwykłym atakiem"
          : this.phase === "hold"
            ? "ZATRZYMAJ CIOS — nie atakuj"
            : this.phase === "surrender"
              ? "MISTRZ SIĘ PODDAJE — przestań atakować"
              : this.reason,
    };
  }
  proof(): ApprovedActivity | undefined {
    if (this.phase !== "passed") return undefined;
    return {
      owner: this.owner,
      goalId: this.goal.id,
      outcome: "passed",
      checkpoints: 0,
      protectedPoints: 0,
      windows: this.windows,
      healthFraction: 1,
      errors: this.errors,
      surrendered: this.goal.surrender,
    };
  }
  dispose() {
    this.session.practiceTargets.removeOwner(this.id);
  }
}
