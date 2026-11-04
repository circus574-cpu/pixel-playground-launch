import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json";
import { MONSTER_BASE } from "../game/monsters/base.generated";
import { previewPacks } from "../game/assets/catalog";

const monsterIds = (Array.isArray(MONSTER_BASE) ? MONSTER_BASE : Object.values(MONSTER_BASE)).map(
  (m) => (m as { id: string }).id,
);

describe("potwory w stylu anime: komplet 40 z 40", () => {
  it("bestiariusz ma 40 potworów", () => {
    expect(monsterIds).toHaveLength(40);
  });
  it("każdy potwór ma pakiet enemy-v3 w importowanych paczkach", () => {
    const packs = new Set((imported as { id: string }[]).map((p) => p.id));
    for (const id of monsterIds) expect(packs.has("enemy-v3-" + id), id).toBe(true);
  });
  it("każdy pakiet jest domyślnie włączony, a ?ki-monsters-anime=0 go wyłącza", () => {
    const on = previewPacks("");
    const off = previewPacks("?ki-monsters-anime=0");
    for (const id of monsterIds) {
      expect(on, id).toContain("enemy-v3-" + id);
      expect(off, id).not.toContain("enemy-v3-" + id);
    }
  });
});
