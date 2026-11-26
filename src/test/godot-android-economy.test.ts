// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ANDROID_ITEM_CATALOG,
  type AndroidAction,
  AndroidEconomyError,
  BACKPACK_SIZE,
  BANK_SIZE,
  applyAdminCharacterPatch,
  applyAndroidAction,
  computeAndroidStats,
  createInitialAndroidState,
  maxTrainingPerStat,
  normalizeAndroidState,
} from "../server/godot/economy";

function freshHero(
  race: "legend" | "planetary" | "sage" | "android" = "legend",
  gold = 500,
  level = 1,
) {
  const init = createInitialAndroidState(race, { level, gold });
  return { race, ...init };
}

describe("Android authoritative economy, city training & progression engine", () => {
  it("shop sells ONLY consumables & Tier-1 starter gear, blocks rare/epic/pouch_gold, and supports sell-back", () => {
    const hero = freshHero("legend", 500, 1);

    // Tier-1 starter gear can be bought in Shop
    const bought = applyAndroidAction(
      hero,
      { type: "shop_buy", itemId: "weapon_recruit_sword" },
      { isStaff: false },
    );
    expect(bought.gold).toBe(320); // 500 - 180
    const slotIdx = bought.state.backpack.findIndex((s) => s?.id === "weapon_recruit_sword");
    expect(slotIdx).toBeGreaterThanOrEqual(0);

    // Crafted/Epic/Quest/Legacy pouch_gold items MUST NOT be purchasable in Shop!
    for (const forbidden of [
      "pouch_gold",
      "blade_pyra",
      "sword_superior",
      "vest_guardian",
      "ring_covenant_q",
      "ring_titan",
    ]) {
      expect(() =>
        applyAndroidAction(
          { race: hero.race, ...bought },
          { type: "shop_buy", itemId: forbidden },
          { isStaff: false },
        ),
      ).toThrowError(AndroidEconomyError);
    }

    // Sell-back pays exact sellPrice (25% of starter sword = 45g)
    const sold = applyAndroidAction(
      { race: hero.race, ...bought },
      { type: "shop_sell", slotIndex: slotIdx },
      { isStaff: false },
    );
    expect(sold.gold).toBe(365);
    expect(sold.state.backpack[slotIdx]).toBeNull();
  });

  it("crafting requires minLevel + gathered materials + monster trophies + gold", () => {
    const lv1 = freshHero("legend", 1000, 1);
    // Lv.1 cannot craft Lv.2 blade_ember_t2
    expect(() =>
      applyAndroidAction(lv1, { type: "craft", itemId: "blade_ember_t2" }, { isStaff: false }),
    ).toThrowError(/Wymagany poziom 2/i);

    // Lv.2 without materials fails with INSUFFICIENT_MATERIALS
    const lv2 = freshHero("legend", 1000, 2);
    expect(() =>
      applyAndroidAction(lv2, { type: "craft", itemId: "blade_ember_t2" }, { isStaff: false }),
    ).toThrowError(/Brak składnika/i);

    // Gather 2x mat_obsidian + get 2x tusk_beast from kills -> craft succeeds!
    let cur = lv2;
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "gather_node", nodeId: "pyra-obs-1", itemId: "mat_obsidian", land: "pyra" },
        { isStaff: false, nowMs: 10_000 },
      ),
    };
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "gather_node", nodeId: "pyra-obs-2", itemId: "mat_obsidian", land: "pyra" },
        { isStaff: false, nowMs: 15_000 },
      ),
    };
    // 2 kills on Pyra drop tusk_beast
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "monster_kill", monsterId: "pyra-byk", level: 1, land: "pyra" },
        { isStaff: false, nowMs: 20_000 },
      ),
    };
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "monster_kill", monsterId: "pyra-byk", level: 1, land: "pyra" },
        { isStaff: false, nowMs: 21_000 },
      ),
    };

    const goldBeforeCraft = cur.gold;
    const crafted = applyAndroidAction(
      cur,
      { type: "craft", itemId: "blade_ember_t2" },
      { isStaff: false, nowMs: 25_000 },
    );
    expect(crafted.gold).toBe(goldBeforeCraft - 110);
    expect(crafted.state.backpack.some((s) => s?.id === "blade_ember_t2")).toBe(true);
    expect(crafted.state.progress.craftedCount).toBe(1);
  });

  it("City Training permanently boosts stats WITHOUT granting XP or leveling up, with per-level caps & cooldown", () => {
    const hero = freshHero("sage", 120, 1);
    const before = computeAndroidStats("sage", hero.level, hero.state, 10_000);
    expect(maxTrainingPerStat(1)).toBe(3);

    let cur = hero;
    for (let i = 0; i < 3; i++) {
      const res = applyAndroidAction(
        cur,
        { type: "city_train", stat: "hp" },
        { isStaff: false, nowMs: 10_000 + i * 9_000 },
      );
      // Training NEVER grants XP or levels up!
      expect(res.level).toBe(1);
      expect(res.state.xp).toBe(0);
      expect(res.gold).toBe(120); // First 3 sessions are free
      cur = { race: "sage", ...res };
    }

    const after = computeAndroidStats("sage", cur.level, cur.state, 40_000);
    expect(after.maxHp).toBe(before.maxHp + 36); // 3 * 12 HP!
    expect(cur.state.progress.trainingCount).toBe(3);

    // 4th HP session on Lv.1 blocked by TRAINING_CAP_REACHED (3/3)
    expect(() =>
      applyAndroidAction(
        cur,
        { type: "city_train", stat: "hp" },
        { isStaff: false, nowMs: 50_000 },
      ),
    ).toThrowError(/limit treningu/i);

    // Cooldown enforced (< 8s)
    expect(() =>
      applyAndroidAction(
        cur,
        { type: "city_train", stat: "atk" },
        { isStaff: false, nowMs: 30_000 },
      ),
    ).toThrowError(/Odpocznij/i);

    // City Blessing grants timed buff without free stat points
    const blessed = applyAndroidAction(
      cur,
      { type: "city_blessing", kind: "march" },
      { isStaff: false, nowMs: 60_000 },
    );
    expect(blessed.state.freeStatPoints).toBe(cur.state.freeStatPoints);
    const speedBlessed = computeAndroidStats("sage", blessed.level, blessed.state, 65_000).speed;
    const speedNormal = computeAndroidStats("sage", cur.level, cur.state, 65_000).speed;
    expect(speedBlessed).toBeGreaterThan(speedNormal);
  });

  it("handles 24-slot backpack & bank deposits/withdrawals and migrates legacy 15/12 saves cleanly", () => {
    expect(BACKPACK_SIZE).toBe(24);
    expect(BANK_SIZE).toBe(24);

    // Legacy 15-slot backpack & 12-slot bank migrate without data loss
    const migrated = normalizeAndroidState(
      {
        version: 1,
        backpack: [{ id: "potion_hp", qty: 2 }, ...Array(14).fill(null)],
        bankItems: [{ id: "crystal_ki", qty: 5 }, ...Array(11).fill(null)],
      },
      "planetary",
      1,
    );
    expect(migrated.backpack.length).toBe(24);
    expect(migrated.bankItems.length).toBe(24);
    expect(migrated.backpack[0]).toEqual({ id: "potion_hp", qty: 2 });
    expect(migrated.bankItems[0]).toEqual({ id: "crystal_ki", qty: 5 });

    const hero = freshHero("sage", 400);
    const depItem = applyAndroidAction(
      hero,
      { type: "bank_deposit_item", backpackIndex: 0 },
      { isStaff: false },
    );
    expect(depItem.state.backpack[0]).toBeNull();
    expect(depItem.state.bankItems[0]).toEqual({ id: "potion_hp_small", qty: 3 });

    const wdItem = applyAndroidAction(
      { race: hero.race, ...depItem },
      { type: "bank_withdraw_item", bankIndex: 0 },
      { isStaff: false },
    );
    expect(wdItem.state.bankItems[0]).toBeNull();
    expect(wdItem.state.backpack[0]).toEqual({ id: "potion_hp_small", qty: 3 });
  });

  it("protects materials from accidental destruction on use_item and allows AoE multi-kills without 400ms drops", () => {
    let cur = freshHero("legend", 200, 4);
    // 6 simultaneous AoE kills at the exact same timestamp (0ms delta) MUST ALL SUCCEED!
    for (let i = 0; i < 6; i++) {
      const res = applyAndroidAction(
        cur,
        { type: "monster_kill", monsterId: `mob-${i}`, level: 4, land: "pyra" },
        { isStaff: false, nowMs: 100_000 },
      );
      cur = { race: "legend", ...res };
    }
    expect(cur.state.progress.monsterKills).toBe(6);

    // Elite kill awards 3x XP & Gold + guaranteed mat_elite_core + potion_hp
    const xpPre = cur.state.xp;
    const goldPre = cur.gold;
    const el = applyAndroidAction(
      cur,
      { type: "monster_kill", monsterId: "pyra-elite-1", level: 5, isElite: true, land: "pyra" },
      { isStaff: false, nowMs: 105_000 },
    );
    expect(el.state.xp - xpPre).toBe((18 + 5 * 7) * 3); // 159 XP!
    expect(el.gold - goldPre).toBe((8 + 5 * 4) * 3); // 84 gold!
    expect(el.state.progress.eliteKills).toBe(1);
    expect(el.state.backpack.some((s) => s?.id === "mat_elite_core")).toBe(true);

    // Clicking material in backpack refuses to destroy it!
    const matIdx = el.state.backpack.findIndex((s) => s?.id === "mat_elite_core");
    expect(() =>
      applyAndroidAction(
        { race: "legend", ...el },
        { type: "use_item", backpackIndex: matIdx },
        { isStaff: false },
      ),
    ).toThrowError(/surowiec/i);
  });

  it("validates talent minLevel, prerequisites & exclusive choices and applies passive stat bonuses", () => {
    const lv1 = freshHero("android", 200, 1);
    // A1 requires Lv.2 -> blocked at Lv.1
    expect(() =>
      applyAndroidAction(lv1, { type: "unlock_talent", nodeId: "A1" }, { isStaff: false }),
    ).toThrowError(/Wymagany poziom 2/i);

    // At Lv.4, A2 (+6% CRIT) requires A1 first
    const lv4 = freshHero("android", 200, 4);
    expect(() =>
      applyAndroidAction(lv4, { type: "unlock_talent", nodeId: "A2" }, { isStaff: false }),
    ).toThrowError(/Wymaga wcześniejszego talentu/i);

    const withA1 = applyAndroidAction(
      lv4,
      { type: "unlock_talent", nodeId: "A1" },
      { isStaff: false },
    );
    const critBefore = computeAndroidStats("android", 4, withA1.state).critChance;
    const withA2 = applyAndroidAction(
      { race: "android", ...withA1 },
      { type: "unlock_talent", nodeId: "A2" },
      { isStaff: false },
    );
    const critAfter = computeAndroidStats("android", 4, withA2.state).critChance;
    expect(critAfter).toBeCloseTo(critBefore + 6, 1);
  });

  it("enforces Hard Quests & awards unique non-shop equipment (ring_covenant_q, amulet_guardian_q)", () => {
    // Hard Contract I (A-P05): requires Lv.3 + 12 kills + 5 gathers + 1 elite -> grants ring_covenant_q!
    const cur = freshHero("legend", 200, 3);
    cur.state.progress.monsterKills = 12;
    cur.state.progress.gatherCount = 5;
    cur.state.progress.eliteKills = 1;

    const claimed = applyAndroidAction(
      cur,
      { type: "claim_goal", goalId: "A-P05" },
      { isStaff: false, nowMs: 10_000 },
    );
    expect(claimed.state.backpack.some((s) => s?.id === "ring_covenant_q")).toBe(true);

    // G-P01 counts land-prefixed NPC quests too (pyra:Kaena)
    const npcQ = applyAndroidAction(
      { race: "legend", ...claimed },
      { type: "quest_complete", questId: "pyra:Kaena" },
      { isStaff: false, nowMs: 12_000 },
    );
    const g01 = applyAndroidAction(
      { race: "legend", ...npcQ },
      { type: "claim_goal", goalId: "G-P01" },
      { isStaff: false, nowMs: 13_000 },
    );
    expect(g01.state.completedQuests["G-P01"]).toBeTruthy();
  });

  it("persists GM actions through the canonical transition and reload normalization", () => {
    const hero = freshHero();
    const commands = [
      { type: "gm_action", op: "set_level", value: 20 },
      { type: "gm_action", op: "add_gold", value: 500 },
      { type: "gm_action", op: "set_gold", value: 1000 },
      { type: "gm_action", op: "set_stat_points", value: 14 },
      { type: "gm_action", op: "set_skill_points", value: 8 },
      { type: "gm_action", op: "add_attribute", stat: "atk", value: 20 },
      { type: "gm_action", op: "set_attribute", stat: "def", value: 2 },
      { type: "gm_action", op: "unlock_talents" },
      { type: "gm_action", op: "give_item", itemId: "potion_hp", qty: 2 },
      { type: "gm_action", op: "set_test_hp" },
    ] satisfies AndroidAction[];
    let current = hero;
    for (const command of commands) {
      expect(() => applyAndroidAction(current, command, { isStaff: false })).toThrowError(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
      const next = applyAndroidAction(current, command, { isStaff: true });
      current = { ...current, ...next };
    }
    const restored = normalizeAndroidState(current.state, current.race, current.level);
    expect(current).toMatchObject({ gold: 1000, level: 20 });
    expect(restored).toMatchObject({
      freeStatPoints: 14,
      skillPoints: 8,
      bonusStats: { atk: 20, def: 2 },
      hp: 1,
    });
    expect(restored.unlockedNodes).toContain("A9");
    expect(restored.backpack).toContainEqual({ id: "potion_hp", qty: 2 });

    for (const op of ["reset_attributes", "reset_talents", "full_heal"] as const) {
      current = {
        ...current,
        ...applyAndroidAction(current, { type: "gm_action", op }, { isStaff: true }),
      };
    }
    expect(current.state.unlockedNodes).toEqual(["R"]);
    expect(current.state.bonusStats.atk).toBe(0);
    expect(current.state.hp).toBe(
      computeAndroidStats(current.race, current.level, current.state).maxHp,
    );
  });

  it("applies the canonical HP and KI potion entries and consumes only one item per action", () => {
    const hero = freshHero();
    hero.state.hp = 5;
    hero.state.ki = 1;
    expect(() =>
      applyAndroidAction(
        hero,
        { type: "use_item", backpackIndex: 0, expectedItemId: "potion_ki" },
        { isStaff: false },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    expect(hero.state.backpack[0]).toEqual({ id: "potion_hp_small", qty: 3 });
    const hp = applyAndroidAction(
      hero,
      { type: "use_item", backpackIndex: 0, expectedItemId: "potion_hp_small" },
      { isStaff: false },
    );
    expect(hp.state.hp).toBe(80);
    expect(hp.state.backpack[0]).toEqual({ id: "potion_hp_small", qty: 2 });
    const ki = applyAndroidAction(
      { ...hero, ...hp },
      { type: "use_item", backpackIndex: 1 },
      { isStaff: false },
    );
    expect(ki.state.ki).toBe(computeAndroidStats(hero.race, hero.level, ki.state).maxKi);
    expect(ki.state.backpack[1]).toEqual({ id: "potion_ki", qty: 1 });
  });

  it("blocks GM actions for non-staff and allows admin patches", () => {
    const hero = freshHero("legend", 120);
    expect(() =>
      applyAndroidAction(
        hero,
        { type: "gm_action", op: "add_gold", value: 99999 },
        { isStaff: false },
      ),
    ).toThrowError(AndroidEconomyError);

    const patched = applyAdminCharacterPatch(
      {
        name: "Ignis",
        race: "legend",
        land: hero.land,
        level: hero.level,
        gold: hero.gold,
        state: hero.state,
      },
      {
        name: "IgnisPrime",
        level: 10,
        gold: 5000,
        training: { atk: 5, hp: 4 },
      },
    );
    expect(patched.state.training.atk).toBe(5);
    expect(patched.state.training.hp).toBe(4);
    expect(ANDROID_ITEM_CATALOG.filter((i) => i.shopPrice !== null && i.slot >= 0).length).toBe(6);
  });
});
