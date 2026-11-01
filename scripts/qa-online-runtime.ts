/** Isolated QA only. Never started by production or accepts public Auth credentials. */
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { WebSocketServer, WebSocket } from "ws";
import { PgCharacterRepository } from "../src/server/characters/repository";
import { OnlineSession } from "../src/server/characters/onlineSession";
import { GameServer } from "../src/server/gameServer";
const url = process.env["KI_ONLINE_TEST_DATABASE_URL"];
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw Error("Local isolated database required");
const sql = postgres(url, { max: 5, connection: { options: "-c role=ki_game_server" } });
const repo = new PgCharacterRepository(sql);
const owner = { project: "https://fixture.invalid", subject: randomUUID() };
await repo.ready();
const c = await repo.create(owner, "planetary", "Tester");
const first = await OnlineSession.open(repo, owner, c.id, path.resolve("public"));
await assert.rejects(OnlineSession.open(repo, owner, c.id, path.resolve("public")), {
  code: "SESSION_BUSY",
});
const frame = await first.tick();
assert.ok(frame.checkpoint.runtime["superior"]);
const op = randomUUID();
const receipt = await first.command(op, { type: "dialogue", action: "close" });
await first.close();
const restored = await OnlineSession.open(repo, owner, c.id, path.resolve("public"));
assert.equal((await restored.command(op, { type: "dialogue", action: "close" })).duplicate, true);
assert.equal((await repo.read(owner, c.id)).revision, receipt.revision);
await restored.tick();
await restored.close();
console.log(
  "POSTGRES runtime: ownership lease, JSONB restore, commit-before-frame and durable retry PASS",
);
// Only this isolated process has a fake account authority. Runtime/HTTP/WS are production code.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const address = new URL(
    typeof input === "string" ? input : input instanceof URL ? input : input.url,
  );
  if (address.origin !== owner.project) return originalFetch(input, init);
  if (new Headers(init?.headers).get("Authorization") !== "Bearer online-fixture-token-only")
    return new Response("{}", { status: 401 });
  return new Response(
    JSON.stringify(address.pathname === "/auth/v1/user" ? { id: owner.subject } : []),
  );
};
const runtimeUrl = new URL(url);
runtimeUrl.searchParams.set("options", "-c role=ki_game_server");
process.env["DATABASE_URL"] = runtimeUrl.toString();
process.env["SUPABASE_URL"] = owner.project;
process.env["SUPABASE_PUBLISHABLE_KEY"] = "fixture-publishable-key";
process.env["GAME_WORLD_PUBLIC_ROOT"] = path.resolve("public");
process.env["GAME_ONLINE_REQUIRED"] = "1";
const game = new GameServer({ port: 7449 });
await game.start();
const control = http.createServer((request, response) => {
  if (
    request.method !== "POST" ||
    request.url !== "/drop" ||
    request.headers.authorization !== "Bearer online-fixture-token-only"
  ) {
    response.writeHead(403).end();
    return;
  }
  // A test-induced transport outage, never an application endpoint or state mutation.
  const wss = Reflect.get(game, "wss") as WebSocketServer;
  for (const socket of wss.clients) socket.terminate();
  response.end("dropped");
});
await new Promise<void>((resolve) => control.listen(7447, "127.0.0.1", resolve));
const ws = new WebSocket("ws://127.0.0.1:7449/ws/online");
await new Promise<void>((resolve, reject) => {
  ws.on("open", () => {
    ws.send(
      JSON.stringify({ type: "open", token: "online-fixture-token-only", characterId: c.id }),
    );
  });
  ws.on("message", (raw) => {
    const p = JSON.parse(raw.toString());
    if (p.type === "state") {
      assert.ok(p.frame.view.ready);
      resolve();
    } else if (p.type === "online_error") reject(Error(p.code));
  });
  ws.on("error", reject);
  setTimeout(() => reject(Error("WS_TIMEOUT")), 10000).unref();
});
ws.close();
console.log(
  "WEBSOCKET actual simulation/state transport PASS; fixture API listening 127.0.0.1:7449",
);
async function close() {
  control.close();
  await game.stop();
  await sql.end();
  globalThis.fetch = originalFetch;
  process.exit(0);
}
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
