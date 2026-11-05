import { test, expect, patchActiveCharacter, openHudTool } from "./fixtures";
test.use({ viewport: { width: 1600, height: 1000 } });
test("Pyra: real terrain, city, ambient graphics, streaming, reload and PvE", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  if (info.project.name === "software-webgl")
    await page.setViewportSize({ width: 852, height: 393 });
  const scenes: unknown[] = [];
  const errors: string[] = [],
    missing: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/game/") && r.status() >= 400) missing.push(r.status() + " " + r.url());
  });
  await page.goto(
    "/scripts/playtest.html?ki-world-v2=1&ki-pyra-continent=1&ki-test-spawn=pyra-ognista-salamandra",
  );
  await page.getByRole("button", { name: "Wybierz: Legendy", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const stage = page.locator(".ki-canvas").first(),
    canvas = stage.locator("canvas");
  await expect(stage).toHaveAttribute("data-player-x", /^\d/);
  await expect(canvas).toHaveAttribute("data-pyra-continent", "true");
  await expect(canvas).toHaveAttribute("data-superior-pending", "0");
  expect(JSON.parse((await stage.getAttribute("data-metrics"))!).renderer).toBe(
    info.project.name === "software-webgl" ? "WebGL" : "Canvas",
  );
  const start = {
    x: Number(await stage.getAttribute("data-player-x")),
    y: Number(await stage.getAttribute("data-player-y")),
  };
  await page.screenshot({ path: info.outputPath("pyra-city.png") });
  const command = (detail: object) =>
    stage.evaluate(
      (el, d) => el.dispatchEvent(new CustomEvent("ki:command", { detail: d })),
      detail,
    );
  const walk = async (x: number, y: number) => {
    await command({ type: "move", x, y });
    await expect
      .poll(
        async () =>
          Math.hypot(
            Number(await stage.getAttribute("data-player-x")) - x,
            Number(await stage.getAttribute("data-player-y")) - y,
          ),
        { timeout: 90000 },
      )
      .toBeLessThan(65);
    await expect(canvas).toHaveAttribute("data-superior-pending", "0");
  };
  await walk(start.x, start.y + 1000);
  await page.screenshot({ path: info.outputPath("pyra-wilderness.png") });
  if (info.project.name !== "software-webgl")
    for (const p of [
      { name: "ash", x: 44048, y: 12528 },
      { name: "basalt", x: 47376, y: 15472 },
      { name: "volcanic", x: 46224, y: 11184 },
      { name: "canyon", x: 48784, y: 15472 },
    ]) {
      await patchActiveCharacter(
        page,
        { x: p.x, y: p.y },
        "ki-legends:adventure:v1:superior-world-v2",
      );
      await expect(canvas).toHaveAttribute("data-superior-pending", "0");
      await expect(stage).toHaveAttribute("data-player-x", String(p.x));
      scenes.push({ ...p, y: await stage.getAttribute("data-player-y") });
      await page.screenshot({ path: info.outputPath("pyra-" + p.name + ".png") });
    }
  await patchActiveCharacter(page, start, "ki-legends:adventure:v1:superior-world-v2");
  await walk(start.x, start.y + 1000);
  type Foe = { id: string; hp: number; x: number; y: number };
  const foes = async () => JSON.parse((await stage.getAttribute("data-enemies")) ?? "[]") as Foe[];
  await expect
    .poll(async () => (await foes()).some((f) => f.id === "pyra-test-spawn"), { timeout: 60000 })
    .toBe(true);
  const foe = (await foes()).find((f) => f.id === "pyra-test-spawn")!;
  await command({ type: "target", id: foe.id });
  await expect
    .poll(async () => (await foes()).find((f) => f.id === foe.id)?.hp ?? 0, { timeout: 30000 })
    .toBeLessThan(foe.hp);
  await page.setViewportSize({ width: 852, height: 393 });
  await openHudTool(page, "Oddal mapę");
  await expect(canvas).toHaveAttribute("data-superior-pending", "0");
  await page.screenshot({ path: info.outputPath("pyra-mobile-pve.png") });
  expect(Number(await canvas.getAttribute("data-superior-chunks"))).toBeLessThanOrEqual(12);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await info.attach("pyra-runtime", {
    body: JSON.stringify({
      scenes,
      errors,
      missing,
      metrics: await stage.getAttribute("data-metrics"),
    }),
    contentType: "application/json",
  });
});
