import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  devArtEnabled,
  examTierIconUrl,
  TRAINING_DISCIPLINE_ICONS,
  trainingObjectUrl,
} from "../game/development/developmentAssets";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("Etap 1 development assets (Partia 1 + P0)", () => {
  it("keeps candidate development art opt-in via ?ki-dev-art=1", () => {
    expect(devArtEnabled("")).toBe(false);
    expect(devArtEnabled("?ki-world-v2=1")).toBe(false);
    expect(devArtEnabled("?ki-dev-art=1")).toBe(true);
  });

  it("verifies all 8 training discipline/stat icons and 6 exam tier emblems exist in public/", () => {
    for (const [id, url] of Object.entries(TRAINING_DISCIPLINE_ICONS)) {
      expect(existsSync("public" + url), `${id}: ${url}`).toBe(true);
    }
    for (let tier = 1; tier <= 6; tier++) {
      const url = examTierIconUrl(tier);
      expect(url).toBeDefined();
      expect(existsSync("public" + url!), `tier ${tier}: ${url}`).toBe(true);
    }
    for (const world of ["verdant", "aether", "nexus"] as const) {
      for (const kind of [
        "dummy",
        "target",
        "ki-node",
        "defense",
        "ki-source",
        "checkpoint",
        "obstacle",
        "surrender",
      ] as const) {
        const url = trainingObjectUrl(world, kind);
        expect(url).toBeDefined();
        expect(existsSync("public" + url!), `${world}.${kind}: ${url}`).toBe(true);
      }
    }
  });

  it("validates art/production/development/v001/manifest.json provenance and SHA-256 checksums", () => {
    const manifestPath = "art/production/development/v001/manifest.json";
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.optInSwitch).toBe("ki-dev-art");
    expect(manifest.assets.length).toBe(38);

    for (const asset of manifest.assets) {
      const origPath =
        asset.provenance.originalPath ??
        `art/production/development/v001/originals/${asset.id}.v001.orig.jpg`;
      expect(existsSync(origPath), origPath).toBe(true);
      expect(sha256File(origPath)).toBe(asset.provenance.originalSha256);

      expect(existsSync(asset.master.path), asset.master.path).toBe(true);
      expect(sha256File(asset.master.path)).toBe(asset.master.sha256);
      expect(asset.master.alphaVerified).toBe(true);

      const clientFile = "public" + asset.client.url;
      expect(existsSync(clientFile), clientFile).toBe(true);
      expect(sha256File(clientFile)).toBe(asset.client.sha256);

      if (asset.kind === "icon") {
        expect(asset.master.dimensions).toEqual([512, 512]);
        expect(asset.client.dimensions).toEqual([128, 128]);
      } else {
        expect(asset.master.dimensions).toEqual([1024, 1024]);
        expect(asset.client.dimensions).toEqual([512, 512]);
      }
    }
  });

  it("validates art/production/development/v001/audio-manifest.json provenance and SHA-256 checksums for all 41 audio items", () => {
    const audioManifestPath = "art/production/development/v001/audio-manifest.json";
    expect(existsSync(audioManifestPath)).toBe(true);
    const raw = readFileSync(audioManifestPath, "utf8");
    expect(raw.includes("sk_")).toBe(false);

    const manifest = JSON.parse(raw);
    expect(manifest.model).toBe("eleven_text_to_sound_v2");
    expect(manifest.totalCatalogItems).toBe(41);
    expect(manifest.generatedCount).toBe(41);
    expect(manifest.items.length).toBe(41);

    for (const item of manifest.items) {
      expect(existsSync(item.originalPath), item.originalPath).toBe(true);
      expect(existsSync(item.clientPath), item.clientPath).toBe(true);
      expect(sha256File(item.originalPath)).toBe(item.sha256);
      expect(sha256File(item.clientPath)).toBe(item.sha256);
      expect(item.bytes).toBeGreaterThan(1000);
    }
  });
});
