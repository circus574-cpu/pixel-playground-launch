/**
 * The eight bosses of the browser game (catalog, phases, attacks, loot table and the combat translation `bossMonster`)
 * -> /tmp/godot-bosses/bosses.json. The Godot port plays these rules; nothing is rebalanced.
 * Run: npx tsx scripts/godot/export-bosses.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BOSS_CATALOG } from "../../src/game/bosses/catalog";
import { bossMonster, BOSS_PREVIEW } from "../../src/game/bosses/runtime";

mkdirSync("/tmp/godot-bosses", { recursive: true });

/** Same table as `monsterVisual` in src/game/assets/catalog.ts: bosses are drawn as their continent's apex guardian at 180 px. */
const GUARDIAN: Record<string, string> = {
  ygdrasha: "verdant-straznik-ruin",
  thorgar: "verdant-skalny-jelen",
  "arcykaplan-pustki": "aether-marionetka-rytualu",
  aurelith: "aether-lew-swiatyni",
  "arbiter-zero": "nexus-straznik-rdzenia",
  "hydra-rdzen": "nexus-latarnia-plazmowa",
  kharzul: "pyra-skalny-berserker",
  pyrrhax: "pyra-golem-ruin",
};
/** Sound folders (src/game/sfx.ts) carry the world prefix. */
const SOUND: Record<string, string> = {
  ygdrasha: "verdant-ygdrasha",
  thorgar: "verdant-thorgar",
  "arcykaplan-pustki": "aether-arcykaplan-pustki",
  aurelith: "aether-aurelith",
  "arbiter-zero": "nexus-arbiter-zero",
  "hydra-rdzen": "nexus-hydra-rdzen",
  kharzul: "pyra-kharzul",
  pyrrhax: "pyra-pyrrhax",
};

const bosses = BOSS_CATALOG.map((b) => ({
  ...b,
  guardian: GUARDIAN[b.id],
  sound: SOUND[b.id],
  monster: bossMonster(b),
}));
writeFileSync("/tmp/godot-bosses/bosses.json", JSON.stringify({ preview: BOSS_PREVIEW, bosses }));
console.log(JSON.stringify({ bosses: bosses.length, ids: bosses.map((b) => b.id) }));
