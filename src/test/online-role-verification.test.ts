// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { accountRole } from "../server/characters/auth";
const config = { url: "https://fixture.supabase.co", publishableKey: "fixture-publishable-key" };
const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllGlobals());
it("uses protected role rows, does not grant staff to an ordinary account", async () => {
  const call = vi.fn(async (_input: string | URL) => new Response("[]"));
  vi.stubGlobal("fetch", call);
  expect(await accountRole(config, "fixture-token", id)).toBeUndefined();
  const url = new URL(call.mock.calls[0]![0] as unknown as URL);
  expect(url.searchParams.get("user_id")).toBe("eq." + id);
});
it("validates admin from protected rows", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response(JSON.stringify([{ role: "gm" }, { role: "admin" }])),
  );
  expect(await accountRole(config, "fixture-token", id)).toBe("admin");
});
it("a failure or malformed role fails closed", async () => {
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
  await expect(accountRole(config, "fixture-token", id)).rejects.toThrow();
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify([{ role: "owner" }])));
  await expect(accountRole(config, "fixture-token", id)).rejects.toThrow();
});
