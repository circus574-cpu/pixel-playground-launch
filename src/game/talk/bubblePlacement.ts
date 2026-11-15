/**
 * Ustawienie dymka rozmowy na ekranie tak, żeby nie zasłaniał bohatera. Kamera śledzi bohatera, więc stoi on w środku
 * ekranu, a przewodniczka idzie tuż obok niego: dymek wiszący dokładnie nad jej głową bardzo często lądował na graczu.
 * Czysta geometria w pikselach ekranu, bez Phasera.
 */
export type Rect = { left: number; top: number; right: number; bottom: number };

export type BubbleSpot = { x: number; bottom: number };

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Dymek o środku w `x` i dolnej krawędzi w `bottom`. */
const rectAt = (spot: BubbleSpot, w: number, h: number): Rect => ({
  left: spot.x - w / 2,
  right: spot.x + w / 2,
  top: spot.bottom - h,
  bottom: spot.bottom,
});

/** Trzyma dymek w widocznym obszarze (z marginesem na paski interfejsu); większy od obszaru wyśrodkowuje. */
function clamp(spot: BubbleSpot, w: number, h: number, view: Rect): BubbleSpot {
  const minX = view.left + w / 2,
    maxX = view.right - w / 2;
  const minB = view.top + h,
    maxB = view.bottom;
  return {
    x: minX > maxX ? (view.left + view.right) / 2 : Math.min(maxX, Math.max(minX, spot.x)),
    bottom:
      minB > maxB ? (view.top + view.bottom + h) / 2 : Math.min(maxB, Math.max(minB, spot.bottom)),
  };
}

/**
 * Zwraca miejsce dymka najbliższe pożądanemu (nad głową mówiącego), które nie zachodzi na `avoid` (bohater z jego
 * etykietą) i mieści się w `view`. Gdy żadne miejsce nie jest wolne, wybiera to o najmniejszym nałożeniu.
 */
export function placeBubble(
  want: BubbleSpot,
  size: { w: number; h: number },
  avoid: Rect,
  view: Rect,
  gap = 10,
): BubbleSpot {
  const { w, h } = size;
  const candidates: BubbleSpot[] = [
    want,
    { x: avoid.left - gap - w / 2, bottom: want.bottom }, // obok bohatera, z lewej
    { x: avoid.right + gap + w / 2, bottom: want.bottom }, // obok bohatera, z prawej
    { x: want.x, bottom: avoid.top - gap }, // nad bohaterem
    { x: want.x, bottom: avoid.bottom + gap + h }, // pod bohaterem
    { x: avoid.left - gap - w / 2, bottom: avoid.top - gap }, // narożniki: nad i z boku
    { x: avoid.right + gap + w / 2, bottom: avoid.top - gap },
  ].map((c) => clamp(c, w, h, view));
  let best = candidates[0]!;
  let bestOverlap = Infinity;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const o = overlapArea(rectAt(c, w, h), avoid);
    const d = Math.hypot(c.x - want.x, c.bottom - want.bottom);
    if (o < bestOverlap - 1e-6 || (Math.abs(o - bestOverlap) <= 1e-6 && d < bestDistance)) {
      best = c;
      bestOverlap = o;
      bestDistance = d;
    }
    if (o === 0 && c === candidates[0]) return c; // pożądane miejsce jest wolne
  }
  return best;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return overlapArea(a, b) > 0;
}
export { rectAt };
