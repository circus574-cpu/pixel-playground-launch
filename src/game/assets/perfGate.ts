/**
 * Faza 4: bramka wydajności CI. Pilnuje wielkości NIEZALEŻNYCH od renderera, bo FPS z programowego
 * Canvas (SwiftShader) jest pesymistyczny i degraduje się w długim biegu — nie jest miarą telefonu.
 * Pamięć tekstur, zamrożenie (frameMax) i czas wejścia niosą realny wniosek i to one są progami.
 * Czysta funkcja: czyta raport zapisany przez scripts/measure-game.ts, nie uruchamia przeglądarki,
 * więc nadaje się do testów jednostkowych i do bramki CI na gotowym pliku JSON.
 */
import { STREAM_TEXTURE_BUDGET_BYTES } from "./streamBudget";

export type PerfSample = {
  frameP95Ms?: number | null;
  frameMaxMs?: number | null;
  estimatedTextureBytes?: number;
};
export type PerfRun = {
  world: string;
  viewport: { width: number; height: number };
  renderer?: string;
  enterWorldMs: number;
  samples: PerfSample[];
  errors?: string[];
};
export type PerfReport = { results: PerfRun[] };

export type PerfThresholds = {
  textureBytes: number;
  freezeMs: number;
  frameP95Ms: number;
  enterWorldMs: number;
};

/**
 * Progi domyślne dla pomiaru programowym Canvas (harness), skalibrowane 11.11.2026 na realnym
 * raporcie (mobile 844×390, 4 światy): tekstury 176–207 MiB, zamrożenie 780–2192 ms, wejście 10–15 s.
 *
 * Pamięć: próg to sufit CAŁKOWITEJ pamięci tekstur (estimatedTextureBytes = atlas + podłoże + bohater
 * + HUD + efekty), a nie budżet streamingu. Budżet 192 MiB dotyczy tylko streamowanego podzbioru
 * i jest osobno weryfikowany testami (stream-texture-budget, ground-budget). Tekstury niestreamowane
 * (~15 MiB) + zapas na regresję mieszczą się w dodatku 28 MiB ponad budżet.
 *
 * Zamrożenie / p95 / wejście: zapas ponad zmierzone zdrowe maksimum, żeby łapać regresję (stare
 * zamrożenia 4908–11916 ms), nie zdrowy stan. p95 na programowym Canvas ≈ frameMax (mało próbek),
 * więc jest miękki — właściciel zaostrza go zmiennymi KI_PERF_* przy pomiarze na fizycznym telefonie.
 */
const NON_STREAMED_TEXTURE_ALLOWANCE = 28 * 1024 * 1024;
export const PERF_THRESHOLDS: PerfThresholds = {
  textureBytes: STREAM_TEXTURE_BUDGET_BYTES + NON_STREAMED_TEXTURE_ALLOWANCE,
  freezeMs: 3000,
  frameP95Ms: 3000,
  enterWorldMs: 60000,
};

export type PerfMetric = "textureBytes" | "freezeMs" | "frameP95Ms" | "enterWorldMs" | "errors";
export type PerfViolation = {
  world: string;
  viewport: string;
  metric: PerfMetric;
  value: number;
  limit: number;
};
export type PerfRunVerdict = {
  world: string;
  viewport: string;
  renderer: string;
  maxTextureBytes: number;
  maxFreezeMs: number;
  maxFrameP95Ms: number;
  enterWorldMs: number;
  violations: PerfViolation[];
};
export type PerfGateResult = {
  pass: boolean;
  runs: PerfRunVerdict[];
  violations: PerfViolation[];
};

export function evaluatePerfGate(
  report: PerfReport,
  thresholds: PerfThresholds = PERF_THRESHOLDS,
): PerfGateResult {
  const runs: PerfRunVerdict[] = [];
  const violations: PerfViolation[] = [];
  for (const run of report.results) {
    const viewport = `${run.viewport.width}x${run.viewport.height}`;
    let maxTextureBytes = 0,
      maxFreezeMs = 0,
      maxFrameP95Ms = 0;
    for (const sample of run.samples) {
      if (typeof sample.estimatedTextureBytes === "number")
        maxTextureBytes = Math.max(maxTextureBytes, sample.estimatedTextureBytes);
      // frameMax łapie zamrożenia, które p95 ukrywa; gdy go brak, wracamy do p95.
      const freeze = sample.frameMaxMs ?? sample.frameP95Ms;
      if (typeof freeze === "number") maxFreezeMs = Math.max(maxFreezeMs, freeze);
      if (typeof sample.frameP95Ms === "number")
        maxFrameP95Ms = Math.max(maxFrameP95Ms, sample.frameP95Ms);
    }
    const local: PerfViolation[] = [];
    const check = (metric: PerfMetric, value: number, limit: number) => {
      if (value > limit) local.push({ world: run.world, viewport, metric, value, limit });
    };
    check("textureBytes", maxTextureBytes, thresholds.textureBytes);
    check("freezeMs", maxFreezeMs, thresholds.freezeMs);
    check("frameP95Ms", maxFrameP95Ms, thresholds.frameP95Ms);
    check("enterWorldMs", run.enterWorldMs, thresholds.enterWorldMs);
    if (run.errors && run.errors.length > 0)
      local.push({
        world: run.world,
        viewport,
        metric: "errors",
        value: run.errors.length,
        limit: 0,
      });
    runs.push({
      world: run.world,
      viewport,
      renderer: run.renderer ?? "?",
      maxTextureBytes,
      maxFreezeMs,
      maxFrameP95Ms,
      enterWorldMs: run.enterWorldMs,
      violations: local,
    });
    violations.push(...local);
  }
  return { pass: violations.length === 0, runs, violations };
}
