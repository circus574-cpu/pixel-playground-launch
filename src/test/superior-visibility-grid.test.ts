import { describe, expect, it } from "vitest";
import { buildSceneryGrid, sceneryNear, sceneryReach } from "../game/world/sceneryStream";
import { WILD_CAP, TOWN_CAP } from "../game/world/generated/worldDress";

/**
 * Niezmiennik pętli widoczności renderera Superior po Fazie 1 audytu (11.11.2026):
 * obiekt przecinający kadr MUSI być wśród kandydatów z siatki. Siatka kubełkuje po punkcie
 * kotwicy, więc zapytanie jest powiększone o zasięg największego obiektu — ten test pilnuje,
 * żeby żaden widoczny obiekt nie wypadł i nie znikał graczowi z kadru.
 */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

type Item = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

function dekoracje(count: number, seed: number, side = 2048): Item[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({
    x: r() * side,
    y: r() * side,
    width: 24 + r() * 420,
    height: 24 + r() * 420,
    anchorX: r(),
    anchorY: r(),
  }));
}

const przecina = (
  o: Item,
  v: { left: number; right: number; top: number; bottom: number },
  pad: number,
) =>
  o.x + o.width * (1 - o.anchorX) >= v.left - pad &&
  o.x - o.width * o.anchorX <= v.right + pad &&
  o.y + o.height * (1 - o.anchorY) >= v.top - pad &&
  o.y - o.height * o.anchorY <= v.bottom + pad;

describe("pętla widoczności Superior na siatce sceneryStream", () => {
  it("żaden widoczny obiekt nie wypada z kandydatów (gęste miasto i dzicz)", () => {
    for (const cap of [WILD_CAP, TOWN_CAP])
      for (const seed of [1, 7, 42, 1337, 90210]) {
        const items = dekoracje(cap, seed);
        const grid = buildSceneryGrid(items);
        const reach = sceneryReach(items);
        const origins: [number, number][] = [
          [0, 0],
          [600, 700],
          [1500, 1500],
          [-300, 900],
          [1900, -200],
        ];
        for (const [left, top] of origins) {
          const view = { left, right: left + 1452, top, bottom: top + 903 };
          const near = new Set(sceneryNear(grid, view, 200 + reach));
          items.forEach((item, i) => {
            if (przecina(item, view, 200))
              expect(near.has(i), `obiekt ${i} wypadł (seed ${seed}, cap ${cap})`).toBe(true);
          });
        }
      }
  });

  it("duży obiekt z kotwicą poza kadrem nadal jest kandydatem", () => {
    const item: Item = { x: 100, y: 1000, width: 1600, height: 200, anchorX: 0, anchorY: 0.5 };
    const view = { left: 1200, right: 2000, top: 800, bottom: 1200 };
    expect(przecina(item, view, 0)).toBe(true);
    const grid = buildSceneryGrid([item]);
    expect(sceneryNear(grid, view, sceneryReach([item]))).toContain(0);
  });

  it("kandydatów jest wyraźnie mniej niż wszystkich obiektów", () => {
    const items = dekoracje(TOWN_CAP * 12, 20261111, 2048 * 4);
    const grid = buildSceneryGrid(items);
    const reach = sceneryReach(items);
    const view = { left: 3000, right: 4452, top: 3000, bottom: 3903 };
    const near = sceneryNear(grid, view, 200 + reach);
    expect(near.length).toBeLessThan(items.length * 0.4);
    const zbior = new Set(near);
    items.forEach((item, i) => {
      if (przecina(item, view, 200)) expect(zbior.has(i)).toBe(true);
    });
  });

  it("kadr poza światem nie wybiera niczego", () => {
    const items = dekoracje(WILD_CAP, 5);
    const grid = buildSceneryGrid(items);
    const view = { left: 90000, right: 91452, top: 90000, bottom: 90903 };
    expect(sceneryNear(grid, view, 200 + sceneryReach(items))).toHaveLength(0);
  });
});
