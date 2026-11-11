import { GameSession } from "../../src/game/session";
import { MONSTERS } from "../../src/game/monsters/catalog";
import type { RaceId } from "../../src/game/world/races";

/**
 * Audyt CPU: mierzy prawdziwy kod sesji i kitu, nie jego kalkę.
 * Wszystko, co tu wychodzi drogie, dzieje się w grze 10×/s (report) albo 60×/s (tick).
 */
const RACE: RaceId = "planetary";

function sesja() {
  const g = new GameSession(undefined, RACE, { random: () => 0.5 });
  g.enemies.splice(0);
  // Jak w testach repo: domyślny spawn leży w bezpiecznym mieście, a tam nie wolno stawiać wrogów.
  const open = g.world.enemies[0];
  if (g.safe && open) Object.assign(g.player, g.nav.safe(open));
  g.player.level = 12;
  for (const n of ["A1", "A2", "A3", "A4", "B1", "B2", "C1"]) g.kit.learn(n);
  return g;
}

function czas(fn: () => void, powtorzen: number) {
  fn(); // rozgrzewka JIT
  const t0 = performance.now();
  for (let i = 0; i < powtorzen; i++) fn();
  return (performance.now() - t0) / powtorzen;
}

const g = sesja();
const wiersze: Record<string, unknown>[] = [];
const dodaj = (co: string, ms: number, naSekunde: number, opis: string) =>
  wiersze.push({
    operacja: co,
    "ms/wywołanie": Number(ms.toFixed(4)),
    "wywołań/s": naSekunde,
    "ms/s CPU": Number((ms * naSekunde).toFixed(2)),
    "% budżetu 16,7 ms": Number(((ms * naSekunde) / 10).toFixed(1)),
    opis,
  });

// --- to, co leci 10×/s z report() ---
const snapMs = czas(() => void g.snapshot(), 300);
dodaj("session.snapshot()", snapMs, 10, "pełny model widoku dla React, 10×/s");
const breakdownMs = czas(() => void g.kit.statBreakdown, 300);
dodaj("kit.statBreakdown", breakdownMs, 10, "6 pełnych deriveStats() na jedno wywołanie");
const cloneMs = czas(() => void structuredClone(g.player), 300);
dodaj("structuredClone(player)", cloneMs, 10, "głęboka kopia całej postaci w snapshot");
const abilitiesMs = czas(() => void g.kit.abilities(), 300);
dodaj("kit.abilities()", abilitiesMs, 10, "lista zdolności z odnowieniami");

const payload = JSON.stringify(g.snapshot()).length;
const playerPayload = JSON.stringify(g.player).length;

// --- to, co leci co klatkę ---
for (const liczba of [0, 8, 16, 32]) {
  const s = sesja();
  s.enemies.splice(0);
  for (let i = 0; i < liczba; i++) {
    const def = MONSTERS[i % MONSTERS.length]!;
    const e = s.monsters.spawn(def.id, {
      x: s.player.x + 120 + (i % 8) * 40,
      y: s.player.y + 120 + Math.floor(i / 8) * 40,
    });
    e.m.phase = "engage";
    e.m.engaged = true;
    e.mode = "chase";
  }
  const tickMs = czas(() => s.tick(16.67), 200);
  dodaj(`session.tick(16,7 ms) · ${liczba} potworów`, tickMs, 60, "cała symulacja na klatkę");
}

// --- koszt samego renderowego sprzężenia zwrotnego (dataset) ---
const s32 = sesja();
for (let i = 0; i < 32; i++) {
  const def = MONSTERS[i % MONSTERS.length]!;
  s32.monsters.spawn(def.id, { x: s32.player.x + 100 + i * 12, y: s32.player.y + 100 });
}
const datasetMs = czas(() => {
  JSON.stringify(
    s32.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, mode: e.mode, kind: e.kind })),
  );
  JSON.stringify([...s32.enemies].map((e) => ({ id: e.id, visual: "x" })));
  JSON.stringify(s32.bossRewards);
}, 300);
dodaj("JSON.stringify telemetrii (32 potwory)", datasetMs, 10, "dataset w report()");

console.table(wiersze);
console.log("\nrozmiar snapshot (JSON):", payload, "bajtów | sam player:", playerPayload, "bajtów");
console.log("pola playera:", Object.keys(g.player).length);
console.log(
  "snapshot 10×/s to",
  ((payload * 10) / 1024).toFixed(1),
  "KB/s alokacji tylko na model widoku",
);
const razem10 = snapMs * 10;
const razem60 =
  (wiersze.find((w) => String(w.operacja).includes("32 potworów"))?.["ms/wywołanie"] as number) *
  60;
console.log(
  "\nRAZEM CPU: report 10×/s =",
  razem10.toFixed(2),
  "ms/s | tick 60×/s (32 potwory) =",
  razem60.toFixed(2),
  "ms/s",
);
console.log(
  "budżet klatki 60 fps = 16,67 ms; sam report zjada",
  ((snapMs / 16.67) * 100).toFixed(1),
  "% jednej klatki, ale co dziesiątą",
);
