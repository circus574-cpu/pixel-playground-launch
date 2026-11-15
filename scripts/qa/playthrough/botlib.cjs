// Helpers for the local player walkthrough (see docs/ARCHITEKTURA-I-TESTY.md, "Test gracza"): Playwright with real key
// presses and mouse clicks; the game state is only read (window.__kiGame needs ?ki-debug=1). Output goes to QA_OUT (default ./qa-out).
const { chromium } = require("playwright");
const path = require("path");
const BASE = process.env.QA_BASE || "http://127.0.0.1:5190";
const OUT = path.resolve(process.env.QA_OUT || "qa-out");
exports.OUT = OUT;
require("fs").mkdirSync(path.join(OUT, "shots"), { recursive: true });
exports.BASE = BASE;
exports.launch = async (viewport = { width: 1280, height: 720 }) => {
  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const issues = { http: [], console: [], pageErrors: [] };
  page.on("response", (r) => {
    if (r.status() >= 400)
      issues.http.push(
        `${r.status()} ${r.request().method()} ${r.url().replace(BASE, "").slice(0, 140)}`,
      );
  });
  page.on("console", (m) => {
    if (m.type() === "error") issues.console.push(m.text().replace(/\s+/g, " ").slice(0, 260));
  });
  page.on("pageerror", (e) => issues.pageErrors.push(String(e.message).slice(0, 260)));
  page.on("crash", () => issues.pageErrors.push("PAGE CRASH"));
  return { browser, page, issues };
};
exports.login = async (page, email, pw = "haslo-12345") => {
  await page.goto(BASE + "/konto", { waitUntil: "load" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło").fill(pw);
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await page.getByRole("heading", { name: "Twoje konto" }).waitFor({ timeout: 30000 });
};
const fs = require("fs");
exports.enter = async (page, email) => {
  await exports.login(page, email);
  await page.goto(BASE + "/?ki-debug=1", { waitUntil: "load" });
  await page.getByText("Twoje postacie").first().waitFor({ timeout: 60000 });
  await page.getByText("Twoje postacie").first().click();
  await page.waitForTimeout(500);
  await page
    .getByRole("button", { name: /kontynuuj/i })
    .first()
    .click();
  await page.locator(".ki-hud").waitFor({ timeout: 90000 });
  await page.waitForTimeout(4000);
};
exports.state = (page) =>
  page.evaluate(() => {
    const g = window.__kiGame,
      s = g && g.scene.scenes[0];
    const q = (sel) => {
      const e = document.querySelector(sel);
      return e ? e.innerText.replace(/\s+/g, " ").trim() : "";
    };
    const cam = s.cameras.main,
      wv = cam.worldView;
    const canvas = g.canvas.getBoundingClientRect();
    return {
      t: Date.now(),
      hero: s.hero ? { x: Math.round(s.hero.body.x), y: Math.round(s.hero.body.y) } : null,
      enemies: [...s.enemies.entries()].map(([id, a]) => ({
        id,
        x: Math.round(a.body.x),
        y: Math.round(a.body.y),
        vis: a.body.visible,
        name: a.name && a.name.text,
        hp:
          a.bar && a.track
            ? Math.round((100 * a.bar.displayWidth) / (a.track.displayWidth || 1))
            : null,
        anim: a.animation && (a.animation.name || a.animation.key || a.animation.clip),
      })),
      npcs: [...s.npcMap.values()].map((n) => ({
        id: n.id,
        name: n.name,
        x: Math.round(n.x),
        y: Math.round(n.y),
      })),
      level: Number(q(".ki-level")) || 0,
      hpNow: Number(
        (document.querySelector(".ki-hp") || { getAttribute() {} }).getAttribute("aria-valuenow"),
      ),
      hpMax: Number(
        (document.querySelector(".ki-hp") || { getAttribute() {} }).getAttribute("aria-valuemax"),
      ),
      kiNow: Number(
        (document.querySelector(".ki-energy") || { getAttribute() {} }).getAttribute(
          "aria-valuenow",
        ),
      ),
      xp: (
        (
          document.querySelector(".ki-xp") || {
            getAttribute() {
              return "";
            },
          }
        ).getAttribute("aria-label") || ""
      ).replace("Doświadczenie ", ""),
      quest: q(".ki-quest"),
      loc: q(".ki-location"),
      dialog: !!document.querySelector("[role=dialog]"),
      target: (g.canvas.parentElement && g.canvas.parentElement.dataset.targetId) || "",
      loot: [...s.loot.entries()].map(([id, c]) => ({
        id,
        x: Math.round(c.x),
        y: Math.round(c.y),
      })),
      overlay: /Sesja serwerowa|Nie udało się otworzyć/.test(document.body.innerText)
        ? document.body.innerText.replace(/\s+/g, " ").slice(0, 220)
        : "",
      potion: (() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          /Mikstura/i.test(x.getAttribute("aria-label") || x.title || ""),
        );
        return b ? Number((b.innerText.match(/\d+/) || [0])[0]) : -1;
      })(),
      cam: {
        x: wv.x,
        y: wv.y,
        zoom: cam.zoom,
        w: wv.width,
        h: wv.height,
        left: canvas.left,
        top: canvas.top,
      },
    };
  });
exports.toScreen = (st, wx, wy) => ({
  x: st.cam.left + (wx - st.cam.x) * st.cam.zoom,
  y: st.cam.top + (wy - st.cam.y) * st.cam.zoom,
});
const logf = path.join(OUT, "bot.log");
exports.log = (...a) => {
  const line =
    new Date().toISOString().slice(11, 19) +
    " " +
    a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(line);
  fs.appendFileSync(logf, line + "\n");
};
// Walk with real WASD key presses; if the hero stops making progress, nudge sideways, then fall back to a click on the ground.
exports.walkTo = async (page, tx, ty, { radius = 70, timeout = 60000, onTick } = {}) => {
  const t0 = Date.now();
  let held = new Set(),
    last = null,
    lastMove = Date.now(),
    nudge = 0;
  const set = async (want) => {
    for (const k of [...held])
      if (!want.has(k)) {
        await page.keyboard.up(k);
        held.delete(k);
      }
    for (const k of want)
      if (!held.has(k)) {
        await page.keyboard.down(k);
        held.add(k);
      }
  };
  try {
    while (Date.now() - t0 < timeout) {
      const st = await exports.state(page);
      if (!st.hero) break;
      if (st.dialog) {
        await set(new Set());
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        continue;
      }
      const dx = tx - st.hero.x,
        dy = ty - st.hero.y,
        d = Math.hypot(dx, dy);
      if (onTick) {
        const stop = await onTick(st, d);
        if (stop) {
          await set(new Set());
          return { ok: false, reason: "tick-stop", st };
        }
      }
      if (d <= radius) {
        await set(new Set());
        return { ok: true, st, d };
      }
      if (!last || Math.hypot(st.hero.x - last.x, st.hero.y - last.y) > 6) {
        last = st.hero;
        lastMove = Date.now();
      }
      let want = new Set();
      if (Math.abs(dx) > 25) want.add(dx > 0 ? "d" : "a");
      if (Math.abs(dy) > 25) want.add(dy > 0 ? "s" : "w");
      if (Date.now() - lastMove > 1500) {
        // stuck: slide around the obstacle
        nudge++;
        want = new Set(nudge % 2 ? [dy > 0 ? "w" : "s"] : [dx > 0 ? "a" : "d"]);
        if (Date.now() - lastMove > 4000) {
          lastMove = Date.now();
        }
      }
      await set(want);
      await page.waitForTimeout(120);
    }
  } finally {
    await set(new Set());
  }
  return { ok: false, reason: "timeout", st: await exports.state(page) };
};
