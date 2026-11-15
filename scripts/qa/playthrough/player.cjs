// Player bot for Verdantia (planetary race): tutorial quests, town errands through the city plan, hunting by level zones with
// real WASD/Space/Q/F/E presses and mouse clicks. Waypoints and the town position are specific to Verdantia's start city.
// Usage: BOT_EMAIL=... BOT_GOAL=10 node scripts/qa/playthrough/player.cjs   (needs spawns.json from nav-spawns.mts)
// A player bot: real key presses and mouse clicks only; it reads the game state to decide what to press.
const L = require("./botlib.cjs");
const nodePath = require("path");
const spawns = require(
  nodePath.resolve(process.env.QA_SPAWNS || nodePath.join(L.OUT, "spawns.json")),
);
const EMAIL = process.env.BOT_EMAIL || "gracz2@example.com";
const GOAL = Number(process.env.BOT_GOAL || 10);
const REACH = Number(process.env.BOT_REACH || 60);
const MAX_MS = Number(process.env.BOT_MAX_MS || 55 * 60 * 1000);
const HOME = { x: 49100, y: 34950 };
const stats = {
  kills: 0,
  deaths: 0,
  potions: 0,
  loots: 0,
  stuck: 0,
  recover: 0,
  levelUps: [],
  errors: [],
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const LEVELS = new Map();
for (const sp of spawns) LEVELS.set(norm(sp.kind.replace(/^verdant-/, "")), sp.lvl);
const lvlOf = (e) => (LEVELS.has(norm(e.name)) ? LEVELS.get(norm(e.name)) : null);
(async () => {
  const { browser, page, issues } = await L.launch({ width: 960, height: 540 });
  const t0 = Date.now();
  await L.enter(page, EMAIL);
  let st = await L.state(page);
  L.log("START", { hero: st.hero, level: st.level, xp: st.xp, quest: st.quest });
  let held = new Set(),
    lastLevel = st.level,
    lastHeart = 0,
    lastPotion = 0,
    lastAtk = 0,
    lastClick = 0,
    lastF = 0;
  let visited = new Map(),
    goalSpawn = null,
    lastPos = null,
    lastMoveT = Date.now(),
    lastXp = st.xp,
    noKillSince = Date.now();
  const keys = async (want) => {
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
  const steer = (from, to, dead = 30) => {
    const w = new Set();
    if (to.x - from.x > dead) w.add("d");
    if (from.x - to.x > dead) w.add("a");
    if (to.y - from.y > dead) w.add("s");
    if (from.y - to.y > dead) w.add("w");
    return w;
  };
  const clickWorld = async (s, wx, wy) => {
    const p = L.toScreen(s, wx, wy);
    if (p.x < 5 || p.y < 5 || p.x > 955 || p.y > 470) return false;
    await page.mouse.click(p.x, p.y);
    return true;
  };
  const shot = (name) =>
    page
      .screenshot({ path: nodePath.join(L.OUT, "shots", name + ".jpg"), type: "jpeg", quality: 55 })
      .catch(() => {});
  const closeDialogs = async () => {
    for (let i = 0; i < 3; i++) {
      if (!(await L.state(page)).dialog) return;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  };

  // ---- tutorial: Aira -> market -> Aira -> Ren -> hunt 3 -------------------------------------------
  const talkTo = async (npcId) => {
    const s = await L.state(page);
    const n = s.npcs.find((x) => x.id === npcId);
    if (!n) return false;
    await keys(new Set());
    let guard = 0;
    for (;;) {
      const c = await L.state(page);
      if (c.dialog) break;
      const d = dist(c.hero, n);
      if (d <= 95) {
        await keys(new Set());
        await page.keyboard.press("e");
        await page.waitForTimeout(900);
        if ((await L.state(page)).dialog) break;
      } else await keys(steer(c.hero, { x: n.x, y: n.y + 30 }, 25));
      if (guard++ > 400) {
        await keys(new Set());
        return false;
      }
      await page.waitForTimeout(100);
    }
    await keys(new Set());
    return true;
  };
  const clickBtn = async (re) => {
    const b = page.locator("[role=dialog] button, .ki-dialog button").filter({ hasText: re });
    const n = await b.count();
    for (let i = n - 1; i >= 0; i--) {
      try {
        await b.nth(i).click({ timeout: 2000 });
        await page.waitForTimeout(600);
      } catch {}
    }
    return n;
  };
  try {
    if (
      (/Airą|Aira/.test(st.quest) && /Porozmawiaj/.test(st.quest)) ||
      /Pierwsze kroki/.test(st.quest)
    ) {
      if (await talkTo("guide")) {
        L.log("talk Aira", await clickBtn(/Przyjmij zadanie|Odbierz nagrodę/));
        await closeDialogs();
      }
      st = await L.state(page);
      L.log("quest", st.quest);
      if (/Rynek/.test(st.quest)) {
        await page
          .getByRole("button", { name: "Podejdź do rynku" })
          .click()
          .catch(() => {});
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(1000);
          st = await L.state(page);
          if (/Wróć do/.test(st.quest)) break;
        }
        L.log("market", st.quest);
      }
      if (/Wróć do/.test(st.quest) && /Aira|Airy/.test(st.quest)) {
        if (await talkTo("guide")) {
          L.log("reward Aira", await clickBtn(/Odbierz nagrodę/));
          await closeDialogs();
        }
      }
    }
    st = await L.state(page);
    L.log("after tutorial 1", { xp: st.xp, level: st.level, quest: st.quest });
    if (/Ren/.test(st.quest)) {
      if (await talkTo("hunter")) {
        L.log("talk Ren", await clickBtn(/Przyjmij zadanie/));
        await closeDialogs();
      }
    }
  } catch (e) {
    L.log("TUTORIAL ERROR", e.message.split("\n")[0]);
    stats.errors.push("tutorial: " + e.message.split("\n")[0]);
  }
  st = await L.state(page);
  L.log("tutorial done?", { quest: st.quest, xp: st.xp, level: st.level });

  // ---- town errands: the same UI a new player uses ------------------------------------------------
  const btnTexts = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => b.offsetParent)
        .map((b) => (b.getAttribute("aria-label") || b.innerText).replace(/\s+/g, " ").slice(0, 50))
        .filter(Boolean),
    );
  const clickQuestButtons = async () => {
    let n = 0;
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(600);
      const b = page
        .locator("[role=dialog] button")
        .filter({ hasText: /^(Przyjmij zadanie|Odbierz nagrodę)/ })
        .first();
      if (!(await b.count())) break;
      const label = await b.innerText();
      try {
        await b.click({ timeout: 2000 });
      } catch {
        break;
      }
      n++;
      L.log("  quest button:", label);
      await page.waitForTimeout(800);
    }
    return n;
  };
  const exitInterior = async () => {
    for (let i = 0; i < 6; i++) {
      const s2 = await L.state(page);
      if (s2.hero && s2.hero.x > 10000) return true; // interiors use small coordinates
      if (s2.dialog) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      const b = page.getByRole("button", { name: /Wyjdź do miasta/ });
      if (await b.count()) {
        await b
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(1800);
      } else await page.waitForTimeout(800);
    }
    return (await L.state(page)).hero.x > 10000;
  };
  const planGo = async (re) => {
    await exitInterior();
    const plan = page.getByRole("button", { name: "Plan miasta" });
    if (!(await plan.count())) return false;
    await plan.first().click();
    await page.waitForTimeout(600);
    const b = page.getByRole("button", { name: re });
    if (!(await b.count())) {
      await page.keyboard.press("Escape");
      return false;
    }
    await b.first().click();
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(700);
      if ((await L.state(page)).dialog) return true;
    }
    return false;
  };
  const buyPotions = async () => {
    let bought = 0;
    for (let i = 0; i < 6; i++) {
      const st2 = await L.state(page);
      if (st2.potion >= 8) break;
      const kup = page.locator("[role=dialog] button").filter({ hasText: /^Kup/ }).first();
      if (!(await kup.count()) || (await kup.isDisabled().catch(() => true))) break;
      await kup.click().catch(() => {});
      bought++;
      await page.waitForTimeout(500);
    }
    return bought;
  };
  const buyGear = async () => {
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog] button")]
        .map((btn, i) => ({ btn, i }))
        .filter((x) => /^Kup/.test(x.btn.innerText))
        .map((x) => {
          let el = x.btn;
          while (el && (el.innerText.match(/Masz:/g) || []).length !== 1) el = el.parentElement;
          const t = el ? el.innerText.replace(/\s+/g, " ") : "";
          const m = /^(.*?) Masz: (\d+)/.exec(t);
          return {
            i: x.i,
            name: m ? m[1].trim() : "?",
            have: m ? Number(m[2]) : -1,
            price: Number((/Kup · (\d+)/.exec(x.btn.innerText) || [0, 0])[1]),
            disabled: x.btn.disabled,
          };
        }),
    );
    let n = 0;
    for (const r of rows) {
      if (/Mikstura/.test(r.name) || r.have !== 0 || r.disabled) continue;
      await page
        .locator("[role=dialog] button")
        .nth(r.i)
        .click()
        .catch(() => {});
      L.log("  bought gear:", r.name, r.price);
      n++;
      await page.waitForTimeout(500);
    }
    return n;
  };
  const spendSkills = async () => {
    const open = page.getByRole("button", { name: /^Umiejętności/ });
    if (!(await open.count())) return 0;
    await open.first().click();
    await page.waitForTimeout(1000);
    let spent = 0;
    for (const tab of [0, 1, 2]) {
      const tabs = page.locator("[role=dialog] button").filter({
        hasText: /^(Szlak|Żywa|Pieśń|Krąg|Ścieżka|Sieć|Rdzeń|Żar|Tarcza|Pamięć|Światło|Strumień)/,
      });
      for (let g = 0; g < 6; g++) {
        const plus = page.locator("[role=dialog] button.ki-st-plus").first();
        if (!(await plus.count())) break;
        const label = await plus.getAttribute("aria-label");
        try {
          await plus.click({ timeout: 2000 });
        } catch {
          break;
        }
        spent++;
        L.log("  skill learned:", label);
        await page.waitForTimeout(700);
      }
      if (tab < 2) {
        const t = page.locator("[role=dialog] button").nth(3 + tab + 1);
        await t.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
    await page
      .getByRole("button", { name: "Zamknij okno" })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(400);
    return spent;
  };
  const equipAll = async () => {
    await page
      .getByRole("button", { name: "Ekwipunek" })
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
    let worn = 0;
    for (let i = 0; i < 6; i++) {
      const it = page
        .locator("[role=dialog] button")
        .filter({ hasText: /załóż/i })
        .filter({ hasNotText: /Mikstura|galaretka|Eliksir|Antidotum/i })
        .first();
      const alt = page.locator('[role=dialog] [aria-label*="załóż"]').first();
      const t = (await it.count()) ? it : alt;
      if (!(await t.count())) break;
      L.log("  equip:", (await t.getAttribute("aria-label")) || "");
      await t.click().catch(() => {});
      worn++;
      await page.waitForTimeout(600);
    }
    await page
      .getByRole("button", { name: "Zamknij okno" })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(400);
    return worn;
  };
  const goHome = async () => {
    for (const [x, y] of [
      [49500, 36300],
      [49400, 35300],
      [49600, 34950],
    ]) {
      await L.walkTo(page, x, y, { radius: 150, timeout: 45000 });
    }
  };
  const leaveCity = async () => {
    await exitInterior();
    for (const [x, y] of [
      [49450, 35800],
      [49500, 36300],
    ])
      await L.walkTo(page, x, y, { radius: 150, timeout: 45000 });
  };
  let lastTown = 0;
  const town = async (why) => {
    stats.towns = (stats.towns || 0) + 1;
    lastTown = Date.now();
    const s0 = await L.state(page);
    L.log("TOWN visit", why, { level: s0.level, xp: s0.xp, potion: s0.potion });
    await keys(new Set());
    await exitInterior();
    if (!(await page.getByRole("button", { name: "Plan miasta" }).count())) await goHome();
    for (const [re, nm] of [
      [/Idź do Airy/, "Aira"],
      [/Idź do Rena/, "Ren"],
      [/Idź do Mio/, "Mio"],
      [/Idź do Taro/, "Taro"],
    ]) {
      if (await planGo(re)) {
        const n = await clickQuestButtons();
        L.log(" visited", nm, "quest clicks", n);
        if (nm === "Mio") {
          const b = await buyPotions();
          L.log(" potions bought", b);
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      } else L.log(" could not reach", nm);
    }
    L.log(" equip", await equipAll(), "skills", await spendSkills());
    const s1 = await L.state(page);
    L.log("TOWN done", {
      level: s1.level,
      xp: s1.xp,
      potion: s1.potion,
      quest: s1.quest.slice(0, 80),
    });
    await shot("town-" + stats.towns);
    await leaveCity();
  };

  // ---- hunting ----------------------------------------------------------------------------------
  // XP per kill is flat (def.xp), so the best zone is the one with the highest XP per monster HP: level 1-2 first, then the
  // level-4 monster (42 XP for 142 HP) all the way up.
  const wantLevel = (lv) => (lv >= 4 ? 4 : lv >= 2 ? 2 : 1);
  const pickSpawn = (s) => {
    const now = Date.now(),
      want = wantLevel(s.level);
    const cand = spawns.filter(
      (sp) =>
        sp.lvl === want &&
        (visited.get(sp.id) || 0) < now &&
        Math.hypot(sp.x - HOME.x, sp.y - HOME.y) < 9000,
    );
    cand.sort((a, b) => dist(s.hero, a) - dist(s.hero, b));
    return cand[0];
  };
  while (Date.now() - t0 < MAX_MS) {
    try {
      st = await L.state(page);
      if (st.overlay) {
        stats.recover++;
        L.log("BUG overlay", st.overlay);
        await shot("overlay-" + stats.recover);
        await keys(new Set());
        await page
          .getByRole("button", { name: /Ponów próbę/ })
          .click()
          .catch(() => {});
        await page
          .locator(".ki-hud")
          .waitFor({ timeout: 60000 })
          .catch(() => {});
        await page.waitForTimeout(3000);
        continue;
      }
      const now = Date.now();
      if (st.level !== lastLevel) {
        stats.levelUps.push({
          level: st.level,
          atMin: ((now - t0) / 60000).toFixed(1),
          kills: stats.kills,
        });
        L.log("LEVEL UP", st.level, "kills", stats.kills, "min", ((now - t0) / 60000).toFixed(1));
        await shot("level-" + st.level);
        lastLevel = st.level;
      }
      if (st.level >= GOAL) {
        L.log("GOAL reached", { level: st.level, xp: st.xp });
        await shot("goal");
        break;
      }
      if (now - lastHeart > 20000) {
        lastHeart = now;
        L.log("hb", {
          lvl: st.level,
          xp: st.xp,
          hp: st.hpNow + "/" + st.hpMax,
          pos: st.hero,
          foes: st.enemies.length,
          kills: stats.kills,
          tgt: st.target,
          foeList: st.enemies
            .slice(0, 6)
            .map((e) => [e.id.slice(-6), e.name, e.vis, Math.round(dist(st.hero, e))]),
          potion: st.potion,
          quest: st.quest.slice(0, 70),
        });
      }
      if (st.hpNow <= 0) {
        stats.deaths++;
        await keys(new Set());
        L.log(
          "DEAD",
          await page.evaluate(() =>
            [...document.querySelectorAll("button")]
              .filter((b) => b.offsetParent)
              .map((b) => b.innerText.replace(/\s+/g, " ").slice(0, 40))
              .filter(Boolean)
              .join(" | "),
          ),
        );
        await shot("dead-" + stats.deaths);
        const btn = page
          .getByRole("button", { name: /odrodz|wskrze|wróć|respawn|kontynuuj|powrót/i })
          .first();
        if (await btn.count()) await btn.click().catch(() => {});
        await page.waitForTimeout(2500);
        continue;
      }
      if (st.dialog) {
        await keys(new Set());
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        continue;
      }
      const wantTown =
        /Wróć do .* po nagrodę/.test(st.quest) && now - lastTown > 120000
          ? "quest ready"
          : st.potion <= 0 && now - lastTown > 90000 && st.hpNow / st.hpMax < 0.6
            ? "no potions"
            : st.level > (stats.townLevel || 1) && st.level % 2 === 0 && now - lastTown > 120000
              ? "level " + st.level
              : null;
      if (wantTown) {
        stats.townLevel = st.level;
        try {
          await town(wantTown);
        } catch (e) {
          L.log("TOWN ERROR", e.message.split("\n")[0]);
          stats.errors.push("town: " + e.message.split("\n")[0]);
          lastTown = Date.now();
        }
        continue;
      }
      // heal
      if (st.hpNow / st.hpMax < 0.45 && st.potion > 0 && now - lastPotion > 2500) {
        lastPotion = now;
        await page.keyboard.press("q");
        stats.potions++;
        L.log("potion", { hp: st.hpNow, left: st.potion - 1 });
      }
      // kill counter from the xp bar
      if (st.xp !== lastXp) {
        const a = Number(lastXp.split("/")[0] || 0),
          b = Number(st.xp.split("/")[0] || 0);
        if (b > a || st.level !== lastLevel) stats.kills++;
        lastXp = st.xp;
        noKillSince = now;
      }
      const foes = st.enemies.filter((e) => e.vis !== false);
      const allowedL = wantLevel(st.level);
      const usable = foes
        .filter((e) => {
          const l = lvlOf(e);
          return l === null || l <= allowedL;
        })
        .sort((a, b) => dist(st.hero, a) - dist(st.hero, b));
      const lowHp = st.hpNow / st.hpMax < 0.3 && st.potion <= 0;
      if (lowHp) {
        // retreat to the city and rest
        L.log("retreat", { hp: st.hpNow, pos: st.hero });
        await keys(new Set());
        let g = 0;
        while (g++ < 300) {
          const c = await L.state(page);
          if (c.hpNow / c.hpMax > 0.9) break;
          if (dist(c.hero, HOME) > 120) await keys(steer(c.hero, HOME, 40));
          else await keys(new Set());
          await page.waitForTimeout(150);
        }
        await keys(new Set());
        continue;
      }
      if (usable.length) {
        const e = usable[0],
          d = dist(st.hero, e);
        if (
          st.target !== e.id &&
          (!st.target ||
            !foes.some((f) => f.id === st.target) ||
            dist(st.hero, e) + 150 <
              dist(
                st.hero,
                foes.find((f) => f.id === st.target),
              )) &&
          now - lastClick > 1500
        ) {
          lastClick = now;
          await clickWorld(st, e.x, e.y - 40);
        }
        if (d > REACH) {
          // proportional tap: the control loop lags ~0.3-0.5 s, the hero runs ~200 u/s
          const holdMs = Math.max(60, Math.min(450, ((d - REACH) / 220) * 1000 * 0.8));
          await keys(steer(st.hero, e, 12));
          await page.waitForTimeout(holdMs);
          await keys(new Set());
        } else {
          await keys(new Set());
        }
        if (d <= REACH + 45 && now - lastAtk > 330) {
          lastAtk = now;
          await page.keyboard.press(" ");
        }
        goalSpawn = null;
        continue;
      }
      // loot
      if (st.loot.length && now - lastF > 600) {
        const l = st.loot.sort((a, b) => dist(st.hero, a) - dist(st.hero, b))[0];
        if (dist(st.hero, l) > 70) await keys(steer(st.hero, l, 25));
        else {
          await keys(new Set());
          lastF = now;
          await page.keyboard.press("f");
          stats.loots++;
        }
        continue;
      }
      // nobody around: walk to the next spawn point
      if (!goalSpawn || dist(st.hero, goalSpawn) < 350 || (visited.get(goalSpawn.id) || 0) > now) {
        if (goalSpawn && dist(st.hero, goalSpawn) < 350) visited.set(goalSpawn.id, now + 90000);
        goalSpawn = pickSpawn(st) || null;
        if (goalSpawn)
          L.log("next spawn", {
            id: goalSpawn.id,
            kind: goalSpawn.kind,
            lvl: goalSpawn.lvl,
            d: Math.round(dist(st.hero, goalSpawn)),
          });
        else {
          L.log("no spawn candidate; resting");
          visited.clear();
          await page.waitForTimeout(2000);
          continue;
        }
      }
      if (!lastPos || dist(lastPos, st.hero) > 8) {
        lastPos = st.hero;
        lastMoveT = now;
      }
      // inside the city walls the way out is the southern gate: use the same waypoints as a player following the road
      if (
        st.hero.x > 47000 &&
        st.hero.x < 51200 &&
        st.hero.y > 33700 &&
        st.hero.y < 35900 &&
        goalSpawn.y > 35900
      ) {
        L.log("leaving the city toward", goalSpawn.id);
        await leaveCity();
        continue;
      }
      let want = steer(st.hero, goalSpawn, 40);
      if (now - lastMoveT > 1300) {
        // stuck: click-to-move a short way toward the goal (server path-finding), then slide sideways
        stats.stuck++;
        const dx = goalSpawn.x - st.hero.x,
          dy = goalSpawn.y - st.hero.y,
          k = Math.min(1, 300 / Math.hypot(dx, dy));
        await keys(new Set());
        await clickWorld(st, st.hero.x + dx * k, st.hero.y + dy * k);
        await page.waitForTimeout(1500);
        lastMoveT = Date.now();
        continue;
      }
      await keys(want);
      await page.waitForTimeout(90);
    } catch (e) {
      const msg = e.message.split("\n")[0];
      stats.errors.push(msg);
      L.log("LOOP ERROR", msg);
      if (/closed|Target page|browser has been/i.test(msg)) break;
      await page.waitForTimeout(500);
    }
  }
  await keys(new Set());
  st = await L.state(page).catch(() => null);
  L.log("END", {
    ...stats,
    st: st && { level: st.level, xp: st.xp, hero: st.hero },
    minutes: ((Date.now() - t0) / 60000).toFixed(1),
  });
  L.log("ISSUES", {
    http: issues.http.slice(0, 20),
    console: issues.console.filter((x) => !/hydrated/.test(x)).slice(0, 20),
    pageErrors: issues.pageErrors.slice(0, 10),
  });
  await browser.close();
})().catch((e) => {
  console.log("FAILED", e.stack.split("\n").slice(0, 4).join(" | "));
  process.exit(1);
});
