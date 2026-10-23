import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MONSTERS } from "../game/monsters/catalog";
import { actorVisual, worldAssets, monsterVisual } from "../game/assets/catalog";
import { WORLDS } from "../game/world/worlds";

describe("installed bestiary art", () => {
  it("resolves all 40 authored kinds to their own seven-state actor, preserving feet and scale", () => {
    expect(MONSTERS).toHaveLength(40);
    for (const m of MONSTERS) {
      const visual = actorVisual(m.world, "enemy", m.id.slice(m.world.length + 1));
      expect(visual.id, m.id).toBe("enemy-" + m.id);
      expect(visual.size).toEqual([84, 84]);
      expect(visual.origin).toEqual([0.5, 0.8]);
      expect(Object.keys(visual.clips).sort()).toEqual([
        "attack",
        "death",
        "hit",
        "idle",
        "respawn",
        "skill",
        "walk",
      ]);
    }
  });
  it("uses the delivered wasp for its summoned offspring", () => {
    expect(monsterVisual("verdant-mala-osa").id).toBe("enemy-verdant-bursztynowa-osa");
  });
  it("does not eagerly allocate the complete installed bestiary on an accepted static map", () => {
    for (const world of Object.values(WORLDS)) {
      const ids = worldAssets(world.id).map((a) => a.id);
      const authored = world.monsters?.map((s) => "enemy-" + s.kind + "-") ?? [];
      for (const id of ids.filter((id) => id.startsWith("enemy-")))
        expect(authored.some((prefix) => id.startsWith(prefix))).toBe(true);
    }
  });
  it("retains every visible frame pixel while reducing decoded atlas memory", () => {
    const reports = JSON.parse(
      readFileSync("docs/zmiany/2026-10-23/qa/superior-runtime/enemy-packing.json", "utf8"),
    ) as {
      frames: number;
      visiblePixelsBefore: string;
      visiblePixelsAfter: string;
      originalRgbaBytes: number;
      packedRgbaBytes: number;
    }[];
    expect(reports).toHaveLength(40);
    for (const r of reports) {
      expect(r.frames).toBe(416);
      expect(r.visiblePixelsAfter).toBe(r.visiblePixelsBefore);
      expect(r.packedRgbaBytes).toBeLessThan(r.originalRgbaBytes);
    }
  });
});
