import type Phaser from "phaser";
import "./fonts.css";

/**
 * Napisy w świecie gry: dymki rozmów, nazwy postaci, nazwy budynków, znaczniki trasy i liczby obrażeń. Wszystkie
 * dzielą jeden język graficzny: kapitaliki Cinzel dla nazw i napisów-etykiet, kursywa Alegreya dla mowy, ciepła
 * kremowa wypełniona litera z ciemnobrązowym obrysem i miękkim cieniem. Żadnych teł, ramek ani plakietek: napis leży
 * wprost na świecie, a czytelność daje obrys, nie prostokąt.
 *
 * Rozmiary podane w tabeli to rozmiary NA EKRANIE w pikselach; scena skaluje napis przez `1 / zoom`, żeby nie rósł ani
 * nie malał razem z kamerą (patrz `screenTextScale`).
 */
export type WorldTextKind =
  | "speech"
  | "npcName"
  | "heroName"
  | "enemyName"
  | "building"
  | "tag"
  | "tour"
  | "damage"
  | "heal"
  | "interiorTitle"
  | "exitSign";

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Nazwy krojów zdefiniowane w `fonts.css`; dalej kroje zapasowe, gdy plik się nie wczyta. */
export const FONT_DISPLAY = "'Ki Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
export const FONT_SPEECH = "'Ki Alegreya', 'Palatino Linotype', Georgia, 'Times New Roman', serif";

/** Ciemny, ciepły obrys: czytelny na trawie, piasku, śniegu i lawie. */
export const INK = "#1b1109";
const SHADOW = "#000000b3";

function shadow(blur: number, offsetY = 2): Phaser.Types.GameObjects.Text.TextShadow {
  return { offsetX: 0, offsetY, color: SHADOW, blur, stroke: true, fill: true };
}

const BASE: Record<WorldTextKind, TextStyle> = {
  speech: {
    fontFamily: FONT_SPEECH,
    fontStyle: "italic 600",
    fontSize: "20px",
    color: "#fff9e8",
    stroke: INK,
    strokeThickness: 6,
    align: "center",
    lineSpacing: 2,
    shadow: shadow(5),
    wordWrap: { width: 360, useAdvancedWrap: true },
  },
  npcName: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "15px",
    letterSpacing: 1.5,
    color: "#ffe9a8",
    stroke: INK,
    strokeThickness: 5,
    shadow: shadow(4),
  },
  heroName: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "15px",
    letterSpacing: 1.5,
    color: "#d9f6ff",
    stroke: INK,
    strokeThickness: 5,
    shadow: shadow(4),
  },
  enemyName: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "15px",
    letterSpacing: 1.5,
    color: "#ffd9cf",
    stroke: "#2a0d0a",
    strokeThickness: 5,
    shadow: shadow(4),
  },
  building: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "19px",
    letterSpacing: 2.5,
    color: "#fff0c8",
    stroke: INK,
    strokeThickness: 6,
    align: "center",
    shadow: shadow(6, 3),
  },
  tag: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "13px",
    letterSpacing: 1,
    color: "#f4e0b5",
    stroke: INK,
    strokeThickness: 5,
    align: "center",
    shadow: shadow(4),
  },
  tour: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "18px",
    letterSpacing: 2,
    color: "#ffe9a8",
    stroke: INK,
    strokeThickness: 6,
    align: "center",
    shadow: shadow(6, 3),
  },
  damage: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "24px",
    stroke: INK,
    strokeThickness: 6,
    shadow: shadow(5, 3),
  },
  heal: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "24px",
    color: "#c8ffd9",
    stroke: "#0d2416",
    strokeThickness: 6,
    shadow: shadow(5, 3),
  },
  interiorTitle: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "46px",
    letterSpacing: 5,
    color: "#f5e6b4",
    stroke: INK,
    strokeThickness: 11,
    align: "center",
    shadow: shadow(10, 4),
  },
  exitSign: {
    fontFamily: FONT_DISPLAY,
    fontStyle: "700",
    fontSize: "22px",
    letterSpacing: 3,
    color: "#e9f6dd",
    stroke: INK,
    strokeThickness: 7,
    align: "center",
    shadow: shadow(6, 3),
  },
};

/** Styl Phasera dla rodzaju napisu; `over` nadpisuje pojedyncze pola (np. kolor liczby obrażeń). */
export function worldTextStyle(kind: WorldTextKind, over: Partial<TextStyle> = {}): TextStyle {
  const base = BASE[kind];
  return {
    ...base,
    ...over,
    ...(base.wordWrap && !over.wordWrap ? { wordWrap: { ...base.wordWrap } } : {}),
  };
}

/** Nazwa postaci w kolorach swojej strony: bohater, rozmówca, wróg. */
export function actorNameKind(kind: "hero" | "npc" | "enemy"): WorldTextKind {
  return kind === "hero" ? "heroName" : kind === "enemy" ? "enemyName" : "npcName";
}

/** Skala napisu o stałej wielkości na ekranie niezależnie od przybliżenia kamery. */
export function screenTextScale(zoom: number): number {
  return 1 / Math.max(zoom, 0.05);
}

/** Nazwa budynku jest w pełni widoczna blisko bohatera i znika płynnie z odległością (jednostki świata). */
export const LABEL_NEAR = 750;
export const LABEL_FAR = 1250;
export function labelFade(distance: number, near = LABEL_NEAR, far = LABEL_FAR): number {
  if (distance <= near) return 1;
  if (distance >= far) return 0;
  return 1 - (distance - near) / (far - near);
}

let loading: Promise<boolean> | undefined;
/**
 * Ładuje kroje napisów do dokumentu, zanim scena pierwszy raz zmierzy tekst (Phaser liczy rozmiar napisu przy
 * tworzeniu, więc napis zmierzony zapasowym krojem miałby złą szerokość). Zwraca `false` przy braku obsługi lub
 * przekroczeniu czasu: wtedy gra pokazuje napisy krojem zapasowym, nie czeka dłużej.
 */
export function loadWorldFonts(timeoutMs = 2500): Promise<boolean> {
  if (loading) return loading;
  if (typeof document === "undefined" || !document.fonts?.load)
    return (loading = Promise.resolve(false));
  // Próbka zawiera polskie litery, żeby przeglądarka pobrała też podzbiór latin-ext.
  const sample = "AaĄąĆćĘęŁłŃńÓóŚśŹźŻż0123456789";
  const loaded = Promise.all([
    document.fonts.load("700 20px 'Ki Cinzel'", sample),
    document.fonts.load("italic 600 20px 'Ki Alegreya'", sample),
  ]).then(
    () => true,
    () => false,
  );
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return (loading = Promise.race([loaded, timeout]));
}
