/**
 * Serwer transportu Multiplayer (Game Server Daemon).
 *
 * Nie jest jeszcze autorytatywną symulacją walki i postępu postaci.
 * Obsługuje połączenia WebSocket w czasie rzeczywistym, pętlę symulacji 20 Hz,
 * filtrowanie przestrzenne AOI (Area of Interest 512x512) oraz opcjonalny
 * wsadowy zapis pozycji i telemetrii do PostgreSQL 17 (Schema v2).
 */
import http from "node:http";
import postgres from "postgres";
import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientMessage,
  NetworkPlayerState,
  ServerMessage,
} from "../game/multiplayer/protocol";
import type { FeatureId } from "../game/world/generated/superiorSave";
import type { RaceId, WorldId } from "../game/world/races";
import { PgCharacterRepository } from "./characters/repository";
import { accountRole, accountVerifier } from "./characters/auth";
import { characterHttp, type VerifyAccount } from "./characters/http";
import { serveOnlineSocket } from "./characters/socket";

export interface GameServerConfig {
  port: number;
  nodeId: string;
  name: string;
  region: string;
  maxPlayers: number;
  tickRateHz: number;
  aoiCellSize: number;
  databaseUrl?: string | undefined;
}

interface ConnectedSession {
  socket: WebSocket;
  characterId: string;
  accountId: string;
  nick: string;
  race: RaceId;
  level: number;
  worldId: FeatureId;
  continent: WorldId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: "left" | "right" | "up" | "down";
  activity: "safe" | "combat" | "exploring" | "interior" | "offline";
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  inSafeCity: boolean;
  pingMs: number;
  lastPingAt: number;
  connectedAt: number;
  lastUpdateAt: number;
}

export class GameServer {
  private config: GameServerConfig;
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private onlinePlayers = new Map<WebSocket, NetworkPlayerState>();
  private onlineClosers = new Map<WebSocket, () => Promise<void>>();
  private onlineSockets = new Set<WebSocket>();
  private sessions = new Map<string, ConnectedSession>();
  private socketToCharacterId = new Map<WebSocket, string>();
  private tickInterval: NodeJS.Timeout | null = null;
  private dbSyncInterval: NodeJS.Timeout | null = null;
  private db: ReturnType<typeof postgres> | null = null;
  private characterRepository: PgCharacterRepository | null = null;
  private verifyAccount: VerifyAccount | null = null;
  private tickCount = 0;
  private tickTimes: number[] = [];
  private onlineTickTimes: number[] = [];
  private packetsIn = 0;
  private packetsOut = 0;
  private bytesIn = 0;
  private bytesOut = 0;
  private isRunning = false;

  constructor(customConfig?: Partial<GameServerConfig>) {
    const envPort = process.env["GAME_SERVER_PORT"];
    const envNodeId = process.env["GAME_SERVER_NODE_ID"];
    const envName = process.env["GAME_SERVER_NAME"];
    const envRegion = process.env["GAME_SERVER_REGION"];
    const envMaxPlayers = process.env["GAME_SERVER_MAX_PLAYERS"];
    const envTickRate = process.env["GAME_SERVER_TICK_RATE"];
    const envDbUrl = process.env["DATABASE_URL"];

    this.config = {
      port: Number(envPort) || customConfig?.port || 7420,
      nodeId: envNodeId || customConfig?.nodeId || "eu-central-1",
      name: envName || customConfig?.name || "Węzeł Gry EU-Central #1",
      region: envRegion || customConfig?.region || "eu-central (Frankfurt)",
      maxPlayers: Number(envMaxPlayers) || customConfig?.maxPlayers || 250,
      tickRateHz: Number(envTickRate) || customConfig?.tickRateHz || 20.0,
      aoiCellSize: 512,
      databaseUrl: envDbUrl || customConfig?.databaseUrl,
    };

    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: 16384,
      perMessageDeflate: {
        threshold: 1024,
        serverNoContextTakeover: true,
        clientNoContextTakeover: true,
        concurrencyLimit: 2,
        zlibDeflateOptions: { level: 3 },
      },
    });
    this.setupWebSocketServer();
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || "/";

    if (url.split("?")[0] === "/ws/characters" || url.startsWith("/ws/characters/")) {
      void characterHttp(req, res, this.characterRepository, this.verifyAccount);
      return;
    }

    if (url === "/health" || url === "/status") {
      const p50 = this.getPercentileTickTime(0.5);
      const p95 = this.getPercentileTickTime(0.95);
      const payload = {
        status: "ok",
        nodeId: this.config.nodeId,
        name: this.config.name,
        region: this.config.region,
        port: this.config.port,
        tickRateHz: this.config.tickRateHz,
        activePlayers: this.sessions.size + this.onlinePlayers.size,
        maxPlayers: this.config.maxPlayers,
        tickP50Ms: Math.round(p50 * 10) / 10,
        tickP95Ms: Math.round(p95 * 10) / 10,
        packetsInSec: this.packetsIn,
        packetsOutSec: this.packetsOut,
        dbConnected: this.db !== null,
        characterPersistenceReady: this.characterRepository !== null && this.verifyAccount !== null,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Ki Legends Game Server - Use WebSocket to connect.");
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (socket: WebSocket, req: http.IncomingMessage) => {
      if (this.sessions.size + this.onlineSockets.size >= this.config.maxPlayers) {
        socket.close(1013, "Serwer pełny");
        return;
      }
      if (req.url?.split("?")[0] === "/ws/online") {
        if (!this.characterRepository || !this.verifyAccount) {
          socket.close(1013, "Trwała gra online jest niedostępna.");
          return;
        }
        this.onlineSockets.add(socket);
        const online = serveOnlineSocket(socket, {
          onClose: () => {
            this.onlineSockets.delete(socket);
            this.onlineClosers.delete(socket);
            this.onlinePlayers.delete(socket);
          },
          onFrame: (frame) => {
            const p = frame.view.player;
            this.onlinePlayers.set(socket, {
              characterId: frame.characterId,
              accountId: "",
              nick: p.name ?? "Wędrowiec",
              race: p.race,
              level: p.level,
              worldId: frame.feature,
              continent: p.continent,
              x: p.x,
              y: p.y,
              vx: frame.moving ? frame.facing.x : 0,
              vy: frame.moving ? frame.facing.y : 0,
              activity: p.interior ? "interior" : frame.view.inCity ? "safe" : "exploring",
              hp: p.hp,
              maxHp: frame.view.stats.maxHp,
              ki: p.ki,
              maxKi: frame.view.stats.maxKi,
              inSafeCity: frame.view.inCity,
              pingMs: 0,
              lastUpdated: Date.now(),
            });
          },
          peers: (frame) =>
            frame.exam
              ? []
              : [...this.onlinePlayers.values()]
                  .filter(
                    (p) =>
                      p.characterId !== frame.characterId &&
                      p.worldId === frame.feature &&
                      p.activity !== "interior" &&
                      Math.hypot(p.x - frame.view.x, p.y - frame.view.y) < 1800,
                  )
                  .slice(0, 16),
          metric: (kind, value) => {
            if (kind === "in") {
              this.packetsIn++;
              this.bytesIn += value;
            } else if (kind === "out") {
              this.packetsOut++;
              this.bytesOut += value;
            } else {
              this.onlineTickTimes.push(value);
              if (this.onlineTickTimes.length > 200) this.onlineTickTimes.shift();
            }
          },
          repository: this.characterRepository,
          verify: this.verifyAccount,
          role: (token, subject) =>
            accountRole(
              {
                url: process.env["SUPABASE_URL"] ?? "",
                publishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
              },
              token,
              subject,
            ),
          ...(process.env["GAME_WORLD_PUBLIC_ROOT"]
            ? { publicRoot: process.env["GAME_WORLD_PUBLIC_ROOT"] }
            : {}),
        });
        this.onlineClosers.set(socket, online.close);
        return;
      }
      if (this.characterRepository || process.env["GAME_ONLINE_REQUIRED"] === "1") {
        socket.close(1008, "Wymagana uwierzytelniona sesja /ws/online");
        return;
      }
      if (this.sessions.size >= this.config.maxPlayers) {
        this.sendToSocket(socket, {
          type: "error",
          code: "SERVER_FULL",
          message: `Serwer osiągnął maksymalny limit graczy (${this.config.maxPlayers}).`,
        });
        socket.close();
        return;
      }

      socket.on("message", (raw: string | Buffer) => {
        const str = typeof raw === "string" ? raw : raw.toString("utf8");
        this.bytesIn += str.length;
        this.packetsIn += 1;
        try {
          const msg = JSON.parse(str) as ClientMessage;
          this.handleClientMessage(socket, msg);
        } catch {
          /* ignore corrupted packet */
        }
      });

      socket.on("close", () => {
        this.handleSocketDisconnect(socket);
      });

      socket.on("error", () => {
        this.handleSocketDisconnect(socket);
      });
    });
  }

  private handleClientMessage(socket: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "auth": {
        const cid = msg.characterId.trim();
        if (!cid) return;

        // Disconnect old session if reconnecting from a different socket
        const old = this.sessions.get(cid);
        if (old && old.socket !== socket) {
          try {
            old.socket.close();
          } catch {
            /* ignore */
          }
        }

        const session: ConnectedSession = {
          socket,
          characterId: cid,
          accountId: msg.accountId || `acc-${cid}`,
          nick: msg.nick || `Gracz-${cid.slice(0, 6)}`,
          race: msg.race || "planetary",
          level: Math.max(1, msg.level || 1),
          worldId: msg.worldId || "verdant",
          continent: (msg.continent || msg.worldId || "verdant") as WorldId,
          x: Math.max(0, msg.x || 1000),
          y: Math.max(0, msg.y || 1000),
          vx: 0,
          vy: 0,
          facing: "down",
          activity: "safe",
          hp: 200,
          maxHp: 200,
          ki: 150,
          maxKi: 150,
          inSafeCity: true,
          pingMs: 15,
          lastPingAt: Date.now(),
          connectedAt: Date.now(),
          lastUpdateAt: Date.now(),
        };

        this.sessions.set(cid, session);
        this.socketToCharacterId.set(socket, cid);

        this.sendToSocket(socket, {
          type: "welcome",
          nodeId: this.config.nodeId,
          characterId: cid,
          tickRateHz: this.config.tickRateHz,
          aoiCellSize: this.config.aoiCellSize,
          serverTime: Date.now(),
        });

        // Broadcast join to nearby players
        this.broadcastNearby(
          session,
          {
            type: "player_joined",
            player: this.toNetworkState(session),
          },
          false,
        );
        break;
      }

      case "position": {
        const cid = this.socketToCharacterId.get(socket);
        if (!cid) return;
        const s = this.sessions.get(cid);
        if (!s) return;

        // Anti-cheat speed check: ignore delta > 1500 px/tick unless interior/teleport
        const dx = msg.x - s.x;
        const dy = msg.y - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1500 && s.activity !== "interior") {
          // Send correction back
          this.sendToSocket(socket, {
            type: "snapshot",
            serverTick: this.tickCount,
            serverTime: Date.now(),
            players: [this.toNetworkState(s)],
          });
          return;
        }

        s.x = Math.round(msg.x);
        s.y = Math.round(msg.y);
        s.vx = msg.vx ?? 0;
        s.vy = msg.vy ?? 0;
        if (msg.facing) s.facing = msg.facing;
        if (msg.activity) s.activity = msg.activity;
        if (msg.worldId) s.worldId = msg.worldId;
        if (msg.hp !== undefined) s.hp = msg.hp;
        if (msg.ki !== undefined) s.ki = msg.ki;
        s.lastUpdateAt = Date.now();
        break;
      }

      case "action": {
        const cid = this.socketToCharacterId.get(socket);
        if (!cid) return;
        const s = this.sessions.get(cid);
        if (!s) return;

        const actionPayload: ServerMessage = {
          type: "player_action",
          characterId: cid,
          action: msg.action,
          x: msg.x ?? s.x,
          y: msg.y ?? s.y,
          ...(msg.targetId ? { targetId: msg.targetId } : {}),
          ...(msg.skillId ? { skillId: msg.skillId } : {}),
        };

        this.broadcastNearby(s, actionPayload, false);
        break;
      }

      case "chat": {
        const cid = this.socketToCharacterId.get(socket);
        if (!cid) return;
        const s = this.sessions.get(cid);
        if (!s) return;
        const cleanText = msg.text.trim().slice(0, 200);
        if (!cleanText) return;

        const chatMsg: ServerMessage = {
          type: "chat",
          senderNick: s.nick,
          characterId: cid,
          text: cleanText,
          at: new Date().toISOString(),
        };

        // Broadcast chat to all players in the same world
        for (const target of this.sessions.values()) {
          if (target.worldId === s.worldId) {
            this.sendToSocket(target.socket, chatMsg);
          }
        }
        break;
      }

      case "ping": {
        const cid = this.socketToCharacterId.get(socket);
        if (cid) {
          const s = this.sessions.get(cid);
          if (s) {
            s.pingMs = Math.max(1, Date.now() - msg.clientTime);
          }
        }
        this.sendToSocket(socket, {
          type: "pong",
          clientTime: msg.clientTime,
          serverTime: Date.now(),
        });
        break;
      }
    }
  }

  private handleSocketDisconnect(socket: WebSocket): void {
    const cid = this.socketToCharacterId.get(socket);
    if (!cid) return;

    this.socketToCharacterId.delete(socket);
    const session = this.sessions.get(cid);
    if (!session) return;

    this.sessions.delete(cid);

    this.broadcastNearby(
      session,
      {
        type: "player_left",
        characterId: cid,
        reason: "Rozłączono",
      },
      false,
    );
  }

  private toNetworkState(s: ConnectedSession): NetworkPlayerState {
    return {
      characterId: s.characterId,
      accountId: s.accountId,
      nick: s.nick,
      race: s.race,
      level: s.level,
      worldId: s.worldId,
      continent: s.continent,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      facing: s.facing,
      activity: s.activity,
      hp: s.hp,
      maxHp: s.maxHp,
      ki: s.ki,
      maxKi: s.maxKi,
      inSafeCity: s.inSafeCity,
      pingMs: s.pingMs,
      lastUpdated: s.lastUpdateAt,
    };
  }

  /** Wysyła wiadomość do graczy znajdujących się w sąsiednich komórkach AOI 512x512. */
  private broadcastNearby(
    origin: ConnectedSession,
    message: ServerMessage,
    includeSelf = false,
  ): void {
    const originCellX = Math.floor(origin.x / this.config.aoiCellSize);
    const originCellY = Math.floor(origin.y / this.config.aoiCellSize);

    for (const target of this.sessions.values()) {
      if (!includeSelf && target.characterId === origin.characterId) continue;
      if (target.worldId !== origin.worldId) continue;

      const targetCellX = Math.floor(target.x / this.config.aoiCellSize);
      const targetCellY = Math.floor(target.y / this.config.aoiCellSize);

      // 3x3 grid around origin cell
      if (Math.abs(originCellX - targetCellX) <= 1 && Math.abs(originCellY - targetCellY) <= 1) {
        this.sendToSocket(target.socket, message);
      }
    }
  }

  private sendToSocket(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      const str = JSON.stringify(message);
      this.bytesOut += str.length;
      this.packetsOut += 1;
      socket.send(str);
    } catch {
      /* ignore write failure */
    }
  }

  /** Główna autorytatywna pętla ticku (20 Hz / 50 ms). */
  private runSimulationTick(): void {
    const start = Date.now();
    this.tickCount += 1;

    // Reset 1s packet counters
    if (this.tickCount % Math.round(this.config.tickRateHz) === 0) {
      this.packetsIn = 0;
      this.packetsOut = 0;
    }

    if (this.sessions.size > 0) {
      // Build AOI buckets per world
      const worldBuckets = new Map<FeatureId, ConnectedSession[]>();
      for (const s of this.sessions.values()) {
        const arr = worldBuckets.get(s.worldId) ?? [];
        arr.push(s);
        worldBuckets.set(s.worldId, arr);
      }

      const now = Date.now();

      // Dispatch snapshots to each player containing their AOI neighbors
      for (const s of this.sessions.values()) {
        const worldSessions = worldBuckets.get(s.worldId);
        if (!worldSessions) continue;

        const myCellX = Math.floor(s.x / this.config.aoiCellSize);
        const myCellY = Math.floor(s.y / this.config.aoiCellSize);

        const nearby: NetworkPlayerState[] = [];
        for (const candidate of worldSessions) {
          const cx = Math.floor(candidate.x / this.config.aoiCellSize);
          const cy = Math.floor(candidate.y / this.config.aoiCellSize);
          if (Math.abs(myCellX - cx) <= 1 && Math.abs(myCellY - cy) <= 1) {
            nearby.push(this.toNetworkState(candidate));
          }
        }

        this.sendToSocket(s.socket, {
          type: "snapshot",
          serverTick: this.tickCount,
          serverTime: now,
          players: nearby,
        });
      }
    }

    const elapsed = Date.now() - start;
    this.tickTimes.push(elapsed);
    if (this.tickTimes.length > 100) this.tickTimes.shift();
  }

  private getPercentileTickTime(pct: number): number {
    const samples = this.onlinePlayers.size ? this.onlineTickTimes : this.tickTimes;
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * pct));
    return sorted[idx] ?? 0;
  }

  /** Zapis wsadowy pozycji do bazy danych PostgreSQL (procedura batch_sync_positions). */
  private async syncToDatabase(): Promise<void> {
    if (!this.db || this.sessions.size === 0) return;

    try {
      const rows = Array.from(this.sessions.values()).map((s) => ({
        character_id: s.characterId,
        account_id: s.accountId,
        world_id: s.worldId,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        activity: s.activity,
        hp: s.hp,
        ki: s.ki,
        ping_ms: s.pingMs,
        fps: 60,
      }));

      await this.db`SELECT game.batch_sync_positions(
        ${this.config.nodeId},
        ${this.config.region},
        ${JSON.stringify(rows)}::jsonb
      )`;
    } catch {
      /* ignore transient DB pool errors */
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Connect to PostgreSQL if databaseUrl is provided
    if (this.config.databaseUrl) {
      try {
        this.db = postgres(this.config.databaseUrl, {
          max: 10,
          idle_timeout: 20,
          connect_timeout: 5,
          connection: {
            application_name: "ki-game-server",
            statement_timeout: 8000,
            lock_timeout: 2000,
          },
        });
        await this.db`SELECT 1`;
        const repository = new PgCharacterRepository(this.db);
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (url && key) {
          try {
            await repository.ready();
            this.verifyAccount = accountVerifier({ url, publishableKey: key });
            this.characterRepository = repository;
          } catch {
            console.warn(
              "[GameServer] Trwały zapis postaci niegotowy: wymagany schemat i konfiguracja kont.",
            );
          }
        }
        console.log("[GameServer] Połączenie PostgreSQL zweryfikowane.");
      } catch (err) {
        if (this.db) await this.db.end().catch(() => {});
        this.db = null;
        console.warn("[GameServer] PostgreSQL niedostępny. Trwała gra online zablokowana.");
      }
    } else {
      console.log("[GameServer] Tryb AUTONOMICZNY (w pamięci RAM) — brak adresu PostgreSQL.");
    }

    if (process.env["GAME_ONLINE_REQUIRED"] === "1" && !this.characterRepository) {
      this.isRunning = false;
      await this.db?.end().catch(() => {});
      this.db = null;
      throw Error("ONLINE_STORAGE_UNAVAILABLE");
    }
    await new Promise<void>((resolve, reject) => {
      const failed = (error: Error) => {
        this.isRunning = false;
        reject(error);
      };
      this.httpServer.once("error", failed);
      this.httpServer.listen(this.config.port, () => {
        this.httpServer.off("error", failed);
        console.log(
          `[GameServer] Serwer gry '${this.config.name}' (${this.config.nodeId}) nasłuchuje na porcie ${this.config.port} (20 Hz tick, max ${this.config.maxPlayers} graczy).`,
        );
        resolve();
      });
    });

    const tickMs = Math.round(1000 / this.config.tickRateHz);
    this.tickInterval = setInterval(() => this.runSimulationTick(), tickMs);

    if (this.db) {
      this.dbSyncInterval = setInterval(() => void this.syncToDatabase(), 500);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.characterRepository = null;
    this.verifyAccount = null;

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.dbSyncInterval) clearInterval(this.dbSyncInterval);

    await Promise.allSettled([...this.onlineClosers.values()].map((close) => close()));
    for (const socket of this.onlineSockets) socket.close(1001, "Serwer zatrzymany");
    for (const socket of this.wss.clients) socket.close(1001, "Serwer zatrzymany");
    for (const s of this.sessions.values()) {
      try {
        s.socket.close(1000, "Serwer gry został zatrzymany");
      } catch {
        /* ignore */
      }
    }
    this.sessions.clear();
    this.socketToCharacterId.clear();

    await new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => resolve());
      });
    });

    if (this.db) {
      await this.db.end();
      this.db = null;
    }

    console.log(`[GameServer] Serwer gry (${this.config.nodeId}) został pomyślnie wyłączony.`);
  }

  public getSessionCount(): number {
    return this.sessions.size + this.onlinePlayers.size;
  }

  public getNodeId(): string {
    return this.config.nodeId;
  }

  public getPort(): number {
    return this.config.port;
  }

  public getConfig(): GameServerConfig {
    return { ...this.config };
  }

  public updateConfig(
    patch: Partial<Pick<GameServerConfig, "name" | "region" | "maxPlayers" | "tickRateHz">>,
  ): GameServerConfig {
    if (patch.name !== undefined && patch.name.trim()) {
      this.config.name = patch.name.trim();
    }
    if (patch.region !== undefined && patch.region.trim()) {
      this.config.region = patch.region.trim();
    }
    if (patch.maxPlayers !== undefined && patch.maxPlayers > 0) {
      this.config.maxPlayers = Math.max(5, Math.min(10000, patch.maxPlayers));
    }
    if (patch.tickRateHz !== undefined && patch.tickRateHz >= 5 && patch.tickRateHz <= 60) {
      this.config.tickRateHz = patch.tickRateHz;
      if (this.isRunning && this.tickInterval) {
        clearInterval(this.tickInterval);
        const tickMs = Math.round(1000 / this.config.tickRateHz);
        this.tickInterval = setInterval(() => this.runSimulationTick(), tickMs);
      }
    }
    return { ...this.config };
  }

  public getActiveSessions(): NetworkPlayerState[] {
    return [
      ...Array.from(this.sessions.values()).map((s) => this.toNetworkState(s)),
      ...this.onlinePlayers.values(),
    ];
  }

  public getDb(): ReturnType<typeof postgres> | null {
    return this.db;
  }

  public getCharacterRepository(): PgCharacterRepository | null {
    return this.characterRepository;
  }

  public isCharacterOnline(characterId: string): boolean {
    for (const p of this.onlinePlayers.values()) {
      if (p.characterId === characterId) return true;
    }
    return this.sessions.has(characterId);
  }

  public getOnlinePlayerInfo(characterId: string): NetworkPlayerState | undefined {
    for (const p of this.onlinePlayers.values()) {
      if (p.characterId === characterId) return p;
    }
    const legacy = this.sessions.get(characterId);
    return legacy ? this.toNetworkState(legacy) : undefined;
  }

  public kickOnlinePlayer(characterId: string, reason = 'Rozłączono przez administratora'): boolean {
    for (const [ws, player] of this.onlinePlayers.entries()) {
      if (player.characterId === characterId) {
        const closer = this.onlineClosers.get(ws);
        if (closer) void closer().catch(() => {});
        this.onlinePlayers.delete(ws);
        this.onlineClosers.delete(ws);
        this.onlineSockets.delete(ws);
        try {
          ws.close(1008, reason);
        } catch {}
        return true;
      }
    }
    const legacy = this.sessions.get(characterId);
    if (legacy) {
      try {
        legacy.socket.close(1008, reason);
      } catch {}
      this.sessions.delete(characterId);
      this.socketToCharacterId.delete(legacy.socket);
      return true;
    }
    return false;
  }

  public getMetrics(): {
    tickP50Ms: number;
    tickP95Ms: number;
    packetsInSec: number;
    packetsOutSec: number;
    dbConnected: boolean;
  } {
    return {
      tickP50Ms: Math.round(this.getPercentileTickTime(0.5) * 10) / 10,
      tickP95Ms: Math.round(this.getPercentileTickTime(0.95) * 10) / 10,
      packetsInSec: this.packetsIn,
      packetsOutSec: this.packetsOut,
      dbConnected: this.db !== null,
    };
  }
}

// Uruchomienie z linii poleceń jeśli plik jest wywoływany bezpośrednio
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("gameServer.ts")) {
  const server = new GameServer();
  void server.start();

  const shutdown = async () => {
    console.log("\n[GameServer] Otrzymano sygnał zatrzymania...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
