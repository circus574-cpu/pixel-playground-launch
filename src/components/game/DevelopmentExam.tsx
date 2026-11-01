import { examRuntime } from "../../game/development/examRuntime";
import { devArtEnabled, examTierIconUrl } from "../../game/development/developmentAssets";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamAttempt } from "../../game/development/exams";
import { TRAINING_NAMES } from "../../game/development/training";
import { initialView, type Command } from "../../game/session";
import { developmentSfxFile, sfx } from "../../game/sfx";
import { RotateNotice } from "./RotateNotice";
import { GameHud } from "./GameHud";
import type { GameLoadingState } from "../../game/loading";

export function DevelopmentExam({
  attempt,
  accept,
  leave,
  retry,
}: {
  attempt: ExamAttempt;
  accept: () => boolean;
  leave: () => void;
  retry: () => void;
}) {
  const stage = useRef<HTMLElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() => initialView(attempt.session.player));
  const [loading, setLoading] = useState<GameLoadingState | null>(null);
  const [warning, setWarning] = useState("");
  const [zoom, setZoom] = useState(0.62);
  const send = useCallback((command: Command) => {
    container.current?.dispatchEvent(new CustomEvent("ki:command", { detail: command }));
  }, []);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("../../game/mountGame")
      .then(({ mountKileGends }) => {
        if (!cancelled && container.current)
          cleanup = mountKileGends(container.current, setState, {
            saveKey: "unused-in-memory-exam",
            race: attempt.race,
            runtime: examRuntime(attempt),
            onLoading: setLoading,
          });
      })
      .catch(() => setWarning("Nie udało się uruchomić sali. Wyjdź z próby i ponów ją u trenera."));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [attempt]);
  const result = attempt.snapshot();
  const prevSuccesses = useRef(0);
  useEffect(() => {
    sfx.play(developmentSfxFile("audio.development.exam-start"));
    prevSuccesses.current = 0;
  }, [attempt]);
  useEffect(() => {
    if (result.successes > prevSuccesses.current) {
      prevSuccesses.current = result.successes;
      if (attempt.spec.discipline === "kiCapacity")
        sfx.play(developmentSfxFile("audio.development.ki-charge"));
      else if (attempt.spec.discipline === "endurance")
        sfx.play(developmentSfxFile("audio.development.checkpoint"));
    }
  }, [attempt.spec.discipline, result.successes]);
  const tierIcon = devArtEnabled() ? examTierIconUrl(attempt.spec.tier) : undefined;
  return (
    <section ref={stage} className="ki-stage ki-exam-stage" aria-label="Sala egzaminacyjna">
      <RotateNotice stage={stage.current} onCommand={send} />
      <div ref={container} className="ki-canvas" aria-label="Ki Legends — próba treningowa" />
      {state.ready && loading?.phase === "ready" && (
        <GameHud
          authoritative={attempt.authoritative}
          state={state}
          error={null}
          worldOverride={attempt.session.world}
          zoom={zoom}
          onZoom={(value) => {
            setZoom(value);
            if (container.current) {
              container.current.dataset["zoom"] = String(value);
              container.current.dispatchEvent(new Event("ki:zoom"));
            }
          }}
          fullscreen={false}
          onFullscreen={() => {
            void container.current?.parentElement?.requestFullscreen?.();
          }}
          onCommand={send}
          onCharacters={leave}
        />
      )}
      <div className="ki-exam-toolbar" aria-live="polite">
        <span>
          {tierIcon && (
            <img
              src={tierIcon}
              alt=""
              width={24}
              height={24}
              style={{ verticalAlign: "middle", marginRight: 6 }}
            />
          )}
          {TRAINING_NAMES[attempt.spec.discipline]} {attempt.spec.tier} · {result.successes}/
          {attempt.spec.target} · błędy {result.errors}/{attempt.spec.maxErrors}
        </span>
        {attempt.spec.discipline === "strength" && (
          <strong>{attempt.windowOpen ? "Atakuj" : "Czekaj na okno"}</strong>
        )}
        {attempt.spec.discipline === "kiCapacity" && (
          <button onClick={() => attempt.chargeNode()}>Naładuj węzeł</button>
        )}
        <button onClick={leave}>Wyjdź z próby</button>
      </div>
      {(warning || loading?.phase === "error") && (
        <div className="ki-exam-result" role="alert">
          <p>{warning || loading?.message}</p>
          <button onClick={leave}>Wróć do postaci</button>
        </div>
      )}
      {result.outcome !== "running" && (
        <div className="ki-exam-result ki-development" role="dialog" aria-label="Wynik egzaminu">
          <h2>{result.outcome === "passed" ? "Próba ukończona" : "Próba zakończona"}</h2>
          <p>{result.reason}</p>
          <p>
            Wynik: {result.successes}/{attempt.spec.target} · błędy: {result.errors} · aktywny czas:{" "}
            {(result.activeMs / 1000).toFixed(1)} s
          </p>
          {result.outcome === "passed" && (
            <button
              onClick={() => {
                if (!accept())
                  setWarning(
                    "Nie zapisano wyniku. Nagroda nie została przyznana. Spróbuj ponownie lub wróć bez nagrody.",
                  );
              }}
            >
              Zatwierdź wynik i wróć
            </button>
          )}
          {result.outcome === "failed" && <button onClick={retry}>Powtórz próbę</button>}
          <button onClick={leave}>Wróć bez nagrody</button>
        </div>
      )}
    </section>
  );
}
