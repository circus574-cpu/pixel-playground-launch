/**
 * Klient Sieciowy Multiplayer (WebSocket Client Adapter).
 *
 * Odpowiada za utrzymywanie połączenia w czasie rzeczywistym z Autorytatywnym
 * Serwerem Gry (GameServer), przesyłanie pozycji postaci (10 Hz throttling),
 * odbieranie snapshotów przestrzennych AOI oraz bezpieczny fail-safe
 * (brak serwera nie zakłóca lokalnej rozgrywki PvE).
 */

import type { ClientMessage, NetworkPlayerState, ServerMessage } from "./protocol";
import type { FeatureId } from "../world/generated/superiorSave";
import type { RaceId, WorldId } from "../world/races";
import type { PlayerActivityState } from "../admin/adminTelemetry";

export interface NetworkClientOptions {
  serverUrl?: string;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
  sendRateHz?: number;
  webSocketClass?: any;
}

export interface CharacterAuthInfo {
  accountId: string;
  characterId: string;
  nick: string;
  race: RaceId;
  level: number;
  worldId: FeatureId;
  continent?: WorldId;
  x: number;
  y: number;
}

export interface NetworkStatus {
  connected: boolean;
  connecting: boolean;
  nodeId: string | null;
  pingMs: number;
  lastSnapshotTick: number;
  playersCount: number;
}

export type SnapshotListener = (players: NetworkPlayerState[]) => void;
export type PlayerJoinedListener = (player: NetworkPlayerState) => void;
export type PlayerLeftListener = (characterId: string, reason?: string | undefined) => void;
export type PlayerActionListener = (action: {
  characterId: string;
  action: string;
  targetId?: string | undefined;
  skillId?: string | undefined;
  x?: number | undefined;
  y?: number | undefined;
}) => void;
export type ChatListener = (chat: {
  senderNick: string;
  characterId: string;
  text: string;
  at: string;
}) => void;
export type StatusListener = (status: NetworkStatus) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private authInfo: CharacterAuthInfo | null = null;
  private options: Required<NetworkClientOptions>;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isDisposed = false;

  private connected = false;
  private connecting = false;
  private nodeId: string | null = null;
  private pingMs = 0;
  private lastPingSentAt = 0;
  private lastSnapshotTick = 0;
  private knownPlayers = new Map<string, NetworkPlayerState>();

  private lastPositionSentAt = 0;
  private lastSentPos = { x: -9999, y: -9999, vx: 0, vy: 0 };

  // Listeners
  private snapshotListeners = new Set<SnapshotListener>();
  private playerJoinedListeners = new Set<PlayerJoinedListener>();
  private playerLeftListeners = new Set<PlayerLeftListener>();
  private playerActionListeners = new Set<PlayerActionListener>();
  private chatListeners = new Set<ChatListener>();
  private statusListeners = new Set<StatusListener>();

  constructor(options?: NetworkClientOptions) {
    const defaultUrl = this.resolveDefaultServerUrl();
    this.options = {
      serverUrl: options?.serverUrl || defaultUrl,
      autoReconnect: options?.autoReconnect ?? true,
      reconnectIntervalMs: options?.reconnectIntervalMs ?? 5000,
      sendRateHz: options?.sendRateHz ?? 10,
      webSocketClass: options?.webSocketClass,
    };
  }

  private resolveDefaultServerUrl(): string {
    if (typeof window === "undefined") return "ws://127.0.0.1:7420";
    try {
      const search = new URLSearchParams(window.location.search);
      const urlParam = search.get("ki-server-url");
      if (urlParam) return urlParam;

      const hostname = window.location.hostname || "127.0.0.1";
      if (window.location.protocol === "https:") {
        return `wss://${window.location.host}/ws`;
      }
      // Default local / test game server runs on port 7420
      return `ws://${hostname}:7420`;
    } catch {
      return "ws://127.0.0.1:7420";
    }
  }

  /**
   * Sprawdza czy multiplayer nie został celowo wyłączony (np. query param ?ki-multiplayer=0).
   */
  public static isMultiplayerEnabled(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const search = new URLSearchParams(window.location.search);
      if (search.get("ki-multiplayer") === "0") return false;
      if (window.localStorage.getItem("ki-multiplayer-disabled") === "true") return false;
      // Na odizolowanej stronie playtestu (/scripts/playtest.html) łączymy z serwerem tylko na żądanie (?ki-multiplayer=1),
      // aby testy lokalnego PvE nie generowały błędów ERR_CONNECTION_REFUSED w konsoli.
      if (
        window.location.pathname === "/scripts/playtest.html" &&
        search.get("ki-multiplayer") !== "1"
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Łączy z serwerem i wysyła pakiet autoryzacyjny postaci.
   */
  public connect(auth: CharacterAuthInfo): void {
    if (this.isDisposed) return;
    this.authInfo = auth;
    this.initiateWebSocket();
  }

  private initiateWebSocket(): void {
    if (this.isDisposed || !this.authInfo) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connecting = true;
    this.notifyStatus();

    try {
      const WSClass =
        this.options.webSocketClass ||
        (typeof WebSocket !== "undefined"
          ? WebSocket
          : typeof globalThis !== "undefined" && (globalThis as any).WebSocket
            ? (globalThis as any).WebSocket
            : undefined);

      if (!WSClass) {
        this.connecting = false;
        this.connected = false;
        this.notifyStatus();
        return;
      }

      const ws = new WSClass(this.options.serverUrl);
      this.ws = ws;

      const onOpenHandler = () => {
        if (this.isDisposed || this.ws !== ws) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          return;
        }

        this.connecting = false;
        this.connected = true;

        // Send auth handshake
        if (this.authInfo) {
          const authMsg: ClientMessage = {
            type: "auth",
            accountId: this.authInfo.accountId,
            characterId: this.authInfo.characterId,
            nick: this.authInfo.nick,
            race: this.authInfo.race,
            level: this.authInfo.level,
            worldId: this.authInfo.worldId,
            continent: this.authInfo.continent,
            x: this.authInfo.x,
            y: this.authInfo.y,
          };
          this.send(authMsg);
        }

        this.startHeartbeat();
        this.notifyStatus();
      };

      const onMessageHandler = (event: any) => {
        if (this.isDisposed || this.ws !== ws) return;
        try {
          const rawData =
            event?.data !== undefined
              ? typeof event.data === "string"
                ? event.data
                : event.data.toString()
              : typeof event === "string"
                ? event
                : event?.toString
                  ? event.toString()
                  : String(event);
          const msg = JSON.parse(rawData) as ServerMessage;
          this.handleServerMessage(msg);
        } catch {
          /* ignore malformed frame */
        }
      };

      const onCloseHandler = () => {
        this.connecting = false;
        this.connected = false;
        this.stopHeartbeat();
        this.notifyStatus();

        if (this.options.autoReconnect && !this.isDisposed) {
          this.scheduleReconnect();
        }
      };

      const onErrorHandler = () => {
        // Safe fail-safe: cichy błąd, nie przerywa działania gry PvE
      };

      ws.onopen = onOpenHandler;
      ws.onmessage = onMessageHandler;
      ws.onclose = onCloseHandler;
      ws.onerror = onErrorHandler;
    } catch {
      this.connecting = false;
      this.connected = false;
      this.notifyStatus();
      if (this.options.autoReconnect && !this.isDisposed) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected && !this.connecting && !this.isDisposed) {
        this.initiateWebSocket();
      }
    }, this.options.reconnectIntervalMs);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingSentAt = Date.now();
        this.send({ type: "ping", clientTime: this.lastPingSentAt });
      }
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "welcome":
        this.nodeId = msg.nodeId;
        this.notifyStatus();
        break;

      case "pong":
        if (this.lastPingSentAt > 0) {
          this.pingMs = Math.max(1, Date.now() - msg.clientTime);
          this.notifyStatus();
        }
        break;

      case "snapshot": {
        this.lastSnapshotTick = msg.serverTick;
        // Update local map of known players (excluding self)
        const myId = this.authInfo?.characterId;
        const otherPlayers: NetworkPlayerState[] = [];
        const seenIds = new Set<string>();

        for (const p of msg.players) {
          if (p.characterId === myId) continue;
          seenIds.add(p.characterId);
          this.knownPlayers.set(p.characterId, p);
          otherPlayers.push(p);
        }

        // Clean up players no longer in snapshot
        for (const id of this.knownPlayers.keys()) {
          if (!seenIds.has(id)) {
            this.knownPlayers.delete(id);
            for (const listener of this.playerLeftListeners) {
              listener(id, "out_of_aoi");
            }
          }
        }

        for (const listener of this.snapshotListeners) {
          listener(otherPlayers);
        }
        this.notifyStatus();
        break;
      }

      case "player_joined":
        if (this.authInfo && msg.player.characterId !== this.authInfo.characterId) {
          this.knownPlayers.set(msg.player.characterId, msg.player);
          for (const listener of this.playerJoinedListeners) {
            listener(msg.player);
          }
          this.notifyStatus();
        }
        break;

      case "player_left":
        this.knownPlayers.delete(msg.characterId);
        for (const listener of this.playerLeftListeners) {
          listener(msg.characterId, msg.reason);
        }
        this.notifyStatus();
        break;

      case "player_action":
        for (const listener of this.playerActionListeners) {
          listener(msg);
        }
        break;

      case "chat":
        for (const listener of this.chatListeners) {
          listener(msg);
        }
        break;

      case "error":
        // Server reported soft error
        break;
    }
  }

  /**
   * Wysyła aktualną pozycję postaci z throttlingiem (domyślnie 10 Hz / 100 ms).
   */
  public sendPosition(state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing?: "left" | "right" | "up" | "down";
    activity?: PlayerActivityState;
    worldId?: FeatureId;
    hp?: number;
    ki?: number;
  }): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    const minIntervalMs = 1000 / this.options.sendRateHz;
    const timeElapsed = now - this.lastPositionSentAt;

    const dx = Math.abs(state.x - this.lastSentPos.x);
    const dy = Math.abs(state.y - this.lastSentPos.y);
    const dvx = Math.abs(state.vx - this.lastSentPos.vx);
    const dvy = Math.abs(state.vy - this.lastSentPos.vy);

    const hasSignificantMovement = dx > 2 || dy > 2 || dvx > 0.1 || dvy > 0.1;
    const keepaliveNeeded = timeElapsed >= 1500;

    if ((hasSignificantMovement && timeElapsed >= minIntervalMs) || keepaliveNeeded) {
      this.lastPositionSentAt = now;
      this.lastSentPos = { x: state.x, y: state.y, vx: state.vx, vy: state.vy };

      const msg: ClientMessage = {
        type: "position",
        x: Math.round(state.x),
        y: Math.round(state.y),
        vx: Math.round(state.vx * 10) / 10,
        vy: Math.round(state.vy * 10) / 10,
        facing: state.facing,
        activity: state.activity,
        worldId: state.worldId,
        hp: state.hp,
        ki: state.ki,
      };
      this.send(msg);
    }
  }

  /**
   * Wysyła akcję gracza (atak, czar, interakcja, emotka).
   */
  public sendAction(
    action: "attack" | "cast" | "interact" | "emote",
    opts?: { targetId?: string; skillId?: string; x?: number; y?: number },
  ): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = {
      type: "action",
      action,
      ...opts,
    };
    this.send(msg);
  }

  /**
   * Wysyła wiadomość na czat ogólny świata.
   */
  public sendChat(text: string): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    this.send({ type: "chat", text: trimmed.slice(0, 300) });
  }

  private send(msg: ClientMessage): void {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    } catch {
      /* ignore send error */
    }
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  // Subskrypcje zdarzeń
  public onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  public onPlayerJoined(listener: PlayerJoinedListener): () => void {
    this.playerJoinedListeners.add(listener);
    return () => this.playerJoinedListeners.delete(listener);
  }

  public onPlayerLeft(listener: PlayerLeftListener): () => void {
    this.playerLeftListeners.add(listener);
    return () => this.playerLeftListeners.delete(listener);
  }

  public onPlayerAction(listener: PlayerActionListener): () => void {
    this.playerActionListeners.add(listener);
    return () => this.playerActionListeners.delete(listener);
  }

  public onChat(listener: ChatListener): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public getStatus(): NetworkStatus {
    return {
      connected: this.connected,
      connecting: this.connecting,
      nodeId: this.nodeId,
      pingMs: this.pingMs,
      lastSnapshotTick: this.lastSnapshotTick,
      playersCount: this.knownPlayers.size,
    };
  }

  public getKnownPlayers(): ReadonlyMap<string, NetworkPlayerState> {
    return this.knownPlayers;
  }

  public disconnect(): void {
    this.isDisposed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.snapshotListeners.clear();
    this.playerJoinedListeners.clear();
    this.playerLeftListeners.clear();
    this.playerActionListeners.clear();
    this.chatListeners.clear();
    this.statusListeners.clear();
    this.knownPlayers.clear();
  }
}
