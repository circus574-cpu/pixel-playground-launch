import { writeFileSync } from "node:fs";
import { GameSession } from "../../src/game/session";
import { Navigation } from "../../src/game/navigation";
import { WORLDS } from "../../src/game/world/worlds";
import { COMBAT_BUDGET } from "../../src/game/combatBudget";
const world = {
  ...WORLDS.verdant,
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
const g = new GameSession(undefined, "planetary", {
  world,
  navigation: new Navigation(8192, 8192, []),
  random: () => 0.5,
});
g.player.level = 20;
for (let i = 0; i < 60; i++)
  g.monsters.spawn(
    "pyra-ognista-salamandra",
    { x: 4100 + (i % 10) * 15, y: 4160 + Math.floor(i / 10) * 15 },
    "dense-" + i,
  );
const samples: number[] = [];
let maxActive = 0,
  maxZones = 0;
for (let i = 0; i < 1200; i++) {
  const start = performance.now();
  g.tick(50);
  samples.push(performance.now() - start);
  g.events.length = 0;
  g.player.hp = g.kit.stats.maxHp;
  g.player.dead = false;
  maxActive = Math.max(maxActive, g.enemies.filter((e) => !e.sleeping && e.hp > 0).length);
  maxZones = Math.max(maxZones, g.monsters.zones.length);
}
samples.sort((a, b) => a - b);
const report = {
  runtime: process.version,
  kind: "CPU Node simulation, not browser FPS or physical Android",
  monsters: 60,
  ticks: 1200,
  simulationStepMs: 50,
  budget: COMBAT_BUDGET,
  maxActive,
  maxZones,
  tickP50Ms: samples[600],
  tickP95Ms: samples[1140],
  maxTickMs: samples.at(-1),
  heapUsedBytes: process.memoryUsage().heapUsed,
};
writeFileSync(
  process.argv[2] ?? "/tmp/combat-benchmark.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
