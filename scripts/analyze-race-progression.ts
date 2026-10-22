import { writeFileSync } from "node:fs";
import { RACE_IDS } from "../src/game/world/races";
import { TREES } from "../src/game/progression/catalog";
import { raceStats, graphErrors, raceDamage } from "../src/game/progression/model";
const growth = RACE_IDS.flatMap((race) =>
  Array.from({ length: 20 }, (_, index) => ({
    race,
    level: index + 1,
    ...raceStats(race, index + 1),
  })),
);
const bosses = [
  { level: 5, hp: 450, attack: 23, defense: 11 },
  { level: 10, hp: 1080, attack: 45, defense: 27 },
  { level: 15, hp: 1970, attack: 78, defense: 41 },
  { level: 20, hp: 3120, attack: 121, defense: 60 },
];
const basicBaseline = RACE_IDS.flatMap((race) =>
  bosses.map((b) => {
    const s = raceStats(race, b.level),
      damage = raceDamage(s.attack, 1, b.defense);
    const hits = Math.ceil(b.hp / damage);
    return {
      race,
      enemyLevel: b.level,
      damagePerBasicHit: damage,
      hitsToDefeat: hits,
      minimumAttackTimelineSeconds: ((hits - 1) * s.interval) / 1000,
      enemyHitsToDefeatPlayer: Math.ceil(s.maxHp / raceDamage(b.attack, 1, s.defense)),
    };
  }),
);
writeFileSync(
  "docs/qa/race-progression/catalog.json",
  JSON.stringify(
    {
      source: "22.10.2026 annex v1.0; canonical world names per owner",
      nodes: Object.values(TREES).flat(),
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "docs/qa/race-progression/analysis.json",
  JSON.stringify(
    {
      assumptions: [
        "Base stats only; no gear, passives, forms, criticals, combo, heat, regen, potions or movement.",
        "Attack timeline assumes first hit at t=0 and constant range. This is not a fight simulation or a balance verdict.",
        "Boss stats transcribed from the bestiary. Enemy attack cadence is unspecified.",
      ],
      graphErrors: graphErrors(),
      growth,
      basicBaseline,
      multiHitCheck: {
        legendEightHits: Array.from({ length: 8 }, () =>
          raceDamage(101, 4.2 / 8, 60, 1 / 8),
        ).reduce((a, b) => a + b, 0),
        legendSingle: raceDamage(101, 4.2, 60),
        sageSixTicks: Array.from({ length: 6 }, () => raceDamage(101, 2.4 / 6, 60, 1 / 6)).reduce(
          (a, b) => a + b,
          0,
        ),
        sageSingle: raceDamage(101, 2.4, 60),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log("116 nodes; 80 growth rows; 16 explicitly limited basic-attack baselines.");
