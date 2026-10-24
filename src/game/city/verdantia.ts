import {
  FOREST_ORIGIN,
  FOREST_RIVER,
  VERDANT_SIZE,
  FOREST_OBJECTS,
  type ForestObject,
} from "../world/forest";
import type { WorldNpc } from "../world/types";
import type { BuildingId, CityDefinition } from "./types";

// Planned in the valley's own coordinates (0,0 .. 3072×2048), then moved onto the continent.
// Six services in separate districts, at least 700 units apart: the west bank (trade, craft),
// the north and south middle (hall, depot) and the far bank of the river (inn, training).
const O = FOREST_ORIGIN;
const plots = [
  {
    id: "shop",
    name: "Dom Handlowy Mio",
    district: "Dzielnica kupiecka",
    kind: "cottage",
    x: 350 + O.x,
    y: 560 + O.y,
    description: "Mikstury, wyposażenie i skup materiałów.",
  },
  {
    id: "hall",
    name: "Dom Zgromadzeń",
    district: "Górny taras",
    kind: "inn",
    x: 1250 + O.x,
    y: 330 + O.y,
    description: "Mieszkańcy i przewodnik po usługach miasta.",
  },
  {
    id: "inn",
    name: "Gospoda pod Liściem",
    district: "Ogrody wschodnie",
    kind: "inn",
    x: 3150 + O.x,
    y: 650 + O.y,
    description: "Odpoczynek i regeneracja życia oraz KI.",
  },
  {
    id: "smithy",
    name: "Kuźnia Taro",
    district: "Dzielnica rzemieślnicza",
    kind: "forge",
    x: 350 + O.x,
    y: 1700 + O.y,
    description: "Ulepszanie ostrza i przygotowanie wyposażenia.",
  },
  {
    id: "depot",
    name: "Depozyt Korzeni",
    district: "Południowa aleja",
    kind: "cottage",
    x: 1300 + O.x,
    y: 1900 + O.y,
    description: "Osobista skrzynia tej postaci: przedmioty i materiały.",
  },
  {
    id: "arena",
    name: "Dom Treningu",
    district: "Dziedziniec straży",
    kind: "inn",
    x: 3150 + O.x,
    y: 1750 + O.y,
    description: "Bezpieczna arena z manekinem i pomiarem obrażeń.",
  },
] as const;
// Main avenue across the bridge, plus an access road to every door.
const roads = [
  { x: 250 + O.x, y: 940 + O.y, width: 3050, height: 120 },
  { x: 290 + O.x, y: 640 + O.y, width: 120, height: 1200 },
  { x: 1190 + O.x, y: 380 + O.y, width: 120, height: 600 },
  { x: 1240 + O.x, y: 1000 + O.y, width: 120, height: 1000 },
  { x: 3090 + O.x, y: 700 + O.y, width: 120, height: 1160 },
];
/** The safe city: 4000 × 2500 units centred on the valley. */
export const VERDANT_CITY_BOUNDS = {
  x: O.x + 1536 - 2000,
  y: O.y + 1024 - 1250,
  width: 4000,
  height: 2500,
};
export const VERDANT_CITY: CityDefinition = {
  name: "Zielona Przystań",
  bounds: VERDANT_CITY_BOUNDS,
  buildings: plots.map((p) => ({ ...p, objectId: "city-" + p.id, door: { x: p.x, y: p.y + 75 } })),
  roads,
};
const oldBuildings = new Set(["cottage", "inn", "forge", "market"]);
const inClearing = (o: ForestObject) =>
  plots.some((p) => Math.abs(o.x - p.x) < 355 && o.y > p.y - 450 && o.y < p.y + 190) ||
  roads.some(
    (r) =>
      o.x > r.x - 95 && o.x < r.x + r.width + 95 && o.y > r.y - 70 && o.y < r.y + r.height + 70,
  );
export const CITY_OBJECTS: readonly ForestObject[] = [
  ...FOREST_OBJECTS.filter(
    (o) =>
      !oldBuildings.has(o.kind) &&
      (!inClearing(o) || ["bridge", "fountain", "lamp"].includes(o.kind)),
  ),
  ...plots.map((p) => ({
    id: "city-" + p.id,
    kind: p.kind,
    x: p.x,
    y: p.y,
    width: 500,
    height: 440,
    anchorX: 0.5,
    anchorY: 0.85,
    solid: true,
    footprint: { width: 330, height: 110, offsetY: -30 },
  })),
];
export const CITY_OBSTACLES = [
  ...FOREST_RIVER,
  ...CITY_OBJECTS.filter((o) => o.solid && o.footprint).map((o) => ({
    x: o.x - o.footprint!.width / 2,
    y: o.y + (o.footprint!.offsetY ?? 0) - o.footprint!.height / 2,
    width: o.footprint!.width,
    height: o.footprint!.height,
  })),
];
const DOOR = Object.fromEntries(VERDANT_CITY.buildings.map((b) => [b.id, b.door])) as Record<
  BuildingId,
  { x: number; y: number }
>;
export const CITY_NPCS: WorldNpc[] = [
  {
    id: "guide",
    name: "Aira",
    role: "Przewodniczka miasta",
    x: 1570 + O.x,
    y: 1250 + O.y,
    tint: 0xa8f0cf,
    dialogue:
      "Witaj w Zielonej Przystani. Odwiedź Rynek na północ od fontanny i wróć po 40 XP. Miasto jest bezpieczne, a usługi znajdziesz w osobnych dzielnicach — otwórz plan miasta.",
  },
  {
    id: "hunter",
    name: "Ren",
    role: "Strażnik bramy",
    x: 2210 + O.x,
    y: 1150 + O.y,
    tint: 0xffc7a4,
    dialogue:
      "W mieście nie ma dzików, ale tuż za jego granicą w lesie czają się dziki. Pokonaj trzy, a otrzymasz ostrze strażnika. Poćwiczyć możesz wcześniej w Domu Treningu.",
  },
  {
    id: "merchant",
    name: "Mio",
    role: "Kupczyni",
    x: DOOR.shop.x,
    y: DOOR.shop.y,
    tint: 0xd6b3ff,
    building: "shop",
  },
  {
    id: "smith",
    name: "Taro",
    role: "Kowal",
    x: DOOR.smithy.x,
    y: DOOR.smithy.y,
    tint: 0xa4d5ff,
    building: "smithy",
    dialogue:
      "Ostrze kupisz u Mio. Po zapoznaniu się z miastem mogę nauczyć cię wyposażania broni. Ulepszenie założonego ostrza kosztuje 15 monet i dodaje 4 ataku.",
  },
  {
    id: "keeper",
    name: "Nela",
    role: "Opiekunka depozytu",
    x: DOOR.depot.x,
    y: DOOR.depot.y,
    tint: 0xe3d49b,
    building: "depot",
    dialogue:
      "Skrzynia po prawej należy wyłącznie do tej postaci. Możesz odłożyć przedmioty i materiały oraz odebrać je później. Najpierw zdejmij rzeczy, które nosisz. Depozyt jest zapisywany na tym urządzeniu.",
  },
  {
    id: "trainer",
    name: "Iwo",
    role: "Mistrz treningu",
    x: DOOR.arena.x,
    y: DOOR.arena.y,
    tint: 0xffd191,
    building: "arena",
    dialogue:
      "Manekin nie atakuje i nie daje łupów, monet ani XP. Używaj swoich prawdziwych umiejętności: koszty KI i odnowienia działają normalnie. Licznik pokaże trafienia i obrażenia.",
  },
  {
    id: "innkeeper",
    name: "Lina",
    role: "Gospodyni",
    x: DOOR.inn.x,
    y: DOOR.inn.y,
    tint: 0xedb5c8,
    building: "inn",
    dialogue:
      "Odpoczynek kosztuje 5 monet i przywraca życie oraz KI. Przy pełnych zasobach nic nie zapłacisz.",
  },
  {
    id: "steward",
    name: "Oren",
    role: "Opiekun miasta",
    x: DOOR.hall.x,
    y: DOOR.hall.y,
    tint: 0xcadfb2,
    building: "hall",
    dialogue:
      "Zielona Przystań ma sześć dzielnic usługowych połączonych alejami. Kupcy są na północnym zachodzie, kuźnia na południowym zachodzie, a depozyt przy południowej alei. Gospoda i trening leżą na wschodzie.",
  },
];
/** Wild boars live beyond the city bounds, on a ring around them. */
export const VERDANT_BOARS = Array.from({ length: 20 }, (_, i) => {
  const angle = (2 * Math.PI * (i + 0.5)) / 20 + 0.35,
    ring = i % 3;
  return {
    x: Math.round(
      VERDANT_CITY_BOUNDS.x +
        VERDANT_CITY_BOUNDS.width / 2 +
        (VERDANT_CITY_BOUNDS.width / 2 + 450 + ring * 160) * Math.SQRT2 * Math.cos(angle),
    ),
    y: Math.round(
      VERDANT_CITY_BOUNDS.y +
        VERDANT_CITY_BOUNDS.height / 2 +
        (VERDANT_CITY_BOUNDS.height / 2 + 450 + ring * 120) * Math.SQRT2 * Math.sin(angle),
    ),
  };
});
