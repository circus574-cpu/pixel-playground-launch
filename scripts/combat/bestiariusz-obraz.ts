import { MONSTERS } from "../../src/game/monsters/catalog";
import type { FxSpec } from "../../src/game/monsters/types";

/**
 * Obraz bestiariusza prosto z kodu: statystyki, umiejętności i efekty statusowe, które potwór
 * realnie nakłada na gracza. Statusy docierają trzema drogami (umiejętność, cios podstawowy,
 * cecha pokroju eksplozji), więc raport liczy wszystkie trzy — inaczej zmyla, że potwór jest
 * „bezbronny", gdy jego zwykły cios kogoś oślepia.
 */
const nazwa = (fx: FxSpec): string => (fx.k === "dot" ? fx.id : fx.k);

const wiersze = MONSTERS.map((m) => {
  const um = m.skills ?? [];
  const efekty = [
    ...um.flatMap((s) => (s.fx ?? []).map(nazwa)),
    ...(m.basicFx ?? []).map(nazwa),
    ...(m.traits.explode?.fx ?? []).map(nazwa),
  ];
  return {
    id: m.id,
    swiat: m.world,
    lvl: m.level,
    hp: m.hp,
    atk: m.atk,
    def: m.def,
    cd: m.attackCd,
    um: um.length,
    statusy: [...new Set(efekty)].join(",") || "BRAK",
  };
});

const bez = (pole: "um" | "statusy") =>
  wiersze.filter((w) => (pole === "um" ? w.um === 0 : w.statusy === "BRAK")).map((w) => w.id);

console.table(wiersze);
console.log("potworów:", wiersze.length);
console.log("bez umiejętności (tylko cios podstawowy):", bez("um"));
console.log("bez żadnego efektu statusowego:", bez("statusy"));
console.log(
  "użyte efekty:",
  [...new Set(wiersze.flatMap((w) => (w.statusy === "BRAK" ? [] : w.statusy.split(","))))].sort(),
);
