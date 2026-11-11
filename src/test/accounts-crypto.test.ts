// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  newToken,
  signAccess,
  signingKey,
  tokenHash,
  verifyAccess,
  verifyPassword,
} from "../server/accounts/crypto";
import { confirmationMail, resendMailer } from "../server/accounts/mailer";
import { RateLimiter } from "../server/accounts/http";

describe("account crypto", () => {
  it("hashes passwords with scrypt and verifies only the right one", async () => {
    const hash = await hashPassword("tajne-haslo-123");
    expect(hash.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("tajne-haslo-123", hash)).toBe(true);
    expect(await verifyPassword("inne-haslo-123", hash)).toBe(false);
    expect(await hashPassword("tajne-haslo-123")).not.toBe(hash);
  });

  it("signs short-lived access tokens and rejects tampering, expiry and other keys", () => {
    const key = Buffer.alloc(32, 7);
    const now = Date.UTC(2026, 10, 2);
    const token = signAccess("2f0c8a2e-1111-4a6b-9c1d-000000000001", key, 900, now);
    expect(verifyAccess(token, key, now)?.sub).toBe("2f0c8a2e-1111-4a6b-9c1d-000000000001");
    expect(verifyAccess(token, key, now + 901_000)).toBeNull();
    expect(verifyAccess(token, Buffer.alloc(32, 8), now)).toBeNull();
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "x", iat: 0, exp: 9e9, typ: "access" }),
    ).toString("base64url");
    expect(verifyAccess([h, forged, s].join("."), key, now)).toBeNull();
    expect(verifyAccess("not-a-token", key, now)).toBeNull();
  });

  it("derives a stable signing key from the private database URL when no secret is set", () => {
    const env = { DATABASE_URL: "postgres://u:p@db:5432/x" } as NodeJS.ProcessEnv;
    expect(signingKey(env).equals(signingKey(env))).toBe(true);
    expect(signingKey({ ...env, AUTH_TOKEN_SECRET: "x".repeat(40) }).toString()).toBe(
      "x".repeat(40),
    );
    expect(() => signingKey({} as NodeJS.ProcessEnv)).toThrow("AUTH_NOT_CONFIGURED");
  });

  it("stores only token hashes; tokens are random", () => {
    const a = newToken();
    expect(a).not.toBe(newToken());
    expect(tokenHash(a)).toHaveLength(32);
  });
});

describe("account mail", () => {
  it("is unconfigured without a Resend key and sends through the Resend API with one", async () => {
    expect(resendMailer({} as NodeJS.ProcessEnv).configured).toBe(false);
    const calls: { url: string; init: RequestInit }[] = [];
    const mailer = resendMailer(
      { RESEND_API_KEY: "re_test", EMAIL_FROM: "Ki <konto@kilegends.pl>" } as NodeJS.ProcessEnv,
      (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    );
    await mailer.send(
      confirmationMail("gracz@example.com", "Gracz", "https://kilegends.pl/konto?aktywacja=abc"),
    );
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer re_test",
    );
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.to).toEqual(["gracz@example.com"]);
    expect(body.html).toContain("aktywacja=abc");
  });

  it("escapes player-provided text in the e-mail", () => {
    expect(confirmationMail("a@b.pl", "<script>", "https://x").html).not.toContain("<script>");
  });
});

describe("rate limiter", () => {
  it("allows the limit within a window and resets afterwards", () => {
    const r = new RateLimiter(2, 1000);
    expect([r.allow("k", 0), r.allow("k", 1), r.allow("k", 2)]).toEqual([true, true, false]);
    expect(r.allow("k", 1001)).toBe(true);
  });

  it("forgets a key on reset, so a successful login clears earlier failed attempts", () => {
    const r = new RateLimiter(2, 1000);
    expect([r.allow("k", 0), r.allow("k", 1), r.allow("k", 2)]).toEqual([true, true, false]);
    r.reset("k");
    expect(r.allow("k", 3)).toBe(true);
  });
});
