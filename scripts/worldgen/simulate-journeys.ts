/** Bot journeys use real commands, pathfinding, trading, depot and SaveStore. No patched rewards. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GameSession, SaveStore, type StoragePort, type NpcId } from "../../src/game/session";
import { RACE_IDS } from "../../src/game/world/races";
import { WORLDS, worldObstacles } from "../../src/game/world/worlds";
import { Navigation } from "../../src/game/navigation";
import { isCityStage } from "../../src/game/city/types";
const arg = (key: string, fallback: string) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? fallback : process.argv[i + 1]!;
};
const cases = Number(arg("--cases", "512")),
  shard = Number(arg("--shard", "0")),
  shards = Number(arg("--shards", "1")),
  output = arg("--output", "/tmp/bot-journeys");
const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const maps = Object.fromEntries(
  Object.entries(WORLDS).map(([id, w]) => [
    id,
    new Navigation(w.width, w.height, worldObstacles(w)),
  ]),
);
const results: Record<string, unknown>[] = [];
let ordinal = 0;
for (let seed = 1; seed <= cases; seed++)
  for (const race of RACE_IDS) {
    if (ordinal++ % shards !== shard) continue;
    const memory = new Map<string, string>();
    const storage: StoragePort = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    };
    const key = "ki-bot:" + race + ":" + seed;
    const saves = new SaveStore(storage, key);
    const world =
      WORLDS[
        ({ planetary: "verdant", sage: "aether", android: "nexus", legend: "pyra" } as const)[race]
      ];
    const g = new GameSession(saves, race, {
      random: random(seed * 101 + ordinal),
      navigation: maps[world.id]!,
    });
    let ticks = 0,
      phase = "start",
      combat = "not-run",
      claims = 0,
      checks = 0;
    const wait = (predicate: () => boolean, limit = 140000) => {
      for (let t = 0; t < limit && !predicate(); t += 100) {
        g.tick(100);
        g.events.length = 0;
        ticks++;
        if (g.player.dead) throw Error("player-death:" + phase);
      }
      if (!predicate()) throw Error("stuck:" + phase + ":" + g.notice);
    };
    const close = () => {
      g.command({ type: "storage-close" });
      g.command({ type: "dialogue", action: "close" });
      g.command({ type: "cancel" });
    };
    const talk = (npc: NpcId) => {
      close();
      g.command({ type: "interact", npc });
      wait(() => g.dialogue === npc);
    };
    const bag = () =>
      JSON.stringify({
        gold: g.player.gold,
        items: g.player.items,
        depot: g.player.depot,
        upgrade: g.player.upgrade,
        materials: g.player.materials,
      });
    try {
      phase = "introduction";
      talk("guide");
      g.command({ type: "dialogue", action: "accept" });
      close();
      g.command({ type: "move", x: g.world.market.x, y: g.world.market.y });
      wait(() => g.player.quests.steps === "ready");
      talk("guide");
      g.command({ type: "dialogue", action: "claim" });
      if (g.player.quests.steps !== "done") throw Error("Intro not completed");
      const alreadyClaimed = bag();
      g.command({ type: "dialogue", action: "claim" });
      if (bag() !== alreadyClaimed) throw Error("Duplicate quest reward");
      checks++;
      if (!isCityStage(g.world)) {
        phase = "hunt-accept";
        talk("hunter");
        g.command({ type: "dialogue", action: "accept" });
        close();
        for (let fight = 0; fight < 3; fight++) {
          phase = "fight-" + fight;
          const target = g.enemies
            .filter((e) => e.hp > 0)
            .sort(
              (a, b) =>
                Math.hypot(a.x - g.player.x, a.y - g.player.y) -
                Math.hypot(b.x - g.player.x, b.y - g.player.y),
            )[0];
          if (!target) throw Error("No hunt enemy");
          g.command({ type: "target", id: target.id });
          for (let t = 0; t < 100000 && target.hp > 0 && !g.player.dead; t += 100) {
            if (g.player.hp < g.kit.stats.maxHp * 0.4 && g.player.items.potion > 0)
              g.command({ type: "ability", ability: "potion" });
            g.tick(100);
            g.events.length = 0;
            ticks++;
          }
          if (g.player.dead) throw Error("player-death:" + phase);
          if (target.hp > 0) throw Error("combat-timeout");
          for (const loot of [...g.loot]) {
            g.command({ type: "loot", id: loot.id });
            wait(() => !g.loot.some((l) => l.id === loot.id), 30000);
          }
        }
        phase = "hunt-return";
        talk("hunter");
        g.command({ type: "dialogue", action: "claim" });
        if (g.player.quests.boars !== "done") throw Error("Hunt not completed");
        combat = "three-real-boars";
      } else combat = "safe-city: training replaces combat by current stage rules";
      phase = "shop";
      talk("merchant");
      const before = g.player.items.potion,
        gold = g.player.gold;
      if (gold >= 8) {
        g.command({ type: "trade", item: "potion", buy: true });
        if (g.player.items.potion !== before + 1 || g.player.gold !== gold - 8)
          throw Error("Purchase accounting");
        g.command({ type: "trade", item: "potion", buy: false });
        if (g.player.items.potion !== before || g.player.gold !== gold - 5)
          throw Error("Sale accounting");
        checks += 2;
      }
      for (const item of Object.keys(g.player.materials))
        while ((g.player.materials[item] ?? 0) > 0) g.command({ type: "trade", item, buy: false });
      if (g.player.gold >= 40) {
        g.command({ type: "trade", item: "sword", buy: true });
        g.command({ type: "equip", item: "sword" });
        phase = "smith";
        talk("smith");
        g.command({ type: "dialogue", action: "accept" });
        g.command({ type: "dialogue", action: "claim" });
        if (g.player.gold >= 15) g.command({ type: "dialogue", action: "upgrade" });
      }
      phase = "depot";
      close();
      g.command({ type: "enter", building: "depot" });
      wait(() => g.player.interior === "depot");
      g.command({ type: "chest" });
      wait(() => g.depotOpen);
      const beforeMalformedTransfers = bag();
      for (const quantity of [-1, 0, 1.5, 1000])
        g.command({ type: "depot", item: "potion", quantity, withdraw: true });
      if (bag() !== beforeMalformedTransfers) throw Error("Malformed transfer mutates inventory");
      checks += 4;
      const potions = g.player.items.potion + g.player.depot.items.potion;
      if (g.player.items.potion) {
        g.command({ type: "depot", item: "potion", quantity: 1, withdraw: false });
        g.command({ type: "depot", item: "potion", quantity: 1, withdraw: true });
        if (g.player.items.potion + g.player.depot.items.potion !== potions)
          throw Error("Potion duplication");
        checks++;
      }
      if (g.player.items.sword) {
        g.command({ type: "unequip", slot: "weapon" });
        const swords = g.player.items.sword + g.player.depot.items.sword,
          upgrade = g.player.upgrade;
        g.command({ type: "depot", item: "sword", quantity: 1, withdraw: false });
        g.command({ type: "depot", item: "sword", quantity: 1, withdraw: true });
        if (
          g.player.items.sword + g.player.depot.items.sword !== swords ||
          g.player.upgrade !== upgrade
        )
          throw Error("Enhanced sword lost or duplicated");
        checks++;
      }
      g.flush();
      const restored = new GameSession(new SaveStore(storage, key), race, {
        navigation: maps[world.id]!,
      });
      if (
        JSON.stringify({
          items: restored.player.items,
          depot: restored.player.depot,
          gold: restored.player.gold,
          upgrade: restored.player.upgrade,
        }) !==
        JSON.stringify({
          items: g.player.items,
          depot: g.player.depot,
          gold: g.player.gold,
          upgrade: g.player.upgrade,
        })
      )
        throw Error("Reload differs");
      checks++;
      const stale = new SaveStore(storage, key),
        old = stale.load();
      g.flush();
      const protectedRaw = storage.getItem(key);
      if (!old || stale.save(old) || storage.getItem(key) !== protectedRaw)
        throw Error("Stale tab overwrites save");
      checks++;
      claims = g.player.quests.steps === "done" ? 1 : 0;
      results.push({
        seed,
        race,
        passed: true,
        ticks,
        combat,
        checks,
        claims,
        gold: g.player.gold,
        level: g.player.level,
      });
    } catch (error) {
      results.push({
        seed,
        race,
        passed: false,
        ticks,
        phase,
        combat,
        checks,
        error: error instanceof Error ? error.message : String(error),
        gold: g.player.gold,
        level: g.player.level,
      });
    }
  }
mkdirSync(output, { recursive: true });
const report = {
  scope:
    "Existing four runtime maps and their current city-stage rules; generated planet has separate navigation tests, not mounted scenes.",
  shard,
  shards,
  casesPerRace: cases,
  journeys: results.length,
  passed: results.filter((r) => r["passed"]).length,
  failed: results.filter((r) => !r["passed"]).length,
  results,
};
writeFileSync(join(output, `shard-${shard}.json`), JSON.stringify(report));
console.log(
  JSON.stringify({
    shard,
    journeys: report.journeys,
    passed: report.passed,
    failed: report.failed,
  }),
);
