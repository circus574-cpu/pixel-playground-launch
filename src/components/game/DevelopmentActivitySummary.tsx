import type { GameViewState } from "../../game/session";
/** Reuses the existing compact objective strip; never covers action buttons or the joystick. */
export function DevelopmentActivitySummary({ state }: { state: GameViewState }) {
  const field = state.fieldwork?.active,
    expedition = state.expeditions?.active;
  if (field) {
    const a = field.activity;
    const entry = state.fieldwork!.entries.find((e) => e.id === field.id)!;
    const seconds = a && "remainingMs" in a ? Math.ceil(a.remainingMs / 1000) : 0;
    return (
      <div aria-label="Działanie dziedziny">
        <strong>
          {entry.action} · {entry.progress.step}/{entry.steps}
        </strong>
        <span>
          {a?.message ??
            "Podejdź do kolejnego oznaczonego stanowiska; materiały znajdziesz w Rozwój → Świat."}
          {seconds > 0 ? ` · ${seconds} s` : ""}
          {a && "value" in a ? ` · Zasób ${Math.round(a.value)}/${a.max}` : ""}
        </span>
      </div>
    );
  }
  if (expedition)
    return (
      <div aria-label="Stan wyprawy">
        <strong>
          Wyprawa ·{" "}
          {expedition.phase === "running"
            ? `fala ${expedition.stage}/${expedition.waves}`
            : expedition.phase === "passed"
              ? "ukończona"
              : "przerwana"}
        </strong>
        <span>
          {expedition.protected
            ? `Chroniony punkt: ${Math.ceil((100 * expedition.protected.hp) / expedition.protected.maxHp)}% HP · minimum 50%`
            : expedition.reason || "Pokonaj przeciwników i wróć do punktu wyprawy."}
        </span>
      </div>
    );
  return null;
}
