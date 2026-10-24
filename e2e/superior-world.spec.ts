import { test, expect, openHudTool } from "./fixtures";
import { readFileSync } from "node:fs";
import type { SuperiorIndex } from "../src/game/world/generated/superiorSave";
const index = JSON.parse(
  readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
) as SuperiorIndex;

test("Superior: ten lands, race and inventory survive travel and reload", async ({
  page,
}, info) => {
  // Ten land loads on software WebGL take longer than on Canvas.
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/scripts/playtest.html");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  const metrics = [];
  for (const feature of [
    ...index.features.filter((f) => f.id !== "verdant"),
    index.features.find((f) => f.id === "verdant")!,
  ]) {
    await openHudTool(page, "Plan miasta");
    await page.getByRole("button", { name: /Mapa planety Superior/ }).click();
    const atlas = page.getByRole("dialog", { name: "Mapa planety", exact: true });
    const legend = atlas.getByRole("button", { name: /^Legenda( i warstwy)?$/ });
    await expect(legend).toBeVisible();
    if ((await legend.getAttribute("aria-expanded")) !== "true") await legend.click();
    if (feature.id.startsWith("island-")) {
      const numerals = ["I", "II", "III", "IV", "V", "VI"];
      await atlas
        .getByRole("button", {
          name: `Wyspa questowa ${numerals[Number(feature.id.slice(-1)) - 1]} (nazwa robocza)`,
          exact: true,
        })
        .click();
    } else
      await atlas
        .locator(".pm-legend")
        .getByRole("button", { name: new RegExp(feature.name) })
        .click();
    await atlas.getByRole("button", { name: /^Podróżuj —/ }).click();
    await expect(atlas).not.toBeVisible();
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    await expect(canvas).toHaveAttribute("data-actor-visual", "hero-planetary-painted");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(feature.arrival.x, 0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeCloseTo(feature.arrival.y, 0);
    await expect
      .poll(() => canvas.locator("canvas").evaluate((el) => Number(el.dataset["superiorChunks"])))
      .toBeGreaterThan(0);
    const chunks = await canvas
      .locator("canvas")
      .evaluate((el) => Number(el.dataset["superiorChunks"]));
    expect(chunks).toBeLessThanOrEqual(12);
    metrics.push({
      feature: feature.id,
      chunks,
      metrics: await canvas.getAttribute("data-metrics"),
    });
  }
  await page.reload();
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  const saves = await page.evaluate(() =>
    Object.entries(localStorage).filter(([k]) => k.includes(":superior-world-v1:character:")),
  );
  expect(saves).toHaveLength(1);
  expect(JSON.parse(saves[0]![1]).feature).toBe("verdant");
  await expect(page.getByRole("complementary", { name: "Podróże po Superior" })).toHaveCount(0);
  expect(errors).toEqual([]);
  await info.attach("superior-streaming", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("superior-return.png") });
});

test("Superior: real depot entrance and personal chest survive reload", async ({ page }, info) => {
  await page.goto("/scripts/playtest.html");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  await page.getByRole("button", { name: "Plan miasta", exact: true }).click();
  await page.getByRole("button", { name: /Depozyt Korzeni/ }).click();
  await expect(canvas).toHaveAttribute("data-interior", "depot");
  await page.getByRole("button", { name: "Otwórz swoją skrzynię", exact: true }).click();
  const chest = page.getByRole("dialog", { name: "Twoja skrzynia", exact: true });
  const potion = chest.getByRole("article", { name: "Mikstura życia", exact: true });
  await potion.getByRole("button", { name: "Odłóż 1", exact: true }).click();
  await expect(potion).toContainText("Plecak: 2 · Skrzynia: 1");
  await page.getByRole("button", { name: "Zamknij skrzynię", exact: true }).click();
  await page.reload();
  await expect(canvas).toHaveAttribute("data-interior", "depot");
  await page.getByRole("button", { name: "Otwórz swoją skrzynię", exact: true }).click();
  await expect(potion).toContainText("Plecak: 2 · Skrzynia: 1");
  await page.screenshot({ path: info.outputPath("superior-depot.png") });
  await page.getByRole("button", { name: "Zamknij skrzynię", exact: true }).click();
  await page.getByRole("button", { name: "Wyjdź do miasta", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-interior", "outside");
  const source = JSON.parse(
    readFileSync("public/game/worlds/superior-v1/verdant/world.json", "utf8"),
  ) as { settlements: { bounds: { x: number; y: number; width: number; height: number } }[] };
  const enemies = JSON.parse((await canvas.getAttribute("data-enemies"))!) as {
    x: number;
    y: number;
  }[];
  for (const e of enemies)
    for (const { bounds: b } of source.settlements)
      expect(e.x >= b.x && e.x <= b.x + b.width && e.y >= b.y && e.y <= b.y + b.height).toBe(false);
});

test("Superior: mobile world and real overworld combat", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scripts/playtest.html");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  await expect(page.getByRole("complementary", { name: "Podróże po Superior" })).toHaveCount(0);
  const command = async (detail: import("../src/game/session").Command) =>
    canvas.evaluate(
      (el, detail) => el.dispatchEvent(new CustomEvent("ki:command", { detail })),
      detail,
    );
  const slot = { id: "verdant-spawn-160", x: 33616, y: 22992 };
  await command({ type: "move", x: slot.x, y: slot.y });
  await expect
    .poll(async () => {
      const enemies = JSON.parse((await canvas.getAttribute("data-enemies")) ?? "[]") as {
        id: string;
        hp: number;
      }[];
      return enemies.some((e) => e.id === slot.id);
    })
    .toBe(true);
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await canvas.getAttribute("data-player-x")) - slot.x,
        Number(await canvas.getAttribute("data-player-y")) - slot.y,
      ),
    )
    .toBeLessThan(180);
  await command({ type: "target", id: slot.id });
  await expect
    .poll(async () => {
      const values = await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([k]) => k.includes(":superior-world-v1:character:"))
          .map(
            ([, v]) =>
              JSON.parse(v) as { spawns: Record<string, { hp: number; deadUntil: number }> },
          ),
      );
      return values.some((v) => (v.spawns[slot.id]?.deadUntil ?? 0) > Date.now());
    })
    .toBe(true);
  await command({ type: "cancel" });
  await page.screenshot({ path: info.outputPath("superior-mobile-combat.png") });
  await page.reload();
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  const save = await page.evaluate(
    () =>
      Object.entries(localStorage)
        .filter(([k]) => k.includes(":superior-world-v1:character:"))
        .map(
          ([, v]) => JSON.parse(v) as { spawns: Record<string, { hp: number; deadUntil: number }> },
        )[0]!,
  );
  expect(save.spawns[slot.id]?.hp).toBe(0);
  expect(save.spawns[slot.id]?.deadUntil).toBeGreaterThan(Date.now());
});

for (const [race, label, feature] of [
  ["planetary", "Planetarni", "verdant"],
  ["sage", "Mędrcy", "aether"],
  ["android", "Androidy", "nexus"],
  ["legend", "Legendy", "pyra"],
] as const) {
  test(`Superior default: ${race} starts on generated land with one character save`, async ({
    page,
  }) => {
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: `Wybierz: ${label}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    const land = index.features.find((f) => f.id === feature)!;
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(land.arrival.x, 0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeCloseTo(land.arrival.y, 0);
    const saves = await page.evaluate(() =>
      Object.entries(localStorage).filter(([key]) => key.includes(":character:")),
    );
    expect(saves).toHaveLength(1);
    expect(JSON.parse(saves[0]![1])).toMatchObject({
      format: "superior-character",
      feature,
      player: { race, level: 1 },
    });
    await page.reload();
    await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(land.arrival.x, 0);
  });
}
