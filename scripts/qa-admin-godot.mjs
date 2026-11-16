// Drives the real /admin page, tab "Gra Android": publish a release from the browser, activate it, set maintenance, inspect and delete a save.
// Run by scripts/godot/qa_admin_ui.py against the real game server (7420) and Vite (5191).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const app = process.env.QA_APP ?? "http://127.0.0.1:5191";
const out = process.env.KI_QA_OUTPUT ?? "test-results/admin-godot";
mkdirSync(out, { recursive: true });

// two small packs and their manifest
const dir = mkdtempSync(path.join(tmpdir(), "godot-release-"));
const files = [];
const packs = {};
for (const [name, text] of [
  ["core", "core-bytes-".repeat(200)],
  ["land-pyra", "pyra-bytes-".repeat(500)],
]) {
  const bytes = Buffer.from(text);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const file = `${name}-${sha.slice(0, 12)}.pck`;
  writeFileSync(path.join(dir, file), bytes);
  files.push(path.join(dir, file));
  packs[name] = { file, bytes: bytes.length, sha256: sha };
}
writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify({
    format: "ki-godot-content-1",
    version: "2026.test.1",
    packs,
    lands: { pyra: ["land-pyra", "core"] },
  }),
);
files.push(path.join(dir, "manifest.json"));

// a player's save through the API, so the saves table has a row
const login = async (email, password) =>
  await (
    await fetch(app + "/ws/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  ).json();
const player = await login("e2egracz@example.com", "haslo-e2e-12345");
const save = {
  format: "ki-godot-pyra-save-2",
  version: 2,
  race: "sage",
  land: "aether",
  room: "",
  position: [100, 100],
  cityReturn: [100, 100],
  kit: { level: 7, xp: 1, learned: ["R"], slots: [], hp: 1, ki: 1 },
};
const put = await fetch(app + "/ws/godot/saves/1", {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + player.accessToken },
  body: JSON.stringify({ baseRevision: 0, save }),
});
assert.equal(put.status, 200, "player save accepted");

const browser = await chromium.launch(
  process.env.KI_CHROMIUM
    ? { executablePath: process.env.KI_CHROMIUM, args: ["--no-sandbox"] }
    : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => void d.accept());
try {
  await page.goto(app + "/konto");
  await page.getByLabel("E-mail").fill("e2eadmin@example.com");
  await page.getByLabel("Hasło").fill("haslo-e2e-12345");
  await page.getByRole("button", { name: "Zaloguj" }).click();
  await page.getByRole("heading", { name: "Twoje konto" }).waitFor();
  await page.goto(app + "/admin");
  await page.getByRole("tab", { name: "Gra Android" }).click();
  await page.getByText("Stan gry Android").waitFor();
  await page.getByText("Brak wydań").waitFor();
  await page.screenshot({ path: `${out}/1-empty.png`, fullPage: true });

  await page.locator('input[type="file"]').setInputFiles(files);
  await page.getByPlaceholder("Notatka (opcjonalnie)").fill("test z przeglądarki");
  await page.getByRole("button", { name: /Wyślij wydanie/ }).click();
  await page.getByText(/zarejestrowane/).waitFor({ timeout: 30000 });
  await page.getByRole("cell", { name: "2026.test.1" }).waitFor();
  await page.getByRole("button", { name: "Aktywuj" }).click();
  await page.getByText("(aktywne)").waitFor();
  const status1 = await (await fetch(app + "/ws/godot/status")).json();
  assert.equal(status1.activeVersion, "2026.test.1");

  await page.getByLabel(/Minimalna wersja/).fill("5");
  await page.getByLabel(/Tryb serwisowy/).check();
  await page.getByLabel(/Komunikat serwisowy/).fill("Przerwa techniczna");
  await page.getByRole("button", { name: "Zapisz ustawienia" }).click();
  await page.getByText("Zapisano ustawienia.").waitFor();
  const status2 = await (await fetch(app + "/ws/godot/status")).json();
  assert.equal(status2.maintenance, true);
  assert.equal(status2.minClientCode, 5);
  const blocked = await fetch(app + "/ws/godot/manifest?client=9");
  assert.equal(blocked.status, 503);
  await page.screenshot({ path: `${out}/2-published.png`, fullPage: true });

  await page.getByPlaceholder("Szukaj: nick lub e-mail").fill("e2egracz");
  await page.getByRole("cell", { name: /Mędrzec, poz\. 7/ }).waitFor();
  await page.getByRole("button", { name: "Podgląd JSON" }).click();
  await page.getByText("ki-godot-pyra-save-2").waitFor();
  await page.screenshot({ path: `${out}/3-saves.png`, fullPage: true });
  await page.getByRole("button", { name: "Usuń" }).last().click();
  await page.getByText("Brak zapisów.").waitFor();
  // the audit tab lists the actions in Polish
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByText("Android: nowe wydanie treści").first().waitFor();
  assert.deepEqual(errors, [], "no page errors");
  console.log("ADMIN UI PASS");
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  console.error("ADMIN UI FAIL", error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
