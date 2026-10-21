import { test, expect } from "./fixtures";
import { WORLDS } from "../src/game/world/worlds";
import type { Command } from "../src/game/session";

for (const [race, worldId, actor] of [
  ["Planetarni", "verdant", "hero-planetary"],
  ["Mędrcy", "aether", "hero-sage"],
] as const) {
  test(`${actor}: all seven clips follow real combat, defeat and respawn`, async ({
    page,
  }, info) => {
    await page.goto("/scripts/playtest.html?ki-hero-art=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas");
    await expect(canvas).toHaveAttribute("data-actor-visual", actor);
    await expect(canvas).toHaveAttribute("data-animation-state", "idle");
    await canvas.evaluate((el) => {
      const frames = new Set<string>();
      const capture = () => frames.add((el as HTMLElement).dataset["animationFrame"] ?? "");
      capture();
      new MutationObserver(capture).observe(el, {
        attributes: true,
        attributeFilter: ["data-animation-frame"],
      });
      (window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames = frames;
    });
    const command = async (detail: Command) =>
      canvas.evaluate(
        (el, detail) => el.dispatchEvent(new CustomEvent("ki:command", { detail })),
        detail,
      );
    await page.getByRole("button", { name: "Tarcza ducha", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-animation-state", "skill");
    const world = WORLDS[worldId],
      enemy = world.enemies[0]!;
    await command({ type: "move", x: enemy.x, y: enemy.y + 85 });
    await expect(page.getByRole("meter", { name: "Zdrowie", exact: true })).not.toHaveAttribute(
      "aria-valuenow",
      "120",
    );
    await command({ type: "ability", ability: "attack" });
    await expect
      .poll(() =>
        page.evaluate(() =>
          [
            ...(window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames,
          ].some((f) => f.includes("/attack/")),
        ),
      )
      .toBe(true);
    await command({ type: "cancel" });
    await expect(page.locator(".ki-death-overlay")).toBeVisible({ timeout: 60000 });
    await expect(canvas).toHaveAttribute("data-animation-state", "death");
    await expect(page.locator(".ki-death-overlay")).toHaveCount(0, { timeout: 6000 });
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-x")))
      .toBeCloseTo(world.spawn.x, 0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-player-y")))
      .toBeCloseTo(world.spawn.y, 0);
    const frames = await page.evaluate(() => [
      ...(window as unknown as { __observedActorFrames: Set<string> }).__observedActorFrames,
    ]);
    for (const state of ["idle", "walk", "attack", "skill", "hit", "death", "respawn"])
      expect(
        frames.some((frame) => frame.startsWith(`${actor}/${state}/`)),
        state,
      ).toBe(true);
    await info.attach("observed-real-animation-frames", {
      body: JSON.stringify({ actor, frames }),
      contentType: "application/json",
    });
    await page.screenshot({ path: info.outputPath(`${actor}-respawn.png`) });
  });
}
