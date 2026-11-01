import { afterEach, expect, it, vi } from "vitest";
import { accountVerifier } from "../server/characters/auth";
afterEach(() => vi.unstubAllGlobals());
const config = { url: "https://accounts.example.test", publishableKey: "public-test-key" };
it("obtains ownership from the verified authority, never from a supplied account ID", async () => {
  const subject = "117b2f07-f6c6-44cf-8fe4-57954878263e";
  const request = vi.fn(
    async (_url: string | URL | Request) => new Response(JSON.stringify({ id: subject })),
  );
  vi.stubGlobal("fetch", request);
  expect(await accountVerifier(config)("fixture-bearer-token")).toEqual({
    project: config.url,
    subject,
  });
  expect(request.mock.calls[0]?.[0]).toBe(config.url + "/auth/v1/user");
});
it("rejects unverified, anonymous and malformed tokens", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 401 })),
  );
  await expect(accountVerifier(config)("fixture-bearer-token")).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "117b2f07-f6c6-44cf-8fe4-57954878263e", is_anonymous: true }),
        ),
    ),
  );
  await expect(accountVerifier(config)("fixture-bearer-token")).rejects.toThrow();
  await expect(accountVerifier(config)(undefined)).rejects.toThrow();
});
it("fails closed on authority outage and insecure configuration", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw Error("authority unavailable");
    }),
  );
  await expect(accountVerifier(config)("fixture-bearer-token")).rejects.toThrow();
  expect(() => accountVerifier({ ...config, url: "http://accounts.example.test" })).toThrow();
});
