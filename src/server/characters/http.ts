import type { IncomingMessage, ServerResponse } from "node:http";
import { CharacterStoreError, type PgCharacterRepository, type Principal } from "./repository";

export type VerifyAccount = (token: unknown) => Promise<Principal>;

/** Only character selection/creation. No endpoint accepts XP, gold, inventory or raw checkpoints. */
export async function characterHttp(
  request: IncomingMessage,
  response: ServerResponse,
  repository: PgCharacterRepository | null,
  verify: VerifyAccount | null,
): Promise<void> {
  const send = (status: number, value: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(value));
  };
  if (!repository || !verify)
    return send(503, {
      error: "ONLINE_STORAGE_UNAVAILABLE",
      message: "Serwer nie jest gotowy do trwałego zapisu postaci. Gra online jest niedostępna.",
    });
  const bearer = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  let principal: Principal;
  try {
    principal = await verify(bearer);
  } catch {
    return send(401, { error: "UNAUTHENTICATED" });
  }
  try {
    const url = new URL(request.url || "", "http://localhost");
    if (request.method === "GET" && url.pathname === "/ws/characters")
      return send(200, { characters: await repository.list(principal) });
    const match = url.pathname.match(/^\/ws\/characters\/([a-f0-9-]{36})$/);
    if (request.method === "DELETE" && match) {
      await repository.retire(principal, match[1]!);
      return send(200, { retired: true });
    }
    if (request.method === "GET" && match)
      return send(200, await repository.read(principal, match[1]!));
    if (request.method !== "POST" || url.pathname !== "/ws/characters")
      return send(405, { error: "METHOD_NOT_ALLOWED" });
    if (!request.headers["content-type"]?.startsWith("application/json"))
      return send(415, { error: "JSON_REQUIRED" });
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 2048) return send(413, { error: "REQUEST_TOO_LARGE" });
      chunks.push(Buffer.from(chunk));
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send(400, { error: "INVALID_JSON" });
    }
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).some((key) => !["race", "name"].includes(key))
    )
      return send(400, { error: "INVALID_CREATE" });
    const input = data as { race?: unknown; name?: unknown };
    return send(201, await repository.create(principal, input.race, input.name));
  } catch (error) {
    if (error instanceof CharacterStoreError)
      return send(error.code === "NOT_FOUND" ? 404 : 409, { error: error.code });
    if (error instanceof Error && error.name === "ZodError")
      return send(400, { error: "INVALID_INPUT" });
    return send(503, { error: "ONLINE_STORAGE_UNAVAILABLE" });
  }
}
