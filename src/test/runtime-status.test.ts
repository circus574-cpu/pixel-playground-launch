// @vitest-environment node
/**
 * The admin "Serwer" tab shows only measured values. These tests pin the rules that matter: a missing table grant must not read as
 * "no database connection", an unreadable value is reported as missing (never as zero), and only staff may read the status.
 * The last block runs against a real PostgreSQL when KI_ACCOUNTS_TEST_DATABASE_URL is set.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";
import {
  collectRuntimeStatus,
  readDatabase,
  readMemoryLimitBytes,
  readProcess,
  restartHttp,
  runtimeHttp,
  type RuntimeServerInfo,
} from "../server/runtimeStatus";

type FakeSql = Parameters<typeof readDatabase>[0];

/** A stand-in for the postgres client: the tagged template is the connectivity query, `unsafe` the table counts. */
function fakeSql(options: {
  failConnect?: string;
  failCounts?: Record<string, string>;
  counts?: Record<string, number>;
}): FakeSql {
  const tag = (async () => {
    if (options.failConnect) throw new Error(options.failConnect);
    return [
      {
        version: "PostgreSQL 16.4 on x86_64",
        size: 50 * 1048576,
        connections: 7,
        max_connections: 100,
      },
    ];
  }) as unknown as Record<string, unknown>;
  tag["unsafe"] = async (query: string) => {
    for (const [fragment, message] of Object.entries(options.failCounts ?? {}))
      if (query.includes(fragment)) throw new Error(message);
    for (const [fragment, n] of Object.entries(options.counts ?? {}))
      if (query.includes(fragment)) return [{ n }];
    return [{ n: 0 }];
  };
  return tag as unknown as FakeSql;
}

const INFO: RuntimeServerInfo = {
  name: "Superior",
  nodeId: "eu-central-1",
  region: "eu-central (Aruba VPS)",
  port: 7420,
  tickRateHz: 20,
  maxPlayers: 50,
  activePlayers: 3,
  tickP50Ms: 1.2,
  tickP95Ms: 2.4,
  packetsInSec: 10,
  packetsOutSec: 20,
  accountsReady: true,
  charactersReady: true,
  androidReady: false,
};

describe("measured server status", () => {
  it("reports a database that answers as connected even when one table cannot be counted", async () => {
    const db = await readDatabase(
      fakeSql({
        failCounts: { "accounts.audit": "permission denied for table audit" },
        counts: { "accounts.users": 12, "game.characters": 4 },
      }),
    );
    expect(db.connected).toBe(true);
    expect(db.error).toBeNull();
    expect(db.latencyMs).toBeGreaterThan(0);
    expect(db.version).toBe("PostgreSQL 16.4");
    expect(db.sizeMb).toBe(50);
    expect(db.connections).toBe(7);
    expect(db.maxConnections).toBe(100);
    const byLabel = Object.fromEntries(db.counts.map((c) => [c.label, c]));
    expect(byLabel["Konta"]).toMatchObject({ value: 12, error: null });
    expect(byLabel["Postacie przeglądarkowe"]).toMatchObject({ value: 4, error: null });
    // the unreadable table is missing with its reason, never zero
    expect(byLabel["Wpisy dziennika audytu"]).toMatchObject({ value: null });
    expect(byLabel["Wpisy dziennika audytu"]?.error).toContain("permission denied");
  });

  it("reports no connection only when the connectivity query fails, with the reason", async () => {
    const db = await readDatabase(fakeSql({ failConnect: "connect ECONNREFUSED 127.0.0.1:5432" }));
    expect(db).toMatchObject({ connected: false, latencyMs: null, version: null, counts: [] });
    expect(db.error).toContain("ECONNREFUSED");
    const none = await readDatabase(null);
    expect(none.connected).toBe(false);
    expect(none.error).toContain("DATABASE_URL");
  });

  it("reads memory limits of containers (cgroup v2 and v1) and ignores 'unlimited'", () => {
    expect(readMemoryLimitBytes(() => "1073741824\n")).toBe(1073741824);
    expect(readMemoryLimitBytes(() => "max\n")).toBeNull();
    expect(readMemoryLimitBytes(() => "9223372036854771712")).toBeNull();
    expect(
      readMemoryLimitBytes((path) => {
        if (path.includes("memory.max")) throw new Error("ENOENT");
        return "536870912";
      }),
    ).toBe(536870912);
    expect(
      readMemoryLimitBytes(() => {
        throw new Error("ENOENT");
      }),
    ).toBeNull();
  });

  it("measures the process: real numbers, no estimates", () => {
    const p = readProcess();
    expect(p.pid).toBe(process.pid);
    expect(p.nodeVersion).toBe(process.version);
    expect(p.rssMb).toBeGreaterThan(10);
    expect(p.cpuCount).toBeGreaterThanOrEqual(1);
    expect(p.hostMemoryMb).toBeGreaterThan(100);
    expect(p.loadPercent).toBeGreaterThanOrEqual(0);
  });

  it("collects server, process, database, Android counts and the real player list in one status", async () => {
    const status = await collectRuntimeStatus({
      info: INFO,
      sql: fakeSql({ counts: { "godot_android.saves": 5 } }),
      godot: null,
      android: () => ({ count: 2, byLand: { pyra: 2 } }),
      players: () => [
        {
          id: "c1",
          nick: "Ala",
          race: "legend",
          level: 7,
          worldId: "pyra",
          x: 10,
          y: 20,
          activity: "safe",
          inSafeCity: true,
          pingMs: 31,
        },
      ],
    });
    expect(status.server).toMatchObject({
      name: "Superior",
      activePlayers: 3,
      androidOnline: 2,
      androidByLand: { pyra: 2 },
    });
    expect(status.players).toHaveLength(1);
    expect(status.players[0]?.nick).toBe("Ala");
    expect(status.database.connected).toBe(true);
    expect(status.android).toBeNull();
    expect(Date.parse(status.collectedAt)).not.toBeNaN();
  });

  it("serves the status to staff only, read only", async () => {
    const collect = async () =>
      collectRuntimeStatus({
        info: INFO,
        sql: null,
        godot: null,
        android: () => ({ count: 0, byLand: {} }),
      });
    const server = createServer((request, response) => {
      void runtimeHttp(request, response, {
        staff: async (token) => (token === "staff-token" ? "account-1" : null),
        collect,
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      expect((await fetch(base)).status).toBe(403);
      expect((await fetch(base, { headers: { Authorization: "Bearer wrong" } })).status).toBe(403);
      expect(
        (
          await fetch(base, {
            method: "POST",
            headers: { Authorization: "Bearer staff-token" },
          })
        ).status,
      ).toBe(405);
      const ok = await fetch(base, { headers: { Authorization: "Bearer staff-token" } });
      expect(ok.status).toBe(200);
      expect(ok.headers.get("cache-control")).toBe("no-store");
      const body = (await ok.json()) as {
        server: { name: string };
        database: { connected: boolean };
      };
      expect(body.server.name).toBe("Superior");
      expect(body.database.connected).toBe(false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];
describe.skipIf(!url)("measured database status against a real PostgreSQL", () => {
  it("answers with real version, size, connections and counts", async () => {
    const sql = postgres(url!, { max: 2 });
    try {
      const db = await readDatabase(sql);
      expect(db.connected).toBe(true);
      expect(db.version).toMatch(/^PostgreSQL \d+/);
      expect(db.sizeMb).toBeGreaterThan(0);
      expect(db.connections).toBeGreaterThanOrEqual(1);
      expect(db.maxConnections).toBeGreaterThan(0);
      expect(db.counts.map((c) => c.label)).toContain("Konta");
      for (const c of db.counts) {
        if (c.value !== null) expect(c.value).toBeGreaterThanOrEqual(0);
        else expect(c.error).toBeTruthy();
      }
    } finally {
      await sql.end({ timeout: 2 });
    }
  });
});

describe("restartHttp: the panel restarts the game server", () => {
  async function call(
    method: string,
    deps: Parameters<typeof restartHttp>[2],
    token: string | undefined = "t",
  ) {
    const server = createServer((req, res) => void restartHttp(req, res, deps));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method,
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    } finally {
      server.close();
    }
  }

  it("refuses anything but POST, and anyone who is not an administrator, without restarting", async () => {
    const schedule = vi.fn(async () => true);
    expect((await call("GET", { admin: async () => "a1", schedule })).status).toBe(405);
    expect((await call("POST", { admin: async () => null, schedule })).status).toBe(403);
    expect((await call("POST", { admin: async () => "a1", schedule }, undefined)).status).toBe(202);
    expect(schedule).toHaveBeenCalledTimes(1); // only the administrator's request got through
  });

  it("answers first and hands the administrator's id to the restart", async () => {
    const schedule = vi.fn(async () => true);
    const result = await call("POST", { admin: async () => "admin-7", schedule });
    expect(result.status).toBe(202);
    expect(schedule).toHaveBeenCalledWith("admin-7");
    expect(String(result.body["message"])).toContain("restartuje się");
  });

  it("says so when this process cannot restart itself, or the restart cannot be scheduled", async () => {
    const none = await call("POST", { admin: async () => "a1", schedule: async () => false });
    expect(none.status).toBe(503);
    const broken = await call("POST", {
      admin: async () => "a1",
      schedule: async () => {
        throw new Error("boom");
      },
    });
    expect(broken.status).toBe(500);
    expect(String(broken.body["message"])).toContain("boom");
  });
});
