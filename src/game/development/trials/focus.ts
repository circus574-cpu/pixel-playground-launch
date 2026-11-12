import { distance, type Point } from "../../navigation";
import type { GameSession } from "../../session";
import type { TrialTier } from "./catalog";

/** Explicit room profiles. These are not racial stats or new canonical skill costs. */
export const FOCUS_ROOM = {
  cueMs: 1500,
  castWindowMs: 20000,
  preciseCost: 0.1,
  wideCost: 0.25,
  nodeWindowMs: 8000,
  nodeRadius: 45,
} as const;
const POINTS = [
  { x: 240, y: 550 },
  { x: 240, y: 160 },
  { x: 820, y: 160 },
  { x: 820, y: 620 },
  { x: 520, y: 620 },
];
type Phase = "travel" | "cue" | "ready" | "channel" | "running" | "passed" | "failed";
export class FocusTrial {
  private phase: Phase = "travel";
  private until = 0;
  private completed = 0;
  private previousNow = 0;
  private elapsed = 0;
  private spent = 0;
  private serial = 0;
  private nextNode = 0;
  private holdMs = 0;
  private seen = new Set<number>();
  private nodeDeadlines: number[];
  private reason = "";
  readonly target: number;
  readonly duration: number;
  readonly budget: number;
  readonly maxKi: number;
  constructor(
    private readonly session: GameSession,
    readonly kind: "focus-cycles" | "power-targets" | "sustain-nodes",
    tier: TrialTier,
  ) {
    this.target = kind === "power-targets" ? tier + 2 : tier + 1;
    this.duration = [45000, 60000, 75000][tier - 1]!;
    this.maxKi = session.kit.stats.maxKi;
    this.budget = this.maxKi * [0.7, 0.65, 0.6][tier - 1]!;
    this.nodeDeadlines = Array(this.target).fill(this.target * FOCUS_ROOM.nodeWindowMs + 2000);
    this.serial = session.kit.channelResult?.serial ?? 0;
    if (kind !== "focus-cycles") this.phase = "running";
  }
  get point(): Point {
    return POINTS[this.kind === "sustain-nodes" ? this.nextNode : this.completed % POINTS.length]!;
  }
  private fail(reason: string) {
    this.phase = "failed";
    this.reason = reason;
  }
  /** Called only by the attempt after current-round, inspection, distance and LOS validation. */
  feed(choice: string): boolean {
    if (this.kind !== "power-targets" || this.phase !== "running") return false;
    if (choice !== "precise" && choice !== "wide") return false;
    const cost = this.maxKi * (choice === "precise" ? FOCUS_ROOM.preciseCost : FOCUS_ROOM.wideCost);
    if (this.spent + cost > this.budget + 1e-7) {
      this.fail("Przekroczono łączny limit testowego KI. Regeneracja nie odnawia budżetu próby.");
      return false;
    }
    if (this.session.player.ki + 1e-7 < cost) return false;
    this.session.player.ki -= cost;
    this.spent += cost;
    this.session.emit({
      type: "buff",
      ...this.point,
      ability: "trial-power",
      text: "Cel zasilony",
    });
    this.completed++;
    if (this.completed === this.target) this.phase = "passed";
    return true;
  }
  update() {
    const s = this.session;
    const dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (dt <= 0 || this.phase === "failed" || this.phase === "passed") return;
    this.elapsed += dt;
    if (this.kind === "power-targets") return;
    if (this.kind === "sustain-nodes") {
      if (this.dangers.some((p) => distance(s.player, p) <= p.radius))
        return this.fail("Wejście w oznaczoną strefę zagrożenia przerwało utrzymywanie węzłów.");
      if (this.nodeDeadlines.some((deadline) => this.elapsed > deadline))
        return this.fail("Węzeł wygasł. Odwiedzaj kolejno wszystkie zaznaczone punkty.");
      if (
        distance(s.player, this.point) <= FOCUS_ROOM.nodeRadius &&
        s.nav.visible(s.player, this.point)
      ) {
        this.holdMs += dt;
        if (this.holdMs >= 500) {
          this.seen.add(this.nextNode);
          this.nodeDeadlines[this.nextNode] =
            this.elapsed + this.target * FOCUS_ROOM.nodeWindowMs + 2000;
          this.nextNode = (this.nextNode + 1) % this.target;
          this.holdMs = 0;
        }
      } else this.holdMs = 0;
      if (this.elapsed >= this.duration && this.seen.size === this.target) {
        this.completed = this.target;
        this.phase = "passed";
      }
      return;
    }
    const channel = s.kit.channel;
    const result = s.kit.channelResult;
    const near =
      distance(s.player, this.point) <= FOCUS_ROOM.nodeRadius &&
      s.nav.visible(s.player, this.point);
    if (this.phase === "channel") {
      if (!near) return this.fail("Opuszczono stanowisko podczas przepływu.");
      if (result && result.serial > this.serial && result.id === "C1") {
        this.serial = result.serial;
        if (!result.completed) return this.fail("Przepływ KI został przerwany.");
        this.completed++;
        this.phase = this.completed === this.target ? "passed" : "travel";
      }
      return;
    }
    if (result && result.serial > this.serial && result.id === "C1") {
      this.serial = result.serial;
      return this.fail(
        "Kanał rozpoczęto poza aktywnym oknem albo przerwano przed jego rozpoznaniem.",
      );
    }
    if (channel?.id === "C1") {
      if (this.phase !== "ready" || !near)
        return this.fail("Rozpoczęto kanał poza stanowiskiem lub przed końcem sygnału.");
      this.serial = result?.serial ?? 0;
      this.phase = "channel";
      return;
    }
    if (this.phase === "travel" && near) {
      this.phase = "cue";
      this.until = s.nowMs + FOCUS_ROOM.cueMs;
    } else if (this.phase === "cue") {
      if (!near) this.phase = "travel";
      else if (s.nowMs >= this.until) {
        this.phase = "ready";
        this.until = s.nowMs + FOCUS_ROOM.castWindowMs;
        s.emit({ type: "buff", ...this.point, ability: "trial-focus", text: "Skupienie KI — C1" });
      }
    } else if (this.phase === "ready") {
      if (!near) this.phase = "travel";
      else if (s.nowMs > this.until) this.fail("Nie rozpoczęto przepływu po sygnale.");
    }
  }
  get dangers() {
    return this.kind === "sustain-nodes" ? [{ x: 520, y: 340, radius: 85 }] : [];
  }
  snapshot() {
    return {
      kind: this.kind,
      phase: this.phase,
      completed: this.completed,
      target: this.target,
      point: this.point,
      remainingMs:
        this.kind === "sustain-nodes"
          ? Math.max(0, this.duration - this.elapsed)
          : Math.max(0, this.until - this.session.nowMs),
      spentKi: this.spent,
      budgetKi: this.budget,
      maxKi: this.maxKi,
      dangers: this.dangers,
      nodes:
        this.kind === "sustain-nodes"
          ? POINTS.slice(0, this.target).map((p, i) => ({
              ...p,
              current: i === this.nextNode,
              remainingMs: Math.max(0, this.nodeDeadlines[i]! - this.elapsed),
            }))
          : [],
      reason: this.reason,
    };
  }
  dispose() {
    if (this.kind === "focus-cycles") this.session.kit.interruptChannel("other");
    if (this.phase !== "passed") this.phase = "failed";
  }
}
