import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const out = process.env.KI_QA_OUTPUT ?? "test-results/admin-catalog";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: width === 390,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${process.env.KI_ADMIN_QA_URL ?? "http://127.0.0.1:5189"}/scripts/admin-catalog.html?ki-world-v2=1`,
    );
    await page.getByRole("tab", { name: /^Potwory \(/ }).click();
    const image = page.getByRole("img", { name: "Grafika: Mchowy Szlamak", exact: true });
    await image.locator("svg image").waitFor({ timeout: 60000 });
    await page.getByText("Łupy — szanse i edycja procentu dropu").first().waitFor();
    assert.ok(
      (await image.locator("svg").getAttribute("viewBox"))
        .split(" ")
        .every((v) => Number.isFinite(Number(v))),
    );
    await page.screenshot({ path: `${out}/monsters-${width}.png` });
    await page.getByRole("tab", { name: /^Przedmioty \(/ }).click();
    await page.getByRole("button", { name: /^Katalog Ekwipunku V2/ }).click();
    await page.getByText("Źródła:", { exact: true }).first().waitFor();
    const icons = page.locator(".ki-catalog-item");
    await icons.first().waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".ki-catalog-item")).some((i) => i.naturalWidth > 0),
    );
    await page.screenshot({ path: `${out}/items-${width}.png` });
    // Item details open in a centred window that fits the viewport.
    await page.getByRole("button", { name: "Szczegóły", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Skąd zdobyć", { exact: true }).waitFor();
    const box = await dialog.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, "item window inside viewport");
    await page.screenshot({ path: `${out}/item-window-${width}.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    await page.getByRole("button", { name: /^Materiały Łupu/ }).click();
    await page
      .getByText(/stały łup: \d+ potw\./)
      .first()
      .waitFor();
    // Boss cards show their animation.
    await page.getByRole("tab", { name: /^Bossowie \(/ }).click();
    const boss = page.getByRole("img", { name: /^Boss / }).first();
    await boss.waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".ki-boss-preview img")).some((i) => i.naturalWidth > 0),
    );
    await page.screenshot({ path: `${out}/bosses-${width}.png` });
    // Detailed spawn list from the world data.
    await page.getByRole("tab", { name: /^Spawny/ }).click();
    await page.getByText("Podsumowanie", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText(/^Punkty — wszystkie \(\d+\)/).waitFor();
    await page.screenshot({ path: `${out}/spawns-${width}.png` });
    assert.deepEqual(errors, []);
    results.push({
      width,
      monsters: true,
      itemImages: true,
      itemWindow: true,
      bosses: true,
      spawns: true,
      jsErrors: 0,
    });
    await page.close();
  }
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
