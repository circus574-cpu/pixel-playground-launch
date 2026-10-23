import { test, expect, type Page } from "./fixtures";

type Metrics = {
  sampleAtMs: number;
  renderer: string;
  objects: number;
  textures: number;
  estimatedTextureBytes: number;
};
async function metrics(page: Page) {
  const canvas = page.locator(".ki-canvas");
  let value: Metrics | null = null;
  const old = await canvas.getAttribute("data-metrics");
  const oldAt = old ? (JSON.parse(old) as Metrics).sampleAtMs : -1;
  await expect
    .poll(async () => {
      const text = await canvas.getAttribute("data-metrics");
      value = text ? (JSON.parse(text) as Metrics) : null;
      return value?.sampleAtMs ?? -1;
    })
    .toBeGreaterThan(oldAt);
  return value! as Metrics;
}
test("Verdantia software WebGL: actual chest interiors release resources on each return", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/scripts/playtest.html");
  await page.getByRole("button", { name: "Wybierz: Planetarni", exact: true }).click();
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  const canvas = page.locator(".ki-canvas");
  await expect(canvas).toHaveAttribute("data-enemies", "[]");
  await page.getByRole("button", { name: "Plan miasta", exact: true }).click();
  await page.getByRole("button", { name: /Południowa aleja.*Depozyt Korzeni/ }).click();
  await expect(canvas).toHaveAttribute("data-interior", "depot");
  await page.getByRole("button", { name: "Wyjdź do miasta", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-interior", "outside");
  const baseline = await metrics(page);
  expect(baseline.renderer).toBe("WebGL");
  const samples = [baseline];
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Wejdź · Depozyt Korzeni", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "depot");
    await page.getByRole("button", { name: "Otwórz swoją skrzynię", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Twoja skrzynia", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zamknij skrzynię", exact: true }).click();
    if (i === 0) await page.screenshot({ path: info.outputPath("city-webgl-depot-390.png") });
    await page.getByRole("button", { name: "Wyjdź do miasta", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "outside");
    const sample = await metrics(page);
    samples.push(sample);
    expect(sample.textures).toBe(baseline.textures);
    expect(sample.objects).toBe(baseline.objects);
    expect(sample.estimatedTextureBytes).toBe(baseline.estimatedTextureBytes);
    expect(sample.estimatedTextureBytes).toBeLessThan(128 * 1024 * 1024);
  }
  await page.screenshot({ path: info.outputPath("city-webgl-outside-390.png") });
  await info.attach("city-room-resource-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
