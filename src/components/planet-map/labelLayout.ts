/** Which places of the 2D atlas show a name at a given zoom, without piling labels on top of each other. */
export type Box = [number, number, number, number];
export type Place = {
  id: string;
  land: string;
  kind: string;
  name: string;
  x: number;
  y: number;
};
/** Zoom from which a kind of place gets its name (capitals always). */
export const NAME_ZOOM: Record<string, number> = {
  capital: 0,
  town: 2.5,
  famous: 3,
  village: 6,
  camp: 5,
};
export const meets = (a: Box, b: Box) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Higher in the list wins a contested label spot: capitals first, camps last. */
const LABEL_PRIORITY = ["capital", "town", "famous", "village", "camp"];
/**
 * Places inside the visible rectangle with their label decision. Labels are placed greedily in
 * priority order and a label that would overlap one already placed is dropped, so
 * dozens of camps at high zoom do not pile their names on top of each other.
 */
export function visiblePlaces(
  places: readonly Place[],
  bounds: Box,
  zoom: number,
  px: (screen: number) => number,
) {
  const candidates = places
    .filter((p) => {
      const big = p.kind === "capital" || p.kind === "town" || p.kind === "famous";
      if (!big && zoom < 3) return false;
      return p.x >= bounds[0] && p.x <= bounds[2] && p.y >= bounds[1] && p.y <= bounds[3];
    })
    .map((p) => {
      const big = p.kind === "capital" || p.kind === "town" || p.kind === "famous";
      const r = px(p.kind === "capital" ? 7 : big ? 5 : 3.5);
      return { p, r, wants: zoom >= (NAME_ZOOM[p.kind] ?? 9) && !!p.name };
    });
  const rank = (kind: string) => {
    const i = LABEL_PRIORITY.indexOf(kind);
    return i < 0 ? LABEL_PRIORITY.length : i;
  };
  const order = [...candidates].sort((a, b) => rank(a.p.kind) - rank(b.p.kind));
  const labels: Box[] = [];
  const gap = px(3);
  const shown = new Set<(typeof candidates)[number]>();
  for (const c of order) {
    if (!c.wants) continue;
    // Cinzel 600 is wide: about 0.74 em per character.
    const half = (c.p.name.length * px(11) * 0.74) / 2;
    const top = c.p.y + c.r + px(12) - px(11);
    const box: Box = [c.p.x - half - gap, top - gap, c.p.x + half + gap, top + px(11) + gap];
    if (labels.some((o) => meets(o, box))) continue;
    // A name never covers the icon of a more important place (a camp's name stays off a town).
    if (
      candidates.some(
        (o) =>
          rank(o.p.kind) < rank(c.p.kind) &&
          meets(box, [o.p.x - o.r, o.p.y - o.r, o.p.x + o.r, o.p.y + o.r]),
      )
    )
      continue;
    labels.push(box);
    shown.add(c);
  }
  return candidates.map((c) => ({ p: c.p, r: c.r, named: shown.has(c) }));
}
