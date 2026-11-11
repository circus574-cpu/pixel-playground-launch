import { AndroidKit } from "../../kit/android";
import { LegendKit } from "../../kit/legend";
import type { GameSession } from "../../session";
import type { PracticeTarget } from "../targets";
import { KIT_NODES } from "../../kit";
import type { TrialTier } from "./catalog";

export type ResourceTrialKind =
  "core-sequence" | "core-band" | "core-windows" | "ember-band" | "ember-windows" | "ki-budget";
export const RESOURCE_ROOM = {
  cueMs: 1500,
  windowMs: 3000,
  preparationMs: 240000,
  activityMs: 8000,
} as const;
/** A legal profile with canonical prerequisites, never copied into the owner's save. */
export function grantLoanSkills(s: GameSession, ids: string[]) {
  const add = (id: string) => {
    if (s.player.skills.includes(id)) return;
    const node = KIT_NODES[s.player.race].find((n) => n.id === id);
    if (
      !node ||
      node.minLevel > s.player.level ||
      (node.excludes && s.player.skills.includes(node.excludes))
    )
      throw Error("Nieprawidłowy profil sali: " + id);
    if (node.requires.length && !node.requires.some((r) => s.player.skills.includes(r)))
      add(node.requires[0]!);
    s.player.skills.push(id);
    s.kit.learn(id);
  };
  ids.forEach(add);
}
export function resourceProfile(s: GameSession, kind: ResourceTrialKind, tier: TrialTier) {
  if (kind.startsWith("core"))
    grantLoanSkills(s, ["C1", ...(tier === 1 ? [] : [tier === 2 ? "C7" : "C8"])]);
  else if (kind === "ember-windows") grantLoanSkills(s, ["C4"]);
  else if (kind === "ki-budget") grantLoanSkills(s, ["A1", "B1", "C1"]);
}
type Receipt = { id: string; at: number; hit: boolean; valid: boolean };
/** Observes real skill use and damage contacts, never supplies charge, KI or cooldown resets. */
export class ResourceControlTrial {
  readonly targetBody: PracticeTarget;
  readonly target: number;
  readonly duration: number;
  readonly maxKi: number;
  readonly budget: number;
  private elapsed = 0;
  private previousNow: number;
  private held = 0;
  private startedBand = false;
  private spent = 0;
  private shots = 0;
  private discharged = 0;
  private completed = 0;
  private lastProductive = 0;
  private phase: "build" | "cue" | "window" | "hold" | "passed" | "failed" = "build";
  private until = 0;
  private reason = "";
  private receipts: Receipt[] = [];
  private current: Receipt | undefined;
  private originalUse;
  constructor(
    private readonly session: GameSession,
    readonly kind: ResourceTrialKind,
    readonly tier: TrialTier,
    private readonly owner: string,
  ) {
    this.target =
      kind === "core-sequence"
        ? [6, 9, 12][tier - 1]!
        : kind === "core-windows"
          ? tier + 1
          : kind === "ember-windows"
            ? tier
            : tier + 2;
    this.duration = [15000, 20000, 25000][tier - 1]!;
    this.maxKi = session.kit.stats.maxKi;
    this.budget = this.maxKi * [0.7, 0.65, 0.6][tier - 1]!;
    this.previousNow = session.nowMs;
    this.targetBody = session.practiceTargets.add(
      owner,
      "Manekin kontroli zasobu — realne trafienia",
      { x: 600, y: 300 },
      null,
      session.nowMs,
      (contact) => {
        if (
          this.phase === "passed" ||
          this.phase === "failed" ||
          session.paused ||
          contact.hit.indirect
        )
          return;
        if (contact.hit.ability === "R") {
          this.shots++;
          this.lastProductive = this.elapsed;
        }
        const receipt =
          this.current?.id === contact.hit.ability
            ? this.current
            : this.receipts.find(
                (r) => r.id === contact.hit.ability && !r.hit && session.nowMs - r.at <= 2000,
              );
        if (receipt) receipt.hit = true;
      },
    );
    this.originalUse = session.kit.use;
    session.kit.use = (id) => {
      const beforeKi = session.player.ki,
        beforeResource = this.value;
      const receipt: Receipt = { id, at: session.nowMs, hit: false, valid: false };
      this.current = receipt;
      const result = this.originalUse.call(session.kit, id);
      this.current = undefined;
      if (session.paused || this.phase === "passed" || this.phase === "failed") return result;
      if (id === "T") this.fail("Tryb T jest niedozwolony w profilu kontroli zasobu.");
      if (!result.ok) return result;
      if (session.kit.resource()?.state === "overheat")
        this.fail("Przegrzanie rdzenia przerwało próbę.");
      if (this.startedBand) {
        const low = this.kind === "core-band" ? 0.25 : 0.3,
          high = this.kind === "core-band" ? 0.65 : 0.7;
        if (this.value / this.max < low - 1e-7 || this.value / this.max > high + 1e-7)
          this.fail("Zasób opuścił wymagany przedział.");
      }
      if (this.kind === "ki-budget" && ["A1", "B1", "C1"].includes(id)) {
        this.spent += Math.max(0, beforeKi - session.player.ki);
        receipt.valid = true;
        this.receipts.push(receipt);
        if (this.spent > this.budget + 1e-7)
          this.fail("Przekroczono łączny budżet KI; regeneracja go nie odnawia.");
      }
      const discharge = this.kind.startsWith("core") ? "C1" : "C4";
      if (id === discharge && (this.kind === "core-sequence" || this.kind.endsWith("windows"))) {
        if (beforeResource <= 0)
          this.fail("Zużycie wymaga zasobu uzyskanego legalnymi trafieniami.");
        else if (this.kind.endsWith("windows") && this.phase !== "window")
          this.fail("Zużyto zasób poza oznaczonym oknem.");
        else {
          receipt.valid = true;
          this.receipts.push(receipt);
        }
      }
      if (this.receipts.length > 16) this.fail("Zbyt wiele nierozstrzygniętych działań.");
      return result;
    };
  }
  get value() {
    const k = this.session.kit;
    return k instanceof AndroidKit ? k.charge : k instanceof LegendKit ? k.ember : 0;
  }
  get max() {
    return this.session.kit.resource()?.max ?? 100;
  }
  get point() {
    return { x: 540, y: 300 };
  }
  private fail(reason: string) {
    this.phase = "failed";
    this.reason = reason;
  }
  update() {
    const s = this.session,
      dt = s.nowMs - this.previousNow;
    this.previousNow = s.nowMs;
    if (dt <= 0 || s.paused || this.phase === "passed" || this.phase === "failed") return;
    this.elapsed += dt;
    if (this.elapsed > RESOURCE_ROOM.preparationMs)
      return this.fail("Przekroczono jawny limit sali 240 s.");
    if (s.kit.resource()?.state === "overheat")
      return this.fail("Przegrzanie rdzenia przerwało próbę.");
    for (const receipt of this.receipts)
      if (receipt.valid && receipt.hit) {
        this.completed++;
        this.lastProductive = this.elapsed;
        if (this.kind !== "ki-budget") {
          this.discharged++;
          this.phase = "build";
        }
        receipt.valid = false;
      }
    this.receipts = this.receipts.filter((r) => r.valid && s.nowMs - r.at <= 2000);
    if (this.kind === "core-sequence") {
      if (this.shots >= this.target && this.discharged >= this.tier) this.phase = "passed";
    } else if (this.kind === "ki-budget") {
      if (this.completed >= this.target) this.phase = "passed";
    } else if (this.kind.endsWith("windows")) {
      if (this.discharged >= this.target) {
        this.phase = "passed";
        return;
      }
      const ability = this.kind === "core-windows" ? "C1" : "C4";
      if (this.phase === "build" && this.value >= this.max * 0.3 && !s.kit.remaining(ability)) {
        this.phase = "cue";
        this.until = s.nowMs + RESOURCE_ROOM.cueMs;
      } else if (this.phase === "cue" && s.nowMs >= this.until) {
        this.phase = "window";
        this.until = s.nowMs + RESOURCE_ROOM.windowMs;
        s.emit({
          type: "buff",
          ...this.point,
          ability: "trial-window",
          text: "TERAZ — " + ability,
        });
      } else if (this.phase === "window" && s.nowMs > this.until)
        this.fail("Nie wykorzystano wskazanego okna.");
    } else {
      const fraction = this.value / this.max,
        low = this.kind === "core-band" ? 0.25 : 0.3,
        high = this.kind === "core-band" ? 0.65 : 0.7;
      if (!this.startedBand && fraction >= low && fraction <= high) {
        this.startedBand = true;
        this.phase = "hold";
        this.lastProductive = this.elapsed;
      }
      if (this.startedBand) {
        if (fraction < low - 1e-7 || fraction > high + 1e-7)
          return this.fail("Zasób opuścił wymagany przedział.");
        if (this.elapsed - this.lastProductive > RESOURCE_ROOM.activityMs)
          return this.fail("Brak aktywnego gospodarowania zasobem.");
        this.held += dt;
        if (this.held >= this.duration) {
          this.completed = this.target;
          this.phase = "passed";
        }
      }
    }
  }
  snapshot() {
    return {
      kind: this.kind,
      phase: this.phase,
      reason: this.reason,
      completed: this.completed,
      target: this.target,
      point: this.point,
      targetId: this.targetBody.id,
      shots: this.shots,
      shotTarget: this.kind === "core-sequence" ? this.target : 0,
      discharges: this.discharged,
      dischargeTarget:
        this.kind === "core-sequence" ? this.tier : this.kind.endsWith("windows") ? this.target : 0,
      value: this.value,
      max: this.max,
      heldMs: this.held,
      durationMs: this.duration,
      spentKi: this.spent,
      budgetKi: this.budget,
      remainingMs:
        this.phase === "cue" || this.phase === "window"
          ? Math.max(0, this.until - this.session.nowMs)
          : Math.max(0, this.duration - this.held),
    };
  }
  dispose() {
    this.session.kit.use = this.originalUse;
    this.receipts = [];
    this.session.practiceTargets.removeOwner(this.owner);
  }
}
