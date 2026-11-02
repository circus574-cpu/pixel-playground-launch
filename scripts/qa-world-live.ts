/**
 * Live check of world edits on the real GameServer: publish over HTTP as an admin, then read the
 * server's in-memory catalog. Usage: KI_ACCOUNTS_TEST_DATABASE_URL=… npx tsx scripts/qa-world-live.ts
 */
import postgres from "postgres";
import { GameServer } from "../src/server/gameServer";
import { signAccess, signingKey } from "../src/server/accounts/crypto";
import { MONSTER_DEFS, MONSTERS } from "../src/game/monsters/catalog";

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];
if (!url) throw Error("KI_ACCOUNTS_TEST_DATABASE_URL required");
process.env["DATABASE_URL"] = url;
process.env["AUTH_TOKEN_SECRET"] = "qa-world-live-secret-qa-world-live-secret";
const sql = postgres(url, { max: 1 });
const admin = "22222222-0000-4000-8000-000000000002";
const player = "33333333-0000-4000-8000-000000000003";
await sql`TRUNCATE world_admin.revisions`;
for (const [id, nick] of [
  [admin, "QaAdmin"],
  [player, "QaGracz"],
] as const)
  await sql`INSERT INTO accounts.users (id, email, nick, password_hash, email_confirmed_at)
    VALUES (${id}, ${nick + "@example.com"}, ${nick}, 'x', now()) ON CONFLICT DO NOTHING`;
await sql`INSERT INTO accounts.roles (user_id, role) VALUES (${admin}, 'admin') ON CONFLICT DO NOTHING`;
const server = new GameServer({ port: 7461 });
await server.start();
const base = "http://127.0.0.1:7461/ws/world";
const key = signingKey();
const post = (path: string, who: string | null, body: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(who ? { Authorization: "Bearer " + signAccess(who, key) } : {}),
    },
    body: JSON.stringify(body),
  });
const m = MONSTERS[0]!;
const before = m.hp;
const results: [string, boolean][] = [];
const initial = await (await fetch(base + "/overrides")).json();
results.push(["public GET revision 0", initial.revision === 0]);
results.push([
  "anonymous publish refused",
  (await post("/overrides", null, { data: {}, expectedRevision: 0 })).status === 403,
]);
results.push([
  "player publish refused",
  (await post("/overrides", player, { data: {}, expectedRevision: 0 })).status === 403,
]);
results.push([
  "invalid data refused",
  (
    await post("/overrides", admin, {
      data: { monsters: { [m.id]: { hp: -1 } } },
      expectedRevision: 0,
    })
  ).status === 400,
]);
const ok = await post("/overrides", admin, {
  data: { monsters: { [m.id]: { hp: before + 777 } } },
  expectedRevision: 0,
  note: "QA",
});
results.push(["admin publish 200", ok.status === 200]);
results.push(["server catalog changed live", MONSTER_DEFS[m.id]!.hp === before + 777]);
results.push([
  "stale publish 409",
  (await post("/overrides", admin, { data: {}, expectedRevision: 0 })).status === 409,
]);
const pub = await (await fetch(base + "/overrides")).json();
results.push([
  "public GET revision 1 with edit",
  pub.revision === 1 && pub.data.monsters[m.id].hp === before + 777,
]);
const back = await post("/rollback", admin, { revision: 0 });
results.push(["rollback to canon", back.status === 200 && MONSTER_DEFS[m.id]!.hp === before]);
await server.stop();
await sql.end();
for (const [name, pass] of results) console.log(pass ? "PASS" : "FAIL", name);
process.exit(results.every(([, p]) => p) ? 0 : 1);
