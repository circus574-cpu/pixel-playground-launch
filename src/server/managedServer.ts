/**
 * Moduł zarządzania procesem serwera gry bezpośrednio z poziomu aplikacji (bez użycia terminala).
 * Pozwala administratorowi uruchomić i zatrzymać instancję GameServer za pomocą 1 kliknięcia w Panelu Admina.
 */
import type { NetworkPlayerState } from "@/game/multiplayer/protocol";
import { GameServer } from "@/server/gameServer";

let activeServerInstance: GameServer | null = null;
export function getActiveGameServer(): GameServer | null {
  return activeServerInstance;
}
let serverStartedAt: number | null = null;

export interface ManagedServerStatus {
  running: boolean;
  port: number;
  nodeId: string;
  name: string;
  region: string;
  maxPlayers: number;
  tickRateHz: number;
  activePlayers: number;
  uptimeSeconds: number;
  startedAt: string | null;
  players: NetworkPlayerState[];
  tickP50Ms: number;
  tickP95Ms: number;
  packetsInSec: number;
  packetsOutSec: number;
}

async function startServerCore(options?: {
  port?: number | undefined;
  nodeId?: string | undefined;
  name?: string | undefined;
  region?: string | undefined;
  maxPlayers?: number | undefined;
  tickRateHz?: number | undefined;
}): Promise<{ ok: boolean; message: string; status: ManagedServerStatus }> {
  if (activeServerInstance) {
    if (options) {
      activeServerInstance.updateConfig({
        ...(options.name ? { name: options.name } : {}),
        ...(options.region ? { region: options.region } : {}),
        ...(options.maxPlayers ? { maxPlayers: options.maxPlayers } : {}),
        ...(options.tickRateHz ? { tickRateHz: options.tickRateHz } : {}),
      });
    }
    return {
      ok: true,
      message: "Serwer gry już działa w tle — zaktualizowano jego parametry.",
      status: getServerStatusFromAdmin(),
    };
  }

  const port = options?.port || Number(process.env["GAME_SERVER_PORT"]) || 7420;
  const nodeId = options?.nodeId || process.env["GAME_SERVER_NODE_ID"] || "eu-central-1";
  const name =
    options?.name || process.env["GAME_SERVER_NAME"] || "Węzeł Gry EU-Central #1 (Panel Admin)";
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
      message: `Serwer gry '${name}' [${nodeId}] został pomyślnie uruchomiony na porcie ${port} (${tickRateHz} Hz tick, max ${maxPlayers} graczy).`,
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

let starting: ReturnType<typeof startServerCore> | undefined;
export async function startServerFromAdmin(options?: Parameters<typeof startServerCore>[0]) {
  if (starting) return starting;
  starting = startServerCore(options);
  try {
    return await starting;
  } finally {
    starting = undefined;
  }
}

export async function stopServerFromAdmin(): Promise<{
  ok: boolean;
  message: string;
  status: ManagedServerStatus;
}> {
  if (starting) await starting;
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
  const cfg = activeServerInstance?.getConfig();
  const metrics = activeServerInstance?.getMetrics();
  return {
    running: isRunning,
    port: cfg?.port ?? (Number(process.env["GAME_SERVER_PORT"]) || 7420),
    nodeId: cfg?.nodeId ?? (process.env["GAME_SERVER_NODE_ID"] || "eu-central-1"),
    name: cfg?.name ?? (process.env["GAME_SERVER_NAME"] || "Węzeł Gry EU-Central #1"),
    region: cfg?.region ?? (process.env["GAME_SERVER_REGION"] || "eu-central (Frankfurt)"),
    maxPlayers: cfg?.maxPlayers ?? (Number(process.env["GAME_SERVER_MAX_PLAYERS"]) || 250),
    tickRateHz: cfg?.tickRateHz ?? (Number(process.env["GAME_SERVER_TICK_RATE"]) || 20.0),
    activePlayers: activeServerInstance?.getSessionCount() ?? 0,
    uptimeSeconds: uptime,
    startedAt: serverStartedAt ? new Date(serverStartedAt).toISOString() : null,
    players: activeServerInstance?.getActiveSessions() ?? [],
    tickP50Ms: metrics?.tickP50Ms ?? 0,
    tickP95Ms: metrics?.tickP95Ms ?? 0,
    packetsInSec: metrics?.packetsInSec ?? 0,
    packetsOutSec: metrics?.packetsOutSec ?? 0,
  };
}

let boot: Promise<void> | undefined;
/** Opt-in production bootstrap, once per process. An admin Stop remains stopped until Start/restart. */
export function bootstrapGameServer(): Promise<void> {
  if (process.env["GAME_SERVER_AUTOSTART"] !== "1") return Promise.resolve();
  boot ??= startServerFromAdmin().then((result) => {
    if (!result.ok) {
      boot = undefined;
      throw Error("GAME_SERVER_BOOT_FAILED");
    }
  });
  return boot;
}
