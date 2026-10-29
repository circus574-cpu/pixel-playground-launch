import type { GameSession } from "../../session";
import { distance } from "../../navigation";
import type { ProjectView } from "./projects";
import { PROJECT_BY_ID } from "./catalog";
import type { WorldProjectId } from "./types";

type Reading = {
  id: WorldProjectId;
  at: number;
  status: string;
  step: number;
  sequence: number;
};
/** Read-only, local inspection. No exploration unlocks, rewards or saved scanner state. */
export class InstallationScanner {
  private reading: Reading | null = null;
  constructor(
    private readonly session: GameSession,
    private readonly installations: () => readonly ProjectView[],
  ) {}
  private enabled() {
    const p = this.session.player;
    return (
      p.race === "android" && !p.dead && !!p.development?.equippedModuleIds.includes("mn-scanner")
    );
  }
  private visible(view: ProjectView, reach: number) {
    const s = this.session;
    return (
      view.target.feature === s.world.id &&
      view.target.interior === s.player.interior &&
      distance(s.player, view.target.point) <= reach &&
      s.nav.visible(s.player, view.target.point)
    );
  }
  inspect(id: string) {
    const s = this.session;
    const installation = this.installations().find((v) => v.id === id);
    if (!this.enabled() || !installation || !this.visible(installation, 130)) {
      this.reading = null;
      s.say("Załóż skaner i podejdź do znanej instalacji (130 j., bez przeszkody).");
      return;
    }
    const p = s.player.development!.heritage.projects[installation.id];
    if (!p) return;
    this.reading = {
      id: installation.id,
      at: s.nowMs,
      status: p.status,
      step: p.step,
      sequence: p.goal.sequence,
    };
    s.say("Odczytano lokalny stan instalacji. Bez leczenia, kosztu KI i nagrody.");
  }
  snapshot() {
    if (!this.enabled()) {
      this.reading = null;
      return null;
    }
    const p = this.session.player;
    const installations = this.installations().filter((v) => this.visible(v, 650));
    const current = this.reading;
    const viewed =
      current && installations.find((v) => v.id === current.id && this.visible(v, 130));
    const progress = current && p.development!.heritage.projects[current.id];
    if (
      !viewed ||
      !progress ||
      progress.status !== current?.status ||
      progress.step !== current?.step ||
      progress.goal.sequence !== current?.sequence
    )
      this.reading = null;
    return {
      installations: installations.map((v) => ({
        id: v.id,
        name: v.name,
        near: this.visible(v, 130),
      })),
      reading:
        this.reading && progress
          ? {
              id: this.reading.id,
              name: viewed!.name,
              at: this.reading.at,
              state:
                progress.status === "done"
                  ? "Sprawna — projekt odebrany"
                  : progress.status === "ready"
                    ? "Prace zakończone — oczekuje odbioru"
                    : "Odbudowa w toku",
              completedSteps: progress.step,
              totalSteps: PROJECT_BY_ID.get(this.reading.id)!.goals.length,
              description:
                progress.status === "done"
                  ? viewed!.effect.description
                  : "Widoczny stan zapisanych prac; instalacja nie jest jeszcze odebrana.",
            }
          : null,
    };
  }
}
