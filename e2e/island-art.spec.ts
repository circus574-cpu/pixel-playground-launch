import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";

// Sześć wysp Superiora ma własne atlasy (superior-island-N-art). Test sprawdza to,
// co naprawdę daje wartość: każda wyspa dostaje własne podłoże i rekwizyty, miasto
// i usługi zostają nienaruszone, a pobierany jest wyłącznie atlas aktywnej wyspy.
const WYSYPY = [
  { land: "island-1", affinity: "aether", rasa: "Mędrcy" },
  { land: "island-2", affinity: "aether", rasa: "Mędrcy" },
  { land: "island-3", affinity: "aether", rasa: "Mędrcy" },
  { land: "island-4", affinity: "verdant", rasa: "Planetarni" },
  { land: "island-5", affinity: "verdant", rasa: "Planetarni" },
  { land: "island-6", affinity: "pyra", rasa: "Legendy" },
];
const SAVE = "ki-legends:adventure:v1:superior-world-v2";
const arrival = (land: string) => {
  const index = JSON.parse(
    require("node:fs").readFileSync("public/game/worlds/superior-v2/index.json", "utf8"),
  ) as { features: { id: string; arrival: { x: number; y: number } }[] };
  return index.features.find((f) => f.id === land)!.arrival;
};

for (const w of WYSYPY) {
  test(`${w.land}: własne materiały, zachowane miasto i tylko swój atlas`, async ({
    page,
  }, info) => {
    test.setTimeout(420000);
    const errors: string[] = [];
    const requested: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      const u = r.url();
      if (/superior-island-\d-art/.test(u)) requested.push(u);
    });
    await page.setViewportSize({ width: 900, height: 560 });
    await page.goto("/scripts/playtest.html?ki-world-v2=1&ki-islands-art=1");
    await page.getByRole("button", { name: "Wybierz: " + w.rasa, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();

    const a = arrival(w.land);
    await page.evaluate(
      ({ base, land, affinity, x, y }) => {
        const key = base + ":character:" + localStorage.getItem(base + ":active-character");
        const raw = JSON.parse(localStorage.getItem(key)!);
        raw.feature = land;
        raw.town = null;
        raw.player.continent = affinity;
        raw.player.x = x;
        raw.player.y = y;
        localStorage.setItem(key, JSON.stringify(raw));
      },
      { base: SAVE, land: w.land, affinity: w.affinity, x: a.x, y: a.y },
    );
    await page.reload();

    const stage = page.locator(".ki-canvas").first();
    const canvas = stage.locator("canvas");
    await expect(canvas).toHaveAttribute("data-island-art", w.land, { timeout: 300000 });
    await expect(canvas).toHaveAttribute("data-superior-pending", "0", { timeout: 300000 });
    expect(Number(await canvas.getAttribute("data-superior-chunks"))).toBeLessThanOrEqual(12);
    expect(await page.locator(".ki-canvas").count()).toBe(1);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: info.outputPath(`${w.land}.png`), timeout: 300000 });

    // Inne wyspy nie mogą być ładowane dla tej.
    const obce = requested.filter(
      (u) => !u.includes(`superior-island-${w.land.split("-")[1]}-art`),
    );
    expect(obce).toEqual([]);
    expect(requested.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
