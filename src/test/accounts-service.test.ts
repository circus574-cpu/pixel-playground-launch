// @vitest-environment node
/**
 * Full account flow against a real PostgreSQL with the 001 + 005 migrations applied.
 * Runs when KI_ACCOUNTS_TEST_DATABASE_URL is set (online-server-qa workflow, local QA);
 * the default quality gate has no database and skips it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { AccountError, AccountService } from "../server/accounts/service";
import type { Mail, Mailer } from "../server/accounts/mailer";

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];

describe.runIf(url)("accounts on PostgreSQL", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 2 });
  const outbox: Mail[] = [];
  const mailer: Mailer = { configured: true, send: async (m) => void outbox.push(m) };
  const legacyCalls: string[] = [];
  const legacyId = "7a1e3b2c-0000-4c1d-9e2f-0000000000aa";
  const legacy = {
    url: "https://legacy.example.supabase.co",
    publishableKey: "pk",
    http: (async (input: string, init?: RequestInit) => {
      legacyCalls.push(input);
      if (input.includes("/auth/v1/token")) {
        const body = JSON.parse(String(init?.body));
        if (body.password !== "stare-haslo-1") return new Response("{}", { status: 400 });
        return Response.json({
          access_token: "legacy-token",
          user: { id: legacyId, email: body.email, email_confirmed_at: "2026-10-01T00:00:00Z" },
        });
      }
      if (input.includes("/profiles")) return Response.json([{ nick: "Weteran" }]);
      if (input.includes("/user_roles")) return Response.json([{ role: "admin" }]);
      return new Response("[]", { status: 404 });
    }) as typeof fetch,
  };
  const service = new AccountService({
    sql,
    mailer,
    key: Buffer.alloc(32, 3),
    publicUrl: "https://kilegends.pl",
    realm: "https://legacy.example.supabase.co",
    legacy,
  });
  const linkToken = (m: Mail, param: string) =>
    decodeURIComponent(new RegExp(param + '=([^"&\\s]+)').exec(m.text)![1]!);

  beforeAll(async () => {
    await sql`TRUNCATE accounts.audit, accounts.sessions, accounts.email_tokens, accounts.roles, accounts.users`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("registers an inactive account, refuses login until the e-mail link is used", async () => {
    await service.register({ email: "Nowy@Example.com", password: "haslo-12345", nick: "Nowy" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("nowy@example.com");
    await expect(
      service.login({ email: "nowy@example.com", password: "haslo-12345" }),
    ).rejects.toMatchObject({
      code: "EMAIL_NOT_CONFIRMED",
    });
    const session = await service.confirm(linkToken(outbox[0]!, "aktywacja"));
    expect(session.account).toMatchObject({ email: "nowy@example.com", nick: "Nowy", roles: [] });
    expect(service.subjectOf(session.accessToken)).toBe(session.account.id);
    await expect(service.confirm(linkToken(outbox[0]!, "aktywacja"))).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("logs in, rotates refresh tokens and logs out", async () => {
    await expect(
      service.login({ email: "nowy@example.com", password: "zle-haslo-1" }),
    ).rejects.toBeInstanceOf(AccountError);
    const s1 = await service.login({ email: "nowy@example.com", password: "haslo-12345" });
    const s2 = await service.refresh(s1.refreshToken);
    await expect(service.refresh(s1.refreshToken)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await service.logout(s2.refreshToken);
    await expect(service.refresh(s2.refreshToken)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("refuses a taken nick and a taken e-mail", async () => {
    await expect(
      service.register({ email: "inny@example.com", password: "haslo-12345", nick: "nowy" }),
    ).rejects.toMatchObject({ code: "NICK_TAKEN" });
    await expect(
      service.register({ email: "nowy@example.com", password: "haslo-12345", nick: "Inny" }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("resets a forgotten password by e-mail and ends old sessions", async () => {
    const old = await service.login({ email: "nowy@example.com", password: "haslo-12345" });
    outbox.length = 0;
    await service.forgotPassword("nowy@example.com");
    const session = await service.resetPassword({
      token: linkToken(outbox[0]!, "nowe-haslo"),
      password: "nowe-haslo-99",
    });
    expect(session.account.email).toBe("nowy@example.com");
    await expect(service.refresh(old.refreshToken)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    await service.login({ email: "nowy@example.com", password: "nowe-haslo-99" });
  });

  it("moves an account of the previous authority on first login: same id, nick and roles", async () => {
    await expect(
      service.login({ email: "weteran@example.com", password: "zle-haslo-1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const session = await service.login({
      email: "weteran@example.com",
      password: "stare-haslo-1",
    });
    expect(session.account).toMatchObject({ id: legacyId, nick: "Weteran", roles: ["admin"] });
    legacyCalls.length = 0;
    await service.login({ email: "weteran@example.com", password: "stare-haslo-1" });
    expect(legacyCalls).toEqual([]);
  });

  it("lets an admin grant and revoke roles, but not remove their own admin role", async () => {
    const [nowy] = await service.listAccounts("nowy");
    await service.setRole(legacyId, nowy!.id, "gm", true);
    expect(await service.roles(nowy!.id)).toEqual(["gm"]);
    await service.setRole(legacyId, nowy!.id, "gm", false);
    expect(await service.roles(nowy!.id)).toEqual([]);
    await expect(service.setRole(legacyId, legacyId, "admin", false)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const audit = await service.auditLog();
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        "REGISTER",
        "CONFIRM_EMAIL",
        "MIGRATE_ACCOUNT",
        "GRANT_ROLE",
        "REVOKE_ROLE",
      ]),
    );
  });
});
