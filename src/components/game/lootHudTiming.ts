/** Jak długo panel łupu zostaje na ekranie: stała część plus czas na przeczytanie każdej pozycji. */
export function lootHudDuration(lines: number, hasGold: boolean) {
  return 4200 + (lines + (hasGold ? 1 : 0)) * 450;
}
