// @vitest-environment node
import { describe, expect, it } from "vitest";
import rankRules from "../../ports/godot-isometric-world/data/talent_rank_rules.json";
import { KIT_NODES } from "../game/kit/nodes.generated";
import {
  ANDROID_ITEM_CATALOG,
  ANDROID_RACES,
  type AndroidAction,
  AndroidEconomyError,
  BACKPACK_SIZE,
  BANK_SIZE,
  applyAdminCharacterPatch,
  applyAndroidAction,
  computeAndroidStats,
  computeTrainingBonuses,
  computeTalentPassiveBonuses,
  createInitialAndroidState,
  maxTrainingPerStat,
  normalizeAndroidState,
} from "../server/godot/economy";

import {
  ANDROID_POSITION_LAYOUT,
  androidTarget,
  walkableAndroidPoint,
} from "../server/godot/worldData";

const pyraMob = androidTarget("pyra", "pyra-zone-1-m1")!;
if (pyraMob.kind !== "monster") throw new Error("Missing canonical Pyra spawn");
const pyraPoint = { x: pyraMob.x, z: pyraMob.z };

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
        { type: "gather_node", nodeId: "pyra-gather-2", itemId: "mat_obsidian", land: "pyra" },
        { isStaff: false, nowMs: 10_000 },
      ),
    };
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "gather_node", nodeId: "pyra-gather-5", itemId: "mat_obsidian", land: "pyra" },
        { isStaff: false, nowMs: 15_000 },
      ),
    };
    // 2 kills on Pyra drop tusk_beast
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "monster_kill", monsterId: "pyra-wegielek", level: 1, land: "pyra" },
        { isStaff: false, nowMs: 20_000 },
      ),
    };
    cur = {
      race: "legend",
      ...applyAndroidAction(
        cur,
        { type: "monster_kill", monsterId: "pyra-wegielek", level: 1, land: "pyra" },
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
        { type: "monster_kill", monsterId: "pyra-popielny-wilk", level: 4, land: "pyra" },
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
      {
        type: "monster_kill",
        monsterId: "pyra-popielny-wilk",
        level: 5,
        isElite: true,
        land: "pyra",
      },
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
    expect(critAfter).toBeCloseTo(critBefore + 3, 1);
  });

  const talentCases = ANDROID_RACES.flatMap((race) =>
    KIT_NODES[race].map((node) => ({ race, id: node.id, node })),
  );

  it.each(talentCases)("$race $id obeys the Android rank contract", ({ race, id, node }) => {
    const hero = freshHero(race, 500, 20);
    hero.state.unlockedNodes = ["R", ...node.requires.filter((req) => req !== "R")];
    const op = { type: "unlock_talent", nodeId: id };
    const options = { isStaff: false };
    if (id === "R") {
      expect(() => applyAndroidAction(hero, { ...op, expectedRank: 1 }, options)).toThrow(
        /już odblokowany/i,
      );
      expect(hero.state.skillPoints).toBe(20);
      return;
    }

    const first = applyAndroidAction(hero, { ...op, expectedRank: 0 }, options);
    const afterFirst = { race, ...first };
    expect(first.state.skillPoints).toBe(19);
    expect(first.state.talentRanks[id]).toBe(1);
    expect(() => applyAndroidAction(afterFirst, { ...op, expectedRank: 0 }, options)).toThrow();
    if (rankRules.rankable[race].includes(id)) {
      const second = applyAndroidAction(afterFirst, { ...op, expectedRank: 1 }, options);
      expect(second.state.talentRanks[id]).toBe(2);
      expect(second.state.skillPoints).toBe(18);
      expect(second.state.unlockedNodes).toEqual(first.state.unlockedNodes);
      expect(second.state.hotbarSlots).toEqual(first.state.hotbarSlots);
    } else {
      expect(() => applyAndroidAction(afterFirst, { ...op, expectedRank: 1 }, options)).toThrow(
        /już odblokowany/i,
      );
      expect(first.state.skillPoints).toBe(19);
    }
  });

  it.each([
    ["planetary", "A2", "spdPct", 6],
    ["sage", "C2", "kiPct", 15],
    ["android", "B2", "defPct", 8],
    ["legend", "A5", "atkPct", 8],
  ] as const)("%s scales %s additively and keeps browser ranks", (race, id, stat, base) => {
    const legacy = normalizeAndroidState({ unlockedNodes: ["R", id], skillPoints: 4 }, race, 10);
    expect(legacy.talentRanks).toEqual({ R: 1, [id]: 1 });
    expect(legacy.skillPoints).toBe(4);
    expect(
      computeTalentPassiveBonuses(race, legacy.unlockedNodes, legacy.talentRanks)[stat],
    ).toBeCloseTo(base * 0.5);
    const imported = createInitialAndroidState(race, {
      level: 10,
      unlockedNodes: ["R", id, id, id],
    });
    expect(imported.state.unlockedNodes).toEqual(["R", id]);
    expect(imported.state.talentRanks[id]).toBe(3);
    expect(imported.state.skillPoints).toBe(7);
    const reloaded = normalizeAndroidState(JSON.parse(JSON.stringify(imported.state)), race, 10);
    expect(
      computeTalentPassiveBonuses(race, reloaded.unlockedNodes, reloaded.talentRanks)[stat],
    ).toBeCloseTo(base * 0.6);
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

  it("creates a walk-over drop and credits it only once, after a valid pickup", () => {
    const hero = freshHero();
    expect(walkableAndroidPoint("pyra", pyraPoint)).toBe(true);
    const defeat = {
      type: "pve_defeat",
      land: "pyra",
      targetId: "pyra-zone-1-m1",
      drop: pyraPoint,
    } as const;
    const killed = applyAndroidAction(hero, defeat, { isStaff: false, nowMs: 1_000 });
    expect(killed.gold).toBe(hero.gold);
    expect(killed.state.backpack).toEqual(hero.state.backpack);
    expect(killed.state.xp - hero.state.xp).toBe(25);
    const afterKill = { ...hero, ...killed };
    expect(() =>
      applyAndroidAction(afterKill, defeat, { isStaff: false, nowMs: 2_000 }),
    ).toThrowError(expect.objectContaining({ code: "ARENA_COOLDOWN" }));
    const token = killed.lootDrop!.token;
    const pickup = { type: "pickup_loot", token, land: "pyra", position: pyraPoint } as const;
    expect(() => applyAndroidAction(hero, pickup, { isStaff: false, nowMs: 2_000 })).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    expect(() =>
      applyAndroidAction(
        afterKill,
        { ...pickup, position: { ...pyraPoint, x: pyraPoint.x + 50 } },
        { isStaff: false, nowMs: 2_000 },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));

    const full = structuredClone(afterKill);
    full.state.backpack.fill({ id: "potion_ki", qty: 999 });
    expect(() => applyAndroidAction(full, pickup, { isStaff: false, nowMs: 2_000 })).toThrowError(
      expect.objectContaining({ code: "BACKPACK_FULL" }),
    );
    expect(full.state.pendingLoot[0]?.claimed).toBe(false);
    expect(full.gold).toBe(hero.gold);

    const collected = applyAndroidAction(afterKill, pickup, { isStaff: false, nowMs: 2_000 });
    expect(collected.gold).toBe(hero.gold + killed.lootDrop!.gold);
    for (const item of killed.lootDrop!.items)
      expect(collected.state.backpack).toContainEqual(item);
    const retried = applyAndroidAction({ ...hero, ...collected }, pickup, {
      isStaff: false,
      nowMs: 3_000,
    });
    expect(retried.gold).toBe(collected.gold);
    expect(retried.state.backpack).toEqual(collected.state.backpack);
    expect(() =>
      applyAndroidAction(afterKill, pickup, { isStaff: false, nowMs: 122_000 }),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("records hunting XP without counting a monster and validates labyrinth loot in its room", () => {
    const hero = freshHero("legend", 100, 6);
    const animal = androidTarget("pyra", "animal_A-04_0")!;
    if (animal.kind !== "animal") throw new Error("Missing canonical animal spawn");
    const hunt = applyAndroidAction(
      hero,
      {
        type: "pve_defeat",
        land: "pyra",
        targetId: "animal_A-04_0",
        drop: { x: animal.x, z: animal.z },
      },
      { isStaff: false, nowMs: 10_000 },
    );
    expect(hunt.state.progress.animalsHunted).toBe(1);
    expect(hunt.state.progress.monsterKills).toBe(0);
    expect(hunt.state.xp).toBe(14);
    expect(hunt.gold).toBe(100);
    expect(hunt.lootDrop!.gold).toBeGreaterThanOrEqual(6);
    expect(hunt.lootDrop!.gold).toBeLessThanOrEqual(14);

    const room = "lab-pyra-caldera";
    const point = { x: 111, z: 111 };
    const kill = applyAndroidAction(
      { ...hero, ...hunt },
      {
        type: "pve_defeat",
        land: "pyra",
        targetId: "guard-lab-pyra-caldera-1",
        drop: point,
      },
      { isStaff: false, nowMs: 11_000 },
    );
    expect(kill.lootDrop!.room).toBe(room);
    const pickup = {
      type: "pickup_loot",
      token: kill.lootDrop!.token,
      land: "pyra",
      position: point,
    };
    expect(() =>
      applyAndroidAction({ ...hero, ...kill }, pickup, { isStaff: false, nowMs: 12_000 }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    const claimed = applyAndroidAction(
      { ...hero, ...kill },
      { ...pickup, room },
      {
        isStaff: false,
        nowMs: 12_000,
      },
    );
    expect(claimed.gold).toBe(100 + kill.lootDrop!.gold);
  });

  it("saves only walkable exterior positions and invalidates stale saves after travel and defeat", () => {
    const hero = freshHero();
    const save = {
      type: "save_position",
      epoch: 0,
      layout: ANDROID_POSITION_LAYOUT,
      land: "pyra",
      position: pyraPoint,
    } as const;
    const saved = applyAndroidAction(hero, save, { isStaff: false });
    expect(saved.state.position).toEqual({
      ...pyraPoint,
      land: "pyra",
      layout: ANDROID_POSITION_LAYOUT,
    });
    expect(normalizeAndroidState(saved.state, hero.race, hero.level).position).toEqual(
      saved.state.position,
    );
    expect(() =>
      applyAndroidAction(hero, { ...save, position: { x: 0, z: 0 } }, { isStaff: false }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    const traveled = applyAndroidAction(
      { ...hero, ...saved },
      { type: "travel", land: "aether" },
      {
        isStaff: false,
      },
    );
    expect(traveled.state.position).toBeNull();
    const returned = applyAndroidAction(
      { ...hero, ...traveled },
      { type: "travel", land: "pyra" },
      {
        isStaff: false,
      },
    );
    expect(() =>
      applyAndroidAction({ ...hero, ...returned }, save, { isStaff: false }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    const defeated = applyAndroidAction(
      { ...hero, ...saved },
      { type: "hero_defeat" },
      { isStaff: false },
    );
    expect(defeated.state.position).toBeNull();
    expect(defeated.state.positionEpoch).toBe(1);
  });

  it("uses world-defined chest and gathering rewards and keeps the two gathering cooldowns", () => {
    const hero = freshHero();
    const chest = applyAndroidAction(
      hero,
      {
        type: "claim_treasure",
        treasureId: "tr-pyra-1",
        gold: 300,
        xp: 300,
        itemId: "pouch_gold",
      },
      { isStaff: false, nowMs: 20_000 },
    );
    expect(chest.gold - hero.gold).toBe(95);
    expect(chest.state.xp - hero.state.xp).toBe(45);
    expect(chest.state.backpack).toContainEqual({ id: "potion_hp", qty: 1 });
    expect(chest.state.backpack.some((item) => item?.id === "pouch_gold")).toBe(false);
    expect(() =>
      applyAndroidAction(
        hero,
        {
          type: "claim_treasure",
          treasureId: "chest-lab-pyra-caldera-1",
          labyrinthId: "lab-pyra-caldera",
          minLevel: 1,
        },
        { isStaff: false },
      ),
    ).toThrowError(expect.objectContaining({ code: "GOAL_NOT_MET" }));
    expect(() =>
      applyAndroidAction(
        hero,
        {
          type: "claim_treasure",
          treasureId: "tr-aether-1",
        },
        { isStaff: false },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));

    const gathered = applyAndroidAction(
      hero,
      {
        type: "gather_node",
        nodeId: "pyra-gather-2",
        itemId: "mat_elite_core",
      },
      { isStaff: false, nowMs: 20_000 },
    );
    expect(gathered.state.backpack).toContainEqual({ id: "mat_obsidian", qty: 1 });
    const afterGather = { ...hero, ...gathered };
    expect(() =>
      applyAndroidAction(
        afterGather,
        {
          type: "gather_node",
          nodeId: "pyra-gather-5",
        },
        { isStaff: false, nowMs: 21_199 },
      ),
    ).toThrowError(expect.objectContaining({ code: "ARENA_COOLDOWN" }));
    expect(
      applyAndroidAction(
        afterGather,
        {
          type: "gather_node",
          nodeId: "pyra-gather-5",
        },
        { isStaff: false, nowMs: 21_200 },
      ).state.progress.gatherCount,
    ).toBe(2);
    expect(() =>
      applyAndroidAction(
        afterGather,
        {
          type: "gather_node",
          nodeId: "pyra-gather-2",
        },
        { isStaff: false, nowMs: 25_000 },
      ),
    ).toThrowError(expect.objectContaining({ code: "ARENA_COOLDOWN" }));
  });

  it("shares the rest cooldown between sites and validates the old client monster catalogue", () => {
    const hero = freshHero();
    const rested = applyAndroidAction(
      hero,
      { type: "inn_rest" },
      { isStaff: false, nowMs: 20_000 },
    );
    const afterRest = { ...hero, ...rested };
    expect(() =>
      applyAndroidAction(afterRest, { type: "campfire_rest" }, { isStaff: false, nowMs: 27_999 }),
    ).toThrowError(expect.objectContaining({ code: "ARENA_COOLDOWN" }));
    expect(
      applyAndroidAction(afterRest, { type: "campfire_rest" }, { isStaff: false, nowMs: 28_000 })
        .state.lastRestAt,
    ).toBe(28_000);
    expect(() =>
      applyAndroidAction(
        hero,
        {
          type: "inn_rest",
          siteId: "pyra-inn",
          position: { x: 0, z: 0 },
        },
        { isStaff: false },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    expect(() =>
      applyAndroidAction(
        hero,
        {
          type: "monster_kill",
          monsterId: "pyra-wegielek",
          level: 100,
        },
        { isStaff: false, nowMs: 20_000 },
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ACTION" }));
    const killed = applyAndroidAction(
      hero,
      {
        type: "monster_kill",
        monsterId: "pyra-wegielek",
        level: 1,
      },
      { isStaff: false, nowMs: 20_000 },
    );
    expect(() =>
      applyAndroidAction(
        { ...hero, ...killed },
        { type: "inn_rest" },
        { isStaff: false, nowMs: 20_100 },
      ),
    ).toThrowError(expect.objectContaining({ code: "ARENA_COOLDOWN" }));
  });

  it("awards flat mastery bonuses only after every discipline reaches the threshold", () => {
    const ranks = (n: number) => ({ hp: n, ki: n, atk: n, def: n, spd: n, crit: n });
    expect(computeTrainingBonuses({ ...ranks(20), hp: 2 }).masteryTitle).toBe("Rekrut");
    for (const [rank, title, hp, atk, def] of [
      [3, "Adept Miasta", 0, 0, 0],
      [6, "Wojownik Miasta", 10, 2, 2],
      [10, "Weteran Stolicy", 25, 4, 4],
      [15, "Mistrz Ki", 50, 8, 6],
    ] as const) {
      expect(computeTrainingBonuses(ranks(rank))).toMatchObject({
        masteryTitle: title,
        hp: rank * 12 + hp,
        atk: rank * 2 + atk,
        def: Math.ceil(rank * 1.5) + def,
      });
    }
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

  it("supports Stage 3 assignable hotbar slots [1-4], duplicate swapping, validation, and auto-slotting", () => {
    const hero = freshHero("legend", 200, 10);
    expect(hero.state.hotbarSlots).toEqual(["A1", "B1", "C1", "A4"]);

    // Rejects assigning a locked skill
    expect(() =>
      applyAndroidAction(hero, { type: "set_hotbar", slot: 0, nodeId: "B4" }, { isStaff: false }),
    ).toThrowError(AndroidEconomyError);

    // Unlock path B1 -> B2 -> B4: B4 should auto-slot into first locked slot (slot 0 = A1 which is still locked!)
    let cur = hero;
    for (const nid of ["B1", "B2", "B4"]) {
      const res = applyAndroidAction(
        cur,
        { type: "unlock_talent", nodeId: nid },
        { isStaff: false },
      );
      cur = { ...cur, ...res };
    }
    expect(cur.state.unlockedNodes).toContain("B4");
    expect(cur.state.hotbarSlots).toContain("B4");

    // Assign B4 explicitly to slot 3 and swap duplicates cleanly
    const assigned = applyAndroidAction(
      cur,
      { type: "set_hotbar", slot: 3, nodeId: "B4" },
      { isStaff: false },
    );
    expect(assigned.state.hotbarSlots?.[3]).toBe("B4");
    expect(new Set(assigned.state.hotbarSlots ?? []).size).toBe(4);

    // Swapping B1 into slot 3 puts B4 back where B1 was
    const swapped = applyAndroidAction(
      { ...cur, ...assigned },
      { type: "set_hotbar", slot: 3, nodeId: "B1" },
      { isStaff: false },
    );
    expect(swapped.state.hotbarSlots?.[3]).toBe("B1");
    expect(swapped.state.hotbarSlots).toContain("B4");
    expect(new Set(swapped.state.hotbarSlots ?? []).size).toBe(4);

    // GM reset_talents restores default hotbarSlots
    const reset = applyAndroidAction(
      { ...cur, ...swapped },
      { type: "gm_action", op: "reset_talents" },
      { isStaff: true },
    );
    expect(reset.state.hotbarSlots).toEqual(["A1", "B1", "C1", "A4"]);
  });
});
