/**
 * Local QA server for the account flow: the real AccountService and /ws/auth API on PostgreSQL,
 * with e-mails captured instead of sent. GET /qa/last-mail returns the newest captured link.
 * Usage: KI_ACCOUNTS_TEST_DATABASE_URL=… npx tsx scripts/qa-accounts-server.ts
 */
import http from "node:http";
import postgres from "postgres";
import { accountHttp } from "../src/server/accounts/http";
import { AccountService } from "../src/server/accounts/service";
import type { Mail } from "../src/server/accounts/mailer";

const url = process.env["KI_ACCOUNTS_TEST_DATABASE_URL"];
if (!url) throw Error("KI_ACCOUNTS_TEST_DATABASE_URL required");
const sql = postgres(url, { max: 4 });
const outbox: Mail[] = [];
const service = new AccountService({
  sql,
  mailer: { configured: true, send: async (m) => void outbox.push(m) },
  key: Buffer.alloc(32, 9),
  publicUrl: process.env["QA_PUBLIC_URL"] ?? "http://127.0.0.1:5190",
  realm: "https://kilegends.pl",
});
await sql`TRUNCATE accounts.audit, accounts.sessions, accounts.email_tokens, accounts.roles, accounts.users`;
http
  .createServer((req, res) => {
    if (req.url === "/qa/last-mail") {
      const last = outbox.at(-1);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          count: outbox.length,
          link: last && /https?:\/\/\S+/.exec(last.text)?.[0],
        }),
      );
      return;
    }
    void accountHttp(req, res, service);
  })
  .listen(7457, () => console.log("accounts QA on 7457"));
