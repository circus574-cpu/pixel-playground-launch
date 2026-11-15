import { distance, type Point } from "../navigation";

/**
 * Opis położenia dla przewodniczki: strona świata i czas marszu. Mapa gry ma oś Y skierowaną w dół, czyli północ to
 * mniejsze Y. Bez nazw „w lewo/w prawo”, bo zależą od kierunku patrzenia gracza, a mapa i minimapa mają stałą północ.
 */
const DIRECTIONS = [
  "na wschód",
  "na południowy wschód",
  "na południe",
  "na południowy zachód",
  "na zachód",
  "na północny zachód",
  "na północ",
  "na północny wschód",
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Kierunek z `from` do `to` w ośmiu stronach świata. Dla punktów zbyt bliskich, by wskazać stronę, zwraca null. */
export function compass(from: Point, to: Point): Direction | null {
  if (distance(from, to) < 60) return null;
  const angle = Math.atan2(to.y - from.y, to.x - from.x); // 0 = wschód, rośnie w stronę południa (Y w dół)
  const index = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS[((index % 8) + 8) % 8]!;
}

/** Prędkość podstawowa bohatera (jedn./s). Służy tylko do oszacowania czasu marszu w opisie. */
export const HERO_WALK_SPEED = 175;

/** „ok. 15 s drogi”: czas marszu zaokrąglony do 5 s (minimum 5 s), bo dokładniejsza liczba byłaby fałszywa. */
export function walkTime(units: number): string {
  const seconds = Math.max(5, Math.round(units / HERO_WALK_SPEED / 5) * 5);
  return seconds >= 60 ? "ponad minutę drogi" : "ok. " + seconds + " s drogi";
}

/** Stała fraza położenia względem punktu odniesienia, np. „na północny wschód, ok. 15 s drogi”. */
export function whereIs(from: Point, to: Point): string {
  const d = distance(from, to);
  if (d < 220) return "tuż obok, na wyciągnięcie ręki";
  const direction = compass(from, to);
  return (direction ? direction + ", " : "") + walkTime(d);
}
