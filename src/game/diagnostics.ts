/**
 * Diagnostyka urządzenia (Faza 4): autonomiczny pomiar gry na telefonie / przeglądarce właściciela.
 * Postać chodzi i wykonuje polecenia bez udziału gracza przez zadany czas (domyślnie 45 s), zbiera
 * telemetrię renderera, a na końcu tworzy raport zgodny z bramką wydajności (`npm run bench:gate`).
 * Rdzeń jest czysty i testowalny; dostęp do DOM (telemetria, pobieranie pliku) jest wstrzykiwany,
 * żeby można było go sprawdzić bez przeglądarki. Pomiar FPS na programowym Canvas jest pesymistyczny
 * — raport niesie też pamięć i zamrożenie, które są od renderera niezależne.
 */
import type { Command } from "./session";

export const DIAG_DURATION_MS = 45_000;

export type DiagSample = {
  sampleAtMs?: number;
  fps?: number;
  frameP50Ms?: number | null;
  frameP95Ms?: number | null;
  frameMaxMs?: number | null;
  slowFrames?: number;
  objects?: number;
  visibleObjects?: number;
  estimatedTextureBytes?: number;
  jsHeapBytes?: number | null;
  renderer?: string;
};

export type DiagSnapshot = {
  x: number;
  y: number;
  dead: boolean;
  god: boolean;
  staff: boolean;
  foes: { id: string }[];
};

export type DiagDevice = {
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  hardwareConcurrency: number | null;
  deviceMemoryGB: number | null;
  touch: boolean;
};

export type DiagRun = {
  world: string;
  viewport: { width: number; height: number };
  renderer: string;
  enterWorldMs: number;
  samples: DiagSample[];
  errors: string[];
};

export type DiagReport = {
  checkedAt: string;
  mode: "device-diagnostic";
  durationMs: number;
  device: DiagDevice;
  environment: string;
  results: DiagRun[];
};

export type DiagProgress = {
  elapsedMs: number;
  remainingMs: number;
  fps: number | null;
  textureMiB: number | null;
  samples: number;
  phase: "marsz" | "walka";
};

/** Pętla waypointów wokół punktu startowego: postać chodzi po okręgu, więc chunki się zmieniają. */
export function diagWaypoints(
  cx: number,
  cy: number,
  radius = 180,
  count = 8,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
    });
  }
  return points;
}

export function buildDiagReport(opts: {
  device: DiagDevice;
  world: string;
  enterWorldMs: number;
  durationMs: number;
  samples: DiagSample[];
  errors: string[];
  now?: Date;
}): DiagReport {
  const renderer = opts.samples.find((s) => typeof s.renderer === "string")?.renderer ?? "Canvas";
  return {
    checkedAt: (opts.now ?? new Date()).toISOString(),
    mode: "device-diagnostic",
    durationMs: opts.durationMs,
    device: opts.device,
    environment:
      "Pomiar na urządzeniu właściciela (fizyczny telefon / przeglądarka); autonomiczny marsz 45 s; " +
      "FPS zależny od GPU, pamięć i zamrożenie niezależne od renderera",
    results: [
      {
        world: opts.world,
        viewport: opts.device.viewport,
        renderer,
        enterWorldMs: opts.enterWorldMs,
        samples: opts.samples,
        errors: opts.errors,
      },
    ],
  };
}

/** Zwięzłe podsumowanie raportu do wyświetlenia w panelu (czyste, testowalne). */
export function diagSummary(report: DiagReport) {
  const run = report.results[0];
  const samples = run?.samples ?? [];
  const fpsValues = samples.map((s) => s.fps).filter((v): v is number => typeof v === "number");
  const freeze = samples.map((s) => s.frameMaxMs ?? s.frameP95Ms ?? 0);
  const texture = samples.map((s) => s.estimatedTextureBytes ?? 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    world: run?.world ?? "?",
    renderer: run?.renderer ?? "?",
    fpsMean: avg(fpsValues),
    fpsMin: fpsValues.length ? Math.min(...fpsValues) : 0,
    freezeMaxMs: freeze.length ? Math.max(...freeze) : 0,
    textureMiB: (texture.length ? Math.max(...texture) : 0) / 1048576,
    samples: samples.length,
    errors: run?.errors.length ?? 0,
  };
}

/** Zapis raportu do pliku JSON (pobieranie w przeglądarce). */
export function downloadDiagReport(report: DiagReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = report.checkedAt.replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `ki-diagnostyka-${report.results[0]?.world ?? "swiat"}-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type DiagOptions = {
  send: (command: Command) => void;
  getSnapshot: () => DiagSnapshot;
  readMetrics: () => DiagSample | null;
  readWorld: () => string;
  readEnterMs: () => number;
  device: () => DiagDevice;
  durationMs?: number;
  onProgress: (progress: DiagProgress) => void;
  onComplete: (report: DiagReport) => void;
};

/**
 * Uruchamia autonomiczny przebieg. Zwraca funkcję przerwania. Nie wymaga żadnego wejścia gracza:
 * sam wydaje polecenia ruchu / walki / leczenia, próbkuje telemetrię i po czasie woła onComplete.
 */
export function startDiagnostics(opts: DiagOptions): () => void {
  const durationMs = opts.durationMs ?? DIAG_DURATION_MS;
  const start = performance.now();
  const samples: DiagSample[] = [];
  const errors: string[] = [];
  const origin = opts.getSnapshot();
  const waypoints = diagWaypoints(origin.x, origin.y);
  let waypointIndex = 0,
    lastSampleAt = -1,
    lastMove = 0,
    lastAttack = 0,
    lastDodge = 0,
    lastHeal = 0,
    lastFps: number | null = null,
    lastTexture: number | null = null,
    godToggled = false,
    finished = false;

  const onError = (event: ErrorEvent) => errors.push(event.message);
  window.addEventListener("error", onError);
  // Nieśmiertelność na czas pomiaru, żeby postać nie padła i nie przerwała marszu (tylko staff).
  if (origin.staff && !origin.god) {
    opts.send({ type: "staff", action: "god" });
    godToggled = true;
  }

  const cleanup = () => {
    window.clearInterval(timer);
    window.removeEventListener("error", onError);
    if (godToggled) opts.send({ type: "staff", action: "god" });
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    opts.onComplete(
      buildDiagReport({
        device: opts.device(),
        world: opts.readWorld(),
        enterWorldMs: opts.readEnterMs(),
        durationMs,
        samples,
        errors,
      }),
    );
  };

  const timer = window.setInterval(() => {
    if (finished) return;
    const now = performance.now();
    const elapsed = now - start;
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    const snap = opts.getSnapshot();
    if (!snap.dead && now - lastMove > 2500) {
      const point = waypoints[waypointIndex % waypoints.length]!;
      waypointIndex++;
      opts.send({ type: "move", x: point.x, y: point.y });
      lastMove = now;
    }
    if (snap.foes.length > 0 && now - lastAttack > 1200) {
      opts.send({ type: "target", id: snap.foes[0]!.id });
      opts.send({ type: "ability", ability: "R" });
      lastAttack = now;
    }
    if (now - lastDodge > 5000) {
      opts.send({ type: "dodge" });
      lastDodge = now;
    }
    if (snap.staff && now - lastHeal > 8000) {
      opts.send({ type: "staff", action: "heal" });
      lastHeal = now;
    }
    const metrics = opts.readMetrics();
    if (metrics && typeof metrics.sampleAtMs === "number" && metrics.sampleAtMs !== lastSampleAt) {
      samples.push(metrics);
      lastSampleAt = metrics.sampleAtMs;
      lastFps = typeof metrics.fps === "number" ? metrics.fps : null;
      lastTexture =
        typeof metrics.estimatedTextureBytes === "number"
          ? metrics.estimatedTextureBytes / 1048576
          : null;
    }
    opts.onProgress({
      elapsedMs: elapsed,
      remainingMs: Math.max(0, durationMs - elapsed),
      fps: lastFps,
      textureMiB: lastTexture,
      samples: samples.length,
      phase: snap.foes.length > 0 ? "walka" : "marsz",
    });
  }, 500);

  return () => {
    if (finished) return;
    finished = true;
    cleanup();
  };
}
