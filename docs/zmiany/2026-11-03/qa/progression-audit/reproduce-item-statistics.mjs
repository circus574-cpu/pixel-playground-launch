/** Isolated calculation fixture; no live account, persistence, rewards or production requests. */
import { GameSession } from "../../../../../src/game/session.ts";
import { ITEM_CATALOG } from "../../../../../src/game/items/catalog.ts";
const observations = [];
for (const key of ["hpBonus", "kiBonus", "moveSpeedPercent", "critChancePoints"]) {
  const item = ITEM_CATALOG.find(
    (i) =>
      i.stats?.[key] &&
      ["armor", "boots", "ring", "amulet", "accessory", "helmet", "buff", "artifact"].includes(
        i.category,
      ),
  );
  if (!item) throw Error(`No fixture item for ${key}`);
  const session = new GameSession(undefined, "planetary", { random: () => 0.99 });
  // Explicit unit-test preconditions, not a claim of earning this item through a full campaign.
  session.player.level = Math.max(1, item.level ?? 1);
  session.player.bagItems[item.id] = 1;
  const before = { ...session.kit.stats };
  session.command({ type: "equip", item: item.id });
  if (!Object.values(session.player.equipment).includes(item.id))
    throw Error(`Item not equipped: ${item.id}`);
  const after = { ...session.kit.stats };
  observations.push({
    id: item.id,
    name: item.name,
    declaredStats: item.stats,
    before,
    after,
    delta: {
      hp: after.maxHp - before.maxHp,
      ki: after.maxKi - before.maxKi,
      speed: after.speed - before.speed,
      attackSpeedPct: after.attackSpeedPct - before.attackSpeedPct,
      technique: after.technique - before.technique,
      crit: after.crit - before.crit,
    },
  });
}
console.log(JSON.stringify(observations, null, 2));
