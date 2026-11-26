import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import type { AccountService } from "../accounts/service";
import { RateLimiter } from "../accounts/http";
import { ContentError, PACK_FILE_PATTERN, VERSION_PATTERN } from "./contentFiles";
import { RevisionConflict, type GodotStore } from "./store";
import { MAX_SAVE_SLOT, PLAYER_SAVE_SLOTS, SaveRejected } from "./saveRules";
import { ANDROID_ITEM_CATALOG, AndroidEconomyError } from "./economy";
import { ANDROID_GOALS_CATALOG } from "./goals";
import { SERVICE_MESSAGE } from "../serviceAccess";

import type { LivePlayerSummary } from "./live";

export type GodotHttpDeps = {
  store: GodotStore | null;
  accounts: AccountService | null;
  /** Players currently on the live channel (admin overview). */
  online: () => { count: number; byLand: Record<string, number> };
  onlinePlayers?: () => LivePlayerSummary[];
  broadcast?: (message: string) => number;
  settingsChanged?: () => void;
};

const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= MAX_SAVE_SLOT;
const perIp = new RateLimiter(240, 60_000);
const writes = new RateLimiter(40, 60_000);
const uploads = new RateLimiter(60, 60_000);

const clientIp = (request: IncomingMessage) =>
  String(request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "")
    .split(",")[0]!
    .trim();

const CONTENT_ERRORS: Record<ContentError["code"], [number, string]> = {
  BAD_VERSION: [400, "Nieprawidłowa wersja."],
  BAD_FILE: [400, "Nieprawidłowa nazwa paczki."],
  TOO_LARGE: [413, "Paczka jest za duża."],
  HASH_MISMATCH: [422, "Suma SHA-256 lub rozmiar paczki się nie zgadza."],
  MISSING_PACK: [422, "Brakuje paczki z manifestu na serwerze."],
  BAD_MANIFEST: [422, "Manifest jest niepoprawny."],
  NOT_FOUND: [404, "Nie znaleziono."],
};

/** Android game API under /ws/godot/* (Caddy already routes /ws/* to the game server). */
export async function godotHttp(
  request: IncomingMessage,
  response: ServerResponse,
  deps: GodotHttpDeps,
): Promise<void> {
  const send = (status: number, value: unknown, extra: Record<string, string> = {}) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    });
    response.end(JSON.stringify(value));
  };
  const { store, accounts } = deps;
  if (!store || !accounts)
    return send(503, {
      error: "ANDROID_BACKEND_UNAVAILABLE",
      message: "Serwer gry Android jest chwilowo niedostępny.",
    });
  if (!perIp.allow(clientIp(request)))
    return send(429, { error: "RATE_LIMITED", message: "Za dużo żądań. Spróbuj za chwilę." });

  const url = new URL(request.url || "", "http://localhost");
  const path = url.pathname.replace(/^\/ws\/godot/, "") || "/";
  const method = request.method ?? "GET";
  const bearer = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];

  const jsonBody = async (limit: number): Promise<Record<string, unknown>> => {
    if (!request.headers["content-type"]?.startsWith("application/json"))
      throw Object.assign(new Error("JSON"), { http: [415, "JSON_REQUIRED"] });
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > limit)
        throw Object.assign(new Error("LARGE"), { http: [413, "REQUEST_TOO_LARGE"] });
      chunks.push(Buffer.from(chunk));
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Object.assign(new Error("OBJ"), { http: [400, "INVALID_JSON"] });
    return data as Record<string, unknown>;
  };
  const subject = () => {
    const s = accounts.subjectOf(bearer);
    if (!s) throw Object.assign(new Error("AUTH"), { http: [401, "UNAUTHENTICATED"] });
    return s;
  };
  const staff = async (write: boolean) => {
    const s = subject();
    const roles = await accounts.roles(s);
    if (!roles.includes("admin") && !(roles.includes("gm") && !write))
      throw Object.assign(new Error("FORBIDDEN"), { http: [403, "FORBIDDEN"] });
    return s;
  };

  try {
    /* ------------------------------- public ------------------------------- */
    if (method === "GET" && path === "/status") {
      const s = await store.settings();
      const live = deps.online();
      const sub = accounts.subjectOf(bearer);
      const admin = !!sub && (await accounts.roles(sub)).includes("admin");
      return send(200, {
        ok: true,
        serverTime: new Date().toISOString(),
        maintenance: s.maintenance,
        message: s.maintenanceMessage || SERVICE_MESSAGE,
        canEnter: !s.maintenance || admin,
        canPreview: s.maintenance && admin,
        activeVersion: s.activeVersion,
        minClientCode: s.minClientCode,
        online: live.count,
      });
    }

    // Cached manifests must not bypass the switch. Status, auth and admin stay reachable.
    if (path !== "/manifest" && !path.startsWith("/admin/")) {
      const s = await store.settings();
      if (s.maintenance) {
        const sub = accounts.subjectOf(bearer);
        if (!sub || !(await accounts.roles(sub)).includes("admin"))
          return send(503, {
            error: "MAINTENANCE",
            message: s.maintenanceMessage || SERVICE_MESSAGE,
          });
      }
    }

    if (method === "GET" && path === "/manifest") {
      const s = await store.settings();
      const client = Number(url.searchParams.get("client") ?? "0") || 0;
      if (s.maintenance) {
        const sub = accounts.subjectOf(bearer);
        const isStaff = sub ? (await accounts.roles(sub)).includes("admin") : false;
        if (!isStaff)
          return send(503, {
            error: "MAINTENANCE",
            message: s.maintenanceMessage ?? "Trwają prace serwisowe. Spróbuj za chwilę.",
          });
      }
      if (client < s.minClientCode)
        return send(426, {
          error: "UPDATE_REQUIRED",
          message: "Ta wersja aplikacji jest za stara. Zainstaluj nowszą.",
          minClientCode: s.minClientCode,
        });
      if (!s.activeVersion)
        return send(503, {
          error: "NO_RELEASE",
          message: "Serwer nie ma jeszcze opublikowanej treści.",
        });
      const manifest = await store.manifest(s.activeVersion);
      if (!manifest)
        return send(503, { error: "NO_RELEASE", message: "Wydanie nie jest dostępne." });
      return send(200, {
        manifest,
        packBase: `/ws/godot/pack/${s.activeVersion}/`,
        news: s.news,
        minClientCode: s.minClientCode,
      });
    }

    const pack = path.match(/^\/pack\/([^/]+)\/([^/]+)$/);
    if ((method === "GET" || method === "HEAD") && pack) {
      const [, version, file] = pack as unknown as [string, string, string];
      if (!VERSION_PATTERN.test(version) || !PACK_FILE_PATTERN.test(file))
        return send(400, { error: "BAD_FILE" });
      const manifest = await store.manifest(version);
      const entry = manifest && Object.values(manifest.packs).find((p) => p.file === file);
      const stat = entry ? await store.files.stat(version, file) : null;
      if (!entry || !stat) return send(404, { error: "NOT_FOUND" });
      const size = stat.size;
      let start = 0;
      let end = size - 1;
      let status = 200;
      const range = request.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m || (m[1] === "" && m[2] === "")) {
          response.writeHead(416, { "Content-Range": `bytes */${size}` });
          return void response.end();
        }
        if (m[1] === "") {
          start = Math.max(0, size - Number(m[2]));
        } else {
          start = Number(m[1]);
          if (m[2] !== "") end = Math.min(end, Number(m[2]));
        }
        if (start > end || start >= size) {
          response.writeHead(416, { "Content-Range": `bytes */${size}` });
          return void response.end();
        }
        status = 206;
      }
      response.writeHead(status, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        // The file name carries the first 12 hex digits of its SHA-256, so a name never changes content.
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${entry.sha256}"`,
        "X-Content-Type-Options": "nosniff",
        ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      });
      if (method === "HEAD") return void response.end();
      const stream = store.files.open(version, file, { start, end });
      stream.on("error", () => response.destroy());
      stream.pipe(response);
      return;
    }

    /* ------------------------------ cloud saves ----------------------------- */
    if (path === "/saves" && method === "GET")
      return send(200, { saves: await store.listSaves(subject()) });
    const slotMatch = path.match(/^\/saves\/(\d{1,5})$/);
    if (slotMatch && Number(slotMatch[1]) >= 1 && Number(slotMatch[1]) <= MAX_SAVE_SLOT) {
      const slot = Number(slotMatch[1]);
      const who = subject();
      // a player keeps three characters in the cloud; an administrator any number
      if (slot > PLAYER_SAVE_SLOTS && !(await accounts.roles(who)).includes("admin"))
        return send(403, {
          error: "SLOT_LIMIT",
          message: `Chmura ma miejsce na ${PLAYER_SAVE_SLOTS} postacie.`,
        });
      if (method === "GET") {
        const found = await store.readSave(who, slot);
        return found ? send(200, found) : send(404, { error: "NOT_FOUND" });
      }
      if (method === "PUT") {
        if (!writes.allow(who))
          return send(429, { error: "RATE_LIMITED", message: "Za dużo zapisów. Poczekaj chwilę." });
        const body = await jsonBody(1_100_000);
        const base = body["baseRevision"];
        if (typeof base !== "number" || !Number.isInteger(base) || base < 0)
          return send(400, { error: "INVALID_INPUT" });
        const clientCode = Number.isInteger(body["clientCode"]) ? Number(body["clientCode"]) : 0;
        const contentVersion =
          typeof body["contentVersion"] === "string" && VERSION_PATTERN.test(body["contentVersion"])
            ? body["contentVersion"]
            : null;
        return send(
          200,
          await store.writeSave(who, slot, base, body["save"], { clientCode, contentVersion }),
        );
      }
      if (method === "DELETE") return send(200, { deleted: await store.deleteSave(who, slot) });
      return send(405, { error: "METHOD_NOT_ALLOWED" });
    }

    /* ------------------- authoritative Android characters ------------------- */
    if (method === "GET" && path === "/catalog") {
      return send(200, { items: ANDROID_ITEM_CATALOG });
    }
    if (method === "GET" && path === "/goals") {
      const race = url.searchParams.get("race");
      const goals = race
        ? ANDROID_GOALS_CATALOG.filter((g) => g.race === race)
        : ANDROID_GOALS_CATALOG;
      return send(200, { goals });
    }
    if (path === "/characters") {
      const who = subject();
      if (method === "GET") {
        return send(200, { characters: await store.listCharacters(who) });
      }
      if (method === "POST") {
        if (!writes.allow(who))
          return send(429, { error: "RATE_LIMITED", message: "Za dużo żądań. Poczekaj chwilę." });
        const body = await jsonBody(8_000);
        const isAdmin = (await accounts.roles(who)).includes("admin");
        const created = await store.createCharacter(
          who,
          { name: body["name"], race: body["race"] },
          isAdmin,
        );
        return send(201, { character: created });
      }
      return send(405, { error: "METHOD_NOT_ALLOWED" });
    }
    const charMatch = path.match(/^\/characters\/([0-9a-f-]{36})$/);
    if (charMatch) {
      const who = subject();
      const charId = charMatch[1]!;
      if (method === "GET") {
        const found = await store.getCharacter(who, charId);
        return found ? send(200, { character: found }) : send(404, { error: "NOT_FOUND" });
      }
      if (method === "DELETE") {
        const deleted = await store.deleteCharacter(who, charId);
        return send(200, { deleted });
      }
      return send(405, { error: "METHOD_NOT_ALLOWED" });
    }
    const charAct = path.match(/^\/characters\/([0-9a-f-]{36})\/action$/);
    if (charAct && method === "POST") {
      const who = subject();
      if (!writes.allow(who))
        return send(429, { error: "RATE_LIMITED", message: "Za dużo operacji. Poczekaj chwilę." });
      const charId = charAct[1]!;
      const body = await jsonBody(16_000);
      const roles = await accounts.roles(who);
      const isStaff = roles.includes("admin") || roles.includes("gm");
      const result = await store.executeCharacterAction(who, charId, body, { isStaff });
      if (body["type"] === "gm_action") {
        await accounts.audit(who, "GODOT_GM_ACTION", charId, body);
      }
      return send(200, result);
    }

    /* -------------------------------- admin -------------------------------- */
    if (path.startsWith("/admin/")) {
      if (method === "GET" && path === "/admin/overview") {
        await staff(false);
        const live = deps.online();
        return send(200, {
          settings: await store.settings(),
          releases: await store.releases(),
          stats: await store.stats(),
          online: live,
          onlinePlayers: deps.onlinePlayers ? deps.onlinePlayers() : [],
        });
      }
      if (method === "POST" && path === "/admin/broadcast") {
        const actor = await staff(true);
        const body = await jsonBody(2_000);
        const text = String(body["message"] ?? "").trim();
        if (!text || text.length > 240)
          return send(400, { error: "INVALID_INPUT", message: "Wpisz komunikat (1–240 znaków)." });
        const delivered = deps.broadcast ? deps.broadcast(text) : 0;
        await accounts.audit(actor, "GODOT_ADMIN_BROADCAST", null, { text, delivered });
        return send(200, { ok: true, delivered });
      }
      if (method === "GET" && path === "/admin/characters") {
        await staff(false);
        const q = url.searchParams.get("q") ?? "";
        const account = url.searchParams.get("account") ?? undefined;
        if (account && !/^[0-9a-f-]{36}$/.test(account))
          return send(400, { error: "INVALID_INPUT" });
        return send(200, {
          characters: await store.adminListCharacters(q, account),
          catalog: ANDROID_ITEM_CATALOG,
        });
      }
      if (method === "POST" && path === "/admin/characters") {
        const actor = await staff(true);
        const body = await jsonBody(16_000);
        const accountId = String(body["accountId"] ?? "");
        if (!/^[0-9a-f-]{36}$/.test(accountId))
          return send(400, { error: "INVALID_INPUT", message: "Nieprawidłowe ID konta." });
        const character = await store.createCharacter(
          accountId,
          {
            name: body["name"],
            race: body["race"],
            land: body["land"],
            level: body["level"],
            gold: body["gold"],
          },
          true,
        );
        await accounts.audit(actor, "GODOT_ADMIN_CREATE_CHARACTER", character.id, {
          accountId,
          name: character.name,
          race: character.race,
        });
        return send(201, { character });
      }
      const adminCharMatch = path.match(/^\/admin\/characters\/([0-9a-f-]{36})$/);
      if (adminCharMatch) {
        const charId = adminCharMatch[1]!;
        if (method === "GET") {
          await staff(false);
          const found = await store.adminGetCharacter(charId);
          return found
            ? send(200, { character: found, catalog: ANDROID_ITEM_CATALOG })
            : send(404, { error: "NOT_FOUND" });
        }
        if (method === "PATCH") {
          const actor = await staff(true);
          const body = await jsonBody(64_000);
          const character = await store.adminUpdateCharacter(charId, body);
          await accounts.audit(actor, "GODOT_ADMIN_EDIT_CHARACTER", charId, {
            name: character.name,
            race: character.race,
            land: character.land,
            level: character.level,
            gold: character.gold,
          });
          return send(200, { character });
        }
        if (method === "DELETE") {
          const actor = await staff(true);
          const deleted = await store.adminDeleteCharacter(charId);
          await accounts.audit(actor, "GODOT_ADMIN_DELETE_CHARACTER", charId, { deleted });
          return send(200, { deleted });
        }
        return send(405, { error: "METHOD_NOT_ALLOWED" });
      }
      if (method === "GET" && path === "/admin/saves") {
        await staff(false);
        return send(200, { saves: await store.adminSaves(url.searchParams.get("q") ?? "") });
      }
      if (method === "GET" && path === "/admin/save") {
        await staff(false);
        const account = url.searchParams.get("account") ?? "";
        const slot = Number(url.searchParams.get("slot"));
        if (!/^[0-9a-f-]{36}$/.test(account) || !validSlot(slot))
          return send(400, { error: "INVALID_INPUT" });
        const found = await store.readSave(account, slot);
        return found ? send(200, found) : send(404, { error: "NOT_FOUND" });
      }
      const up = path.match(/^\/admin\/releases\/([^/]+)\/files\/([^/]+)$/);
      if (method === "PUT" && up) {
        const actor = await staff(true);
        if (!uploads.allow(actor)) return send(429, { error: "RATE_LIMITED" });
        const [, version, file] = up as unknown as [string, string, string];
        const sha = String(request.headers["x-pack-sha256"] ?? "");
        const bytes = await store.files.save(version, file, request, sha);
        await accounts.audit(actor, "GODOT_UPLOAD_PACK", null, { version, file, bytes });
        return send(200, { ok: true, bytes });
      }
      if (method === "POST" && path === "/admin/releases") {
        const actor = await staff(true);
        const body = await jsonBody(200_000);
        const note = typeof body["note"] === "string" ? body["note"].slice(0, 200) : null;
        const manifest = await store.createRelease(actor, body["manifest"], note);
        await accounts.audit(actor, "GODOT_CREATE_RELEASE", null, {
          version: manifest.version,
          packs: Object.keys(manifest.packs).length,
        });
        return send(201, { ok: true, version: manifest.version });
      }
      if (method === "POST" && path === "/admin/activate") {
        const actor = await staff(true);
        const body = await jsonBody(2_000);
        const version = String(body["version"] ?? "");
        await store.activate(actor, version);
        await accounts.audit(actor, "GODOT_ACTIVATE_RELEASE", null, { version });
        return send(200, { ok: true });
      }
      if (method === "POST" && path === "/admin/settings") {
        const actor = await staff(true);
        const settings = await store.updateSettings(actor, await jsonBody(4_000));
        deps.settingsChanged?.();
        await accounts.audit(actor, "GODOT_SETTINGS", null, settings);
        return send(200, { settings });
      }
      const rel = path.match(/^\/admin\/releases\/([^/]+)$/);
      if (method === "DELETE" && rel) {
        const actor = await staff(true);
        await store.deleteRelease(rel[1]!);
        await accounts.audit(actor, "GODOT_DELETE_RELEASE", null, { version: rel[1] });
        return send(200, { ok: true });
      }
      if (method === "DELETE" && path === "/admin/save") {
        const actor = await staff(true);
        const body = await jsonBody(2_000);
        const account = String(body["account"] ?? "");
        const slot = Number(body["slot"]);
        if (!/^[0-9a-f-]{36}$/.test(account) || !validSlot(slot))
          return send(400, { error: "INVALID_INPUT" });
        const deleted = await store.deleteSave(account, slot);
        await accounts.audit(actor, "GODOT_DELETE_SAVE", account, { slot });
        return send(200, { deleted });
      }
      return send(404, { error: "NOT_FOUND" });
    }
    return send(404, { error: "NOT_FOUND" });
  } catch (error) {
    const known = (error as { http?: [number, string] }).http;
    if (known) return send(known[0], { error: known[1] });
    if (error instanceof AndroidEconomyError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "NAME_TAKEN" || error.code === "QUEST_ALREADY_COMPLETED"
              ? 409
              : error.code === "ARENA_COOLDOWN"
                ? 429
                : 422;
      return send(status, { error: error.code, message: error.message });
    }
    if (error instanceof RevisionConflict)
      return send(409, { error: "REVISION_CONFLICT", serverRevision: error.serverRevision });
    if (error instanceof SaveRejected)
      return send(error.code === "TOO_LARGE" ? 413 : 422, { error: error.code });
    if (error instanceof ContentError) {
      const [status, message] = CONTENT_ERRORS[error.code];
      return send(status, { error: error.code, message });
    }
    if (error instanceof ZodError || error instanceof SyntaxError)
      return send(400, { error: "INVALID_INPUT", message: "Nieprawidłowe dane wejściowe." });
    console.error("[godot-http]", error instanceof Error ? error.message : error);
    return send(503, { error: "ANDROID_BACKEND_UNAVAILABLE" });
  }
}
