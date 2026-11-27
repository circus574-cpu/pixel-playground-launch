import {
  CRAFTING_RECIPES,
  EQUIPMENT_SET_BONUSES,
  ITEM_CATALOG,
  PASSIVE_BUFF_SET_BONUSES,
  type CraftingRecipe,
  type ItemDefinition,
} from "../../game/items";
import type { AndroidItemCategory, AndroidItemDef, AndroidRace } from "./economy";

const VERIFIED_MATERIAL_ICONS = new Set([
  "bursztyn",
  "cewka",
  "ciern-wilka",
  "czerwony-grzyb",
  "czujnik",
  "elektroda",
  "esencja-plomienia",
  "eter-bibliotekarza",
  "fragment-ruin",
  "gasienica",
  "jad",
  "jedwab-pajaka",
  "kamien-runiczny",
  "kamien-swiatynny",
  "karta-pergaminu",
  "lufa",
  "luska-salamandry",
  "magmowy-pancerz",
  "maska-rytualu",
  "mchowa-galaretka",
  "modul-optyczny",
  "nanopyl",
  "nasiona",
  "nic-eteru",
  "obsydian",
  "pamiec-danych",
  "pioro-mgly",
  "pioro-puchacza",
  "plyta-pancerna",
  "popielne-futro",
  "poroze",
  "pyl-swiatla",
  "pyl",
  "rdzen-energii",
  "rdzen-plazmy",
  "rog-areny",
  "silownik",
  "skalna-skora",
  "skalny-kastet",
  "skarabeusz",
  "skora-wilcza",
  "skrzydlo-krysztalowe",
  "skrzydlo-zaru",
  "soczewka-wiedzy",
  "soczewka",
  "sok-lisciaka",
  "szklo-obsydianowe",
  "szmaragdowa-luska",
  "zadlo-osy",
  "zestaw-naprawczy",
  "zielone-ostrze",
  "zloty-pancerz",
]);

function mapV2Slot(item: ItemDefinition): number {
  switch (item.slot) {
    case "head":
      return 0;
    case "amulet":
      return 1;
    case "weapon":
      return 2;
    case "ring":
      return 3;
    case "armor":
      return 4;
    case "offhand":
      return 5;
    case "hands":
      return 6;
    case "feet":
      return 7;
    default:
      break;
  }
  switch (item.category) {
    case "helmet":
      return 0;
    case "amulet":
    case "buff":
    case "artifact":
      return 1;
    case "weapon":
      return 2;
    case "ring":
      return 3;
    case "armor":
    case "legs":
      return 4;
    case "shield":
      return 5;
    case "gloves":
      return 6;
    case "boots":
      return 7;
    default:
      return -1;
  }
}

function mapV2Category(item: ItemDefinition, slot: number): AndroidItemCategory {
  if (item.category === "consumable") return "consumable";
  if (item.category === "material" || item.category === "quest" || item.category === "tool")
    return "material";
  if (slot === 2) return "weapon";
  if (slot === 1 || slot === 3) return "jewelry";
  if (slot >= 0) return "armor";
  return "material";
}

function mapV2Icon(item: ItemDefinition, slot: number): string {
  if (VERIFIED_MATERIAL_ICONS.has(item.id)) return `material-${item.id}.webp`;
  if (item.category === "consumable") {
    const low = `${item.id} ${item.name}`.toLowerCase();
    if (low.includes("ki") || low.includes("mana") || low.includes("focus"))
      return "emblem_potion.webp";
    if (low.includes("zwoj") || low.includes("scroll")) return "emblem_scroll.webp";
    return item.rarity === "common" ? "item-potion.webp" : "gear-potion.webp";
  }
  switch (slot) {
    case 0:
      return "gear-helmet.webp";
    case 1:
      return item.category === "artifact" || item.category === "buff"
        ? "emblem_crystal.webp"
        : "gear-amulet.webp";
    case 2:
      return item.rarity === "legendary" || item.rarity === "epic"
        ? "emblem_swords.webp"
        : "gear-sword.webp";
    case 3:
      return "gear-ring.webp";
    case 4:
      return "gear-vest.webp";
    case 5:
      return "gear-shield.webp";
    case 6:
      return "gear-gloves.webp";
    case 7:
      return "gear-boots.webp";
    default:
      return item.category === "quest" ? "emblem_scroll.webp" : "gear-tusk.webp";
  }
}

export type AndroidCraftRecipe = {
  id: string;
  name: string;
  station: string;
  requiredLevel: number;
  cost: number;
  ingredients: readonly { id: string; qty: number }[];
  resultItemId: string;
  resultCount: number;
};

export type HeritageWeaponStage = {
  stage: number;
  id: string;
  race: AndroidRace;
  name: string;
  minLevel: number;
  goldCost: number;
  ingredients: readonly { id: string; qty: number }[];
  atk: number;
  crit: number;
  hp: number;
  ki: number;
  desc: string;
};

export const ENHANCE_MAX_LEVEL = 9;
export const ENHANCE_STAT_BONUS_PER_LEVEL = 0.08;

export function enhanceCostForNextTier(currentTier: number): {
  nextTier: number;
  gold: number;
  ingredients: readonly { id: string; qty: number }[];
} {
  const next = Math.max(1, Math.min(ENHANCE_MAX_LEVEL, Math.floor(currentTier) + 1));
  const gold = 55 * next * next;
  const ingredients: { id: string; qty: number }[] = [
    { id: "crystal_ki", qty: Math.min(5, Math.ceil(next / 2)) },
  ];
  if (next >= 7) {
    ingredients.push({ id: "mat_elite_core", qty: next - 6 });
  }
  return { nextTier: next, gold, ingredients };
}

const HERITAGE_SPECS: Record<
  AndroidRace,
  {
    prefix: string;
    matLow: string;
    matHigh: string;
    names: readonly [string, string, string, string, string, string];
  }
> = {
  legend: {
    prefix: "heritage_legend",
    matLow: "mat_obsidian",
    matHigh: "mat_ember",
    names: [
      "Ostrze Pierwszego Popiołu (Dziedzictwo I)",
      "Klinga Przerwanego Ciosu (Dziedzictwo II)",
      "Kowadło Mistrza Goro (Dziedzictwo III)",
      "Miecz Powracającej Straży (Dziedzictwo IV)",
      "Płomień Honorowego Pojedynku (Dziedzictwo V)",
      "Przysięga Jutra — Ostrze Pyry (Dziedzictwo VI)",
    ],
  },
  planetary: {
    prefix: "heritage_planetary",
    matLow: "mat_amber",
    matHigh: "mat_seeds",
    names: [
      "Laska Zatopionego Szlaku (Dziedzictwo I)",
      "Kij Dwóch Brzegów Rzeki (Dziedzictwo II)",
      "Glewia Znaków Strażnika (Dziedzictwo III)",
      "Korzeń Pieśni Verdantii (Dziedzictwo IV)",
      "Klinga Pamięci Puszczy (Dziedzictwo V)",
      "Nowy Szlak — Włócznia Natury (Dziedzictwo VI)",
    ],
  },
  sage: {
    prefix: "heritage_sage",
    matLow: "mat_rune",
    matHigh: "mat_lightdust",
    names: [
      "Kostur Białej Strony (Dziedzictwo I)",
      "Berło Dwóch Wspomnień (Dziedzictwo II)",
      "Pieczęć Bezimiennego Archiwisty (Dziedzictwo III)",
      "Klucz Ogrodu Biblioteki (Dziedzictwo IV)",
      "Laska Ceny Świadectwa (Dziedzictwo V)",
      "Kronika Eteru — Berło Mędrca (Dziedzictwo VI)",
    ],
  },
  android: {
    prefix: "heritage_android",
    matLow: "mat_titanium",
    matHigh: "mat_plasma_cell",
    names: [
      "Działo Pakietu Widmo (Dziedzictwo I)",
      "Karabin Zamkniętego Warsztatu (Dziedzictwo II)",
      "Rdzeń Wolnej Jednostki (Dziedzictwo III)",
      "Wiązka Trzech Podpisów (Dziedzictwo IV)",
      "Emiter Prawa Odmowy (Dziedzictwo V)",
      "Pierwszy Zapis Własny — Działo Nexus (Dziedzictwo VI)",
    ],
  },
};

export const HERITAGE_WEAPON_STAGES: readonly HeritageWeaponStage[] = (
  ["legend", "planetary", "sage", "android"] as const
).flatMap((race) => {
  const sp = HERITAGE_SPECS[race];
  const minLevels = [1, 4, 8, 12, 16, 20] as const;
  const costs = [80, 180, 360, 620, 980, 1500] as const;
  const atks = [16, 26, 38, 52, 68, 88] as const;
  const crits = [2, 4, 6, 8, 10, 14] as const;
  const hps = [20, 45, 80, 120, 175, 250] as const;
  const kis = [10, 20, 32, 48, 68, 95] as const;
  return minLevels.map((minLevel, idx) => {
    const stage = idx + 1;
    const ingredients: { id: string; qty: number }[] = [
      { id: idx < 3 ? sp.matLow : sp.matHigh, qty: 2 + idx },
      { id: "crystal_ki", qty: 1 + idx },
    ];
    if (stage >= 4) ingredients.push({ id: "mat_elite_core", qty: stage - 3 });
    return {
      stage,
      id: `${sp.prefix}_${stage}`,
      race,
      name: sp.names[idx]!,
      minLevel,
      goldCost: costs[idx]!,
      ingredients,
      atk: atks[idx]!,
      crit: crits[idx]!,
      hp: hps[idx]!,
      ki: kis[idx]!,
      desc: `Broń Dziedzictwa (Etap ${stage}/6 • Poz.${minLevel}) • +${atks[idx]} ATK • +${crits[idx]}% Kryt • +${hps[idx]} HP • +${kis[idx]} KI`,
    };
  });
});

export const BOSS_TROPHY_ITEMS: readonly AndroidItemDef[] = [
  {
    id: "serce-puszczy",
    name: "Serce Puszczy",
    cat: "jewelry",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "emblem_crystal.webp",
    slot: 1,
    desc: "Trofeum Bossa Ygdrashy • +140 HP • +45 KI • +12 DEF",
    shopPrice: null,
    sellPrice: 280,
    craftCost: null,
    hp: 140,
    ki: 45,
    def: 12,
  },
  {
    id: "zielona-esencja",
    name: "Zielona Esencja",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "elite",
    minLevel: 12,
    icon: "material-zielone-ostrze.webp",
    slot: -1,
    desc: "Skondensowana esencja Bossa Ygdrashy do rzemiosła i ulepszeń.",
    shopPrice: null,
    sellPrice: 95,
    craftCost: null,
  },
  {
    id: "kwiat-ygdrashy",
    name: "Kwiat Ygdrashy",
    cat: "jewelry",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "gear-ring.webp",
    slot: 3,
    desc: "Rzadki relikt Bossa Ygdrashy • +180 HP • +60 KI • +7% Kryt",
    shopPrice: null,
    sellPrice: 450,
    craftCost: null,
    hp: 180,
    ki: 60,
    crit: 7,
  },
  {
    id: "kiel-alfy",
    name: "Kieł Alfy Thorgara",
    cat: "weapon",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 20,
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "Trofeum Bossa Thorgara • +64 ATK • +11% Kryt • +18 SPD",
    shopPrice: null,
    sellPrice: 520,
    craftCost: null,
    atk: 64,
    crit: 11,
    spd: 18,
  },
  {
    id: "skora-thorgara",
    name: "Skóra Thorgara",
    cat: "material",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 18,
    icon: "material-skora-wilcza.webp",
    slot: -1,
    desc: "Ciernista skóra Alfy Thorgara do kucia pancerzy.",
    shopPrice: null,
    sellPrice: 130,
    craftCost: null,
  },
  {
    id: "pazury-alfy",
    name: "Pazury Alfy",
    cat: "armor",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 20,
    icon: "gear-gloves.webp",
    slot: 6,
    desc: "Rękawice Bossa Thorgara • +28 ATK • +18 DEF • +8% Kryt",
    shopPrice: null,
    sellPrice: 460,
    craftCost: null,
    atk: 28,
    def: 18,
    crit: 8,
  },
  {
    id: "szaty-arcykaplana",
    name: "Szaty Arcykapłana Pustki",
    cat: "armor",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "gear-vest.webp",
    slot: 4,
    desc: "Pancerz Bossa Arcykapłana • +160 HP • +90 KI • +28 DEF",
    shopPrice: null,
    sellPrice: 310,
    craftCost: null,
    hp: 160,
    ki: 90,
    def: 28,
  },
  {
    id: "eter-pustki",
    name: "Eter Pustki",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "elite",
    minLevel: 12,
    icon: "material-nic-eteru.webp",
    slot: -1,
    desc: "Czysty Eter Pustki z Sanktuarium Nicości.",
    shopPrice: null,
    sellPrice: 95,
    craftCost: null,
  },
  {
    id: "pieczec-arcykaplana",
    name: "Pieczęć Arcykapłana",
    cat: "jewelry",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "gear-amulet.webp",
    slot: 1,
    desc: "Amulet Bossa Arcykapłana • +110 KI • +24 ATK • +7% Kryt",
    shopPrice: null,
    sellPrice: 440,
    craftCost: null,
    ki: 110,
    atk: 24,
    crit: 7,
  },
  {
    id: "luska-aurelitha",
    name: "Łuska Aurelitha",
    cat: "material",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 18,
    icon: "material-szmaragdowa-luska.webp",
    slot: -1,
    desc: "Alabastrowa łuska Smoka Sanktuarium.",
    shopPrice: null,
    sellPrice: 145,
    craftCost: null,
  },
  {
    id: "serce-sanktuarium",
    name: "Serce Sanktuarium",
    cat: "jewelry",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 20,
    icon: "emblem_crystal.webp",
    slot: 1,
    desc: "Relikt Bossa Aurelitha • +220 HP • +140 KI • +26 DEF",
    shopPrice: null,
    sellPrice: 540,
    craftCost: null,
    hp: 220,
    ki: 140,
    def: 26,
  },
  {
    id: "kod-arbitra",
    name: "Kod Arbitra Zero",
    cat: "jewelry",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "material-pamiec-danych.webp",
    slot: 3,
    desc: "Moduł Bossa Arbitra Zero • +28 ATK • +65 KI • +7% Kryt",
    shopPrice: null,
    sellPrice: 310,
    craftCost: null,
    atk: 28,
    ki: 65,
    crit: 7,
  },
  {
    id: "plyta-egzekutora",
    name: "Płyta Egzekutora",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "elite",
    minLevel: 12,
    icon: "material-plyta-pancerna.webp",
    slot: -1,
    desc: "Stop tytanowo-kobaltowy z Arbitra Zero.",
    shopPrice: null,
    sellPrice: 95,
    craftCost: null,
  },
  {
    id: "rdzen-hydry",
    name: "Rdzeń Hydry Prime",
    cat: "armor",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 20,
    icon: "gear-shield.webp",
    slot: 5,
    desc: "Osłona Bossa Hydry-Rdzenia • +240 HP • +36 DEF • +90 KI",
    shopPrice: null,
    sellPrice: 540,
    craftCost: null,
    hp: 240,
    def: 36,
    ki: 90,
  },
  {
    id: "modul-prime",
    name: "Moduł Prime",
    cat: "material",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 18,
    icon: "material-rdzen-plazmy.webp",
    slot: -1,
    desc: "Kryształ obliczeniowy z Krypty Rdzenia.",
    shopPrice: null,
    sellPrice: 145,
    craftCost: null,
  },
  {
    id: "pancerz-kharzula",
    name: "Pancerz Kharzula",
    cat: "armor",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 15,
    icon: "gear-vest.webp",
    slot: 4,
    desc: "Obsydianowy pancerz Mistrza Areny • +210 HP • +34 DEF • +16 ATK",
    shopPrice: null,
    sellPrice: 320,
    craftCost: null,
    hp: 210,
    def: 34,
    atk: 16,
  },
  {
    id: "plomien-areny",
    name: "Płomień Areny",
    cat: "material",
    rarity: "rare",
    obtainableFrom: "elite",
    minLevel: 12,
    icon: "material-esencja-plomienia.webp",
    slot: -1,
    desc: "Wieczny żar z koksowników Wielkiej Areny Popiołów.",
    shopPrice: null,
    sellPrice: 95,
    craftCost: null,
  },
  {
    id: "serce-wulkanu",
    name: "Serce Wulkanu Pyrrhaxa",
    cat: "weapon",
    rarity: "legendary",
    obtainableFrom: "elite",
    minLevel: 20,
    icon: "emblem_swords.webp",
    slot: 2,
    desc: "Smoczy oręż Pyrrhaxa • +72 ATK • +12% Kryt • +150 HP",
    shopPrice: null,
    sellPrice: 580,
    craftCost: null,
    atk: 72,
    crit: 12,
    hp: 150,
  },
  {
    id: "luska-pyrrhaxa",
    name: "Łuska Pyrrhaxa",
    cat: "material",
    rarity: "epic",
    obtainableFrom: "elite",
    minLevel: 18,
    icon: "material-magmowy-pancerz.webp",
    slot: -1,
    desc: "Bazaltowo-magmowa łuska Smoka Wulkanu.",
    shopPrice: null,
    sellPrice: 145,
    craftCost: null,
  },
];

export function buildExtendedV2Items(existingIds: ReadonlySet<string>): AndroidItemDef[] {
  const out: AndroidItemDef[] = [];
  const seen = new Set(existingIds);

  // 1. All 366 canonical V2 items from src/game/items/catalog.ts
  for (const item of ITEM_CATALOG) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const slot = mapV2Slot(item);
    const cat = mapV2Category(item, slot);
    const minLevel = Math.max(1, Math.floor(item.level ?? 1));
    const isWeakShop =
      (item.rarity === "common" || item.rarity === "uncommon") && cat === "consumable";
    const shopPrice = isWeakShop ? Math.max(minLevel * 60, item.price * 4) : null;
    const sellPrice = item.price > 0 ? Math.max(1, Math.floor(item.price * 0.25)) : 0;
    const st = item.stats;
    const atk = (st?.atkBonus ?? 0) + (st?.atkPercent ? Math.round(st.atkPercent * 1.4) : 0);
    const def = (st?.defBonus ?? 0) + (st?.defPercent ? Math.round(st.defPercent * 1.2) : 0);
    const hp = (st?.hpBonus ?? 0) + (st?.maxHpPercent ? Math.round(st.maxHpPercent * 6) : 0);
    const ki = (st?.kiBonus ?? 0) + (st?.maxKiPercent ? Math.round(st.maxKiPercent * 4) : 0);
    const spd = st?.moveSpeedPercent ? Math.round(st.moveSpeedPercent * 2) : 0;
    const crit = (st?.critChancePoints ?? st?.critChancePercent ?? 0) as number;
    const lowName = `${item.id} ${item.name}`.toLowerCase();
    const isHpPot =
      cat === "consumable" &&
      (lowName.includes("mikstura") || lowName.includes("potion") || lowName.includes("życ"));
    const isKiPot =
      cat === "consumable" &&
      (lowName.includes("ki") || lowName.includes("eliksir skup") || lowName.includes("eter"));
    out.push({
      id: item.id,
      name: item.name,
      cat,
      rarity: item.rarity,
      obtainableFrom: shopPrice !== null ? "shop" : cat === "material" ? "drop" : "craft",
      minLevel,
      icon: mapV2Icon(item, slot),
      slot,
      desc: item.description,
      shopPrice,
      sellPrice,
      craftCost: null,
      ...(item.setId ? { setId: item.setId } : {}),
      ...(atk > 0 ? { atk } : {}),
      ...(def > 0 ? { def } : {}),
      ...(hp > 0 ? { hp } : {}),
      ...(ki > 0 ? { ki } : {}),
      ...(spd > 0 ? { spd } : {}),
      ...(crit > 0 ? { crit } : {}),
      ...(isHpPot ? { healHp: 60 + minLevel * 18 } : {}),
      ...(isKiPot ? { healKi: 50 + minLevel * 12 } : {}),
    });
  }

  // 2. All 19 Boss Trophy items
  for (const bt of BOSS_TROPHY_ITEMS) {
    if (seen.has(bt.id)) continue;
    seen.add(bt.id);
    out.push(bt);
  }

  // 3. All 24 Racial Heritage Weapons (6 stages × 4 races)
  for (const hw of HERITAGE_WEAPON_STAGES) {
    if (seen.has(hw.id)) continue;
    seen.add(hw.id);
    out.push({
      id: hw.id,
      name: hw.name,
      cat: "weapon",
      rarity:
        hw.stage >= 6
          ? "legendary"
          : hw.stage >= 4
            ? "epic"
            : hw.stage >= 3
              ? "rare"
              : hw.stage >= 2
                ? "uncommon"
                : "common",
      obtainableFrom: "craft",
      minLevel: hw.minLevel,
      icon: hw.stage >= 4 ? "emblem_swords.webp" : "gear-sword.webp",
      slot: 2,
      desc: hw.desc,
      shopPrice: null,
      sellPrice: 0,
      craftCost: null,
      atk: hw.atk,
      crit: hw.crit,
      hp: hw.hp,
      ki: hw.ki,
    });
  }

  return out;
}

export const ANDROID_CRAFT_RECIPES: readonly AndroidCraftRecipe[] = CRAFTING_RECIPES.map(
  (r: CraftingRecipe) => ({
    id: r.id,
    name: r.name,
    station: r.station,
    requiredLevel: Math.max(1, Math.floor(r.requiredLevel)),
    cost: Math.max(0, Math.floor(r.craftingCostCoins)),
    ingredients: r.ingredients.map((ing) => ({ id: ing.itemId, qty: Math.max(1, ing.count) })),
    resultItemId: r.resultItemId,
    resultCount: Math.max(1, r.resultCount),
  }),
);

export const ANDROID_CRAFT_RECIPE_MAP = new Map<string, AndroidCraftRecipe>(
  ANDROID_CRAFT_RECIPES.map((r) => [r.id, r]),
);

export const ANDROID_EQUIPMENT_SETS = {
  ...EQUIPMENT_SET_BONUSES,
  ...PASSIVE_BUFF_SET_BONUSES,
};
