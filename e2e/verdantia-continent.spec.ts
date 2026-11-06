import { test, expect, openHudTool, patchActiveCharacter } from "./fixtures";

test.use({ viewport: { width: 1600, height: 1000 } });
test("Verdantia continent: actual city, wilderness streaming, touch, reload and live PvE", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  // SwiftShader validates the phone viewport; Canvas also covers the large desktop and all biomes.
  if (info.project.name === "software-webgl")
    await page.setViewportSize({ width: 852, height: 393 });
  const errors: string[] = [],
    missing: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/game/") && r.status() >= 400) missing.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(
    "/scripts/playtest.html?ki-world-v2=1&ki-verdant-continent=1&ki-test-spawn=verdant-mchowy-szlamak",
  );
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const stage = page.locator(".ki-canvas").first(),
    canvas = stage.locator("canvas");
  await expect(stage).toHaveAttribute("data-player-x", /^\d/);
  await expect(canvas).toHaveAttribute("data-verdantia-continent", "true");
  await expect(canvas).toHaveAttribute("data-verdantia-extra", "true");
  await expect(canvas).toHaveAttribute("data-superior-pending", "0");
  expect(JSON.parse((await stage.getAttribute("data-metrics"))!).renderer).toBe(
    info.project.name === "software-webgl" ? "WebGL" : "Canvas",
  );
  const cityX = Number(await stage.getAttribute("data-player-x")),
    cityY = Number(await stage.getAttribute("data-player-y"));
  await page.screenshot({ path: info.outputPath("verdantia-city-preserved.png") });
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
  await walk(49296, 33700);
  await walk(49424, 33000);
  await page.screenshot({ path: info.outputPath("verdantia-forest-road.png") });
  // Valid local QA saves place the hero on navigable ground in biomes and by existing landmarks.
  // No runtime entities, colliders or spawn slots are replaced by the fixture.
  const scenes = [
    { name: "deep-forest", x: 45328, y: 35760 },
    { name: "highlands", x: 49232, y: 28688 },
    { name: "wetland", x: 43344, y: 40144 },
    { name: "camp", x: 52516, y: 32904 },
    { name: "spring", x: 47716, y: 39804 },
  ];
  for (const scene of info.project.name === "software-webgl" ? [] : scenes) {
    await patchActiveCharacter(
      page,
      { x: scene.x, y: scene.y },
      "ki-legends:adventure:v1:superior-world-v2",
    );
    await expect(canvas).toHaveAttribute("data-superior-pending", "0");
    await expect(stage).toHaveAttribute("data-player-x", String(scene.x));
    await page.screenshot({ path: info.outputPath(`verdantia-${scene.name}.png`) });
  }
  await patchActiveCharacter(
    page,
    { x: cityX, y: cityY },
    "ki-legends:adventure:v1:superior-world-v2",
  );
  await walk(cityX, cityY + 1008);
  type Foe = { id: string; hp: number; x: number; y: number };
  const foes = async () => JSON.parse((await stage.getAttribute("data-enemies")) ?? "[]") as Foe[];
  await expect
    .poll(async () => (await foes()).some((e) => e.id === "verdant-test-spawn"), { timeout: 60000 })
    .toBe(true);
  const foe = (await foes()).find((e) => e.id === "verdant-test-spawn")!;
  await command({ type: "target", id: foe.id });
  await expect
    .poll(async () => (await foes()).find((e) => e.id === foe.id)?.hp ?? 0, { timeout: 30000 })
    .toBeLessThan(foe.hp);
  await page.setViewportSize({ width: 852, height: 393 });
  await openHudTool(page, "Oddal mapę");
  await expect(canvas).toHaveAttribute("data-superior-pending", "0");
  await page.screenshot({ path: info.outputPath("verdantia-mobile-live-pve.png") });
  expect(Number(await canvas.getAttribute("data-superior-chunks"))).toBeLessThanOrEqual(12);
  await info.attach("verdantia-runtime", {
    body: JSON.stringify({ metrics: await stage.getAttribute("data-metrics"), errors, missing }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
