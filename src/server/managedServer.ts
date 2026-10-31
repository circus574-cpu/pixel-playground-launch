/**
 * Moduł zarządzania procesem serwera gry bezpośrednio z poziomu aplikacji (bez użycia terminala).
 * Pozwala administratorowi uruchomić i zatrzymać instancję GameServer za pomocą 1 kliknięcia w Panelu Admina.
 */
import { GameServer } from "@/server/gameServer";

let activeServerInstance: GameServer | null = null;
let serverStartedAt: number | null = null;

export interface ManagedServerStatus {
  running: boolean;
  port: number;
  nodeId: string;
  name: string;
  activePlayers: number;
  uptimeSeconds: number;
  startedAt: string | null;
}

export async function startServerFromAdmin(options?: {
  port?: number | undefined;
  nodeId?: string | undefined;
  name?: string | undefined;
  region?: string | undefined;
  maxPlayers?: number | undefined;
  tickRateHz?: number | undefined;
}): Promise<{ ok: boolean; message: string; status: ManagedServerStatus }> {
  if (activeServerInstance) {
    return {
      ok: true,
      message: "Serwer gry już działa w tle.",
      status: getServerStatusFromAdmin(),
    };
  }

  const port = options?.port || Number(process.env["GAME_SERVER_PORT"]) || 7420;
  const nodeId = options?.nodeId || process.env["GAME_SERVER_NODE_ID"] || "eu-central-1";
  const name = options?.name || process.env["GAME_SERVER_NAME"] || "Węzeł Gry EU-Central #1 (Panel Admin)";
  const region = options?.region || process.env["GAME_SERVER_REGION"] || "eu-central (Frankfurt)";
  const maxPlayers = options?.maxPlayers || Number(process.env["GAME_SERVER_MAX_PLAYERS"]) || 250;
  const tickRateHz = options?.tickRateHz || Number(process.env["GAME_SERVER_TICK_RATE"]) || 20.0;
  const databaseUrl = process.env["DATABASE_URL"];

  try {
    const server = new GameServer({
      port,
      nodeId,
      name,
      region,
      maxPlayers,
      tickRateHz,
      databaseUrl,
    });

    await server.start();
    activeServerInstance = server;
    serverStartedAt = Date.now();

    return {
      ok: true,
      message: `Serwer gry '${name}' [${nodeId}] został pomyślnie uruchomiony na porcie ${port} (20 Hz tick, max ${maxPlayers} graczy).`,
      status: getServerStatusFromAdmin(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Błąd startu serwera gry";
    return {
      ok: false,
      message: `Nie udało się uruchomić serwera gry: ${msg}`,
      status: getServerStatusFromAdmin(),
    };
  }
}

export async function stopServerFromAdmin(): Promise<{
  ok: boolean;
  message: string;
  status: ManagedServerStatus;
}> {
  if (!activeServerInstance) {
    return {
      ok: true,
      message: "Serwer gry jest już wyłączony.",
      status: getServerStatusFromAdmin(),
    };
  }

  try {
    await activeServerInstance.stop();
    activeServerInstance = null;
    serverStartedAt = null;

    return {
      ok: true,
      message: "Serwer gry został bezpiecznie zatrzymany.",
      status: getServerStatusFromAdmin(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Błąd zatrzymywania serwera";
    return {
      ok: false,
      message: `Błąd podczas zatrzymywania serwera: ${msg}`,
      status: getServerStatusFromAdmin(),
    };
  }
}

export function getServerStatusFromAdmin(): ManagedServerStatus {
  const isRunning = activeServerInstance !== null;
  const uptime = serverStartedAt ? Math.floor((Date.now() - serverStartedAt) / 1000) : 0;
  return {
    running: isRunning,
    port: activeServerInstance?.getPort() ?? (Number(process.env["GAME_SERVER_PORT"]) || 7420),
    nodeId:
      activeServerInstance?.getNodeId() ??
      (process.env["GAME_SERVER_NODE_ID"] || "eu-central-1"),
    name: process.env["GAME_SERVER_NAME"] || "Węzeł Gry EU-Central #1",
    activePlayers: activeServerInstance?.getSessionCount() ?? 0,
    uptimeSeconds: uptime,
    startedAt: serverStartedAt ? new Date(serverStartedAt).toISOString() : null,
  };
}
