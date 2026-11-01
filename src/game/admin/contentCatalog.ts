import { MONSTER_DEFS, monsterDef } from "../monsters/catalog";
import { slug } from "../monsters/materials";
import { BOSS_CATALOG } from "../bosses/catalog";
import { CRAFTING_RECIPES } from "../items/recipes";
import { itemDropChances } from "../items/loot";
import { ALL_QUESTS_V2 } from "../quests/engine";
import { WORLDS } from "../world/worlds";
import type { ItemStats } from "../items/types";
import { ITEMS, type ItemId } from "../session";

export const percent = (value: number) =>
  `${Number((value * 100).toFixed(3)).toLocaleString("pl-PL")}%`;
export function monsterDrops(id: string, names?: string[]) {
  const def = monsterDef(id);
  return (names ?? def.loot.map((e) => e.name)).map((name, i) => ({
    id: name === "tusk" ? "tusk" : slug(name),
    name,
    chance: def.loot[i]?.chance ?? (i === 0 ? 0.7 : 0.35),
  }));
}
/** Exact runtime IDs only: matching similar names would invent equipment drops. */
export function itemSources(id: string) {
  const sources: string[] = [];
  if (id in ITEMS && ITEMS[id as ItemId].price > 0)
    sources.push(`Kupiec w osadzie · ${ITEMS[id as ItemId].price} monet · zakup, bez losowania`);
  for (const m of Object.values(MONSTER_DEFS)) {
    if (m.minion && m.id !== "boar") continue;
    for (const drop of monsterDrops(m.id))
      if (drop.id === id)
        sources.push(
          `${m.name} · ${WORLDS[m.world].name} · ${percent(drop.chance)} · 1 szt. na pokonanie`,
        );
  }
  for (const { monster, chance } of itemDropChances(id))
    sources.push(
      `Losowy drop: ${monster.name} · ${WORLDS[monster.world].name} · poz. ${monster.level} · ${percent(chance)} na pokonanie`,
    );
  for (const b of BOSS_CATALOG)
    for (const drop of b.lootTable)
      if (drop.itemId === id)
        sources.push(
          `Boss: ${b.name} · ${b.locationName} · ${drop.chancePercent}% · ${drop.minCount}–${drop.maxCount} szt. (rejestr nagród bossa)`,
        );
  for (const r of CRAFTING_RECIPES)
    if (r.resultItemId === id)
      sources.push(
        `Receptura: ${r.name} · ${r.station} · poz. ${r.requiredLevel} · ${r.craftingCostCoins} monet; składniki: ${r.ingredients.map((i) => `${i.itemId} ×${i.count}`).join(", ")}`,
      );
  for (const q of ALL_QUESTS_V2)
    if (q.reward.itemId === id)
      sources.push(`Zadanie: ${q.title} · nagroda ×${q.reward.itemCount ?? 1} po ukończeniu`);
  return sources;
}
const labels: Record<keyof ItemStats, string> = {
  hpBonus: "HP",
  kiBonus: "KI",
  atkBonus: "Atak",
  defBonus: "Obrona",
  speedMultiplier: "Mnożnik szybkości",
  kiRegenBonus: "Regeneracja KI",
  critChancePercent: "Szansa krytyczna (%)",
  atkPercent: "Atak (%)",
  defPercent: "Obrona (%)",
  maxHpPercent: "Maks. HP (%)",
  maxKiPercent: "Maks. KI (%)",
  moveSpeedPercent: "Ruch (%)",
  kiRegenPercent: "Regeneracja KI (%)",
  hpRegenPercent: "Regeneracja HP (%)",
  damageReductionPercent: "Redukcja obrażeń (%)",
  kiCostReductionPercent: "Redukcja kosztu KI (%)",
  critChancePoints: "Szansa krytyczna (p.p.)",
};
export function itemBonuses(stats?: ItemStats) {
  return Object.entries(stats ?? {})
    .filter(([, v]) => v !== 0 && v !== undefined)
    .map(([k, v]) => `${labels[k as keyof ItemStats] ?? k}: ${v}`);
}
