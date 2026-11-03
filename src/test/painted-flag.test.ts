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

describe("jedna flaga malowanych miast", () => {
  it("?ki-painted=1 włącza wszystkie cztery miasta", () => {
    const packs = previewPacks("?ki-painted=1");
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

  it("bez flagi nic się nie zmienia, a flagi pojedynczych miast nadal działają", () => {
    for (const id of PAINTED) expect(previewPacks("")).not.toContain(id);
    expect(previewPacks("?ki-pyra-painted=1")).toContain("pyra-painted-preview");
    expect(previewPacks("?ki-nexus-painted=1")).toContain("nexus-painted-preview");
    expect(previewPacks("?ki-aether-painted=1")).toContain("aether-painted-preview");
    expect(previewPacks("?ki-verdant-painted=1")).toContain("verdant-leaf-buildings");
  });
});
