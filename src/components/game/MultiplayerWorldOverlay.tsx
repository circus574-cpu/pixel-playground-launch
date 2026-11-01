/**
 * Komponent nakładki innych graczy w świecie gry multiplayer (Real-Time HUD Overlay).
 *
 * Wyświetla innych graczy obecnych w sektorze AOI gracza, ich nicki, poziomy, rasy,
 * paski HP oraz stan połączenia z węzłem serwera gry.
 * Działa bezinwazyjnie obok pętli Phaser.
 */
import { useEffect, useState } from "react";
import { multiplayerClient, type ConnectionStatus } from "@/game/multiplayer/MultiplayerClient";
import type { NetworkPlayerState } from "@/game/multiplayer/protocol";
import { RACES } from "@/game/world/races";

const RACE_COLORS: Record<string, string> = {
  planetary: "#5cd68d",
  sage: "#7cc5ff",
  android: "#e6a23c",
  legend: "#f56c6c",
};

export function MultiplayerWorldOverlay(props: {
  localX?: number;
  localY?: number;
  worldId?: string;
  cameraScrollX?: number;
  cameraScrollY?: number;
  cameraZoom?: number;
}) {
  const [status, setStatus] = useState<ConnectionStatus>(multiplayerClient.getStatus());
  const [ping, setPing] = useState(multiplayerClient.pingMs);
  const [remotePlayers, setRemotePlayers] = useState<NetworkPlayerState[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubStatus = multiplayerClient.on("status", (s: ConnectionStatus) => setStatus(s));
    const unsubPong = multiplayerClient.on("pong", (p: number) => setPing(p));
    const unsubSnapshot = multiplayerClient.on("snapshot", () => {
      setRemotePlayers(multiplayerClient.getRemotePlayers());
    });
    const unsubJoin = multiplayerClient.on("player_joined", () => {
      setRemotePlayers(multiplayerClient.getRemotePlayers());
    });
    const unsubLeave = multiplayerClient.on("player_left", () => {
      setRemotePlayers(multiplayerClient.getRemotePlayers());
    });

    return () => {
      unsubStatus();
      unsubPong();
      unsubSnapshot();
      unsubJoin();
      unsubLeave();
    };
  }, []);

  if (status === "disconnected") {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 180,
        zIndex: 40,
        pointerEvents: "auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(18, 22, 34, 0.88)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${status === "connected" ? "#5cd68d" : status === "connecting" ? "#f5d48a" : "#ff8577"}`,
          borderRadius: 6,
          padding: "4px 10px",
          color: "#e8eaed",
          fontSize: "0.76rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
        title="Kliknij, aby rozwinąć listę graczy w pobliżu"
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              status === "connected" ? "#5cd68d" : status === "connecting" ? "#f5d48a" : "#ff8577",
          }}
        />
        <span>
          {status === "connected"
            ? `Multiplayer: ${multiplayerClient.nodeId || "Online"} (${ping} ms)`
            : status === "connecting"
              ? "Łączenie z serwerem gry…"
              : "Błąd serwera multiplayer"}
        </span>
        {status === "connected" && (
          <span
            style={{
              background: "#2a3d4d",
              color: "#7cc5ff",
              borderRadius: 4,
              padding: "1px 6px",
              fontWeight: "bold",
            }}
          >
            {remotePlayers.length} graczy obok
          </span>
        )}
      </div>

      {expanded && status === "connected" && (
        <div
          style={{
            marginTop: 6,
            background: "rgba(14, 18, 28, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: 8,
            width: 240,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              color: "#94a3b8",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Gracze w sektorze AOI ({remotePlayers.length})
          </div>
          {remotePlayers.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.75rem", fontStyle: "italic" }}>
              Brak innych graczy w promieniu 1500 j.
            </div>
          ) : (
            remotePlayers.map((p) => {
              const raceName = RACES[p.race]?.name ?? p.race;
              const color = RACE_COLORS[p.race] ?? "#5cd68d";
              return (
                <div
                  key={p.characterId}
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "0.74rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", color }}>{p.nick}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.68rem" }}>
                      {raceName} · poz. {p.level}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#e2e8f0", fontSize: "0.7rem" }}>
                      {p.hp}/{p.maxHp} HP
                    </div>
                    <small style={{ color: "#64748b" }}>
                      ({Math.round(p.x)}, {Math.round(p.y)})
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
