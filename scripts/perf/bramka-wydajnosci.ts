/**
 * Faza 4: bramka wydajności CI na gotowym raporcie pomiaru (scripts/measure-game.ts).
 * Nie uruchamia przeglądarki — czyta JSON i sprawdza progi niezależne od renderera.
 * Użycie: tsx scripts/perf/bramka-wydajnosci.ts <raport.json>
 * Progi można nadpisać: KI_PERF_TEXTURE_MB, KI_PERF_FREEZE_MS, KI_PERF_P95_MS, KI_PERF_ENTER_MS.
 * Exit 0 = PASS, 1 = FAIL (przekroczony próg), 2 = błąd użycia / brak pliku.
 */
import { readFile } from "node:fs/promises";
import {
  evaluatePerfGate,
  PERF_THRESHOLDS,
  type PerfReport,
  type PerfThresholds,
} from "../../src/game/assets/perfGate";

const path = process.argv[2] ?? process.env["KI_PERF_REPORT"];
if (!path) {
  console.error("Użycie: tsx scripts/perf/bramka-wydajnosci.ts <raport.json>");
  process.exit(2);
}

let report: PerfReport;
try {
  report = JSON.parse(await readFile(path, "utf8")) as PerfReport;
} catch (error) {
  console.error("Nie udało się wczytać raportu:", path, error);
  process.exit(2);
}
if (!Array.isArray(report.results)) {
  console.error("Raport nie ma tablicy results:", path);
  process.exit(2);
}

const MiB = 1024 * 1024;
const thresholds: PerfThresholds = { ...PERF_THRESHOLDS };
const textureMb = Number(process.env["KI_PERF_TEXTURE_MB"]);
if (Number.isFinite(textureMb) && textureMb > 0) thresholds.textureBytes = textureMb * MiB;
const freezeMs = Number(process.env["KI_PERF_FREEZE_MS"]);
if (Number.isFinite(freezeMs) && freezeMs > 0) thresholds.freezeMs = freezeMs;
const p95Ms = Number(process.env["KI_PERF_P95_MS"]);
if (Number.isFinite(p95Ms) && p95Ms > 0) thresholds.frameP95Ms = p95Ms;
const enterMs = Number(process.env["KI_PERF_ENTER_MS"]);
if (Number.isFinite(enterMs) && enterMs > 0) thresholds.enterWorldMs = enterMs;

const result = evaluatePerfGate(report, thresholds);
console.log(
  `Progi: tekstury ≤ ${(thresholds.textureBytes / MiB).toFixed(0)} MiB, zamrożenie ≤ ${thresholds.freezeMs} ms, ` +
    `p95 ≤ ${thresholds.frameP95Ms} ms, wejście ≤ ${thresholds.enterWorldMs} ms`,
);
console.table(
  result.runs.map((r) => ({
    świat: r.world,
    kadr: r.viewport,
    renderer: r.renderer,
    "tekstury MiB": Number((r.maxTextureBytes / MiB).toFixed(1)),
    "zamrożenie ms": Math.round(r.maxFreezeMs),
    "p95 ms": Math.round(r.maxFrameP95Ms),
    "wejście ms": Math.round(r.enterWorldMs),
    status: r.violations.length ? "FAIL" : "ok",
  })),
);
if (result.pass) {
  console.log("BRAMKA WYDAJNOŚCI: PASS");
  process.exit(0);
}
console.error("BRAMKA WYDAJNOŚCI: FAIL");
for (const v of result.violations)
  console.error(
    `  ${v.world} ${v.viewport}: ${v.metric} = ${Math.round(v.value)} > limit ${Math.round(v.limit)}`,
  );
process.exit(1);
