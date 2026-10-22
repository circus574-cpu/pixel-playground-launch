import { describe, expect, it } from "vitest";
import { actorVisual, catalog, worldAssets } from "../game/assets/catalog";

describe("active race artwork and in-game atlas", () => {
  it("uses real Planetary animation in Verdantia without a query-string preview switch", () => {
    expect(actorVisual("verdant", "hero").id).toBe("hero-planetary");
    expect(catalog.actors.has("hero-planetary")).toBe(true);
    const assets = worldAssets("verdant");
    expect(assets.some((asset) => asset.id === "hero-planetary-page-0")).toBe(true);
    expect(assets.some((asset) => asset.id === "hero-planetary-page-1")).toBe(true);
  });
  it("keeps Sage art active and other races' existing fallback unchanged", () => {
    expect(actorVisual("aether", "hero").id).toBe("hero-sage");
    expect(actorVisual("nexus", "hero").id).toBe("human-v2");
    expect(actorVisual("pyra", "hero").id).toBe("human-v2");
  });
});
