/**
 * World edits published from /admin: stored as numbered revisions in PostgreSQL
 * (world_admin.revisions) and applied in place to the game server's catalogs, so monsters,
 * bosses, loot and spawns change for every online player without a new deployment.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type postgres from "postgres";
import {
  countActiveOverrides,
  emptyAdminWorldOverrides,
  writeAdminWorldOverrides,
  type AdminWorldOverrides,
} from "../../game/world/adminWorldStore";
import {
  WORLD_OVERRIDES_MAX_BYTES,
  validateWorldOverrides,
} from "../../game/world/worldOverridesSchema";
import { RateLimiter } from "../accounts/http";

export type PublishedWorld = {
  revision: number;
  publishedAt: string | null;
  publishedBy: string | null;
  data: AdminWorldOverrides;
};

export type WorldRevisionRow = {
  revision: number;
  publishedAt: string;
  publishedBy: string | null;
  nick: string | null;
  note: string | null;
  changes: number;
};

export class WorldEditConflict extends Error {
  constructor(readonly current: number) {
    super("REVISION_CONFLICT");
  }
}

export class WorldOverrideService {
  private current: PublishedWorld = {
    revision: 0,
    publishedAt: null,
    publishedBy: null,
    data: emptyAdminWorldOverrides(),
  };

  constructor(
    private readonly sql: postgres.Sql,
    private readonly apply: (data: AdminWorldOverrides) => void = (data) =>
      void writeAdminWorldOverrides(data, null),
  ) {}

  get published(): PublishedWorld {
    return this.current;
  }

  /** Loads and applies the newest revision. Throws when the schema is missing. */
  async ready(): Promise<void> {
    const [row] = await this.sql<
      { revision: number; data: unknown; published_at: Date; published_by: string | null }[]
    >`SELECT revision, data, published_at, published_by FROM world_admin.revisions
      ORDER BY revision DESC LIMIT 1`;
    if (!row) return;
    const checked = validateWorldOverrides(row.data);
    if (!checked.ok) {
      console.warn(`[World] Rewizja ${row.revision} odrzucona: ${checked.error}`);
      return;
    }
    this.adopt({
      revision: row.revision,
      publishedAt: row.published_at.toISOString(),
      publishedBy: row.published_by,
      data: checked.value,
    });
  }

  private adopt(next: PublishedWorld) {
    this.apply(next.data);
    this.current = next;
  }

  async publish(
    actor: string,
    input: unknown,
    expectedRevision: unknown,
    note?: unknown,
  ): Promise<PublishedWorld> {
    const checked = validateWorldOverrides(input);
    if (!checked.ok) throw Object.assign(new Error("INVALID_INPUT"), { detail: checked.error });
    if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision))
      throw new Error("INVALID_INPUT");
    const text = typeof note === "string" ? note.trim().slice(0, 200) || null : null;
    const data = { ...checked.value, updatedAt: new Date().toISOString() };
    const row = await this.sql.begin(async (tx) => {
      // One publisher at a time; the expected revision rejects edits based on a stale copy.
      await tx`SELECT pg_advisory_xact_lock(7420006)`;
      const [last] = await tx<
        { revision: number }[]
      >`SELECT coalesce(max(revision), 0)::int AS revision FROM world_admin.revisions`;
      if (last!.revision !== expectedRevision) throw new WorldEditConflict(last!.revision);
      const [inserted] = await tx<{ revision: number; published_at: Date }[]>`
        INSERT INTO world_admin.revisions (revision, data, published_by, note)
        VALUES (${last!.revision + 1}, ${tx.json(data as never)}, ${actor}, ${text})
        RETURNING revision, published_at`;
      await tx`INSERT INTO accounts.audit (actor, action, target, details)
        VALUES (${actor}, 'WORLD_PUBLISH', NULL, ${tx.json({
          revision: inserted!.revision,
          changes: countActiveOverrides(data),
          note: text,
        } as never)})`;
      return inserted!;
    });
    this.adopt({
      revision: row.revision,
      publishedAt: row.published_at.toISOString(),
      publishedBy: actor,
      data,
    });
    return this.current;
  }

  async revisions(limit = 50): Promise<WorldRevisionRow[]> {
    const rows = await this.sql<
      {
        revision: number;
        published_at: Date;
        published_by: string | null;
        nick: string | null;
        note: string | null;
        data: AdminWorldOverrides;
      }[]
    >`SELECT r.revision, r.published_at, r.published_by, u.nick, r.note, r.data
      FROM world_admin.revisions r LEFT JOIN accounts.users u ON u.id = r.published_by
      ORDER BY r.revision DESC LIMIT ${Math.min(200, Math.max(1, limit))}`;
    return rows.map((r) => ({
      revision: r.revision,
      publishedAt: r.published_at.toISOString(),
      publishedBy: r.published_by,
      nick: r.nick,
      note: r.note,
      changes: countActiveOverrides({ ...emptyAdminWorldOverrides(), ...r.data }),
    }));
  }

  /** Publishes a copy of an older revision as the newest one. */
  async rollback(actor: string, revision: unknown): Promise<PublishedWorld> {
    if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0)
      throw new Error("INVALID_INPUT");
    let data: unknown = emptyAdminWorldOverrides();
    if (revision > 0) {
      const [row] = await this.sql<
        { data: unknown }[]
      >`SELECT data FROM world_admin.revisions WHERE revision = ${revision}`;
      if (!row) throw new Error("INVALID_INPUT");
      data = row.data;
    }
    return this.publish(actor, data, this.current.revision, `Przywrócono rewizję ${revision}`);
  }
}

const perIp = new RateLimiter(120, 60_000);

/**
 * /ws/world/overrides — GET for everyone (the game needs the published world);
 * POST, /ws/world/revisions and /ws/world/rollback for admin and GM accounts.
 */
export async function worldHttp(
  request: IncomingMessage,
  response: ServerResponse,
  service: WorldOverrideService | null,
  staff: (token: string | undefined) => Promise<string | null>,
): Promise<void> {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  if (!service)
    return send(503, { error: "WORLD_UNAVAILABLE", message: "Edycja świata jest niedostępna." });
  const ip = String(request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "")
    .split(",")[0]!
    .trim();
  if (!perIp.allow(ip)) return send(429, { error: "RATE_LIMITED" });
  const url = new URL(request.url || "", "http://localhost");
  const path = url.pathname.replace(/^\/ws\/world/, "") || "/";
  try {
    if (request.method === "GET" && path === "/overrides") return send(200, service.published);
    const actor = await staff(request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]);
    if (!actor) return send(403, { error: "FORBIDDEN", message: "Brak uprawnień." });
    if (request.method === "GET" && path === "/revisions")
      return send(200, { revisions: await service.revisions() });
    if (request.method !== "POST") return send(405, { error: "METHOD_NOT_ALLOWED" });
    if (!request.headers["content-type"]?.startsWith("application/json"))
      return send(400, { error: "INVALID_INPUT" });
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > WORLD_OVERRIDES_MAX_BYTES + 4096)
        return send(413, { error: "TOO_LARGE", message: "Pakiet zmian jest za duży." });
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<
      string,
      unknown
    >;
    if (path === "/overrides")
      return send(
        200,
        await service.publish(actor, body["data"], body["expectedRevision"], body["note"]),
      );
    if (path === "/rollback") return send(200, await service.rollback(actor, body["revision"]));
    return send(404, { error: "NOT_FOUND" });
  } catch (error) {
    if (error instanceof WorldEditConflict)
      return send(409, {
        error: "REVISION_CONFLICT",
        current: error.current,
        message: "Ktoś opublikował zmiany w międzyczasie. Wczytaj aktualną wersję z serwera.",
      });
    if (error instanceof SyntaxError || (error as Error).message === "INVALID_INPUT")
      return send(400, {
        error: "INVALID_INPUT",
        message: "Nieprawidłowe dane: " + ((error as { detail?: string }).detail ?? "format"),
      });
    console.error("[World] Błąd edycji świata", (error as Error).message);
    return send(500, { error: "SERVER_ERROR", message: "Błąd serwera." });
  }
}
