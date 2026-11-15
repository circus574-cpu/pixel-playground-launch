const { mkdirSync } = require("fs");
mkdirSync("qa-out/shots", { recursive: true });
// Player walkthrough, part A (usage: node scripts/qa/playthrough/join.cjs Planetarni Gracz1 gracz1@example.com): land on the home page, register in the embedded panel, activate by e-mail link, choose a race, enter the game.
const { chromium } = require("playwright");
const APP = "http://127.0.0.1:5190",
  MAIL = "http://127.0.0.1:7461/";
const RACE = process.argv[2] || "Planetarni",
  NICK = process.argv[3] || "Gracz1",
  EMAIL = process.argv[4] || "gracz1@example.com";
(async () => {
  const b = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    storageState: undefined,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERR " + e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/hydrat/i.test(m.text()))
      errs.push("CONSOLE " + m.text().slice(0, 200));
  });
  const shot = (n) => page.screenshot({ path: `qa-out/shots/join-${NICK}-${n}.png` });
  await page.goto(APP + "/", { waitUntil: "load" });
  await page.waitForSelector(".ki-landing", { timeout: 60000 });
  console.log("1 landing visible; races:", await page.locator(".ki-landing-race").count());
  // register in the embedded panel (without consent first: must be refused)
  const form = page.locator(".ki-landing-join form");
  await form.getByLabel("Nick w grze").fill(NICK);
  await form.getByLabel("E-mail").fill(EMAIL);
  await form.getByLabel("Hasło").fill("haslo-12345");
  await page.evaluate(() => {
    const c = document.querySelector(".ki-landing-join [name=zgoda]");
    c.removeAttribute("required");
  });
  await form.getByRole("button", { name: "Załóż konto" }).click();
  await page.getByRole("alert").waitFor();
  console.log("2 without consent ->", await page.getByRole("alert").textContent());
  await form.getByLabel(/Akceptuję/).check();
  await form.getByRole("button", { name: "Załóż konto" }).click();
  await page.getByText("Sprawdź skrzynkę e-mail").waitFor({ timeout: 30000 });
  console.log("3 registered, mail notice shown");
  await shot("1-registered");
  // login before activation is refused
  await form.getByLabel("E-mail").fill(EMAIL);
  await form.getByLabel("Hasło").fill("haslo-12345");
  await form.getByRole("button", { name: "Zaloguj" }).click();
  await page.getByText(/nie jest aktywne/i).waitFor({ timeout: 30000 });
  console.log("4 login before activation refused");
  const mail = await (await fetch(MAIL)).json();
  console.log("   mail to", mail.to, "link has aktywacja:", /aktywacja=/.test(mail.link || ""));
  await page.goto(mail.link.replace(/^https?:\/\/[^/]+/, APP), { waitUntil: "load" });
  await page.getByText("Konto aktywne").waitFor({ timeout: 30000 });
  console.log(
    "5 activated by link, signed in; /konto says:",
    await page.locator(".ki-account-ok").textContent(),
  );
  await shot("2-activated");
  await page.goto(APP + "/?ki-debug=1", { waitUntil: "load" });
  await page
    .getByRole("button", { name: "Wybierz: " + RACE, exact: true })
    .waitFor({ timeout: 60000 });
  await shot("3-selection");
  await page.getByRole("button", { name: "Wybierz: " + RACE, exact: true }).click();
  console.log(
    "6 race detail has biography:",
    await page.locator(".ki-origin-bio summary").textContent(),
  );
  await page.locator(".ki-origin-bio summary").click();
  await shot("4-bio");
  const nick = page.locator("#ki-nick-input");
  if (await nick.count()) await nick.fill(NICK);
  await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
  await page.locator(".ki-hud").waitFor({ timeout: 180000 });
  await page.waitForTimeout(6000);
  await shot("5-ingame");
  console.log(
    "7 in game, HUD:",
    (await page.locator(".ki-hud").innerText()).replace(/\s+/g, " ").slice(0, 160),
  );
  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 4)));
  await ctx.storageState({ path: `qa-out/state-${NICK}.json` });
  await b.close();
})().catch((e) => {
  console.log("FAILED", e.message.split("\n")[0]);
  process.exit(1);
});
