import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const directory = process.argv[2];
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => {
  external.push(r.request().url());
  return r.abort();
});
await page.setContent(await fs.readFile(directory + "/SUPERIOR-ATLAS-WLASCICIELA.html", "utf8"));
await page.waitForFunction(() => !!window.OWNER_ATLAS, {}, { timeout: 60000 });
const audit = await page.evaluate(() => ({
  counts: OWNER_ATLAS.counts,
  monsters: OWNER_ATLAS.monsterCount,
  quests: OWNER_ATLAS.questCount,
}));
if (
  audit.counts.overworld + audit.counts.interiors !== 8282 ||
  audit.monsters !== 40 ||
  audit.quests !== 98
)
  throw Error("Incomplete counts");
await page.screenshot({ path: directory + "/01-planeta.png" });
for (const id of [
  "verdant",
  "aether",
  "nexus",
  "pyra",
  "island-1",
  "island-2",
  "island-3",
  "island-4",
  "island-5",
  "island-6",
]) {
  await page.selectOption("#view", id);
  await page.waitForFunction((id) => OWNER_ATLAS.getState().view === id, id);
  const invalid = await page.evaluate((id) => {
    let v = OWNER_ATLAS.features[id];
    return v.spawns.overworld.filter(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > v.world.geometry.width ||
        p.y > v.world.geometry.height,
    ).length;
  }, id);
  if (invalid) throw Error("Invalid spawn " + id);
}
await page.selectOption("#view", "verdant");
await page.screenshot({ path: directory + "/02-kontynent.png" });
await page.evaluate(() => {
  let f = OWNER_ATLAS.features.verdant;
  OWNER_ATLAS.openDungeon("verdant", f.world.dungeons[0].id);
});
await page.screenshot({ path: directory + "/03-podziemia.png" });
const dungeonAudit = await page.evaluate(() =>
  Object.entries(OWNER_ATLAS.features).flatMap(([id, v]) =>
    v.world.dungeons.map((d) => ({
      feature: id,
      id: d.id,
      spawns: v.spawns.interiors.filter((s) => s.dungeon === d.id).length,
      solution: d.solution.length,
      floor: d.floor.length > 0,
      validSpawns: v.spawns.interiors
        .filter((s) => s.dungeon === d.id)
        .every(
          (s) => d.floor[Math.floor(s.y / d.cellSize)]?.[Math.floor(s.x / d.cellSize)] === "1",
        ),
    })),
  ),
);
if (
  dungeonAudit.length !== 152 ||
  dungeonAudit.some((d) => !d.floor || d.solution < 2 || !d.validSpawns) ||
  dungeonAudit.reduce((s, d) => s + d.spawns, 0) !== 2220
)
  throw Error("Incomplete interiors");
await page.click("#questsBtn");
if ((await page.locator(".quest").count()) !== 98) throw Error("Missing quests");
await page.locator("#quests .close").click();
await page.locator("#search").fill("verdant-ruins-21-spawn-0");
await page.waitForTimeout(400);
await page.locator("#results button").first().click();
const search = await page.evaluate(() => OWNER_ATLAS.getState());
if (search.dungeon !== "verdant-ruins-21") throw Error("Interior search failed");
const [csv] = await Promise.all([page.waitForEvent("download"), page.click("#csvBtn")]);
await csv.saveAs(directory + "/Superior-wszystkie-punkty.csv");
await page.setViewportSize({ width: 390, height: 844 });
await page.selectOption("#view", "island-1");
await page.screenshot({ path: directory + "/04-telefon.png" });
await browser.close();
if (errors.length || external.length) throw Error(JSON.stringify({ errors, external }));
await fs.writeFile(
  directory + "/verification.json",
  JSON.stringify(
    {
      passed: true,
      ...audit,
      dungeons: dungeonAudit.length,
      interiorSpawns: dungeonAudit.reduce((s, d) => s + d.spawns, 0),
      allTenLandsChecked: true,
      interiorSearch: true,
      questCatalog: true,
      offlineNoNetwork: true,
      errors,
      external,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed: true, audit }));
