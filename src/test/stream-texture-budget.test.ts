import { examAssets } from "../game/development/examRuntime";
import { RACE_IDS } from "../game/world/races";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packs from "../game/assets/imported.json";
import { PackSchema } from "../game/assets/schema";
import { makeCatalog, previewPacks, monsterVisual } from "../game/assets/catalog";
import {
  STREAM_TEXTURE_BUDGET_BYTES,
  STREAM_RESERVED_BYTES,
  streamTextureBytes,
} from "../game/assets/streamBudget";

describe("HD hero and streamed creature texture budget", () => {
  it("fits the exact resident set captured from the once-failing pristine Sage scenario plus its creature", () => {
    const baseline = JSON.parse(
      readFileSync(
        "docs/zmiany/2026-10-28/qa/racial-development/baseline-sage-resident-textures.json",
        "utf8",
      ),
    ) as { sourceSha: string; url: string; ids: string[]; enemies: unknown[] };
    expect(baseline.sourceSha).toBe("3ffd46c7e993c310a7b507c8b93c3723b91825bd");
    expect(baseline.enemies).toEqual([]);
    const catalog = makeCatalog(
      packs.map((p) => PackSchema.parse(p)),
      previewPacks(new URL(baseline.url).search),
    );
    const ids = [
      ...baseline.ids,
      ...Object.values(monsterVisual("pyra-ognista-salamandra", catalog).clips).map((c) => c.asset),
    ];
    const bytes = streamTextureBytes(ids, catalog.assets);
    // The hero atlases were repacked with trimmed frames (Tryb KI work, 11.11.2026): the same resident set that once
    // exceeded 128 MiB now fits it.
    expect(bytes).toBeLessThanOrEqual(128 * 1024 * 1024);
    expect(bytes).toBeLessThanOrEqual(STREAM_TEXTURE_BUDGET_BYTES);
    // 137.96 MB with the earlier salamander (two atlas pages); 132.47 MB with its anime redraw
    // (one 2048×1024 page, 02.11.2026).
    // 102.79 MiB with mirrored side views drawn by flipX (109.62 before; 132.47 originally).
    // 98.36 MiB with the legacy fallback hero sheet stored at 640 px instead of 1254 px (12.11.2026).
    // 93.93 MiB with the salamander's frames trimmed to the figure and repacked (13.11.2026).
    // 85.08 MiB with the Sage hero pack stored at a 200 px cell instead of 256 px (13.11.2026).
    expect(bytes / 1024 / 1024).toBeCloseTo(85.08064270019531);
  });
  it("retains a finite ceiling and reserves terrain, deduplicating reused atlases", () => {
    const assets = new Map([["atlas", { width: 2048, height: 2048 }]]);
    expect(streamTextureBytes(["atlas", "atlas"], assets)).toBe(
      STREAM_RESERVED_BYTES + 16 * 1024 * 1024,
    );
    expect(STREAM_TEXTURE_BUDGET_BYTES).toBe(192 * 1024 * 1024);
    expect(streamTextureBytes(["unknown"], assets)).toBe(STREAM_RESERVED_BYTES + 512 * 512 * 4);
  });
});

it.each(RACE_IDS)(
  "loan room loads only its hero, UI and effects, not a duplicate continent: %s",
  (race) => {
    const assets = examAssets(race);
    const bytes = assets.reduce((total, a) => total + (a.width ?? 512) * (a.height ?? 512) * 4, 0);
    expect(bytes).toBeLessThan(64 * 1024 * 1024);
    expect(assets.some((a) => a.id === "ui-icons")).toBe(true);
    expect(
      assets.some(
        (a) =>
          a.id.includes("city-house") || a.id.includes("city-hall") || a.id.startsWith("nature-"),
      ),
    ).toBe(false);
  },
);
