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
    for (const kind of ["dummy", "target", "ki-node", "defense"] as const) {
      const url = trainingObjectUrl("verdant", kind);
      expect(url).toBeDefined();
      expect(existsSync("public" + url!), `verdant.${kind}: ${url}`).toBe(true);
    }
  });

  it("validates art/production/development/v001/manifest.json provenance and SHA-256 checksums", () => {
    const manifestPath = "art/production/development/v001/manifest.json";
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.optInSwitch).toBe("ki-dev-art");
    expect(manifest.assets.length).toBe(11);

    for (const asset of manifest.assets) {
      const origPath = `art/production/development/v001/originals/${asset.id}.v001.orig.jpg`;
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
});
