import { chromium, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { scryptSync } from "node:crypto";
import sharp from "sharp";
import { makeBoard } from "./server.mjs";
const root = await fs.mkdtemp(path.join(tmpdir(), "board-remaining-browser-"));
const evidence = process.env.BOARD_QA_OUTPUT || "/tmp/ki-board-remaining-qa";
await fs.mkdir(evidence, { recursive: true });
const authFile = path.join(root, "auth.json");
await fs.writeFile(
  authFile,
  JSON.stringify({
    salt: "browser-fixture",
    hash: scryptSync("local-browser-test", "browser-fixture", 64).toString("hex"),
    sessionKey: "test-session-key",
  }),
);
const origin = "http://127.0.0.1:4198";
const config = {
  dataDir: path.join(root, "data"),
  authFile,
  catalogFile: path.resolve("deploy/prompt-board/prompts.current.json"),
  secure: false,
  origin,
};
const server = await makeBoard(config);
await new Promise((r) => server.listen(4198, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/prompty/");
  await page.getByLabel("E-mail", { exact: true }).fill("local@example.test");
  await page.getByLabel("Hasło", { exact: true }).fill("local-browser-test");
  await page.getByRole("button", { name: "Wejdź", exact: true }).click();
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(6);
  await expect(page.locator("#progress-label")).toContainText("584");
  results.push("Actual refreshed catalogue: 584 remaining requests, six interior samples");
  const id = "interior.planetary.floor",
    card = page.locator(`[data-prompt="${id}"]`);
  await card.getByRole("button", { name: "Kopiuj prompt", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("production texture");
  const image = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 60, g: 100, b: 80, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await card
    .locator("input[type=file]")
    .setInputFiles({ name: "floor-qa.png", mimeType: "image/png", buffer: image });
  await expect(card).toHaveCount(0);
  await expect(page.locator("#progress-label")).toContainText("583");
  await page.reload();
  await expect(page.locator("#board")).toBeVisible();
  await expect(card).toHaveCount(0);
  results.push("Image upload disappears immediately and remains absent after reload");
  await page.locator("#priority").selectOption("ALL");
  await page.locator("#search").fill("npc.aira.idle.down-left");
  const clip = page.locator('[data-prompt="npc.aira.idle.down-left"]');
  const frames = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => ({
      name: `frame-${i}.png`,
      mimeType: "image/png",
      buffer: await sharp({
        create: {
          width: 8 + i,
          height: 8,
          channels: 4,
          background: { r: 50 + i, g: 70, b: 100, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    })),
  );
  await clip.locator("input[type=file]").setInputFiles(frames.slice(0, 1));
  await expect(clip).toBeVisible();
  await expect(clip.locator(".badge")).toContainText("1/8");
  await clip.locator("input[type=file]").setInputFiles(frames.slice(1));
  await expect(clip).toHaveCount(0);
  results.push("Incomplete animation remains; complete eight-frame delivery disappears");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz postęp JSON" }).click();
  const record = JSON.parse(await fs.readFile(await (await dl).path(), "utf8"));
  expect(record.prompts[id].files).toHaveLength(1);
  expect(record.prompts["npc.aira.idle.down-left"].files).toHaveLength(8);
  results.push("Private export retains hidden deliveries and all files");
  await page.locator("#search").fill("");
  await page.locator("#tool").selectOption("ElevenLabs");
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.locator("#empty")).toBeVisible();
  results.push("Completed 41 audio assets are not requested again");
  await page.locator("#tool").selectOption("ALL");
  await page.locator("#priority").selectOption("START");
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 852, height: 393 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: path.join(evidence, `remaining-${viewport.width}x${viewport.height}.png`),
    });
  }
  expect(errors).toEqual([]);
  results.push("Mobile/landscape/desktop layouts and zero pageerror");
  await fs.writeFile(
    path.join(evidence, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ pass: results.length, results, errors }));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await fs.rm(root, { recursive: true, force: true });
}
