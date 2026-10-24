import { HeroRace } from './heroes';

export interface SkillNode {
  code: string; // 'R', 'A1'..'A9', 'B1'..'B9', 'C1'..'C9', 'T'
  branch: 'root' | 'A' | 'B' | 'C' | 'apex';
  name: string;
  levelReq: number;
  requires: string[]; // OR logic if multiple parents (e.g. ['A2', 'A3'] or ['A9', 'B9', 'C9'])
  excludes?: string; // e.g. 'A8'
  type: 'basic' | 'active' | 'passive' | 'ultimate';
  slotKey?: 'SPACE' | 'Q' | 'E' | 'C' | 'T';
  kiCost: number;
  cooldown: number; // seconds
  multiplier?: number;
  effectText: string;
}

export interface RaceProgressionSpec {
  raceId: HeroRace['id'];
  raceName: string;
  worldName: string;
  role: string;
  mechanicName: string;
  mechanicDescription: string;
  basicSkillName: string;
  attackIntervalMs: number;
  branches: {
    A: string;
    B: string;
    C: string;
  };
  nodes: SkillNode[];
}

export interface ComputedHeroStats {
  level: number;
  rankTitle: string;
  xpCurrentLevel: number;
  xpNextLevel: number;
  maxHp: number;
  maxKi: number;
  atk: number;
  def: number;
  moveSpeedUnits: number; // j./s
  kiRegenPerSec: number;
  critChancePct: number;
  attackIntervalMs: number;
  shieldCapacityBonusPct: number;
  ccReductionPct: number;
  kiCostReductionPct: number;
  cooldownReductionPct: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: 'weapon' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'amulet' | 'ring';
  raceId?: HeroRace['id'];
  tier: number;
  levelReq: number;
  atk: number;
  def: number;
  hp: number;
  ki: number;
  critPp: number;
  kiRegen: number;
  price: number;
}

export interface ConsumableItem {
  id: string;
  name: string;
  levelReq: number;
  category: 'heal' | 'ki' | 'food' | 'cleanse';
  cooldownSec: number;
  description: string;
  healPct?: number;
  kiRestorePct?: number;
  buffHpFlat?: number;
  buffKiRegen?: number;
  cleanses?: 'poison' | 'burn' | 'all_dot';
}

export function getStoryRank(level: number): string {
  if (level >= 20) return 'Legenda Superior';
  if (level >= 18) return 'Strażnik Chóru';
  if (level >= 14) return 'Powiernik Głosu';
  if (level >= 10) return 'Łącznik Krain';
  if (level >= 7) return 'Strażnik Szlaku';
  if (level >= 4) return 'Wędrowiec';
  return 'Mieszkaniec';
}

// Canonical XP curve from Chapter 05: next threshold = 100 + 60 * (L - 1)
export function getXpForNextLevel(level: number): number {
  if (level >= 20) return 1180;
  return 100 + 60 * (level - 1);
}

export function getTotalCumulativeXp(level: number): number {
  const L = Math.max(1, Math.min(20, level));
  return 100 * (L - 1) + 30 * (L - 1) * (L - 2);
}

// Canonical Base Stat Tables (Levels 1-20) from Chapter 15 (Aneks 22.10.2026)
export function getBaseStatsAtLevel(raceId: HeroRace['id'], level: number) {
  const L = Math.max(1, Math.min(20, level));
  const d = L - 1;
  // Owner rule: +5% base movement speed per level up to 20
  const speedMult = 1 + d * 0.05;

  switch (raceId) {
    case 'planetary':
      return {
        hp: Math.round(125 + d * 36),
        ki: Math.round(50 + d * 4),
        atk: Math.round(12 + d * 4),
        def: Math.round(5 + d * (46 / 19)),
        moveSpeedUnits: Math.round(185 * speedMult),
        kiRegenPerSec: Number((1.0 + d * 0.05).toFixed(2)),
        critChancePct: Number((5.0 + d * 0.25).toFixed(2)),
        attackIntervalMs: 650,
      };
    case 'sage':
      return {
        hp: Math.round(100 + d * 28),
        ki: Math.round(80 + d * 7),
        atk: Math.round(14 + d * (87 / 19)),
        def: Math.round(3 + d * (30 / 19)),
        moveSpeedUnits: Math.round(170 * speedMult),
        kiRegenPerSec: Number((2.0 + d * 0.1).toFixed(2)),
        critChancePct: Number((5.0 + d * 0.2).toFixed(2)),
        attackIntervalMs: 800,
      };
    case 'android':
      return {
        hp: Math.round(115 + d * 34),
        ki: Math.round(60 + d * 5),
        atk: Math.round(12 + d * (72 / 19)),
        def: Math.round(7 + d * 3),
        moveSpeedUnits: Math.round(175 * speedMult),
        kiRegenPerSec: Number((1.2 + d * 0.06).toFixed(2)),
        critChancePct: Number((8.0 + d * 0.4).toFixed(2)),
        attackIntervalMs: 700,
      };
    case 'legend':
      return {
        hp: Math.round(140 + d * 42),
        ki: Math.round(40 + d * 3),
        atk: Math.round(14 + d * (87 / 19)),
        def: Math.round(4 + d * 2),
        moveSpeedUnits: Math.round(170 * speedMult),
        kiRegenPerSec: Number((0.8 + d * 0.04).toFixed(2)),
        critChancePct: Number((6.0 + d * 0.3).toFixed(2)),
        attackIntervalMs: 750,
      };
  }
}

export const RACE_SKILL_TREES: Record<HeroRace['id'], RaceProgressionSpec> = {
  planetary: {
    raceId: 'planetary',
    raceName: 'Planetarni',
    worldName: 'Verdantia',
    role: 'Mobilny wojownik wręcz',
    mechanicName: 'Adaptacja do terenu & 3-Hit Combo',
    mechanicDescription: 'Co 3. Cios Szlaku zadaje ×1,3 obrażeń. Zależnie od biomu: las +30% reg. Ki, skały +10% DEF, woda +8% ruchu (z B2).',
    basicSkillName: 'Cios Szlaku',
    attackIntervalMs: 650,
    branches: {
      A: 'A — Szlak Wędrowca',
      B: 'B — Żywa Ziemia',
      C: 'C — Pieśń Korzeni',
    },
    nodes: [
      { code: 'R', branch: 'root', name: 'Cios Szlaku', levelReq: 1, requires: [], type: 'basic', slotKey: 'SPACE', kiCost: 0, cooldown: 0.65, multiplier: 1.0, effectText: 'Atak wręcz ×1,0 co 650 ms; trzeci cios serii ×1,3. Bez kosztu Ki.' },
      // Branch A
      { code: 'A1', branch: 'A', name: 'Szybki Unik', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'Q', kiCost: 8, cooldown: 5, effectText: 'Zryw w wybranym kierunku (160 j.) z krótką niewrażliwością.' },
      { code: 'A2', branch: 'A', name: 'Lekki Krok', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+6% szybkości ruchu.' },
      { code: 'A3', branch: 'A', name: 'Pęd Szlaku', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Po uniku następny atak zadaje +25% obrażeń (5 s).' },
      { code: 'A4', branch: 'A', name: 'Wir Energii', levelReq: 7, requires: ['A2', 'A3'], type: 'active', slotKey: 'Q', kiCost: 18, cooldown: 10, multiplier: 1.8, effectText: 'Wirujący atak wokół postaci ×1,8, promień 140 j.' },
      { code: 'A5', branch: 'A', name: 'Wiatr w Plecy', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Po pokonaniu wroga +15% szybkości ruchu przez 4 s.' },
      { code: 'A6', branch: 'A', name: 'Oko Zwiadowcy', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+5% szansy krytyku.' },
      { code: 'A7', branch: 'A', name: 'Cios z Cienia', levelReq: 13, requires: ['A5'], excludes: 'A8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Pierwszy atak po uniku zawsze jest krytyczny. Wyklucza A8.' },
      { code: 'A8', branch: 'A', name: 'Nieuchwytny', levelReq: 13, requires: ['A6'], excludes: 'A7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Odnowienie Uniku −30%, po uniku +20% obrony przez 1 s. Wyklucza A7.' },
      { code: 'A9', branch: 'A', name: 'Burza Wędrowca', levelReq: 16, requires: ['A7', 'A8'], type: 'active', slotKey: 'Q', kiCost: 35, cooldown: 30, multiplier: 4.0, effectText: 'Seria 5 szybkich uderzeń w pobliskich wrogów, łącznie ×4,0.' },
      // Branch B
      { code: 'B1', branch: 'B', name: 'Impuls Ziemi', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'E', kiCost: 10, cooldown: 6, multiplier: 1.4, effectText: 'Uderzenie w ziemię ×1,4, promień 120 j., spowolnienie 30% na 2 s.' },
      { code: 'B2', branch: 'B', name: 'Adaptacja', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Bonus zależny od terenu: las +30% reg. Ki, skały +10% DEF, woda +8% ruchu.' },
      { code: 'B3', branch: 'B', name: 'Kamienna Skóra', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+8% obrony.' },
      { code: 'B4', branch: 'B', name: 'Kruszący Stąp', levelReq: 7, requires: ['B2', 'B3'], type: 'active', slotKey: 'E', kiCost: 18, cooldown: 10, multiplier: 2.0, effectText: 'Skok i uderzenie ×2,0, ogłuszenie 1 s.' },
      { code: 'B5', branch: 'B', name: 'Rezonans', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Impuls Ziemi uderza drugi raz po 0,5 s za 60% obrażeń.' },
      { code: 'B6', branch: 'B', name: 'Żyła Ziemi', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Impuls Ziemi zwraca 5 Ki za każdego trafionego wroga (maks. 15).' },
      { code: 'B7', branch: 'B', name: 'Głaz Strażnik', levelReq: 13, requires: ['B5'], excludes: 'B8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Kruszący Stąp tworzy osłonę pochłaniającą 15% maks. życia przez 5 s. Wyklucza B8.' },
      { code: 'B8', branch: 'B', name: 'Trzęsienie', levelReq: 13, requires: ['B6'], excludes: 'B7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Impuls Ziemi: promień +40% i ogłuszenie 0,5 s. Wyklucza B7.' },
      { code: 'B9', branch: 'B', name: 'Gniew Doliny', levelReq: 16, requires: ['B7', 'B8'], type: 'active', slotKey: 'E', kiCost: 35, cooldown: 30, multiplier: 4.0, effectText: 'Ogromne uderzenie obszarowe ×4,0, ogłuszenie 1,5 s.' },
      // Branch C
      { code: 'C1', branch: 'C', name: 'Korzenny Oddech', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'C', kiCost: 12, cooldown: 12, effectText: 'Leczy 12% maks. życia w ciągu 4 s.' },
      { code: 'C2', branch: 'C', name: 'Zielona Krew', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+10% maks. życia.' },
      { code: 'C3', branch: 'C', name: 'Leśna Cierpliwość', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Poza walką regeneracja życia 1% maks. na sekundę.' },
      { code: 'C4', branch: 'C', name: 'Tarcza Liści', levelReq: 7, requires: ['C2', 'C3'], type: 'active', slotKey: 'C', kiCost: 18, cooldown: 12, effectText: 'Tarcza pochłaniająca 18% maks. życia przez 5 s.' },
      { code: 'C5', branch: 'C', name: 'Korzenie Odporności', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Czas trwania efektów kontroli na postaci −25%.' },
      { code: 'C6', branch: 'C', name: 'Ziarno Życia', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Leczenie z Korzennego Oddechu +30%.' },
      { code: 'C7', branch: 'C', name: 'Strażnik Gaju', levelReq: 13, requires: ['C5'], excludes: 'C8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Tarcza Liści odbija 20% obrażeń wręcz. Wyklucza C8.' },
      { code: 'C8', branch: 'C', name: 'Dar Lasu', levelReq: 13, requires: ['C6'], excludes: 'C7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Korzenny Oddech zwraca 15 Ki. Wyklucza C7.' },
      { code: 'C9', branch: 'C', name: 'Pieśń Korzeni', levelReq: 16, requires: ['C7', 'C8'], type: 'active', slotKey: 'C', kiCost: 35, cooldown: 45, effectText: 'Leczy 40% maks. życia i daje tarczę 20% na 6 s.' },
      // Apex T
      { code: 'T', branch: 'apex', name: 'Forma Rezonansu Świata', levelReq: 20, requires: ['A9', 'B9', 'C9'], type: 'ultimate', slotKey: 'T', kiCost: 50, cooldown: 120, effectText: '20 s: +20% Ataku, +15% Obrony, +10% szybkości ruchu; osobna aura Ki.' },
    ],
  },

  sage: {
    raceId: 'sage',
    raceName: 'Mędrcy',
    worldName: 'Aetheria',
    role: 'Mag dystansowy i wsparcie',
    mechanicName: 'Kręgi Światła & Pieczęcie Eteru',
    mechanicDescription: 'Zdolności tworzą na ziemi Kręgi Światła (5 s), które spowalniają wrogów (−40%), redukują ich obrażenia (−10%) i wzmacniają obronę Mędrca.',
    basicSkillName: 'Pocisk Ki',
    attackIntervalMs: 800,
    branches: {
      A: 'A — Pieczęcie',
      B: 'B — Kręgi i Bariery',
      C: 'C — Skupienie',
    },
    nodes: [
      { code: 'R', branch: 'root', name: 'Pocisk Ki', levelReq: 1, requires: [], type: 'basic', slotKey: 'SPACE', kiCost: 0, cooldown: 0.8, multiplier: 1.0, effectText: 'Pocisk dystansowy ×1,0 co 800 ms, zasięg 420 j. Bez kosztu Ki.' },
      // Branch A
      { code: 'A1', branch: 'A', name: 'Pieczęć Energii', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'Q', kiCost: 12, cooldown: 8, multiplier: 2.0, effectText: 'Znak na celu; po 1,5 s wybucha za ×2,0 obrażeń.' },
      { code: 'A2', branch: 'A', name: 'Znak Wiedzy', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wrogowie z pieczęcią przyjmują +10% obrażeń.' },
      { code: 'A3', branch: 'A', name: 'Szybka Pieczęć', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Odnowienie Pieczęci Energii −20%.' },
      { code: 'A4', branch: 'A', name: 'Strumień Ki', levelReq: 7, requires: ['A2', 'A3'], type: 'active', slotKey: 'Q', kiCost: 18, cooldown: 10, multiplier: 2.4, effectText: 'Skupiony promień Ki zadający łącznie ×2,4 obrażeń.' },
      { code: 'A5', branch: 'A', name: 'Echo Pieczęci', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wybuch Pieczęci rani też pobliskich wrogów za 50% obrażeń.' },
      { code: 'A6', branch: 'A', name: 'Precyzja Mędrca', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+8% szansy krytyku.' },
      { code: 'A7', branch: 'A', name: 'Złoty Krąg', levelReq: 13, requires: ['A5'], excludes: 'A8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wybuch Pieczęci tworzy krąg obrażeń o promieniu 120 j. Wyklucza A8.' },
      { code: 'A8', branch: 'A', name: 'Pieczęć Skupienia', levelReq: 13, requires: ['A6'], excludes: 'A7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wybuch Pieczęci zwraca 15 Ki. Wyklucza A7.' },
      { code: 'A9', branch: 'A', name: 'Sąd Światła', levelReq: 16, requires: ['A7', 'A8'], type: 'active', slotKey: 'Q', kiCost: 35, cooldown: 30, multiplier: 4.2, effectText: 'Po 1,5 s słup światła w dużym obszarze zadaje ×4,2 obrażeń.' },
      // Branch B
      { code: 'B1', branch: 'B', name: 'Świetlista Bariera', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'E', kiCost: 12, cooldown: 10, effectText: 'Tarcza pochłaniająca 15% maks. życia przez 4 s.' },
      { code: 'B2', branch: 'B', name: 'Kontrola Kręgu', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Zdolności zostawiają krąg światła na ziemi (5 s).' },
      { code: 'B3', branch: 'B', name: 'Gęste Światło', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Bariera trwa o 2 s dłużej.' },
      { code: 'B4', branch: 'B', name: 'Krąg Spowolnienia', levelReq: 7, requires: ['B2', 'B3'], type: 'active', slotKey: 'E', kiCost: 18, cooldown: 12, effectText: 'Krąg na 5 s: wrogowie w nim mają −40% szybkości ruchu.' },
      { code: 'B5', branch: 'B', name: 'Odbicie', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Bariera odbija 15% obrażeń z pocisków.' },
      { code: 'B6', branch: 'B', name: 'Strażnik Kręgu', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wrogowie w kręgach zadają −10% obrażeń.' },
      { code: 'B7', branch: 'B', name: 'Kopuła', levelReq: 13, requires: ['B5'], excludes: 'B8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Pojemność Bariery +30%. Wyklucza B8.' },
      { code: 'B8', branch: 'B', name: 'Lustro', levelReq: 13, requires: ['B6'], excludes: 'B7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Bariera odbija pierwszy atak wroga w całości. Wyklucza B7.' },
      { code: 'B9', branch: 'B', name: 'Świątynia Światła', levelReq: 16, requires: ['B7', 'B8'], type: 'active', slotKey: 'E', kiCost: 35, cooldown: 40, effectText: 'Wielki krąg na 8 s: +30% obrony postaci, wrogowie −30% szybkości.' },
      // Branch C
      { code: 'C1', branch: 'C', name: 'Skupienie KI', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'C', kiCost: 0, cooldown: 15, effectText: 'Kanałowanie: odnawia 30% maks. Ki.' },
      { code: 'C2', branch: 'C', name: 'Głęboki Oddech', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+15% maks. Ki.' },
      { code: 'C3', branch: 'C', name: 'Mądrość Strażników', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Koszty Ki zdolności −8%.' },
      { code: 'C4', branch: 'C', name: 'Medytacja Bojowa', levelReq: 7, requires: ['C2', 'C3'], type: 'active', slotKey: 'C', kiCost: 10, cooldown: 15, effectText: 'Leczy 20% maks. życia i odnawia skupienie.' },
      { code: 'C5', branch: 'C', name: 'Czysty Umysł', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Czas trwania efektów kontroli na postaci −25%.' },
      { code: 'C6', branch: 'C', name: 'Strumień Wiedzy', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Po Skupieniu KI następna zdolność zadaje +25% obrażeń (6 s).' },
      { code: 'C7', branch: 'C', name: 'Dar Mędrca', levelReq: 13, requires: ['C5'], excludes: 'C8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Medytacja Bojowa leczy o 50% więcej. Wyklucza C8.' },
      { code: 'C8', branch: 'C', name: 'Skupienie Mistrza', levelReq: 13, requires: ['C6'], excludes: 'C7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Skupienie KI nie jest przerywane ruchem. Wyklucza C7.' },
      { code: 'C9', branch: 'C', name: 'Pełnia Skupienia', levelReq: 16, requires: ['C7', 'C8'], type: 'active', slotKey: 'C', kiCost: 20, cooldown: 60, effectText: '8 s: zdolności nie kosztują Ki i zadają +30% obrażeń.' },
      // Apex T
      { code: 'T', branch: 'apex', name: 'Forma Oświecenia', levelReq: 20, requires: ['A9', 'B9', 'C9'], type: 'ultimate', slotKey: 'T', kiCost: 50, cooldown: 120, effectText: '20 s: +25% Ataku, odnowienia zdolności −30%, +15% Obrony; złota aura.' },
    ],
  },

  android: {
    raceId: 'android',
    raceName: 'Androidy',
    worldName: 'Nexus-9',
    role: 'Precyzyjny strzelec z tarczami',
    mechanicName: 'Ładunek Rdzenia (0–100) & Przegrzanie',
    mechanicDescription: 'Każdy Strzał Impulsowy dodaje +4 Ładunku Rdzenia. Przy 100 następuje Przegrzanie (2 s blokady), a Wyładowanie Rdzenia zużywa cały Ładunek na potężny strzał liniowy.',
    basicSkillName: 'Strzał Impulsowy',
    attackIntervalMs: 700,
    branches: {
      A: 'A — Systemy Celownicze',
      B: 'B — Pancerz i Tarcze',
      C: 'C — Rdzeń',
    },
    nodes: [
      { code: 'R', branch: 'root', name: 'Strzał Impulsowy', levelReq: 1, requires: [], type: 'basic', slotKey: 'SPACE', kiCost: 0, cooldown: 0.7, multiplier: 1.0, effectText: 'Strzał ×1,0 co 700 ms, zasięg 360 j.; każdy strzał +4 Ładunku Rdzenia (maks. 100).' },
      // Branch A
      { code: 'A1', branch: 'A', name: 'Namierzanie', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'Q', kiCost: 8, cooldown: 8, effectText: 'Oznacza cel na 6 s: +15% szansy krytyku przeciw niemu.' },
      { code: 'A2', branch: 'A', name: 'Kalibracja', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+6% szansy krytyku.' },
      { code: 'A3', branch: 'A', name: 'Stabilizatory', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Zasięg strzałów +15%.' },
      { code: 'A4', branch: 'A', name: 'Salwa Precyzyjna', levelReq: 7, requires: ['A2', 'A3'], type: 'active', slotKey: 'Q', kiCost: 18, cooldown: 10, multiplier: 2.2, effectText: 'Trzy strzały w cel, łącznie ×2,2 obrażeń.' },
      { code: 'A5', branch: 'A', name: 'Analiza Słabości', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Oznaczeni wrogowie mają −10% obrony.' },
      { code: 'A6', branch: 'A', name: 'Szybkie Przeładowanie', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Odstęp strzałów −8%.' },
      { code: 'A7', branch: 'A', name: 'Snajper', levelReq: 13, requires: ['A5'], excludes: 'A8', type: 'passive', kiCost: 0, cooldown: 0, effectText: '+40% obrażeń przeciw oznaczonym, odstęp strzałów +10%. Wyklucza A8.' },
      { code: 'A8', branch: 'A', name: 'Rój', levelReq: 13, requires: ['A6'], excludes: 'A7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Strzał rozdziela się na 2 dodatkowe pobliskie cele (po 40% obrażeń). Wyklucza A7.' },
      { code: 'A9', branch: 'A', name: 'Protokół Egzekucji', levelReq: 16, requires: ['A7', 'A8'], type: 'active', slotKey: 'Q', kiCost: 35, cooldown: 30, multiplier: 4.0, effectText: 'Strzał ×4,0 w cel, ×6,0 gdy cel ma poniżej 30% życia.' },
      // Branch B
      { code: 'B1', branch: 'B', name: 'Tarcza Plazmowa', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'E', kiCost: 12, cooldown: 10, effectText: 'Tarcza pochłaniająca 18% maks. życia przez 5 s.' },
      { code: 'B2', branch: 'B', name: 'Płyty Pancerne', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+8% obrony.' },
      { code: 'B3', branch: 'B', name: 'Generator Tarczy', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Pojemność Tarczy +25%.' },
      { code: 'B4', branch: 'B', name: 'Impuls Odpychający', levelReq: 7, requires: ['B2', 'B3'], type: 'active', slotKey: 'E', kiCost: 18, cooldown: 12, multiplier: 1.2, effectText: 'Fala ×1,2 odpycha pobliskich wrogów i ogłusza na 0,5 s.' },
      { code: 'B5', branch: 'B', name: 'Protokół Adaptacji', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Tarcza Plazmowa odbija 25% obrażeń z pocisków.' },
      { code: 'B6', branch: 'B', name: 'Samonaprawa', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Regeneracja życia 0,5% maks. na sekundę.' },
      { code: 'B7', branch: 'B', name: 'Tarcza Kolcowa', levelReq: 13, requires: ['B5'], excludes: 'B8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Tarcza odbija 30% obrażeń wręcz. Wyklucza B8.' },
      { code: 'B8', branch: 'B', name: 'Tarcza Modułowa', levelReq: 13, requires: ['B6'], excludes: 'B7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Odnowienie Tarczy −35%. Wyklucza B7.' },
      { code: 'B9', branch: 'B', name: 'Fortyfikacja', levelReq: 16, requires: ['B7', 'B8'], type: 'active', slotKey: 'E', kiCost: 35, cooldown: 40, effectText: '6 s: +60% obrony i odporność na efekty kontroli.' },
      // Branch C
      { code: 'C1', branch: 'C', name: 'Wyładowanie Rdzenia', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'C', kiCost: 15, cooldown: 8, multiplier: 1.0, effectText: 'Zużywa cały Ładunek: obrażenia ×(1,0 + Ładunek/50) w linii przed postacią.' },
      { code: 'C2', branch: 'C', name: 'Zarządzanie Rdzeniem', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Przegrzanie trwa 1 s zamiast 2 s; Ładunek opada o 50% szybciej.' },
      { code: 'C3', branch: 'C', name: 'Radiatory', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Każdy strzał dodaje o 15% mniej Ładunku.' },
      { code: 'C4', branch: 'C', name: 'Rozładowanie Awaryjne', levelReq: 7, requires: ['C2', 'C3'], type: 'active', slotKey: 'C', kiCost: 0, cooldown: 20, effectText: 'Zeruje Ładunek i leczy 10% maks. życia; 0 Ki.' },
      { code: 'C5', branch: 'C', name: 'Rezerwowy Akumulator', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+12% maks. Ki.' },
      { code: 'C6', branch: 'C', name: 'Optymalizacja', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Koszt Ki Wyładowania Rdzenia −20%.' },
      { code: 'C7', branch: 'C', name: 'Przeciążony Rdzeń', levelReq: 13, requires: ['C5'], excludes: 'C8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Maks. Ładunek 150 (Wyładowanie do ×4,0). Wyklucza C8.' },
      { code: 'C8', branch: 'C', name: 'Stabilny Rdzeń', levelReq: 13, requires: ['C6'], excludes: 'C7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Przegrzanie nigdy nie następuje; maks. Ładunek 70. Wyklucza C7.' },
      { code: 'C9', branch: 'C', name: 'Przeciążenie Systemu', levelReq: 16, requires: ['C7', 'C8'], type: 'active', slotKey: 'C', kiCost: 0, cooldown: 45, effectText: '6 s: zdolności nie kosztują Ki, +40% obrażeń; potem 2 s wyłączenia.' },
      // Apex T
      { code: 'T', branch: 'apex', name: 'Forma Pełnego Rdzenia', levelReq: 20, requires: ['A9', 'B9', 'C9'], type: 'ultimate', slotKey: 'T', kiCost: 50, cooldown: 120, effectText: '20 s: +25% Ataku, +15% Obrony, przegrzanie wyłączone; plazmowa aura.' },
    ],
  },

  legend: {
    raceId: 'legend',
    raceName: 'Legendy',
    worldName: 'Pyra',
    role: 'Wojownik w zwarciu i burst',
    mechanicName: 'Żar (0–100) & Kruszenie Osłon',
    mechanicDescription: 'Każde trafienie wręcz daje +4 Żaru (maks. 100), zwiększając obrażenia o +0,1% za punkt (do +10%). Zdolności zużywają Żar lub ratują przed śmiercią.',
    basicSkillName: 'Uderzenie Żaru',
    attackIntervalMs: 750,
    branches: {
      A: 'A — Ogień Walki',
      B: 'B — Żelazna Wola',
      C: 'C — Wybuch KI',
    },
    nodes: [
      { code: 'R', branch: 'root', name: 'Uderzenie Żaru', levelReq: 1, requires: [], type: 'basic', slotKey: 'SPACE', kiCost: 0, cooldown: 0.75, multiplier: 1.0, effectText: 'Cios wręcz ×1,0 co 750 ms; każde trafienie +4 Żaru (maks. 100, +0,1% DMG/pkt).' },
      // Branch A
      { code: 'A1', branch: 'A', name: 'Ogniste Cięcie', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'Q', kiCost: 10, cooldown: 6, multiplier: 1.8, effectText: 'Kombinacja 3 cięć wręcz, łącznie ×1,8 obrażeń.' },
      { code: 'A2', branch: 'A', name: 'Rozgrzane Ostrza', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Cięcia podpalają na 3 s (łącznie 30% Ataku).' },
      { code: 'A3', branch: 'A', name: 'Łańcuch Ciosów', levelReq: 4, requires: ['A1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Po 3 trafieniach z rzędu odstęp ataków −10% na 4 s.' },
      { code: 'A4', branch: 'A', name: 'Szarża Płomienia', levelReq: 7, requires: ['A2', 'A3'], type: 'active', slotKey: 'Q', kiCost: 16, cooldown: 9, multiplier: 1.9, effectText: 'Doskok (200 j.) z uderzeniem ognia ×1,9.' },
      { code: 'A5', branch: 'A', name: 'Rozżarzone Pięści', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+8% Ataku.' },
      { code: 'A6', branch: 'A', name: 'Okrucieństwo', levelReq: 10, requires: ['A4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+6% szansy krytyku.' },
      { code: 'A7', branch: 'A', name: 'Taniec Płomieni', levelReq: 13, requires: ['A5'], excludes: 'A8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Ogniste Cięcie ma 5 cięć (łącznie ×2,6). Wyklucza A8.' },
      { code: 'A8', branch: 'A', name: 'Pojedynkowicz', levelReq: 13, requires: ['A6'], excludes: 'A7', type: 'passive', kiCost: 0, cooldown: 0, effectText: '+25% obrażeń, gdy w zasięgu 200 j. jest tylko jeden wróg. Wyklucza A7.' },
      { code: 'A9', branch: 'A', name: 'Tysiąc Cięć', levelReq: 16, requires: ['A7', 'A8'], type: 'active', slotKey: 'Q', kiCost: 35, cooldown: 30, multiplier: 4.2, effectText: 'Seria 8 cięć wręcz, łącznie ×4,2 obrażeń.' },
      // Branch B
      { code: 'B1', branch: 'B', name: 'Przełamanie', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'E', kiCost: 12, cooldown: 8, multiplier: 1.5, effectText: 'Cios kruszący ×1,5, ogłuszenie 1,2 s i zniszczenie osłon/tarcz wroga.' },
      { code: 'B2', branch: 'B', name: 'Hartowana Skóra', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+8% obrony.' },
      { code: 'B3', branch: 'B', name: 'Honor Wojownika', levelReq: 4, requires: ['B1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: '+10% maks. życia.' },
      { code: 'B4', branch: 'B', name: 'Płomienny Szał', levelReq: 7, requires: ['B2', 'B3'], type: 'active', slotKey: 'E', kiCost: 18, cooldown: 25, effectText: '8 s: +30% Ataku, −20% obrony (chyba że wybrano B8).' },
      { code: 'B5', branch: 'B', name: 'Żelazna Wola', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'W Szale odporność na ogłuszenie.' },
      { code: 'B6', branch: 'B', name: 'Krew Legendy', levelReq: 10, requires: ['B4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Po pokonaniu wroga leczy 3% maks. życia.' },
      { code: 'B7', branch: 'B', name: 'Wściekłość', levelReq: 13, requires: ['B5'], excludes: 'B8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Szał trwa o 4 s dłużej i daje dodatkowe +10% Ataku. Wyklucza B8.' },
      { code: 'B8', branch: 'B', name: 'Kontrolowany Żar', levelReq: 13, requires: ['B6'], excludes: 'B7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Płomienny Szał nie obniża obrony. Wyklucza B7.' },
      { code: 'B9', branch: 'B', name: 'Ostatni Płomień', levelReq: 16, requires: ['B7', 'B8'], type: 'active', slotKey: 'E', kiCost: 35, cooldown: 90, effectText: '5 s: pierwszy śmiertelny cios zostawia 1 HP i leczy 30% maks. życia.' },
      // Branch C
      { code: 'C1', branch: 'C', name: 'Wybuch Ki', levelReq: 2, requires: ['R'], type: 'active', slotKey: 'C', kiCost: 15, cooldown: 8, multiplier: 1.8, effectText: 'Eksplozja wokół postaci ×1,8, promień 150 j.' },
      { code: 'C2', branch: 'C', name: 'Żar', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Żar rośnie o 50% szybciej (+6/cios) i opada 2× wolniej.' },
      { code: 'C3', branch: 'C', name: 'Ognisty Oddech', levelReq: 4, requires: ['C1'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Wybuch Ki podpala wrogów na 4 s (łącznie 40% Ataku).' },
      { code: 'C4', branch: 'C', name: 'Eksplozja Żaru', levelReq: 7, requires: ['C2', 'C3'], type: 'active', slotKey: 'C', kiCost: 18, cooldown: 12, multiplier: 1.0, effectText: 'Zużywa cały Żar: obszarowo ×(1,0 + Żar/50).' },
      { code: 'C5', branch: 'C', name: 'Szybkie Rozżarzenie', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Walka zaczyna się z 20 pkt Żaru.' },
      { code: 'C6', branch: 'C', name: 'Nieugaszony', levelReq: 10, requires: ['C4'], type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Przy 100 Żaru regeneracja Ki +50%.' },
      { code: 'C7', branch: 'C', name: 'Wulkan', levelReq: 13, requires: ['C5'], excludes: 'C8', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Eksplozja Żaru: promień +50%. Wyklucza C8.' },
      { code: 'C8', branch: 'C', name: 'Detonator', levelReq: 13, requires: ['C6'], excludes: 'C7', type: 'passive', kiCost: 0, cooldown: 0, effectText: 'Eksplozja Żaru: +25% obrażeń, promień −20%. Wyklucza C7.' },
      { code: 'C9', branch: 'C', name: 'Ognisty Kataklizm', levelReq: 16, requires: ['C7', 'C8'], type: 'active', slotKey: 'C', kiCost: 35, cooldown: 30, multiplier: 4.5, effectText: 'Kolumna ognia w dużym obszarze ×4,5 i podpalenie na 5 s.' },
      // Apex T
      { code: 'T', branch: 'apex', name: 'Forma Płomiennego Legendy', levelReq: 20, requires: ['A9', 'B9', 'C9'], type: 'ultimate', slotKey: 'T', kiCost: 50, cooldown: 120, effectText: '20 s: +30% Ataku, Żar utrzymuje się na 100; płomienna aura.' },
    ],
  },
};

export const WEAPONS_CATALOG: EquipmentItem[] = [
  // Planetarni (W-V1..6)
  { id: 'W-V1', name: 'Kij wędrowca (W-V1)', slot: 'weapon', raceId: 'planetary', tier: 1, levelReq: 1, atk: 4, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 0 },
  { id: 'W-V2', name: 'Glewia korzenna (W-V2)', slot: 'weapon', raceId: 'planetary', tier: 2, levelReq: 4, atk: 10, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 120 },
  { id: 'W-V3', name: 'Ostrze zielonego szlaku (W-V3)', slot: 'weapon', raceId: 'planetary', tier: 3, levelReq: 7, atk: 15, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 260 },
  { id: 'W-V4', name: 'Włócznia Przystani (W-V4)', slot: 'weapon', raceId: 'planetary', tier: 4, levelReq: 10, atk: 21, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 480 },
  { id: 'W-V5', name: 'Halabarda Żywej Ziemi (W-V5)', slot: 'weapon', raceId: 'planetary', tier: 5, levelReq: 14, atk: 27, def: 0, hp: 20, ki: 0, critPp: 0, kiRegen: 0, price: 780 },
  { id: 'W-V6', name: 'Ostrze Pierwszego Gaju (W-V6)', slot: 'weapon', raceId: 'planetary', tier: 6, levelReq: 18, atk: 34, def: 0, hp: 0, ki: 8, critPp: 0, kiRegen: 0, price: 1200 },
  // Mędrcy (W-A1..6)
  { id: 'W-A1', name: 'Kostur nowicjusza (W-A1)', slot: 'weapon', raceId: 'sage', tier: 1, levelReq: 1, atk: 4, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 0 },
  { id: 'W-A4', name: 'Pieczęć Biblioteki (W-A4)', slot: 'weapon', raceId: 'sage', tier: 4, levelReq: 10, atk: 21, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 480 },
  { id: 'W-A6', name: 'Berło Czystego Źródła (W-A6)', slot: 'weapon', raceId: 'sage', tier: 6, levelReq: 18, atk: 34, def: 0, hp: 0, ki: 12, critPp: 0, kiRegen: 0, price: 1200 },
  // Androidy (W-N1..6)
  { id: 'W-N1', name: 'Emiter treningowy (W-N1)', slot: 'weapon', raceId: 'android', tier: 1, levelReq: 1, atk: 4, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 0 },
  { id: 'W-N4', name: 'Karabin Impulsowy (W-N4)', slot: 'weapon', raceId: 'android', tier: 4, levelReq: 10, atk: 21, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 480 },
  { id: 'W-N6', name: 'Matryca Wolnego Rdzenia (W-N6)', slot: 'weapon', raceId: 'android', tier: 6, levelReq: 18, atk: 34, def: 0, hp: 0, ki: 8, critPp: 0, kiRegen: 0, price: 1200 },
  // Legendy (W-P1..6)
  { id: 'W-P1', name: 'Tępe ostrze próby (W-P1)', slot: 'weapon', raceId: 'legend', tier: 1, levelReq: 1, atk: 4, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 0 },
  { id: 'W-P4', name: 'Miecz Płomiennego Traktu (W-P4)', slot: 'weapon', raceId: 'legend', tier: 4, levelReq: 10, atk: 21, def: 0, hp: 0, ki: 0, critPp: 0, kiRegen: 0, price: 480 },
  { id: 'W-P6', name: 'Ostrze Ocalonego Świtu (W-P6)', slot: 'weapon', raceId: 'legend', tier: 6, levelReq: 18, atk: 34, def: 0, hp: 0, ki: 8, critPp: 0, kiRegen: 0, price: 1200 },
];

export const ARMOR_SETS_BY_TIER: { tier: number; name: string; levelReq: number; defTotal: number; hpTotal: number }[] = [
  { tier: 1, name: 'Komplet Ucznia (T1)', levelReq: 1, defTotal: 6, hpTotal: 0 },
  { tier: 2, name: 'Komplet Wędrowca (T2)', levelReq: 4, defTotal: 11, hpTotal: 24 },
  { tier: 3, name: 'Komplet Strażnika (T3)', levelReq: 7, defTotal: 15, hpTotal: 48 },
  { tier: 4, name: 'Komplet Łącznika (T4)', levelReq: 10, defTotal: 19, hpTotal: 72 },
  { tier: 5, name: 'Komplet Powiernika (T5)', levelReq: 14, defTotal: 23, hpTotal: 96 },
  { tier: 6, name: 'Komplet Chóru (T6)', levelReq: 18, defTotal: 27, hpTotal: 120 },
];

export const JEWELRY_CATALOG: EquipmentItem[] = [
  { id: 'J-01', name: 'Amulet rzeki (J-01)', slot: 'amulet', tier: 2, levelReq: 4, atk: 0, def: 0, hp: 12, ki: 0, critPp: 0, kiRegen: 0, price: 90 },
  { id: 'J-03', name: 'Amulet jasnej wody (J-03)', slot: 'amulet', tier: 3, levelReq: 7, atk: 0, def: 0, hp: 0, ki: 12, critPp: 0, kiRegen: 0.15, price: 180 },
  { id: 'J-05', name: 'Amulet postoju (J-05)', slot: 'amulet', tier: 4, levelReq: 10, atk: 0, def: 2, hp: 30, ki: 0, critPp: 0, kiRegen: 0, price: 300 },
  { id: 'J-09', name: 'Amulet wolnej jednostki (J-09)', slot: 'amulet', tier: 6, levelReq: 18, atk: 0, def: 2, hp: 0, ki: 24, critPp: 0, kiRegen: 0.35, price: 600 },
  { id: 'J-11', name: 'Amulet wspólnego oddechu (J-11)', slot: 'amulet', tier: 6, levelReq: 20, atk: 0, def: 2, hp: 30, ki: 18, critPp: 0, kiRegen: 0.25, price: 700 },
  { id: 'J-02', name: 'Pierścień ogrodnika (J-02)', slot: 'ring', tier: 2, levelReq: 4, atk: 0, def: 1, hp: 8, ki: 0, critPp: 0, kiRegen: 0, price: 90 },
  { id: 'J-04', name: 'Pierścień precyzji (J-04)', slot: 'ring', tier: 3, levelReq: 7, atk: 0, def: 0, hp: 0, ki: 0, critPp: 1.0, kiRegen: 0, price: 180 },
  { id: 'J-08', name: 'Pierścień kartografa (J-08)', slot: 'ring', tier: 5, levelReq: 14, atk: 0, def: 1, hp: 0, ki: 0, critPp: 1.5, kiRegen: 0, price: 450 },
  { id: 'J-10', name: 'Pierścień świadków (J-10)', slot: 'ring', tier: 6, levelReq: 18, atk: 0, def: 0, hp: 20, ki: 0, critPp: 2.0, kiRegen: 0, price: 600 },
];

export const CONSUMABLES_CATALOG: ConsumableItem[] = [
  { id: 'U-01', name: 'Mały opatrunek (U-01)', levelReq: 1, category: 'heal', cooldownSec: 6, description: 'Leczy 25% maks. HP; wspólne odnowienie HP 6 s.', healPct: 0.25 },
  { id: 'U-05', name: 'Gęsta mikstura życia (U-05)', levelReq: 10, category: 'heal', cooldownSec: 6, description: 'Leczy 45% maks. HP; wspólne odnowienie HP 6 s.', healPct: 0.45 },
  { id: 'U-06', name: 'Mikstura ratunkowa (U-06)', levelReq: 18, category: 'heal', cooldownSec: 6, description: 'Leczy 60% maks. HP; wspólne odnowienie HP 6 s.', healPct: 0.6 },
  { id: 'U-03', name: 'Napar głębokiego źródła (U-03)', levelReq: 10, category: 'ki', cooldownSec: 12, description: 'Odnawia 40% maks. KI.', kiRestorePct: 0.4 },
  { id: 'U-09', name: 'Bulion żarowy (U-09)', levelReq: 14, category: 'food', cooldownSec: 10, description: 'Przez 300 s +40 maks. HP i +0,25 KI/s (grupa jedzenia).', buffHpFlat: 40, buffKiRegen: 0.25 },
  { id: 'U-12', name: 'Tonik oczyszczenia (U-12)', levelReq: 10, category: 'cleanse', cooldownSec: 30, description: 'Usuwa truciznę, podpalenie i krwawienie; odnowienie 30 s.', cleanses: 'all_dot' },
];

export function computeFullHeroStats(params: {
  raceId: HeroRace['id'];
  level: number;
  allocatedNodes: string[];
  weaponId: string;
  weaponUpgrade: 0 | 1 | 2 | 3;
  armorTier: number;
  armorUpgrade: 0 | 1 | 2;
  amuletId: string;
  ringId: string;
  foodBuffActive: boolean;
  transformationActive: boolean;
  rageActive: boolean;
  fortificationActive: boolean;
}): ComputedHeroStats {
  const base = getBaseStatsAtLevel(params.raceId, params.level);
  const nodes = new Set(params.allocatedNodes);

  const weapon = WEAPONS_CATALOG.find((w) => w.id === params.weaponId);
  const armor = ARMOR_SETS_BY_TIER.find((a) => a.tier === params.armorTier);
  const amulet = JEWELRY_CATALOG.find((j) => j.id === params.amuletId);
  const ring = JEWELRY_CATALOG.find((j) => j.id === params.ringId);

  const weaponAtk = (weapon?.atk || 0) + params.weaponUpgrade * 3;
  const armorDef = (armor?.defTotal || 0) + params.armorUpgrade * 2;
  const armorHp = (armor?.hpTotal || 0) + params.armorUpgrade * 10;

  let hp = base.hp + (weapon?.hp || 0) + armorHp + (amulet?.hp || 0) + (ring?.hp || 0);
  let ki = base.ki + (weapon?.ki || 0) + (amulet?.ki || 0) + (ring?.ki || 0);
  let atk = base.atk + weaponAtk;
  let def = base.def + armorDef + (amulet?.def || 0) + (ring?.def || 0);
  let moveSpeed = base.moveSpeedUnits;
  let kiRegen = base.kiRegenPerSec + (amulet?.kiRegen || 0) + (ring?.kiRegen || 0);
  let crit = base.critChancePct + (amulet?.critPp || 0) + (ring?.critPp || 0);
  let attackMs = base.attackIntervalMs;

  if (params.foodBuffActive) {
    hp += 40;
    kiRegen += 0.25;
  }

  // Passive skill tree modifiers per race
  let hpMult = 1;
  let kiMult = 1;
  let atkMult = 1;
  let defMult = 1;
  let speedMult = 1;
  let shieldBonus = 0;
  let ccRed = 0;
  let kiCostRed = 0;
  let cdRed = 0;

  if (params.raceId === 'planetary') {
    if (nodes.has('A2')) speedMult += 0.06;
    if (nodes.has('A6')) crit += 5;
    if (nodes.has('B2')) kiRegen *= 1.3; // Forest terrain adaptation default in Verdant
    if (nodes.has('B3')) defMult += 0.08;
    if (nodes.has('C2')) hpMult += 0.10;
    if (nodes.has('C5')) ccRed += 25;
    if (params.transformationActive) {
      atkMult += 0.20;
      defMult += 0.15;
      speedMult += 0.10;
    }
  } else if (params.raceId === 'sage') {
    if (nodes.has('A6')) crit += 8;
    if (nodes.has('B7')) shieldBonus += 30;
    if (nodes.has('C2')) kiMult += 0.15;
    if (nodes.has('C3')) kiCostRed += 8;
    if (nodes.has('C5')) ccRed += 25;
    if (params.transformationActive) {
      atkMult += 0.25;
      defMult += 0.15;
      cdRed += 30;
    }
  } else if (params.raceId === 'android') {
    if (nodes.has('A2')) crit += 6;
    if (nodes.has('A6')) attackMs = Math.round(attackMs * 0.92);
    if (nodes.has('A7')) attackMs = Math.round(attackMs * 1.10);
    if (nodes.has('B2')) defMult += 0.08;
    if (nodes.has('B3')) shieldBonus += 25;
    if (nodes.has('C5')) kiMult += 0.12;
    if (params.fortificationActive) defMult += 0.60;
    if (params.transformationActive) {
      atkMult += 0.25;
      defMult += 0.15;
    }
  } else if (params.raceId === 'legend') {
    if (nodes.has('A5')) atkMult += 0.08;
    if (nodes.has('A6')) crit += 6;
    if (nodes.has('B2')) defMult += 0.08;
    if (nodes.has('B3')) hpMult += 0.10;
    if (params.rageActive) {
      atkMult += nodes.has('B7') ? 0.40 : 0.30;
      if (!nodes.has('B8')) defMult -= 0.20;
    }
    if (params.transformationActive) {
      atkMult += 0.30;
    }
  }

  return {
    level: params.level,
    rankTitle: getStoryRank(params.level),
    xpCurrentLevel: getTotalCumulativeXp(params.level),
    xpNextLevel: getXpForNextLevel(params.level),
    maxHp: Math.round(hp * hpMult),
    maxKi: Math.round(ki * kiMult),
    atk: Math.round(atk * atkMult),
    def: Math.max(0, Math.round(def * defMult)),
    moveSpeedUnits: Math.round(moveSpeed * speedMult),
    kiRegenPerSec: Number(kiRegen.toFixed(2)),
    critChancePct: Number(crit.toFixed(2)),
    attackIntervalMs: attackMs,
    shieldCapacityBonusPct: shieldBonus,
    ccReductionPct: ccRed,
    kiCostReductionPct: kiCostRed,
    cooldownReductionPct: cdRed,
  };
}

// Canonical Damage Formula from Chapter 18 (str. 85):
// Example control check: Planetary Lv.10 (48 ATK) + W-V4 (+21) = 69 ATK vs DEF 24 -> 69 - 12 = 57 damage
export function calculateCanonicalDamage(params: {
  attackerAtk: number;
  defenderDef: number;
  skillMultiplier?: number;
  isCrit?: boolean;
  backstabBonusPct?: number;
  weaknessBonusPct?: number;
  markedBonusPct?: number;
}): { damage: number; mitigated: number } {
  const mult = params.skillMultiplier ?? 1.0;
  const critMult = params.isCrit ? 1.5 : 1.0;
  const bonusMult =
    1 +
    (params.backstabBonusPct || 0) / 100 +
    (params.weaknessBonusPct || 0) / 100 +
    (params.markedBonusPct || 0) / 100;

  const rawAtk = params.attackerAtk * mult * critMult * bonusMult;
  const mitigated = Math.round(params.defenderDef * 0.5);
  const damage = Math.max(1, Math.round(rawAtk - mitigated));
  return { damage, mitigated };
}
