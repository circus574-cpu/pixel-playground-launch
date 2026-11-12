import { KIT_NODES } from "./nodes.generated";
import { rankBonusPower, rankedAttackMultiplier } from "./rankScaling";
import type { RaceId } from "../world/races";

const number = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3, useGrouping: false })
  .format;
export const rankBasePercent = (rank: number) => number(100 * (1 + 0.1 * Math.max(0, rank - 1)));

/** Show current numerical effects without rewriting the archived owner annex/generated data.
 * Fixed geometry, costs, timing, thresholds and binary unlocks keep their existing rules.
 */
export function nodeDescription(race: RaceId, id: string, learned: readonly string[]): string {
  const node = KIT_NODES[race].find((n) => n.id === id);
  if (!node) return "";
  if (id === "R") return node.text;
  const rank = (key: string) => Math.max(1, learned.filter((n) => n === key).length);
  const p = rankBonusPower(rank(id)),
    power = (key: string) => (learned.includes(key) ? rankBonusPower(rank(key)) : 0);
  const dmg = (key: string, first: number) =>
    rankedAttackMultiplier(first, rankBonusPower(rank(key)));
  const key = race + ":" + id;
  switch (key) {
    case "planetary:B6":
      return `Impuls Ziemi zwraca ${number(5 * p)} KI za trafionego wroga (maks. ${number(15 * p)}).`;
    case "planetary:B8":
      return `Impuls Ziemi: promień +${number(40 * p)}% i ogłuszenie ${number(Math.min(3, 0.5 * p))} s. Wyklucza B7.`;
    case "planetary:C8":
      return `Korzenny Oddech zwraca ${number(15 * p)} KI. Wyklucza C7.`;
    case "sage:A5":
      return `Wybuch Pieczęci trafia też pobliskich wrogów za ×${number(p)} ATK.`;
    case "sage:A7":
      return `Wybuch zostawia krąg na 3 s, promień 120 j., obrażenia ×${number(0.4 * p)} ATK/s. Wyklucza A8.`;
    case "sage:A8":
      return `Wybuch Pieczęci zwraca ${number(15 * p)} KI. Wyklucza A7.`;
    case "sage:B3":
      return `Bariera trwa o ${number(2 * p)} s dłużej.`;
    case "android:C1": {
      const max = learned.includes("C8") ? 70 : learned.includes("C7") ? 150 : 100;
      return `Zużywa Ładunek: obrażenia od ×1 do ×${number(dmg(id, 1 + max / 50))} przy ${max} Ładunku, w linii przed postacią; bazowy koszt 15 KI; odn. 8 s.`;
    }
    case "android:C2":
      return `Przegrzanie trwa ${number(Math.max(0, 2 - p))} s zamiast 2 s; Ładunek opada o ${number(50 * p)}% szybciej.`;
    case "android:C7":
      return `Maks. Ładunek 150; Wyładowanie przy obecnej randze C1 do ×${number(dmg("C1", 4))}. Przegrzanie przy 150. Wyklucza C8.`;
    case "legend:A7":
      return `Ogniste Cięcie ma 5 cięć, łącznie ×${number(dmg("A1", 1.8) + 0.8 * p * (1 + 0.1 * (rank("A1") - 1)))} ATK przy obecnej randze A1. Wyklucza A8.`;
    case "legend:B7":
      return `Szał trwa o ${number(4 * p)} s dłużej i daje dodatkowe +${number(10 * p)}% ATK. Wyklucza B8.`;
    case "legend:C2":
      return `Żar rośnie o ${number(50 * p)}% szybciej; czas jego wygaszania ×${number(1 + p)}.`;
    case "legend:C4":
      return `Zużywa Żar: obszarowo ×${number(dmg(id, 1) * (1 + 0.25 * power("C8")))}–×${number(dmg(id, 3) * (1 + 0.25 * power("C8")))} ATK; 20 KI; odn. 12 s.`;
    case "legend:C9":
      return `Kolumna ognia ×${number(dmg(id, 4.5))} ATK i podpalenie łącznie ×${number(0.5 * p)} ATK przez 5 s; 35 KI; odn. 30 s.`;
  }
  let text = node.text.replace(/(\d+(?:[,.]\d+)?)%/g, (whole, value: string, offset: number) => {
    if (["android:A9", "planetary:B1"].includes(key)) return whole; // Execution threshold, not a bonus.
    let v = Number(value.replace(",", ".")) * p;
    if (
      [
        "planetary:C7",
        "sage:A2",
        "sage:B4",
        "sage:B5",
        "sage:B6",
        "android:A5",
        "android:B5",
        "android:B7",
      ].includes(key)
    )
      v = Math.min(90, v);
    if (key === "sage:B9" && textIsSlow(node.text, offset)) v = Math.min(90, v);
    return number(v) + "%";
  });
  text = text.replace(
    /×(\d+(?:[,.]\d+)?)/g,
    (_whole, value: string) =>
      "×" +
      number(
        ["active", "ultimate"].includes(node.type)
          ? dmg(id, Number(value.replace(",", ".")))
          : Number(value.replace(",", ".")) * p,
      ),
  );
  return text;
}
const textIsSlow = (text: string, offset: number) =>
  text.slice(Math.max(0, offset - 16), offset).includes("wrogowie");
