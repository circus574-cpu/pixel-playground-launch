/**
 * Seeds the QA database for the Android end-to-end run (scripts/godot/e2e_online.py): clears accounts and Android tables,
 * creates a confirmed administrator and a confirmed player and prints their credentials as JSON.
 * Usage: DATABASE_URL=postgres://… npx tsx scripts/qa-godot-seed.ts
 */
import postgres from "postgres";
import { AccountService } from "../src/server/accounts/service";
import { signingKey } from "../src/server/accounts/crypto";

const url = process.env["DATABASE_URL"];
if (!url) throw Error("DATABASE_URL required");
const sql = postgres(url, { max: 2 });
const outbox: string[] = [];
const service = new AccountService({
  sql,
  mailer: { configured: true, send: async (m) => void outbox.push(m.text) },
  key: signingKey(),
  publicUrl: "http://127.0.0.1:7420",
  realm: "https://kilegends.pl",
});
await sql`UPDATE godot_android.settings SET active_version = NULL, min_client_code = 1, maintenance = false, news = NULL`;
await sql`DELETE FROM godot_android.releases`;
await sql`DELETE FROM godot_android.saves`;
await sql`TRUNCATE accounts.audit, accounts.sessions, accounts.email_tokens, accounts.roles, accounts.users`;
const out: Record<string, { email: string; password: string; nick: string; id: string }> = {};
for (const [nick, admin] of [
  ["e2eadmin", true],
  ["e2egracz", false],
] as const) {
  outbox.length = 0;
  const email = `${nick}@example.com`;
  await service.register({ email, password: "haslo-e2e-12345", nick });
  const link = decodeURIComponent(/aktywacja=([^"&\s]+)/.exec(outbox[0]!)![1]!);
  const session = await service.confirm(link);
  if (admin)
    await sql`INSERT INTO accounts.roles (user_id, role) VALUES (${session.account.id}, 'admin')`;
  out[nick] = { email, password: "haslo-e2e-12345", nick, id: session.account.id };
}
console.log(JSON.stringify(out));
await sql.end();
