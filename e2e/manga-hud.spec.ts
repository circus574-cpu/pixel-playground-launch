import { test, expect, patchActiveCharacter, basicAttack } from "./fixtures";
import { KIT_NODES, canLearn, validLearned } from "../src/game/kit";
import { WORLDS } from "../src/game/world/worlds";

for (const width of [390, 1280]) {
  test(`manga HUD in Pyra smithy ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: "Wybierz: Legendy", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-hud")).toBeVisible();
    await page.getByRole("button", { name: "Plan miasta", exact: true }).click();
    const smithy = WORLDS.pyra.city!.buildings.find((b) => b.id === "smithy")!;
    await page.getByRole("button", { name: new RegExp(smithy.name) }).click();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-interior", "smithy");
    const notice = await page.locator(".ki-notification-rail .ki-game-message").boundingBox();
    const interior = (await page.locator(".ki-city-state").boundingBox())!;
    if (notice) expect(notice.x + notice.width).toBeLessThanOrEqual(interior.x);
    await page.screenshot({ path: info.outputPath(`pyra-smithy-${width}.png`) });
    const exit = page.getByRole("button", { name: "Wyjdź do miasta", exact: true });
    const box = (await exit.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await exit.click();
    await expect(page.locator(".ki-canvas")).toHaveAttribute("data-interior", "outside");
  });
}

for (const [width, height] of [
  [320, 568],
  [360, 640],
  [852, 393],
] as const) {
  test(`complete technique buttons and fixed attack ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto("/scripts/playtest.html");
    await page.getByRole("button", { name: "Wybierz: Legendy", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    await expect(page.locator(".ki-hud")).toBeVisible();
    const learned = ["R"];
    for (const node of KIT_NODES.legend) {
      if (canLearn("legend", 20, learned, node.id).ok) learned.push(node.id);
    }
    expect(validLearned("legend", 20, learned)).toBe(true);
    await patchActiveCharacter(page, { level: 20, skills: learned });
    const bank = page.getByRole("group", { name: "Poznane techniki" });
    const rootBefore = (await basicAttack(page).boundingBox())!;
    const visited = new Set<string>();
    const next = page.getByRole("button", { name: "Następne techniki", exact: true });
    for (let step = 0; step < 20; step++) {
      const buttons = bank.locator(".ki-skill");
      expect(await buttons.count()).toBeLessThanOrEqual(2);
      for (const skill of await buttons.all()) {
        visited.add((await skill.getAttribute("data-ability"))!);
      }
      // Check the real clipping rectangles of every rendered HUD button, not just the viewport.
      const clipped = await page
        .locator(".ki-actionbar button, .ki-menu > button")
        .evaluateAll((buttons) => {
          const problems: string[] = [];
          for (const el of buttons) {
            const box = el.getBoundingClientRect();
            if (
              box.width < 44 ||
              box.height < 44 ||
              box.left < 0 ||
              box.top < 0 ||
              box.right > innerWidth ||
              box.bottom > innerHeight
            )
              problems.push(el.getAttribute("aria-label") ?? "bounds");
            for (let p = el.parentElement; p; p = p.parentElement) {
              const css = getComputedStyle(p),
                clip = p.getBoundingClientRect();
              if (
                (/auto|scroll|hidden|clip/.test(css.overflowX) &&
                  (box.left < clip.left - 1 || box.right > clip.right + 1)) ||
                (/auto|scroll|hidden|clip/.test(css.overflowY) &&
                  (box.top < clip.top - 1 || box.bottom > clip.bottom + 1))
              ) {
                problems.push(
                  (el.getAttribute("aria-label") ?? "button") + " clipped by " + p.className,
                );
              }
            }
          }
          return problems;
        });
      expect(clipped).toEqual([]);
      if (step === 0)
        await page.screenshot({ path: info.outputPath(`complete-techniques-${width}.png`) });
      expect(await basicAttack(page).boundingBox()).toEqual(rootBefore);
      if (await next.isDisabled()) break;
      await next.click();
    }
    // Every learned active skill must appear in a complete page, and navigation must return.
    await page.getByRole("button", { name: "Umiejętności", exact: true }).click();
    const active = await page
      .locator(".ki-skill-node")
      .filter({ hasText: /Aktywna|Ostateczna|Tryb KI/ })
      .count();
    expect(visited.size).toBeGreaterThan(3);
    expect(active).toBeGreaterThanOrEqual(visited.size);
    await page.screenshot({ path: info.outputPath(`skills-window-${width}.png`) });
    await page.getByRole("button", { name: "Zamknij okno", exact: true }).click();
    const previous = page.getByRole("button", { name: "Poprzednie techniki", exact: true });
    for (let i = 0; i < 20 && (await previous.isEnabled()); i++) await previous.click();
    await expect(previous).toBeDisabled();
  });
}
