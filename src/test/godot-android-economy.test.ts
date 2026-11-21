// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AndroidEconomyError,
  applyAdminCharacterPatch,
  applyAndroidAction,
  computeAndroidStats,
  createInitialAndroidState,
} from "../server/godot/economy";

function freshHero(race: "legend" | "planetary" | "sage" | "android" = "legend", gold = 500) {
  const init = createInitialAndroidState(race, { level: 1, gold });
  return { race, ...init };
}

describe("Android authoritative economy & progression engine", () => {
  it("buys items at server catalog price and refuses insufficient gold", () => {
    const hero = freshHero("legend", 500);
    const bought = applyAndroidAction(
      hero,
      { type: "shop_buy", itemId: "sword_superior" },
      { isStaff: false },
    );
    expect(bought.gold).toBe(160);
    expect(bought.state.backpack.some((s) => s?.id === "sword_superior" && s.qty === 1)).toBe(true);

    expect(() =>
      applyAndroidAction(
        { race: hero.race, ...bought },
        { type: "shop_buy", itemId: "blade_pyra" },
        { isStaff: false },
      ),
    ).toThrowError(AndroidEconomyError);
  });

  it("crafts non-consumables, rejects consumables, and supports sell-back", () => {
    const hero = freshHero("planetary", 300);
    expect(() =>
      applyAndroidAction(hero, { type: "craft", itemId: "potion_hp" }, { isStaff: false }),
    ).toThrowError(/nie można wykuć/i);

    const crafted = applyAndroidAction(
      hero,
      { type: "craft", itemId: "helm_pyra" },
      { isStaff: false },
    );
    expect(crafted.gold).toBe(100);
    const slotIdx = crafted.state.backpack.findIndex((s) => s?.id === "helm_pyra");
    expect(slotIdx).toBeGreaterThanOrEqual(0);

    const sold = applyAndroidAction(
      { race: hero.race, ...crafted },
      { type: "shop_sell", slotIndex: slotIdx },
      { isStaff: false },
    );
    expect(sold.gold).toBe(270); // 100 + floor(340 * 0.5)
    expect(sold.state.backpack[slotIdx]).toBeNull();
  });

  it("handles bank gold & item deposits/withdrawals without duplication", () => {
    const hero = freshHero("sage", 400);
    const dep = applyAndroidAction(
      hero,
      { type: "bank_deposit_gold", amount: 150 },
      { isStaff: false },
    );
    expect(dep.gold).toBe(250);
    expect(dep.state.bankGold).toBe(150);

    expect(() =>
      applyAndroidAction(
        { race: hero.race, ...dep },
        { type: "bank_withdraw_gold", amount: 200 },
        { isStaff: false },
      ),
    ).toThrowError(AndroidEconomyError);

    const depItem = applyAndroidAction(
      { race: hero.race, ...dep },
      { type: "bank_deposit_item", backpackIndex: 0 },
      { isStaff: false },
    );
    expect(depItem.state.backpack[0]).toBeNull();
    expect(depItem.state.bankItems[0]).toEqual({ id: "potion_hp", qty: 3 });

    const wdItem = applyAndroidAction(
      { race: hero.race, ...depItem },
      { type: "bank_withdraw_item", bankIndex: 0 },
      { isStaff: false },
    );
    expect(wdItem.state.bankItems[0]).toBeNull();
    expect(wdItem.state.backpack[0]).toEqual({ id: "potion_hp", qty: 3 });
  });

  it("equips gear, recomputes authoritative stats, uses consumables & teleports on scroll", () => {
    const hero = freshHero("android", 1000);
    const baseStats = computeAndroidStats("android", hero.level, hero.state);
    const bought = applyAndroidAction(
      hero,
      { type: "shop_buy", itemId: "blade_nexus" },
      { isStaff: false },
    );
    const idx = bought.state.backpack.findIndex((s) => s?.id === "blade_nexus");
    const eq = applyAndroidAction(
      { race: "android", ...bought },
      { type: "use_item", backpackIndex: idx },
      { isStaff: false },
    );
    expect(eq.state.equipment["2"]).toBe("blade_nexus");
    const eqStats = computeAndroidStats("android", eq.level, eq.state);
    expect(eqStats.attack).toBe(baseStats.attack + 38);
    expect(eqStats.critChance).toBe(baseStats.critChance + 8);

    const scrollIdx = eq.state.backpack.findIndex((s) => s?.id === "scroll_tp");
    const tp = applyAndroidAction(
      { race: "android", ...eq },
      { type: "use_item", backpackIndex: scrollIdx },
      { isStaff: false },
    );
    expect(tp.teleportCapital).toBe(true);
    expect(tp.state.backpack[scrollIdx]).toBeNull();
  });

  it("allocates stats, unlocks talents, enforces arena cooldown & prevents duplicate quest claims", () => {
    const hero = freshHero("legend", 120);
    const st = applyAndroidAction(hero, { type: "allocate_stat", stat: "atk" }, { isStaff: false });
    expect(st.state.freeStatPoints).toBe(hero.state.freeStatPoints - 1);
    expect(st.state.bonusStats.atk).toBe(1);

    const tal = applyAndroidAction(
      { race: "legend", ...st },
      { type: "unlock_talent", nodeId: "A1" },
      { isStaff: false },
    );
    expect(tal.state.unlockedNodes).toContain("A1");

    const q1 = applyAndroidAction(
      { race: "legend", ...tal },
      { type: "quest_complete", questId: "npc:mistrz_kuzni" },
      { isStaff: false, nowMs: 10_000 },
    );
    expect(q1.gold).toBe(200);
    expect(q1.state.xp).toBe(45);
    expect(() =>
      applyAndroidAction(
        { race: "legend", ...q1 },
        { type: "quest_complete", questId: "npc:mistrz_kuzni" },
        { isStaff: false, nowMs: 20_000 },
      ),
    ).toThrowError(/odebrana/i);

    const tr1 = applyAndroidAction(
      { race: "legend", ...q1 },
      { type: "arena_train" },
      { isStaff: false, nowMs: 30_000 },
    );
    expect(tr1.state.xp).toBe(105);
    expect(() =>
      applyAndroidAction(
        { race: "legend", ...tr1 },
        { type: "arena_train" },
        { isStaff: false, nowMs: 32_000 },
      ),
    ).toThrowError(/5 s/);
  });

  it("blocks GM actions for non-staff and allows admin character patches", () => {
    const hero = freshHero("legend", 120);
    expect(() =>
      applyAndroidAction(
        hero,
        { type: "gm_action", op: "add_gold", value: 99999 },
        { isStaff: false },
      ),
    ).toThrowError(AndroidEconomyError);

    const gm = applyAndroidAction(
      hero,
      { type: "gm_action", op: "add_gold", value: 5000 },
      { isStaff: true },
    );
    expect(gm.gold).toBe(5120);

    const patched = applyAdminCharacterPatch(
      {
        name: "Ignis",
        race: "legend",
        land: gm.land,
        level: gm.level,
        gold: gm.gold,
        state: gm.state,
      },
      { name: "IgnisPrime", level: 15, gold: 25000, bankGold: 10000, bonusStats: { atk: 10 } },
    );
    expect(patched.name).toBe("IgnisPrime");
    expect(patched.level).toBe(15);
    expect(patched.gold).toBe(25000);
    expect(patched.state.bankGold).toBe(10000);
    expect(patched.state.bonusStats.atk).toBe(10);
  });
});
