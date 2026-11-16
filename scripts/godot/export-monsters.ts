/* eslint-disable @typescript-eslint/no-explicit-any -- bridge script over the browser game's loosely typed definitions */
/**
 * The 40 bestiary monsters (rules, stats, skills, traits, loot) and their drop pools -> /tmp/godot-monsters/monsters.json.
 * The Godot port plays these rules; nothing is rebalanced. Run: npx tsx scripts/godot/export-monsters.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { MONSTERS } from "../../src/game/monsters/catalog";
import { BODY_EXTENT } from "../../src/game/monsters/bodyExtent.generated";
import { MONSTER_BASE } from "../../src/game/monsters/base.generated";
import { monsterFramePx } from "../../src/game/monsters/visualSize";
import { slug } from "../../src/game/monsters/materials";
import { DROP_CHANCE, LOOT_POOLS } from "../../src/game/items/loot";

mkdirSync("/tmp/godot-monsters", { recursive: true });
const sizeOf = Object.fromEntries(MONSTER_BASE.map((b) => [b.id, b.size]));
const defs: Record<string, any> = {};
for (const m of MONSTERS) {
  defs[m.id] = {
    ...m,
    sizeClass: sizeOf[m.id],
    framePx: monsterFramePx(m.id, sizeOf[m.id] as any) ?? 96,
    bodyExtent: (BODY_EXTENT as any)[m.id] ?? null,
    lootItems: m.loot.map((l) => ({
      item: l.name === "tusk" ? "tusk" : slug(l.name),
      chance: l.chance > 1 ? l.chance / 100 : l.chance,
    })),
    pool: LOOT_POOLS[m.id] ?? { ids: [], weights: [], total: 0 },
  };
}
writeFileSync(
  "/tmp/godot-monsters/monsters.json",
  JSON.stringify({ dropChance: DROP_CHANCE, monsters: defs }),
);
console.log(JSON.stringify({ monsters: Object.keys(defs).length, dropChance: DROP_CHANCE }));
