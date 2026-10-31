/**
 * Protokół komunikacji czasu rzeczywistego pomiędzy Klientem Gry a Serwerem Autorytatywnym.
 * Zgodny z siatką przestrzenną AOI 512x512 oraz schematem bazy danych PostgreSQL Schema v2.
 */
import type { FeatureId } from "@/game/world/generated/superiorSave";
import type { RaceId, WorldId } from "@/game/world/races";
import type { PlayerActivityState } from "@/game/admin/adminTelemetry";

export interface NetworkPlayerState {
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
  facing?: "left" | "right" | "up" | "down";
  activity: PlayerActivityState;
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  inSafeCity: boolean;
  pingMs: number;
  lastUpdated: number;
}

export type ClientMessage =
  | {
      type: "auth";
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
  | {
      type: "position";
      x: number;
      y: number;
      vx: number;
      vy: number;
      facing?: "left" | "right" | "up" | "down";
      activity?: PlayerActivityState;
      worldId?: FeatureId;
      hp?: number;
      ki?: number;
    }
  | {
      type: "action";
      action: "attack" | "cast" | "interact" | "emote";
      targetId?: string;
      skillId?: string;
      x?: number;
      y?: number;
    }
  | {
      type: "chat";
      text: string;
    }
  | {
      type: "ping";
      clientTime: number;
    };

export type ServerMessage =
  | {
      type: "welcome";
      nodeId: string;
      characterId: string;
      tickRateHz: number;
      aoiCellSize: number;
      serverTime: number;
    }
  | {
      type: "snapshot";
      serverTick: number;
      serverTime: number;
      players: NetworkPlayerState[];
    }
  | {
      type: "player_joined";
      player: NetworkPlayerState;
    }
  | {
      type: "player_left";
      characterId: string;
      reason?: string;
    }
  | {
      type: "player_action";
      characterId: string;
      action: string;
      targetId?: string;
      skillId?: string;
      x?: number;
      y?: number;
    }
  | {
      type: "chat";
      senderNick: string;
      characterId: string;
      text: string;
      at: string;
    }
  | {
      type: "pong";
      clientTime: number;
      serverTime: number;
    }
  | {
      type: "error";
      code: string;
      message: string;
    };
