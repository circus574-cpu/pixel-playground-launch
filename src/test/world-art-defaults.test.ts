import { describe, expect, it } from "vitest";
import { previewPacks } from "../game/assets/catalog";
import { dressEnabled } from "../game/world/generated/worldDress";

/** Decyzja właściciela 06.11.2026: „wyłącz flagowanie. wszystkie światy maja dzialac domyslnie." */
describe("oprawa świata jest domyślnie włączona", () => {
  it("instaluje sześć pakietów wysp i kontynent Nexusa bez flagi w URL", () => {
    const domyslne = previewPacks("");
    for (let i = 1; i <= 6; i++) expect(domyslne, `island-${i}`).toContain(`superior-island-${i}-art`);
    expect(domyslne).toContain("nexus-continent-v2");
  });
  it("każda z tych warstw nadal ma wyłącznik w URL", () => {
    expect(previewPacks("?ki-islands-art=0")).not.toContain("superior-island-1-art");
    expect(previewPacks("?ki-islands-art=0")).not.toContain("superior-island-6-art");
    expect(previewPacks("?ki-nexus-continent=0")).not.toContain("nexus-continent-v2");
  });
  it("dekoracja świata działa bez flagi i gaśnie przez ?ki-dress=0", () => {
    const okno = (search: string) => {
      (globalThis as { window?: { location: { search: string } } }).window = { location: { search } };
      return dressEnabled();
    };
    expect(okno("?ki-world-v2=1")).toBe(true);
    expect(okno("?ki-dress=1")).toBe(true);
    expect(okno("?ki-dress=0")).toBe(false);
    delete (globalThis as { window?: unknown }).window;
    expect(dressEnabled()).toBe(true);
  });
});
