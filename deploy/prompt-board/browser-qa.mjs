import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { scryptSync } from "node:crypto";
import sharp from "sharp";
import { makeBoard } from "./server.mjs";

const root = await fs.mkdtemp(path.join(tmpdir(), "board-browser-"));
const evidence = process.env.BOARD_QA_OUTPUT || "/tmp/ki-board-qa";
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
  catalogFile: path.resolve("docs/design/development-prompts/prompts.json"),
  secure: false,
  origin,
};
let server = await makeBoard(config);
await new Promise((r) => server.listen(4198, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const errors = [],
  results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(origin + "/prompty/");
  await page.getByLabel("E-mail", { exact: true }).fill("local@example.test");
  await page.getByLabel("Hasło", { exact: true }).fill("local-browser-test");
  await page.getByRole("button", { name: "Wejdź", exact: true }).click();
  await page.locator("#board").waitFor({ state: "visible" });
  if ((await page.locator("article").count()) !== 6)
    throw Error("Start list must contain exactly six prompts");
  results.push("Login + actual 665-prompt catalogue, initial six-item batch");
  const card = page.locator('[data-prompt="training.planetary.dummy"]');
  await card.getByRole("button", { name: "Kopiuj prompt", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (!copied.includes("practice dummy")) throw Error("Wrong copied prompt");
  results.push("Copy prompt through browser clipboard");
  const image = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 50, g: 120, b: 70, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await card
    .locator("input[type=file]")
    .setInputFiles({ name: "dummy-test.png", mimeType: "image/png", buffer: image });
  await card.locator(".badge.done").waitFor();
  await card.getByRole("link", { name: "dummy-test.png" }).waitFor();
  await page.reload();
  await page.locator('[data-prompt="training.planetary.dummy"] .badge.done').waitFor();
  results.push("Real upload + completion badge + image preview + persistence after reload");
  await new Promise((r) => server.close(r));
  server = await makeBoard(config);
  await new Promise((r) => server.listen(4198, "127.0.0.1", r));
  await page.reload();
  await page.locator('[data-prompt="training.planetary.dummy"] .badge.done').waitFor();
  results.push("Persistent progress after actual server restart");
  await page
    .locator('[data-prompt="training.planetary.dummy"]')
    .getByRole("button", { name: "Oznacz do poprawy" })
    .click();
  await page.locator('[data-prompt="training.planetary.dummy"] .badge.revision').waitFor();
  if ((await page.getByRole("link", { name: "dummy-test.png" }).count()) !== 1)
    throw Error("Revision removed original");
  results.push("Revision status preserves the original asset");
  await page.locator("#priority").selectOption("ANIM");
  await page.locator("#search").fill("npc.aira.walk.down");
  const clip = page.locator('[data-prompt="npc.aira.walk.down"]');
  await clip.waitFor();
  const clips = [];
  for (let i = 0; i < 8; i++)
    clips.push({
      name: `frame-${i}.png`,
      mimeType: "image/png",
      buffer: await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 4,
          background: { r: i * 20, g: 100, b: 80, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    });
  await clip.locator("input[type=file]").setInputFiles(clips.slice(0, 1));
  await page.getByRole("status").filter({ hasText: "Dokończ komplet klatek" }).waitFor();
  if (await clip.locator(".badge.done").count())
    throw Error("Single frame falsely completed eight-frame clip");
  await clip.locator("input[type=file]").setInputFiles(clips.slice(1));
  await clip.locator(".badge.done").waitFor();
  results.push("Animation: one frame stays pending, eight actual uploaded frames complete clip");
  await page.locator("#priority").selectOption("START");
  await page.locator("#search").fill("");
  const audioCard = page.locator('[data-prompt="audio.development.dummy-hit"]');
  await audioCard
    .locator("input[type=file]")
    .setInputFiles({ name: "wrong.png", mimeType: "image/png", buffer: image });
  await page.getByRole("status").filter({ hasText: "Ten prompt wymaga" }).waitFor();
  if (await audioCard.locator(".badge.done").count())
    throw Error("Wrong file type falsely completed audio");
  const wav = Buffer.alloc(44 + 1600);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(1600, 40);
  await audioCard
    .locator("input[type=file]")
    .setInputFiles({ name: "test-sound.wav", mimeType: "audio/wav", buffer: wav });
  await audioCard.locator(".badge.done").waitFor();
  await audioCard.locator("audio").waitFor();
  results.push("Wrong media rejected; real WAV upload, completion and audio control");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz postęp JSON" }).click();
  const dl = await download;
  const data = JSON.parse(await fs.readFile(await dl.path(), "utf8"));
  if (!data.prompts["audio.development.dummy-hit"]) throw Error("Export missing progress");
  results.push("Progress export downloaded through browser");
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 852, height: 393 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error("Horizontal overflow " + JSON.stringify(viewport));
    await page.screenshot({
      path: path.join(evidence, `board-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });
  }
  results.push("No horizontal overflow at 360/390/414 portrait, 852 landscape and 1280 desktop");
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await touch.newPage();
  await mobile.goto(origin + "/prompty/");
  await mobile.getByLabel("E-mail", { exact: true }).fill("local@example.test");
  await mobile.getByLabel("Hasło", { exact: true }).fill("local-browser-test");
  await mobile.getByRole("button", { name: "Wejdź", exact: true }).tap();
  await mobile.locator("#board").waitFor({ state: "visible" });
  await mobile.locator("#priority").selectOption("P1");
  await mobile.locator("article").first().getByRole("button", { name: "Kopiuj prompt" }).tap();
  await mobile.screenshot({ path: path.join(evidence, "touch-390.png") });
  await touch.close();
  results.push("Emulated touch: login tap, filter change, copy tap (not physical Android proof)");
  await page.getByRole("button", { name: "Wyloguj", exact: true }).click();
  await page.locator("#login").waitFor({ state: "visible" });
  const denied = await page.request.get(origin + "/prompty/api/prompts");
  if (denied.status() !== 401) throw Error("Logout failed");
  results.push("Logout revokes browser access");
  if (errors.length) throw Error(errors.join("\n"));
  await context.tracing.stop({ path: path.join(evidence, "trace.zip") });
  await fs.writeFile(
    path.join(evidence, "results.json"),
    JSON.stringify(
      {
        results,
        pageErrors: errors,
        physicalPhone: "NOT TESTED",
        source: "local actual server and browser",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: results.length, results, pageErrors: errors, evidence }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await fs.rm(root, { recursive: true, force: true });
}
