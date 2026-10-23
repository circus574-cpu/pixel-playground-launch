import { test, expect, openHudTool } from "./fixtures";

for (const [race, world] of [
  ["Mędrcy", "aether"],
  ["Androidy", "nexus"],
] as const) {
  test(`${world} mobile detail rendering stays within budget and releases each scene`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/scripts/playtest.html");
    const samples: {
      textures: number;
      objects: number;
      estimatedTextureBytes: number;
      renderer: string;
    }[] = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      if (cycle)
        await page.getByRole("button", { name: "Utwórz nową postać", exact: true }).click();
      await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
      await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
      const canvas = page.locator(".ki-canvas");
      await expect(canvas).toHaveAttribute("data-world", world);
      await expect(page.locator(".ki-hud")).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(canvas).toHaveAttribute("data-metrics", /.+/);
      // Baked road/zone chunks stream in as the camera settles: sample once the count is stable.
      let metrics = JSON.parse((await canvas.getAttribute("data-metrics"))!);
      for (let tries = 0; tries < 25; tries++) {
        await page.waitForTimeout(1100);
        const next = JSON.parse((await canvas.getAttribute("data-metrics"))!);
        const settled = next.textures === metrics.textures && next.objects === metrics.objects;
        metrics = next;
        if (settled) break;
      }
      expect(metrics.renderer).toBe(info.project.name === "software-webgl" ? "WebGL" : "Canvas");
      expect(metrics.estimatedTextureBytes).toBeLessThan(128 * 1024 * 1024);
      samples.push(metrics);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`${world}-cycle-${cycle}.png`) });
      await openHudTool(page, "Ustawienia");
      await page.getByRole("button", { name: "Zapisz i wybierz postać", exact: true }).click();
      await expect(page.locator("canvas")).toHaveCount(0);
    }
    expect(samples[1]!.textures).toBe(samples[0]!.textures);
    expect(samples[1]!.objects).toBeLessThanOrEqual(samples[0]!.objects + 2);
    await info.attach("scene-resource-samples", {
      body: JSON.stringify(samples),
      contentType: "application/json",
    });
  });
}
