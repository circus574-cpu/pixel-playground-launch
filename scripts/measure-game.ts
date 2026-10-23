import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env["KI_BENCH_URL"] ?? "http://127.0.0.1:4174/scripts/playtest.html";
const webgl = process.env["KI_BENCH_WEBGL"] === "1";
const duration = Number(process.env["KI_BENCH_SECONDS"] ?? 10);
if (!Number.isFinite(duration) || duration < 5 || duration > 120)
  throw Error("Benchmark duration must be 5–120 seconds");
const browser = await chromium.launch({
  ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}),
  args: webgl
    ? ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : ["--no-sandbox", "--disable-webgl"],
});
const results: unknown[] = [];
const outputDir =
  process.env["KI_QA_OUTPUT_DIR"] ??
  `docs/zmiany/${new Date().toISOString().slice(0, 10)}/qa/benchmark`;
await mkdir(outputDir, { recursive: true });
type Sample = {
  sampleAtMs: number;
  fps: number;
  frameP50Ms: number;
  frameP95Ms: number;
  objects: number;
  activeObjects: number;
  visibleObjects: number;
  estimatedTextureBytes: number;
  jsHeapBytes: number | null;
  renderer: string;
};
try {
  for (const viewport of webgl
    ? [{ width: 640, height: 480 }]
    : [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ])
    for (const [race, world] of [
      ["Planetarni", "verdant"],
      ["Mędrcy", "aether"],
      ["Androidy", "nexus"],
      ["Legendy", "pyra"],
    ] as const) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 700,
        isMobile: viewport.width < 700,
      });
      const page = await context.newPage(),
        errors: string[] = [],
        headers: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.text().includes("Phaser v4.2.1 (")) headers.push(m.text());
      });
      // Literal browser code avoids tsx/esbuild's Node-only __name helper in serialization.
      await page.addInitScript({
        content: `(() => {
        const counters = {calls: 0}; window.__kiDrawCalls = counters;
        const seen = new Map();
        for (const context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
          if (!context) continue;
          let proto = context.prototype;
          while (proto && proto !== Object.prototype) {
            for (const key of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
              const descriptor = Object.getOwnPropertyDescriptor(proto, key);
              if (!descriptor || typeof descriptor.value !== "function" || seen.get(proto)?.has(key)) continue;
              const keys = seen.get(proto) || new Set(); keys.add(key); seen.set(proto, keys);
              const original = descriptor.value;
              Object.defineProperty(proto, key, {...descriptor, value: function(...args) {
                counters.calls++; return Reflect.apply(original, this, args);
              }});
            }
            proto = Object.getPrototypeOf(proto);
          }
        }
      })();`,
      });
      const opened = performance.now();
      await page.goto(base);
      await expect(
        page.getByRole("button", { name: "Wybierz: " + race, exact: true }),
      ).toBeAttached();
      const selectionInteractiveMs = performance.now() - opened;
      await page.getByRole("button", { name: "Wybierz: " + race, exact: true }).click();
      const loading = performance.now();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      const canvas = page.locator(".ki-canvas");
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expect(canvas).toHaveAttribute("data-world", world);
      const enterWorldMs = performance.now() - loading;
      await expect.poll(() => canvas.getAttribute("data-metrics")).not.toBeNull();
      const phaserLoadMs = Number(await canvas.getAttribute("data-load-ms"));
      expect(headers.some((h) => h.includes(webgl ? "WebGL" : "Canvas"))).toBe(true);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      const beginCalls = await page.evaluate(
          () => (window as Window & { __kiDrawCalls?: { calls: number } }).__kiDrawCalls!.calls,
        ),
        start = performance.now();
      const samples: Sample[] = [];
      let last = 0;
      while (performance.now() - start < duration * 1000) {
        const elapsed = performance.now() - start;
        if (elapsed > 3000 && elapsed < 6500) {
          await page.keyboard.down("ArrowRight");
          await page.waitForTimeout(180);
          await page.keyboard.up("ArrowRight");
          await page.keyboard.down("ArrowLeft");
          await page.waitForTimeout(180);
          await page.keyboard.up("ArrowLeft");
        }
        await page.waitForTimeout(250);
        const sample = JSON.parse((await canvas.getAttribute("data-metrics"))!) as Sample;
        if (sample.sampleAtMs !== last) {
          samples.push(sample);
          last = sample.sampleAtMs;
        }
      }
      const elapsedMs = performance.now() - start,
        endCalls = await page.evaluate(
          () => (window as Window & { __kiDrawCalls?: { calls: number } }).__kiDrawCalls!.calls,
        );
      const metrics = await cdp.send("Performance.getMetrics"),
        dom = await cdp.send("Memory.getDOMCounters");
      await page.screenshot({
        path: `${outputDir}/benchmark-${webgl ? "webgl" : "canvas"}-${world}-${viewport.width}.png`,
      });
      await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
      await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
      await expect(page.locator("canvas")).toHaveCount(0);
      await cdp.send("HeapProfiler.collectGarbage");
      const released = await cdp.send("Performance.getMetrics");
      const row = {
        race,
        world,
        viewport,
        renderer: webgl ? "WebGL SwiftShader (software)" : "Canvas",
        selectionInteractiveMs,
        enterWorldMs,
        phaserLoadMs,
        sampleDurationMs: elapsedMs,
        samples,
        fpsMean: samples.reduce((n, s) => n + s.fps, 0) / samples.length,
        drawCallsTotal: webgl ? endCalls - beginCalls : null,
        drawCallsPerSecond: webgl ? ((endCalls - beginCalls) * 1000) / elapsedMs : null,
        cdpMetrics: metrics.metrics,
        dom,
        heapAfterExitGcBytes:
          released.metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? null,
        errors,
      };
      results.push(row);
      expect(errors).toEqual([]);
      console.log(
        JSON.stringify({
          world,
          viewport,
          renderer: row.renderer,
          fpsMean: row.fpsMean,
          enterWorldMs,
        }),
      );
      await context.close();
    }
} finally {
  await browser.close();
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    `${outputDir}/performance-${webgl ? "webgl" : "canvas"}.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        environment:
          "Linux cloud Chromium; localhost assets; emulated viewport/touch; not physical Android; no Playwright trace recording",
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
