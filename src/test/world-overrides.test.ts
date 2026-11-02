// @vitest-environment node
/**
 * World edits published from /admin: shared validation, and the full publish → apply →
 * conflict → rollback cycle on a real PostgreSQL (KI_ACCOUNTS_TEST_DATABASE_URL, as in the
 * online-server-qa workflow; skipped by the default quality gate).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { emptyAdminWorldOverrides } from "../game/world/adminWorldStore";
import { sameWorldOverrides, validateWorldOverrides } from "../game/world/worldOverridesSchema";
import { MONSTER_DEFS, MONSTERS } from "../game/monsters/catalog";
import { WorldEditConflict, WorldOverrideService } from "../server/world/overrides";

const monster = MONSTERS[0]!;

describe("world edit validation", () => {
  it("keeps known sections and drops unknown ones", () => {
    const r = validateWorldOverrides({
      monsters: { [monster.id]: { hp: 900 } },
      hacker: { x: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.monsters[monster.id]).toEqual({ hp: 900 });
    expect("hacker" in r.value).toBe(false);
  });

  it.each([
    ["negative stats", { monsters: { [monster.id]: { hp: -5 } } }],
    ["non-object section", { monsters: [] }],
    [
      "unknown spawn monster",
      {
        customSpawns: {
          a: {
            id: "a",
            feature: "verdant",
            kind: "nie-ma",
            x: 1,
            y: 1,
            homeLeash: 1,
            respawnMs: 5000,
          },
        },
      },
    ],
    [
      "unknown land",
      {
        customSpawns: {
          a: {
            id: "a",
            feature: "mars",
            kind: monster.id,
            x: 1,
            y: 1,
            homeLeash: 1,
            respawnMs: 5000,
          },
        },
      },
    ],
    ["huge text", { quests: { q: { summary: "x".repeat(5000) } } }],
  ])("rejects %s", (_name, input) => {
    expect(validateWorldOverrides(input).ok).toBe(false);
  });

  it("compares drafts regardless of key order and timestamp", () => {
    const a = { ...emptyAdminWorldOverrides(), monsters: { m: { hp: 1, atk: 2 } } };
    const b = {
      ...emptyAdminWorldOverrides(),
      updatedAt: "2000-01-01",
      monsters: { m: { atk: 2, hp: 1 } },
    };
    expect(sameWorldOverrides(a, b)).toBe(true);
    expect(sameWorldOverrides(a, emptyAdminWorldOverrides())).toBe(false);
  });
});

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];

describe.runIf(url)("world edits on PostgreSQL", () => {
  const sql = postgres(url ?? "postgres://unused", { max: 2 });
  const admin = "11111111-0000-4000-8000-000000000001";
  const baseHp = monster.hp;

  beforeAll(async () => {
    await sql`TRUNCATE world_admin.revisions`;
    await sql`INSERT INTO accounts.users (id, email, nick, password_hash, email_confirmed_at)
      VALUES (${admin}, 'swiat@example.com', 'Kreator', 'x', now()) ON CONFLICT DO NOTHING`;
  });
  afterAll(async () => {
    await sql.end();
  });

  it("publishes a revision, applies it to the live catalog and records it", async () => {
    const service = new WorldOverrideService(sql);
    await service.ready();
    expect(service.published.revision).toBe(0);
    const next = await service.publish(
      admin,
      { monsters: { [monster.id]: { hp: baseHp + 1234 } } },
      0,
      "Mocniejszy",
    );
    expect(next.revision).toBe(1);
    expect(MONSTER_DEFS[monster.id]!.hp).toBe(baseHp + 1234);
    const [history] = await service.revisions();
    expect(history).toMatchObject({ revision: 1, nick: "Kreator", note: "Mocniejszy", changes: 1 });
  });

  it("a restarted server loads the newest revision", async () => {
    MONSTER_DEFS[monster.id]!.hp = baseHp;
    const restarted = new WorldOverrideService(sql);
    await restarted.ready();
    expect(restarted.published.revision).toBe(1);
    expect(MONSTER_DEFS[monster.id]!.hp).toBe(baseHp + 1234);
  });

  it("rejects a publication based on a stale revision", async () => {
    const service = new WorldOverrideService(sql);
    await service.ready();
    await expect(service.publish(admin, {}, 0)).rejects.toBeInstanceOf(WorldEditConflict);
  });

  it("rolls back to the canonical world as a new revision", async () => {
    const service = new WorldOverrideService(sql);
    await service.ready();
    const back = await service.rollback(admin, 0);
    expect(back.revision).toBe(2);
    expect(MONSTER_DEFS[monster.id]!.hp).toBe(baseHp);
    const audit = await sql<{ action: string }[]>`
      SELECT action FROM accounts.audit WHERE action = 'WORLD_PUBLISH'`;
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});
