import { BOSS_CATALOG } from "../../src/game/bosses/catalog";
import { bossMonster } from "../../src/game/bosses/runtime";
/** Seeded actual GameSession/kit/MonsterSystem simulation; never changes balance numbers. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GameSession, ITEMS, xpNeeded, stats, newPlayer } from "../../src/game/session";
import { MONSTERS } from "../../src/game/monsters/catalog";
import { MATERIALS } from "../../src/game/monsters/materials";
import { RACE_IDS, type RaceId } from "../../src/game/world/races";
import { WORLDS } from "../../src/game/world/worlds";
import type { WorldDefinition } from "../../src/game/world/types";
import { Navigation } from "../../src/game/navigation";
const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1]! : fallback;
};
const minLevel = Number(arg("--min-level", "0")),
  maxLevel = Number(arg("--max-level", "0"));
const proposal = arg("--proposal", "false") === "true";
if (
  (minLevel || maxLevel) &&
  (!Number.isInteger(minLevel) ||
    !Number.isInteger(maxLevel) ||
    minLevel < 1 ||
    maxLevel > 40 ||
    minLevel > maxLevel)
)
  throw Error("Invalid balance level range");
const meanCache = new Map<
  number,
  { hp: number; attack: number; defense: number; crit: number; interval: number }
>();
const meanPlayer = (level: number) => {
  const cached = meanCache.get(level);
  if (cached) return cached;
  const values = RACE_IDS.map((r) =>
    stats({ ...newPlayer(r), level, weapon: "sword", armor: "vest", upgrade: 1 }),
  );
  const mean = (field: "maxHp" | "attack" | "defense" | "crit" | "attackInterval") =>
    values.reduce((a, v) => a + v[field], 0) / values.length;
  const value = {
    hp: mean("maxHp"),
    attack: mean("attack"),
    defense: mean("defense"),
    crit: mean("crit"),
    interval: mean("attackInterval"),
  };
  meanCache.set(level, value);
  return value;
};
const proposalStats = (
  def: { level: number; hp: number; atk: number; def: number; xp: number },
  level: number,
) => {
  const basis = Math.max(1, def.level),
    before = meanPlayer(basis),
    after = meanPlayer(level);
  const defense = Math.max(1, Math.round((def.def * after.defense) / before.defense));
  const dpsBefore =
    (Math.max(1, before.attack - def.def / 2) * (1 + (before.crit / 100) * 0.5)) / before.interval;
  const dpsAfter =
    (Math.max(1, after.attack - defense / 2) * (1 + (after.crit / 100) * 0.5)) / after.interval;
  return {
    level,
    hp: Math.max(1, Math.round((def.hp * dpsAfter) / dpsBefore)),
    atk: Math.max(
      1,
      Math.round(
        (Math.max(1, def.atk - before.defense / 2) * after.hp) / before.hp + after.defense / 2,
      ),
    ),
    def: defense,
    xp: Math.round((def.xp * xpNeeded(level)) / xpNeeded(basis)),
  };
};
const trials = Number(arg("--trials", "16")),
  shard = Number(arg("--shard", "0")),
  shards = Number(arg("--shards", "1")),
  output = arg("--output", "/tmp/ki-balance");
if (
  !Number.isInteger(trials) ||
  trials < 1 ||
  trials > 1000 ||
  !Number.isInteger(shard) ||
  shard < 0 ||
  shard >= shards
)
  throw Error("Invalid trials/shard");
const random = (value: number) => () => {
  value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
  return value / 4294967296;
};
const hash = (s: string) =>
  [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const median = (v: number[]) => {
  const a = [...v].sort((a, b) => a - b);
  return a.length ? a[Math.floor(a.length / 2)]! : null;
};
const nav = new Navigation(8192, 8192, []);
const profiles = ["bare-basic", "equipped-basic", "equipped-skills-potions"] as const;
const results: Record<string, unknown>[] = [];
let ordinal = 0;
const started = performance.now();
const opponents =
  arg("--bosses", "false") === "true"
    ? BOSS_CATALOG.map(bossMonster)
    : proposal
      ? MONSTERS.filter((m) => m.level >= 14)
      : MONSTERS;
for (const monster of opponents)
  for (const race of RACE_IDS)
    for (const level of minLevel
      ? Array.from({ length: maxLevel - minLevel + 1 }, (_, i) => minLevel + i)
      : [
          ...new Set([
            Math.max(1, monster.level - 2),
            monster.level,
            Math.min(20, monster.level + 2),
          ]),
        ])
      for (const profile of profiles) {
        const job = ordinal++;
        if (job % shards !== shard) continue;
        const key = [
          monster.id,
          race,
          level,
          profile,
          proposal ? "scaled-proposal" : "existing",
        ].join("|");
        let wins = 0,
          deaths = 0,
          timeouts = 0,
          potions = 0,
          gold = 0,
          xp = 0,
          materialRevenue = 0,
          activeSkillsStarted = 0,
          fightSecondsTotal = 0;
        const times: number[] = [],
          remaining: number[] = [];
        for (let trial = 0; trial < trials; trial++) {
          const base =
            WORLDS[
              ({ planetary: "verdant", sage: "aether", android: "nexus", legend: "pyra" } as const)[
                race
              ]
            ];
          const world: WorldDefinition = {
            ...base,
            width: 8192,
            height: 8192,
            spawn: { x: 4096, y: 4096 },
            enemies: [],
            monsters: [],
            npcs: [],
            objects: [],
            obstacles: [],
          };
          delete world.city;
          delete world.terrain;
          const g = new GameSession(undefined, race as RaceId, {
            random: random(hash(key + "|" + trial)),
            world,
            navigation: nav,
          });
          g.player.level = level;
          if (profile !== "bare-basic") {
            g.player.items.sword = 1;
            g.player.items.vest = 1;
            g.player.weapon = "sword";
            g.player.armor = "vest";
            g.player.upgrade = 1;
          }
          if (profile === "equipped-skills-potions")
            for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A9"])
              g.command({ type: "learn", node: id });
          g.player.hp = g.kit.stats.maxHp;
          g.player.ki = g.kit.stats.maxKi;
          g.player.items.potion = profile === "equipped-skills-potions" ? 3 : 0;
          const initialPotions = g.player.items.potion;
          g.nowMs = trial % 2 ? 300000 : 0;
          if (monster.id.startsWith("boss:"))
            g.summonBoss(monster.id.slice(5), { x: 4191, y: 4096 });
          else g.monsters.spawn(monster.id, { x: 4191, y: 4096 }, "subject");
          const scaled = new Set<string>();
          let elapsed = 0,
            result = "timeout";
          for (; elapsed < 90000; elapsed += 50) {
            if (proposal)
              for (const e of g.enemies)
                if (!scaled.has(e.id)) {
                  const fraction = e.hp / e.maxHp,
                    scaledStats = proposalStats(e.m.def, level);
                  e.m.def = { ...e.m.def, ...scaledStats };
                  e.maxHp = scaledStats.hp;
                  e.hp = scaledStats.hp * fraction;
                  scaled.add(e.id);
                }
            const targets = g.enemies.filter((e) => e.hp > 0 && e.mode !== "dead");
            if (!targets.length) {
              result = "win";
              break;
            }
            if (g.player.hp <= 0 || g.player.dead) {
              result = "death";
              break;
            }
            const target = targets.find((e) => !e.m.hidden && !e.m.invulnerable);
            if (target && (!g.autoAttack || !g.target))
              g.command({ type: "target", id: target.id });
            if (profile === "equipped-skills-potions") {
              if (g.player.hp < g.kit.stats.maxHp * 0.4)
                g.command({ type: "ability", ability: "potion" });
              for (const a of g.kit.abilities())
                if (a.id !== "R" && a.id !== "potion" && a.ready && a.ki <= g.player.ki) {
                  g.command({ type: "ability", ability: a.id });
                  if ((g.kit.cooldowns[a.id] ?? 0) > 0 || g.kit.channel?.id === a.id)
                    activeSkillsStarted++;
                }
            }
            g.tick(50);
            g.events.length = 0;
          }
          if (g.player.hp <= 0 || g.player.dead) result = "death";
          else if (!g.enemies.some((e) => e.hp > 0 && e.mode !== "dead")) result = "win";
          fightSecondsTotal += elapsed / 1000;
          if (result === "win") {
            wins++;
            times.push(elapsed / 1000);
            gold += g.loot.reduce((a, l) => a + l.gold, 0);
            materialRevenue += g.loot.reduce(
              (a, l) => a + (MATERIALS[l.item]?.sell ?? 0) * l.quantity,
              0,
            );
            let earned = g.player.xp;
            for (let l = level; l < g.player.level; l++) earned += xpNeeded(l);
            xp += earned;
          } else if (result === "death") deaths++;
          else timeouts++;
          potions += initialPotions - g.player.items.potion;
          remaining.push(Math.max(0, g.player.hp) / g.kit.stats.maxHp);
        }
        const probability = wins / trials,
          z = 1.96,
          denom = 1 + (z * z) / trials,
          centre = (probability + (z * z) / (2 * trials)) / denom,
          half =
            (z *
              Math.sqrt(
                (probability * (1 - probability)) / trials + (z * z) / (4 * trials * trials),
              )) /
            denom;
        const travelSeconds = 30;
        results.push({
          monster: monster.id,
          monsterLevel: proposal ? level : monster.level,
          templateLevel: monster.level,
          opponentMode:
            arg("--bosses", "false") === "true"
              ? "boss-catalog-preview-not-approved-balance"
              : proposal
                ? "scaled-proposal-not-canonical"
                : "existing-canonical",
          proposedStats: proposal ? proposalStats(monster, level) : null,
          race,
          playerLevel: level,
          profile,
          trials,
          wins,
          deaths,
          timeouts,
          winRate: probability,
          winRate95: [Math.max(0, centre - half), Math.min(1, centre + half)],
          medianKillSeconds: median(times),
          fightSecondsTotal,
          meanFightSeconds: fightSecondsTotal / trials,
          meanRemainingHp: remaining.reduce((a, b) => a + b, 0) / trials,
          potionsConsumed: potions,
          activeSkillsStarted,
          goldDropped: gold,
          materialSellValue: materialRevenue,
          netGoldAfterPotionsAndInn:
            gold + materialRevenue - potions * ITEMS.potion.price - trials * 5,
          xpEarned: xp,
          estimatedXpPerHour:
            ((xp / trials) * 3600) / (fightSecondsTotal / trials + travelSeconds + 5),
          flags: [
            ...((proposal || level === monster.level) &&
            profile === "equipped-skills-potions" &&
            probability < 0.2
              ? ["same-level-low-win-rate"]
              : []),
            ...(timeouts / trials > 0.25 ? ["frequent-timeout"] : []),
          ],
        });
      }
mkdirSync(output, { recursive: true });
const report = {
  engine: "GameSession + all race kits + MonsterSystem",
  shard,
  shards,
  trialsPerScenario: trials,
  levelRange: minLevel ? [minLevel, maxLevel] : null,
  opponentMode:
    arg("--bosses", "false") === "true"
      ? "boss-catalog-preview-not-approved-balance"
      : proposal
        ? "scaled-proposal-not-canonical"
        : "existing-canonical",
  scenarios: results.length,
  fights: results.length * trials,
  wallSeconds: (performance.now() - started) / 1000,
  assumptions: {
    fixedStepMs: 50,
    post20:
      "Player statistics follow current code extrapolation; speed and skill points cap at 20; higher-tier equipment is not implemented.",
    proposal: proposal
      ? "Simulation-only: top 12 AI templates. Enemy HP follows mean four-race outgoing DPS ratio; damage follows mean HP growth and defense; DEF follows mean defense growth; XP follows level XP requirement ratio. Canonical catalog unchanged."
      : "No enemy stat changes",
    maxFightSeconds: 90,
    arena: "8192×8192 empty arena; stationary auto-chase, no human dodging",
    dayNight: "alternating existing 8-minute AI clock",
    equipment: "existing sword + one upgrade and vest; no new items",
    skillBuild: "legal A-branch purchases attempted through game commands",
    economy:
      "full material sale assumed; no inventory saturation; 30s travel + 5s recovery; inn cost 5 every trial",
    confidence: "16 seeded trials are exploratory; Wilson 95% intervals, not player telemetry",
  },
  results,
};
writeFileSync(join(output, `shard-${shard}.json`), JSON.stringify(report));
console.log(
  JSON.stringify({
    shard,
    scenarios: results.length,
    fights: report.fights,
    seconds: report.wallSeconds,
  }),
);
