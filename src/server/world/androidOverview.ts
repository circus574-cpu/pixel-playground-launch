import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import type { AndroidAtlasSnapshot } from "@/game/world/androidOverviewTypes";

export async function loadAndroidOverview(path = process.env["KI_ANDROID_OVERVIEW_PATH"]) {
  if (!path) throw Error("Missing administrator atlas path");
  const snapshot = JSON.parse(await readFile(path, "utf8")) as AndroidAtlasSnapshot;
  if (!snapshot.index?.version || !snapshot.index.regions?.length || !snapshot.regions)
    throw Error("Invalid administrator atlas");
  return snapshot;
}

export async function androidOverviewHttp(
  request: IncomingMessage,
  response: ServerResponse,
  adminSubject: (token: string | undefined) => Promise<string | null>,
  readSnapshot: () => Promise<AndroidAtlasSnapshot> = loadAndroidOverview,
): Promise<void> {
  const reply = (status: number, data: unknown) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    });
    response.end(JSON.stringify(data));
  };
  if (request.method !== "GET") {
    reply(405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  try {
    if (!token || !(await adminSubject(token))) {
      reply(403, { error: "FORBIDDEN" });
      return;
    }
    const snapshot = await readSnapshot();
    const land = new URL(request.url ?? "/", "http://localhost").searchParams.get("land");
    if (land === null) {
      reply(200, snapshot.index);
    } else if (Object.hasOwn(snapshot.regions, land)) {
      reply(200, snapshot.regions[land]);
    } else {
      reply(404, { error: "REGION_NOT_FOUND" });
    }
  } catch {
    reply(503, { error: "ATLAS_UNAVAILABLE" });
  }
}
