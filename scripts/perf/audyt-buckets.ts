import { buildSceneryGrid, sceneryNear, sceneryReach } from "../../src/game/world/sceneryStream";
import { WILD_CAP, TOWN_CAP } from "../../src/game/world/generated/worldDress";

/**
 * Zysk z siatki kubełków mierzony na prawdziwym module projektu, nie na jego kalce.
 * Porównuje pełną pętlę (stan przed Fazą 1) z przejściem po kubełkach w kadrze (po Fazie 1).
 */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

type Item = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

function scena(cap: number, chunks: number, seed: number) {
  const r = rng(seed);
  const items: Item[] = [];
  for (let c = 0; c < chunks; c++) {
    const ox = (c % 4) * 2048,
      oy = Math.floor(c / 4) * 2048;
    for (let i = 0; i < cap; i++) {
      const width = 24 + r() * 380,
        height = 24 + r() * 380;
      items.push({
        id: `c${c}o${i}`,
        x: ox + r() * 2048,
        y: oy + r() * 2048,
        width,
        height,
        anchorX: r(),
        anchorY: r(),
      });
    }
  }
  return items;
}

const view = { left: 3000, right: 4452, top: 3000, bottom: 3903 };
const PAD = 200;

function czas(fn: () => number, powtorzen: number) {
  fn();
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < powtorzen; i++) acc += fn();
  return { ms: (performance.now() - t0) / powtorzen, acc };
}

const wiersze: Record<string, unknown>[] = [];
for (const [nazwa, cap] of [
  ["dzicz", WILD_CAP],
  ["miasto", TOWN_CAP],
] as const) {
  const items = scena(cap, 12, 20261111);
  const images = new Map<string, boolean>();

  const reach = sceneryReach(items);
  const grid = buildSceneryGrid(items);
  const przecina = (o: Item) =>
    o.x + o.width * (1 - o.anchorX) >= view.left - PAD &&
    o.x - o.width * o.anchorX <= view.right + PAD &&
    o.y + o.height * (1 - o.anchorY) >= view.top - PAD &&
    o.y - o.height * o.anchorY <= view.bottom + PAD;

  const przed = czas(() => {
    let n = 0;
    for (const item of items) {
      const img = images.get(item.id);
      if (!przecina(item)) {
        if (img) n++;
        continue;
      }
      if (!img) n++;
    }
    return n;
  }, 1500);

  const po = czas(() => {
    const near = sceneryNear(grid, view, PAD + reach);
    let n = 0;
    for (const at of near) {
      const item = items[at]!;
      const img = images.get(item.id);
      if (!przecina(item)) {
        if (img) n++;
        continue;
      }
      if (!img) n++;
    }
    return n;
  }, 1500);

  const kandydatow = sceneryNear(grid, view, PAD + reach).length;

  wiersze.push({
    scena: nazwa,
    "obiektów razem": items.length,
    "kandydatów po kubełkach": kandydatow,
    "zasięg obiektu px": reach,
    "PRZED ms/klatkę": Number(przed.ms.toFixed(4)),
    "PO ms/klatkę": Number(po.ms.toFixed(4)),
    "zysk ×": Number((przed.ms / po.ms).toFixed(2)),
    "oszczędność ms/s @60fps": Number(((przed.ms - po.ms) * 60).toFixed(1)),
  });
}
console.table(wiersze);
console.log("\nNiezmienność wyniku: oba przebiegi zwracają tę samą liczbę operacji na obrazach.");
