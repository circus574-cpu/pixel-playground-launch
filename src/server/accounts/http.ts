import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import { AccountError, type AccountService } from "./service";

const MESSAGES: Record<AccountError["code"], [number, string]> = {
  INVALID_INPUT: [400, "Nieprawidłowe dane."],
  EMAIL_TAKEN: [409, "Konto z tym adresem e-mail już istnieje."],
  NICK_TAKEN: [409, "Ten nick jest zajęty."],
  INVALID_CREDENTIALS: [401, "Nieprawidłowy e-mail lub hasło."],
  EMAIL_NOT_CONFIRMED: [403, "Konto nie jest aktywne. Kliknij link w e-mailu aktywacyjnym."],
  ACCOUNT_DISABLED: [403, "Konto jest zablokowane."],
  INVALID_TOKEN: [400, "Link wygasł lub został już użyty."],
  MAIL_NOT_CONFIGURED: [503, "Wysyłka e-maili nie jest jeszcze skonfigurowana na serwerze."],
  FORBIDDEN: [403, "Brak uprawnień."],
};

/** Simple fixed-window limiter per key (IP or e-mail). */
export class RateLimiter {
  private hits = new Map<string, { count: number; until: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}
  /** Forgets a key, e.g. after a successful login, so a person who got in is not locked out by earlier typos. */
  reset(key: string) {
    this.hits.delete(key);
  }
  allow(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || entry.until <= now) {
      if (this.hits.size > 10000) this.hits.clear();
      this.hits.set(key, { count: 1, until: now + this.windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }
}

const perIp = new RateLimiter(30, 60_000);
const perEmail = new RateLimiter(10, 15 * 60_000);

const clientIp = (request: IncomingMessage) =>
  String(request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "")
    .split(",")[0]!
    .trim();

/** Account API under /ws/auth/* (Caddy already routes /ws/* to the game server). */
export async function accountHttp(
  request: IncomingMessage,
  response: ServerResponse,
  service: AccountService | null,
): Promise<void> {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  if (!service)
    return send(503, { error: "ACCOUNTS_UNAVAILABLE", message: "Konta są chwilowo niedostępne." });
  const url = new URL(request.url || "", "http://localhost");
  const path = url.pathname.replace(/^\/ws\/auth/, "") || "/";
  const userAgent = String(request.headers["user-agent"] ?? "");
  if (!perIp.allow(clientIp(request)))
    return send(429, { error: "RATE_LIMITED", message: "Za dużo prób. Spróbuj za minutę." });

  const body = async (): Promise<Record<string, unknown>> => {
    if (!request.headers["content-type"]?.startsWith("application/json"))
      throw new AccountError("INVALID_INPUT");
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 4096) throw new AccountError("INVALID_INPUT");
      chunks.push(Buffer.from(chunk));
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new AccountError("INVALID_INPUT");
    return data as Record<string, unknown>;
  };
  const bearer = () => request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const limitEmail = (email: unknown) => {
    if (typeof email === "string" && !perEmail.allow(email.trim().toLowerCase()))
      throw Object.assign(new Error("RATE"), { rate: true });
  };

  try {
    if (request.method === "GET" && path === "/status")
      return send(200, { mail: service.mailConfigured });
    if (request.method === "GET" && path === "/me") {
      const subject = service.subjectOf(bearer());
      if (!subject) return send(401, { error: "UNAUTHENTICATED" });
      return send(200, { account: await service.view(subject) });
    }
    if (path.startsWith("/admin/")) {
      const subject = service.subjectOf(bearer());
      if (!subject) return send(401, { error: "UNAUTHENTICATED" });
      const roles = await service.roles(subject);
      if (!roles.includes("admin") && !(roles.includes("gm") && request.method === "GET"))
        return send(403, { error: "FORBIDDEN", message: MESSAGES.FORBIDDEN[1] });
      if (request.method === "GET" && path === "/admin/accounts")
        return send(200, { accounts: await service.listAccounts(url.searchParams.get("q") ?? "") });
      if (request.method === "GET" && path === "/admin/audit")
        return send(200, { audit: await service.auditLog() });
      if (request.method === "POST" && path === "/admin/roles") {
        const b = await body();
        await service.setRole(subject, b["userId"], b["role"], b["granted"]);
        return send(200, { ok: true });
      }
      return send(404, { error: "NOT_FOUND" });
    }
    if (request.method !== "POST") return send(405, { error: "METHOD_NOT_ALLOWED" });
    const b = await body();
    switch (path) {
      case "/register":
        limitEmail(b["email"]);
        await service.register({ email: b["email"], password: b["password"], nick: b["nick"] });
        return send(201, {
          ok: true,
          message: "Konto utworzone. Sprawdź skrzynkę e-mail i kliknij link aktywacyjny.",
        });
      case "/confirm":
        return send(200, await service.confirm(b["token"], userAgent));
      case "/resend":
        limitEmail(b["email"]);
        await service.resendConfirmation(b["email"]);
        return send(200, {
          ok: true,
          message: "Jeśli konto czeka na aktywację, wysłaliśmy nowy link.",
        });
      case "/login": {
        limitEmail(b["email"]);
        const session = await service.login(
          { email: b["email"], password: b["password"] },
          userAgent,
        );
        if (typeof b["email"] === "string") perEmail.reset(b["email"].trim().toLowerCase());
        return send(200, session);
      }
      case "/refresh":
        return send(200, await service.refresh(b["refreshToken"], userAgent));
      case "/logout":
        await service.logout(b["refreshToken"]);
        return send(200, { ok: true });
      case "/forgot":
        limitEmail(b["email"]);
        await service.forgotPassword(b["email"]);
        return send(200, {
          ok: true,
          message: "Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.",
        });
      case "/reset":
        return send(
          200,
          await service.resetPassword({ token: b["token"], password: b["password"] }, userAgent),
        );
      default:
        return send(404, { error: "NOT_FOUND" });
    }
  } catch (error) {
    if (error instanceof AccountError) {
      const [status, message] = MESSAGES[error.code];
      return send(status, { error: error.code, message });
    }
    if (error instanceof ZodError || error instanceof SyntaxError)
      return send(400, { error: "INVALID_INPUT", message: MESSAGES.INVALID_INPUT[1] });
    if (error instanceof Error && "rate" in error)
      return send(429, {
        error: "RATE_LIMITED",
        message: "Za dużo prób dla tego adresu. Spróbuj później.",
      });
    console.error("[accounts]", error instanceof Error ? error.message : error);
    return send(503, { error: "ACCOUNTS_UNAVAILABLE", message: "Konta są chwilowo niedostępne." });
  }
}
