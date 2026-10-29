import http from "node:http";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  zip: "application/zip",
};
export function mediaType(bytes, extension) {
  if (
    extension === "png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return mime.png;
  if (
    ["jpg", "jpeg"].includes(extension) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return mime.jpg;
  if (
    ["webp", "wav"].includes(extension) &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === (extension === "webp" ? "WEBP" : "WAVE")
  )
    return mime[extension];
  if (
    extension === "mp3" &&
    (bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224))
  )
    return mime.mp3;
  if (extension === "zip" && bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)
    return mime.zip;
  return null;
}
const httpError = (code, message) => Object.assign(new Error(message), { code });
const equal = (a, b) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function makeBoard({
  dataDir = process.env.BOARD_DATA || "/data",
  catalogFile = process.env.BOARD_CATALOG || path.join(here, "prompts.json"),
  authFile = process.env.BOARD_AUTH || "/run/board-auth.json",
  origin = process.env.BOARD_ORIGIN || "https://staging.kilegends.pl",
  secure = true,
  maxUpload = 48 * 1024 * 1024,
  maxStorage = 4 * 1024 * 1024 * 1024,
} = {}) {
  const catalog = JSON.parse(await fs.readFile(catalogFile, "utf8"));
  const byId = new Map(catalog.map((p) => [p.id, p]));
  if (byId.size !== catalog.length) throw Error("Duplicate prompt IDs");
  const auth = JSON.parse(await fs.readFile(authFile, "utf8"));
  if ((!auth.supabase && (!auth.salt || !auth.hash)) || !auth.sessionKey)
    throw Error("Missing authentication configuration");
  await fs.mkdir(path.join(dataDir, "files"), { recursive: true, mode: 0o700 });
  const stateFile = path.join(dataDir, "state.json");
  let state = { version: 1, prompts: {} };
  try {
    state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (state.version !== 1 || !state.prompts || typeof state.prompts !== "object")
    throw Error("Invalid persisted state; refusing to overwrite");
  const key = createHash("sha256").update(auth.sessionKey).digest();
  const sessions = new Map();
  function seal(value) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  }
  function unseal(value) {
    const b = Buffer.from(value, "base64url"),
      decipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]));
  }
  async function remoteAdmin(token) {
    const headers = { apikey: auth.supabase.key, Authorization: "Bearer " + token };
    const userResponse = await fetch(auth.supabase.url + "/auth/v1/user", {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return false;
    const user = await userResponse.json();
    if (typeof user.id !== "string") return false;
    const rolesResponse = await fetch(
      auth.supabase.url +
        "/rest/v1/user_roles?select=role&user_id=eq." +
        encodeURIComponent(user.id) +
        "&role=eq.admin",
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!rolesResponse.ok) return false;
    const roles = await rolesResponse.json();
    return Array.isArray(roles) && roles.some((r) => r.role === "admin");
  }
  let queue = Promise.resolve();
  const transaction = (task) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  async function persist(next) {
    const tmp = stateFile + "." + randomUUID() + ".tmp";
    const file = await fs.open(tmp, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(next));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await fs.copyFile(stateFile, stateFile + ".previous");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await fs.rename(tmp, stateFile);
    const dir = await fs.open(dataDir, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
    state = next;
  }
  // Only unfinished incoming uploads from an interrupted process, never accepted assets.
  for (const name of await fs.readdir(path.join(dataDir, "files")))
    if (name.endsWith(".incoming")) await fs.unlink(path.join(dataDir, "files", name));
  const attempts = new Map();
  async function authenticated(req) {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("ki_board="))
      ?.slice(9);
    if (!cookie) return false;
    let data;
    try {
      data = unseal(cookie);
    } catch {
      return false;
    }
    if (!Number.isFinite(data.exp) || data.exp <= Date.now()) return false;
    if (!auth.supabase) return true;
    if (typeof data.accessToken !== "string") return false;
    const tokenHash = createHash("sha256").update(data.accessToken).digest("hex");
    const cached = sessions.get(tokenHash);
    if (cached && cached > Date.now()) return true;
    if (!(await remoteAdmin(data.accessToken))) return false;
    for (const [k, expiry] of sessions) if (expiry < Date.now()) sessions.delete(k);
    sessions.set(tokenHash, Date.now() + 5000);
    return true;
  }
  const cookieFlags = `; Path=/prompty; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
  function json(res, code, data) {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  }
  async function body(req, limit = 4096) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw httpError(413, "Za duże żądanie.");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks));
    } catch {
      throw httpError(400, "Nieprawidłowe dane.");
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://local");
      const route = url.pathname;
      if (["GET", "HEAD"].includes(req.method) && route === "/healthz")
        return json(res, 200, { ok: true, release: process.env.BOARD_RELEASE || "local" });
      if (["GET", "HEAD"].includes(req.method) && route === "/") {
        res.writeHead(302, { Location: "/prompty/" });
        return res.end();
      }
      if (
        ["GET", "HEAD"].includes(req.method) &&
        ["/prompty", "/prompty/", "/prompty/app.js", "/prompty/style.css"].includes(route)
      ) {
        const name = route.endsWith("app.js")
          ? "app.js"
          : route.endsWith("style.css")
            ? "style.css"
            : "index.html";
        res.setHeader(
          "Content-Type",
          name.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : name.endsWith(".css")
              ? "text/css; charset=utf-8"
              : "text/html; charset=utf-8",
        );
        return res.end(await fs.readFile(path.join(here, name)));
      }
      if (!route.startsWith("/prompty/api/")) throw httpError(404, "Nie znaleziono.");
      if (!["GET", "HEAD"].includes(req.method) && req.headers.origin !== origin)
        throw httpError(403, "Nieprawidłowe źródło żądania. Odśwież stronę.");
      if (route === "/prompty/api/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress || "unknown";
        const now = Date.now();
        for (const [key, value] of attempts) if (now - value.start > 60000) attempts.delete(key);
        const attempt = attempts.get(ip) || { count: 0, start: now };
        if (attempt.count >= 10) throw httpError(429, "Za dużo prób. Poczekaj minutę.");
        attempt.count++;
        attempts.set(ip, attempt);
        const data = await body(req);
        if (typeof data.password !== "string" || data.password.length > 1024)
          throw httpError(401, "Nieprawidłowe dane logowania.");
        let accessToken,
          expires = now + 24 * 3600000;
        if (auth.supabase) {
          if (typeof data.email !== "string" || data.email.length > 254)
            throw httpError(401, "Podaj e-mail konta administratora.");
          const response = await fetch(auth.supabase.url + "/auth/v1/token?grant_type=password", {
            method: "POST",
            headers: { apikey: auth.supabase.key, "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email, password: data.password }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw httpError(401, "Nieprawidłowy e-mail lub hasło.");
          const result = await response.json();
          accessToken = result.access_token;
          if (typeof accessToken !== "string" || !(await remoteAdmin(accessToken)))
            throw httpError(403, "Warsztat jest dostępny wyłącznie dla administratora gry.");
          expires = now + Math.min(Number(result.expires_in) || 3600, 86400) * 1000;
        } else if (!equal(scryptSync(data.password, auth.salt, 64).toString("hex"), auth.hash))
          throw httpError(401, "Nieprawidłowe hasło.");
        attempts.delete(ip);
        const token = seal({ exp: expires, nonce: randomBytes(16).toString("hex"), accessToken });
        res.setHeader(
          "Set-Cookie",
          `ki_board=${token}; Max-Age=${Math.floor((expires - now) / 1000)}${cookieFlags}`,
        );
        return json(res, 200, { ok: true });
      }
      if (!(await authenticated(req)))
        throw httpError(401, "Zaloguj się kontem administratora Ki Legends.");
      if (route === "/prompty/api/logout" && req.method === "POST") {
        res.setHeader("Set-Cookie", `ki_board=; Max-Age=0${cookieFlags}`);
        return json(res, 200, { ok: true });
      }
      if (route === "/prompty/api/prompts" && req.method === "GET")
        return json(res, 200, { catalog, state: state.prompts, maxUpload });
      if (route === "/prompty/api/export" && req.method === "GET") {
        res.setHeader("Content-Disposition", 'attachment; filename="ki-prompts-progress.json"');
        return json(res, 200, state);
      }
      const match = route.match(/^\/prompty\/api\/prompts\/([^/]+)\/(upload|revision)$/);
      if (match && req.method === "POST") {
        const id = decodeURIComponent(match[1]),
          prompt = byId.get(id);
        if (!prompt) throw httpError(404, "Nieznany prompt.");
        if (match[2] === "revision") {
          await transaction(async () => {
            const next = structuredClone(state);
            const record = next.prompts[id] || { files: [] };
            record.revision = true;
            record.revisedAt = new Date().toISOString();
            next.prompts[id] = record;
            await persist(next);
          });
          return json(res, 200, { ok: true, record: state.prompts[id] });
        }
        let original;
        try {
          original = decodeURIComponent(req.headers["x-file-name"] || "");
        } catch {
          throw httpError(400, "Nieprawidłowa nazwa pliku.");
        }
        if (!original || original.length > 180 || /[\x00-\x1f/\\]/.test(original))
          throw httpError(400, "Nieprawidłowa nazwa pliku.");
        const extension = original.split(".").pop().toLowerCase();
        const allowed =
          prompt.kind === "sfx" || prompt.kind === "ambience"
            ? ["mp3", "wav"]
            : prompt.kind === "animation"
              ? ["png", "jpg", "jpeg", "webp", "zip"]
              : ["png", "jpg", "jpeg", "webp"];
        if (!allowed.includes(extension))
          throw httpError(415, "Ten prompt wymaga: " + allowed.join(", "));
        const advertised = Number(req.headers["content-length"]);
        if (advertised > maxUpload) throw httpError(413, "Maksymalny rozmiar pliku: 48 MB.");
        const disk = await fs.statfs(dataDir);
        if (disk.bavail * disk.bsize < 200 * 1024 * 1024 + maxUpload)
          throw httpError(
            507,
            "Brak bezpiecznego zapasu miejsca na serwerze. Plik nie został zaliczony.",
          );
        const uuid = randomUUID(),
          stored = uuid + "." + extension,
          temporary = path.join(dataDir, "files", uuid + ".incoming");
        const file = await fs.open(temporary, "wx", 0o600);
        const hash = createHash("sha256");
        let bytes = 0,
          head = Buffer.alloc(0),
          type;
        try {
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > maxUpload) throw httpError(413, "Maksymalny rozmiar pliku: 48 MB.");
            if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
            hash.update(chunk);
            await file.writeFile(chunk);
          }
          type = mediaType(head, extension);
          if (!type || bytes < 16)
            throw httpError(415, "Plik nie ma prawidłowego nagłówka obrazu, audio lub ZIP.");
          await file.sync();
        } catch (e) {
          await file.close();
          await fs.unlink(temporary).catch(() => {});
          throw e;
        }
        await file.close();
        try {
          await transaction(async () => {
            const total = Object.values(state.prompts).reduce(
              (sum, p) => sum + p.files.reduce((n, f) => n + f.bytes, 0),
              0,
            );
            if (total + bytes > maxStorage)
              throw httpError(
                507,
                "Limit magazynu 4 GB. Zachowaj plik lokalnie i skontaktuj się z administratorem.",
              );
            const sha256 = hash.digest("hex"),
              old = state.prompts[id] || { files: [] };
            if (old.files.some((f) => f.sha256 === sha256))
              throw httpError(409, "Ten sam plik jest już zapisany przy tym prompcie.");
            const next = structuredClone(state),
              record = next.prompts[id] || { files: [] };
            const uploadedAt = new Date().toISOString();
            const metadata = { id: uuid, stored, name: original, bytes, sha256, type, uploadedAt };
            await fs.rename(temporary, path.join(dataDir, "files", stored));
            record.files.push(metadata);
            record.revision = false;
            record.updatedAt = uploadedAt;
            next.prompts[id] = record;
            // A persistence failure leaves an unindexed file, never a falsely completed prompt.
            await persist(next);
          });
        } finally {
          await fs.unlink(temporary).catch(() => {});
        }
        return json(res, 201, { ok: true, record: state.prompts[id] });
      }
      const download = route.match(/^\/prompty\/api\/files\/([a-f0-9-]+)$/);
      if (download && req.method === "GET") {
        const file = Object.values(state.prompts)
          .flatMap((p) => p.files)
          .find((f) => f.id === download[1]);
        if (!file) throw httpError(404, "Nie znaleziono pliku.");
        const target = path.join(dataDir, "files", file.stored);
        await fs.access(target);
        res.setHeader("Content-Type", file.type);
        res.setHeader("Content-Length", file.bytes);
        res.setHeader(
          "Content-Disposition",
          `${url.searchParams.has("preview") && file.type !== "application/zip" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        );
        const stream = createReadStream(target);
        stream.on("error", () => res.destroy());
        stream.pipe(res);
        return;
      }
      throw httpError(404, "Nie znaleziono.");
    } catch (e) {
      if (res.headersSent || res.destroyed) return;
      const code = Number.isInteger(e.code) ? e.code : 500;
      if (code >= 500) console.error("board request error", e.code || e.name); // Never body, password or file contents.
      json(res, code, {
        error:
          code === 500
            ? "Nie udało się zapisać danych. Prompt nie został zaliczony. Spróbuj ponownie."
            : e.message,
      });
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await makeBoard();
  server.listen(Number(process.env.PORT || 3000), "0.0.0.0");
}
