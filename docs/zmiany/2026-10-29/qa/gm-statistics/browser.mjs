import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";
const base = process.env.GM_QA_URL || "http://127.0.0.1:4201";
const dir = "docs/zmiany/2026-10-29/qa/gm-statistics";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [],
  results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/" + dir + "/ui.html");
  const labels = {
    maxHp: "Maksymalne HP",
    maxKi: "Maksymalne KI",
    attack: "Atak",
    defense: "Obrona",
    speed: "Szybkość ruchu (jednostki/s)",
    kiRegen: "Regeneracja KI / s",
    crit: "Szansa krytyczna (%)",
    attackInterval: "Odstęp ataków (ms)",
    range: "Zasięg ataku",
  };
  await page.getByLabel("Atak", { exact: true }).waitFor();
  for (const race of ["planetary", "sage", "android", "legend"]) {
    await page.getByLabel("Rasa QA").selectOption(race);
    const expected = JSON.parse(await page.locator("#expected").textContent());
    for (const [key, label] of Object.entries(labels)) {
      const value = Number(await page.getByLabel(label, { exact: true }).inputValue());
      if (value !== Number(expected[key].toFixed(6)))
        throw Error(race + " " + key + ": " + value + " != " + expected[key]);
    }
    results.push(
      race +
        ": nine current fields match actual saved-player calculation including gear/training/skills",
    );
  }
  await page.getByLabel("Szybkość ruchu (jednostki/s)", { exact: true }).fill("650");
  await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).click();
  await page.getByText("Zapisano postać na urządzeniu.", { exact: true }).waitFor();
  if (
    (await page.getByLabel("Szybkość ruchu (jednostki/s)", { exact: true }).inputValue()) !== "650"
  )
    throw Error("Saved speed disappeared");
  results.push(
    "Save through actual editor callback refreshes parent row and displays stored override",
  );
  await page.getByLabel("Atak", { exact: true }).fill("99");
  await page.getByRole("button", { name: "Nowszy zapis QA" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Zapis postaci zmienił się podczas edycji" })
    .waitFor();
  if (await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).isEnabled())
    throw Error("Stale write not blocked");
  await page.getByRole("button", { name: "Wczytaj aktualne dane" }).click();
  const actual = JSON.parse(await page.locator("#expected").textContent());
  if (Number(await page.getByLabel("Atak", { exact: true }).inputValue()) !== actual.attack)
    throw Error("Reload kept stale attack");
  results.push(
    "Newer row blocks stale write; explicit reload replaces draft with latest computed values",
  );
  await page.getByRole("button", { name: "Przywróć parametry domyślne" }).click();
  await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).click();
  await page.waitForFunction(
    () => JSON.parse(document.querySelector("#expected").textContent).speed !== 650,
  );
  const after = JSON.parse(await page.locator("#expected").textContent());
  if (
    Number(await page.getByLabel("Szybkość ruchu (jednostki/s)", { exact: true }).inputValue()) !==
    Number(after.speed.toFixed(6))
  )
    throw Error("Reset not displayed");
  results.push("Reset restores derived stats rather than blank fields");
  await page.locator(".ki-admin-stat-overrides").scrollIntoViewIfNeeded();
  await page.screenshot({ path: dir + "/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".ki-admin-stat-overrides").scrollIntoViewIfNeeded();
  await page.screenshot({ path: dir + "/mobile-390.png" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw Error("Mobile overflow");
  results.push("390px form has no horizontal overflow");
  if (errors.length) throw Error(errors.join("\n"));
  await context.tracing.stop({ path: dir + "/trace.zip" });
  const report = {
    passed: results.length,
    results,
    pageErrors: errors,
    scope:
      "Actual CharacterEditor in isolated React fixture; no real account or cloud write; not physical phone",
  };
  await fs.writeFile(dir + "/browser-results.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
