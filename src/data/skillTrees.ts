import { ContinentId } from '../game/worlds/types';

export interface SkillNode {
  id: string;
  raceId: ContinentId;
  branch: 1 | 2 | 3 | 4;
  branchName: string;
  tier: number;
  name: string;
  type: 'passive' | 'active' | 'keystone' | 'bridge';
  effectSummary: string;
  parentIds: string[];
  bonuses: {
    hpFlat?: number;
    kiFlat?: number;
    atkPct?: number;
    kiPowerPct?: number;
    defFlat?: number;
    critPct?: number;
    moveSpeedPct?: number;
  };
}

export interface RaceCoreMechanic {
  raceId: ContinentId;
  raceName: string;
  coreName: string;
  passiveSummary: string;
  activeSkillName: string;
  activeSkillCooldownSec: number;
  activeSkillDescription: string;
  baseStatsLv1: {
    hp: number;
    ki: number;
    kiRegen: number;
    atk: number;
    kiPower: number;
    def: number;
    res: number;
    speed: number;
    critPct: number;
  };
  statsLv20: {
    hp: number;
    ki: number;
    kiRegen: number;
    atk: number;
    kiPower: number;
    def: number;
    res: number;
    speed: number;
    critPct: number;
  };
}

export const RACE_CORE_MECHANICS: Record<ContinentId, RaceCoreMechanic> = {
  verdant: {
    raceId: 'verdant',
    raceName: 'Planetarni (Verdantia)',
    coreName: 'Serce Gaju (Symbioza i Ciernie)',
    passiveSummary:
      'Regeneruje +2.5% Max HP na sekundę poza zwarciem; otrzymane uderzenia nakładają Ciernie Korzeni i budują ładunki Rozkwitu (+3% OBR za ładunek, maks. 5).',
    activeSkillName: 'Puls Drzewa Serca',
    activeSkillCooldownSec: 8,
    activeSkillDescription:
      'Uwalnia falę szmaragdowego KI: leczy 18% Max HP, nakłada Tarczę Kory (120 HP) i unieruchamia cel Korzeniami na 2.0s.',
    baseStatsLv1: {
      hp: 165,
      ki: 100,
      kiRegen: 4.5,
      atk: 14,
      kiPower: 14,
      def: 15,
      res: 14,
      speed: 100,
      critPct: 5,
    },
    statsLv20: {
      hp: 1020,
      ki: 290,
      kiRegen: 14.0,
      atk: 71,
      kiPower: 71,
      def: 72,
      res: 67,
      speed: 195,
      critPct: 14.5,
    },
  },
  pyra: {
    raceId: 'pyra',
    raceName: 'Legendy (Pyra)',
    coreName: 'Żar Krwi (Furia Kalderionu)',
    passiveSummary:
      'Za każde brakujące 10% HP zyskuje +4.5% ATK i +2.5% Szansy Krytycznej. Poniżej 35% HP aktywuje Płomień Przodek (obrażenia podpalające przy każdym trafieniu).',
    activeSkillName: 'Wybuch Kalderionu',
    activeSkillCooldownSec: 7,
    activeSkillDescription:
      'Uderzenie meteorytowe zadające 240% ATK + 80% Mocy KI oraz nakładające Podpalenie (4% Max HP celu przez 4s).',
    baseStatsLv1: {
      hp: 145,
      ki: 90,
      kiRegen: 4.0,
      atk: 18,
      kiPower: 13,
      def: 11,
      res: 10,
      speed: 105,
      critPct: 8,
    },
    statsLv20: {
      hp: 840,
      ki: 242,
      kiRegen: 11.6,
      atk: 94,
      kiPower: 60.5,
      def: 49,
      res: 48,
      speed: 205,
      critPct: 27,
    },
  },
  aether: {
    raceId: 'aether',
    raceName: 'Mędrcy (Aetheria)',
    coreName: 'Zestrojenie Siedmiu Oktaw',
    passiveSummary:
      'Każde użycie techniki KI buduje Oktawę Harmoni. Przy 3 Oktawach następne zaklęcie ma koszt KI zmniejszony o 50% i gwarantuje Przebicie Odporności (25%).',
    activeSkillName: 'Rezonans Dzwonu Świtu',
    activeSkillCooldownSec: 6,
    activeSkillDescription:
      'Wiązka czystego eteru zadająca 260% Mocy KI, przywracająca 25 KI i nakładająca Uciszenie / Spowolnienie (30% na 3s).',
    baseStatsLv1: {
      hp: 120,
      ki: 140,
      kiRegen: 7.0,
      atk: 10,
      kiPower: 19,
      def: 9,
      res: 16,
      speed: 102,
      critPct: 6,
    },
    statsLv20: {
      hp: 697,
      ki: 425,
      kiRegen: 22.2,
      atk: 48,
      kiPower: 95,
      def: 47,
      res: 73,
      speed: 199,
      critPct: 19.3,
    },
  },
  nexus: {
    raceId: 'nexus',
    raceName: 'Androidy (Nexus-9)',
    coreName: 'Matryca Przeciążenia Omega',
    passiveSummary:
      'Posiada odnawialną barierę energetyczną (15% Max HP) oraz miernik Ciepła Rdzenia (0–100%). W strefie Optymalnego Przeciążenia (60–90%) zadaje +22% obrażeń i ignoruje 20% Pancerza.',
    activeSkillName: 'Salwa Protokołu Zero',
    activeSkillCooldownSec: 7,
    activeSkillDescription:
      'Wystrzeliwuje serię promieni plazmowych (210% ATK + 110% Mocy KI), nakłada Porażenie (+15% otrzymywanych obrażeń) i chłodzi Rdzeń o 30%.',
    baseStatsLv1: {
      hp: 150,
      ki: 115,
      kiRegen: 5.5,
      atk: 15,
      kiPower: 15,
      def: 14,
      res: 12,
      speed: 104,
      critPct: 7,
    },
    statsLv20: {
      hp: 910,
      ki: 334,
      kiRegen: 16.9,
      atk: 72,
      kiPower: 72,
      def: 68,
      res: 59,
      speed: 203,
      critPct: 22.2,
    },
  },
};

function buildRaceSkillTree(
  raceId: ContinentId,
  prefix: string,
  branches: [string, string, string, string],
): SkillNode[] {
  const nodes: SkillNode[] = [];

  // 4 gałęzie x 6 węzłów = 24 węzły gałęziowe
  branches.forEach((branchName, bIdx) => {
    const branchNum = (bIdx + 1) as 1 | 2 | 3 | 4;
    for (let tier = 1; tier <= 6; tier++) {
      const id = `${prefix}-${branchNum}-${tier}`;
      const prevId = tier > 1 ? `${prefix}-${branchNum}-${tier - 1}` : [];
      const isKeystone = tier === 6;
      const isActive = tier === 3 || tier === 5;

      nodes.push({
        id,
        raceId,
        branch: branchNum,
        branchName,
        tier,
        name: isKeystone
          ? `Arcymistrzostwo: ${branchName}`
          : isActive
            ? `Technika ${branchName} ${tier === 3 ? 'I' : 'II'}`
            : `${branchName} — Stopień ${tier}`,
        type: isKeystone ? 'keystone' : isActive ? 'active' : 'passive',
        effectSummary: isKeystone
          ? `+18% skuteczności ścieżki ${branchName}, odblokowuje pełny rezonans żywiołu.`
          : isActive
            ? `Wprowadza ulepszenie aktywnej rotacji bojowej w ścieżce ${branchName}.`
            : `+${tier * 12} HP, +${tier * 2}% ATK/KI oraz +${tier + 1} OBR w ścieżce ${branchName}.`,
        parentIds: Array.isArray(prevId) ? prevId : [prevId],
        bonuses: {
          hpFlat: tier * 12,
          kiFlat: tier * 6,
          atkPct: branchNum === 1 || branchNum === 3 ? tier * 2 : tier,
          kiPowerPct: branchNum === 2 || branchNum === 4 ? tier * 2 : tier,
          defFlat: tier + 1,
          critPct: isKeystone ? 4 : 1,
        },
      });
    }
  });

  // 5 węzłów mostowych (Bridge / Zenit) = łącznie 29 węzłów na rasę
  const bridgeDefs = [
    {
      suffix: 'B1',
      name: 'Most Równowagi I',
      parents: [`${prefix}-1-2`, `${prefix}-2-2`],
      summary: 'Łączy ścieżkę 1 i 2: +35 HP, +15 KI oraz +3% Szybkości Ruchu.',
    },
    {
      suffix: 'B2',
      name: 'Most Równowagi II',
      parents: [`${prefix}-2-3`, `${prefix}-3-3`],
      summary: 'Łączy ścieżkę 2 i 3: +5% ATK, +5% Mocy KI, +4 OBR.',
    },
    {
      suffix: 'B3',
      name: 'Most Równowagi III',
      parents: [`${prefix}-3-4`, `${prefix}-4-4`],
      summary: 'Łączy ścieżkę 3 i 4: +3% Szansy Krytycznej i +25 KI.',
    },
    {
      suffix: 'B4',
      name: 'Węzeł Harmonii Krwi i KI',
      parents: [`${prefix}-1-5`, `${prefix}-4-5`],
      summary: 'Synteza skrajnych gałęzi: +60 HP, +8% obrażeń całkowitych.',
    },
    {
      suffix: 'ZENIT',
      name: 'Korona Przebudzenia (Węzeł 29)',
      parents: [`${prefix}-1-6`, `${prefix}-2-6`, `${prefix}-3-6`, `${prefix}-4-6`],
      summary: 'Szczytowy 29. węzeł drzewka: +120 HP, +12% ATK/KI, +6% Kryt i skrócenie odnowienia o 1.5s.',
    },
  ];

  bridgeDefs.forEach((b, idx) => {
    nodes.push({
      id: `${prefix}-${b.suffix}`,
      raceId,
      branch: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
      branchName: 'Węzeł Mostowy',
      tier: idx + 2,
      name: b.name,
      type: idx === 4 ? 'keystone' : 'bridge',
      effectSummary: b.summary,
      parentIds: b.parents,
      bonuses: {
        hpFlat: idx === 4 ? 120 : 35,
        kiFlat: idx === 4 ? 50 : 15,
        atkPct: idx === 4 ? 12 : 4,
        kiPowerPct: idx === 4 ? 12 : 4,
        defFlat: idx === 4 ? 8 : 3,
        critPct: idx === 4 ? 6 : 2,
        moveSpeedPct: 3,
      },
    });
  });

  return nodes;
}

export const SKILL_TREES_BY_RACE: Record<ContinentId, SkillNode[]> = {
  verdant: buildRaceSkillTree('verdant', 'V', [
    'Korzeń Strażnika',
    'Symbioza Życia',
    'Gniew Cierni',
    'Przebudzenie Gaju',
  ]),
  pyra: buildRaceSkillTree('pyra', 'P', [
    'Furia Płomienia',
    'Stal Kalderu',
    'Krew Przodków',
    'Awatar Popiołu',
  ]),
  aether: buildRaceSkillTree('aether', 'A', [
    'Strumień Eteru',
    'Cisza Dzwonu',
    'Siedem Oktaw',
    'Zenit Czystego KI',
  ]),
  nexus: buildRaceSkillTree('nexus', 'N', [
    'Artyleria Plazmowa',
    'Tarcza Kwantowa',
    'Sieć Taktowania',
    'Protokół Omega',
  ]),
};
