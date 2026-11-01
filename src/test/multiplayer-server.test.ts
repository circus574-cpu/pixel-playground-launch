import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { WebSocket } from "ws";
import { GameServer } from "@/server/gameServer";
import type { ClientMessage, ServerMessage } from "@/game/multiplayer/protocol";

const TEST_PORT = 7431;

describe("Real-time Multiplayer GameServer", () => {
  let server: GameServer;

  beforeAll(async () => {
    server = new GameServer({
      port: TEST_PORT,
      nodeId: "test-node-1",
      name: "Test Game Server",
      region: "eu-central (Frankfurt)",
      maxPlayers: 50,
      tickRateHz: 20,
      aoiCellSize: 512,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("responds to HTTP /health endpoint with valid runtime metrics", async () => {
    const health = await new Promise<{
      status: string;
      nodeId: string;
      port: number;
      tickRateHz: number;
    }>((resolve, reject) => {
      http
        .get(`http://localhost:${TEST_PORT}/health`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(JSON.parse(data)));
        })
        .on("error", reject);
    });

    expect(health.status).toBe("ok");
    expect(health.nodeId).toBe("test-node-1");
    expect(health.port).toBe(TEST_PORT);
    expect(health.tickRateHz).toBe(20);
  });

  it("handles WebSocket client authentication and ping/pong", async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    await new Promise<void>((resolve) => ws.on("open", resolve));

    // Send auth
    const authMsg: ClientMessage = {
      type: "auth",
      accountId: "acc-user-1",
      characterId: "char-101",
      nick: "Kaelen_Test",
      race: "planetary",
      level: 12,
      worldId: "verdant",
      x: 1000,
      y: 1000,
    };
    ws.send(JSON.stringify(authMsg));

    const welcomeMsg = await new Promise<ServerMessage>((resolve) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString()) as ServerMessage;
        if (parsed.type === "welcome") resolve(parsed);
      });
    });

    expect(welcomeMsg.type).toBe("welcome");
    if (welcomeMsg.type === "welcome") {
      expect(welcomeMsg.nodeId).toBe("test-node-1");
      expect(welcomeMsg.characterId).toBe("char-101");
      expect(welcomeMsg.aoiCellSize).toBe(512);
    }

    // Ping / Pong
    const pingTime = Date.now();
    ws.send(JSON.stringify({ type: "ping", clientTime: pingTime }));

    const pongMsg = await new Promise<ServerMessage>((resolve) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString()) as ServerMessage;
        if (parsed.type === "pong") resolve(parsed);
      });
    });

    expect(pongMsg.type).toBe("pong");
    if (pongMsg.type === "pong") {
      expect(pongMsg.clientTime).toBe(pingTime);
      expect(pongMsg.serverTime).toBeGreaterThanOrEqual(pingTime);
    }

    ws.close();
  });

  it("synchronizes nearby player positions in 512x512 AOI grid and filters distant players", async () => {
    const ws1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const wsDistant = new WebSocket(`ws://localhost:${TEST_PORT}`);

    await Promise.all([
      new Promise<void>((resolve) => ws1.on("open", resolve)),
      new Promise<void>((resolve) => ws2.on("open", resolve)),
      new Promise<void>((resolve) => wsDistant.on("open", resolve)),
    ]);

    // Player 1 at (1000, 1000) -> cell [1, 1]
    ws1.send(
      JSON.stringify({
        type: "auth",
        accountId: "acc-1",
        characterId: "p1",
        nick: "Player_1",
        race: "planetary",
        level: 10,
        worldId: "verdant",
        x: 1000,
        y: 1000,
      }),
    );

    // Player 2 nearby at (1100, 1050) -> cell [2, 2] within distance <= 1
    ws2.send(
      JSON.stringify({
        type: "auth",
        accountId: "acc-2",
        characterId: "p2",
        nick: "Player_2",
        race: "sage",
        level: 15,
        worldId: "verdant",
        x: 1100,
        y: 1050,
      }),
    );

    // Distant Player at (50000, 50000) -> cell [97, 97] far away
    wsDistant.send(
      JSON.stringify({
        type: "auth",
        accountId: "acc-3",
        characterId: "p3_far",
        nick: "Player_Far",
        race: "android",
        level: 20,
        worldId: "verdant",
        x: 50000,
        y: 50000,
      }),
    );

    // Wait for snapshot on Player 1
    const snapshotForP1 = await new Promise<ServerMessage>((resolve) => {
      ws1.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        if (msg.type === "snapshot" && msg.players.some((p) => p.characterId === "p2")) {
          resolve(msg);
        }
      });
    });

    expect(snapshotForP1.type).toBe("snapshot");
    if (snapshotForP1.type === "snapshot") {
      const p2InSnap = snapshotForP1.players.find((p) => p.characterId === "p2");
      expect(p2InSnap).toBeDefined();
      expect(p2InSnap?.nick).toBe("Player_2");
      expect(p2InSnap?.race).toBe("sage");

      // Verify distant player p3_far is NOT included in p1's snapshot!
      const p3InSnap = snapshotForP1.players.find((p) => p.characterId === "p3_far");
      expect(p3InSnap).toBeUndefined();
    }

    // Test chat broadcast in same world
    ws1.send(JSON.stringify({ type: "chat", text: "Witaj w świecie Verdant!" }));

    const chatReceivedByP2 = await new Promise<ServerMessage>((resolve) => {
      ws2.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        if (msg.type === "chat") resolve(msg);
      });
    });

    expect(chatReceivedByP2.type).toBe("chat");
    if (chatReceivedByP2.type === "chat") {
      expect(chatReceivedByP2.senderNick).toBe("Player_1");
      expect(chatReceivedByP2.text).toBe("Witaj w świecie Verdant!");
    }

    ws1.close();
    ws2.close();
    wsDistant.close();
  });
});
