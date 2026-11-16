// @vitest-environment node
/**
 * The sign-in log: every attempt is recorded with the real reason (the player only ever hears "wrong e-mail or password"), the password is never recorded,
 * and a failure to write the log never changes the answer of the sign-in.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { accountHttp } from "../server/accounts/http";
import { AccountError, type AccountService } from "../server/accounts/service";

type Recorded = {
  ok: boolean;
  email: unknown;
  reason: string;
  ip: string | undefined;
  ua: string | undefined;
};

function fakeService(outcome: "ok" | "wrong"): { service: AccountService; log: Recorded[] } {
  const log: Recorded[] = [];
  const service = {
    mailConfigured: true,
    async login(input: { email: unknown; password: unknown }, userAgent?: string, ip?: string) {
      // what the real service does: it records, then answers
      log.push({
        ok: outcome === "ok",
        email: input.email,
        reason: outcome === "ok" ? "OK" : "ZLE_HASLO",
        ip,
        ua: userAgent,
      });
      if (outcome === "wrong") throw new AccountError("INVALID_CREDENTIALS");
      return { accessToken: "a", refreshToken: "r", account: { id: "1" } };
    },
    async recordLogin(
      ok: boolean,
      email: unknown,
      trace: { reason: string },
      userAgent?: string,
      ip?: string,
    ) {
      log.push({ ok, email, reason: trace.reason, ip, ua: userAgent });
    },
  } as unknown as AccountService;
  return { service, log };
}

async function post(service: AccountService, body: unknown, headers: Record<string, string> = {}) {
  const server = createServer((req, res) => void accountHttp(req, res, service));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ws/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  } finally {
    server.close();
  }
}

describe("sign-in log", () => {
  it("passes the device and the address to the service, and the answer stays the plain one", async () => {
    const { service, log } = fakeService("wrong");
    const result = await post(
      service,
      { email: "gracz@example.pl", password: "tajne-haslo" },
      { "User-Agent": "GodotEngine/4.6.3 (Android)", "X-Forwarded-For": "203.0.113.9" },
    );
    expect(result.status).toBe(401);
    expect(result.json["message"]).toBe("Nieprawidłowy e-mail lub hasło.");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      ok: false,
      email: "gracz@example.pl",
      reason: "ZLE_HASLO",
      ip: "203.0.113.9",
      ua: "GodotEngine/4.6.3 (Android)",
    });
    expect(JSON.stringify(log)).not.toContain("tajne-haslo"); // the password never reaches the log
  });

  it("logs a blocked attempt (too many tries for one e-mail) as LIMIT_PROB", async () => {
    const { service, log } = fakeService("wrong");
    for (let i = 0; i < 12; i++)
      await post(
        service,
        { email: "limit@example.pl", password: "zle-haslo-1" },
        { "X-Forwarded-For": "198.51.100." + i },
      );
    expect(log.filter((l) => l.reason === "LIMIT_PROB").length).toBeGreaterThan(0);
    expect(log.every((l) => l.email === "limit@example.pl")).toBe(true);
  });
});

describe("AccountService.recordLogin", () => {
  it("never throws, even when the database refuses the write", async () => {
    const { AccountService: Real } = await import("../server/accounts/service");
    const failing = Object.assign(
      vi.fn(async () => {
        throw new Error("permission denied");
      }),
      { json: (v: unknown) => v },
    );
    const service = Object.create(Real.prototype) as InstanceType<typeof Real>;
    (service as unknown as { o: unknown }).o = { sql: failing };
    await expect(
      service.recordLogin(false, "a@b.pl", { reason: "ZLE_HASLO", userId: null }, "ua", "1.2.3.4"),
    ).resolves.toBeUndefined();
  });
});
