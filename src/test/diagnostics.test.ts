import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIAG_DURATION_MS,
  buildDiagReport,
  diagSummary,
  diagWaypoints,
  startDiagnostics,
  type DiagDevice,
  type DiagSample,
} from "../game/diagnostics";
import { evaluatePerfGate } from "../game/assets/perfGate";

const MiB = 1024 * 1024;
const device: DiagDevice = {
  userAgent: "TestPhone/1.0",
  viewport: { width: 844, height: 390 },
  devicePixelRatio: 3,
  hardwareConcurrency: 8,
  deviceMemoryGB: 6,
  touch: true,
};

describe("diagWaypoints", () => {
  it("tworzy pętlę o zadanej liczbie punktów wokół środka", () => {
    const pts = diagWaypoints(1000, 2000, 180, 8);
    expect(pts).toHaveLength(8);
    expect(pts[0]).toEqual({ x: 1180, y: 2000 });
    for (const p of pts) {
      const dist = Math.hypot(p.x - 1000, p.y - 2000);
      expect(dist).toBeLessThanOrEqual(181);
      expect(dist).toBeGreaterThan(170);
    }
  });
  it("jest deterministyczny", () => {
    expect(diagWaypoints(50, 60)).toEqual(diagWaypoints(50, 60));
  });
});

describe("buildDiagReport + zgodność z bramką wydajności", () => {
  const samples: DiagSample[] = [
    {
      sampleAtMs: 1,
      fps: 58,
      frameP95Ms: 20,
      frameMaxMs: 60,
      estimatedTextureBytes: 150 * MiB,
      renderer: "WebGL",
    },
    {
      sampleAtMs: 2,
      fps: 60,
      frameP95Ms: 18,
      frameMaxMs: 40,
      estimatedTextureBytes: 160 * MiB,
      renderer: "WebGL",
    },
  ];
  it("buduje raport w kształcie czytelnym dla bench:gate", () => {
    const report = buildDiagReport({
      device,
      world: "verdant",
      enterWorldMs: 12000,
      durationMs: DIAG_DURATION_MS,
      samples,
      errors: [],
      now: new Date("2026-11-11T20:00:00Z"),
    });
    expect(report.mode).toBe("device-diagnostic");
    expect(report.device.userAgent).toBe("TestPhone/1.0");
    expect(report.results).toHaveLength(1);
    const run = report.results[0]!;
    expect(run.world).toBe("verdant");
    expect(run.renderer).toBe("WebGL");
    expect(run.viewport).toEqual({ width: 844, height: 390 });
    expect(run.samples).toHaveLength(2);
    // Bramka wydajności przyjmuje raport i healthy dane przechodzą.
    expect(evaluatePerfGate(report).pass).toBe(true);
  });
  it("bramka łapie przekroczenie pamięci w raporcie z urządzenia", () => {
    const report = buildDiagReport({
      device,
      world: "nexus",
      enterWorldMs: 1000,
      durationMs: DIAG_DURATION_MS,
      samples: [{ sampleAtMs: 1, fps: 30, frameMaxMs: 50, estimatedTextureBytes: 240 * MiB }],
      errors: [],
    });
    const result = evaluatePerfGate(report);
    expect(result.pass).toBe(false);
    expect(result.violations.some((v) => v.metric === "textureBytes")).toBe(true);
  });
});

describe("diagSummary", () => {
  it("liczy średni FPS, max zamrożenie i pamięć", () => {
    const report = buildDiagReport({
      device,
      world: "pyra",
      enterWorldMs: 0,
      durationMs: DIAG_DURATION_MS,
      samples: [
        { fps: 30, frameMaxMs: 100, estimatedTextureBytes: 100 * MiB },
        { fps: 50, frameMaxMs: 900, estimatedTextureBytes: 180 * MiB },
      ],
      errors: ["boom"],
    });
    const s = diagSummary(report);
    expect(s.fpsMean).toBe(40);
    expect(s.fpsMin).toBe(30);
    expect(s.freezeMaxMs).toBe(900);
    expect(s.textureMiB).toBe(180);
    expect(s.samples).toBe(2);
    expect(s.errors).toBe(1);
  });
});

describe("startDiagnostics (autonomiczny przebieg)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(durationMs: number) {
    const sent: unknown[] = [];
    let sampleAt = 0;
    const onComplete = vi.fn();
    const cancel = startDiagnostics({
      send: (c) => sent.push(c),
      getSnapshot: () => ({ x: 100, y: 100, dead: false, god: false, staff: true, foes: [] }),
      readMetrics: () => ({
        sampleAtMs: ++sampleAt,
        fps: 30,
        frameMaxMs: 100,
        estimatedTextureBytes: 150 * MiB,
        renderer: "Canvas",
      }),
      readWorld: () => "verdant",
      readEnterMs: () => 1000,
      device: () => device,
      durationMs,
      onProgress: () => {},
      onComplete,
    });
    return { sent, onComplete, cancel };
  }

  it("włącza nieśmiertelność, wydaje polecenia i kończy raportem po czasie", () => {
    const { sent, onComplete } = setup(6000);
    // God mode włączany od razu dla staff.
    expect(sent.some((c) => (c as { action?: string }).action === "god")).toBe(true);
    vi.advanceTimersByTime(6500);
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Marsz (move) i unik (dodge) zostały wydane autonomicznie.
    expect(sent.some((c) => (c as { type?: string }).type === "move")).toBe(true);
    expect(sent.some((c) => (c as { type?: string }).type === "dodge")).toBe(true);
    const report = onComplete.mock.calls[0]![0];
    expect(report.results[0].samples.length).toBeGreaterThan(3);
    expect(report.results[0].world).toBe("verdant");
    // Przywraca god mode po pomiarze (drugi toggle).
    expect(sent.filter((c) => (c as { action?: string }).action === "god")).toHaveLength(2);
  });

  it("przerwanie nie wywołuje onComplete", () => {
    const { onComplete, cancel } = setup(6000);
    vi.advanceTimersByTime(1000);
    cancel();
    vi.advanceTimersByTime(10000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
