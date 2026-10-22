import { MONSTER_BASE } from "./base.generated";
import type { FxSpec, LootEntry, MonsterDef, SkillSpec, Traits } from "./types";

const poison = (atkPct: number, ms: number, stacks?: number): FxSpec => ({
  k: "dot",
  id: "poison",
  atkPct,
  ms,
  ...(stacks ? { stacks } : {}),
});
const burn = (atkPct: number, ms: number): FxSpec => ({ k: "dot", id: "burn", atkPct, ms });
const bleed = (atkPct: number, ms: number): FxSpec => ({ k: "dot", id: "bleed", atkPct, ms });

type Behaviour = {
  attackCd?: number;
  basic?: MonsterDef["basic"];
  basicFx?: FxSpec[];
  weakRanged?: number;
  weak?: MonsterDef["weak"];
  traits: Traits;
  skills?: SkillSpec[];
  /** Loot chances in the order of the bestiary list; defaults 0.7 and 0.35. */
  chances?: number[];
  respawn?: number;
};

/**
 * Behaviour of the 40 bestiary monsters (owner document, 22.10.2026). Statistics, names and loot
 * come from `base.generated.ts`; here are the rules of each fight. Unavailable player damage types
 * (water, cold, area, electric from the player's side) are kept as data for future abilities.
 */
const BEHAVIOUR: Record<string, Behaviour> = {
  "verdant-mchowy-szlamak": {
    weak: { fire: 1.3 },
    traits: { provoked: true, giveUp: 6000, leash: 300, wander: 300 },
    skills: [
      {
        id: "oblepienie",
        name: "Oblepienie",
        mode: "melee",
        cd: 5000,
        range: 90,
        dmg: 0.6,
        fx: [{ k: "slow", pct: 0.2, ms: 3000 }],
      },
    ],
  },
  "verdant-cierniowy-wilk": {
    weak: { area: 1.25 },
    traits: { leash: 520, pack: [2, 3], flank: true, retreat: { below: 0.25, ms: 4000 } },
    skills: [
      { id: "wycie", name: "Wycie", mode: "self", cd: 1000, range: 600, call: 1, once: true },
      { id: "skok", name: "Skok na cel", mode: "leap", cd: 6000, range: 220, dmg: 1.2 },
    ],
  },
  "verdant-lisciak-skrytobojca": {
    weak: { area: 1.3 },
    traits: { leash: 350, ambush: { reveal: 200, hide: 8000 } },
    skills: [
      {
        id: "cios-z-ukrycia",
        name: "Cios z ukrycia",
        mode: "melee",
        cd: 1000,
        range: 90,
        dmg: 1,
        opener: 2,
        fx: [bleed(0.2, 3000)],
      },
    ],
  },
  "verdant-korzeniowy-pelzacz": {
    weak: { fire: 1.3 },
    traits: { leash: 400, burrow: { under: 4000, up: 3500, bonus: 0.25 } },
    skills: [
      {
        id: "oplatanie",
        name: "Oplątanie",
        mode: "burst",
        cd: 10000,
        range: 300,
        dmg: 0.8,
        radius: 70,
        telegraph: 700,
        fx: [{ k: "root", ms: 2000 }],
      },
      {
        id: "wybuch-korzeni",
        name: "Wybuch korzeni",
        mode: "burst",
        cd: 14000,
        range: 200,
        dmg: 0.9,
        radius: 120,
        telegraph: 800,
        centred: true,
      },
    ],
  },
  "verdant-grzybowy-zarodnik": {
    weak: { fire: 1.4 },
    basic: "none",
    traits: {
      leash: 40,
      still: true,
      deathZone: { kind: "poison", ms: 5000, radius: 150, dps: 0.2, fx: [poison(0.15, 3000)] },
    },
    skills: [
      {
        id: "chmura",
        name: "Chmura zarodników",
        mode: "burst",
        cd: 7000,
        range: 350,
        dmg: 0.4,
        radius: 150,
        telegraph: 800,
        fx: [poison(0.15, 5000)],
        zone: { kind: "poison", ms: 3000, radius: 150, dps: 0.1 },
      },
    ],
  },
  "verdant-bursztynowa-osa": {
    weak: { area: 1.3 },
    traits: { fly: true, leash: 550, dive: { attacks: 3, away: 3000 } },
    skills: [
      {
        id: "roj",
        name: "Rój",
        mode: "self",
        cd: 1000,
        range: 600,
        summon: { kind: "verdant-mala-osa", count: 2 },
        once: true,
        below: 0.4,
      },
      {
        id: "zadlo",
        name: "Żądło",
        mode: "melee",
        cd: 3000,
        range: 110,
        dmg: 1,
        fx: [poison(0.08, 5000)],
      },
    ],
  },
  "verdant-skalny-jelen": {
    traits: { provoked: true, giveUp: 8000, leash: 450 },
    skills: [
      {
        id: "szarza",
        name: "Szarża",
        mode: "charge",
        cd: 8000,
        range: 420,
        dmg: 1.5,
        telegraph: 700,
        fx: [{ k: "stun", ms: 1000 }],
        missStun: 2000,
        exposed: 0.3,
      },
      {
        id: "tupniecie",
        name: "Tupnięcie",
        mode: "burst",
        cd: 9000,
        range: 130,
        dmg: 0.8,
        radius: 120,
        telegraph: 500,
        centred: true,
      },
    ],
  },
  "verdant-lesny-pajak": {
    weak: { fire: 1.3 },
    basic: "ranged",
    attackCd: 2400,
    traits: {
      leash: 450,
      keep: 200,
      webSlow: 0.6,
      webs: {
        max: 3,
        radius: 300,
        zone: {
          kind: "web",
          ms: 120000,
          radius: 55,
          dps: 0,
          fx: [{ k: "slow", pct: 0.4, ms: 4000 }],
        },
      },
    },
    skills: [
      {
        id: "plwocina",
        name: "Plwocina",
        mode: "ranged",
        cd: 6000,
        range: 300,
        dmg: 0.8,
        fx: [poison(0.12, 5000)],
      },
    ],
  },
  "verdant-puchacz-pylowy": {
    traits: {
      fly: true,
      leash: 600,
      night: { day: 0.5 },
      opportunist: 0.6,
      dive: { attacks: 1, away: 1500 },
      exposedBonus: 0.2,
    },
    skills: [
      {
        id: "nurkowanie",
        name: "Nurkowanie",
        mode: "leap",
        cd: 5000,
        range: 260,
        dmg: 1.3,
        fx: [{ k: "blind", pct: 0.25, ms: 4000 }],
      },
    ],
  },
  "verdant-straznik-ruin": {
    weak: { ki: 1.25 },
    traits: {
      guard: true,
      leash: 500,
      route: [
        [-120, 0],
        [0, -120],
        [120, 0],
        [0, 120],
      ],
    },
    skills: [
      {
        id: "kamienna-skora",
        name: "Kamienna skóra",
        mode: "self",
        cd: 20000,
        range: 0,
        reduce: { pct: 0.4, ms: 4000 },
      },
      {
        id: "mlot",
        name: "Cios młotem",
        mode: "melee",
        cd: 6000,
        range: 130,
        dmg: 1.8,
        telegraph: 1000,
      },
    ],
  },
  "aether-swietlik-pieczeci": {
    weak: { physical: 1.2 },
    basic: "ranged",
    attackCd: 2500,
    traits: { fly: true, guard: true, keep: 220, leash: 250 },
  },
  "aether-pergaminowy-straznik": {
    weak: { fire: 1.3 },
    basic: "ranged",
    attackCd: 4000,
    traits: { keep: 230, leash: 400 },
    skills: [
      {
        id: "zapieczetowanie",
        name: "Zapieczętowanie",
        mode: "ranged",
        cd: 15000,
        range: 320,
        dmg: 0.3,
        fx: [{ k: "silence", ms: 2000 }],
      },
    ],
  },
  "aether-krysztalowy-motyl": {
    traits: { provoked: true, giveUp: 7000, leash: 300, fly: true, reflect: 0.15 },
    skills: [
      {
        id: "pylek",
        name: "Pyłek",
        mode: "melee",
        cd: 8000,
        range: 100,
        dmg: 0.4,
        fx: [{ k: "blind", pct: 0.5, ms: 2000 }],
      },
    ],
  },
  "aether-szmaragdowy-waz": {
    weak: { ki: 1.2 },
    traits: { leash: 400, dive: { attacks: 2, away: 2500 } },
    skills: [
      {
        id: "ukaszenie",
        name: "Ukąszenie",
        mode: "melee",
        cd: 1800,
        range: 100,
        dmg: 1,
        fx: [poison(0.12, 5000, 3)],
      },
      {
        id: "syk",
        name: "Syk",
        mode: "ranged",
        cd: 9000,
        range: 220,
        dmg: 0,
        fx: [{ k: "slow", pct: 0.2, ms: 3000 }],
      },
    ],
  },
  "aether-duch-bibliotekarza": {
    weak: { ki: 1.5, physical: 0.6 },
    traits: { ghost: true, fly: true, leash: 450, revive: 0.3 },
    skills: [
      {
        id: "uciszenie",
        name: "Uciszenie",
        mode: "ranged",
        cd: 12000,
        range: 260,
        dmg: 0.2,
        fx: [{ k: "silence", ms: 3000 }],
      },
      {
        id: "szept",
        name: "Szept",
        mode: "ranged",
        cd: 9000,
        range: 260,
        dmg: 0,
        fx: [{ k: "weaken", pct: 0.15, ms: 4000 }],
      },
    ],
  },
  "aether-zloty-skarabeusz": {
    weak: { ki: 1.3 },
    traits: { leash: 400, curl: { hits: 3, ms: 3000, reduce: 0.7 } },
    skills: [
      {
        id: "rozbicie-bariery",
        name: "Rozbicie bariery",
        mode: "melee",
        cd: 8000,
        range: 100,
        dmg: 0.8,
        fx: [{ k: "breakShield" }],
      },
      {
        id: "taran",
        name: "Taran",
        mode: "charge",
        cd: 9000,
        range: 260,
        dmg: 1.2,
        telegraph: 500,
      },
    ],
  },
  "aether-lew-swiatyni": {
    traits: { guard: true, leash: 450, backBonus: 0.25 },
    skills: [
      {
        id: "ryk",
        name: "Ryk",
        mode: "burst",
        cd: 14000,
        range: 220,
        dmg: 0,
        radius: 220,
        telegraph: 500,
        centred: true,
        fx: [{ k: "fear", ms: 1500 }],
      },
      { id: "pazur", name: "Pazur", mode: "melee", cd: 2500, range: 110, dmg: 1.5 },
    ],
  },
  "aether-oko-wiedzy": {
    basic: "none",
    traits: { fly: true, keep: 320, leash: 500, fleeAfterHits: { hits: 2, ms: 5000 } },
    skills: [
      {
        id: "znak",
        name: "Znak",
        mode: "ranged",
        cd: 10000,
        range: 400,
        dmg: 0,
        fx: [{ k: "mark", pct: 0.2, ms: 5000 }],
      },
      {
        id: "wzmocnienie",
        name: "Wzmocnienie",
        mode: "self",
        cd: 12000,
        range: 450,
        buff: { pct: 0.15, ms: 6000 },
      },
      {
        id: "promien",
        name: "Promień skupienia",
        mode: "ranged",
        cd: 6000,
        range: 400,
        dmg: 1,
        telegraph: 400,
      },
    ],
  },
  "aether-marionetka-rytualu": {
    weak: { physical: 1.15 },
    traits: { leash: 500, slowBelow: { hp: 0.3, mult: 0.7 } },
    skills: [
      { id: "combo", name: "Combo", mode: "melee", cd: 6000, range: 110, dmg: 0.7, volley: 3 },
      {
        id: "nic",
        name: "Nić energii",
        mode: "ranged",
        cd: 12000,
        range: 300,
        dmg: 0.3,
        fx: [{ k: "pull", dist: 150 }],
      },
    ],
  },
  "aether-mgielny-zuraw": {
    weakRanged: 1.2,
    traits: {
      fly: true,
      leash: 600,
      retreat: { below: 0.2, ms: 8000 },
      dive: { attacks: 2, away: 2500 },
    },
    skills: [
      {
        id: "mgla",
        name: "Mgła",
        mode: "ranged",
        cd: 12000,
        range: 380,
        dmg: 0,
        fx: [{ k: "fog", pct: 0.5, ms: 5000 }],
      },
      { id: "szpon", name: "Szpon z powietrza", mode: "leap", cd: 5000, range: 260, dmg: 1.1 },
    ],
  },
  "nexus-dron-zwiadowca": {
    weak: { electric: 1.3 },
    basic: "none",
    traits: {
      machine: true,
      fly: true,
      keep: 200,
      leash: 450,
      route: [
        [-150, 0],
        [0, -100],
        [150, 0],
        [0, 100],
      ],
    },
    skills: [
      { id: "alarm", name: "Alarm", mode: "self", cd: 1000, range: 600, call: 1, once: true },
      { id: "wiazka", name: "Wiązka", mode: "ranged", cd: 3000, range: 260, dmg: 0.6, volley: 2 },
    ],
  },
  "nexus-pelzacz-serwisowy": {
    weak: { electric: 1.3 },
    traits: { machine: true, leash: 350, medic: 200 },
    skills: [
      {
        id: "naprawa",
        name: "Naprawa",
        mode: "self",
        cd: 6000,
        range: 200,
        heal: { pct: 0.05, ms: 4000 },
      },
      { id: "kleszcze", name: "Kleszcze", mode: "melee", cd: 2000, range: 90, dmg: 1 },
    ],
  },
  "nexus-skaner-gasienicowy": {
    basic: "ranged",
    attackCd: 5000,
    traits: { machine: true, keep: 300, leash: 450, ramp: 0.25, backBonus: 0.25 },
    skills: [
      {
        id: "namierzenie",
        name: "Namierzenie",
        mode: "self",
        cd: 12000,
        range: 0,
        nextAttack: 0.2,
      },
    ],
  },
  "nexus-pajak-spawalniczy": {
    weak: { electric: 1.2 },
    traits: { machine: true, leash: 450 },
    skills: [
      { id: "luk", name: "Łuk spawalniczy", mode: "ranged", cd: 5000, range: 220, dmg: 1 },
      {
        id: "zar",
        name: "Strefa żaru",
        mode: "burst",
        cd: 9000,
        range: 260,
        dmg: 0.2,
        radius: 100,
        telegraph: 600,
        zone: { kind: "metal", ms: 4000, radius: 100, dps: 0.25 },
      },
    ],
  },
  "nexus-wiezyczka-autonomiczna": {
    basic: "none",
    traits: {
      machine: true,
      still: true,
      leash: 20,
      turret: { turn: 90, shots: 12, off: 3000 },
      exposedBonus: 0.3,
    },
    skills: [
      {
        id: "seria",
        name: "Seria 3 pocisków",
        mode: "ranged",
        cd: 4000,
        range: 450,
        dmg: 0.5,
        volley: 3,
        aimed: true,
      },
    ],
  },
  "nexus-roj-nanitow": {
    weak: { area: 1.3 },
    basicFx: [{ k: "armorDown", pct: 0.1, ms: 8000, stacks: 3 }],
    traits: { machine: true, leash: 400, split: { hpPct: 0.4, merge: 6000 } },
  },
  "nexus-pies-lowca": {
    weak: { stun: 1.25 },
    traits: { machine: true, leash: 700 },
    skills: [
      { id: "skok", name: "Skok", mode: "leap", cd: 6000, range: 260, dmg: 1 },
      { id: "szarpniecie", name: "Szarpnięcie", mode: "melee", cd: 2200, range: 100, dmg: 1.2 },
    ],
  },
  "nexus-straznik-rdzenia": {
    weak: { electric: 1.3 },
    traits: { machine: true, guard: true, leash: 500 },
    skills: [
      {
        id: "tarcza",
        name: "Tarcza plazmowa",
        mode: "self",
        cd: 25000,
        range: 0,
        guard: { pct: 0.25, ms: 12000 },
        below: 0.5,
      },
      {
        id: "impuls",
        name: "Cios impulsowy",
        mode: "burst",
        cd: 6000,
        range: 150,
        dmg: 1,
        radius: 130,
        telegraph: 600,
        centred: true,
      },
    ],
  },
  "nexus-latarnia-plazmowa": {
    traits: { machine: true, fly: true, leash: 500, interrupt: { pct: 0.15, stun: 2000 } },
    basic: "ranged",
    attackCd: 3000,
    skills: [
      {
        id: "wyladowanie",
        name: "Wyładowanie plazmy",
        mode: "burst",
        cd: 9000,
        range: 420,
        dmg: 2.5,
        radius: 180,
        telegraph: 2500,
      },
    ],
  },
  "nexus-kruk-danych": {
    weak: { electric: 1.3 },
    basic: "none",
    traits: { machine: true, fly: true, keep: 300, leash: 600, retreat: { below: 0.3, ms: 6000 } },
    skills: [
      {
        id: "zaklocenie",
        name: "Zakłócenie",
        mode: "ranged",
        cd: 14000,
        range: 420,
        dmg: 0,
        fx: [{ k: "jam", ms: 4000 }],
      },
      {
        id: "znak-lowcy",
        name: "Znak łowcy",
        mode: "ranged",
        cd: 12000,
        range: 420,
        dmg: 0,
        fx: [{ k: "mark", pct: 0.15, ms: 6000, from: "machine" }],
      },
    ],
  },
  "pyra-wegielek": {
    weak: { water: 1.3 },
    basicFx: [burn(0.15, 3000)],
    traits: { leash: 350, explode: { atk: 0.4, radius: 120 } },
  },
  "pyra-ognista-salamandra": {
    weak: { water: 1.3 },
    basicFx: [burn(0.15, 3000)],
    traits: { leash: 450, trail: { kind: "fire", ms: 3000, radius: 40, dps: 0.3 } },
  },
  "pyra-popielny-wilk": {
    weak: { area: 1.25 },
    traits: {
      pack: [3, 3],
      flank: true,
      leash: 550,
      retreat: { below: 0.3, ms: 5000, hide: true, regen: 0.06 },
    },
    skills: [
      { id: "skok", name: "Skok", mode: "leap", cd: 6000, range: 220, dmg: 1 },
      {
        id: "oblok",
        name: "Obłok popiołu",
        mode: "burst",
        cd: 14000,
        range: 260,
        dmg: 0,
        radius: 140,
        telegraph: 400,
        fx: [{ k: "fog", pct: 0.3, ms: 4000 }],
      },
    ],
  },
  "pyra-skalny-berserker": {
    weak: { stun: 1.25 },
    traits: { leash: 450, rage: { dmg: 0.4, below: 0.5, speed: 0.2 } },
    skills: [
      { id: "mlot", name: "Młot", mode: "melee", cd: 5000, range: 100, dmg: 1.4, telegraph: 500 },
    ],
  },
  "pyra-magmowy-krab": {
    weak: { water: 1.25 },
    traits: { frontArmor: 0.6, backBonus: 0.4, leash: 350 },
    skills: [
      { id: "kleszcze", name: "Kleszcze", mode: "melee", cd: 5000, range: 110, dmg: 1.2 },
      {
        id: "zalew",
        name: "Zalew magmą",
        mode: "burst",
        cd: 12000,
        range: 200,
        dmg: 0.3,
        radius: 120,
        telegraph: 700,
        zone: { kind: "lava", ms: 4000, radius: 120, dps: 0.3, fx: [burn(0.15, 2000)] },
      },
    ],
  },
  "pyra-zarowy-nietoperz": {
    weak: { area: 1.3 },
    traits: { fly: true, pack: [3, 3], leash: 600, dive: { attacks: 1, away: 1800 } },
    skills: [
      {
        id: "nurkowanie",
        name: "Nurkowanie",
        mode: "leap",
        cd: 4000,
        range: 260,
        dmg: 1,
        fx: [burn(0.1, 2000)],
      },
    ],
  },
  "pyra-golem-ruin": {
    weak: { ki: 1.2 },
    traits: { leash: 400 },
    skills: [
      {
        id: "odlamki",
        name: "Odłamki",
        mode: "burst",
        cd: 10000,
        range: 300,
        dmg: 0.8,
        radius: 200,
        telegraph: 700,
        centred: true,
        below: 0.5,
      },
      {
        id: "miazdzenie",
        name: "Miażdżenie",
        mode: "melee",
        cd: 7000,
        range: 130,
        dmg: 2.2,
        telegraph: 1500,
      },
    ],
  },
  "pyra-plomien-duch": {
    weak: { water: 1.4 },
    basic: "ranged",
    attackCd: 3500,
    basicFx: [burn(0.1, 2000)],
    traits: {
      fly: true,
      keep: 280,
      leash: 550,
      deathZone: { kind: "fire", ms: 5000, radius: 120, dps: 0.3, fx: [burn(0.15, 2000)] },
    },
    skills: [
      {
        id: "pierscien",
        name: "Pierścień ognia",
        mode: "burst",
        cd: 12000,
        range: 200,
        dmg: 1,
        radius: 160,
        telegraph: 800,
        centred: true,
      },
    ],
  },
  "pyra-byk-areny": {
    traits: { leash: 500 },
    skills: [
      {
        id: "szarza",
        name: "Szarża",
        mode: "charge",
        cd: 9000,
        range: 500,
        dmg: 2,
        telegraph: 1000,
        fx: [{ k: "stun", ms: 1000 }],
        missStun: 2500,
        exposed: 0.2,
      },
      {
        id: "tupniecie",
        name: "Tupnięcie",
        mode: "burst",
        cd: 7000,
        range: 130,
        dmg: 0.7,
        radius: 100,
        telegraph: 500,
        centred: true,
      },
    ],
  },
  "pyra-skorpion-obsydianowy": {
    weak: { water: 1.2 },
    traits: { leash: 500, burrow: { under: 3000, up: 6000 }, brittleTail: 3 },
    skills: [
      {
        id: "zadlo",
        name: "Żądło",
        mode: "melee",
        cd: 2500,
        range: 110,
        dmg: 1,
        fx: [poison(0.12, 6000, 5)],
      },
      {
        id: "pulapka",
        name: "Pułapka piaskowa",
        mode: "burst",
        cd: 12000,
        range: 260,
        dmg: 0,
        radius: 100,
        telegraph: 600,
        zone: { kind: "sand", ms: 4000, radius: 100, dps: 0, fx: [{ k: "root", ms: 1000 }] },
      },
    ],
  },
};

const lootOf = (names: string[], chances?: number[]): LootEntry[] =>
  names.map((name, i) => ({ name, chance: chances?.[i] ?? (i === 0 ? 0.7 : 0.35) }));

const build = (): MonsterDef[] =>
  MONSTER_BASE.map((b) => {
    const rules = BEHAVIOUR[b.id];
    if (!rules) throw new Error("Brak zachowania potwora " + b.id);
    return {
      id: b.id,
      world: b.world,
      name: b.name,
      level: b.level,
      hp: b.hp,
      atk: b.atk,
      def: b.def,
      xp: b.xp,
      speed: b.speed,
      range: b.range,
      agro: b.agro,
      attackCd: rules.attackCd ?? 1600,
      basic: rules.basic ?? "melee",
      ...(rules.basicFx ? { basicFx: rules.basicFx } : {}),
      ...(rules.weakRanged ? { weakRanged: rules.weakRanged } : {}),
      weak: rules.weak ?? {},
      traits: rules.traits,
      skills: rules.skills ?? [],
      loot: lootOf(b.loot, rules.chances),
      gold: [Math.max(1, b.level), Math.max(3, b.level * 3)],
      respawn: rules.respawn ?? 25000,
    };
  });

/** The 40 monsters of the owner bestiary. */
export const MONSTERS: MonsterDef[] = build();

/** Legacy boar (the only enemy of Stage 2) and helper creatures. They are not part of the bestiary. */
export const EXTRA: MonsterDef[] = [
  {
    id: "boar",
    world: "verdant",
    name: "Dzik",
    level: 1,
    hp: 66,
    atk: 9,
    def: 0,
    xp: 20,
    speed: 1,
    range: 68,
    agro: 155,
    attackCd: 1400,
    basic: "melee",
    weak: {},
    traits: { leash: 330, wander: 65 },
    skills: [],
    loot: [{ name: "tusk", chance: 1 }],
    gold: [4, 4],
    respawn: 18000,
    minion: true,
  },
  {
    id: "verdant-mala-osa",
    world: "verdant",
    name: "Mała osa",
    level: 4,
    hp: 40,
    atk: 14,
    def: 3,
    xp: 8,
    speed: 1.5,
    range: 90,
    agro: 400,
    attackCd: 1500,
    basic: "melee",
    weak: { area: 1.3 },
    traits: { fly: true, leash: 600 },
    skills: [],
    loot: [],
    gold: [0, 0],
    respawn: 0,
    minion: true,
  },
];

export const MONSTER_DEFS: Record<string, MonsterDef> = Object.fromEntries(
  [...MONSTERS, ...EXTRA].map((m) => [m.id, m]),
);
export const monsterDef = (id: string): MonsterDef => {
  const def = MONSTER_DEFS[id];
  if (!def) throw new Error("Nieznany potwór: " + id);
  return def;
};
