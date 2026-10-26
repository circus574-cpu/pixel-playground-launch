import { describe, expect, it } from "vitest";
import { ALL_QUESTS_V2, QUEST_BY_ID } from "../../quests/engine";
import { ALL_CITIES_V2, CONTINENTS_WORLD_V2 } from "../../worlds";
import {
  ALL_CONTINENT_DIALOGUES,
  ALL_NPC_DIALOGUES,
  getNpcDialogue,
  getNpcQuestDialogue,
} from "../index";

describe("NPC Dialogue Catalog (Zadanie 1 — Dialogi NPC)", () => {
  const worldNpcMap = new Map<string, { npcId: string; cityId: string; name: string }>();
  for (const city of ALL_CITIES_V2) {
    for (const npc of city.npcs) {
      worldNpcMap.set(npc.id, { npcId: npc.id, cityId: city.id, name: npc.name });
    }
  }

  it("1. Wszystkie 4 kontynenty posiadają katalog dialogów z dokładnie 7 NPC każdy (łącznie 28 NPC)", () => {
    const continents = ["verdant", "pyra", "aether", "nexus"] as const;
    for (const c of continents) {
      expect(ALL_CONTINENT_DIALOGUES[c]).toBeDefined();
      expect(ALL_CONTINENT_DIALOGUES[c].continent).toBe(c);
      const npcs = Object.values(ALL_CONTINENT_DIALOGUES[c].dialogues);
      expect(npcs).toHaveLength(7);
    }
    expect(Object.keys(ALL_NPC_DIALOGUES)).toHaveLength(28);
  });

  it("2. Każde NPC ID z katalogu dialogów istnieje w świecie i odpowiada właściwemu miastu", () => {
    for (const [npcId, def] of Object.entries(ALL_NPC_DIALOGUES)) {
      expect(worldNpcMap.has(npcId), `NPC ${npcId} nie istnieje w świecie`).toBe(true);
      const worldNpc = worldNpcMap.get(npcId)!;
      expect(def.cityId).toBe(worldNpc.cityId);
      expect(def.npcId).toBe(npcId);
      expect(def.greetings).toHaveLength(3);
      for (const g of def.greetings) {
        expect(typeof g).toBe("string");
        expect(g.trim().length).toBeGreaterThan(10);
      }
      expect(def.rumors).toHaveLength(3);
      for (const r of def.rumors) {
        expect(typeof r).toBe("string");
        expect(r.trim().length).toBeGreaterThan(15);
      }
    }
  });

  it("3. Każde quest ID w dialogach NPC istnieje w silniku questów (ALL_QUESTS_V2)", () => {
    for (const [npcId, def] of Object.entries(ALL_NPC_DIALOGUES)) {
      for (const [questId, qDialogue] of Object.entries(def.quests)) {
        expect(
          QUEST_BY_ID[questId],
          `Quest ${questId} przypisany do ${npcId} nie istnieje w ALL_QUESTS_V2`,
        ).toBeDefined();
        expect(qDialogue.questId).toBe(questId);
        expect(qDialogue.before.trim().length).toBeGreaterThan(10);
        expect(qDialogue.during.trim().length).toBeGreaterThan(10);
        expect(qDialogue.after.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("4. Każdy z 106 questów w świecie posiada przypisany zestaw dialogów (before, during, after) u swojego zleceniodawcy", () => {
    expect(ALL_QUESTS_V2).toHaveLength(106);
    for (const quest of ALL_QUESTS_V2) {
      const npcDef = ALL_NPC_DIALOGUES[quest.giverNpcId];
      expect(
        npcDef,
        `Zleceniodawca ${quest.giverNpcId} dla questu ${quest.id} nie istnieje w ALL_NPC_DIALOGUES`,
      ).toBeDefined();
      const qDialogue = npcDef!.quests[quest.id];
      expect(
        qDialogue,
        `Brak dialogu dla questu ${quest.id} u zleceniodawcy ${quest.giverNpcId}`,
      ).toBeDefined();
      expect(qDialogue!.before).toBeTruthy();
      expect(qDialogue!.during).toBeTruthy();
      expect(qDialogue!.after).toBeTruthy();
    }
  });

  it("5. Funkcje pomocnicze getNpcDialogue oraz getNpcQuestDialogue zwracają poprawne dane", () => {
    const aira = getNpcDialogue("npc-aira");
    expect(aira).toBeDefined();
    expect(aira?.npcName).toBe("Aira");
    expect(aira?.greetings).toHaveLength(3);

    const ov01 = getNpcQuestDialogue("npc-aira", "O-V01");
    expect(ov01).toBeDefined();
    expect(ov01?.questId).toBe("O-V01");
    expect(ov01?.before).toContain("Verdantii");

    const nonExistent = getNpcDialogue("npc-nieznany");
    expect(nonExistent).toBeUndefined();
  });
});
