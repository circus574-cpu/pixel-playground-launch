import { test, expect, openHudTool, superiorArrival, type Page } from "./fixtures";
import { WORLDS } from "../src/game/world/worlds";

const regions = [
  ["verdant", "Planetarni", "Verdantia"],
  ["aether", "Mędrcy", "Aetheria"],
  ["nexus", "Androidy", "Nexus-9"],
  ["pyra", "Legendy", "Pyra"],
] as const;
const saves = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
async function leaveGame(page: Page) {
  await openHudTool(page, "Ustawienia");
  await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
  await expect(page.locator(".ki-canvas")).toHaveCount(0);
}
async function create(page: Page, race: string) {
  const newCharacter = page.getByRole("button", { name: "Utwórz nową postać", exact: true });
  if (await newCharacter.isVisible()) await newCharacter.click();
  await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await expect(page.locator(".ki-hud")).toBeVisible();
}

for (const [continent, race, name] of regions) {
  test(`real map handoff to ${name}: selection, spawn, refresh, back and other saves`, async ({
    page,
  }, info) => {
    const webgl = info.project.name === "application-webgl";
    await page.goto("/");
    await create(page, "Planetarni");
    await leaveGame(page);
    const before = await saves(page);
    await page.goto("/mapa");
    if (webgl) {
      await expect(page.locator(".planet-globe.is-ready")).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Interaktywny globus planety Superior", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("To urządzenie nie obsługuje WebGL 2", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".planet-globe")).toHaveCount(0);
    }
    const legend = page.getByRole("button", {
      name: webgl ? "Legenda" : "Legenda i warstwy",
      exact: true,
    });
    if ((await legend.getAttribute("aria-expanded")) !== "true") await legend.click();
    await page
      .locator(".pm-legend")
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
    const enter = page.getByRole("link", { name: `Wejdź do gry — ${name}`, exact: true });
    await expect(enter).toHaveAttribute("href", `/?continent=${continent}`);
    await expect.poll(() => saves(page)).toEqual(before);
    await enter.click();
    await expect(page.getByRole("status")).toContainText(name);
    await expect(page.locator(".ki-origin-detail")).toHaveAttribute(
      "data-selected-race",
      WORLDS[continent].race,
    );
    await expect.poll(() => saves(page)).toEqual(before);
    await page.reload();
    await expect(page.getByRole("status")).toContainText(name);
    await expect.poll(() => saves(page)).toEqual(before);
    await page.getByRole("button", { name: /Twoje postacie/ }).click();
    await expect(page.getByRole("button", { name: "Kontynuuj podróż", exact: true })).toHaveCount(
      continent === "verdant" ? 1 : 0,
    );
    await page.getByRole("button", { name: "Utwórz nową postać", exact: true }).click();
    for (const [world, other] of regions) {
      const choose = page.getByRole("button", { name: `Wybierz: ${other}`, exact: true });
      if (world === continent) await expect(choose).toBeEnabled();
      else await expect(choose).toBeDisabled();
    }
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const actor = page.locator(".ki-canvas");
    await expect(actor).toHaveAttribute("data-world", continent);
    await expect(page.locator(".ki-hud")).toBeVisible();
    // A new character appears at its land's arrival on the single Superior planet.
    const spawn = superiorArrival(continent);
    await expect
      .poll(async () => Number(await actor.getAttribute("data-player-x")))
      .toBeCloseTo(spawn.x, 0);
    await expect
      .poll(async () => Number(await actor.getAttribute("data-player-y")))
      .toBeCloseTo(spawn.y, 0);
    await leaveGame(page);
    const after = await saves(page);
    for (const [key, value] of Object.entries(before).filter(([key]) =>
      key.includes(":character:"),
    ))
      expect(after[key]).toBe(value);
    expect(Object.keys(after).filter((key) => key.includes(":character:"))).toHaveLength(2);
    await page.goBack();
    await expect(page).toHaveURL(/\/mapa$/);
    await expect.poll(() => saves(page)).toEqual(after);
    await page.screenshot({ path: info.outputPath(`${continent}-map-return.png`) });
    await page.goto(`/?continent=${continent}`);
    await expect(page.getByRole("status")).toContainText(name);
    await expect.poll(() => saves(page)).toEqual(after);
  });
}

test("continent roster filters all four origins without changing any slot, including mobile carousel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [, race] of regions) {
    await create(page, race);
    await leaveGame(page);
  }
  const before = await saves(page);
  for (const [continent, race, name] of regions) {
    await page.goto(`/?continent=${continent}`);
    await expect(page.getByRole("status")).toContainText(name);
    await expect(page.getByRole("button", { name: "Następna rasa", exact: true })).toBeDisabled();
    await page.getByRole("region", { name: "Cztery rasy" }).press("ArrowRight");
    await expect(page.locator(".ki-origin-detail")).toHaveAttribute(
      "data-selected-race",
      WORLDS[continent].race,
    );
    await page.getByRole("button", { name: /Twoje postacie/ }).click();
    await expect(page.locator(".ki-slot")).toHaveCount(1);
    await expect(page.locator(".ki-slot")).toContainText(race);
    await expect.poll(() => saves(page)).toEqual(before);
  }
});

test("home navigation clears continent intent without creating a character", async ({ page }) => {
  await page.goto("/?continent=aether");
  await expect(page.getByRole("status")).toContainText("Aetheria");
  const before = await saves(page);
  await page.getByRole("link", { name: "Ki Legends — początek", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status")).toHaveCount(0);
  for (const [, race] of regions)
    await expect(page.getByRole("button", { name: `Wybierz: ${race}`, exact: true })).toBeEnabled();
  await expect.poll(() => saves(page)).toEqual(before);
});
