/**
 * Polish needs the guide, hunter and smith in the genitive ("wróć do Airy") and instrumental ("porozmawiaj z Airą") case.
 * Only names whose declension is unambiguous are listed; designations such as LYRA-7 and names that Polish usage leaves
 * undeclined or declines both ways (Taro, Goro, Mio, Iwo, Kenzo, Enso) stay as they are.
 */
const CASES: Record<string, { gen: string; ins: string }> = {
  Aira: { gen: "Airy", ins: "Airą" },
  Ren: { gen: "Rena", ins: "Renem" },
  Sora: { gen: "Sory", ins: "Sorą" },
  Ishin: { gen: "Ishina", ins: "Ishinem" },
  Kaena: { gen: "Kaeny", ins: "Kaeną" },
  Rokan: { gen: "Rokana", ins: "Rokanem" },
  Nela: { gen: "Neli", ins: "Nelą" },
  Lina: { gen: "Liny", ins: "Liną" },
  Oren: { gen: "Orena", ins: "Orenem" },
  Kaelen: { gen: "Kaelena", ins: "Kaelenem" },
  Soran: { gen: "Sorana", ins: "Soranem" },
  Yuna: { gen: "Yuny", ins: "Yuną" },
  Liora: { gen: "Liory", ins: "Liorą" },
  Ignis: { gen: "Ignisa", ins: "Ignisem" },
  Krag: { gen: "Kraga", ins: "Kragiem" },
};

export function npcNameCase(name: string, grammaticalCase: "gen" | "ins"): string {
  return CASES[name]?.[grammaticalCase] ?? name;
}
