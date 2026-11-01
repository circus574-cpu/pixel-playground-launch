// @vitest-environment node
import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { OnlineSession } from "../server/characters/onlineSession";
import { newPlayer } from "../game/session";
import type { CharacterRecord, PgCharacterRepository } from "../server/characters/repository";
const owner = { project: "https://test.supabase.co", subject: randomUUID() };
function fixture() {
  let record: CharacterRecord = {
    id: randomUUID(),
    revision: 1,
    state: { format: "server-character-1", player: newPlayer("planetary"), runtime: {} },
  };
  let lease: string | undefined,
    failed = false;
  const operations = new Map<string, { digest: string; revision: number }>();
  const repository = {
    async read() {
      return structuredClone(record);
    },
    async acquire(_o: unknown, _i: string, l: string) {
      if (lease) throw Error("SESSION_BUSY");
      lease = l;
    },
    async release(_i: string, l: string) {
      if (lease === l) lease = undefined;
    },
    async receipt(_o: unknown, _i: string, op: string, digest: string) {
      const old = operations.get(op);
      if (old && old.digest !== digest) throw Error("OPERATION_REUSED");
      return old?.revision ?? null;
    },
    async commit(input: Parameters<PgCharacterRepository["commit"]>[0]) {
      if (failed) throw Error("DATABASE_UNAVAILABLE");
      if (input.leaseId !== lease) throw Error("LEASE_LOST");
      expect(input.expectedRevision).toBe(record.revision);
      record = { ...record, revision: record.revision + 1, state: structuredClone(input.state) };
      if (!input.checkpointOnly)
        operations.set(input.operationId, {
          revision: record.revision,
          digest: input.commandDigest,
        });
      return { revision: record.revision, duplicate: false };
    },
  };
  return {
    repository,
    id: record.id,
    fail: () => {
      failed = true;
    },
    read: () => structuredClone(record),
    operations,
  };
}
it("exclusive session, bounded movement, acknowledged persistence and durable retry after reconnect", async () => {
  const f = fixture();
  const first = await OnlineSession.open(f.repository, owner, f.id, path.resolve("public"));
  await expect(
    OnlineSession.open(f.repository, owner, f.id, path.resolve("public")),
  ).rejects.toThrow("SESSION_BUSY");
  const initial = await first.tick();
  first.setDirection(1, 0);
  for (let i = 0; i < 10; i++) await first.tick();
  const moved = first.view();
  expect(moved.view.x).toBeGreaterThan(initial.view.x);
  expect(moved.view.x - initial.view.x).toBeLessThan(100);
  expect(f.read().state.player.x).toBe(moved.view.x);
  const op = randomUUID();
  const receipt = await first.command(op, { type: "dialogue", action: "close" });
  expect(receipt.duplicate).toBe(false);
  expect(f.operations.size).toBe(1);
  await first.close();
  const second = await OnlineSession.open(f.repository, owner, f.id, path.resolve("public"));
  try {
    const retry = await second.command(op, { type: "dialogue", action: "close" });
    expect(retry.duplicate).toBe(true);
    expect(retry.revision).toBe(receipt.revision);
    expect(f.read().revision).toBe(receipt.revision);
    await expect(second.command(op, { type: "rest" })).rejects.toThrow("OPERATION_REUSED");
    await expect(
      second.command(randomUUID(), { type: "move", x: 1, y: 1, xp: 999 }),
    ).rejects.toThrow();
  } finally {
    await second.close();
  }
}, 60000);
it("a failed database commit stops the simulation and cannot emit a successful new frame", async () => {
  const f = fixture();
  const session = await OnlineSession.open(f.repository, owner, f.id, path.resolve("public"));
  await session.tick();
  const saved = f.read();
  f.fail();
  await expect(session.tick()).rejects.toThrow("DATABASE_UNAVAILABLE");
  expect(() => session.view()).toThrow("SESSION_CLOSED");
  await expect(session.command(randomUUID(), { type: "rest" })).rejects.toThrow("SESSION_CLOSED");
  expect(f.read()).toEqual(saved);
  await session.close();
}, 60000);
