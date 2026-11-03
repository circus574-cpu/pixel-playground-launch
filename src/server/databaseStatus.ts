/** Real status of the game database (PostgreSQL on the VPS) for the admin panel. Read only. */
import { getDatabaseUrl, getGameDb } from "./db";

export type DatabaseStatus = {
  connected: boolean;
  latencyMs: number;
  error: string | null;
  host: string;
  accounts: number;
  roles: number;
  characters: number;
  audits: number;
  connections: number;
  maxConnections: number;
};

/** Host and port only; the connection string carries credentials and is never exposed. */
function safeHost(): string {
  try {
    const url = new URL(getDatabaseUrl() ?? "");
    return url.host || "nieznany";
  } catch {
    return "nieznany";
  }
}

export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const empty = {
    host: safeHost(),
    accounts: 0,
    roles: 0,
    characters: 0,
    audits: 0,
    connections: 0,
    maxConnections: 0,
  };
  const db = getGameDb();
  if (!db)
    return {
      connected: false,
      latencyMs: 0,
      error: "Brak adresu bazy danych na serwerze",
      ...empty,
    };
  const started = performance.now();
  try {
    const [row] = await db<
      {
        accounts: number;
        roles: number;
        characters: number;
        audits: number;
        connections: number;
        max_connections: number;
      }[]
    >`SELECT
        (SELECT count(*) FROM accounts.users)::int AS accounts,
        (SELECT count(*) FROM accounts.roles)::int AS roles,
        (SELECT count(*) FROM game.characters WHERE retired_at IS NULL)::int AS characters,
        (SELECT count(*) FROM accounts.audit)::int AS audits,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections,
        current_setting('max_connections')::int AS max_connections`;
    return {
      connected: true,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      error: null,
      host: empty.host,
      accounts: row?.accounts ?? 0,
      roles: row?.roles ?? 0,
      characters: row?.characters ?? 0,
      audits: row?.audits ?? 0,
      connections: row?.connections ?? 0,
      maxConnections: row?.max_connections ?? 0,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
      ...empty,
    };
  }
}
