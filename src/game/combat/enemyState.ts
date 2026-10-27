import type { Enemy } from "../monsters/types";
/** Read-only view of the existing AI; never a second state machine. */
export function enemyCombatState(e: Enemy): string {
  if (e.mode === "dead") return "death";
  if (e.m.stunMs > 0 || e.fx.stunMs > 0) return "hit-reaction";
  if (e.m.cast || e.m.basicWindup) return "attack-windup";
  if (e.m.charge || e.m.volley) return "attack";
  if ((e.m.recoveryMs ?? 0) > 0 || e.m.phase === "recover" || e.m.heatMs > 0) return "recovery";
  if (e.m.phase === "return") return "return";
  if (e.m.phase === "retreat") return "retreat";
  if (e.m.phase === "engage") return "approach";
  if (e.m.phase === "hidden" || e.m.phase === "under") return e.m.phase;
  return Math.hypot(e.x - e.patrol.x, e.y - e.patrol.y) > 5 && !e.m.def.traits.still
    ? "patrol"
    : "idle";
}
