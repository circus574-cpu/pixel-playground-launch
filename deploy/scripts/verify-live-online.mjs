/** Run inside the deployed app. Credentials stay in a private operator file, never logs. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

process.on('uncaughtException', error => { console.error(`Live online QA failed: ${error.message}`); process.exit(1); });
process.on('unhandledRejection', () => { console.error('Live online QA rejected an operation; credentials not printed'); process.exit(1); });
setTimeout(() => { console.error('Live online QA timed out'); process.exit(1); }, 120000).unref();

const file = process.argv[2];
assert.match(file ?? '', /^\/tmp\/ki-online-qa-[a-zA-Z0-9_-]+\.json$/);
const base = 'https://kilegends.pl';
const auth = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const admin = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(auth && key && admin, 'Configured Auth credentials required');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function json(url, init = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  assert.ok(r.ok, `HTTP ${r.status} at ${new URL(url).pathname}`);
  return r.json();
}
let data;
if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8'));
else {
  data = { email: `ki-online-qa-${Date.now()}@example.invalid`, password: randomBytes(32).toString('hex'), characters: [] };
  const user = await json(`${auth}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: admin, Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, password: data.password, email_confirm: true, user_metadata: { nick: `QA${Date.now().toString().slice(-10)}` } }),
  });
  data.userId = user.id;
  writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
}
const session = await json(`${auth}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: data.email, password: data.password }),
});
const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
assert.equal((await fetch(`${base}/ws/characters`)).status, 401, 'Unauthenticated API must be guarded');
const result = [];
for (const race of ['planetary', 'sage', 'android', 'legend']) {
  let saved = data.characters.find(c => c.race === race);
  if (!saved) {
    const c = await json(`${base}/ws/characters`, { method: 'POST', headers, body: JSON.stringify({ race, name: `QA${race}` }) });
    saved = { race, id: c.id }; data.characters.push(saved);
    writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  }
  const before = await json(`${base}/ws/characters/${saved.id}`, { headers });
  const socket = new WebSocket('wss://kilegends.pl/ws/online');
  let frame, failure, count = 0;
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'open', token: session.access_token, characterId: saved.id })));
  socket.addEventListener('message', event => {
    const packet = JSON.parse(event.data);
    if (packet.type === 'online_error') failure = packet.code ?? 'online_error';
    if (packet.type === 'state') { frame = packet.frame; count++; }
  });
  const deadline = Date.now() + 25000;
  while (!frame && !failure && Date.now() < deadline) await pause(50);
  assert.ok(frame && !failure, `Initial frame for ${race}: ${failure ?? 'timeout'}`);
  assert.equal(frame.view.staff, null, 'Ordinary QA user must not be staff');
  assert.equal(frame.checkpoint.player.race, race);
  assert.ok(Math.hypot(frame.checkpoint.player.x - before.state.player.x, frame.checkpoint.player.y - before.state.player.y) < 1, 'Reconnect must restore committed position');
  if (saved.position) assert.ok(Math.hypot(frame.checkpoint.player.x - saved.position.x, frame.checkpoint.player.y - saved.position.y) < 1, 'Process restart must retain position');
  const origin = { x: frame.checkpoint.player.x, y: frame.checkpoint.player.y };
  const until = Date.now() + 3500;
  while (Date.now() < until && Math.hypot(frame.checkpoint.player.x - origin.x, frame.checkpoint.player.y - origin.y) < 60) {
    socket.send(JSON.stringify({ type: 'direction', x: 1, y: 0 })); await pause(50);
  }
  socket.send(JSON.stringify({ type: 'direction', x: 0, y: 0 })); await pause(350);
  assert.ok(!failure, 'Session must remain healthy');
  const moved = Math.hypot(frame.checkpoint.player.x - origin.x, frame.checkpoint.player.y - origin.y);
  assert.ok(moved > 20, `Real server movement required for ${race}`);
  socket.close(); await pause(500);
  const after = await json(`${base}/ws/characters/${saved.id}`, { headers });
  assert.ok(after.revision > before.revision);
  assert.ok(Math.hypot(after.state.player.x - frame.checkpoint.player.x, after.state.player.y - frame.checkpoint.player.y) < 1, 'API must read committed movement');
  saved.position = { x: after.state.player.x, y: after.state.player.y };
  writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  result.push({ race, movement: Math.round(moved), frames: count, revision: after.revision, persisted: true });
}
console.log(JSON.stringify({ authenticated: true, publicApiAndSocket: true, fourRaces: result, credentialsLogged: false }));
