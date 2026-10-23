import { test, expect, basicAttack, expectCityClear, type Page } from "./fixtures";
import { cityRoom } from "../src/game/city/room";
import type { BuildingId } from "../src/game/city/types";
import { VERDANT_CITY } from "../src/game/city/verdantia";

async function clickPoint(page: Page, x: number, y: number) {
  const canvas = page.locator(".ki-canvas");
  const point = await canvas.evaluate(
    (el, p) => {
      const e = el as HTMLElement,
        b = e.getBoundingClientRect(),
        z = Number(e.dataset["zoom"]);
      return {
        x: b.x + (p.x - Number(e.dataset["cameraX"]) - b.width / 2) * z + b.width / 2,
        y: b.y + (p.y - Number(e.dataset["cameraY"]) - b.height / 2) * z + b.height / 2,
      };
    },
    { x, y },
  );
  await page.mouse.click(point.x, point.y);
}
async function building(page: Page, id: BuildingId) {
  await page.getByRole("button", { name: "Plan miasta", exact: true }).click();
  const name = VERDANT_CITY.buildings.find((b) => b.id === id)!.name;
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-interior", id);
  await expect(page.getByRole("complementary", { name: "Wnętrze budynku" })).toBeVisible();
}
async function exit(page: Page) {
  await page.getByRole("button", { name: "Wyjdź do miasta", exact: true }).click();
  await expect(page.locator(".ki-canvas")).toHaveAttribute("data-interior", "outside");
}
for (const [width, height] of [
  [1280, 900],
  [390, 844],
  [852, 393],
] as const) {
  test(`Verdantia city: real entrances, merchant, personal chest reload and training ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-interior", "outside");
    await expectCityClear(canvas);
    await page.screenshot({ path: info.outputPath(`city-outside-${width}.png`) });
    await building(page, "shop");
    await clickPoint(page, 300, 300);
    await expect(page.getByRole("dialog", { name: "Rozmowa: Mio", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Kup · 8", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Rozmowa: Mio" })).toContainText("Masz: 4");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    await page.screenshot({ path: info.outputPath(`city-shop-${width}.png`) });
    await exit(page);
    await building(page, "depot");
    await page.getByRole("button", { name: "Otwórz swoją skrzynię", exact: true }).click();
    const chest = page.getByRole("dialog", { name: "Twoja skrzynia", exact: true });
    await expect(chest).toBeVisible();
    const potion = chest.getByRole("article", { name: "Mikstura życia", exact: true });
    await potion.getByRole("button", { name: "Odłóż 1", exact: true }).click();
    await expect(potion).toContainText("Plecak: 3 · Skrzynia: 1");
    await page.getByRole("button", { name: "Zamknij skrzynię", exact: true }).click();
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "depot");
    await page.getByRole("button", { name: "Otwórz swoją skrzynię", exact: true }).click();
    await expect(potion).toContainText("Plecak: 3 · Skrzynia: 1");
    await page.screenshot({ path: info.outputPath(`city-depot-${width}.png`) });
    await potion.getByRole("button", { name: "Odbierz 1", exact: true }).click();
    await expect(potion).toContainText("Plecak: 4 · Skrzynia: 0");
    await page.getByRole("button", { name: "Zamknij skrzynię", exact: true }).click();
    await exit(page);
    await building(page, "arena");
    await page.getByRole("button", { name: "Rozpocznij trening", exact: true }).click();
    const dummy = cityRoom("arena").dummy;
    await expect
      .poll(async () =>
        canvas.evaluate(
          (el, p) =>
            Math.hypot(
              Number((el as HTMLElement).dataset["playerX"]) - p.x,
              Number((el as HTMLElement).dataset["playerY"]) - p.y,
            ),
          dummy,
        ),
      )
      .toBeLessThanOrEqual(62);
    await basicAttack(page).click();
    await expect(page.getByRole("complementary", { name: "Wnętrze budynku" })).toContainText(
      "Trafienia: 1",
    );
    await expectCityClear(canvas);
    await page.screenshot({ path: info.outputPath(`city-training-${width}.png`) });
    await exit(page);
    await expectCityClear(canvas);
    expect(errors).toEqual([]);
  });
}
