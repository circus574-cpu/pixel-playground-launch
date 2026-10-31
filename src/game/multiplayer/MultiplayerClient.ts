/**
 * Klient połączenia czasu rzeczywistego z Serwerem Gry (Dual-Mode).
 * Działa bezinwazyjnie w tle — jeśli serwer jest offline, gra płynnie kontynuuje lokalną symulację PvE.
 */
import type { ClientMessage, NetworkPlayerState, ServerMessage } from "./protocol";
import type { FeatureId } from "@/game/world/generated/superiorSave";
import type { RaceId, WorldId } from "@/game/world/races";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private url: string = "";
  private status: ConnectionStatus = "disconnected";
  private remotePlayers = new Map<string, NetworkPlayerState>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private localPlayerCache: {
    characterId: string;
    accountId: string;
    nick: string;
    race: RaceId;
    level: number;
    worldId: FeatureId;
    continent?: WorldId;
    x: number;
    y: number;
  } | null = null;
  public pingMs: number = 0;
  public nodeId: string = "";

  constructor() {
    // Determine default server address
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const proto = isHttps ? "wss:" : "ws:";
      const host = window.location.hostname || "localhost";
      this.url = `${proto}//${host}:7420`;
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === "connected" && this.socket?.readyState === WebSocket.OPEN;
  }

  public getRemotePlayers(): NetworkPlayerState[] {
    return Array.from(this.remotePlayers.values());
  }

  public connect(customUrl?: string): void {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;
    if (customUrl) this.url = customUrl;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("connecting");

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.setStatus("connected");
        this.startPing();
        // If we already have local player info, re-authenticate immediately
        if (this.localPlayerCache) {
          this.auth(this.localPlayerCache);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.handleServerMessage(msg);
        } catch {
          /* ignore corrupted payload */
        }
      };

      this.socket.onclose = () => {
        this.cleanup();
        this.setStatus("disconnected");
      };

      this.socket.onerror = () => {
        this.cleanup();
        this.setStatus("error");
      };
    } catch {
      this.setStatus("error");
    }
  }

  public disconnect(): void {
    this.cleanup();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setStatus("disconnected");
    this.remotePlayers.clear();
  }

  public auth(data: {
    characterId: string;
    accountId: string;
    nick: string;
    race: RaceId;
    level: number;
    worldId: FeatureId;
    continent?: WorldId;
    x: number;
    y: number;
  }): void {
    this.localPlayerCache = data;
    this.send({
      type: "auth",
      ...data,
    });
  }

  public sendPosition(pos: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing?: "left" | "right" | "up" | "down";
    activity?: "safe" | "combat" | "exploring" | "interior" | "offline";
    worldId?: FeatureId;
    hp?: number;
    ki?: number;
  }): void {
    if (!this.isConnected()) return;
    this.send({
      type: "position",
      ...pos,
    });
  }

  public sendAction(action: "attack" | "cast" | "interact" | "emote", extra?: { targetId?: string; skillId?: string; x?: number; y?: number }): void {
    if (!this.isConnected()) return;
    this.send({
      type: "action",
      action,
      ...extra,
    });
  }

  public sendChat(text: string): void {
    if (!this.isConnected()) return;
    this.send({
      type: "chat",
      text,
    });
  }

  private send(msg: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "welcome":
        this.nodeId = msg.nodeId;
        this.emit("welcome", msg);
        break;

      case "snapshot":
        for (const p of msg.players) {
          if (this.localPlayerCache && p.characterId === this.localPlayerCache.characterId) {
            continue; // Skip echo of self
          }
          this.remotePlayers.set(p.characterId, p);
        }
        // Cleanup players that haven't been seen in over 15 seconds
        const now = Date.now();
        for (const [id, p] of this.remotePlayers.entries()) {
          if (now - p.lastUpdated > 15000) {
            this.remotePlayers.delete(id);
          }
        }
        this.emit("snapshot", msg);
        break;

      case "player_joined":
        if (!this.localPlayerCache || msg.player.characterId !== this.localPlayerCache.characterId) {
          this.remotePlayers.set(msg.player.characterId, msg.player);
          this.emit("player_joined", msg.player);
        }
        break;

      case "player_left":
        this.remotePlayers.delete(msg.characterId);
        this.emit("player_left", msg.characterId);
        break;

      case "player_action":
        this.emit("player_action", msg);
        break;

      case "chat":
        this.emit("chat", msg);
        break;

      case "pong":
        this.pingMs = Math.max(1, Date.now() - msg.clientTime);
        this.emit("pong", this.pingMs);
        break;

      case "error":
        this.emit("error", msg);
        break;
    }
  }

  private startPing(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping", clientTime: Date.now() });
      }
    }, 4000);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emit("status", status);
  }

  public on(event: string, callback: (data: any) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(callback);
    this.listeners.set(event, set);
    return () => {
      set.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
