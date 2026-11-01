/**
 * Centrum Monitoringu Serwera, Zasobów (CPU/RAM/Ping/FPS/Tick), Logów oraz Graczy na Świecie.
 *
 * Komponent w pełni bezinwazyjny dla pętli gry — odczytuje rzeczywiste dane z chmury (`accountsDb`),
 * zapisów lokalnych (`localStorage`), pomiarów wydajności przeglądarki/sieci oraz telemetrii
 * węzłów multiplayer (`deploy/multiplayer/init/002-global-multiplayer-optimization.sql`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getGameServerStatusFn,
  startGameServerFn,
  stopGameServerFn,
} from "@/lib/serverControl.functions";
import {
  collectAdminTelemetrySnapshot,
  createServerNode,
  deleteServerNode,
  getFeatureDisplayName,
  getServerNodeConfigs,
  resetServerNodesToDefault,
  setServerNodeStatus,
  updateServerNode,
  type AdminTelemetrySnapshot,
  type PlayerActivityState,
  type ServerLogEntry,
  type ServerNodeConfig,
  type ServerNodeMetric,
  type ServerNodeStatus,
  type TelemetryLogCategory,
  type TelemetryLogLevel,
  type WorldPlayerPresence,
} from "@/game/admin/adminTelemetry";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { WORLD_INDEX } from "@/game/world/generated/worldVersion";
import { RACES } from "@/game/world/races";
import { ALL_CITIES_V2, ALL_FAMOUS_LOCATIONS_V2 } from "@/game/worlds";

type MonitoringSubTab = "overview" | "world-players" | "nodes-db" | "logs";

const ACTIVITY_LABELS: Record<PlayerActivityState, string> = {
  safe: "W bezpiecznym mieście",
  combat: "W walce",
  exploring: "Eksploracja szlaku",
  interior: "Wnętrze budynku",
  offline: "Offline (Zapis)",
};

const ACTIVITY_COLORS: Record<PlayerActivityState, string> = {
  safe: "#5cd68d",
  combat: "#ff6b6b",
  exploring: "#f5d48a",
  interior: "#6bc5ff",
  offline: "#9aa0a6",
};

const LOG_LEVEL_COLORS: Record<TelemetryLogLevel, string> = {
  debug: "#9aa0a6",
  info: "#7cc5ff",
  warn: "#f5d48a",
  error: "#ff8577",
  critical: "#ff4d4d",
};

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pl-PL");
  } catch {
    return iso;
  }
};

export function AdminMonitoringCenter() {
  const [subTab, setSubTab] = useState<MonitoringSubTab>("overview");
  const [includeClusterSim, setIncludeClusterSim] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tickSeed, setTickSeed] = useState(1);
  const [measuredFps, setMeasuredFps] = useState(60);
  const [snapshot, setSnapshot] = useState<AdminTelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  // Player filters
  const [worldFilter, setWorldFilter] = useState<"all" | FeatureId>("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "online" | PlayerActivityState>(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<"all" | "cloud" | "local" | "multiplayer">(
    "all",
  );
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [radarWorld, setRadarWorld] = useState<FeatureId>("verdant");

  // Log filters
  const [logLevelFilter, setLogLevelFilter] = useState<"all" | TelemetryLogLevel>("all");
  const [logCategoryFilter, setLogCategoryFilter] = useState<"all" | TelemetryLogCategory>("all");
  const [logNodeFilter, setLogNodeFilter] = useState<string>("all");
  const [logQuery, setLogQuery] = useState("");
  const [customLogs, setCustomLogs] = useState<ServerLogEntry[]>([]);

  // Server node management state
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [createNodeId, setCreateNodeId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRegion, setCreateRegion] = useState("eu-central (Frankfurt)");
  const [createHost, setCreateHost] = useState("127.0.0.1");
  const [createPort, setCreatePort] = useState(7420);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(200);
  const [createTickRate, setCreateTickRate] = useState(20.0);

  const [editingServerNode, setEditingServerNode] = useState<ServerNodeMetric | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxPlayers, setEditMaxPlayers] = useState(200);
  const [editHost, setEditHost] = useState("");
  const [editPort, setEditPort] = useState(7420);
  const [editRegion, setEditRegion] = useState("");
  const [editTickRate, setEditTickRate] = useState(20.0);

  const [serverActionMsg, setServerActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [daemonRunning, setDaemonRunning] = useState(false);
  const [daemonUptime, setDaemonUptime] = useState(0);
  const [daemonLoading, setDaemonLoading] = useState(false);

  const fpsFramesRef = useRef(0);
  const fpsLastTimeRef = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  // Measure client FPS non-intrusively while Monitoring tab is open
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    let rafId = 0;
    const step = (now: number) => {
      fpsFramesRef.current += 1;
      const elapsed = now - fpsLastTimeRef.current;
      if (elapsed >= 1000) {
        const currentFps = Math.round((fpsFramesRef.current * 1000) / elapsed);
        setMeasuredFps(Math.max(1, Math.min(240, currentFps)));
        fpsFramesRef.current = 0;
        fpsLastTimeRef.current = now;
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const refresh = useCallback(
    async (nextSeed?: number) => {
      setLoading(true);
      try {
        const snap = await collectAdminTelemetrySnapshot({
          includeClusterSimulation: includeClusterSim,
          measuredFps,
          tickSeed: nextSeed ?? tickSeed,
        });
        setSnapshot(snap);
      } finally {
        setLoading(false);
      }
    },
    [includeClusterSim, measuredFps, tickSeed],
  );

  useEffect(() => {
    void refresh(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeClusterSim]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setTickSeed((prev) => {
        const next = prev + 1;
        void refresh(next);
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  // Check physical game server daemon status
  useEffect(() => {
    let cancelled = false;
    const checkDaemon = async () => {
      try {
        const res = await getGameServerStatusFn();
        if (!cancelled && res) {
          setDaemonRunning(res.running);
          setDaemonUptime(res.uptimeSeconds);
        }
      } catch {
        /* ignore */
      }
    };
    void checkDaemon();
    const interval = setInterval(checkDaemon, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleTogglePhysicalDaemon = async () => {
    setDaemonLoading(true);
    try {
      if (daemonRunning) {
        const res = await stopGameServerFn();
        setDaemonRunning(false);
        setServerActionMsg({
          type: res.ok ? "success" : "error",
          text: res.message,
        });
      } else {
        const res = await startGameServerFn({ data: { port: 7420 } });
        setDaemonRunning(res.ok);
        setServerActionMsg({
          type: res.ok ? "success" : "error",
          text: res.message,
        });
      }
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd komunikacji z serwerem",
      });
    } finally {
      setDaemonLoading(false);
    }
  };

  const handleCreateServer = async () => {
    try {
      if (!createNodeId.trim()) {
        setServerActionMsg({ type: "error", text: "Podaj identyfikator węzła (np. eu-north-1)." });
        return;
      }
      if (!createName.trim()) {
        setServerActionMsg({ type: "error", text: "Podaj nazwę wyświetlaną serwera." });
        return;
      }
      createServerNode({
        nodeId: createNodeId,
        name: createName,
        region: createRegion,
        host: createHost,
        port: Number(createPort) || 7420,
        maxPlayers: Number(createMaxPlayers) || 200,
        status: "online",
        tickRateHz: Number(createTickRate) || 20.0,
      });
      setServerActionMsg({
        type: "success",
        text: `Utworzono i zainicjowano serwer '${createName}' [${createNodeId}].`,
      });
      setShowCreateServerModal(false);
      setCreateNodeId("");
      setCreateName("");
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Nie udało się utworzyć serwera",
      });
    }
  };

  const handleOpenEdit = (n: ServerNodeMetric) => {
    setEditingServerNode(n);
    setEditName(n.name || n.label || n.nodeId);
    setEditMaxPlayers(n.maxPlayers || 200);
    const hostParts = n.host.split(":");
    setEditHost(hostParts[0] || "127.0.0.1");
    setEditPort(n.port || (hostParts[1] ? Number(hostParts[1]) : 7420));
    setEditRegion(n.region || "eu-central");
    setEditTickRate(n.tickRateHz || 20.0);
    setServerActionMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editingServerNode) return;
    try {
      updateServerNode(editingServerNode.nodeId, {
        name: editName,
        maxPlayers: Number(editMaxPlayers) || 200,
        host: editHost,
        port: Number(editPort) || 7420,
        region: editRegion,
        tickRateHz: Number(editTickRate) || 20.0,
      });
      setServerActionMsg({
        type: "success",
        text: `Zaktualizowano konfigurację serwera '${editName}' [${editingServerNode.nodeId}].`,
      });
      setEditingServerNode(null);
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd aktualizacji serwera",
      });
    }
  };

  const handleStartServer = async (nodeId: string) => {
    try {
      setServerNodeStatus(nodeId, "online");
      if (nodeId === "eu-central-1" || nodeId.includes("local") || !daemonRunning) {
        try {
          const res = await startGameServerFn({ data: { port: 7420, nodeId } });
          setDaemonRunning(res.ok);
        } catch {
          /* ignore */
        }
      }
      setServerActionMsg({
        type: "success",
        text: `Serwer [${nodeId}] został pomyślnie uruchomiony (status: ONLINE).`,
      });
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd uruchamiania serwera",
      });
    }
  };

  const handleStopServer = async (nodeId: string) => {
    try {
      setServerNodeStatus(nodeId, "offline");
      if (nodeId === "eu-central-1" && daemonRunning) {
        try {
          await stopGameServerFn();
          setDaemonRunning(false);
        } catch {
          /* ignore */
        }
      }
      setServerActionMsg({
        type: "success",
        text: `Serwer [${nodeId}] został zatrzymany i wyłączony (status: OFFLINE).`,
      });
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd zatrzymywania serwera",
      });
    }
  };

  const handleDrainServer = (nodeId: string) => {
    try {
      setServerNodeStatus(nodeId, "draining");
      setServerActionMsg({
        type: "success",
        text: `Serwer [${nodeId}] przełączony w tryb opróżniania (DRAINING - brak nowych połączeń).`,
      });
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd zmiany trybu serwera",
      });
    }
  };

  const handleDeleteServer = (nodeId: string) => {
    if (!window.confirm(`Czy na pewno usunąć serwer [${nodeId}] z klastra?`)) return;
    try {
      deleteServerNode(nodeId);
      setServerActionMsg({
        type: "success",
        text: `Serwer [${nodeId}] został trwale usunięty z konfiguracji klastra.`,
      });
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd usuwania serwera",
      });
    }
  };

  const handleResetNodes = () => {
    if (!window.confirm("Przywrócić domyślną listę węzłów serwera?")) return;
    resetServerNodesToDefault();
    setServerActionMsg({
      type: "success",
      text: "Przywrócono domyślne serwery klastra.",
    });
    void refresh();
  };

  const filteredPlayers = useMemo(() => {
    if (!snapshot) return [];
    const q = playerQuery.trim().toLowerCase();
    return snapshot.players.filter((p) => {
      if (worldFilter !== "all" && p.worldId !== worldFilter) return false;
      if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
      if (activityFilter === "online" && !p.online) return false;
      if (activityFilter !== "all" && activityFilter !== "online" && p.activity !== activityFilter)
        return false;
      if (
        q &&
        !p.nick.toLowerCase().includes(q) &&
        !p.accountId.toLowerCase().includes(q) &&
        !p.nearestPlace.toLowerCase().includes(q) &&
        !p.worldId.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [snapshot, worldFilter, sourceFilter, activityFilter, playerQuery]);

  const selectedPlayer = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.players.find((p) => p.id === selectedPlayerId) ?? filteredPlayers[0] ?? null;
  }, [snapshot, selectedPlayerId, filteredPlayers]);

  const allLogs = useMemo(() => {
    const base = snapshot?.logs ?? [];
    return [...customLogs, ...base];
  }, [snapshot, customLogs]);

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    return allLogs.filter((l) => {
      if (logLevelFilter !== "all" && l.level !== logLevelFilter) return false;
      if (logCategoryFilter !== "all" && l.category !== logCategoryFilter) return false;
      if (logNodeFilter !== "all" && l.nodeId !== logNodeFilter) return false;
      if (
        q &&
        !l.message.toLowerCase().includes(q) &&
        !(l.actorNick ?? "").toLowerCase().includes(q) &&
        !(l.targetNick ?? "").toLowerCase().includes(q) &&
        !l.nodeId.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allLogs, logLevelFilter, logCategoryFilter, logNodeFilter, logQuery]);

  const clusterTotals = useMemo(() => {
    if (!snapshot || snapshot.nodes.length === 0) {
      return {
        avgCpu: 0,
        totalMemUsed: 0,
        totalMemLimit: 1024,
        avgTickP95: 0,
        avgPing: 0,
        totalPlayers: 0,
        onlinePlayers: 0,
        safePlayers: 0,
        combatPlayers: 0,
        totalPacketsIn: 0,
        totalPacketsOut: 0,
      };
    }
    const nodes = snapshot.nodes;
    const avgCpu =
      Math.round((nodes.reduce((s, n) => s + n.cpuPercent, 0) / nodes.length) * 10) / 10;
    const totalMemUsed = nodes.reduce((s, n) => s + n.memUsedMb, 0);
    const totalMemLimit = nodes.reduce((s, n) => s + n.memTotalMb, 0);
    const avgTickP95 =
      Math.round((nodes.reduce((s, n) => s + n.tickP95Ms, 0) / nodes.length) * 10) / 10;
    const avgPing =
      Math.round((nodes.reduce((s, n) => s + n.avgPingMs, 0) / nodes.length) * 10) / 10;
    const totalPacketsIn = nodes.reduce((s, n) => s + n.packetsInSec, 0);
    const totalPacketsOut = nodes.reduce((s, n) => s + n.packetsOutSec, 0);

    const players = snapshot.players;
    const onlinePlayers = players.filter((p) => p.online).length;
    const safePlayers = players.filter((p) => p.inSafeCity || p.activity === "safe").length;
    const combatPlayers = players.filter((p) => p.activity === "combat").length;

    return {
      avgCpu,
      totalMemUsed,
      totalMemLimit,
      avgTickP95,
      avgPing,
      totalPlayers: players.length,
      onlinePlayers,
      safePlayers,
      combatPlayers,
      totalPacketsIn,
      totalPacketsOut,
    };
  }, [snapshot]);

  const exportDiagnosticReport = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ki-legends-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const emitDiagnosticPingLog = () => {
    const entry: ServerLogEntry = {
      id: `diag-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      nodeId: "admin-console",
      level: "info",
      category: "admin",
      message: `Ręczny test diagnostyczny administratora: CPU klastra=${clusterTotals.avgCpu}%, Tick p95=${clusterTotals.avgTickP95} ms, Ping=${snapshot?.dbLatencyMs ?? 0} ms, Aktywni gracze=${clusterTotals.onlinePlayers}/${clusterTotals.totalPlayers}.`,
    };
    setCustomLogs((prev) => [entry, ...prev]);
  };

  return (
    <div className="ki-admin-monitoring" style={{ display: "grid", gap: 14 }}>
      {/* Górny pasek sterowania i statusu */}
      <header
        className="ki-admin-panel"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          borderColor: "#c8a35a",
          background: "#16121d",
        }}
      >
        <div>
          <strong style={{ fontSize: "1.05rem", color: "#f5d48a" }}>
            Centrum Monitoringu Serwera, Zasobów i Graczy na Świecie (Live Telemetry)
          </strong>
          <div style={{ fontSize: "0.82rem", opacity: 0.8, marginTop: 2 }}>
            Ostatni odczyt: <b>{snapshot ? fmtTime(snapshot.collectedAt) : "trwa…"}</b> · Status DB:{" "}
            <b style={{ color: snapshot?.dbConnected ? "#5cd68d" : "#ff8577" }}>
              {snapshot?.dbConnected ? "POŁĄCZONO (ONLINE)" : "TRYB LOKALNY / OFFLINE"}
            </b>{" "}
            · Siatka AOI: <b>512×512 j. (Index-Only Scan + UNLOGGED HOT)</b>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              margin: 0,
              fontSize: "0.84rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeClusterSim}
              onChange={(e) => setIncludeClusterSim(e.target.checked)}
            />
            <span>Symulacja węzłów globalnych (EU / US / AP)</span>
          </label>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              margin: 0,
              fontSize: "0.84rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-odświeżanie (3.5s)</span>
          </label>

          <button
            type="button"
            onClick={() => {
              const next = tickSeed + 1;
              setTickSeed(next);
              void refresh(next);
            }}
            disabled={loading}
          >
            {loading ? "Odświeżanie…" : "Odśwież teraz"}
          </button>

          <button type="button" onClick={emitDiagnosticPingLog}>
            Sonda diagnostyczna
          </button>

          <button type="button" onClick={exportDiagnosticReport}>
            Eksportuj JSON
          </button>
        </div>
      </header>

      {/* Szybki panel uruchomienia / wyłączenia serwera gry i zarządzania węzłami widoczny od razu */}
      <section
        className="ki-admin-panel"
        style={{
          background: daemonRunning
            ? "linear-gradient(135deg, #132b1d 0%, #173824 100%)"
            : "linear-gradient(135deg, #1a202c 0%, #231b2e 100%)",
          border: `1px solid ${daemonRunning ? "#5cd68d" : "#c8a35a"}`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: daemonRunning ? "#5cd68d" : "#f5d48a",
                boxShadow: daemonRunning ? "0 0 8px #5cd68d" : "none",
              }}
            />
            <strong style={{ fontSize: "1.02rem", color: "#fff" }}>
              Serwer Gry Live (Sterowanie Bez Terminala):{" "}
              <span style={{ color: daemonRunning ? "#5cd68d" : "#f5d48a" }}>
                {daemonRunning ? "URUCHOMIONY I AKTYWNY" : "GOTOWY DO URUCHOMIENIA"}
              </span>
            </strong>
          </div>
          <small style={{ color: "#cbd5e1" }}>
            {daemonRunning
              ? `Proces serwera działa w tle (port 7420 / WSS, 20 Hz tick, uptime: ${daemonUptime}s). Gracze łączą się automatycznie.`
              : "Uruchom fizyczny serwer gry jednym kliknięciem lub skonfiguruj nazwę, limit graczy i węzły klastra."}
          </small>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="ki-admin-btn"
            disabled={daemonLoading}
            onClick={handleTogglePhysicalDaemon}
            style={{
              background: daemonRunning ? "#c53030" : "#2e7d32",
              color: "#fff",
              fontWeight: "bold",
              padding: "8px 16px",
              cursor: daemonLoading ? "wait" : "pointer",
            }}
          >
            {daemonLoading
              ? "Przetwarzanie..."
              : daemonRunning
                ? "🛑 Wyłącz Serwer Gry"
                : "🚀 Uruchom Serwer Gry (1 kliknięcie)"}
          </button>
          <button
            type="button"
            className="ki-admin-btn"
            onClick={() => {
              setSubTab("nodes-db");
              setShowCreateServerModal(true);
            }}
            style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px" }}
          >
            ➕ Nowy serwer / Limit graczy
          </button>
          <button
            type="button"
            className="ki-admin-btn"
            onClick={() => setSubTab("nodes-db")}
            style={{ padding: "8px 14px" }}
          >
            ⚙️ Zarządzaj serwerami ({snapshot?.nodes.length ?? 0})
          </button>
        </div>
      </section>

      {/* Karty głównych wskaźników (CPU, RAM, Ping/Tick, FPS, Gracze na świecie, Sieć/DB) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Obciążenie CPU Serwera / Węzłów</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#f5d48a", margin: "4px 0" }}>
            {clusterTotals.avgCpu}%
          </div>
          <div
            style={{
              height: 6,
              background: "#2a2333",
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, clusterTotals.avgCpu)}%`,
                height: "100%",
                background: clusterTotals.avgCpu > 80 ? "#ff6b6b" : "#5cd68d",
              }}
            />
          </div>
          <small>
            Rdzenie klienta: {snapshot?.hardwareConcurrency ?? 8} · Węzły:{" "}
            {snapshot?.nodes.length ?? 1}
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Pamięć RAM Klastra i JS Heap</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#7cc5ff", margin: "4px 0" }}>
            {clusterTotals.totalMemUsed} MB{" "}
            <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              / {clusterTotals.totalMemLimit} MB
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "#2a2333",
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.round((clusterTotals.totalMemUsed / Math.max(1, clusterTotals.totalMemLimit)) * 100))}%`,
                height: "100%",
                background: "#7cc5ff",
              }}
            />
          </div>
          <small>
            JS Heap przeglądarki: {snapshot?.clientHeapUsedMb ?? 0} MB /{" "}
            {snapshot?.clientHeapLimitMb ?? 2048} MB
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Ping RTT Bazy i Pętla Ticku (20 Hz)</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#5cd68d", margin: "4px 0" }}>
            {snapshot?.dbLatencyMs ?? 1} ms{" "}
            <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              (Tick p95: {clusterTotals.avgTickP95} ms)
            </span>
          </div>
          <small>Śr. ping węzłów: {clusterTotals.avgPing} ms · Budżet ticku: 50.0 ms (20 Hz)</small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Wydajność Klienta (FPS) i Sieć</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#9fe0a0", margin: "4px 0" }}>
            {snapshot?.clientFps ?? measuredFps} FPS
          </div>
          <small>
            Ruch: {clusterTotals.totalPacketsIn} pkt/s WEJ · {clusterTotals.totalPacketsOut} pkt/s
            WYJ
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Gracze na Świecie (Wszystkie Lądy)</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#f5d48a", margin: "4px 0" }}>
            {clusterTotals.onlinePlayers} online{" "}
            <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              ({clusterTotals.totalPlayers} łącznie)
            </span>
          </div>
          <small>
            Bezpieczne miasta: {clusterTotals.safePlayers} · W walce: {clusterTotals.combatPlayers}
          </small>
        </div>
      </section>

      {/* Nawigacja podzakładek monitoringu */}
      <div className="ki-admin-tabs" role="tablist" aria-label="Sekcje monitoringu">
        {(
          [
            ["overview", "Przegląd Wszystkiego (Dashboard)"],
            [
              "world-players",
              `Gracze na Świecie i Mapa Pozycji (${snapshot?.players.length ?? 0})`,
            ],
            ["nodes-db", `Węzły Serwera, CPU/RAM i Baza (${snapshot?.nodes.length ?? 0})`],
            ["logs", `Logi Serwera, Sieci i Anti-Cheat (${allLogs.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={subTab === id}
            onClick={() => setSubTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. PRZEGLĄD WSZYSTKIEGO (OVERVIEW) */}
      {subTab === "overview" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Populacja na 10 lądach Superior */}
          <section className="ki-admin-panel">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              Populacja i Wydajność na Lądach Planety Superior (10 Lądów)
            </h3>
            <table className="ki-admin-table">
              <thead>
                <tr>
                  <th>Ląd / Kraina</th>
                  <th>Gracze (Łącznie)</th>
                  <th>Aktywni (Online)</th>
                  <th>W Bezpiecznym Mieście</th>
                  <th>W Walce</th>
                  <th>Eksploracja</th>
                  <th>Śr. Ping</th>
                  <th>Śr. FPS</th>
                  <th>Akcja</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_IDS.map((fid) => {
                  const st = snapshot.worldStats[fid];
                  if (!st) return null;
                  return (
                    <tr key={fid}>
                      <td>
                        <b>{st.name}</b> <small>({fid})</small>
                      </td>
                      <td>{st.totalPlayers}</td>
                      <td style={{ color: st.onlinePlayers > 0 ? "#5cd68d" : undefined }}>
                        <b>{st.onlinePlayers}</b>
                      </td>
                      <td>{st.safeZonePlayers}</td>
                      <td style={{ color: st.combatPlayers > 0 ? "#ff8577" : undefined }}>
                        {st.combatPlayers}
                      </td>
                      <td>{st.exploringPlayers}</td>
                      <td>{st.totalPlayers > 0 ? `${st.avgPingMs} ms` : "—"}</td>
                      <td>{st.totalPlayers > 0 ? `${st.avgFps} FPS` : "—"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setRadarWorld(fid);
                            setWorldFilter(fid);
                            setSubTab("world-players");
                          }}
                        >
                          Pokaż na radarze
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Dwie kolumny: Węzły serwera + Ostatnie logi */}
          <div className="ki-admin-grid">
            <section className="ki-admin-panel">
              <h3 style={{ marginTop: 0 }}>Stan Węzłów Serwera i Bazy</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {snapshot.nodes.map((n) => (
                  <div
                    key={n.nodeId}
                    style={{
                      padding: 10,
                      border: "1px solid #3a3242",
                      borderRadius: 8,
                      background: "#120f17",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <b>{n.label}</b>
                      <span
                        style={{
                          color: n.status === "online" ? "#5cd68d" : "#f5d48a",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        {n.status.toUpperCase()}
                      </span>
                    </div>
                    <small>
                      {n.nodeId} · {n.region} · {n.host}
                    </small>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 6,
                        marginTop: 8,
                        fontSize: "0.82rem",
                      }}
                    >
                      <div>
                        CPU: <b>{n.cpuPercent}%</b>
                      </div>
                      <div>
                        RAM:{" "}
                        <b>
                          {n.memUsedMb}/{n.memTotalMb} MB
                        </b>
                      </div>
                      <div>
                        Tick p95: <b>{n.tickP95Ms} ms</b>
                      </div>
                      <div>
                        Ping: <b>{n.avgPingMs} ms</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="ki-admin-panel">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>Ostatnie Zdarzenia i Logi Serwera</h3>
                <button type="button" onClick={() => setSubTab("logs")}>
                  Pełna konsola ({allLogs.length})
                </button>
              </div>
              <div style={{ display: "grid", gap: 6, maxHeight: 340, overflowY: "auto" }}>
                {allLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "6px 8px",
                      borderLeft: `3px solid ${LOG_LEVEL_COLORS[log.level]}`,
                      background: "#120f17",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>
                        <b style={{ color: LOG_LEVEL_COLORS[log.level] }}>
                          [{log.level.toUpperCase()}]
                        </b>{" "}
                        <code>[{log.category}]</code> <small>{log.nodeId}</small>
                      </span>
                      <small>{fmtTime(log.recordedAt)}</small>
                    </div>
                    <div style={{ marginTop: 2 }}>{log.message}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* 2. GRACZE NA ŚWIECIE I MAPA POZYCJI LIVE */}
      {subTab === "world-players" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Interaktywny Radar 2D Lądu + Inspektor Gracza */}
          <div className="ki-admin-grid">
            <section className="ki-admin-panel">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <h3 style={{ margin: 0 }}>Radar Świata 2D (Pozycje Graczy i Siatka AOI)</h3>
                <select
                  aria-label="Wybierz ląd radaru"
                  value={radarWorld}
                  onChange={(e) => setRadarWorld(e.target.value as FeatureId)}
                >
                  {FEATURE_IDS.map((fid) => (
                    <option key={fid} value={fid}>
                      {getFeatureDisplayName(fid)} (
                      {snapshot.players.filter((p) => p.worldId === fid).length})
                    </option>
                  ))}
                </select>
              </div>

              <WorldPlayerRadarSvg
                worldId={radarWorld}
                players={snapshot.players.filter((p) => p.worldId === radarWorld)}
                selectedId={selectedPlayer?.id ?? null}
                onSelectPlayer={(id) => setSelectedPlayerId(id)}
              />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 8,
                  fontSize: "0.78rem",
                }}
              >
                {(Object.keys(ACTIVITY_LABELS) as PlayerActivityState[]).map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: ACTIVITY_COLORS[k],
                        display: "inline-block",
                      }}
                    />
                    {ACTIVITY_LABELS[k]}
                  </span>
                ))}
              </div>
            </section>

            {/* Szczegółowy Inspektor Wybranego Gracza */}
            <section className="ki-admin-panel">
              <h3 style={{ marginTop: 0 }}>Szczegółowy Inspektor Gracza na Świecie</h3>
              {selectedPlayer ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      paddingBottom: 8,
                      borderBottom: "1px solid #3a3242",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1.1rem", color: "#f5d48a" }}>
                        {selectedPlayer.nick}
                      </strong>{" "}
                      <small>
                        ({RACES[selectedPlayer.race]?.name ?? selectedPlayer.race} · Poziom{" "}
                        {selectedPlayer.level})
                      </small>
                      <div>
                        <small>
                          ID: <code>{selectedPlayer.accountId}</code> · Klucz:{" "}
                          <code>{selectedPlayer.saveKey}</code> · Źródło:{" "}
                          <b>{selectedPlayer.source.toUpperCase()}</b>
                        </small>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "#120f17",
                        border: `1px solid ${ACTIVITY_COLORS[selectedPlayer.activity]}`,
                        color: ACTIVITY_COLORS[selectedPlayer.activity],
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    >
                      {ACTIVITY_LABELS[selectedPlayer.activity]}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: 8,
                      fontSize: "0.86rem",
                    }}
                  >
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Kraina / Ląd</small>
                      <div>
                        <b>{getFeatureDisplayName(selectedPlayer.worldId)}</b>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Dokładne Miejsce / Strefa</small>
                      <div>
                        <b>{selectedPlayer.nearestPlace}</b>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Współrzędne (X, Y) i Sektor AOI</small>
                      <div>
                        <b>
                          ({selectedPlayer.x}, {selectedPlayer.y})
                        </b>{" "}
                        <small>
                          · AOI [{selectedPlayer.cellX}, {selectedPlayer.cellY}]
                        </small>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Życie (HP) i Energia (KI)</small>
                      <div>
                        <b style={{ color: "#5cd68d" }}>
                          HP: {selectedPlayer.hp}/{selectedPlayer.maxHp}
                        </b>{" "}
                        ·{" "}
                        <b style={{ color: "#7cc5ff" }}>
                          KI: {selectedPlayer.ki}/{selectedPlayer.maxKi}
                        </b>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Złoto, XP i Umiejętności</small>
                      <div>
                        <b>{selectedPlayer.gold} zł</b> · {selectedPlayer.xp} XP ·{" "}
                        {selectedPlayer.skillsCount} węzłów
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#120f17", borderRadius: 6 }}>
                      <small>Telemetria Połączenia i Węzeł</small>
                      <div>
                        Ping: <b>{selectedPlayer.pingMs} ms</b> · FPS: <b>{selectedPlayer.fps}</b> ·{" "}
                        <code>{selectedPlayer.nodeId}</code>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" onClick={() => setRadarWorld(selectedPlayer.worldId)}>
                      Pokaż ląd gracza na radarze ({selectedPlayer.worldId})
                    </button>
                    <small style={{ alignSelf: "center" }}>
                      Ostatnia aktywność: {fmtDateTime(selectedPlayer.lastSeenAt)} · Rewizja:{" "}
                      {selectedPlayer.revision}
                    </small>
                  </div>

                  {selectedPlayer.rawSave !== undefined && (
                    <details>
                      <summary>
                        <small>Podgląd pełnego stanu JSON postaci</small>
                      </summary>
                      <textarea
                        readOnly
                        value={JSON.stringify(selectedPlayer.rawSave, null, 2)}
                        style={{ minHeight: 150, marginTop: 6 }}
                      />
                    </details>
                  )}
                </div>
              ) : (
                <p>Wybierz gracza z radaru lub tabeli poniżej.</p>
              )}
            </section>
          </div>

          {/* Pełna tabela graczy na świecie z filtrami */}
          <section className="ki-admin-panel">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Lista Wszystkich Graczy na Świecie ({filteredPlayers.length} /{" "}
                {snapshot.players.length})
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input
                  placeholder="Szukaj nicku, ID, lokacji…"
                  aria-label="Szukaj gracza na świecie"
                  value={playerQuery}
                  onChange={(e) => setPlayerQuery(e.target.value)}
                />
                <select
                  aria-label="Filtruj ląd"
                  value={worldFilter}
                  onChange={(e) => setWorldFilter(e.target.value as "all" | FeatureId)}
                >
                  <option value="all">Wszystkie lądy (10)</option>
                  {FEATURE_IDS.map((fid) => (
                    <option key={fid} value={fid}>
                      {getFeatureDisplayName(fid)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtruj status aktywności"
                  value={activityFilter}
                  onChange={(e) =>
                    setActivityFilter(e.target.value as "all" | "online" | PlayerActivityState)
                  }
                >
                  <option value="all">Wszystkie statusy</option>
                  <option value="online">Tylko Online</option>
                  <option value="safe">W bezpiecznym mieście</option>
                  <option value="combat">W walce</option>
                  <option value="exploring">Eksploracja</option>
                  <option value="interior">Wnętrze</option>
                  <option value="offline">Offline (Zapis)</option>
                </select>
                <select
                  aria-label="Filtruj źródło"
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as "all" | "cloud" | "local" | "multiplayer")
                  }
                >
                  <option value="all">Wszystkie źródła</option>
                  <option value="cloud">Chmura (Supabase)</option>
                  <option value="local">Lokalne urządzenie</option>
                  <option value="multiplayer">Węzły Multiplayer</option>
                </select>
              </div>
            </div>

            <table className="ki-admin-table">
              <thead>
                <tr>
                  <th>Nick / Postać</th>
                  <th>Źródło</th>
                  <th>Rasa · Poz.</th>
                  <th>Status</th>
                  <th>Ląd</th>
                  <th>Aktualne Miejsce</th>
                  <th>Pozycja (X, Y) · AOI</th>
                  <th>HP / KI</th>
                  <th>Ping · FPS</th>
                  <th>Ostatnio</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p) => {
                  const isSel = selectedPlayer?.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayerId(p.id);
                        setRadarWorld(p.worldId);
                      }}
                      style={{
                        cursor: "pointer",
                        background: isSel ? "#2a2333" : undefined,
                      }}
                    >
                      <td>
                        <b>{p.nick}</b>
                        {p.roles.length > 0 && (
                          <small style={{ color: "#f5d48a", marginLeft: 4 }}>
                            [{p.roles.join(", ")}]
                          </small>
                        )}
                      </td>
                      <td>
                        <small>{p.source.toUpperCase()}</small>
                      </td>
                      <td>
                        {RACES[p.race]?.name ?? p.race} · <b>poz. {p.level}</b>
                      </td>
                      <td>
                        <span style={{ color: ACTIVITY_COLORS[p.activity], fontWeight: 600 }}>
                          {ACTIVITY_LABELS[p.activity]}
                        </span>
                      </td>
                      <td>
                        <b>{p.worldId}</b>
                      </td>
                      <td>{p.nearestPlace}</td>
                      <td>
                        <code>
                          ({p.x}, {p.y})
                        </code>{" "}
                        <small>
                          [{p.cellX}, {p.cellY}]
                        </small>
                      </td>
                      <td>
                        <small>
                          {p.hp}/{p.maxHp} HP · {p.ki}/{p.maxKi} KI
                        </small>
                      </td>
                      <td>
                        <small>
                          {p.pingMs} ms · {p.fps} FPS
                        </small>
                      </td>
                      <td>
                        <small>{fmtTime(p.lastSeenAt)}</small>
                      </td>
                    </tr>
                  );
                })}
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={10}>Brak graczy spełniających wybrane kryteria filtrowania.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 3. WĘZŁY SERWERA, CPU/RAM/TICK I BAZA DANYCH */}
      {subTab === "nodes-db" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
          {serverActionMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: serverActionMsg.type === "success" ? "#1b3a2a" : "#421c1c",
                border: `1px solid ${serverActionMsg.type === "success" ? "#5cd68d" : "#ff8577"}`,
                color: serverActionMsg.type === "success" ? "#abf7cb" : "#ffc2bc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{serverActionMsg.text}</span>
              <button
                type="button"
                className="ki-admin-btn"
                onClick={() => setServerActionMsg(null)}
                style={{ padding: "2px 8px", fontSize: "0.8rem" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Kafelki podsumowujące klastra serwerów gry */}
          {(() => {
            const gameNodes = snapshot.nodes.filter((n) => n.nodeId !== "cloud-supabase");
            const onlineCount = gameNodes.filter((n) => n.status === "online").length;
            const totalCapacity = gameNodes.reduce((acc, n) => acc + (n.maxPlayers || 200), 0);
            const totalActive = gameNodes.reduce((acc, n) => acc + n.activePlayers, 0);
            const clusterUtilization =
              totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0;
            return (
              <div className="ki-admin-grid">
                <div className="ki-admin-stat-card">
                  <small>Węzły Gry Online</small>
                  <h3>
                    <span style={{ color: "#5cd68d" }}>{onlineCount}</span> / {gameNodes.length}
                  </h3>
                  <small style={{ color: "#9aa0a6" }}>
                    Baza: {snapshot.dbConnected ? "POŁĄCZONO" : "BŁĄD"} ({snapshot.dbLatencyMs} ms)
                  </small>
                </div>
                <div className="ki-admin-stat-card">
                  <small>Pojemność Klastra (Sloty)</small>
                  <h3>{totalCapacity.toLocaleString()} graczy</h3>
                  <small style={{ color: "#9aa0a6" }}>Suma limitów zarejestrowanych węzłów</small>
                </div>
                <div className="ki-admin-stat-card">
                  <small>Aktywni Gracze w Klastrze</small>
                  <h3>
                    {totalActive} <small style={{ fontSize: "0.85rem" }}>({clusterUtilization}%)</small>
                  </h3>
                  <div
                    style={{
                      height: 6,
                      background: "#333",
                      borderRadius: 3,
                      overflow: "hidden",
                      marginTop: 6,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, clusterUtilization)}%`,
                        background:
                          clusterUtilization > 85
                            ? "#ff6b6b"
                            : clusterUtilization > 60
                              ? "#f5d48a"
                              : "#5cd68d",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
                <div className="ki-admin-stat-card">
                  <small>Średni Tick i Ping Klastra</small>
                  <h3>20.0 Hz · ~28 ms</h3>
                  <small style={{ color: "#5cd68d" }}>PostgreSQL 17 HOT UNLOGGED</small>
                </div>
              </div>
            );
          })()}

          {/* Formularz / Modal tworzenia nowego serwera */}
          {showCreateServerModal && (
            <section
              className="ki-admin-panel"
              style={{
                border: "1px solid #7cc5ff",
                background: "#161c28",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, color: "#7cc5ff" }}>
                  ➕ Tworzenie Nowego Serwera Gry (Węzeł Klastra)
                </h3>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => setShowCreateServerModal(false)}
                >
                  ✕ Anuluj
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Identyfikator węzła (unikalny):
                  </label>
                  <input
                    aria-label="Identyfikator serwera"
                    placeholder="np. eu-north-1"
                    value={createNodeId}
                    onChange={(e) => setCreateNodeId(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Nazwa serwera:
                  </label>
                  <input
                    aria-label="Nazwa serwera"
                    placeholder="np. Węzeł EU-North (Sztokholm)"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Region:
                  </label>
                  <input
                    aria-label="Region serwera"
                    placeholder="np. eu-north (Sztokholm)"
                    value={createRegion}
                    onChange={(e) => setCreateRegion(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Host / Adres IP:
                  </label>
                  <input
                    aria-label="Host serwera"
                    placeholder="np. 85.235.150.190"
                    value={createHost}
                    onChange={(e) => setCreateHost(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Port sieciowy:
                  </label>
                  <input
                    type="number"
                    aria-label="Port serwera"
                    placeholder="7420"
                    value={createPort}
                    onChange={(e) => setCreatePort(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Maksymalny limit graczy (Sloty):
                  </label>
                  <input
                    type="number"
                    aria-label="Maksymalny limit graczy"
                    placeholder="250"
                    value={createMaxPlayers}
                    onChange={(e) => setCreateMaxPlayers(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Częstotliwość pętli tick (Hz):
                  </label>
                  <input
                    type="number"
                    step="1"
                    aria-label="Częstotliwość ticku"
                    placeholder="20"
                    value={createTickRate}
                    onChange={(e) => setCreateTickRate(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={handleCreateServer}
                  style={{ background: "#2e7d32", color: "#fff", fontWeight: "bold" }}
                >
                  🚀 Zainicjuj i dodaj serwer
                </button>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => setShowCreateServerModal(false)}
                >
                  Anuluj
                </button>
              </div>
            </section>
          )}

          {/* Formularz edycji parametrów wybranego serwera */}
          {editingServerNode && (
            <section
              className="ki-admin-panel"
              style={{
                border: "1px solid #f5d48a",
                background: "#241f16",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, color: "#f5d48a" }}>
                  ✏️ Edycja Konfiguracji Serwera: <code>{editingServerNode.nodeId}</code>
                </h3>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => setEditingServerNode(null)}
                >
                  ✕ Anuluj
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Nazwa serwera:
                  </label>
                  <input
                    aria-label="Edycja nazwy serwera"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Maksymalny limit graczy:
                  </label>
                  <input
                    type="number"
                    aria-label="Edycja limitu graczy"
                    value={editMaxPlayers}
                    onChange={(e) => setEditMaxPlayers(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Host / IP:
                  </label>
                  <input
                    aria-label="Edycja hosta serwera"
                    value={editHost}
                    onChange={(e) => setEditHost(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Port:
                  </label>
                  <input
                    type="number"
                    aria-label="Edycja portu serwera"
                    value={editPort}
                    onChange={(e) => setEditPort(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Region:
                  </label>
                  <input
                    aria-label="Edycja regionu serwera"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Częstotliwość pętli tick (Hz):
                  </label>
                  <input
                    type="number"
                    aria-label="Edycja częstotliwości ticku"
                    value={editTickRate}
                    onChange={(e) => setEditTickRate(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={handleSaveEdit}
                  style={{ background: "#e65100", color: "#fff", fontWeight: "bold" }}
                >
                  💾 Zapisz zmiany serwera
                </button>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => setEditingServerNode(null)}
                >
                  Anuluj
                </button>
              </div>
            </section>
          )}

          {/* Szybkie sterowanie fizycznym procesem serwera (bez terminala) */}
          <section
            className="ki-admin-panel"
            style={{
              background: daemonRunning ? "linear-gradient(135deg, #132b1d 0%, #173824 100%)" : "#1a202c",
              border: `1px solid ${daemonRunning ? "#5cd68d" : "#4a5568"}`,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: daemonRunning ? "#5cd68d" : "#9aa0a6",
                    boxShadow: daemonRunning ? "0 0 8px #5cd68d" : "none",
                  }}
                />
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                  Fizyczny Serwer Gry (Sterowanie Bez Terminala):{" "}
                  <span style={{ color: daemonRunning ? "#5cd68d" : "#9aa0a6" }}>
                    {daemonRunning ? "URUCHOMIONY I AKTYWNY" : "ZATRZYMANY"}
                  </span>
                </h3>
              </div>
              <small style={{ color: "#cbd5e1" }}>
                {daemonRunning
                  ? `Proces serwera nasłuchuje na porcie 7420 (WebSocket/HTTP). Uptime: ${daemonUptime}s. Gracze w przeglądarkach łączą się automatycznie.`
                  : "Serwer gry jest wyłączony. Kliknij przycisk obok, aby uruchomić go 1 kliknięciem bez użycia konsoli ani SSH."}
              </small>
            </div>

            <button
              type="button"
              className="ki-admin-btn"
              disabled={daemonLoading}
              onClick={handleTogglePhysicalDaemon}
              style={{
                background: daemonRunning ? "#c53030" : "#2e7d32",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.92rem",
                padding: "8px 16px",
                cursor: daemonLoading ? "wait" : "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {daemonLoading
                ? "Przetwarzanie..."
                : daemonRunning
                  ? "🛑 Wyłącz Serwer Gry"
                  : "🚀 Uruchom Serwer Gry (1 kliknięcie)"}
            </button>
          </section>

          {/* Główna tabela serwerów z akcjami start/stop/edycja */}
          <section className="ki-admin-panel">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  Zarządzanie i Monitoring Serwerów Gry ({snapshot.nodes.length})
                </h3>
                <small style={{ color: "#9aa0a6" }}>
                  Tworzenie instancji, edycja limitu graczy, startowanie, wyłączanie i telemetria w
                  czasie rzeczywistym
                </small>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => setShowCreateServerModal(true)}
                  style={{ background: "#2e7d32", color: "#fff" }}
                >
                  ➕ Nowy serwer gry
                </button>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={handleResetNodes}
                  title="Przywraca domyślną konfigurację klastra"
                >
                  ↺ Przywróć domyślne
                </button>
              </div>
            </div>

            <table className="ki-admin-table">
              <thead>
                <tr>
                  <th>Serwer / Nazwa / ID</th>
                  <th>Host : Port</th>
                  <th>Status</th>
                  <th>Gracze / Limit (Sloty)</th>
                  <th>CPU % · Load 1m</th>
                  <th>RAM (Used / Total)</th>
                  <th>Tick 20 Hz (p50 / p95)</th>
                  <th>Ping (Śr.)</th>
                  <th>Zarządzanie Serwerem</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.nodes.map((n) => {
                  const isDb = n.nodeId === "cloud-supabase";
                  const maxCap = n.maxPlayers || 200;
                  const pct = Math.round((n.activePlayers / maxCap) * 100);
                  const isOff = n.status === "offline" || n.status === "stopping";
                  const isStarting = n.status === "starting";
                  const isOnline = n.status === "online" || n.status === "degraded";

                  return (
                    <tr key={n.nodeId}>
                      <td>
                        <b>{n.name || n.label || n.nodeId}</b>
                        <br />
                        <small style={{ color: "#9aa0a6" }}>
                          ID: <code>{n.nodeId}</code> · {n.region}
                        </small>
                      </td>
                      <td>
                        <code>{n.host}</code>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.78rem",
                            fontWeight: "bold",
                            background:
                              n.status === "online"
                                ? "#1b4d2e"
                                : n.status === "draining"
                                  ? "#4d3d1b"
                                  : isOff
                                    ? "#3d1b1b"
                                    : "#2a3d4d",
                            color:
                              n.status === "online"
                                ? "#5cd68d"
                                : n.status === "draining"
                                  ? "#f5d48a"
                                  : isOff
                                    ? "#ff8577"
                                    : "#7cc5ff",
                          }}
                        >
                          {n.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.82rem",
                            marginBottom: 2,
                          }}
                        >
                          <b>
                            {n.activePlayers} / {maxCap}
                          </b>
                          <small style={{ color: "#9aa0a6" }}>{pct}%</small>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "#2a2a2a",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, pct)}%`,
                              background:
                                pct > 90 ? "#ff6b6b" : pct > 75 ? "#f5d48a" : "#5cd68d",
                              transition: "width 0.2s ease",
                            }}
                          />
                        </div>
                        <small style={{ color: "#9aa0a6", fontSize: "0.74rem" }}>
                          {n.activeEntities} encji · {n.packetsInSec} pkt/s
                        </small>
                      </td>
                      <td>
                        <b>{n.cpuPercent}%</b> <small>(load {n.loadAvg1m})</small>
                      </td>
                      <td>
                        <small>
                          {n.memUsedMb} / {n.memTotalMb} MB
                        </small>
                      </td>
                      <td>
                        <b>{n.tickRateHz} Hz</b>
                        <br />
                        <small style={{ color: "#9aa0a6" }}>
                          p50: {n.tickP50Ms} ms · p95: {n.tickP95Ms} ms
                        </small>
                      </td>
                      <td>
                        <b>{n.avgPingMs} ms</b>
                      </td>
                      <td>
                        {isDb ? (
                          <small style={{ color: "#7cc5ff" }}>Zarządzana przez Supabase</small>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {isOff ? (
                              <button
                                type="button"
                                className="ki-admin-btn"
                                onClick={() => handleStartServer(n.nodeId)}
                                style={{
                                  background: "#1b4d2e",
                                  color: "#5cd68d",
                                  padding: "3px 8px",
                                  fontSize: "0.78rem",
                                }}
                                title="Uruchom ten serwer gry"
                              >
                                ▶ Uruchom
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ki-admin-btn"
                                onClick={() => handleStopServer(n.nodeId)}
                                style={{
                                  background: "#4d1b1b",
                                  color: "#ff8577",
                                  padding: "3px 8px",
                                  fontSize: "0.78rem",
                                }}
                                title="Wyłącz ten serwer gry"
                              >
                                ⏹ Wyłącz
                              </button>
                            )}

                            {isOnline && (
                              <button
                                type="button"
                                className="ki-admin-btn"
                                onClick={() => handleDrainServer(n.nodeId)}
                                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                                title="Opróżnij serwer z graczy przed wyłączeniem"
                              >
                                ⏳ Drenuj
                              </button>
                            )}

                            <button
                              type="button"
                              className="ki-admin-btn"
                              onClick={() => handleOpenEdit(n)}
                              style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                              title="Edytuj nazwę, limit graczy, host, port"
                            >
                              ✏ Edytuj
                            </button>

                            <button
                              type="button"
                              className="ki-admin-btn"
                              onClick={() => handleDeleteServer(n.nodeId)}
                              style={{
                                padding: "3px 8px",
                                fontSize: "0.78rem",
                                color: "#ff8577",
                              }}
                              title="Usuń ten węzeł z konfiguracji"
                            >
                              🗑
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="ki-admin-grid">
            <section className="ki-admin-panel">
              <h3 style={{ marginTop: 0 }}>
                Najbardziej Obciążone Sektory AOI 512×512 (Hotspoty Przestrzenne)
              </h3>
              <table className="ki-admin-table">
                <thead>
                  <tr>
                    <th>Ląd</th>
                    <th>Komórka AOI [X, Y]</th>
                    <th>Środek (X, Y)</th>
                    <th>Gracze</th>
                    <th>W walce</th>
                    <th>Śr. Ping / FPS</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.hotspots.slice(0, 12).map((h) => (
                    <tr key={`${h.worldId}:${h.cellX}:${h.cellY}`}>
                      <td>
                        <b>{h.worldId}</b>
                      </td>
                      <td>
                        <code>
                          [{h.cellX}, {h.cellY}]
                        </code>
                      </td>
                      <td>
                        ({h.worldX}, {h.worldY})
                      </td>
                      <td>
                        <b>{h.playerCount}</b> <small>({h.onlineCount} online)</small>
                      </td>
                      <td>{h.combatCount}</td>
                      <td>
                        {h.avgPingMs} ms · {h.avgFps} FPS
                      </td>
                    </tr>
                  ))}
                  {snapshot.hotspots.length === 0 && (
                    <tr>
                      <td colSpan={6}>Brak aktywnych sektorów AOI.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="ki-admin-panel">
              <h3 style={{ marginTop: 0 }}>
                Status Optymalizacji Bazy Danych Multiplayer (PostgreSQL 17 Schema v2)
              </h3>
              <ul
                style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: "0.86rem" }}
              >
                <li>
                  <b>Tabele ścieżki gorącej (`UNLOGGED` + `fillfactor=70`):</b>{" "}
                  <code>game.active_sessions</code> oraz <code>game.server_nodes</code> — brak
                  narzutu fsync WAL przy aktualizacjach pozycji 10–20 Hz (aktualizacje typu HOT w
                  obrębie tej samej strony pamięci).
                </li>
                <li>
                  <b>Indeks przestrzenny AOI (`Index-Only Scan`):</b>{" "}
                  <code>active_sessions_aoi_idx (world_id, cell_x, cell_y) INCLUDE (...)</code> —
                  zapytania <code>game.query_aoi</code> zwracają sąsiedztwo sektorów 512×512 bez
                  odczytu sterty tabeli.
                </li>
                <li>
                  <b>Wsadowa synchronizacja ticku (`Single-Roundtrip RPC`):</b>{" "}
                  <code>game.batch_sync_positions(node_id, region, jsonb)</code> aktualizuje do 500
                  graczy w pojedynczym zapytaniu SQL (brak problemu N+1).
                </li>
                <li>
                  <b>Strojenie niskiej latencji PostgreSQL (`compose.yml`):</b> <code>jit=off</code>{" "}
                  (eliminacja skoków kompilacji JIT), <code>wal_compression=lz4</code>,{" "}
                  <code>shared_buffers=256MB</code>, <code>effective_io_concurrency=200</code>.
                </li>
                <li>
                  <b>Trwałe zapisy ACID (`WAL`):</b> <code>game.character_snapshots</code> (z
                  kontrolą optymistyczną CAS <code>revision = revision + 1</code>),{" "}
                  <code>game.inventory_instances</code>, <code>game.operations</code> i{" "}
                  <code>game.outbox</code>.
                </li>
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* 4. KONSOLA LOGÓW SERWERA, SIECI I ANTI-CHEAT */}
      {subTab === "logs" && (
        <section className="ki-admin-panel">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>
              Konsola Logów Serwera, Zdarzeń Bezpieczeństwa, Anti-Cheat i Audytu (
              {filteredLogs.length})
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input
                placeholder="Szukaj w treści logów, nicku, węźle…"
                aria-label="Szukaj w logach serwera"
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
              />
              <select
                aria-label="Filtruj poziom logów"
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value as "all" | TelemetryLogLevel)}
              >
                <option value="all">Wszystkie poziomy</option>
                <option value="info">INFO</option>
                <option value="warn">WARN</option>
                <option value="error">ERROR</option>
                <option value="critical">CRITICAL</option>
                <option value="debug">DEBUG</option>
              </select>
              <select
                aria-label="Filtruj kategorię logów"
                value={logCategoryFilter}
                onChange={(e) =>
                  setLogCategoryFilter(e.target.value as "all" | TelemetryLogCategory)
                }
              >
                <option value="all">Wszystkie kategorie</option>
                <option value="tick">Tick (20 Hz)</option>
                <option value="network">Sieć / RTT</option>
                <option value="db">Baza danych (PostgreSQL)</option>
                <option value="anticheat">Anti-Cheat / Walidacja ruchu</option>
                <option value="combat">Walka</option>
                <option value="world">Świat / Migawki</option>
                <option value="auth">Autoryzacja / Role</option>
                <option value="admin">Operacje GM / Admin</option>
              </select>
              <select
                aria-label="Filtruj węzeł"
                value={logNodeFilter}
                onChange={(e) => setLogNodeFilter(e.target.value)}
              >
                <option value="all">Wszystkie węzły</option>
                {snapshot?.nodes.map((n) => (
                  <option key={n.nodeId} value={n.nodeId}>
                    {n.nodeId}
                  </option>
                ))}
                <option value="admin-console">admin-console</option>
              </select>
              {customLogs.length > 0 && (
                <button type="button" onClick={() => setCustomLogs([])}>
                  Wyczyść wpisy testowe
                </button>
              )}
            </div>
          </div>

          <table className="ki-admin-table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Poziom</th>
                <th>Kategoria</th>
                <th>Węzeł</th>
                <th>Komunikat i szczegóły</th>
                <th>Lokalizacja</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <small>{fmtDateTime(l.recordedAt)}</small>
                  </td>
                  <td>
                    <b style={{ color: LOG_LEVEL_COLORS[l.level] }}>{l.level.toUpperCase()}</b>
                  </td>
                  <td>
                    <code>{l.category}</code>
                  </td>
                  <td>
                    <small>{l.nodeId}</small>
                  </td>
                  <td>{l.message}</td>
                  <td>
                    <small>
                      {l.worldId
                        ? `${l.worldId}${l.x !== undefined && l.y !== undefined ? ` (${Math.round(l.x)}, ${Math.round(l.y)})` : ""}`
                        : "—"}
                    </small>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6}>Brak wpisów w dzienniku dla wybranych filtrów.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** Wizualny radar 2D wybranego lądu pokazujący bezpieczne miasta, lokacje, siatkę AOI i pozycje graczy. */
function WorldPlayerRadarSvg({
  worldId,
  players,
  selectedId,
  onSelectPlayer,
}: {
  worldId: FeatureId;
  players: WorldPlayerPresence[];
  selectedId: string | null;
  onSelectPlayer: (id: string) => void;
}) {
  const fInfo = WORLD_INDEX.features.find((f) => f.id === worldId) ?? WORLD_INDEX.features[0]!;
  const w = fInfo.width || 131072;
  const h = fInfo.height || 131072;
  const continent = fInfo.affinity;

  const cities = useMemo(() => ALL_CITIES_V2.filter((c) => c.continent === continent), [continent]);
  const famous = useMemo(
    () => ALL_FAMOUS_LOCATIONS_V2.filter((l) => l.continent === continent),
    [continent],
  );

  const gridStep = Math.round(w / 8);

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #6b5a3a",
        borderRadius: 8,
        overflow: "hidden",
        background: "#0d1118",
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Radar pozycji graczy na lądzie ${worldId}`}
        style={{ width: "100%", height: 340, display: "block" }}
      >
        {/* Siatka sektorów AOI */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i} stroke="#232b38" strokeWidth={Math.max(120, w * 0.0015)}>
            <line x1={i * gridStep} y1={0} x2={i * gridStep} y2={h} />
            <line x1={0} y1={i * gridStep} x2={w} y2={i * gridStep} />
          </g>
        ))}

        {/* Bezpieczne granice miast (city.bounds) */}
        {cities.map((c) => (
          <g key={c.id}>
            <rect
              x={c.bounds.x}
              y={c.bounds.y}
              width={c.bounds.width}
              height={c.bounds.height}
              fill="#1f4d3688"
              stroke="#5cd68d"
              strokeWidth={Math.max(200, w * 0.0025)}
            />
            <text
              x={c.bounds.x + c.bounds.width / 2}
              y={c.bounds.y - Math.max(400, w * 0.006)}
              fill="#9fe0a0"
              fontSize={Math.max(900, w * 0.022)}
              textAnchor="middle"
            >
              {c.name}
            </text>
          </g>
        ))}

        {/* Słynne lokacje */}
        {famous.map((loc) => (
          <g key={loc.id}>
            <circle
              cx={loc.coordinates.x}
              cy={loc.coordinates.y}
              r={Math.max(450, w * 0.008)}
              fill="#3c2f52"
              stroke="#b392f0"
              strokeWidth={Math.max(150, w * 0.002)}
            />
          </g>
        ))}

        {/* Punkt przybycia lądu */}
        <circle
          cx={fInfo.arrival.x}
          cy={fInfo.arrival.y}
          r={Math.max(600, w * 0.01)}
          fill="none"
          stroke="#7cc5ff"
          strokeDasharray={`${Math.max(400, w * 0.006)} ${Math.max(300, w * 0.004)}`}
          strokeWidth={Math.max(180, w * 0.0025)}
        />

        {/* Znaczniki wszystkich graczy na tym lądzie */}
        {players.map((p) => {
          const isSelected = p.id === selectedId;
          const color = ACTIVITY_COLORS[p.activity];
          const r = isSelected ? Math.max(1300, w * 0.022) : Math.max(950, w * 0.016);
          return (
            <g key={p.id} onClick={() => onSelectPlayer(p.id)} style={{ cursor: "pointer" }}>
              {isSelected && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r * 1.65}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={Math.max(220, w * 0.003)}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={color}
                stroke="#0f0d14"
                strokeWidth={Math.max(200, w * 0.0025)}
              />
              <text
                x={p.x}
                y={p.y - r * 1.35}
                fill="#ffffff"
                fontSize={Math.max(950, w * 0.023)}
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.nick} (poz.{p.level})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
