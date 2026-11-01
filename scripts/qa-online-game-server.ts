/** Exercise the production GameServer wrapper against LOCAL PostgreSQL and a fake Auth authority. */
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { GameServer } from "../src/server/gameServer";
const database = process.env["KI_ONLINE_TEST_DATABASE_URL"];
if (!database || new URL(database).hostname !== "127.0.0.1")
  throw Error("Local isolated database required");
const dbUrl = new URL(database);
dbUrl.searchParams.set("options", "-c role=ki_game_server");
process.env["DATABASE_URL"] = dbUrl.toString();
process.env["SUPABASE_URL"] = "https://fixture.invalid";
process.env["SUPABASE_PUBLISHABLE_KEY"] = "fixture-publishable-key";
process.env["GAME_WORLD_PUBLIC_ROOT"] = path.resolve("public");
process.env["GAME_ONLINE_REQUIRED"] = "1";
const identities = new Map([
  ["fixture-first-player-token", randomUUID()],
  ["fixture-second-player-token", randomUUID()],
]);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
  if (url.origin !== "https://fixture.invalid") return originalFetch(input, init);
  const token = new Headers(init?.headers).get("Authorization")?.slice(7) ?? "";
  const id = identities.get(token);
  if (!id) return new Response("{}", { status: 401 });
  return new Response(JSON.stringify(url.pathname === "/auth/v1/user" ? { id } : []));
};
const server = new GameServer({ port: 7448 });
const sockets: WebSocket[] = [];
try {
  await server.start();
  const health = await (await fetch("http://127.0.0.1:7448/health")).json();
  assert.equal(health.characterPersistenceReady, true);
  for (const token of identities.keys()) {
    const response = await fetch("http://127.0.0.1:7448/ws/characters", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ race: "planetary", name: "Tester" }),
    });
    assert.equal(response.status, 201);
    const character = await response.json();
    const socket = new WebSocket("ws://127.0.0.1:7448/ws/online");
    sockets.push(socket);
    socket.on("open", () =>
      socket.send(JSON.stringify({ type: "open", token, characterId: character.id })),
    );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("state timeout")), 15000);
      socket.on("message", (raw) => {
        const p = JSON.parse(raw.toString());
        if (p.type === "state") {
          assert.equal(p.frame.view.staff, null);
          clearTimeout(timer);
          resolve();
        } else if (p.type === "online_error") reject(Error(p.code));
      });
    });
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("peer timeout")), 15000);
    sockets[0]!.on("message", (raw) => {
      const p = JSON.parse(raw.toString());
      if (p.type === "state" && p.frame.peers.length === 1) {
        clearTimeout(timer);
        assert.notEqual(p.frame.peers[0].characterId, p.frame.characterId);
        resolve();
      }
    });
  });
  assert.equal(server.getSessionCount(), 2);
  assert.equal(server.getActiveSessions().length, 2);
  const legacy = new WebSocket("ws://127.0.0.1:7448/ws");
  assert.equal(await new Promise<number>((resolve) => legacy.on("close", resolve)), 1008);
  console.log(
    JSON.stringify({
      passed: 6,
      failed: 0,
      scope:
        "production GameServer wrapper, required PostgreSQL, verified fixture identities, two players/AOI peers, staff denied, legacy relay disabled",
    }),
  );
} finally {
  for (const socket of sockets) socket.close();
  await server.stop();
  globalThis.fetch = originalFetch;
}
