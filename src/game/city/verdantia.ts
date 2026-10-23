import { FOREST, FOREST_OBJECTS, type ForestObject } from "../world/forest";
import type { WorldNpc } from "../world/types";
import type { CityDefinition } from "./types";

// At least 700 world units between services: separate neighbourhoods, not one plaza.
const plots = [
  {
    id: "shop",
    name: "Dom Handlowy Mio",
    district: "Dzielnica kupiecka",
    kind: "cottage",
    x: 500,
    y: 650,
    description: "Mikstury, wyposażenie i skup materiałów.",
  },
  {
    id: "hall",
    name: "Dom Zgromadzeń",
    district: "Górny taras",
    kind: "inn",
    x: 1400,
    y: 420,
    description: "Mieszkańcy i przewodnik po usługach miasta.",
  },
  {
    id: "inn",
    name: "Gospoda pod Liściem",
    district: "Ogrody wschodnie",
    kind: "inn",
    x: 2100,
    y: 620,
    description: "Odpoczynek i regeneracja życia oraz KI.",
  },
  {
    id: "smithy",
    name: "Kuźnia Taro",
    district: "Dzielnica rzemieślnicza",
    kind: "forge",
    x: 500,
    y: 1530,
    description: "Ulepszanie ostrza i przygotowanie wyposażenia.",
  },
  {
    id: "depot",
    name: "Depozyt Korzeni",
    district: "Południowa aleja",
    kind: "cottage",
    x: 1380,
    y: 1720,
    description: "Osobista skrzynia tej postaci: przedmioty i materiały.",
  },
  {
    id: "arena",
    name: "Dom Treningu",
    district: "Dziedziniec straży",
    kind: "inn",
    x: 2080,
    y: 1580,
    description: "Bezpieczna arena z manekinem i pomiarem obrażeń.",
  },
] as const;
const roads = [
  { x: 420, y: 735, width: 1660, height: 120 },
  { x: 420, y: 780, width: 140, height: 900 },
  { x: 1320, y: 490, width: 160, height: 1380 },
  { x: 2020, y: 690, width: 140, height: 1050 },
  { x: 460, y: 1110, width: 1770, height: 140 },
  { x: 460, y: 1670, width: 1690, height: 120 },
];
export const VERDANT_CITY: CityDefinition = {
  name: "Zielona Przystań",
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
  ...FOREST.riverRows,
  ...CITY_OBJECTS.filter((o) => o.solid && o.footprint).map((o) => ({
    x: o.x - o.footprint!.width / 2,
    y: o.y + (o.footprint!.offsetY ?? 0) - o.footprint!.height / 2,
    width: o.footprint!.width,
    height: o.footprint!.height,
  })),
];
export const CITY_NPCS: WorldNpc[] = [
  {
    id: "guide",
    name: "Aira",
    role: "Przewodniczka miasta",
    x: 1570,
    y: 1250,
    tint: 0xa8f0cf,
    dialogue:
      "Witaj w Zielonej Przystani. Odwiedź Rynek na północ od fontanny i wróć po 40 XP oraz 40 monet na pierwsze wyposażenie. Miasto jest bezpieczne. Usługi znajdziesz w osobnych dzielnicach — otwórz plan miasta.",
  },
  {
    id: "hunter",
    name: "Ren",
    role: "Strażnik bramy",
    x: 2210,
    y: 1150,
    tint: 0xffc7a4,
    dialogue:
      "W mieście nie ma dzików ani wrogich spawnów. Najpierw przygotuj wyposażenie i poćwicz w Domu Treningu. Wyprawy i przeciwnicy za bramą powstaną w następnym etapie.",
  },
  {
    id: "merchant",
    name: "Mio",
    role: "Kupczyni",
    x: 500,
    y: 725,
    tint: 0xd6b3ff,
    building: "shop",
  },
  {
    id: "smith",
    name: "Taro",
    role: "Kowal",
    x: 500,
    y: 1605,
    tint: 0xa4d5ff,
    building: "smithy",
    dialogue:
      "Ostrze kupisz u Mio. Po zapoznaniu się z miastem mogę nauczyć cię wyposażania broni. Ulepszenie założonego ostrza kosztuje 15 monet i dodaje 4 ataku.",
  },
  {
    id: "keeper",
    name: "Nela",
    role: "Opiekunka depozytu",
    x: 1380,
    y: 1795,
    tint: 0xe3d49b,
    building: "depot",
    dialogue:
      "Skrzynia po prawej należy wyłącznie do tej postaci. Możesz odłożyć przedmioty i materiały oraz odebrać je później. Najpierw zdejmij rzeczy, które nosisz. Depozyt jest zapisywany na tym urządzeniu.",
  },
  {
    id: "trainer",
    name: "Iwo",
    role: "Mistrz treningu",
    x: 2080,
    y: 1655,
    tint: 0xffd191,
    building: "arena",
    dialogue:
      "Manekin nie atakuje i nie daje łupów, monet ani XP. Używaj swoich prawdziwych umiejętności: koszty KI i odnowienia działają normalnie. Licznik pokaże trafienia i obrażenia.",
  },
  {
    id: "innkeeper",
    name: "Lina",
    role: "Gospodyni",
    x: 2100,
    y: 695,
    tint: 0xedb5c8,
    building: "inn",
    dialogue:
      "Odpoczynek kosztuje 5 monet i przywraca życie oraz KI. Przy pełnych zasobach nic nie zapłacisz.",
  },
  {
    id: "steward",
    name: "Oren",
    role: "Opiekun miasta",
    x: 1400,
    y: 495,
    tint: 0xcadfb2,
    building: "hall",
    dialogue:
      "Zielona Przystań ma sześć dzielnic usługowych połączonych alejami. Kupcy są na północnym zachodzie, kuźnia na południowym zachodzie, a depozyt przy południowej alei. Gospoda i trening leżą na wschodzie.",
  },
];
