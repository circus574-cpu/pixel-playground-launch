import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { WILD_CAP, TOWN_CAP } from "../../src/game/world/generated/worldDress";
import { catalog as katalog } from "../../src/game/assets/catalog";

/**
 * Audyt obciążenia świata: ile obiektów przypada na chunk (pętla widoczności chodzi po nich
 * co klatkę) i ile waży wejście do świata (żądania JSON + tekstury).
 */

console.log("wiązań w katalogu:", Object.keys(katalog.renderBindings).length);

// --- ile plików i bajtów czyta wejście do jednego świata ---
const root = "public/game/worlds/superior-v2";
const cechy = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "art")
  .map((d) => d.name);

let razemPlikow = 0,
  razemBajtow = 0;
const perCecha: Record<string, unknown>[] = [];
function skanuj(dir: string) {
  let pliki = 0,
    bajty = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const [f, b] = skanuj(p);
      pliki += f;
      bajty += b;
    } else {
      pliki++;
      bajty += statSync(p).size;
    }
  }
  return [pliki, bajty] as const;
}
for (const c of cechy) {
  const [f, b] = skanuj(join(root, c));
  const json = (() => {
    let n = 0;
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".json")) n++;
      }
    };
    walk(join(root, c));
    return n;
  })();
  perCecha.push({
    ląd: c,
    "plików JSON": json,
    "plików razem": f,
    "MB razem": Number((b / 1048576).toFixed(1)),
  });
  razemPlikow += f;
  razemBajtow += b;
}
console.table(perCecha);
console.log(
  "RAZEM świat superior-v2:",
  razemPlikow,
  "plików,",
  (razemBajtow / 1048576).toFixed(1),
  "MB",
);

// --- geometria: ile chunków obejmuje kadr i ile obiektów to znaczy ---
console.log(
  "\nchunk = 2048 px; limity dekoracji: dzicz",
  WILD_CAP,
  "/ miasto",
  TOWN_CAP,
  "na chunk",
);
for (const [nazwa, cap] of [
  ["dzicz (WILD_CAP)", WILD_CAP],
  ["miasto (TOWN_CAP)", TOWN_CAP],
] as const) {
  for (const chunkow of [4, 9, 12]) {
    console.log(
      `  ${nazwa}: ${chunkow} chunków w pamięci → do ${chunkow * cap} obiektów iterowanych CO KLATKĘ w updateVisibility`,
    );
  }
}
console.log(
  "\nprzy 60 fps i 12 chunkach miasta to",
  ((12 * TOWN_CAP * 60) / 1000).toFixed(0),
  "tys. sprawdzeń intersects/s",
);
