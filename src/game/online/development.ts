import type { GameSession, GameViewState } from "../session";
/** Trusted server presentation only. It cannot award progress or run client-side controllers. */
export function mirrorDevelopmentTargets(session: GameSession, view: GameViewState) {
  session.practiceTargets.mirror(view.practiceTargets ?? []);
  session.fieldwork.refresh();
}
