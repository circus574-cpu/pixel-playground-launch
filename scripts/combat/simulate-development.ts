/** Read-only balance experiment on production kits/AI/contacts. No tuning of canonical data. */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { GameSession, EQUIPMENT_SLOTS, getSlotForItem, xpNeeded } from "../../src/game/session";
import { RACE_IDS, RACES } from "../../src/game/world/races";
import { WORLDS } from "../../src/game/world/worlds";
import { MONSTERS } from "../../src/game/monsters/catalog";
import {
  DEVELOPMENT_ENCOUNTERS,
  developmentMonster,
} from "../../src/game/development/expeditions/catalog";
import { Navigation, distance } from "../../src/game/navigation";
import { emptyDevelopment, CurrentDevelopmentSchema } from "../../src/game/development/state";
import { DISCIPLINES, EXAM_IDS, trainingCost } from "../../src/game/development/training";
import { TRIALS, trialReceipt, trialReward } from "../../src/game/development/trials/catalog";
import { requiredTrialUnlocks } from "../../src/game/development/trials/unlocks";
import { validLearned } from "../../src/game/kit";
import { ITEM_CATALOG } from "../../src/game/items/catalog";
const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1]!;
};
const trials = Number(arg("--trials", "2")),
  output = arg("--output", "/tmp/ki-development-balance");
if (!Number.isInteger(trials) || trials < 1 || trials > 50) throw Error("Invalid trial count");
const random = (value: number) => () => {
  value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
  return value / 4294967296;
};
const hash = (v: string) => parseInt(createHash("sha256").update(v).digest("hex").slice(0, 8), 16);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const nav = new Navigation(8192, 8192, []);
const rows: Record<string, unknown>[] = [],
  started = performance.now();
let ordinal = 0;
for (const race of RACE_IDS)
  for (const level of [1, 10, 20, 30, 40])
    for (const training of ["none", "mid", "max"] as const)
      for (const branch of ["A", "B", "C"] as const)
        for (const gear of ["bare", "starter", "catalog"] as const) {
          const normal = MONSTERS.filter(
            (m) => m.world === RACES[race].world && Math.abs(m.level - Math.min(18, level)) <= 2,
          ).slice(-2);
          const variants = DEVELOPMENT_ENCOUNTERS.filter(
            (m) => m.race === race && Math.abs(m.level - level) <= 4,
          );
          for (const opponent of [
            ...normal.map((d) => ({ key: d.id, variant: null, def: d })),
            ...variants.map((v) => ({ key: v.id, variant: v.id, def: developmentMonster(v) })),
          ]) {
            const key = [race, level, training, branch, gear, opponent.key].join("|");
            let wins = 0,
              deaths = 0,
              timeouts = 0,
              casts = 0,
              potions = 0,
              kiSpent = 0,
              healing = 0,
              combatTotal = 0;
            const times: number[] = [],
              remaining: number[] = [];
            for (let trial = 0; trial < trials; trial++) {
              const base = WORLDS[RACES[race].world],
                world = {
                  ...base,
                  width: 8192,
                  height: 8192,
                  spawn: { x: 4096, y: 4096 },
                  enemies: [],
                  monsters: [],
                  npcs: [],
                  objects: [],
                  obstacles: [],
                  safeAreas: [],
                };
              delete world.city;
              delete world.terrain;
              const s = new GameSession(undefined, race, {
                world,
                navigation: nav,
                random: random(hash(key + ":" + trial)),
              });
              s.player.level = level;
              const d = emptyDevelopment();
              s.player.development = d;
              if (training !== "none") {
                // Declared rank prerequisites, not a claim that a bot earned these in a story playthrough.
                for (const id of EXAM_IDS) {
                  d.passedExamIds.push(id);
                  d.rewardReceipts[id + ":v1"] = { practice: 250 };
                  d.practiceEarned += 250;
                }
                for (const t of TRIALS.filter((t) => t.race === race)) {
                  d.trials[t.id] = 3;
                  for (const tier of [1, 2, 3] as const) {
                    d.rewardReceipts[trialReceipt(t.id, tier)] = { practice: trialReward(tier) };
                    d.practiceEarned += trialReward(tier);
                  }
                }
                const unlock = requiredTrialUnlocks(d.trials);
                d.unlockedVariants = unlock.variants;
                d.unlockedModules = unlock.modules;
                for (const k of DISCIPLINES) d.training[k] = training === "max" ? 18 : 8;
                d.practiceSpent = trainingCost(d.training);
                if (race === "android")
                  d.equippedModuleIds =
                    training === "max"
                      ? ["mn-optics", "mn-precision", "mn-routing"]
                      : ["mn-optics"];
              }
              CurrentDevelopmentSchema.parse(d);
              for (const n of [1, 2, 3, 4, 5, 6, 7, 9])
                s.command({ type: "learn", node: branch + n });
              // Spend remaining legal points within this branch, respecting its actual prerequisites/exclusions.
              for (let i = 0; i < level; i++)
                for (const n of [1, 4, 5, 2, 3, 6, 7, 9])
                  s.command({ type: "learn", node: branch + n });
              if (!validLearned(race, level, s.player.skills))
                throw Error("Invalid learned profile");
              if (gear === "starter") {
                s.player.items.sword = 1;
                s.player.items.vest = 1;
                s.command({ type: "equip", item: "sword" });
                s.command({ type: "equip", item: "vest" });
              }
              if (gear === "catalog")
                for (const slot of EQUIPMENT_SLOTS) {
                  const candidates = ITEM_CATALOG.filter(
                    (i) =>
                      getSlotForItem(i.id) === slot &&
                      i.stats &&
                      (i.level ?? 1) <= level &&
                      ["all", "neutral", RACES[race].world].includes(i.sourceContinent ?? "all"),
                  );
                  const score = (i: (typeof ITEM_CATALOG)[number]) =>
                    Object.values(i.stats ?? {}).reduce(
                      (n, v) => n + (typeof v === "number" ? v : 0),
                      0,
                    );
                  candidates.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
                  const item = candidates[0];
                  if (item) {
                    s.player.bagItems ??= {};
                    s.player.bagItems[item.id] = 1;
                    s.command({ type: "equip", item: item.id });
                  }
                }
              s.player.hp = s.kit.stats.maxHp;
              s.player.ki = s.kit.stats.maxKi;
              s.player.items.potion = 3;
              const enemy = opponent.variant
                ? s.monsters.spawnDevelopment(opponent.variant, { x: 4256, y: 4096 }, "subject")
                : s.monsters.spawn(opponent.def.id, { x: 4256, y: 4096 }, "subject");
              let elapsed = 0;
              const p0 = s.player.items.potion;
              for (
                ;
                elapsed < 180000 &&
                !s.player.dead &&
                s.enemies.some((e) => e.hp > 0 && e.mode !== "dead");
                elapsed += 50
              ) {
                const foe = s.enemies.find(
                  (e) => e.hp > 0 && e.mode !== "dead" && !e.m.hidden && !e.m.invulnerable,
                );
                if (foe && !s.kit.channel) {
                  if (distance(s.player, foe) > Math.min(80, s.kit.basicRange * 0.75))
                    s.command({ type: "move", x: foe.x, y: foe.y });
                  else {
                    s.command({ type: "target", id: foe.id });
                    s.command({ type: "ability", ability: "R" });
                    for (const a of s.kit.abilities()) {
                      if (!a.ready || ["T", "R", "potion"].includes(a.id) || a.ki > s.player.ki)
                        continue;
                      if (
                        race === "sage" &&
                        ((a.id === "C1" && s.player.ki > s.kit.stats.maxKi * 0.5) ||
                          (a.id === "C4" && s.player.hp > s.kit.stats.maxHp * 0.7))
                      )
                        continue;
                      const ki = s.player.ki,
                        rem = s.kit.remaining(a.id);
                      s.command({ type: "ability", ability: a.id });
                      kiSpent += Math.max(0, ki - s.player.ki);
                      if (s.kit.remaining(a.id) > rem) casts++;
                      if (s.kit.channel) break;
                    }
                  }
                }
                if (s.player.hp < s.kit.stats.maxHp * 0.5)
                  s.command({ type: "ability", ability: "potion" });
                s.tick(50);
                s.events.length = 0;
              }
              combatTotal += elapsed / 1000;
              if (s.player.dead) deaths++;
              else if (!s.enemies.some((e) => e.hp > 0 && e.mode !== "dead")) {
                wins++;
                times.push(elapsed / 1000);
              } else timeouts++;
              potions += p0 - s.player.items.potion;
              remaining.push(Math.max(0, s.player.hp / s.kit.stats.maxHp));
              // Healing is an out-of-combat recovery estimate, separate from measured combat duration.
              healing += Math.max(0, 1 - s.player.hp / s.kit.stats.maxHp) / 0.003;
              void enemy;
            }
            const fight = median(times),
              heal = healing / trials,
              xp = opponent.def.xp;
            rows.push({
              race,
              level,
              training,
              branch,
              gear,
              opponent: opponent.key,
              monsterLevel: opponent.def.level,
              trials,
              wins,
              deaths,
              timeouts,
              winRate: wins / trials,
              fightSecondsMedian: times.length ? fight : null,
              fightSecondsMeanAllAttempts: combatTotal / trials,
              remainingHpMedian: median(remaining),
              skillCasts: casts,
              kiSpentMean: kiSpent / trials,
              potionsMean: potions / trials,
              practicePerRepeat: 0,
              healingEstimateSeconds: heal,
              throughput: [15, 30, 60].map((travel) => ({
                travelSeconds: travel,
                interactionSeconds: 5,
                xpPerHour: Math.round(
                  (3600 * xp * (wins / trials)) /
                    Math.max(1, combatTotal / trials + travel + heal + 5),
                ),
              })),
            });
            if (++ordinal % 250 === 0) process.stdout.write(`${ordinal} profiles\n`);
          }
        }
mkdirSync(output, { recursive: true });
const report = {
  format: "ki-development-balance-1",
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  runtimeMs: Math.round(performance.now() - started),
  seed: "sha256(profile:trial) + LCG",
  inputs: {
    training: { none: 0, mid: 8, max: 18 },
    trainingTotalRanks: { none: 0, mid: 40, max: 90 },
    gear: ["bare", "starter", "highest catalog score within actual level/continent restrictions"],
    skills:
      "one canonical branch A/B/C, valid prerequisites and exclusions; remaining legal points become ranks",
    supplies:
      "three HP potions at the start of each isolated fight; not a sustainable supply/economy model",
  },
  stepMs: 50,
  profiles: rows.length,
  trials,
  rows,
  notes: [
    "Controlled prerequisites and gear, not earned campaign saves.",
    "No render timing and no human reading-time claims.",
    "Travel 15/30/60 s, interaction 5 s and 0.3% HP/s recovery are sensitivity assumptions, not a measured human campaign duration.",
    "Fixed practice per repeat is zero. Ordinary kill XP is the opponent catalog value.",
    "Combat movement and skills use actual GameSession/Kit/MonsterSystem; healing and travel remain separately declared estimates.",
    "Normal monster and canonical racial/skill numbers are unchanged.",
  ],
  xp: {
    oneTo20: Array.from({ length: 19 }, (_, i) => xpNeeded(i + 1)).reduce((n, v) => n + v, 0),
    twentyTo40: Array.from({ length: 20 }, (_, i) => xpNeeded(i + 20)).reduce((n, v) => n + v, 0),
  },
};
writeFileSync(output + "/balance.json", JSON.stringify(report, null, 2) + "\n");
writeFileSync(
  output + "/summary.json",
  JSON.stringify(
    {
      ...report,
      rows: undefined,
      slices: ["1–20", "20–40"].map((range, i) => {
        const selected = rows.filter((r) =>
          i ? (r["level"] as number) > 20 : (r["level"] as number) <= 20,
        );
        return {
          range,
          cases: selected.length,
          winRateMedian: median(selected.map((r) => r["winRate"] as number)),
          fightSecondsMedian: median(
            selected
              .filter((r) => r["fightSecondsMedian"] !== null)
              .map((r) => r["fightSecondsMedian"] as number),
          ),
        };
      }),
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`${rows.length} profiles complete\n`);
