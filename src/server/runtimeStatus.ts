/**
 * What the admin panel shows on its "Serwer" tab: only measured values, read inside the game server process (the one that owns the
 * database connection, the sessions and the Android backend). Nothing here is estimated or simulated: a value that cannot be read is
 * reported as missing together with the reason, never as zero.
 *
 * Served at GET /ws/admin/runtime for staff (the same sign-in as the rest of the panel).
 */
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import type postgres from "postgres";
import type { GodotStore } from "./godot/store";

type Sql = ReturnType<typeof postgres>;

export type CountResult = { label: string; value: number | null; error: string | null };

export type RuntimeServerInfo = {
  name: string;
  nodeId: string;
  region: string;
  port: number;
  tickRateHz: number;
  maxPlayers: number;
  /** Web-game sessions (not the Android game). */
  activePlayers: number;
  tickP50Ms: number;
  tickP95Ms: number;
  packetsInSec: number;
  packetsOutSec: number;
  accountsReady: boolean;
  charactersReady: boolean;
  androidReady: boolean;
};

/** A player connected to the browser game right now (position as the server last received it). */
export type RuntimePlayer = {
  id: string;
  nick: string;
  race: string;
  level: number;
  worldId: string;
  x: number;
  y: number;
  activity: string;
  inSafeCity: boolean;
  pingMs: number;
};

export type RuntimeStatus = {
  collectedAt: string;
  /** Players connected to the browser game (the Android game only reports counts, see `server`). */
  players: RuntimePlayer[];
  server: RuntimeServerInfo & {
    uptimeSeconds: number;
    androidOnline: number;
    androidByLand: Record<string, number>;
  };
  process: {
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    rssMb: number;
    heapUsedMb: number;
    loadAvg1m: number;
    cpuCount: number;
    /** Load average of the last minute divided by the number of cores, in percent (can exceed 100). */
    loadPercent: number;
    /** The container's memory limit, when it has one. */
    memoryLimitMb: number | null;
    hostMemoryMb: number;
  };
  database: {
    connected: boolean;
    latencyMs: number | null;
    error: string | null;
    version: string | null;
    sizeMb: number | null;
    connections: number | null;
    maxConnections: number | null;
    counts: CountResult[];
  };
  android: {
    activeVersion: string | null;
    minClientCode: number;
    maintenance: boolean;
    releases: number;
    saves: number | null;
    lastWriteAt: string | null;
  } | null;
};

/** Tables whose size says something about the game; each is counted on its own so one missing grant does not hide the rest. */
const COUNTS: { label: string; sql: string }[] = [
  { label: "Konta", sql: "SELECT count(*)::int AS n FROM accounts.users" },
  { label: "Role (admin / GM)", sql: "SELECT count(*)::int AS n FROM accounts.roles" },
  {
    label: "Postacie przeglądarkowe",
    sql: "SELECT count(*)::int AS n FROM game.characters WHERE retired_at IS NULL",
  },
  { label: "Wpisy dziennika audytu", sql: "SELECT count(*)::int AS n FROM accounts.audit" },
  { label: "Zapisy gry Android", sql: "SELECT count(*)::int AS n FROM godot_android.saves" },
  { label: "Wydania treści Android", sql: "SELECT count(*)::int AS n FROM godot_android.releases" },
];

const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;
const reason = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 160);

/** The container's memory limit (cgroup v2, then v1); null when unlimited or unreadable. */
export function readMemoryLimitBytes(
  read: (path: string) => string = (p) => readFileSync(p, "utf8"),
): number | null {
  for (const path of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      const value = read(path).trim();
      const bytes = Number(value);
      // cgroup v1 reports an enormous number for "no limit"
      if (value !== "max" && Number.isFinite(bytes) && bytes > 0 && bytes < 2 ** 50) return bytes;
    } catch {
      // not on this system
    }
  }
  return null;
}

export function readProcess(): RuntimeStatus["process"] {
  const memory = process.memoryUsage();
  const cores = Math.max(1, os.cpus().length);
  const load = os.loadavg()[0] ?? 0;
  const limit = readMemoryLimitBytes();
  return {
    pid: process.pid,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    rssMb: mb(memory.rss),
    heapUsedMb: mb(memory.heapUsed),
    loadAvg1m: Math.round(load * 100) / 100,
    cpuCount: cores,
    loadPercent: Math.round((load / cores) * 100),
    memoryLimitMb: limit === null ? null : Math.round(limit / 1048576),
    hostMemoryMb: Math.round(os.totalmem() / 1048576),
  };
}

/** Connection is judged by a trivial query; the table counts are separate, so a missing grant never reads as "no connection". */
export async function readDatabase(sql: Sql | null): Promise<RuntimeStatus["database"]> {
  if (!sql) {
    return {
      connected: false,
      latencyMs: null,
      error: "Serwer gry nie ma połączenia z bazą (brak DATABASE_URL albo błąd połączenia).",
      version: null,
      sizeMb: null,
      connections: null,
      maxConnections: null,
      counts: [],
    };
  }
  const started = performance.now();
  try {
    const [row] = await sql<
      { version: string; size: number; connections: number; max_connections: number }[]
    >`SELECT version() AS version,
             pg_database_size(current_database())::float8 AS size,
             (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections,
             current_setting('max_connections')::int AS max_connections`;
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    const counts: CountResult[] = [];
    for (const item of COUNTS) {
      try {
        const [result] = await sql.unsafe<{ n: number }[]>(item.sql);
        counts.push({ label: item.label, value: result?.n ?? 0, error: null });
      } catch (error) {
        counts.push({ label: item.label, value: null, error: reason(error) });
      }
    }
    return {
      connected: true,
      latencyMs,
      error: null,
      version: row?.version.split(" ").slice(0, 2).join(" ") ?? null,
      sizeMb: row ? mb(row.size) : null,
      connections: row?.connections ?? null,
      maxConnections: row?.max_connections ?? null,
      counts,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: reason(error),
      version: null,
      sizeMb: null,
      connections: null,
      maxConnections: null,
      counts: [],
    };
  }
}

export async function readAndroid(store: GodotStore | null): Promise<RuntimeStatus["android"]> {
  if (!store) return null;
  try {
    const [settings, releases, stats] = await Promise.all([
      store.settings(),
      store.releases(),
      store.stats(),
    ]);
    return {
      activeVersion: settings.activeVersion,
      minClientCode: settings.minClientCode,
      maintenance: settings.maintenance,
      releases: releases.length,
      saves: stats.saves,
      lastWriteAt: stats.lastWriteAt,
    };
  } catch {
    return null;
  }
}

export async function collectRuntimeStatus(deps: {
  info: RuntimeServerInfo;
  players?: () => RuntimePlayer[];
  sql: Sql | null;
  godot: GodotStore | null;
  android: () => { count: number; byLand: Record<string, number> };
}): Promise<RuntimeStatus> {
  const [database, android] = await Promise.all([readDatabase(deps.sql), readAndroid(deps.godot)]);
  const live = deps.android();
  return {
    collectedAt: new Date().toISOString(),
    players: deps.players?.() ?? [],
    server: {
      ...deps.info,
      uptimeSeconds: Math.floor(process.uptime()),
      androidOnline: live.count,
      androidByLand: live.byLand,
    },
    process: readProcess(),
    database,
    android,
  };
}

/** GET /ws/admin/runtime: staff only. `staff` resolves a bearer token to a staff account id (or null). */
export async function runtimeHttp(
  request: IncomingMessage,
  response: ServerResponse,
  deps: {
    staff: (token: string | undefined) => Promise<string | null>;
    collect: () => Promise<RuntimeStatus>;
  },
): Promise<void> {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  if ((request.method ?? "GET") !== "GET")
    return send(405, { error: "METHOD_NOT_ALLOWED", message: "Dozwolony tylko odczyt." });
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!(await deps.staff(token)))
    return send(403, { error: "FORBIDDEN", message: "Wymagane konto administratora lub GM." });
  try {
    send(200, await deps.collect());
  } catch (error) {
    send(500, { error: "RUNTIME_FAILED", message: reason(error) });
  }
}

/**
 * POST /ws/admin/restart: an administrator (not a GM) restarts the game server from the panel. The answer is sent first; the restart itself runs a moment later
 * (`schedule`), because it closes the very connection that carried the request. `schedule` returns false when this process cannot restart itself.
 */
export async function restartHttp(
  request: IncomingMessage,
  response: ServerResponse,
  deps: {
    admin: (token: string | undefined) => Promise<string | null>;
    schedule: (actor: string) => Promise<boolean>;
  },
): Promise<void> {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  if (request.method !== "POST")
    return send(405, { error: "METHOD_NOT_ALLOWED", message: "Restart wymaga metody POST." });
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const actor = await deps.admin(token);
  if (!actor)
    return send(403, {
      error: "FORBIDDEN",
      message: "Restart serwera może wykonać tylko konto administratora.",
    });
  try {
    if (!(await deps.schedule(actor)))
      return send(503, {
        error: "RESTART_UNAVAILABLE",
        message: "Ten proces nie potrafi sam się zrestartować.",
      });
  } catch (error) {
    return send(500, { error: "RESTART_FAILED", message: reason(error) });
  }
  send(202, {
    ok: true,
    message: "Serwer gry restartuje się. Gracze połączą się ponownie w ciągu kilku sekund.",
  });
}
