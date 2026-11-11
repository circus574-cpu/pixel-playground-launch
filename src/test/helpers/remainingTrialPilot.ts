import type { TrialAttempt } from "../../game/development/trials/attempt";
import type { Command } from "../../game/session";
import { distance, type Point } from "../../game/navigation";
import { trialPuzzles } from "../../game/development/trials/puzzles";

export const REMAINING_TRIAL_IDS = [
  "TN01",
  "TN02",
  "TN03",
  "TN04",
  "TN05",
  "TN06",
  "TN10",
  "TN11",
  "TN12",
  "TP01",
  "TP02",
  "TP03",
  "TP04",
  "TP05",
  "TP06",
  "TP10",
  "TP11",
  "TP12",
] as const;
export type TrialPilotPort = {
  input: (command: Command) => void;
  inspect: () => void;
  answer: (round: number, answer: string) => void;
};
/** Test-only player. Every action passes through either normal local commands or server intentions.
 * It never mutates HP, charge, cooldowns, outcomes, receivers or receipts. */
export class RemainingTrialPilot {
  private moveKey = "";
  private selected = "";
  private evadeUntil = 0;
  constructor(
    private readonly a: TrialAttempt,
    private readonly port: TrialPilotPort,
  ) {}
  private move(p: Point, key: string) {
    if (this.moveKey !== key) {
      this.moveKey = key;
      this.port.input({ type: "move", x: p.x, y: p.y });
    }
  }
  private cast(ability: Extract<Command, { type: "ability" }>["ability"]) {
    if (!this.a.session.kit.remaining(ability)) this.port.input({ type: "ability", ability });
  }
  step() {
    const a = this.a,
      s = a.session,
      r = a.snapshot();
    if (r.combat) {
      const c = r.combat;
      if (c.phase === "decision") {
        if (distance(s.player, c.point) > 65) this.move(c.point, "decision");
        else {
          this.port.inspect();
          this.port.answer(r.round, "disengage");
          this.selected = "";
          this.moveKey = "";
        }
      } else if (c.phase === "return") {
        if (this.moveKey !== "return") this.port.input({ type: "cancel" });
        this.move(c.point, "return");
        this.selected = "";
      } else {
        const enemy = s.enemies.find((e) => e.encounterOwner && e.hp > 0 && e.mode !== "dead");
        if (enemy) {
          // Read a real telegraph and walk out of its committed area/charge line.
          if (enemy.m.cast && this.evadeUntil <= s.nowMs) {
            const dx = s.player.x - enemy.x,
              dy = s.player.y - enemy.y;
            const len = Math.hypot(dx, dy) || 1;
            const points = [1, -1].map((sign) =>
              s.nav.safe({
                x: s.player.x - ((sign * dy) / len) * 220,
                y: s.player.y + ((sign * dx) / len) * 220,
              }),
            );
            const point = points.find(
              (p) => distance(p, s.player) > 140 && s.nav.visible(p, s.player),
            );
            if (point) {
              this.port.input({ type: "cancel" });
              this.move(point, `evade:${s.nowMs}`);
              this.evadeUntil = s.nowMs + enemy.m.cast.ms + 350;
              this.selected = "";
            }
          }
          if (s.nowMs < this.evadeUntil || enemy.m.charge) return;
          this.moveKey = "";
          if (this.selected !== enemy.id || s.targetId !== enemy.id) {
            this.selected = enemy.id;
            this.port.input({ type: "target", id: enemy.id });
          }
          if (distance(s.player, enemy) <= s.kit.basicRange + 10) {
            this.cast("B4");
            this.cast("B1");
            this.cast("C1");
            this.cast("A1");
          }
          if (s.player.hp < s.kit.stats.maxHp * 0.5 && s.player.items.potion > 0)
            this.cast("potion");
        } else {
          this.selected = "";
          const point =
            c.companion && distance(s.player, c.companion) > 190 ? c.companion : c.point;
          const key = `${Math.floor(point.x / 40)},${Math.floor(point.y / 40)}`;
          if (this.moveKey !== key) this.port.input({ type: "cancel" });
          this.move(point, key);
        }
      }
    } else if (r.body) {
      const b = r.body;
      if (b.kind === "burden-route") {
        if (b.point) this.move(b.point, `${b.point.x},${b.point.y}`);
      } else if (distance(s.player, b.point) > 15) this.move(b.point, "break-position");
      else if (b.phase === "window") {
        this.port.input({ type: "target", id: b.targetId });
        this.cast("B1");
      }
    } else if (r.resourceControl) {
      const c = r.resourceControl;
      if (distance(s.player, c.point) > 15) {
        this.move(c.point, "resource-position");
        return;
      }
      this.port.input({ type: "cancel" });
      this.port.input({ type: "target", id: c.targetId });
      if (c.kind === "ki-budget") this.cast("A1");
      else if (c.kind.endsWith("windows")) {
        if (c.phase === "window") this.cast(c.kind === "core-windows" ? "C1" : "C4");
        else if (c.phase === "build" && c.value / c.max < 0.35) this.cast("R");
      } else if (c.kind === "core-sequence") {
        if (c.discharges < c.dischargeTarget && c.value / c.max >= 0.3 && !s.kit.remaining("C1"))
          this.cast("C1");
        else if (
          (c.shots < c.shotTarget || c.discharges < c.dischargeTarget) &&
          c.value / c.max < 0.6
        )
          this.cast("R");
      } else if (c.value / c.max < (c.kind === "core-band" ? 0.45 : 0.5)) this.cast("R");
    } else if (r.calibration) {
      const c = r.calibration,
        p = c.point!;
      if (distance(s.player, p) > 95 || !s.nav.visible(s.player, p))
        this.move({ x: p.x, y: p.y + 55 }, `${c.targetId}:${Math.floor(p.x / 75)}`);
      else {
        this.moveKey = "";
        this.port.input({ type: "cancel" });
        this.port.input({ type: "target", id: c.targetId! });
        const target = s.practiceTargets.get(c.targetId!)!;
        if (c.kind === "marked-shots" && target.markedUntil < s.nowMs + 500) this.cast("A1");
        else if (!s.projectiles.active.length) this.cast("R");
      }
    } else {
      const point = r.point!;
      if (distance(s.player, point) > 65 || !s.nav.visible(s.player, point))
        this.move(point, `puzzle:${r.round}`);
      else {
        this.port.input({ type: "cancel" });
        this.port.inspect();
        this.port.answer(r.round, trialPuzzles(a.definition, a.tier)[r.round]!.answer);
      }
    }
  }
}
