import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../components/planet-map/mapData", () => ({ ATLAS_V2: true }));
vi.mock("../components/planet-map/PlanetGlobe", () => ({
  preloadGlobeTextures: vi.fn(async () => undefined),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
beforeEach(() => vi.resetModules());

describe("game map preparation", () => {
  it("shares decoding between preload and opening the map", async () => {
    const decode = vi.fn(async () => undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = decode;
      },
    );
    const { decodedImage } = await import("../components/planet-map/preload");
    const first = decodedImage("/atlas.webp");
    expect(decodedImage("/atlas.webp")).toBe(first);
    await first;
    expect(decode).toHaveBeenCalledTimes(1);
  });
  it("retries a broken download instead of permanently poisoning the cache", async () => {
    const decode = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue(undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = decode;
      },
    );
    const { decodedImage } = await import("../components/planet-map/preload");
    await expect(decodedImage("/broken.webp")).rejects.toThrow("offline");
    await expect(decodedImage("/broken.webp")).resolves.toBeDefined();
    expect(decode).toHaveBeenCalledTimes(2);
  });
  it("bounds retained detailed terrain images and keeps recently used lands", async () => {
    const decode = vi.fn(async () => undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = decode;
      },
    );
    const { decodedImage } = await import("../components/planet-map/preload");
    await decodedImage("/a", true);
    const b = decodedImage("/b", true);
    await b;
    await decodedImage("/c", true);
    expect(decodedImage("/b", true)).toBe(b);
    await decodedImage("/a", true);
    expect(decode).toHaveBeenCalledTimes(4);
  });
  it("does not prevent gameplay when map images fail", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = async () => {
          throw Error("offline");
        };
      },
    );
    const { prepareGameMap } = await import("../components/planet-map/preload");
    await expect(prepareGameMap("verdant")).resolves.toBeUndefined();
  });
  it("does not wait indefinitely for an unresponsive map server", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = () => new Promise(() => {});
      },
    );
    const { prepareGameMap } = await import("../components/planet-map/preload");
    const done = vi.fn();
    const work = prepareGameMap("verdant").then(done);
    await vi.advanceTimersByTimeAsync(12_000);
    await work;
    expect(done).toHaveBeenCalledTimes(1);
  });
});
