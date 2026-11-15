// Local full stack for the player walkthrough: the real GameServer (accounts + characters + online runtime) on local PostgreSQL;
// e-mails to Resend are captured instead of sent (GET http://127.0.0.1:7461/ returns the last activation link).
// Needs a PostgreSQL with the deploy/multiplayer migrations on port 55439 (database ki_multiplayer, role ki_game_server).
// NEVER point KI_ACCOUNTS_TEST_DATABASE_URL (npm test) at this database: the account tests TRUNCATE accounts.users.
// Run: npx tsx scripts/qa/playthrough/stack.mts   then   npx vite dev --config scripts/qa/playthrough/fullstack.vite.ts --port 5190
import http from "node:http";
import path from "node:path";
const db = new URL("postgres://postgres@127.0.0.1:55439/ki_multiplayer");
db.searchParams.set("options", "-c role=ki_game_server");
process.env["DATABASE_URL"] = db.toString();
process.env["GAME_SERVER_PORT"] = "7420";
process.env["GAME_ONLINE_REQUIRED"] = "1";
process.env["RESEND_API_KEY"] = "fake-key-for-local-qa";
process.env["PUBLIC_SITE_URL"] = "http://127.0.0.1:5190";
process.env["GAME_WORLD_PUBLIC_ROOT"] = path.resolve("public");
const mails: { to: string; text: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.resend.com/")) {
    const b = JSON.parse(String(init.body));
    mails.push({ to: b.to[0], text: b.text });
    return new Response("{}", { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;
const { GameServer } = await import("../../../src/server/gameServer");
const server = new GameServer({ port: 7420 });
await server.start();
http
  .createServer((req, res) => {
    const last = mails.at(-1);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        count: mails.length,
        to: last?.to,
        link: last && /https?:\/\/\S+/.exec(last.text)?.[0],
      }),
    );
  })
  .listen(7461, () => console.log("QA mail box on 7461; game server on 7420"));
