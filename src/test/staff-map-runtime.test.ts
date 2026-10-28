/** Real generated navigation/save pipeline; staff role is a unit fixture, not a real login. */
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { prepareSuperior } from "../game/world/generated/superiorRuntime";
import { loadBrowserFeature } from "../game/world/generated/browserLoader";
import { SuperiorSaveStore } from "../game/world/generated/superiorSave";
afterEach(() => vi.unstubAllGlobals());
it("authorizes GM map teleport, checks real collision data, cancels, and persists another land", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const pathname = new URL(String(input), "https://qa.invalid").pathname;
    if (!pathname.startsWith("/game/worlds/")) throw Error("Unexpected QA URL");
    return new Response(readFileSync("public" + pathname, "utf8"), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const runtime = await prepareSuperior({
    race: "planetary",
    saveKey: "qa-map-staff-unit",
    signal: new AbortController().signal,
    onLoading: () => {},
  });
  try {
    const p = runtime.session.player;
    const before = { x: p.x, y: p.y };
    const count = fetcher.mock.calls.length;
    expect(await runtime.staffTeleport("aether", { x: 100, y: 100 })).toBe(false);
    expect(fetcher.mock.calls.length).toBe(count);
    expect(p).toMatchObject(before);
    runtime.session.staff = "gm";
    const point = runtime.session.nav.safe({ x: p.x + 128, y: p.y + 128 });
    expect(await runtime.staffTeleport("verdant", point)).toBe(true);
    expect(p).toMatchObject(point);
    expect(await runtime.staffTeleport("verdant", { x: -1, y: -1 })).toBe(false);
    expect(await runtime.staffTeleport("verdant", { x: NaN, y: 100 })).toBe(false);
    const cancelled = new AbortController();
    cancelled.abort();
    expect(await runtime.staffTeleport("aether", point, cancelled.signal)).toBe(false);
    expect(p).toMatchObject(point);
    p.dead = true;
    expect(await runtime.staffTeleport("verdant", point)).toBe(false);
    p.dead = false;
    const next = runtime.index.features.find((f) => f.id === "aether")!;
    const loader = await loadBrowserFeature("/game/worlds/superior-v1", "aether");
    const destination = loader.navigation.safe({ x: next.arrival.x + 64, y: next.arrival.y + 64 });
    const cancelDuringLoad = new AbortController();
    const cancelledJump = runtime.staffTeleport("aether", destination, cancelDuringLoad.signal);
    cancelDuringLoad.abort();
    expect(await cancelledJump).toBe(false);
    expect(runtime.save.feature).toBe("verdant");
    const revokedJump = runtime.staffTeleport("aether", destination);
    runtime.session.staff = null;
    expect(await revokedJump).toBe(false);
    expect(runtime.save.feature).toBe("verdant");
    runtime.session.staff = "gm";
    expect(await runtime.staffTeleport("aether", destination)).toBe(true);
    expect(runtime.save.save(p)).toBe(false); // The outgoing scene cannot restore its old location.
    const reloaded = new SuperiorSaveStore(
      window.localStorage,
      "qa-map-staff-unit",
      runtime.index,
      "verdant",
    );
    expect(reloaded.load()).toMatchObject({ ...destination, race: "planetary" });
    expect(reloaded.feature).toBe("aether");
  } finally {
    runtime.dispose?.();
    window.localStorage.removeItem("qa-map-staff-unit");
  }
}, 30_000);
