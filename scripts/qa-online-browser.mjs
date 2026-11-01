/** Run with scripts/qa-online-runtime.ts + online-playtest.vite.ts, isolated PostgreSQL. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const output = process.env.KI_QA_OUTPUT || "/tmp/ki-online-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const results = [];
for (const [race, label] of [
  ["planetary", "Planetarni"],
  ["sage", "Mędrcy"],
  ["android", "Androidy"],
  ["legend", "Legendy"],
]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors = [];
  const sent = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("websocket", (ws) =>
    ws.on("framesent", (e) => {
      try {
        const p = JSON.parse(String(e.payload));
        sent.push(p.type);
      } catch {}
    }),
  );
  try {
    await page.goto("http://127.0.0.1:5188/scripts/online-playtest.html");
    await page.getByRole("button", { name: new RegExp("Wybierz: " + label) }).click();
    await page.getByRole("button", { name: /Rozpocznij przygodę/ }).click();
    const host = page.locator(".ki-canvas").first();
    await host.locator("canvas").waitFor({ timeout: 90000 });
    await page.waitForFunction(
      () => document.querySelector(".ki-canvas")?.getAttribute("data-player-x"),
      {},
      { timeout: 90000 },
    );
    assert.equal(
      await host.getAttribute("data-world"),
      { planetary: "verdant", sage: "aether", android: "nexus", legend: "pyra" }[race],
    );
    const id = new URL(page.url()).searchParams.get("character");
    await page.getByRole("button", { name: /^Rozmowa ·/ }).click();
    await page.getByRole("button", { name: "Przyjmij zadanie", exact: true }).click();
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    const start = Number(await host.getAttribute("data-player-x"));
    await page.keyboard.down("d");
    await page.waitForTimeout(900);
    await page.keyboard.up("d");
    await page.waitForTimeout(700);
    const moved = Number(await host.getAttribute("data-player-x"));
    assert.ok(moved > start + 5, `Movement did not reach renderer: ${start} -> ${moved}`);
    const saved = await page.evaluate(async (id) => {
      const r = await fetch("/ws/characters/" + id, {
        headers: { Authorization: "Bearer online-fixture-token-only" },
      });
      return r.json();
    }, id);
    assert.equal(saved.state.player.race, race);
    assert.equal(saved.state.player.quests.steps, "active");
    assert.ok(Math.abs(saved.state.player.x - moved) < 45, "Renderer and database diverged");
    assert.equal(await page.evaluate((id) => localStorage.getItem(id), id), null);
    await page.screenshot({ path: output + "/" + race + ".png" });
    await page.reload();
    await page.getByRole("button", { name: "Wczytaj z serwera" }).click();
    await page.waitForFunction(
      () => document.querySelector(".ki-canvas")?.getAttribute("data-player-x"),
      {},
      { timeout: 90000 },
    );
    const restored = Number(await page.locator(".ki-canvas").first().getAttribute("data-player-x"));
    assert.ok(
      Math.abs(restored - saved.state.player.x) < 45,
      `Reload lost server position ${restored} vs ${saved.state.player.x}`,
    );
    await fetch("http://127.0.0.1:7447/drop", {
      method: "POST",
      headers: { Authorization: "Bearer online-fixture-token-only" },
    });
    await context.setOffline(true);
    await page
      .getByRole("button", { name: /Ponów|Spróbuj/ })
      .first()
      .waitFor({ timeout: 25000 });
    const frozen = await page.locator(".ki-canvas").first().getAttribute("data-player-x");
    await page.keyboard.down("d");
    await page.waitForTimeout(500);
    await page.keyboard.up("d");
    assert.equal(await page.locator(".ki-canvas").first().getAttribute("data-player-x"), frozen);
    assert.ok(sent.includes("direction"));
    assert.ok(
      !sent.includes("position") && !sent.includes("auth"),
      "Legacy client-state relay still active",
    );
    assert.deepEqual(errors, []);
    results.push({
      race,
      status: "PASS",
      checks: [
        "selection",
        "Phaser world",
        "NPC dialogue and quest acceptance",
        "keyboard intention",
        "PostgreSQL position",
        "reload",
        "no local save",
        "disconnect freezes",
        "no legacy packets",
      ],
      start,
      moved,
      restored,
    });
  } catch (error) {
    results.push({
      race,
      status: "FAIL",
      error: String(error),
      errors,
      body: (await page.locator("body").innerText()).slice(-1600),
    });
    await page.screenshot({ path: output + "/" + race + "-failure.png" }).catch(() => {});
  }
  await context.tracing.stop({ path: output + "/" + race + "-trace.zip" });
  await context.close();
  console.log(JSON.stringify(results.at(-1)));
}
await browser.close();
await writeFile(output + "/results.json", JSON.stringify(results, null, 2));
if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
