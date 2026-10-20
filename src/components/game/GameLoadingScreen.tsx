import { loadingTextureUrl } from "../../game/assets/catalog";
import type { CSSProperties } from "react";
import { BrandMark } from "./BrandMark";
import type { GameLoadingState } from "../../game/loading";
import { RACES, type RaceId } from "../../game/world/races";
import { WORLDS } from "../../game/world/worlds";
import "./loading-screen.css";
export function GameLoadingScreen({
  state,
  race,
  onRetry,
  onBack,
}: {
  state: GameLoadingState;
  race?: RaceId;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  const origin = race ? RACES[race] : null;
  const percentage =
    state.phase === "assets" ? Math.round(Math.max(0, Math.min(1, state.progress)) * 100) : null;
  return (
    <section
      className="ki-loading-screen"
      role={state.phase === "error" ? "alert" : "status"}
      aria-label="Ładowanie Ki Legends"
      data-phase={state.phase}
      style={{ "--loading-color": origin?.color ?? "#d9c58c" } as CSSProperties}
    >
      <img className="ki-loading-backdrop" src={loadingTextureUrl()} alt="" decoding="async" />
      <div className="ki-loading-vignette" />
      <div className="ki-loading-content">
        <div className="ki-energy-orbit" aria-hidden="true" />
        <div className="ki-loading-brand">
          <BrandMark />
        </div>
        <p className="ki-loading-motto">Cztery światy. Jedna legenda.</p>
        <div className="ki-loading-location">
          {origin ? WORLDS[origin.world].name : "KRONIKI CZTERECH ŚWIATÓW"}
        </div>
        {state.phase === "error" ? (
          <div className="ki-loading-error">
            <h1>Nie udało się otworzyć świata</h1>
            <p>{state.message}</p>
            <div>
              {onRetry && (
                <button className="ki-load-retry" onClick={onRetry}>
                  Ponów próbę
                </button>
              )}
              {onBack && <button onClick={onBack}>Wróć do postaci</button>}
            </div>
          </div>
        ) : (
          <>
            <div
              className="ki-loading-progress"
              role="progressbar"
              aria-label="Ładowanie zasobów świata"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage ?? undefined}
              aria-valuetext={percentage === null ? state.message : percentage + "% plików zasobów"}
              data-indeterminate={percentage === null}
            >
              <span style={percentage === null ? undefined : { width: percentage + "%" }} />
            </div>
            <div className="ki-loading-status">
              <span>{state.message}</span>
              <strong>{percentage === null ? "" : percentage + "%"}</strong>
            </div>
            {percentage !== null && (
              <small className="ki-loading-caption">Postęp pobierania plików świata</small>
            )}
          </>
        )}
      </div>
      <footer className="ki-loading-footer">
        <span>{origin?.energy ?? "Każda wielka historia zaczyna się od pierwszego kroku."}</span>
        <small>KI LEGENDS</small>
      </footer>
    </section>
  );
}
