import { describe, expect, it } from "vitest";
import {
  actorNameKind,
  labelFade,
  LABEL_FAR,
  LABEL_NEAR,
  screenTextScale,
  worldTextStyle,
  type WorldTextKind,
} from "../game/typography/worldText";

const KINDS: WorldTextKind[] = [
  "speech",
  "npcName",
  "heroName",
  "enemyName",
  "building",
  "tour",
  "damage",
  "heal",
  "interiorTitle",
  "exitSign",
];

describe("napisy w świecie", () => {
  it("żaden rodzaj napisu nie ma tła ani wypełnionej plakietki: czytelność daje obrys", () => {
    for (const kind of KINDS) {
      const style = worldTextStyle(kind);
      expect(style.backgroundColor, kind).toBeUndefined();
      expect(style.padding, kind).toBeUndefined();
      expect(style.stroke, kind).toBeTruthy();
      expect(style.strokeThickness, kind).toBeGreaterThan(0);
    }
  });

  it("kroje to Cinzel dla nazw i Alegreya dla mowy, a nie domyślny Arial ani Courier", () => {
    expect(worldTextStyle("speech").fontFamily).toMatch(/Ki Alegreya/);
    for (const kind of KINDS.filter((k) => k !== "speech"))
      expect(worldTextStyle(kind).fontFamily, kind).toMatch(/Ki Cinzel/);
  });

  it("nadpisanie koloru nie psuje reszty stylu ani nie zmienia wspólnej definicji", () => {
    const red = worldTextStyle("damage", { color: "#ff0000" });
    expect(red.color).toBe("#ff0000");
    expect(red.stroke).toBe(worldTextStyle("damage").stroke);
    expect(worldTextStyle("damage").color).not.toBe("#ff0000");
    const a = worldTextStyle("speech");
    a.wordWrap!.width = 1;
    expect(worldTextStyle("speech").wordWrap!.width).toBe(360);
  });

  it("nazwy bohatera, rozmówcy i wroga mają osobne kolory", () => {
    const colors = (["hero", "npc", "enemy"] as const).map(
      (k) => worldTextStyle(actorNameKind(k)).color,
    );
    expect(new Set(colors).size).toBe(3);
  });

  it("nazwa budynku jest pełna blisko, gaśnie płynnie i znika z daleka", () => {
    expect(labelFade(0)).toBe(1);
    expect(labelFade(LABEL_NEAR)).toBe(1);
    const mid = labelFade((LABEL_NEAR + LABEL_FAR) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(labelFade(LABEL_FAR)).toBe(0);
    expect(labelFade(LABEL_FAR * 3)).toBe(0);
  });

  it("napis ma stały rozmiar na ekranie niezależnie od przybliżenia", () => {
    for (const zoom of [0.2, 0.48, 1, 1.6]) expect(screenTextScale(zoom) * zoom).toBeCloseTo(1, 6);
    expect(Number.isFinite(screenTextScale(0))).toBe(true);
  });
});
