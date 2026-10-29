import { test, expect, openHudTool, type Page } from "./fixtures";

async function clickWorld(page: Page, x: number, y: number) {
  const canvas = page.locator(".ki-exam-stage .ki-canvas");
  const point = await canvas.evaluate(
    (el, target) => {
      const node = el as HTMLElement,
        b = node.getBoundingClientRect(),
        zoom = Number(node.dataset["cameraZoom"]);
      return {
        x: b.x + (target.x - Number(node.dataset["cameraX"]) - b.width / 2) * zoom + b.width / 2,
        y: b.y + (target.y - Number(node.dataset["cameraY"]) - b.height / 2) * zoom + b.height / 2,
      };
    },
    { x, y },
  );
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await canvas.getAttribute("data-player-x")) - x,
        Number(await canvas.getAttribute("data-player-y")) - y,
      ),
    )
    .toBeLessThan(65);
}
for (const race of ["Planetarni", "Mędrcy", "Androidy", "Legendy"]) {
  test(`new character, trainer and real isolated endurance route: ${race}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    const conversation = page.getByRole("button", { name: "Zamknij rozmowę", exact: true });
    await expect(conversation).toBeVisible();
    await conversation.click();
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    const card = page
      .locator(".ki-development-card")
      .filter({ has: page.getByRole("heading", { name: "Wytrzymałość 0/30" }) });
    await expect(card.getByRole("button", { name: "Egzamin 1 · zasady i trening" })).toBeEnabled();
    await card.getByRole("button", { name: "Egzamin 1 · zasady i trening" }).click();
    await expect(
      page.getByRole("button", { name: "Rozpocznij egzamin", exact: true }),
    ).toBeDisabled();
    const ownerBefore = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([, v]) => {
          try {
            return JSON.parse(v).format === "superior-character";
          } catch {
            return false;
          }
        }),
      ),
    );
    await page.getByRole("button", { name: "Ćwicz bez nagrody", exact: true }).click();
    const trial = page.locator(".ki-exam-stage");
    await expect(trial.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await page.keyboard.press("Escape");
    await expect(trial).toBeVisible();
    for (const p of [
      { x: 230, y: 550 },
      { x: 240, y: 170 },
      { x: 520, y: 130 },
      { x: 810, y: 250 },
    ])
      await clickWorld(page, p.x, p.y);
    const result = page.getByRole("dialog", { name: "Wynik egzaminu", exact: true });
    await expect(result).toContainText("4/4");
    await expect(result).toContainText("błędy: 0");
    await page.screenshot({ path: info.outputPath("actual-endurance-result.png") });
    await result.getByRole("button", { name: "Zatwierdź wynik i wróć", exact: true }).click();
    await expect(trial).toHaveCount(0);
    const ownerAfter = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([, v]) => {
          try {
            return JSON.parse(v).format === "superior-character";
          } catch {
            return false;
          }
        }),
      ),
    );
    expect(ownerAfter).toEqual(ownerBefore);
    await expect(page.getByRole("dialog", { name: "Rozwój postaci", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    expect(errors).toEqual([]);
  });
}

test.describe("touch development", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("portrait selection, landscape training and simultaneous joystick + attack", async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: Androidy", exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("portrait-rotation-guard.png") });
    await page.setViewportSize({ width: 852, height: 393 });
    const owner = page.locator(".ki-canvas").first();
    await expect(owner).toHaveAttribute("data-player-x", /^\d/);
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).tap();
    await expect(owner).toHaveAttribute("data-interior", "arena");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).tap();
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    const strength = page
      .locator(".ki-development-card")
      .filter({ has: page.getByRole("heading", { name: "Siła 0/30" }) });
    await strength.getByRole("button", { name: "Egzamin 1 · zasady i trening" }).tap();
    const before = await owner.getAttribute("data-player-x");
    await page.getByRole("button", { name: "Ćwicz bez nagrody", exact: true }).tap();
    const trial = page.locator(".ki-exam-stage"),
      canvas = trial.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await expect(trial.getByText("Atakuj", { exact: true })).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    const stick = { id: 11, x: 85, y: 270 },
      // Diagonal input stays clear of the real right-hand obstacle at (700, 360).
      moved = { id: 11, x: 120, y: 250 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [stick] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [moved] });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-joystick-x")))
      .toBeGreaterThan(10);
    const attack = await trial.locator('[data-ability="R"]').boundingBox();
    expect(attack).not.toBeNull();
    const finger = { id: 12, x: attack!.x + attack!.width / 2, y: attack!.y + attack!.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [moved, finger],
    });
    // Chromium CDP releases the listed changed contact. Release the attack finger;
    // listing `moved` would release the joystick and could pass on a stale Canvas frame.
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [finger] });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-joystick-x")))
      .toBeGreaterThan(10);
    await expect(trial.locator(".ki-exam-toolbar")).toContainText("1/3");
    const afterAttack = Number(await canvas.getAttribute("data-player-x"));
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeGreaterThan(afterAttack + 12);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await expect.poll(async () => Number(await canvas.getAttribute("data-joystick-x"))).toBe(0);
    await page.screenshot({ path: info.outputPath("actual-multitouch-trial.png") });
    await trial.getByRole("button", { name: "Wyjdź z próby", exact: true }).tap();
    await expect(trial).toHaveCount(0);
    await expect(owner).toHaveAttribute("data-player-x", before!);
    expect(errors).toEqual([]);
  });
});
