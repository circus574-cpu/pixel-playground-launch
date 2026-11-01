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
    await page.getByText("70% · 1 szt.", { exact: false }).first().waitFor();
    assert.ok(
      (await image.locator("svg").getAttribute("viewBox"))
        .split(" ")
        .every((v) => Number.isFinite(Number(v))),
    );
    await page.screenshot({ path: `${out}/monsters-${width}.png` });
    await page.getByRole("tab", { name: /^Przedmioty i Rzemiosło/ }).click();
    await page.getByText("Skąd zdobyć", { exact: true }).first().waitFor();
    const icons = page.locator(".ki-catalog-item");
    await icons.first().waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".ki-catalog-item")).some((i) => i.naturalWidth > 0),
    );
    await page.screenshot({ path: `${out}/items-${width}.png` });
    await page.getByRole("button", { name: /^Materiały Łupu/ }).click();
    await page
      .getByText(/Mchowy Szlamak · Verdantia · 70%/)
      .first()
      .waitFor();
    await page.getByRole("button", { name: /^Katalog Ekwipunku V2/ }).click();
    await page.getByText("Skąd zdobyć", { exact: true }).first().waitFor();
    assert.deepEqual(errors, []);
    results.push({ width, monsters: true, itemImages: true, lootSources: true, jsErrors: 0 });
    await page.close();
  }
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
