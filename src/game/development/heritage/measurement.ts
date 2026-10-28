import type { GameSession } from "../../session";
import type { PracticeContact, PracticeTarget } from "../targets";
import type { HeritageGoal } from "./types";
import type { HeritageTarget } from "./bindings";

export type InstrumentReading = {
  target: string;
  at: number;
  damage: number;
  attack: number;
  maxKi: number;
  ki: number;
  resource: { label: string; value: number; max: number } | null;
};
/** Measures actual kit contacts. Numbers are observations from this visit, not a fictional temperature. */
export class MeasurementActivity {
  readonly id = "measurement:" + crypto.randomUUID();
  private readonly targets: PracticeTarget[] = [];
  private readonly readings: InstrumentReading[] = [];
  private readonly accepted = new Set<string>();
  constructor(
    private readonly session: GameSession,
    readonly goal: Extract<HeritageGoal, { kind: "measure" }>,
    readonly owner: string,
    bindings: readonly HeritageTarget[],
    completed: () => readonly string[],
    confirm: (target: HeritageTarget, contact: PracticeContact) => boolean,
  ) {
    for (const id of completed()) this.accepted.add(id);
    for (const binding of bindings) {
      if (completed().includes(binding.id)) continue;
      const target = session.practiceTargets.add(
        this.id,
        binding.label,
        binding.point,
        session.player.interior,
        session.nowMs,
        (contact) => {
          if (contact.hit.indirect || completed().includes(binding.id)) return;
          if (!confirm(binding, contact)) return;
          this.accepted.add(binding.id);
          const stats = session.kit.stats,
            resource = session.kit.resource();
          this.readings.push({
            target: binding.label,
            at: session.nowMs,
            damage: contact.raw,
            attack: stats.attack,
            maxKi: stats.maxKi,
            ki: session.player.ki,
            resource: resource
              ? { label: resource.label, value: resource.value, max: resource.max }
              : null,
          });
          target.hp = 0;
        },
      );
      this.targets.push(target);
    }
    session.targetId = this.targets[0]?.id ?? null;
  }
  snapshot() {
    return {
      id: this.id,
      goalId: this.goal.id,
      phase: "measure" as const,
      title: "Pomiary zestawu",
      windows: this.accepted.size,
      target: this.goal.hits,
      errors: 0,
      remainingMs: 0,
      message: "POMIAR — traf każdy odrębny cel przy stanowisku",
      readings: this.readings.map((r) => ({
        ...r,
        resource: r.resource ? { ...r.resource } : null,
      })),
    };
  }
  dispose() {
    this.session.practiceTargets.removeOwner(this.id);
  }
}
