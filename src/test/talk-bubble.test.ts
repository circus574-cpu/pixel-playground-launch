import { describe, expect, it } from "vitest";
import { overlaps, placeBubble, rectAt, type Rect } from "../game/talk/bubblePlacement";

// Ekran 1280×720, bohater w środku (z etykietą nad głową), dymek jak w grze: ok. 300×60 px.
const VIEW: Rect = { left: 8, top: 96, right: 1272, bottom: 628 };
const HERO: Rect = { left: 586, top: 250, right: 694, bottom: 372 };
const SIZE = { w: 300, h: 64 };

describe("dymek rozmowy nie zasłania bohatera", () => {
  it("wolne miejsce zostaje bez zmian (nad głową mówiącego)", () => {
    const want = { x: 200, bottom: 300 };
    expect(placeBubble(want, SIZE, HERO, VIEW)).toEqual(want);
  });

  it("mówiący stoi nad bohaterem, pod nim, obok i na ukos: dymek nigdy nie zachodzi na bohatera", () => {
    for (const dist of [20, 60, 120, 220, 400]) {
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * 2 * Math.PI;
        const cx = (HERO.left + HERO.right) / 2 + Math.cos(angle) * dist;
        const cy = (HERO.top + HERO.bottom) / 2 + Math.sin(angle) * dist;
        // pożądane miejsce: nad głową mówiącego (jego stopy w cy + 60, głowa ok. 110 px wyżej, plus etykieta)
        const want = { x: cx, bottom: cy + 60 - 130 };
        const spot = placeBubble(want, SIZE, HERO, VIEW);
        const rect = rectAt(spot, SIZE.w, SIZE.h);
        expect(overlaps(rect, HERO), `dist ${dist} kąt ${k}`).toBe(false);
        expect(rect.left).toBeGreaterThanOrEqual(VIEW.left - 1e-6);
        expect(rect.right).toBeLessThanOrEqual(VIEW.right + 1e-6);
        expect(rect.top).toBeGreaterThanOrEqual(VIEW.top - 1e-6);
        expect(rect.bottom).toBeLessThanOrEqual(VIEW.bottom + 1e-6);
      }
    }
  });

  it("przewodniczka tuż pod bohaterem (jak na początku trasy): dymek ucieka na bok, nie na gracza", () => {
    // jej głowa jest na wysokości stóp bohatera, więc dymek nad nią wypadłby na bohaterze
    const want = { x: 640, bottom: 330 };
    const spot = placeBubble(want, SIZE, HERO, VIEW);
    expect(overlaps(rectAt(spot, SIZE.w, SIZE.h), HERO)).toBe(false);
    // zostaje blisko mówiącej (w zasięgu jednego dymka), a nie w drugim końcu ekranu
    expect(Math.hypot(spot.x - want.x, spot.bottom - want.bottom)).toBeLessThan(300);
  });

  it("wybiera najbliższe wolne miejsce, nie pierwsze z brzegu", () => {
    const want = { x: 700, bottom: 330 }; // z prawej strony bohatera: prawe miejsce jest bliżej niż lewe
    const spot = placeBubble(want, SIZE, HERO, VIEW);
    expect(spot.x).toBeGreaterThan(HERO.right);
  });

  it("gdy ekran jest za wąski na jakiekolwiek wolne miejsce, wybiera to o najmniejszym nałożeniu i nie wychodzi poza ekran", () => {
    const narrow: Rect = { left: 0, top: 96, right: 340, bottom: 400 };
    const hero: Rect = { left: 120, top: 150, right: 220, bottom: 300 };
    const spot = placeBubble({ x: 170, bottom: 220 }, SIZE, hero, narrow);
    const rect = rectAt(spot, SIZE.w, SIZE.h);
    expect(rect.left).toBeGreaterThanOrEqual(narrow.left - 1e-6);
    expect(rect.right).toBeLessThanOrEqual(narrow.right + 1e-6);
  });
});
