/** Browser client of the world edits published on the game server (/ws/world/*). */
import { accessToken } from "../account/vpsAuth";
import { emptyAdminWorldOverrides, type AdminWorldOverrides } from "./adminWorldStore";
import { validateWorldOverrides } from "./worldOverridesSchema";

export type PublishedWorld = {
  revision: number;
  publishedAt: string | null;
  publishedBy: string | null;
  data: AdminWorldOverrides;
};
export type WorldRevision = {
  revision: number;
  publishedAt: string;
  publishedBy: string | null;
  nick: string | null;
  note: string | null;
  changes: number;
};

export class WorldPublishError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = "Bearer " + (await accessToken());
  const response = await fetch("/ws/world" + path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  } & T;
  if (!response.ok)
    throw new WorldPublishError(
      data.error ?? "HTTP_" + response.status,
      data.message ?? "Serwer świata jest chwilowo niedostępny.",
    );
  return data;
}

function checked(world: PublishedWorld): PublishedWorld {
  const v = validateWorldOverrides(world.data);
  return { ...world, data: v.ok ? v.value : emptyAdminWorldOverrides() };
}

/** The world currently published on the server (revision 0 = canon without edits). */
export async function fetchPublishedWorld(signal?: AbortSignal): Promise<PublishedWorld> {
  const response = await fetch("/ws/world/overrides", {
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new WorldPublishError("HTTP_" + response.status, "Brak danych świata.");
  return checked((await response.json()) as PublishedWorld);
}

export async function publishWorld(
  data: AdminWorldOverrides,
  expectedRevision: number,
  note?: string,
): Promise<PublishedWorld> {
  return checked(await call<PublishedWorld>("/overrides", { data, expectedRevision, note }, true));
}

export async function worldRevisions(): Promise<WorldRevision[]> {
  return (await call<{ revisions: WorldRevision[] }>("/revisions", undefined, true)).revisions;
}

export async function rollbackWorld(revision: number): Promise<PublishedWorld> {
  return checked(await call<PublishedWorld>("/rollback", { revision }, true));
}
