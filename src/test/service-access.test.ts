// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceAccess } from "../server/serviceAccess";
import { godotHttp } from "../server/godot/http";
import { GodotLive } from "../server/godot/live";
import type { AccountService } from "../server/accounts/service";
import type { GodotStore, Settings } from "../server/godot/store";
import { characterHttp } from "../server/characters/http";
import type { PgCharacterRepository } from "../server/characters/repository";
import { serveOnlineSocket } from "../server/characters/socket";

const settings: Settings = {
  maintenance: true,
  maintenanceMessage: "Konserwacja świata",
  minClientCode: 1,
  activeVersion: "test",
  news: null,
  updatedAt: new Date().toISOString(),
};
const accounts = {
  subjectOf: (token: unknown) =>
    ["admin", "gm", "player"].includes(String(token)) ? String(token) : null,
  roles: async (subject: string) =>
    subject === "admin" ? ["admin"] : subject === "gm" ? ["gm"] : [],
  view: async (subject: string) => ({ nick: subject }),
  assertActive: async () => {},
} as unknown as AccountService;
const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function listen(handler: http.RequestListener) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe("TEST SERWER admission", () => {
  it("admits only a database administrator, then reopens without modifying any saves", async () => {
    let held = { ...settings };
    const access = new ServiceAccess(
      () => ({ settings: async () => held }),
      () => accounts,
    );
    for (const token of [undefined, "forged-admin", "player", "gm"])
      await expect(access.require(token)).rejects.toThrow("MAINTENANCE");
    await expect(access.require("admin")).resolves.toBeUndefined();
    held = { ...held, maintenance: false };
    access.invalidate();
    for (const token of [undefined, "player", "gm", "admin"])
      await expect(access.require(token)).resolves.toBeUndefined();
  });

  it("does not retain the administrator exception after role revocation or a settings outage", async () => {
    let revoked = false,
      broken = false;
    const access = new ServiceAccess(
      () => ({
        settings: async () => {
          if (broken) throw Error("offline");
          return settings;
        },
      }),
      () => ({ subjectOf: accounts.subjectOf, roles: async () => (revoked ? [] : ["admin"]) }),
    );
    await access.require("admin");
    revoked = true;
    await expect(access.require("admin")).rejects.toThrow("MAINTENANCE");
    broken = true;
    access.invalidate();
    await expect(access.require("admin")).rejects.toThrow("offline");
    await expect(
      new ServiceAccess(
        () => null,
        () => accounts,
      ).require(),
    ).rejects.toThrow("SERVICE_UNAVAILABLE");
  });

  it("guards manifests, direct pack GET/HEAD/Range and every save operation; status and admin login remain reachable", async () => {
    const read = vi.fn(async () => []);
    const store = {
      settings: async () => settings,
      listSaves: read,
      manifest: async () => ({ packs: {}, version: "test" }),
    } as unknown as GodotStore;
    const { base } = await listen(
      (req, res) =>
        void godotHttp(req, res, { store, accounts, online: () => ({ count: 0, byLand: {} }) }),
    );
    const request = (path: string, method = "GET", token?: string) =>
      fetch(base + "/ws/godot" + path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Range: "bytes=0-9" },
      });
    for (const token of [undefined, "player", "gm", "forged-admin"]) {
      for (const [path, method] of [
        ["/manifest?client=100", "GET"],
        ["/pack/test/core-123.pck", "GET"],
        ["/pack/test/core-123.pck", "HEAD"],
        ["/saves", "GET"],
        ["/saves/1", "PUT"],
        ["/saves/1", "DELETE"],
      ])
        expect((await request(path!, method!, token)).status).toBe(503);
    }
    expect(read).not.toHaveBeenCalled();
    expect(await (await request("/status")).json()).toMatchObject({
      maintenance: true,
      canEnter: false,
      canPreview: false,
    });
    expect(await (await request("/status", "GET", "admin")).json()).toMatchObject({
      canEnter: true,
      canPreview: true,
    });
    expect((await request("/manifest?client=100", "GET", "admin")).status).toBe(200);
    expect((await request("/saves", "GET", "admin")).status).toBe(200);
  });

  it("rejects direct browser character requests before reading or writing the repository", async () => {
    const read = vi.fn();
    const repository = { list: read, create: read } as unknown as PgCharacterRepository;
    const access = new ServiceAccess(
      () => ({ settings: async () => settings }),
      () => accounts,
    );
    const { base } = await listen(
      (req, res) =>
        void characterHttp(
          req,
          res,
          repository,
          async () => ({ project: "test", subject: "player" }),
          (token) => access.require(token),
        ),
    );
    for (const method of ["GET", "POST", "DELETE"]) {
      const response = await fetch(base + "/ws/characters", {
        method,
        headers: { Authorization: "Bearer player" },
      });
      expect(response.status).toBe(503);
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects a direct browser socket without opening a character lease", async () => {
    const read = vi.fn();
    const { server, base } = await listen((_req, res) => res.end());
    const wss = new WebSocketServer({ server });
    cleanup.push(() => wss.close());
    wss.on("connection", (socket) =>
      serveOnlineSocket(socket, {
        repository: { read } as unknown as PgCharacterRepository,
        verify: async () => ({ project: "test", subject: "player" }),
        admission: async () => {
          throw Error("MAINTENANCE");
        },
      }),
    );
    const client = new WebSocket(base.replace("http:", "ws:"));
    cleanup.push(() => client.terminate());
    await once(client, "open");
    const packet = once(client, "message");
    client.send(
      JSON.stringify({
        type: "open",
        token: "player-token-long-enough",
        characterId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(JSON.parse(String((await packet)[0]))).toMatchObject({
      type: "online_error",
      code: "MAINTENANCE",
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("closes an already connected Android player after the switch, keeps admin, and rejects GM", async () => {
    let closed = false;
    const { server, base } = await listen((_req, res) => res.end());
    const live = new GodotLive(
      () => accounts,
      async (token) => {
        if (closed && token !== "admin") throw Error("MAINTENANCE");
      },
    );
    cleanup.push(() => live.closeAll());
    const wss = new WebSocketServer({ server });
    cleanup.push(() => wss.close());
    wss.on("connection", (socket) => live.attach(socket));
    const connect = async (token: string, expectHello = true) => {
      const ws = new WebSocket(base.replace("http:", "ws:"));
      cleanup.push(() => ws.terminate());
      await once(ws, "open");
      const hello = expectHello ? once(ws, "message") : once(ws, "close");
      ws.send(JSON.stringify({ t: "hello", token, race: "legend", land: "pyra" }));
      await hello;
      return ws;
    };
    const player = await connect("player");
    const admin = await connect("admin");
    const disconnected = once(player, "close");
    closed = true;
    await disconnected;
    expect(admin.readyState).toBe(WebSocket.OPEN);
    const gm = await connect("gm", false);
    expect(gm.readyState).toBe(WebSocket.CLOSED);
    closed = false;
    const returned = await connect("player");
    expect(returned.readyState).toBe(WebSocket.OPEN);
  }, 6000);
});
