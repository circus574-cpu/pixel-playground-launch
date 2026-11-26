// @vitest-environment node
/**
 * Android game backend: save rules (always) and the whole HTTP/WebSocket API against a real PostgreSQL with the Android migrations applied (runs when KI_ACCOUNTS_TEST_DATABASE_URL is set, like the accounts test).
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { WebSocket, WebSocketServer } from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountService } from "../server/accounts/service";
import type { Mail, Mailer } from "../server/accounts/mailer";
import { ContentFiles } from "../server/godot/contentFiles";
import { godotHttp } from "../server/godot/http";
import { GodotLive } from "../server/godot/live";
import { checkSave, SaveRejected } from "../server/godot/saveRules";
import { GodotStore } from "../server/godot/store";

/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers over loosely typed JSON responses */
const validSave = (over: Record<string, unknown> = {}) => ({
  format: "ki-godot-pyra-save-2",
  version: 2,
  race: "legend",
  land: "pyra",
  room: "",
  town: "",
  position: [45850.3, 13832.5],
  cityReturn: [45850.3, 13832.5],
  kit: {
    level: 5,
    xp: 120,
    learned: ["R", "A1"],
    slots: ["A1", null, null, null],
    hp: 300,
    ki: 40,
  },
  economy: { gold: 250, bag: { potion: 3 }, equipment: {}, depot: {}, depotGold: 0, upgrades: {} },
  quests: { quests: {} },
  dungeons: {},
  events: { claimed: [] },
  ...over,
});

describe("Android save rules", () => {
  it("accepts a save of this game and summarises it", () => {
    const { summary } = checkSave(validSave());
    expect(summary).toMatchObject({ race: "legend", land: "pyra", level: 5 });
  });
  it("refuses other formats, unknown races or lands, impossible numbers and huge bodies", () => {
    for (const bad of [
      validSave({ format: "other" }),
      validSave({ race: "orc" }),
      validSave({ land: "moon" }),
      validSave({ position: [NaN, 1] }),
      validSave({ kit: { level: 99, xp: 0, learned: ["R"], slots: [], hp: 1, ki: 1 } }),
      validSave({
        economy: { gold: 1e12, bag: {}, equipment: {}, depot: {}, depotGold: 0, upgrades: {} },
      }),
      { not: "a save" },
    ])
      expect(() => checkSave(bad)).toThrow(SaveRejected);
    expect(() => checkSave(validSave({ quests: { blob: "x".repeat(1_100_000) } }))).toThrowError(
      expect.objectContaining({ code: "TOO_LARGE" }),
    );
  });
});

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];

describe.runIf(url)("Android backend on PostgreSQL", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 3 });
  const outbox: Mail[] = [];
  const mailer: Mailer = { configured: true, send: async (m) => void outbox.push(m) };
  const accounts = new AccountService({
    sql,
    mailer,
    key: Buffer.alloc(32, 7),
    publicUrl: "https://example.test",
    realm: "https://realm.example.test",
  });
  let dir = "";
  let store: GodotStore;
  let server: http.Server;
  let base = "";
  const live = new GodotLive(() => accounts);
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const call = async (
    method: string,
    route: string,
    options: {
      token?: string;
      body?: unknown;
      headers?: Record<string, string>;
      raw?: Buffer;
    } = {},
  ) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(options.token ? { Authorization: "Bearer " + options.token } : {}),
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.raw ? { "Content-Type": "application/octet-stream" } : {}),
        ...options.headers,
      },
      ...(options.raw
        ? { body: new Uint8Array(options.raw) }
        : options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* binary */
    }
    return {
      status: response.status,
      json: json as Record<string, any> | null,
      text,
      headers: response.headers,
    };
  };

  const register = async (nick: string) => {
    outbox.length = 0;
    await accounts.register({ email: `${nick}@example.com`, password: "haslo-12345", nick });
    const link = decodeURIComponent(new RegExp('aktywacja=([^"&\\s]+)').exec(outbox[0]!.text)![1]!);
    const session = await accounts.confirm(link);
    tokens[nick] = session.accessToken;
    ids[nick] = session.account.id;
  };

  const pack = (name: string, bytes: Buffer) => {
    const sha = createHash("sha256").update(bytes).digest("hex");
    return { file: `${name}-${sha.slice(0, 12)}.pck`, bytes: bytes.length, sha256: sha };
  };

  beforeAll(async () => {
    await sql`UPDATE godot_android.settings SET active_version = NULL, min_client_code = 1, maintenance = false, news = NULL`;
    await sql`DELETE FROM godot_android.releases`;
    await sql`DELETE FROM godot_android.saves`;
    await sql`TRUNCATE godot_android.characters, accounts.audit, accounts.sessions, accounts.email_tokens, accounts.roles, accounts.users`;
    dir = await mkdtemp(path.join(tmpdir(), "godot-content-"));
    store = new GodotStore(sql, new ContentFiles(dir));
    await store.ready();
    await register("admin1");
    await register("gm1");
    await register("gracz1");
    await register("gracz2");
    await sql`INSERT INTO accounts.roles (user_id, role) VALUES (${ids["admin1"]!}, 'admin'), (${ids["gm1"]!}, 'gm')`;
    server = http.createServer((req, res) => {
      void godotHttp(req, res, { store, accounts, online: () => live.count() });
    });
    const wss = new WebSocketServer({ server });
    wss.on("connection", (socket) => live.attach(socket));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ws/godot`;
  });
  afterAll(async () => {
    live.closeAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await sql.end();
    await rm(dir, { recursive: true, force: true });
  });

  const core = Buffer.from("core-pack-bytes".repeat(1000));
  const land = Buffer.from("land-pyra-bytes".repeat(2000));
  let manifest: Record<string, unknown>;

  it("answers /status and has no content before the first release", async () => {
    const s = await call("GET", "/status");
    expect(s.status).toBe(200);
    expect(s.json).toMatchObject({ ok: true, maintenance: false, activeVersion: null, online: 0 });
    expect((await call("GET", "/manifest?client=1")).status).toBe(503);
  });

  it("lets only an administrator upload packs and publish a release", async () => {
    const entry = { core: pack("core", core), "land-pyra": pack("land-pyra", land) };
    manifest = {
      format: "ki-godot-content-1",
      version: "2026.11.17.1",
      packs: entry,
      lands: { pyra: ["land-pyra", "core"] },
    };
    const route = (file: string) => `/admin/releases/2026.11.17.1/files/${file}`;
    const asPlayer = await call("PUT", route(entry.core.file), {
      token: tokens["gracz1"]!,
      raw: core,
      headers: { "X-Pack-Sha256": entry.core.sha256 },
    });
    expect(asPlayer.status).toBe(403);
    const asGm = await call("PUT", route(entry.core.file), {
      token: tokens["gm1"]!,
      raw: core,
      headers: { "X-Pack-Sha256": entry.core.sha256 },
    });
    expect(asGm.status).toBe(403);
    const wrong = await call("PUT", route(entry.core.file), {
      token: tokens["admin1"]!,
      raw: Buffer.from("tampered"),
      headers: { "X-Pack-Sha256": entry.core.sha256 },
    });
    expect(wrong.status).toBe(422);
    expect(
      (await call("POST", "/admin/releases", { token: tokens["admin1"]!, body: { manifest } }))
        .status,
    ).toBe(422);
    for (const [name, bytes] of [
      ["core", core],
      ["land-pyra", land],
    ] as const) {
      const e = entry[name];
      const ok = await call("PUT", route(e.file), {
        token: tokens["admin1"]!,
        raw: bytes,
        headers: { "X-Pack-Sha256": e.sha256 },
      });
      expect(ok.status).toBe(200);
    }
    expect(
      (
        await call("POST", "/admin/releases", {
          token: tokens["admin1"]!,
          body: { manifest, note: "test" },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("POST", "/admin/activate", {
          token: tokens["admin1"]!,
          body: { version: "nie-ma" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("POST", "/admin/activate", {
          token: tokens["admin1"]!,
          body: { version: "2026.11.17.1" },
        })
      ).status,
    ).toBe(200);
  });

  it("serves the active manifest and the packs with ranges, ETag and long caching", async () => {
    const m = await call("GET", "/manifest?client=1");
    expect(m.status).toBe(200);
    expect(m.json!["packBase"]).toBe("/ws/godot/pack/2026.11.17.1/");
    expect(m.json!["manifest"].lands.pyra).toEqual(["land-pyra", "core"]);
    const file = (manifest["packs"] as Record<string, { file: string; sha256: string }>)[
      "land-pyra"
    ]!;
    const whole = await fetch(base + "/pack/2026.11.17.1/" + file.file);
    expect(whole.status).toBe(200);
    expect(Buffer.from(await whole.arrayBuffer()).equals(land)).toBe(true);
    expect(whole.headers.get("cache-control")).toContain("immutable");
    expect(whole.headers.get("etag")).toBe(`"${file.sha256}"`);
    const part = await fetch(base + "/pack/2026.11.17.1/" + file.file, {
      headers: { Range: "bytes=10-19" },
    });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 10-19/${land.length}`);
    expect(Buffer.from(await part.arrayBuffer()).equals(land.subarray(10, 20))).toBe(true);
    const tail = await fetch(base + "/pack/2026.11.17.1/" + file.file, {
      headers: { Range: "bytes=-5" },
    });
    expect(Buffer.from(await tail.arrayBuffer()).equals(land.subarray(land.length - 5))).toBe(true);
    expect(
      (
        await fetch(base + "/pack/2026.11.17.1/" + file.file, {
          headers: { Range: "bytes=999999999-" },
        })
      ).status,
    ).toBe(416);
    expect((await fetch(base + "/pack/2026.11.17.1/" + file.file, { method: "HEAD" })).status).toBe(
      200,
    );
    expect((await fetch(base + "/pack/2026.11.17.1/..%2F..%2Fetc-passwd")).status).toBe(400);
    expect((await fetch(base + "/pack/2026.11.17.1/core-aaaaaaaaaaaa.pck")).status).toBe(404);
  });

  it("gates old clients and maintenance, but lets an administrator in during maintenance", async () => {
    const staff = (
      await call("POST", "/admin/settings", {
        token: tokens["admin1"]!,
        body: { minClientCode: 8, news: "Nowa wersja" },
      })
    ).json!;
    expect(staff["settings"]).toMatchObject({ minClientCode: 8, news: "Nowa wersja" });
    const old = await call("GET", "/manifest?client=7");
    expect(old.status).toBe(426);
    expect((await call("GET", "/manifest?client=8")).status).toBe(200);
    await call("POST", "/admin/settings", {
      token: tokens["admin1"]!,
      body: { maintenance: true, maintenanceMessage: "Konserwacja" },
    });
    const down = await call("GET", "/manifest?client=8");
    expect(down.status).toBe(503);
    expect(down.json).toMatchObject({ error: "MAINTENANCE", message: "Konserwacja" });
    expect((await call("GET", "/manifest?client=8", { token: tokens["admin1"]! })).status).toBe(
      200,
    );
    await call("POST", "/admin/settings", {
      token: tokens["admin1"]!,
      body: { maintenance: false, minClientCode: 1 },
    });
    expect(
      (await call("POST", "/admin/settings", { token: tokens["admin1"]!, body: { hacker: true } }))
        .status,
    ).toBe(400);
  });

  it("keeps cloud saves per account with revision locking", async () => {
    const t = tokens["gracz1"]!;
    expect((await call("GET", "/saves")).status).toBe(401);
    expect((await call("GET", "/saves", { token: t })).json).toEqual({ saves: [] });
    const first = await call("PUT", "/saves/1", {
      token: t,
      body: { baseRevision: 0, save: validSave(), clientCode: 8, contentVersion: "2026.11.17.1" },
    });
    expect(first.status).toBe(200);
    expect(first.json!["revision"]).toBe(1);
    const stale = await call("PUT", "/saves/1", {
      token: t,
      body: { baseRevision: 0, save: validSave() },
    });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ error: "REVISION_CONFLICT", serverRevision: 1 });
    const second = await call("PUT", "/saves/1", {
      token: t,
      body: {
        baseRevision: 1,
        save: validSave({ kit: { level: 6, xp: 5, learned: ["R"], slots: [], hp: 1, ki: 1 } }),
      },
    });
    expect(second.json!["revision"]).toBe(2);
    const read = await call("GET", "/saves/1", { token: t });
    expect(read.json!["save"].kit.level).toBe(6);
    expect((await call("GET", "/saves", { token: t })).json!["saves"][0]).toMatchObject({
      slot: 1,
      revision: 2,
      race: "legend",
      land: "pyra",
      level: 6,
    });
    expect((await call("GET", "/saves/1", { token: tokens["gracz2"]! })).status).toBe(404);
    expect(
      (
        await call("PUT", "/saves/1", {
          token: t,
          body: { baseRevision: 2, save: { format: "x" } },
        })
      ).status,
    ).toBe(422);
    // a player keeps three characters in the cloud; an administrator has no limit
    const refused = await call("PUT", "/saves/4", {
      token: t,
      body: { baseRevision: 0, save: validSave() },
    });
    expect(refused.status).toBe(403);
    expect(refused.json!["error"]).toBe("SLOT_LIMIT");
    expect((await call("GET", "/saves/4", { token: t })).status).toBe(403);
    for (const slot of [4, 57, 32_767]) {
      const made = await call("PUT", `/saves/${slot}`, {
        token: tokens["admin1"]!,
        body: { baseRevision: 0, save: validSave({ race: "android", land: "nexus" }) },
      });
      expect(made.status).toBe(200);
      expect(
        (await call("GET", `/saves/${slot}`, { token: tokens["admin1"]! })).json!["save"].race,
      ).toBe("android");
    }
    const adminList = (await call("GET", "/saves", { token: tokens["admin1"]! })).json!["saves"];
    expect(adminList.map((r: { slot: number }) => r.slot)).toEqual([4, 57, 32_767]);
    for (const slot of [0, 32_768, 100_000])
      expect(
        (
          await call("PUT", `/saves/${slot}`, {
            token: tokens["admin1"]!,
            body: { baseRevision: 0, save: validSave() },
          })
        ).status,
      ).toBe(404);
    expect((await call("GET", "/saves/4", { token: tokens["gm1"]! })).status).toBe(403);
    expect((await call("PUT", "/saves/2", { token: t, body: { save: validSave() } })).status).toBe(
      400,
    );
    expect((await call("DELETE", "/saves/1", { token: t })).json).toEqual({ deleted: true });
    expect((await call("GET", "/saves/1", { token: t })).status).toBe(404);
  });

  it("requires a current staff role for GM actions and stores authorized changes", async () => {
    const create = async (nick: string, name: string) => {
      const response = await call("POST", "/characters", {
        token: tokens[nick]!,
        body: { name, race: "legend" },
      });
      expect(response.status).toBe(201);
      return response.json!["character"];
    };
    const player = await create("gracz1", "Wojownik Testowy");
    const staff = await create("gm1", "Mistrz Testowy");
    const gmAction = (nick: string, id: string) =>
      call("POST", `/characters/${id}/action`, {
        token: tokens[nick]!,
        body: { type: "gm_action", op: "add_attribute", stat: "atk", value: 5 },
      });

    expect((await gmAction("gracz1", player.id)).status).toBe(403);
    expect((await gmAction("gm1", player.id)).status).toBe(404);
    expect((await gmAction("gm1", staff.id)).status).toBe(200);

    await sql`DELETE FROM accounts.roles WHERE user_id = ${ids["gm1"]!} AND role = 'gm'`;
    try {
      expect((await gmAction("gm1", staff.id)).status).toBe(403);
      const loaded = await call("GET", `/characters/${staff.id}`, { token: tokens["gm1"]! });
      expect(loaded.json!["character"].state.bonusStats.atk).toBe(5);
      const audits = await sql`
        SELECT details FROM accounts.audit WHERE action = 'GODOT_GM_ACTION' AND target = ${staff.id}
      `;
      expect(audits).toHaveLength(1);
    } finally {
      await sql`INSERT INTO accounts.roles (user_id, role) VALUES (${ids["gm1"]!}, 'gm')`;
    }
  });

  it("lets staff see and manage saves and writes everything to the audit log", async () => {
    await call("PUT", "/saves/2", {
      token: tokens["gracz2"]!,
      body: { baseRevision: 0, save: validSave({ race: "sage", land: "aether" }) },
    });
    expect((await call("GET", "/admin/saves", { token: tokens["gracz1"]! })).status).toBe(403);
    const list = await call("GET", "/admin/saves?q=gracz2", { token: tokens["gm1"]! });
    expect(list.status).toBe(200);
    expect(list.json!["saves"]).toHaveLength(1);
    expect(list.json!["saves"][0]).toMatchObject({
      nick: "gracz2",
      race: "sage",
      land: "aether",
      slot: 2,
    });
    const detail = await call("GET", `/admin/save?account=${ids["gracz2"]}&slot=2`, {
      token: tokens["gm1"]!,
    });
    expect(detail.json!["save"].race).toBe("sage");
    expect(
      (
        await call("DELETE", "/admin/save", {
          token: tokens["gm1"]!,
          body: { account: ids["gracz2"], slot: 2 },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("DELETE", "/admin/save", {
          token: tokens["admin1"]!,
          body: { account: ids["gracz2"], slot: 2 },
        })
      ).json,
    ).toEqual({ deleted: true });
    const overview = await call("GET", "/admin/overview", { token: tokens["gm1"]! });
    expect(overview.json!["releases"][0]).toMatchObject({ version: "2026.11.17.1", packs: 2 });
    expect(overview.json!["settings"].activeVersion).toBe("2026.11.17.1");
    const audit = (await accounts.auditLog()).map((a) => a.action);
    expect(audit).toEqual(
      expect.arrayContaining([
        "GODOT_UPLOAD_PACK",
        "GODOT_CREATE_RELEASE",
        "GODOT_ACTIVATE_RELEASE",
        "GODOT_SETTINGS",
        "GODOT_DELETE_SAVE",
      ]),
    );
  });

  it("refuses to delete the active release, deletes another one with its files", async () => {
    expect(
      (await call("DELETE", "/admin/releases/2026.11.17.1", { token: tokens["admin1"]! })).status,
    ).toBe(400);
    const extra = pack("extra", Buffer.from("extra"));
    await call("PUT", `/admin/releases/old.1/files/${extra.file}`, {
      token: tokens["admin1"]!,
      raw: Buffer.from("extra"),
      headers: { "X-Pack-Sha256": extra.sha256 },
    });
    const m = { format: "ki-godot-content-1", version: "old.1", packs: { extra }, lands: {} };
    expect(
      (await call("POST", "/admin/releases", { token: tokens["admin1"]!, body: { manifest: m } }))
        .status,
    ).toBe(201);
    expect(
      (await call("DELETE", "/admin/releases/old.1", { token: tokens["admin1"]! })).status,
    ).toBe(200);
    expect(await store.manifest("old.1")).toBeNull();
    expect(await store.files.stat("old.1", extra.file)).toBeNull();
  });

  it("shows players of the same land to each other and delivers local chat (not authoritative, cosmetic)", async () => {
    const wsUrl = base.replace("http", "ws").replace("/ws/godot", "") + "/ws/godot/live";
    const open = (token: string, land: string, x: number) =>
      new Promise<{ ws: WebSocket; frames: Record<string, any>[] }>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const frames: Record<string, any>[] = [];
        ws.on("message", (raw) => frames.push(JSON.parse(raw.toString())));
        ws.on("open", () =>
          ws.send(JSON.stringify({ t: "hello", token, race: "legend", land, level: 4, x, y: 100 })),
        );
        ws.on("error", reject);
        const wait = setInterval(() => {
          if (frames.some((f) => f["t"] === "hello_ok")) {
            clearInterval(wait);
            resolve({ ws, frames });
          }
        }, 20);
      });
    const a = await open(tokens["gracz1"]!, "pyra", 100);
    const b = await open(tokens["gracz2"]!, "pyra", 400);
    const far = await open(tokens["gm1"]!, "verdant", 100);
    await new Promise((r) => setTimeout(r, 700));
    const seen = a.frames.filter((f) => f["t"] === "peers").at(-1)!;
    expect(seen["peers"].map((p: { nick: string }) => p.nick)).toEqual(["gracz2"]);
    expect(seen["online"]).toBe(3);
    a.ws.send(JSON.stringify({ t: "chat", text: "  Witaj świecie\u0007  " }));
    a.ws.send(JSON.stringify({ t: "pos", x: 150, y: 120, land: "pyra", level: 5, facing: 3 }));
    await new Promise((r) => setTimeout(r, 700));
    expect(
      b.frames.some(
        (f) => f["t"] === "chat" && f["nick"] === "gracz1" && f["text"] === "Witaj świecie",
      ),
    ).toBe(true);
    expect(far.frames.some((f) => f["t"] === "chat")).toBe(false);
    expect(b.frames.filter((f) => f["t"] === "peers").at(-1)!["peers"][0]).toMatchObject({
      nick: "gracz1",
      level: 5,
      f: 3,
    });
    expect((await call("GET", "/status")).json!["online"]).toBe(3);
    const intruder = await new Promise<number>((resolve) => {
      const ws = new WebSocket(wsUrl);
      ws.on("open", () =>
        ws.send(JSON.stringify({ t: "hello", token: "zly", race: "legend", land: "pyra" })),
      );
      ws.on("close", (code) => resolve(code));
    });
    expect(intruder).toBe(1008);
    for (const c of [a, b, far]) c.ws.close();
  });
});
