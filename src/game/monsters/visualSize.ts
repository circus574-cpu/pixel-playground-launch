import { BODY_EXTENT } from "./bodyExtent.generated";

/**
 * On-screen size of a creature in world v2 (presentation only: reach, hit boxes and collision stay in the monster rules).
 * The delivered sprites do not reflect the bestiary size class (all fill about 75-80% of their frame), so the drawn frame
 * is computed from the measured body: frame = class body size x per-monster factor / measured body extent.
 * Bosses are drawn at 180 px (about 145 px of body), so no regular creature may exceed that.
 */
export type SizeClass = "S" | "M" | "L";

/** Target body size (px, larger body dimension) per bestiary class. A hero is about 96 px tall. */
export const CLASS_BODY_PX: Readonly<Record<SizeClass, number>> = { S: 50, M: 82, L: 116 };

/**
 * Hand-maintained variety inside a class (owner 04.11.2026: all creatures looked the same size).
 * 1 = class size; edit freely, the test only requires 0.75-1.2 so bosses stay the biggest.
 */
export const VISUAL_SCALE: Readonly<Record<string, number>> = {
  "verdant-mchowy-szlamak": 1.0,
  "verdant-cierniowy-wilk": 1.05,
  "verdant-lisciak-skrytobojca": 0.85,
  "verdant-korzeniowy-pelzacz": 0.9,
  "verdant-grzybowy-zarodnik": 0.8,
  "verdant-bursztynowa-osa": 0.75,
  "verdant-skalny-jelen": 0.95,
  "verdant-lesny-pajak": 0.9,
  "verdant-puchacz-pylowy": 0.95,
  "verdant-straznik-ruin": 1.2,
  "aether-swietlik-pieczeci": 0.9,
  "aether-pergaminowy-straznik": 1.0,
  "aether-krysztalowy-motyl": 0.75,
  "aether-szmaragdowy-waz": 1.1,
  "aether-duch-bibliotekarza": 1.05,
  "aether-zloty-skarabeusz": 1.0,
  "aether-lew-swiatyni": 1.0,
  "aether-oko-wiedzy": 0.8,
  "aether-marionetka-rytualu": 1.15,
  "aether-mgielny-zuraw": 0.9,
  "nexus-dron-zwiadowca": 0.9,
  "nexus-pelzacz-serwisowy": 1.05,
  "nexus-skaner-gasienicowy": 1.0,
  "nexus-pajak-spawalniczy": 0.95,
  "nexus-wiezyczka-autonomiczna": 0.9,
  "nexus-roj-nanitow": 1.1,
  "nexus-pies-lowca": 1.05,
  "nexus-straznik-rdzenia": 1.1,
  "nexus-latarnia-plazmowa": 1.0,
  "nexus-kruk-danych": 0.8,
  "pyra-wegielek": 0.85,
  "pyra-ognista-salamandra": 1.0,
  "pyra-popielny-wilk": 1.1,
  "pyra-skalny-berserker": 1.1,
  "pyra-magmowy-krab": 0.85,
  "pyra-zarowy-nietoperz": 0.75,
  "pyra-golem-ruin": 1.15,
  "pyra-plomien-duch": 1.05,
  "pyra-byk-areny": 1.05,
  "pyra-skorpion-obsydianowy": 0.95,
};

/** `?ki-monster-sizes=0` restores the old uniform size classes (default on since owner request 04.11.2026). */
export function monsterSizesEnabled(search: string): boolean {
  return new URLSearchParams(search).get("ki-monster-sizes") !== "0";
}

/** Side (px) of the square frame to draw a creature in, or undefined when it has no measured body (caller keeps the old size). */
export function monsterFramePx(kind: string, sizeClass: SizeClass): number | undefined {
  const extent = BODY_EXTENT[kind];
  if (!extent) return undefined;
  return Math.round((CLASS_BODY_PX[sizeClass] * (VISUAL_SCALE[kind] ?? 1)) / extent);
}
