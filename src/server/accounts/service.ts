import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import {
  hashPassword,
  newToken,
  signAccess,
  tokenHash,
  verifyAccess,
  verifyPassword,
} from "./crypto";
import { confirmationMail, resetMail, type Mailer } from "./mailer";

export type Role = "admin" | "gm";
export type AccountView = {
  id: string;
  email: string;
  nick: string;
  roles: Role[];
  createdAt: string;
  lastLoginAt: string | null;
};
export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  account: AccountView;
};

export class AccountError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "EMAIL_TAKEN"
      | "NICK_TAKEN"
      | "INVALID_CREDENTIALS"
      | "EMAIL_NOT_CONFIRMED"
      | "ACCOUNT_DISABLED"
      | "INVALID_TOKEN"
      | "MAIL_NOT_CONFIGURED"
      | "FORBIDDEN",
    message = code,
  ) {
    super(message);
  }
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(200);
export const nickSchema = z
  .string()
  .trim()
  .regex(/^[\p{L}\p{N}_-]{3,20}$/u);

const ACCESS_TTL = 900;
const REFRESH_DAYS = 30;

type UserRow = {
  id: string;
  email: string;
  nick: string;
  password_hash: string;
  email_confirmed_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
  disabled_at: Date | null;
};

/** The previous account authority: used once per player to move the account to the VPS. */
export type LegacyAuthority = {
  url: string;
  publishableKey: string;
  http?: typeof fetch;
};

export type AccountServiceOptions = {
  sql: Sql;
  mailer: Mailer;
  key: Buffer;
  /** Public site origin used in e-mail links, e.g. https://kilegends.pl */
  publicUrl: string;
  /** Principal "project" of every account; equal to the legacy authority so characters stay linked. */
  realm: string;
  legacy?: LegacyAuthority | undefined;
};

export class AccountService {
  constructor(private readonly o: AccountServiceOptions) {}

  get realm() {
    return this.o.realm;
  }
  get mailConfigured() {
    return this.o.mailer.configured;
  }

  async ready() {
    await this.o.sql`SELECT version FROM accounts.schema_version LIMIT 1`;
  }

  /** Creates an inactive account and sends the activation link. */
  async register(input: { email: unknown; password: unknown; nick: unknown }) {
    const email = emailSchema.parse(input.email);
    const password = passwordSchema.parse(input.password);
    const nick = nickSchema.parse(input.nick);
    if (!this.o.mailer.configured) throw new AccountError("MAIL_NOT_CONFIGURED");
    const sql = this.o.sql;
    const [existing] = await sql<UserRow[]>`
      SELECT * FROM accounts.users WHERE lower(email) = ${email}`;
    if (existing?.email_confirmed_at) throw new AccountError("EMAIL_TAKEN");
    const [nickOwner] = await sql<{ id: string }[]>`
      SELECT id FROM accounts.users WHERE lower(nick) = lower(${nick})`;
    if (nickOwner && nickOwner.id !== existing?.id) throw new AccountError("NICK_TAKEN");
    const hash = await hashPassword(password);
    const id = existing?.id ?? randomUUID();
    if (existing)
      await sql`UPDATE accounts.users SET nick = ${nick}, password_hash = ${hash} WHERE id = ${id}`;
    else
      await sql`INSERT INTO accounts.users (id, email, nick, password_hash)
                VALUES (${id}, ${email}, ${nick}, ${hash})`;
    await this.sendConfirmation(id, email, nick);
    await this.audit(id, "REGISTER", id, { email });
    return { id, email, nick };
  }

  private async sendConfirmation(userId: string, email: string, nick: string) {
    const token = newToken();
    await this.o.sql`
      INSERT INTO accounts.email_tokens (token_hash, user_id, purpose, expires_at)
      VALUES (${tokenHash(token)}, ${userId}, 'confirm', now() + interval '24 hours')`;
    const link = `${this.o.publicUrl}/konto?aktywacja=${encodeURIComponent(token)}`;
    await this.o.mailer.send(confirmationMail(email, nick, link));
  }

  /** Activation link → account active and signed in. */
  async confirm(token: unknown, userAgent?: string): Promise<Session> {
    const userId = await this.useEmailToken(token, "confirm");
    await this.o
      .sql`UPDATE accounts.users SET email_confirmed_at = coalesce(email_confirmed_at, now())
                     WHERE id = ${userId}`;
    await this.audit(userId, "CONFIRM_EMAIL", userId, null);
    return this.startSession(userId, userAgent);
  }

  async resendConfirmation(emailInput: unknown) {
    const email = emailSchema.parse(emailInput);
    if (!this.o.mailer.configured) throw new AccountError("MAIL_NOT_CONFIGURED");
    const [user] = await this.o.sql<UserRow[]>`
      SELECT * FROM accounts.users WHERE lower(email) = ${email}`;
    if (user && !user.email_confirmed_at)
      await this.sendConfirmation(user.id, user.email, user.nick);
  }

  async login(input: { email: unknown; password: unknown }, userAgent?: string): Promise<Session> {
    const email = emailSchema.parse(input.email);
    const password = passwordSchema.safeParse(input.password);
    if (!password.success) throw new AccountError("INVALID_CREDENTIALS");
    const [user] = await this.o.sql<UserRow[]>`
      SELECT * FROM accounts.users WHERE lower(email) = ${email}`;
    if (!user) {
      const migrated = await this.migrateLegacy(email, password.data);
      if (!migrated) throw new AccountError("INVALID_CREDENTIALS");
      return this.startSession(migrated, userAgent);
    }
    if (!(await verifyPassword(password.data, user.password_hash)))
      throw new AccountError("INVALID_CREDENTIALS");
    if (user.disabled_at) throw new AccountError("ACCOUNT_DISABLED");
    if (!user.email_confirmed_at) throw new AccountError("EMAIL_NOT_CONFIRMED");
    return this.startSession(user.id, userAgent);
  }

  /**
   * First sign-in of a player registered with the previous authority: the same e-mail and
   * password are checked there once, then the account (same id, nick, roles) moves to the VPS.
   */
  private async migrateLegacy(email: string, password: string): Promise<string | null> {
    const legacy = this.o.legacy;
    if (!legacy?.url || !legacy.publishableKey) return null;
    const http = legacy.http ?? fetch;
    const origin = new URL(legacy.url).origin;
    const response = await http(origin + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: legacy.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) return null;
    const data = z
      .object({
        access_token: z.string(),
        user: z.object({
          id: z.string().uuid(),
          email: z.string(),
          email_confirmed_at: z.string().nullable().optional(),
          user_metadata: z.object({ nick: z.string().optional() }).passthrough().optional(),
        }),
      })
      .parse(await response.json());
    const auth = { apikey: legacy.publishableKey, Authorization: "Bearer " + data.access_token };
    const rest = async <T>(path: string, schema: z.ZodType<T>): Promise<T | null> => {
      const r = await http(origin + path, { headers: auth, signal: AbortSignal.timeout(8000) });
      return r.ok ? schema.parse(await r.json()) : null;
    };
    const id = data.user.id;
    const profile = await rest(
      `/rest/v1/profiles?select=nick&id=eq.${id}`,
      z.array(z.object({ nick: z.string() })),
    );
    const roles =
      (await rest(
        `/rest/v1/user_roles?select=role&user_id=eq.${id}`,
        z.array(z.object({ role: z.string() })),
      )) ?? [];
    let nick = profile?.[0]?.nick ?? data.user.user_metadata?.nick ?? email.split("@")[0]!;
    if (!nickSchema.safeParse(nick).success) nick = "Gracz-" + id.slice(0, 8);
    const sql = this.o.sql;
    const [taken] = await sql<{ id: string }[]>`
      SELECT id FROM accounts.users WHERE lower(nick) = lower(${nick}) AND id <> ${id}`;
    if (taken) nick = (nick.slice(0, 11) + "-" + id.slice(0, 8)).slice(0, 20);
    const hash = await hashPassword(password);
    await sql`
      INSERT INTO accounts.users (id, email, nick, password_hash, email_confirmed_at, migrated_from)
      VALUES (${id}, ${email}, ${nick}, ${hash}, now(), ${origin})
      ON CONFLICT (id) DO NOTHING`;
    for (const r of roles)
      if (r.role === "admin" || r.role === "gm")
        await sql`INSERT INTO accounts.roles (user_id, role) VALUES (${id}, ${r.role})
                  ON CONFLICT DO NOTHING`;
    await this.audit(id, "MIGRATE_ACCOUNT", id, { from: origin, roles: roles.map((r) => r.role) });
    return id;
  }

  async forgotPassword(emailInput: unknown) {
    const email = emailSchema.parse(emailInput);
    if (!this.o.mailer.configured) throw new AccountError("MAIL_NOT_CONFIGURED");
    const [user] = await this.o.sql<UserRow[]>`
      SELECT * FROM accounts.users WHERE lower(email) = ${email}`;
    if (!user || user.disabled_at) return;
    const token = newToken();
    await this.o.sql`
      INSERT INTO accounts.email_tokens (token_hash, user_id, purpose, expires_at)
      VALUES (${tokenHash(token)}, ${user.id}, 'reset', now() + interval '1 hour')`;
    const link = `${this.o.publicUrl}/konto?nowe-haslo=${encodeURIComponent(token)}`;
    await this.o.mailer.send(resetMail(user.email, link));
  }

  /** New password from a reset link; ends every other session. */
  async resetPassword(input: { token: unknown; password: unknown }, userAgent?: string) {
    const password = passwordSchema.parse(input.password);
    const userId = await this.useEmailToken(input.token, "reset");
    const hash = await hashPassword(password);
    await this.o.sql`UPDATE accounts.users
      SET password_hash = ${hash}, email_confirmed_at = coalesce(email_confirmed_at, now())
      WHERE id = ${userId}`;
    await this.o.sql`UPDATE accounts.sessions SET revoked_at = now()
      WHERE user_id = ${userId} AND revoked_at IS NULL`;
    await this.audit(userId, "RESET_PASSWORD", userId, null);
    return this.startSession(userId, userAgent);
  }

  private async useEmailToken(token: unknown, purpose: "confirm" | "reset"): Promise<string> {
    const value = z.string().min(20).max(200).safeParse(token);
    if (!value.success) throw new AccountError("INVALID_TOKEN");
    const [row] = await this.o.sql<{ user_id: string }[]>`
      UPDATE accounts.email_tokens SET used_at = now()
      WHERE token_hash = ${tokenHash(value.data)} AND purpose = ${purpose}
        AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`;
    if (!row) throw new AccountError("INVALID_TOKEN");
    return row.user_id;
  }

  private async startSession(userId: string, userAgent?: string): Promise<Session> {
    const refreshToken = newToken();
    await this.o.sql`
      INSERT INTO accounts.sessions (token_hash, user_id, expires_at, user_agent)
      VALUES (${tokenHash(refreshToken)}, ${userId},
              now() + make_interval(days => ${REFRESH_DAYS}), ${(userAgent ?? "").slice(0, 200)})`;
    await this.o.sql`UPDATE accounts.users SET last_login_at = now() WHERE id = ${userId}`;
    return {
      accessToken: signAccess(userId, this.o.key, ACCESS_TTL),
      refreshToken,
      expiresIn: ACCESS_TTL,
      account: await this.view(userId),
    };
  }

  /** Rotates the refresh token: the old one stops working. */
  async refresh(token: unknown, userAgent?: string): Promise<Session> {
    const value = z.string().min(20).max(200).safeParse(token);
    if (!value.success) throw new AccountError("INVALID_TOKEN");
    const [row] = await this.o.sql<{ user_id: string }[]>`
      UPDATE accounts.sessions s SET revoked_at = now()
      FROM accounts.users u
      WHERE s.token_hash = ${tokenHash(value.data)} AND s.revoked_at IS NULL
        AND s.expires_at > now() AND u.id = s.user_id AND u.disabled_at IS NULL
      RETURNING s.user_id`;
    if (!row) throw new AccountError("INVALID_TOKEN");
    return this.startSession(row.user_id, userAgent);
  }

  async logout(token: unknown) {
    const value = z.string().min(20).max(200).safeParse(token);
    if (!value.success) return;
    await this.o.sql`UPDATE accounts.sessions SET revoked_at = now()
      WHERE token_hash = ${tokenHash(value.data)} AND revoked_at IS NULL`;
  }

  /** Subject of a valid access token (no database round trip). */
  subjectOf(accessToken: unknown): string | null {
    if (typeof accessToken !== "string" || accessToken.length > 4096) return null;
    return verifyAccess(accessToken, this.o.key)?.sub ?? null;
  }

  async roles(userId: string): Promise<Role[]> {
    const rows = await this.o.sql<{ role: Role }[]>`
      SELECT role FROM accounts.roles WHERE user_id = ${userId} ORDER BY role`;
    return rows.map((r) => r.role);
  }

  async view(userId: string): Promise<AccountView> {
    const [u] = await this.o.sql<UserRow[]>`SELECT * FROM accounts.users WHERE id = ${userId}`;
    if (!u) throw new AccountError("INVALID_TOKEN");
    return {
      id: u.id,
      email: u.email,
      nick: u.nick,
      roles: await this.roles(u.id),
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    };
  }

  /* ---------------------------- administration ---------------------------- */

  async listAccounts(query = ""): Promise<(AccountView & { confirmed: boolean })[]> {
    const q = "%" + query.trim().toLowerCase().replace(/[%_]/g, "") + "%";
    const rows = await this.o.sql<(UserRow & { roles: Role[] | null })[]>`
      SELECT u.*, array_remove(array_agg(r.role ORDER BY r.role), NULL) AS roles
      FROM accounts.users u LEFT JOIN accounts.roles r ON r.user_id = u.id
      WHERE lower(u.nick) LIKE ${q} OR lower(u.email) LIKE ${q}
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`;
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      nick: u.nick,
      roles: u.roles ?? [],
      confirmed: Boolean(u.email_confirmed_at),
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    }));
  }

  async setRole(actor: string, target: unknown, role: unknown, granted: unknown) {
    const userId = z.string().uuid().parse(target);
    const r = z.enum(["admin", "gm"]).parse(role);
    const on = z.boolean().parse(granted);
    if (!on && r === "admin" && userId === actor) throw new AccountError("FORBIDDEN");
    if (on)
      await this.o.sql`INSERT INTO accounts.roles (user_id, role, granted_by)
                       VALUES (${userId}, ${r}, ${actor}) ON CONFLICT DO NOTHING`;
    else await this.o.sql`DELETE FROM accounts.roles WHERE user_id = ${userId} AND role = ${r}`;
    await this.audit(actor, on ? "GRANT_ROLE" : "REVOKE_ROLE", userId, { role: r });
  }

  async auditLog(limit = 200) {
    return this.o.sql<
      {
        id: string;
        at: Date;
        actor: string | null;
        action: string;
        target: string | null;
        details: unknown;
      }[]
    >`SELECT a.*, ua.nick AS actor_nick, ut.nick AS target_nick
      FROM accounts.audit a
      LEFT JOIN accounts.users ua ON ua.id = a.actor
      LEFT JOIN accounts.users ut ON ut.id = a.target
      ORDER BY a.at DESC LIMIT ${Math.min(500, Math.max(1, limit))}`;
  }

  async audit(actor: string | null, action: string, target: string | null, details: unknown) {
    await this.o.sql`INSERT INTO accounts.audit (actor, action, target, details)
      VALUES (${actor}, ${action}, ${target}, ${details === null ? null : this.o.sql.json(details as never)})`;
  }
}
