import { describe, expect, it } from "vitest";
import imported from "../game/assets/imported.json";
import { previewPacks } from "../game/assets/catalog";

const PAINTED = [
  "verdant-painted-preview",
  "verdant-leaf-buildings",
  "aether-painted-preview",
  "nexus-painted-preview",
  "pyra-painted-preview",
];

describe("malowane miasta bez flagi", () => {
  it("wszystkie cztery miasta są włączone bez flagi", () => {
    const packs = previewPacks("");
    for (const id of PAINTED) expect(packs).toContain(id);
  });

  it("wszystkie paczki istnieją w imported.json i są previewOnly", () => {
    const byId = new Map(
      (imported as { id: string; previewOnly?: boolean }[]).map((p) => [p.id, p]),
    );
    for (const id of PAINTED) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.previewOnly, id).toBe(true);
    }
  });

  it("malowane miasta są domyślnie publiczne, a ?ki-painted=0 przywraca stary wygląd", () => {
    for (const id of PAINTED) {
      expect(previewPacks("")).toContain(id);
      expect(previewPacks("?ki-painted=0")).not.toContain(id);
    }
  });
});
