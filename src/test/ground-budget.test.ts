import { describe, expect, it } from "vitest";
import {
  GROUND_CHUNK_LIMIT,
  GROUND_RESOLUTIONS,
  chooseGroundResolution,
  groundTextureBytes,
} from "../game/assets/groundBudget";
import { STREAM_TEXTURE_BUDGET_BYTES } from "../game/assets/streamBudget";

const MiB = 1024 * 1024;

describe("budżet warstwy podłoża (audyt 11.11.2026)", () => {
  it("zna prawdziwy koszt podłoża, którego stary licznik nie widział", () => {
    // 12 chunków × 1024² × 4 B = 48 MiB — dokładnie tyle brakowało w rachunku tekstur.
    expect(groundTextureBytes(1024) / MiB).toBe(48);
    expect(groundTextureBytes(512) / MiB).toBe(12);
    expect(GROUND_CHUNK_LIMIT).toBe(12);
  });

  it("przy pustym budżecie atlasów piecze w pełnej rozdzielczości", () => {
    expect(chooseGroundResolution(0, 1024)).toBe(1024);
  });

  it("obniża rozdzielczość, gdy atlasy wypychają podłoże ponad sufit", () => {
    // 150 MiB atlasów + 48 MiB podłoża = 198 MiB > 192 → musi zejść niżej.
    expect(chooseGroundResolution(150 * MiB, 1024)).toBeLessThan(1024);
    const res = chooseGroundResolution(150 * MiB, 1024);
    expect(150 * MiB + groundTextureBytes(res)).toBeLessThanOrEqual(STREAM_TEXTURE_BUDGET_BYTES);
  });

  it("nigdy nie przekracza sufitu, chyba że nie mieści się nawet najtańsze podłoże", () => {
    for (const atlasMiB of [0, 40, 80, 120, 140, 150, 160, 170, 180]) {
      const res = chooseGroundResolution(atlasMiB * MiB, 1024);
      const total = atlasMiB * MiB + groundTextureBytes(res);
      if (atlasMiB * MiB + groundTextureBytes(512) <= STREAM_TEXTURE_BUDGET_BYTES)
        expect(total).toBeLessThanOrEqual(STREAM_TEXTURE_BUDGET_BYTES);
      else expect(res).toBe(512);
    }
  });

  it("nie podnosi rozdzielczości ponad preferowaną", () => {
    expect(chooseGroundResolution(0, 512)).toBe(512);
    for (const res of GROUND_RESOLUTIONS) expect(res).toBeLessThanOrEqual(1024);
  });

  it("suma atlasów i podłoża mieści się w suficie dla zmierzonych światów", () => {
    // Audyt zmierzył 198–240 MiB całości. Po korekcie podłoże dobiera się do reszty budżetu,
    // więc nawet ciężki świat (170 MiB atlasów) nie wychodzi ponad sufit.
    const atlasBytes = 170 * MiB;
    const res = chooseGroundResolution(atlasBytes, 1024);
    expect(atlasBytes + groundTextureBytes(res)).toBeLessThanOrEqual(STREAM_TEXTURE_BUDGET_BYTES);
  });
});
