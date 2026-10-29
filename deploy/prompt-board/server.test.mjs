import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scryptSync } from "node:crypto";
import { makeBoard } from "./server.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
const password = "local-test-only-not-a-production-password";
async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "ki-board-"));
  const catalogFile = path.join(dir, "catalog.json"),
    authFile = path.join(dir, "auth.json");
  await fs.writeFile(
    catalogFile,
    JSON.stringify([
      { id: "icon.one", kind: "icon", prompt: "One icon" },
      { id: "clip.one", kind: "animation", prompt: "Walk" },
      { id: "sound.one", kind: "sfx", prompt: "Sound" },
    ]),
  );
  await fs.writeFile(
    authFile,
    JSON.stringify({
      salt: "test-salt",
      hash: scryptSync(password, "test-salt", 64).toString("hex"),
      sessionKey: "test-session-key",
    }),
  );
  const config = {
    dataDir: path.join(dir, "data"),
    catalogFile,
    authFile,
    secure: false,
    origin: "http://localhost",
    ...options,
  };
  let server = await makeBoard(config);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = () => `http://127.0.0.1:${server.address().port}/prompty/api/`;
  let cookie = "";
  const request = (route, { headers = {}, ...rest } = {}) =>
    fetch(url() + route, {
      ...rest,
      headers: { Origin: "http://localhost", Cookie: cookie, ...headers },
    });
  const login = async () => {
    const r = await request("login", { method: "POST", body: JSON.stringify({ password }) });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
    return cookie;
  };
  const upload = (id, name = "one.png", content = png) =>
    request(`prompts/${id}/upload`, {
      method: "POST",
      headers: { "X-File-Name": encodeURIComponent(name) },
      body: content,
    });
  const restart = async () => {
    await new Promise((r) => server.close(r));
    server = await makeBoard(config);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  };
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await fs.rm(dir, { recursive: true, force: true });
  });
  return { request, login, upload, restart, dir, config };
}
test("anonymous access, download and upload are denied", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("prompts")).status, 401);
  assert.equal((await f.upload("icon.one")).status, 401);
  assert.equal((await f.request("files/123")).status, 401);
});
test("wrong password and cross-origin login are rejected", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request("login", { method: "POST", body: JSON.stringify({ password: "bad" }) }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.request("login", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
        body: JSON.stringify({ password }),
      })
    ).status,
    403,
  );
});
test("upload persists, private download matches SHA and progress survives process restart", async (t) => {
  const f = await fixture(t);
  await f.login();
  const r = await f.upload("icon.one");
  assert.equal(r.status, 201);
  const record = (await r.json()).record;
  assert.equal(record.files.length, 1);
  assert.equal(record.files[0].sha256.length, 64);
  const download = await f.request("files/" + record.files[0].id);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  await f.restart();
  const state = (await (await f.request("prompts")).json()).state;
  assert.equal(state["icon.one"].files[0].sha256, record.files[0].sha256);
});
test("duplicate upload returns conflict and preserves the original", async (t) => {
  const f = await fixture(t);
  await f.login();
  assert.equal((await f.upload("icon.one")).status, 201);
  assert.equal((await f.upload("icon.one")).status, 409);
  assert.equal((await (await f.request("prompts")).json()).state["icon.one"].files.length, 1);
});
test("invalid signature, executable, audio at image target and traversal do not count", async (t) => {
  const f = await fixture(t);
  await f.login();
  assert.equal(
    (await f.upload("icon.one", "bad.png", Buffer.from("<html>not an image</html>"))).status,
    415,
  );
  assert.equal((await f.upload("icon.one", "bad.svg", png)).status, 415);
  assert.equal((await f.upload("icon.one", "bad.wav", png)).status, 415);
  assert.equal((await f.upload("icon.one", "../bad.png")).status, 400);
  assert.deepEqual((await (await f.request("prompts")).json()).state, {});
});
test("oversize and unknown prompt are rejected without recording completion", async (t) => {
  const f = await fixture(t, { maxUpload: 32 });
  await f.login();
  assert.equal((await f.upload("icon.one")).status, 413);
  assert.equal((await f.upload("not-real")).status, 404);
  assert.deepEqual((await (await f.request("prompts")).json()).state, {});
});
test("concurrent different uploads are retained without lost state", async (t) => {
  const f = await fixture(t);
  await f.login();
  const results = await Promise.all([
    f.upload("clip.one", "one.png", png),
    f.upload("clip.one", "two.png", Buffer.concat([png, Buffer.from("variant")])),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.equal((await (await f.request("prompts")).json()).state["clip.one"].files.length, 2);
});
test("mark revision keeps originals; new upload clears flag and retains both versions", async (t) => {
  const f = await fixture(t);
  await f.login();
  await f.upload("icon.one");
  assert.equal((await f.request("prompts/icon.one/revision", { method: "POST" })).status, 200);
  const revised = (await (await f.request("prompts")).json()).state["icon.one"];
  assert.equal(revised.revision, true);
  assert.equal(revised.files.length, 1);
  await new Promise((r) => setTimeout(r, 2));
  await f.upload("icon.one", "two.png", Buffer.concat([png, Buffer.from("new")]));
  const final = (await (await f.request("prompts")).json()).state["icon.one"];
  assert.equal(final.revision, false);
  assert.equal(final.files.length, 2);
  assert.ok(final.files[1].uploadedAt > final.revisedAt);
});
test("storage cap refuses incoming file without changing progress", async (t) => {
  const f = await fixture(t, { maxStorage: 1 });
  await f.login();
  assert.equal((await f.upload("icon.one")).status, 507);
  assert.deepEqual((await (await f.request("prompts")).json()).state, {});
});
test("logout clears private session cookie", async (t) => {
  const f = await fixture(t);
  await f.login();
  const r = await f.request("logout", { method: "POST" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
});
test("login attempts are rate limited", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await f.request("login", { method: "POST", body: JSON.stringify({ password: "bad" }) }))
        .status,
      401,
    );
  assert.equal(
    (await f.request("login", { method: "POST", body: JSON.stringify({ password }) })).status,
    429,
  );
});
test("production admin authorization is verified remotely; ordinary users denied and role removal revokes access", async (t) => {
  const upstream = await import("node:http");
  let isAdmin = false;
  const mock = upstream.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/auth/v1/token"))
      res.end(JSON.stringify({ access_token: "test-access", expires_in: 3600 }));
    else if (req.url === "/auth/v1/user") res.end(JSON.stringify({ id: "owner-id" }));
    else if (req.url.startsWith("/rest/v1/user_roles")) {
      assert.match(req.url, /role=eq.admin/);
      res.end(JSON.stringify(isAdmin ? [{ role: "admin" }] : []));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise((r) => mock.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => mock.close(r)));
  const f = await fixture(t);
  await fs.writeFile(
    f.config.authFile,
    JSON.stringify({
      sessionKey: "production-style-test-key",
      supabase: { url: `http://127.0.0.1:${mock.address().port}`, key: "public-test-key" },
    }),
  );
  await f.restart();
  const login = () =>
    f.request("login", {
      method: "POST",
      body: JSON.stringify({ email: "owner@example.test", password }),
    });
  assert.equal((await login()).status, 403);
  isAdmin = true;
  const good = await login();
  assert.equal(good.status, 200);
  const cookie = good.headers.get("set-cookie").split(";")[0];
  assert.ok(!decodeURIComponent(cookie).includes("test-access"));
  isAdmin = false;
  assert.equal((await f.request("prompts", { headers: { Cookie: cookie } })).status, 401);
});

test("HEAD supports staging redirect, page and health checks", async (t) => {
  const f = await fixture(t);
  const base = (await f.request("prompts")).url.replace("/prompty/api/prompts", "");
  const root = await fetch(base + "/", { method: "HEAD", redirect: "manual" });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), "/prompty/");
  assert.equal((await fetch(base + "/prompty/", { method: "HEAD" })).status, 200);
  assert.equal((await fetch(base + "/healthz", { method: "HEAD" })).status, 200);
});
