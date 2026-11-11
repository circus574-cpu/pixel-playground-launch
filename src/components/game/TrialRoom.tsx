import { MirrorPuzzle } from "./MirrorPuzzle";
import { GameLoadingScreen } from "./GameLoadingScreen";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TrialAttempt } from "../../game/development/trials/attempt";
import { trialRuntime } from "../../game/development/trials/runtime";
import type { ModuleId } from "../../game/development/state";
import { MODULE_ENERGY } from "../../game/development/state";
import { initialView, type Command } from "../../game/session";
import type { GameLoadingState } from "../../game/loading";
import { RotateNotice } from "./RotateNotice";
import { GameHud } from "./GameHud";

export function TrialRoom({
  attempt,
  accept,
  leave,
  retry,
  externalError,
}: {
  externalError?: string | undefined;
  attempt: TrialAttempt;
  accept: () => boolean;
  leave: () => void;
  retry: () => void;
}) {
  const stage = useRef<HTMLElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => initialView(attempt.session.player));
  const [loading, setLoading] = useState<GameLoadingState | null>(null);
  const [warning, setWarning] = useState("");
  const [mountVersion, setMountVersion] = useState(0);
  const [zoom, setZoom] = useState(0.62);
  const [modules, setModules] = useState<ModuleId[]>([]);
  const [pack, setPack] = useState<string[]>([]);
  const [allocation, setAllocation] = useState<[number, number]>([0, 0]);
  const pauseReasons = useRef(new Set<string>());
  const pause = useCallback(
    (reason: string, value: boolean) => {
      if (value) pauseReasons.current.add(reason);
      else pauseReasons.current.delete(reason);
      attempt.suspend(pauseReasons.current.size > 0);
    },
    [attempt],
  );
  const send = useCallback(
    (command: Command) => {
      if (command.type === "pause") {
        pause("hud", command.value);
        return;
      }
      container.current?.dispatchEvent(new CustomEvent("ki:command", { detail: command }));
    },
    [pause],
  );
  const rotateSend = useCallback(
    (command: Command) => {
      if (command.type === "pause") pause("rotate", command.value);
      else send(command);
    },
    [pause, send],
  );
  useEffect(() => {
    const blur = () => pause("focus", true),
      focus = () => pause("focus", false),
      visibility = () => pause("hidden", document.hidden);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pause]);
  useEffect(() => {
    pauseReasons.current.add("loading");
    attempt.suspend(true);
    setWarning("");
    setLoading({ phase: "preparing", message: "Przygotowywanie sali próby...", progress: null });
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import("../../game/mountGame")
      .then(({ mountKileGends }) => {
        if (!disposed && container.current)
          cleanup = mountKileGends(container.current, setView, {
            saveKey: "unused-in-memory-racial-trial",
            race: attempt.race,
            runtime: trialRuntime(attempt),
            onLoading: setLoading,
          });
      })
      .catch(() => setWarning("Nie udało się uruchomić sali. Wróć do postaci i ponów próbę."));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [attempt, mountVersion]);
  useEffect(() => {
    if (loading?.phase === "ready") {
      pauseReasons.current.delete("loading");
      attempt.begin(pauseReasons.current.size > 0);
      attempt.suspend(pauseReasons.current.size > 0);
    }
  }, [attempt, loading?.phase]);
  const result = attempt.snapshot();
  useEffect(() => {
    setModules([]);
    setPack([]);
    setAllocation([0, 0]);
  }, [attempt.instanceId, result.round]);
  const puzzle = result.puzzle;
  return (
    <section
      ref={stage}
      className="ki-stage ki-exam-stage ki-trial-stage"
      aria-label="Sala prób rasowych"
      data-calibration-target={result.calibration?.targetId ?? ""}
      data-trial-id={attempt.trialId}
      data-trial-tier={attempt.tier}
      data-trial-phase={result.phase}
      data-focus-phase={result.focus?.phase}
      data-focus-remaining={result.focus?.remainingMs}
      data-focus-spent={result.focus?.spentKi}
      data-focus-budget={result.focus?.budgetKi}
      data-trial-round={result.round}
      data-trial-successes={result.successes}
      data-barrier-phase={result.waves?.phase ?? result.cover?.phase}
      data-object-hp={result.waves?.object.hp}
      data-barrier-remaining={result.waves?.remainingMs ?? result.cover?.remainingMs}
      data-camp-remaining={result.camp?.remainingMs}
      data-camp-guarded={result.camp?.guarded}
      data-companion-x={result.escort?.x}
      data-companion-y={result.escort?.y}
      data-companion-hp={result.escort?.hp}
      data-trial-x={result.point?.x}
      data-trial-y={result.point?.y}
    >
      <RotateNotice stage={stage.current} onCommand={rotateSend} />
      <div ref={container} className="ki-canvas" aria-label="Ki Legends — próba rasowa" />
      {view.ready && loading?.phase === "ready" && (
        <GameHud
          authoritative={attempt.authoritative}
          state={view}
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
            void stage.current?.requestFullscreen?.();
          }}
          onCommand={send}
          onCharacters={leave}
        />
      )}
      {(externalError || warning || loading?.phase !== "ready") && (
        <GameLoadingScreen
          race={attempt.race}
          state={
            externalError || warning
              ? { phase: "error", message: externalError || warning, progress: null }
              : (loading ?? {
                  phase: "preparing",
                  message: "Przygotowywanie sali próby...",
                  progress: null,
                })
          }
          onBack={leave}
          {...(!externalError ? { onRetry: () => setMountVersion((n) => n + 1) } : {})}
        />
      )}
      {loading?.phase === "ready" && (
        <div className="ki-exam-toolbar" aria-live="polite">
          <span>
            Profil testowy · {attempt.definition.name} · stopień {attempt.tier} · {result.successes}
            /{attempt.targetCount} · błędy {result.errors}
            {attempt.definition.kind === "earth-rhythm"
              ? " otrzymanych trafień"
              : `/${attempt.definition.maxErrors}`}
            <br />
            {result.message}
          </span>
          {result.phase === "read" && result.outcome === "running" && (
            <button onClick={() => attempt.inspect()}>Zbadaj stanowisko</button>
          )}
          <button onClick={leave}>Wyjdź z próby</button>
        </div>
      )}
      {puzzle && result.outcome === "running" && (
        <div className="ki-exam-result ki-development" role="dialog" aria-label="Materiały próby">
          <h2>{puzzle.prompt}</h2>
          <small>Materiał ćwiczebny. Nie jest nowym świadectwem kampanii.</small>
          {puzzle.documents.map((doc) => (
            <article key={doc.title}>
              <h3>{doc.title}</h3>
              <p className="ki-trial-document">{doc.text}</p>
            </article>
          ))}
          {puzzle.mirrors ? (
            <MirrorPuzzle
              board={puzzle.mirrors}
              submit={(answer) => attempt.answer(result.round, answer)}
            />
          ) : puzzle.pack ? (
            <fieldset>
              <legend>Wybierz składniki zestawu</legend>
              {puzzle.options.map((option) => (
                <label className="ki-trial-module" key={option.id}>
                  <input
                    type="checkbox"
                    checked={pack.includes(option.id)}
                    onChange={(e) =>
                      setPack((old) =>
                        e.target.checked
                          ? [...old, option.id]
                          : old.filter((id) => id !== option.id),
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
              <p>
                Składniki: {pack.length}/{puzzle.pack.count}
              </p>
              <button onClick={() => attempt.answer(result.round, [...pack].sort().join(","))}>
                Przygotuj zestaw
              </button>
            </fieldset>
          ) : puzzle.allocation ? (
            <fieldset>
              <legend>Podział przepływu</legend>
              {["Osada nad Brzegiem", "Osada pod Lasem"].map((name, i) => (
                <label key={name}>
                  {name}
                  <input
                    aria-label={name}
                    type="number"
                    min={0}
                    max={puzzle.allocation!.total}
                    step={1}
                    value={allocation[i]}
                    onChange={(e) =>
                      setAllocation((old) =>
                        i === 0
                          ? [Number(e.target.value), old[1]]
                          : [old[0], Number(e.target.value)],
                      )
                    }
                  />
                </label>
              ))}
              <p>
                Rozdzielono: {allocation[0] + allocation[1]}/{puzzle.allocation.total}
              </p>
              <button onClick={() => attempt.answer(result.round, allocation.join(","))}>
                Zatwierdź przepływ
              </button>
            </fieldset>
          ) : puzzle.modules ? (
            <fieldset>
              <legend>Wybierz moduły wypożyczonego profilu</legend>
              {puzzle.options.map((option) => (
                <label className="ki-trial-module" key={option.id}>
                  <input
                    type="checkbox"
                    checked={modules.includes(option.id as ModuleId)}
                    onChange={(e) =>
                      setModules((old) =>
                        e.target.checked
                          ? [...old, option.id as ModuleId]
                          : old.filter((id) => id !== option.id),
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
              <p>
                Gniazda: {modules.length}/{puzzle.modules.count} · Energia:{" "}
                {modules.reduce((n, id) => n + MODULE_ENERGY[id], 0)}/{puzzle.modules.budget}
              </p>
              <button onClick={() => attempt.answer(result.round, "", modules)}>
                Sprawdź konstrukcję
              </button>
            </fieldset>
          ) : (
            <div className="ki-development-tabs">
              {puzzle.options.map((option) => (
                <button key={option.id} onClick={() => attempt.answer(result.round, option.id)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => attempt.closeReading()}>Odłóż zapiski</button>
        </div>
      )}
      {result.outcome !== "running" && (
        <div
          className="ki-exam-result ki-development"
          role="dialog"
          aria-label="Wynik próby rasowej"
        >
          <h2>{result.outcome === "passed" ? "Próba ukończona" : "Próba zakończona"}</h2>
          <p>{result.reason}</p>
          <p>
            Wynik: {result.successes}/{attempt.targetCount} · błędy {result.errors} · aktywny czas{" "}
            {(result.activeMs / 1000).toFixed(1)} s
          </p>
          {result.outcome === "passed" && (
            <button
              onClick={() => {
                if (!accept())
                  setWarning(
                    "Nie zapisano wyniku. Nic nie przyznano. Ponów zatwierdzenie albo wróć bez nagrody.",
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
