import http from "node:http";
import { characterHttp } from "../src/server/characters/http";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { PgCharacterRepository, commandDigest } from "../src/server/characters/repository";
const url = process.env["KI_ONLINE_TEST_DATABASE_URL"];
if (!url) throw Error("Set KI_ONLINE_TEST_DATABASE_URL to an isolated test DB, never production");
const db = postgres(url, { max: 3, connection: { options: "-c role=ki_game_server" } }),
  repo = new PgCharacterRepository(db);
const owner = { project: "https://fixture.invalid", subject: randomUUID() },
  other = { ...owner, subject: randomUUID() };
let count = 0;
try {
  await repo.ready();
  count++;
  const c = await repo.create(owner, "planetary", "Tester");
  assert.equal(c.state.player.level, 1);
  count++;
  assert.equal((await repo.list(other)).length, 0);
  await assert.rejects(() => repo.read(other, c.id), { code: "NOT_FOUND" });
  count++;
  const next = structuredClone(c.state);
  next.player.gold = 44;
  next.runtime = { cooldowns: { R: 300 } };
  const op = {
    principal: owner,
    characterId: c.id,
    expectedRevision: 1,
    operationId: randomUUID(),
    commandDigest: commandDigest({ type: "fixture-server-tick" }),
    state: next,
  };
  assert.deepEqual(await repo.commit(op), { revision: 2, duplicate: false });
  count++;
  assert.deepEqual(await repo.commit(op), { revision: 2, duplicate: true });
  count++;
  await assert.rejects(
    () => repo.commit({ ...op, commandDigest: commandDigest({ type: "different" }) }),
    { code: "OPERATION_REUSED" },
  );
  count++;
  await assert.rejects(() => repo.commit({ ...op, principal: other }), { code: "NOT_FOUND" });
  count++;
  const concurrent = await Promise.allSettled([
    repo.commit({ ...op, operationId: randomUUID(), expectedRevision: 2 }),
    repo.commit({ ...op, operationId: randomUUID(), expectedRevision: 2 }),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  count++;
  const fresh = new PgCharacterRepository(db),
    restored = await fresh.read(owner, c.id);
  assert.equal(restored.revision, 3);
  assert.equal(restored.state.player.gold, 44);
  assert.deepEqual(restored.state.runtime, { cooldowns: { R: 300 } });
  count++;
  const bad = structuredClone(restored.state);
  bad.player.race = "legend";
  await assert.rejects(
    () => repo.commit({ ...op, operationId: randomUUID(), expectedRevision: 3, state: bad }),
    { code: "INVALID_STATE" },
  );
  assert.equal((await repo.read(owner, c.id)).revision, 3);
  count++;
  for (const race of ["sage", "android", "legend"] as const) {
    const fresh = await repo.create(owner, race, "Tester");
    assert.equal(fresh.state.player.race, race);
    count++;
  }
  const server = http.createServer((req, res) => {
    void characterHttp(req, res, repo, async (token) => {
      if (token !== "fixture-token") throw Error("UNAUTHENTICATED");
      return owner;
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/ws/characters`;
    assert.equal((await fetch(base)).status, 401);
    count++;
    const response = await fetch(base, { headers: { Authorization: "Bearer fixture-token" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).characters.length, 4);
    count++;
    const forged = await fetch(base, {
      method: "POST",
      headers: { Authorization: "Bearer fixture-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        race: "planetary",
        name: "Tester",
        gold: 99999,
        accountId: other.subject,
      }),
    });
    assert.equal(forged.status, 400);
    count++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log(
    JSON.stringify({
      passed: count,
      failed: 0,
      scope: "real isolated PostgreSQL17, actual repository, ownership/CAS/idempotency/readback",
    }),
  );
} finally {
  await db.end();
}
