import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const directory = process.argv[2];
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
await page.setContent(await fs.readFile(directory + "/SUPERIOR-ATLAS-WLASCICIELA.html", "utf8"));
await page.waitForFunction(() => !!window.OWNER_ATLAS, {}, { timeout: 60000 });
const html = await page.evaluate(() => {
  const A = window.OWNER_ATLAS,
    F = A.features,
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const colors = {
    spawn: "#ed7a65",
    dungeon: "#b590e1",
    secret: "#ffe099",
    settlement: "#ead3a2",
    resource: "#a2c179",
    npc: "#78ccad",
    door: "#e7a878",
  };
  let n = 0,
    pages = [];
  function page(title, sub, map, side) {
    n++;
    pages.push(
      `<section><header><div><small>KI LEGENDS / ATLAS WŁAŚCICIELA / PEŁNE ODKRYCIE</small><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><b>${String(n).padStart(3, "0")}</b></header><main><div class="chart">${map}</div><aside>${side}</aside></main><footer>SUPERIOR · PRYWATNY EGZEMPLARZ WŁAŚCICIELA <span>${esc(A.counts.overworld + A.counts.interiors)} spawnów · dokładne współrzędne i pełne rekordy w atlasie HTML</span></footer></section>`,
    );
  }
  function dot(x, y, c, r = 3) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  }
  function route(ps, c, w) {
    return `<polyline points="${ps.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>`;
  }
  const legend = `<h2>Legenda</h2><p><i style="background:${colors.spawn}"></i> Spawny potworów</p><p><i style="background:${colors.dungeon}"></i> Wejścia do podziemi</p><p><i style="background:${colors.secret}"></i> Sekrety i skrytki</p><p><i style="background:${colors.settlement}"></i> Osady i miasta</p><p><i style="background:${colors.npc}"></i> NPC</p><p><i style="background:${colors.door}"></i> Drzwi</p><p>━━ Drogi i ścieżki</p><p class="note">PDF to przegląd i plany wnętrz. Każdy punkt, gatunek, zasób, dekoracja i pełny rekord są dostępne w interaktywnym HTML, również offline. Gęste punkty mogą się nakładać.</p>`;
  let global = `<svg viewBox="0 0 2000 1000"><rect width="2000" height="1000" fill="#183b45"/>`;
  for (const [id, v] of Object.entries(F)) {
    global += `<polygon points="${v.world.geometry.outline.map((p) => A.project(id, ...p).join(",")).join(" ")}" fill="#496c60" stroke="#c6b777" stroke-width="2"/>`;
    for (const p of v.spawns.overworld) {
      const xy = A.project(id, p.x, p.y);
      global += dot(...xy, colors.spawn, 1.8);
    }
    const xy = A.project(id, v.world.geometry.anchor.x, v.world.geometry.anchor.y);
    global += `<text x="${xy[0]}" y="${xy[1] - 14}" fill="#fff1cf" font-size="22" text-anchor="middle" stroke="#132b33" stroke-width="4" paint-order="stroke">${esc(v.world.name)}</text>`;
  }
  global += "</svg>";
  page(
    "Planeta Superior",
    "4 kontynenty · 6 wysp · geometria kanoniczna",
    global,
    `<h2>Wszystko odkryte</h2><div class="big">8 282</div><p>punktów spawnów potworów</p><p>6 062 na powierzchni<br>2 220 w podziemiach<br>40 gatunków</p><hr><p>22 osady usługowe<br>583 drzwi i wejścia<br>152 plany podziemi<br>194 ukryte lokacje<br>1 699 dróg i ścieżek<br>6 511 zasobów<br>271 531 dekoracji</p>${legend}`,
  );
  page(
    "Klucz do atlasu",
    "Dokładność, układy współrzędnych i stan wdrożenia",
    `<article><h2>Przewodnik właściciela</h2><p>Mapa planetarna używa kanonicznego rzutu azymutalnego przeliczonego na atlas equirektangularny. Obszary biegunowe są na tym rzucie rozciągnięte. Mapy lądów mają bezpośrednie współrzędne gry.</p><h2>Powierzchnia i podziemia</h2><p>Nie łączymy lokalnych współrzędnych podziemi z powierzchnią. Każde wnętrze ma osobny plan, wejście powiązane z lądem, wyjście, spawny i trasę rozwiązania.</p><h2>Sekrety i rozwiązania</h2><p>Oznaczono wszystkie 194 lokacje z flagą hidden. Złota linia w podziemiach pokazuje rozwiązanie generatora. Nie dopisano żadnych fikcyjnych tajnych drzwi ani przejść.</p><h2>Questy</h2><p>98 zadań z księgi przygody jest projektem. Pełne cele, fabuła, wymagania i nagrody są w atlasie HTML. Jeżeli imię zleceniodawcy jednoznacznie pasuje do NPC, atlas może wskazać jego miejsce. Nie oznacza to wdrożenia questu ani określenia wszystkich celów w terenie.</p><h2>Spójność źródeł</h2><p>Dane pochodzą bezpośrednio z JSON generatora, katalogu 40 potworów i księgi kampanii. Manifest eksportu zapisuje sumy SHA-256. Pełny rejestr wszystkich punktów można pobrać do CSV.</p><p>Wdrożone są spawny powierzchni i usługi miast. Pełna rozgrywka podziemi, surowców, sekretów i kampanii pozostaje w przygotowaniu. Ten atlas pokazuje także te przygotowane dane.</p></article>`,
    legend,
  );
  for (const [id, v] of Object.entries(F)) {
    const w = v.world,
      g = w.geometry,
      unit = g.width / 1000;
    let svg = `<svg viewBox="0 0 ${g.width} ${g.height}"><image width="${g.width}" height="${g.height}" href="${v.background}"/>`;
    for (const r of w.roads) svg += route(r.points, "#dfcfa5aa", Math.max(r.width, unit));
    for (const s of w.settlements)
      svg += `<rect x="${s.bounds.x}" y="${s.bounds.y}" width="${s.bounds.width}" height="${s.bounds.height}" fill="#e8d4a222" stroke="#e8d4a2" stroke-width="${unit}"/>`;
    for (const p of v.spawns.overworld) svg += dot(p.x, p.y, colors.spawn, unit * 2.2);
    for (const p of w.locations.filter((p) => p.hidden))
      svg += `<text x="${p.x}" y="${p.y}" font-size="${unit * 13}" fill="${colors.secret}" text-anchor="middle">✦</text>`;
    for (const p of w.dungeons)
      svg += dot(p.overworldEntrance.x, p.overworldEntrance.y, colors.dungeon, unit * 4);
    for (const p of w.settlements)
      svg += `<text x="${p.x}" y="${p.y - unit * 13}" font-size="${unit * 13}" text-anchor="middle" fill="#fff2d2" stroke="#142c31" stroke-width="${unit * 3}" paint-order="stroke">${esc(p.name)}</text>`;
    svg += "</svg>";
    page(
      w.name,
      `${id} · ${g.width} × ${g.height} jednostek gry`,
      svg,
      `<h2>Rejestr lądu</h2><p>${v.spawns.overworld.length} spawnów powierzchni<br>${v.spawns.interiors.length} spawnów podziemi<br>${w.dungeons.length} podziemi<br>${w.locations.filter((p) => p.hidden).length} sekretów<br>${w.doors.length} wejść<br>${w.resources.length} zasobów</p><h2>Osady</h2>${w.settlements.map((s) => `<p>${esc(s.name)}<br><small>X ${s.x.toFixed(1)} / Y ${s.y.toFixed(1)}</small></p>`).join("")}${legend}`,
    );
  }
  for (const [id, v] of Object.entries(F))
    for (const d of v.world.dungeons) {
      const c = d.cellSize,
        sp = v.spawns.interiors.filter((s) => s.dungeon === d.id);
      let svg = `<svg viewBox="0 0 ${d.width} ${d.height}"><rect width="${d.width}" height="${d.height}" fill="#13292f"/>`;
      d.floor.forEach((row, y) =>
        [...row].forEach((a, x) => {
          if (a === "1")
            svg += `<rect x="${x * c}" y="${y * c}" width="${c + 0.2}" height="${c + 0.2}" fill="#819186"/>`;
        }),
      );
      svg += route(d.solution, "#f2d990", 4);
      sp.forEach((s, i) => {
        svg +=
          dot(s.x, s.y, "#d6b2f4", 8) +
          `<text x="${s.x + 12}" y="${s.y + 4}" font-size="16" fill="#fff6e6" stroke="#172d32" stroke-width="3" paint-order="stroke">${i + 1}</text>`;
      });
      for (const [p, label, col] of [
        [d.entrance, "WEJŚCIE", "#80ddbb"],
        [d.exit, "WYJŚCIE", "#eaa77a"],
        [d.reward, "NAGRODA", "#ffdd77"],
      ])
        svg +=
          dot(p.x, p.y, col, 10) +
          `<text x="${p.x}" y="${p.y - 15}" text-anchor="middle" font-size="18" fill="${col}" stroke="#132b32" stroke-width="4" paint-order="stroke">${label}</text>`;
      svg += "</svg>";
      page(
        d.id,
        `${v.world.name} · ${d.kind} · wnętrze ${d.width} × ${d.height}`,
        svg,
        `<h2>Wejście w świecie</h2><p>X ${d.overworldEntrance.x}<br>Y ${d.overworldEntrance.y}</p><p>Wyjście wraca do tego wejścia.</p><h2>Spawny ${sp.length}</h2><ol>${sp.map((s) => `<li>${esc(A.roster.find((m) => m.id === s.kind)?.name || s.kind)}<br><small>poz. ${s.level} · X ${s.x} / Y ${s.y}</small></li>`).join("")}</ol><hr><p>● Fiolet: potwory<br>● Zieleń: wejście<br>● Miedź: wyjście<br>● Złoto: nagroda<br>━ Złoto: rozwiązanie</p><p class="note">Plan z generatora. Nagrody i pełna rozgrywka wnętrza są w przygotowaniu. Trasa rozwiązania nie oznacza dodatkowego sekretnego przejścia.</p>`,
      );
    }
  return `<!doctype html><meta charset="utf-8"><title>Superior — prywatny atlas właściciela</title><style>@page{size:A3 landscape;margin:0}*{box-sizing:border-box}body{margin:0;color:#233e42;font:12px/1.45 system-ui;background:#f3eddc}section{width:420mm;height:297mm;page-break-after:always;padding:14mm 16mm;background:#f3eddc;position:relative;overflow:hidden}header{display:flex;justify-content:space-between;border-bottom:1px solid #a68c57;padding-bottom:5mm}header small{letter-spacing:3px;color:#897043;font-size:9px}h1{font:32px Georgia;margin:4px 0;color:#173a3f}header p{margin:3px 0}header b{font:36px Georgia;color:#af9866}main{display:grid;grid-template-columns:1fr 75mm;gap:8mm;height:230mm;grid-template-rows:minmax(0,1fr);padding-top:7mm}.chart{min-height:0;display:flex;align-items:center;justify-content:center;min-width:0;background:#17353e;border:1px solid #a68c57}.chart svg{width:100%;height:100%;display:block}.chart article{align-self:stretch;background:#f3eddc;padding:10mm;line-height:1.6;font-size:14px}aside{font-size:11px}aside h2{font:19px Georgia;color:#897043;margin:8px 0}aside p{margin:8px 0}aside small{color:#687975}i{width:10px;height:10px;display:inline-block;margin-right:8px;border-radius:50%}.big{font:48px Georgia;color:#173a3f}.note{font-size:10px;color:#6d7e7a}.chart h2{font:23px Georgia}ol{padding-left:20px;font-size:9px}li{margin-bottom:5px;overflow-wrap:anywhere}footer{position:absolute;left:16mm;right:16mm;bottom:10mm;border-top:1px solid #c1ae83;padding-top:3mm;font-size:9px;letter-spacing:1px;color:#897043;display:flex;justify-content:space-between}</style>${pages.join("")}`;
});
await fs.writeFile(directory + "/ATLAS-DO-DRUKU.html", html);
await page.setContent(html);
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: directory + "/SUPERIOR-ATLAS-WLASCICIELA.pdf",
  printBackground: true,
  preferCSSPageSize: true,
  timeout: 120000,
});
await browser.close();
console.log("PDF written: 164 pages expected (2 overview + 10 lands + 152 interiors).");
