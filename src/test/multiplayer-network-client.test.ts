// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { GameServer } from "@/server/gameServer";
import { NetworkClient } from "@/game/multiplayer/networkClient";
import type { NetworkPlayerState } from "@/game/multiplayer/protocol";

const TEST_PORT = 7447;

describe("NetworkClient multiplayer adapter", () => {
  let server: GameServer;

  beforeAll(async () => {
    server = new GameServer({
      port: TEST_PORT,
      nodeId: "test-node-multiplayer",
      name: "Test Game Server",
      maxPlayers: 20,
      tickRateHz: 20,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("handles offline server gracefully without throwing errors (fail-safe)", async () => {
    const offlineClient = new NetworkClient({
      serverUrl: "ws://127.0.0.1:9999", // Nieistniejący port
      autoReconnect: false,
    });

    offlineClient.connect({
      accountId: "acc-offline",
      characterId: "char-offline",
      nick: "Test Offline",
      race: "planetary",
      level: 1,
      worldId: "verdant",
      continent: "verdant",
      x: 100,
      y: 100,
    });

    // Powinno bezpiecznie przejść w stan disconnected
    await new Promise((r) => setTimeout(r, 100));
    const status = offlineClient.getStatus();
    expect(status.connected).toBe(false);
    offlineClient.disconnect();
  });

  it("connects to GameServer, handshakes auth and receives welcome", async () => {
    const client = new NetworkClient({
      serverUrl: `ws://127.0.0.1:${TEST_PORT}`,
      autoReconnect: false,
      webSocketClass: WebSocket as unknown as new (url: string) => globalThis.WebSocket,
    });

    let connectedStatus = false;
    client.onStatus((status) => {
      if (status.connected) connectedStatus = true;
    });

    client.connect({
      accountId: "acc-1",
      characterId: "hero-alice",
      nick: "Alice",
      race: "planetary",
      level: 5,
      worldId: "verdant",
      continent: "verdant",
      x: 200,
      y: 200,
    });

    // Poczekaj na połączenie i welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 3000);
      const check = setInterval(() => {
        if (client.getStatus().connected && client.getStatus().nodeId) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    expect(connectedStatus).toBe(true);
    expect(client.getStatus().nodeId).toBe("test-node-multiplayer");

    client.disconnect();
  });

  it("synchronizes positions between two players in the same AOI cell", async () => {
    const client1 = new NetworkClient({
      serverUrl: `ws://127.0.0.1:${TEST_PORT}`,
      autoReconnect: false,
      webSocketClass: WebSocket as unknown as new (url: string) => globalThis.WebSocket,
    });
    const client2 = new NetworkClient({
      serverUrl: `ws://127.0.0.1:${TEST_PORT}`,
      autoReconnect: false,
      webSocketClass: WebSocket as unknown as new (url: string) => globalThis.WebSocket,
    });

    let client1SawClient2: NetworkPlayerState | undefined;
    client1.onSnapshot((players) => {
      const found = players.find((p) => p.characterId === "hero-bob");
      if (found) client1SawClient2 = found;
    });

    client1.connect({
      accountId: "acc-1",
      characterId: "hero-alice",
      nick: "Alice",
      race: "planetary",
      level: 1,
      worldId: "verdant",
      continent: "verdant",
      x: 300,
      y: 300,
    });

    client2.connect({
      accountId: "acc-2",
      characterId: "hero-bob",
      nick: "Bob",
      race: "sage",
      level: 3,
      worldId: "verdant",
      continent: "verdant",
      x: 310,
      y: 320,
    });

    // Poczekaj na wzajemną widoczność w snapshotach serwera
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Snapshot sync timeout")), 4000);
      const check = setInterval(() => {
        if (client1SawClient2) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    expect(client1SawClient2).toBeDefined();
    expect(client1SawClient2?.characterId).toBe("hero-bob");
    expect(client1SawClient2?.nick).toBe("Bob");
    expect(client1SawClient2?.race).toBe("sage");
    expect(client1SawClient2?.x).toBe(310);
    expect(client1SawClient2?.y).toBe(320);

    // Gracz 2 rusza się
    client2.sendPosition({
      x: 350,
      y: 360,
      vx: 1.5,
      vy: 1.0,
      facing: "right",
      activity: "exploring",
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Position update timeout")), 3000);
      const check = setInterval(() => {
        if (client1SawClient2 && client1SawClient2.x === 350) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    expect(client1SawClient2?.x).toBe(350);
    expect(client1SawClient2?.y).toBe(360);

    // Gracz 2 opuszcza grę
    let leftCharacterId: string | undefined;
    client1.onPlayerLeft((id) => {
      leftCharacterId = id;
    });

    client2.disconnect();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Player left timeout")), 3000);
      const check = setInterval(() => {
        if (leftCharacterId === "hero-bob") {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    expect(leftCharacterId).toBe("hero-bob");

    client1.disconnect();
  });
});
