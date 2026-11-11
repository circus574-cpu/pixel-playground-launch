/**
 * Diagnostyka urządzenia: panel dla administratora / GM. Jedno kliknięcie (lub link z panelu /admin,
 * albo ?ki-diag=1) uruchamia autonomiczny marsz postaci na 45 s — bez udziału gracza — po czym
 * pobiera raport JSON zgodny z `npm run bench:gate`. Działa na telefonie i w przeglądarce.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameViewState } from "../../game/session";
import {
  DIAG_DURATION_MS,
  diagSummary,
  downloadDiagReport,
  startDiagnostics,
  type DiagDevice,
  type DiagProgress,
  type DiagReport,
  type DiagSample,
} from "../../game/diagnostics";
import type { SendCommand } from "./AdventurePanels";
import "./diagnostics.css";

function host(): Element | null {
  return document.querySelector(".ki-canvas");
}
function readMetrics(): DiagSample | null {
  const raw = host()?.getAttribute("data-metrics");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DiagSample;
  } catch {
    return null;
  }
}
function readDevice(): DiagDevice {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: nav.deviceMemory ?? null,
    touch: window.matchMedia("(pointer: coarse)").matches,
  };
}

export function DiagnosticsPanel({ state, send }: { state: GameViewState; send: SendCommand }) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DiagProgress | null>(null);
  const [report, setReport] = useState<DiagReport | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    if (cancelRef.current) return;
    setReport(null);
    setProgress(null);
    setRunning(true);
    cancelRef.current = startDiagnostics({
      send,
      getSnapshot: () => {
        const s = stateRef.current;
        return {
          x: s.x,
          y: s.y,
          dead: s.player.dead,
          god: s.god,
          staff: Boolean(s.staff),
          foes: s.foes.map((f) => ({ id: f.id })),
        };
      },
      readMetrics,
      readWorld: () => host()?.getAttribute("data-world") ?? "unknown",
      readEnterMs: () => {
        const value = Number(host()?.getAttribute("data-load-ms"));
        return Number.isFinite(value) ? value : 0;
      },
      device: readDevice,
      onProgress: setProgress,
      onComplete: (next) => {
        cancelRef.current = null;
        setRunning(false);
        setReport(next);
        downloadDiagReport(next);
      },
    });
  }, [send]);

  useEffect(() => {
    if (!state.staff) return;
    const onTrigger = () => start();
    window.addEventListener("ki:diag-start", onTrigger);
    const auto = new URLSearchParams(window.location.search).get("ki-diag") === "1";
    if (auto && state.ready) start();
    return () => window.removeEventListener("ki:diag-start", onTrigger);
  }, [state.staff, state.ready, start]);

  useEffect(() => () => cancelRef.current?.(), []);

  if (!state.staff) return null;

  if (running) {
    const remaining = progress ? Math.ceil(progress.remainingMs / 1000) : 45;
    const pct = progress ? Math.min(100, (progress.elapsedMs / DIAG_DURATION_MS) * 100) : 0;
    return (
      <section
        className="ki-diag ki-diag-live"
        aria-label="Diagnostyka urządzenia w toku"
        role="status"
      >
        <header>
          <b>Diagnostyka urządzenia</b>
          <span className="ki-diag-count">{remaining}s</span>
        </header>
        <div className="ki-diag-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
        <dl>
          <div>
            <dt>FPS</dt>
            <dd>{progress?.fps != null ? progress.fps.toFixed(1) : "…"}</dd>
          </div>
          <div>
            <dt>Tekstury</dt>
            <dd>{progress?.textureMiB != null ? `${progress.textureMiB.toFixed(0)} MiB` : "…"}</dd>
          </div>
          <div>
            <dt>Faza</dt>
            <dd>{progress?.phase ?? "start"}</dd>
          </div>
          <div>
            <dt>Próbki</dt>
            <dd>{progress?.samples ?? 0}</dd>
          </div>
        </dl>
        <p className="ki-diag-hint">
          Postać chodzi i walczy sama. Nie dotykaj sterowania — pomiar trwa.
        </p>
        <button type="button" className="ki-diag-stop" onClick={() => cancelRef.current?.()}>
          Przerwij
        </button>
      </section>
    );
  }

  if (report) {
    const s = diagSummary(report);
    return (
      <section className="ki-diag ki-diag-done" aria-label="Wynik diagnostyki urządzenia">
        <header>
          <b>Raport gotowy</b>
          <small>pobrano plik JSON</small>
        </header>
        <dl>
          <div>
            <dt>Świat</dt>
            <dd>{s.world}</dd>
          </div>
          <div>
            <dt>Renderer</dt>
            <dd>{s.renderer}</dd>
          </div>
          <div>
            <dt>FPS śr. / min</dt>
            <dd>
              {s.fpsMean.toFixed(1)} / {s.fpsMin.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>Zamrożenie max</dt>
            <dd>{Math.round(s.freezeMaxMs)} ms</dd>
          </div>
          <div>
            <dt>Tekstury max</dt>
            <dd>{s.textureMiB.toFixed(1)} MiB</dd>
          </div>
          <div>
            <dt>Próbki / błędy</dt>
            <dd>
              {s.samples} / {s.errors}
            </dd>
          </div>
        </dl>
        <p className="ki-diag-hint">
          Plik zapisany w Pobranych. Oceń go bramką:{" "}
          <code>npm run bench:gate &lt;plik.json&gt;</code>.
        </p>
        <div className="ki-diag-actions">
          <button type="button" onClick={() => downloadDiagReport(report)}>
            Pobierz ponownie
          </button>
          <button type="button" onClick={() => setReport(null)}>
            Zamknij
          </button>
        </div>
      </section>
    );
  }

  return (
    <button
      type="button"
      className="ki-diag-trigger"
      onClick={start}
      title="Autonomiczny pomiar gry przez 45 s i raport do pliku"
    >
      🩺 Diagnostyka 45 s
    </button>
  );
}
