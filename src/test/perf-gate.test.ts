import { describe, expect, it } from "vitest";
import {
  evaluatePerfGate,
  PERF_THRESHOLDS,
  type PerfReport,
  type PerfRun,
} from "../game/assets/perfGate";
import { STREAM_TEXTURE_BUDGET_BYTES } from "../game/assets/streamBudget";

const MiB = 1024 * 1024;

function run(overrides: Partial<PerfRun> = {}): PerfRun {
  return {
    world: "verdant",
    viewport: { width: 844, height: 390 },
    renderer: "Canvas",
    enterWorldMs: 25000,
    samples: [
      { frameP95Ms: 40, frameMaxMs: 120, estimatedTextureBytes: 150 * MiB },
      { frameP95Ms: 45, frameMaxMs: 200, estimatedTextureBytes: 160 * MiB },
    ],
    errors: [],
    ...overrides,
  };
}
const report = (...runs: PerfRun[]): PerfReport => ({ results: runs });

describe("bramka wydajności (Faza 4)", () => {
  it("zdrowy raport przechodzi i nie zgłasza naruszeń", () => {
    const result = evaluatePerfGate(report(run()));
    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]?.maxTextureBytes).toBe(160 * MiB);
    expect(result.runs[0]?.maxFreezeMs).toBe(200);
  });

  it("próg pamięci to sufit całości: budżet streamingu + dodatek na tekstury niestreamowane", () => {
    expect(STREAM_TEXTURE_BUDGET_BYTES).toBe(192 * MiB);
    expect(PERF_THRESHOLDS.textureBytes).toBeGreaterThan(STREAM_TEXTURE_BUDGET_BYTES);
    expect(PERF_THRESHOLDS.textureBytes).toBe(STREAM_TEXTURE_BUDGET_BYTES + 28 * MiB);
  });

  it("łapie przekroczenie pamięci tekstur", () => {
    const over = run({
      samples: [{ frameP95Ms: 40, frameMaxMs: 120, estimatedTextureBytes: 230 * MiB }],
    });
    const result = evaluatePerfGate(report(over));
    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.metric === "textureBytes")).toBe(true);
  });

  it("łapie zamrożenie (frameMax), którego p95 nie widzi", () => {
    const freeze = run({
      samples: [{ frameP95Ms: 40, frameMaxMs: 9000, estimatedTextureBytes: 150 * MiB }],
    });
    const result = evaluatePerfGate(report(freeze));
    expect(result.pass).toBe(false);
    const v = result.violations.find((x) => x.metric === "freezeMs");
    expect(v?.value).toBe(9000);
  });

  it("gdy brak frameMax, zamrożenie liczy z p95", () => {
    const noMax = run({ samples: [{ frameP95Ms: 5000, estimatedTextureBytes: 150 * MiB }] });
    const result = evaluatePerfGate(report(noMax));
    expect(result.violations.some((v) => v.metric === "freezeMs" && v.value === 5000)).toBe(true);
  });

  it("łapie wysoki p95 przy zaostrzonym progu (fizyczny telefon)", () => {
    const slow = run({
      samples: [{ frameP95Ms: 400, frameMaxMs: 450, estimatedTextureBytes: 150 * MiB }],
    });
    const result = evaluatePerfGate(report(slow), { ...PERF_THRESHOLDS, frameP95Ms: 120 });
    expect(result.violations.some((v) => v.metric === "frameP95Ms")).toBe(true);
  });

  it("łapie zbyt długie wejście do świata", () => {
    const result = evaluatePerfGate(report(run({ enterWorldMs: 120000 })));
    expect(result.violations.some((v) => v.metric === "enterWorldMs")).toBe(true);
  });

  it("łapie błędy strony", () => {
    const result = evaluatePerfGate(report(run({ errors: ["coś pękło"] })));
    expect(result.violations.some((v) => v.metric === "errors")).toBe(true);
  });

  it("ignoruje surowy FPS — programowy Canvas nie jest miarą telefonu", () => {
    // Raport bez pola fps w ogóle; niskie fps nie może oblać bramki, jeśli pamięć/klatki są zdrowe.
    const result = evaluatePerfGate(report(run()));
    expect(result.pass).toBe(true);
  });

  it("agreguje naruszenia z wielu światów i kadrów", () => {
    const a = run();
    const b = run({
      world: "pyra",
      viewport: { width: 1280, height: 900 },
      samples: [{ frameP95Ms: 40, frameMaxMs: 120, estimatedTextureBytes: 230 * MiB }],
    });
    const result = evaluatePerfGate(report(a, b));
    expect(result.pass).toBe(false);
    expect(result.runs).toHaveLength(2);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.world).toBe("pyra");
  });

  it("pusty raport przechodzi (brak wyników = brak naruszeń)", () => {
    expect(evaluatePerfGate(report()).pass).toBe(true);
  });
});
