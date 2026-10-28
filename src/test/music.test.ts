import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { trackFor } from "../game/music";

describe("background music", () => {
  it("plays each continent's own theme and the loading theme elsewhere", () => {
    expect(["verdant", "aether", "nexus", "pyra"].map(trackFor)).toEqual([
      "verdant",
      "aether",
      "nexus",
      "pyra",
    ]);
    expect(trackFor(undefined)).toBe("loading");
    expect(trackFor("island-1")).toBe("loading");
  });

  it("serves the owner's recordings byte for byte (muzyka/README.md checksums)", () => {
    const sums: Record<string, string> = {
      "loadings.mp3": "4909dcc4c5a321fef44c93a03f5eec7572f908dafe01efdbe7f82185466eb4cc",
      "verdantia.mp3": "2ef13be01cbb0c835f82131df7bb9fb3c160dd4feaa562f1c9d330800ae4a310",
      "pyra.mp3": "35f9bcd14a7c54864ede23fcc7cfad4efc117ebd7dec722baaa095684b064ae0",
      "aetheria.mp3": "ce6eb3e8c0dd8603d831b80ecfa86f5b8457f89cc518d457022cab9bd135d561",
      "nexus.mp3": "30c45febb32f4e91c6d77f1ed522020abd0584173b962a54c44eb8704621685c",
    };
    for (const [file, sum] of Object.entries(sums))
      expect(
        createHash("sha256")
          .update(readFileSync("public/game/music/" + file))
          .digest("hex"),
      ).toBe(sum);
  });
});
