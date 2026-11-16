/** Admin client of the measured server status (GET /ws/admin/runtime, see src/server/runtimeStatus.ts). */
import type { RuntimeStatus } from "@/server/runtimeStatus";
import { accessToken } from "./vpsAuth";

export type { CountResult, RuntimeStatus } from "@/server/runtimeStatus";

export class RuntimeStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readRuntimeStatus(): Promise<RuntimeStatus> {
  let response: Response;
  try {
    response = await fetch("/ws/admin/runtime", {
      headers: { Authorization: "Bearer " + (await accessToken()) },
      cache: "no-store",
    });
  } catch {
    throw new RuntimeStatusError(0, "Serwer gry nie odpowiada (brak połączenia).");
  }
  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok)
    throw new RuntimeStatusError(
      response.status,
      data.message ??
        (response.status === 502 || response.status === 503 || response.status === 504
          ? "Serwer gry nie odpowiada."
          : `Błąd ${response.status}`),
    );
  return data as unknown as RuntimeStatus;
}
