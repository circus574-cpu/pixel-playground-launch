import { describe, expect, it } from "vitest";
import { MAX_MOVE_SPEED, SPEED_GROWTH_TIERS, speedGrowth } from "../game/kit/balance";

describe("wzrost prędkości ruchu (decyzja właściciela 11.11.2026)", () => {
  it("progi schodkowe: 5% do 9, 4% 10–19, 3,5% 20–29, 3% od 30", () => {
    expect(SPEED_GROWTH_TIERS.map((t) => t.rate)).toEqual([0.05, 0.04, 0.035, 0.03]);
    expect(SPEED_GROWTH_TIERS.map((t) => t.upTo)).toEqual([9, 19, 29, Infinity]);
  });

  it("poziom 1 = baza rasy (mnożnik 1)", () => {
    expect(speedGrowth(1)).toBe(1);
  });

  it("wartości na progach (addytywny % bazy)", () => {
    expect(speedGrowth(9)).toBeCloseTo(1.4, 6); // 8 × 5%
    expect(speedGrowth(10)).toBeCloseTo(1.44, 6); // + 1 × 4%
    expect(speedGrowth(19)).toBeCloseTo(1.8, 6); // + 10 × 4%
    expect(speedGrowth(20)).toBeCloseTo(1.835, 6); // + 1 × 3,5%
    expect(speedGrowth(29)).toBeCloseTo(2.15, 6); // + 10 × 3,5%
    expect(speedGrowth(30)).toBeCloseTo(2.18, 6); // + 1 × 3%
    expect(speedGrowth(60)).toBeCloseTo(3.08, 6); // + 31 × 3%
  });

  it("brak capu poziomu — wzrost trwa powyżej 20 i 30", () => {
    expect(speedGrowth(30)).toBeGreaterThan(speedGrowth(20));
    expect(speedGrowth(100)).toBeGreaterThan(speedGrowth(60));
  });

  it("twardy limit prędkości to 1200 j/s", () => {
    expect(MAX_MOVE_SPEED).toBe(1200);
  });

  it("monotoniczny i >= 1 dla poziomów 1..200", () => {
    let prev = speedGrowth(1);
    expect(prev).toBe(1);
    for (let l = 2; l <= 200; l++) {
      const g = speedGrowth(l);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it("ułamkowe i zerowe poziomy nie wywracają formuły", () => {
    expect(speedGrowth(0)).toBe(1);
    expect(speedGrowth(10.9)).toBeCloseTo(speedGrowth(10), 6);
  });
});
