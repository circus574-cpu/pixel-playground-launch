/** Controlled CPU trial of disposable production GameSession instances; no game/source tuning. */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { GameSession, EQUIPMENT_SLOTS, getSlotForItem, statsPort } from "../../src/game/session";
import { createKit, validLearned } from "../../src/game/kit";
import { RACE_IDS, RACES, type RaceId } from "../../src/game/world/races";
import { WORLDS } from "../../src/game/world/worlds";
import { Navigation, distance } from "../../src/game/navigation";
import { MONSTERS } from "../../src/game/monsters/catalog";
import {
  DEVELOPMENT_ENCOUNTERS,
  developmentMonster,
} from "../../src/game/development/expeditions/catalog";
import { ITEM_CATALOG } from "../../src/game/items/catalog";
import { RANK_MODELS, applyRankModel, wilson } from "./skill-rank-models";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1]!;
};
const stage = arg("--stage", "screen"),
  trials = Number(arg("--trials", stage === "stress" ? "32" : "8"));
const shard = Number(arg("--shard", "0")),
  shards = Number(arg("--shards", "1"));
const selectedModels = arg(
  "--models",
  "current,stats-05pp,owner-stats,owner-full,owner-bonus,first-only",
).split(",");
const engineRoot = arg("--engine-root", process.cwd());
const EngineSession = (
  (await import(
    pathToFileURL(engineRoot + "/src/game/session.ts").href
  )) as typeof import("../../src/game/session")
).GameSession;
const provenance = {
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  engineSha: execFileSync("git", ["-C", engineRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  toolSha256: createHash("sha256")
    .update(readFileSync(import.meta.filename))
    .digest("hex"),
  sourceHashes: Object.fromEntries(
    [
      "src/game/kit/base.ts",
      "src/game/kit/planetary.ts",
      "src/game/kit/sage.ts",
      "src/game/kit/android.ts",
      "src/game/kit/legend.ts",
      "src/game/session.ts",
      "src/game/monsters/system.ts",
      "src/game/items/catalog.ts",
    ].map((p) => [
      p,
      createHash("sha256")
        .update(readFileSync(engineRoot + "/" + p))
        .digest("hex"),
    ]),
  ),
};
const levels = arg("--levels", stage === "screen" ? "10,20,28,34,40" : "20,40")
  .split(",")
  .map(Number);
if (levels.some((level) => !Number.isInteger(level) || level < 1 || level > 40))
  throw Error("Invalid levels");
const output = arg("--output", "/tmp/ki-skill-rank-measurement");
if (
  !["screen", "stress"].includes(stage) ||
  !Number.isInteger(trials) ||
  trials < 1 ||
  trials > 256 ||
  !Number.isInteger(shard) ||
  !Number.isInteger(shards) ||
  shards < 1 ||
  shard < 0 ||
  shard >= shards
)
  throw Error("Invalid arguments");
const rng = (value: number) => () => {
  value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
  return value / 4294967296;
};
const hash = (s: string) => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16);
const quantile = (a: number[], q: number) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor((b.length - 1) * q)]!;
};
const walls = stage === "stress" ? [{ x: 4180, y: 3960, width: 36, height: 240 }] : [];
const nav = new Navigation(8192, 8192, walls);
const rarity = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
type Gear = "bare" | "reference" | "catalog";
function gearFor(race: RaceId, level: number, gear: Gear) {
  if (gear === "bare") return [];
  return EQUIPMENT_SLOTS.flatMap((slot) => {
    const items = ITEM_CATALOG.filter(
      (i) =>
        getSlotForItem(i.id) === slot &&
        i.stats &&
        (i.level ?? 1) <= level &&
        ["all", "neutral", RACES[race].world].includes(i.sourceContinent ?? "all") &&
        (gear === "catalog" || rarity[i.rarity] <= 1),
    );
    // Fixed, reproducible reference equipment, not a claim about optimal builds or natural acquisition.
    items.sort(
      (a, b) =>
        (b.level ?? 1) - (a.level ?? 1) ||
        rarity[b.rarity] - rarity[a.rarity] ||
        a.id.localeCompare(b.id),
    );
    return items[0] ? [items[0].id] : [];
  });
}
function opponents(race: RaceId, level: number) {
  const world = RACES[race].world;
  if (level >= 20) {
    const nearest = Math.min(
      ...DEVELOPMENT_ENCOUNTERS.filter((d) => d.race === race).map((d) =>
        Math.abs(d.level - level),
      ),
    );
    return DEVELOPMENT_ENCOUNTERS.filter(
      (d) => d.race === race && Math.abs(d.level - level) === nearest,
    ).map((d) => ({ id: d.id, variant: true, def: developmentMonster(d) }));
  }
  return MONSTERS.filter((d) => d.world === world)
    .sort(
      (a, b) => Math.abs(a.level - level) - Math.abs(b.level - level) || a.id.localeCompare(b.id),
    )
    .slice(0, 2)
    .map((def) => ({ id: def.id, variant: false, def }));
}
function learn(s: GameSession, branch: string) {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 9]) s.command({ type: "learn", node: branch + n });
  for (let i = 0; i < s.player.level; i++)
    for (const n of [1, 4, 5, 2, 3, 6, 7, 9]) s.command({ type: "learn", node: branch + n });
  if (!validLearned(s.player.race, s.player.level, s.player.skills)) throw Error("Illegal build");
}
function session(race: RaceId, level: number, branch: string, items: string[], seed: number) {
  const base = WORLDS[RACES[race].world];
  const world = {
    ...base,
    width: 8192,
    height: 8192,
    spawn: { x: 4096, y: 4096 },
    enemies: [],
    monsters: [],
    npcs: [],
    objects: [],
    obstacles: walls,
    safeAreas: [],
  };
  delete world.city;
  delete world.terrain;
  const s = new EngineSession(undefined, race, { world, navigation: nav, random: rng(seed) });
  s.player.level = level;
  learn(s, branch);
  for (const id of items) {
    s.player.bagItems ??= {};
    s.player.bagItems[id] = 1;
    s.command({ type: "equip", item: id });
    if (s.player.equipment![getSlotForItem(id)!] !== id)
      throw Error("Rejected equipment " + id + ": " + s.notice);
  }
  return s;
}

const rows: Record<string, unknown>[] = [],
  started = performance.now();
let ordinal = 0,
  completed = 0;
for (const race of RACE_IDS)
  for (const level of levels)
    for (const branch of ["A", "B", "C"])
      for (const gear of (stage === "screen"
        ? ["bare", "reference", "catalog"]
        : ["reference", "catalog"]) as Gear[]) {
        const enemies = opponents(race, level),
          items = gearFor(race, level, gear);
        for (const index of stage === "screen" ? [0, 1] : [0])
          for (const model of RANK_MODELS.filter((m) => selectedModels.includes(m.id))) {
            const job = ordinal++;
            if (job % shards !== shard) continue;
            const lineup = stage === "screen" ? [enemies[index]!] : enemies;
            const key = [stage, race, level, branch, gear, ...lineup.map((d) => d.id)].join("|");
            const seedKey = [stage, race, level, branch, ...lineup.map((d) => d.id)].join("|");
            let wins = 0,
              deaths = 0,
              timeouts = 0,
              casts = 0,
              kiSpent = 0,
              potions = 0,
              totalSeconds = 0,
              changedLevel = 0;
            let startStats: unknown = null,
              skills: string[] = [];
            const times: number[] = [],
              hp: number[] = [],
              remainingKi: number[] = [],
              allTimes: number[] = [];
            const samples: Record<string, unknown>[] = [];
            for (let trial = 0; trial < trials; trial++) {
              const previousCasts = casts,
                previousKi = kiSpent;
              // Model id is intentionally absent from the seed: paired initial conditions across policies.
              const s = session(race, level, branch, items, hash(seedKey + ":" + trial));
              applyRankModel(s.kit, model);
              const initial = s.kit.stats;
              startStats = initial;
              skills = [...s.player.skills];
              s.player.hp = initial.maxHp;
              s.player.ki = initial.maxKi;
              s.player.items.potion = 3;
              for (const [i, enemy] of lineup.entries()) {
                const at = { x: 4256 + i * 80, y: 4096 + i * 70 };
                if (enemy.variant) s.monsters.spawnDevelopment(enemy.id, at, "subject:" + i);
                else s.monsters.spawn(enemy.id, at, "subject:" + i);
              }
              let elapsed = 0;
              for (
                ;
                elapsed < 120000 &&
                !s.player.dead &&
                s.enemies.some((e) => e.hp > 0 && e.mode !== "dead");
                elapsed += 50
              ) {
                const foe = s.enemies.find(
                  (e) => e.hp > 0 && e.mode !== "dead" && !e.m.hidden && !e.m.invulnerable,
                );
                if (foe && !s.kit.channel) {
                  if (distance(s.player, foe) > Math.min(80, s.kit.basicRange * 0.75)) {
                    // Allow the actual A* route to advance instead of resetting its first waypoint
                    // every tick. Re-aim at moving targets at a deliberate 300 ms input cadence.
                    if (elapsed % 300 === 0) s.command({ type: "move", x: foe.x, y: foe.y });
                  } else {
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
              const seconds = elapsed / 1000;
              allTimes.push(seconds);
              totalSeconds += seconds;
              if (s.player.dead) deaths++;
              else if (!s.enemies.some((e) => e.hp > 0 && e.mode !== "dead")) {
                wins++;
                times.push(seconds);
              } else timeouts++;
              if (s.player.level !== level) changedLevel++;
              samples.push({
                trial,
                seed: hash(seedKey + ":" + trial),
                outcome: s.player.dead
                  ? "death"
                  : s.enemies.some((e) => e.hp > 0 && e.mode !== "dead")
                    ? "timeout"
                    : "win",
                seconds,
                kiSpent: kiSpent - previousKi,
                casts: casts - previousCasts,
                potions: 3 - s.player.items.potion,
                hp: Math.max(0, s.player.hp / s.kit.stats.maxHp),
                ki: s.player.ki / s.kit.stats.maxKi,
              });
              potions += 3 - s.player.items.potion;
              hp.push(Math.max(0, s.player.hp / s.kit.stats.maxHp));
              remainingKi.push(s.player.ki / s.kit.stats.maxKi);
            }
            rows.push({
              stage,
              key,
              race,
              level,
              branch,
              gear,
              model: model.id,
              opponents: lineup.map((d) => ({
                id: d.id,
                level: d.def.level,
                hp: d.def.hp,
                attack: d.def.atk,
                defense: d.def.def,
              })),
              items,
              skills,
              startStats,
              trials,
              wins,
              deaths,
              timeouts,
              winRate: wins / trials,
              winRate95: wilson(wins, trials),
              ttkP10: quantile(times, 0.1),
              ttkMedian: quantile(times, 0.5),
              ttkP90: quantile(times, 0.9),
              allAttemptsMedian: quantile(allTimes, 0.5),
              meanAttemptSeconds: totalSeconds / trials,
              hpRemainingMedian: quantile(hp, 0.5),
              kiRemainingMedian: quantile(remainingKi, 0.5),
              kiSpentMean: kiSpent / trials,
              potionsMean: potions / trials,
              castsMean: casts / trials,
              changedLevel,
              samples,
            });
            if (++completed % 25 === 0)
              process.stdout.write(`${stage} shard ${shard}: ${completed} profiles\n`);
          }
      }

// Stat rounding and marginal-point effects use the real Kit, independently of combat outcomes.
const curves: Record<string, unknown>[] = [];
if (shard === 0)
  for (const race of RACE_IDS)
    for (let level = 1; level <= 40; level++)
      for (const model of RANK_MODELS) {
        const node =
          race === "planetary" || race === "sage" ? "C2" : race === "android" ? "B2" : "B3";
        const prerequisite = node.startsWith("C") ? "C1" : "B1";
        const rank = level < 4 ? 0 : level - 2,
          learned = ["R", ...(level >= 2 ? [prerequisite] : []), ...Array<string>(rank).fill(node)];
        if (!validLearned(race, level, learned)) throw Error("Illegal curve profile");
        const port = statsPort({ level, weapon: null, armor: null, upgrade: 0 }),
          kit = createKit(race, port, learned);
        const unranked = createKit(race, port, ["R"]).stats;
        applyRankModel(kit, model);
        const stat = race === "sage" ? "maxKi" : race === "android" ? "defense" : "maxHp";
        const milestones = [];
        let previous = unranked[stat];
        for (let r = 1; r <= rank; r++) {
          const k = createKit(race, port, ["R", prerequisite, ...Array<string>(r).fill(node)]);
          applyRankModel(k, model);
          const current = k.stats[stat];
          milestones.push({ rank: r, value: current, delta: current - previous });
          previous = current;
        }
        curves.push({
          race,
          level,
          model: model.id,
          node,
          stat,
          rank,
          base: unranked[stat],
          value: kit.stats[stat],
          zeroGainExtraRanks: milestones.filter((p) => p.rank > 1 && p.delta === 0).length,
          extraRanks: Math.max(0, rank - 1),
          milestones,
        });
      }
mkdirSync(output, { recursive: true });
writeFileSync(
  `${output}/${stage}-${shard}.json`,
  JSON.stringify(
    {
      format: "ki-rank-policy-trial-1",
      ...provenance,
      engineRoot,
      stage,
      shard,
      shards,
      trials,
      stepMs: 50,
      timeLimitSeconds: 120,
      models: RANK_MODELS,
      runtimeMs: Math.round(performance.now() - started),
      rows,
      curves,
      notes: [
        "Real production GameSession/Kit/MonsterSystem; per-instance experimental adapters only.",
        "Training/mastery/modules disabled to isolate ranks and equipment; learned point budgets remain legal.",
        "Reference gear: highest available level, common/uncommon only, continent restricted; catalog: any rarity. Ties by rarity then id. Fixed across rank policies; not a natural-acquisition or optimal-gear claim.",
        "Three HP potions per isolated trial; no supply/economy model. Transformation T not used.",
        "Identical seeded initial conditions across policies; RNG consumption may diverge when actions change.",
        "Enemy level is closest available at/near player level. Old level-18 monsters are not used against level-40 players.",
        "Scripted close-range attacker uses actual movement/LOS with a 300 ms chase-command cadence, basic attack, ready abilities and potions. No perfect human dodge/aim model.",
        "Stress uses a real navigation obstacle and both opponent roles simultaneously. It is a controlled arena, not a full campaign.",
        "A zero-gain rank measures rounded max-stat deltas at fixed level, not every secondary effect.",
        "Wilson intervals describe conditional seed variation for each fixed profile, not a random sample of all players.",
      ],
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`${completed} profiles complete\n`);
