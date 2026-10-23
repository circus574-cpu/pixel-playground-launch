import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
import type { SuperiorIndex } from "../src/game/world/generated/superiorSave";
const index = JSON.parse(
  readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
) as SuperiorIndex;

test("Superior: ten lands, race and inventory survive travel and reload", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/scripts/playtest.html?ki-superior=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  const accepted = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.endsWith(":superior-v1"))),
  );
  const travel = page.getByRole("complementary", { name: "Podróże po Superior" });
  const metrics = [];
  for (const feature of [
    ...index.features.filter((f) => f.id !== "verdant"),
    index.features.find((f) => f.id === "verdant")!,
  ]) {
    await travel.locator("summary").click();
    await travel.getByLabel("Cel podróży").selectOption(feature.id);
    await travel.getByRole("button", { name: "Wyrusz", exact: true }).click();
    await expect(travel.locator("strong")).toHaveText(feature.name);
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
  await expect(travel.locator("strong")).toHaveText("Verdantia");
  expect(
    await page.evaluate(() =>
      Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.endsWith(":superior-v1"))),
    ),
  ).toEqual(accepted);
  expect(errors).toEqual([]);
  await info.attach("superior-streaming", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("superior-return.png") });
});

test("Superior: real depot entrance and personal chest survive reload", async ({ page }, info) => {
  await page.goto("/scripts/playtest.html?ki-superior=1");
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

test("Superior: mobile expedition menu and real overworld combat", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scripts/playtest.html?ki-superior=1");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-terrain-mode", "superior");
  const travel = page.getByRole("complementary", { name: "Podróże po Superior" });
  await travel.locator("summary").click();
  await expect(travel.getByRole("button", { name: "Wyrusz", exact: true })).toBeEnabled();
  await travel.locator("summary").click();
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
          .filter(([k]) => k.endsWith(":superior-v1"))
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
        .filter(([k]) => k.endsWith(":superior-v1"))
        .map(
          ([, v]) => JSON.parse(v) as { spawns: Record<string, { hp: number; deadUntil: number }> },
        )[0]!,
  );
  expect(save.spawns[slot.id]?.hp).toBe(0);
  expect(save.spawns[slot.id]?.deadUntil).toBeGreaterThan(Date.now());
});
