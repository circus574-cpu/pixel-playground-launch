/**
 * Centrum Monitoringu Serwera, Zasobów (CPU/RAM/Ping/FPS/Tick), Bazy Danych, Logów oraz Graczy na Świecie.
 *
 * Komponent w pełni bezinwazyjny dla pętli gry — odczytuje rzeczywiste dane z działającego serwera gry,
 * chmury Supabase (`accountsDb`), zapisów lokalnych (`localStorage`), pomiarów wydajności przeglądarki/sieci
 * oraz telemetrii węzłów multiplayer (`deploy/multiplayer/init/002-global-multiplayer-optimization.sql`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import atlas from "@/assets/planet-map/atlas-v2-3840.webp";
import projection from "@/components/planet-map/worldOverlay.v2.json";
import { worldToAtlas } from "@/components/planet-map/worldToAtlas";
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
  type ServerNodeMetric,
  type TelemetryLogCategory,
  type TelemetryLogLevel,
  type WorldPlayerPresence,
} from "@/game/admin/adminTelemetry";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { RACES } from "@/game/world/races";
import { ALL_CITIES_V2, ALL_FAMOUS_LOCATIONS_V2 } from "@/game/worlds";
import type { ManagedServerStatus } from "@/server/managedServer";

type MonitoringSubTab = "servers" | "world-players" | "database" | "overview" | "logs";

const ACTIVITY_LABELS: Record<PlayerActivityState, string> = {
  safe: "W bezpiecznym mieście",
  combat: "W walce",
  exploring: "Eksploracja szlaku",
  interior: "Wnętrze budynku",
  offline: "Offline (Zapis w bazie)",
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
  const [subTab, setSubTab] = useState<MonitoringSubTab>("servers");
  const [includeClusterSim, setIncludeClusterSim] = useState(false);
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
  const [radarWorld, setRadarWorld] = useState<"all" | FeatureId>("verdant");
  const [showAoiGrid, setShowAoiGrid] = useState(true);
  const [showRoadsLayer, setShowRoadsLayer] = useState(true);
  const [showPlacesLayer, setShowPlacesLayer] = useState(true);

  // Log filters
  const [logLevelFilter, setLogLevelFilter] = useState<"all" | TelemetryLogLevel>("all");
  const [logCategoryFilter, setLogCategoryFilter] = useState<"all" | TelemetryLogCategory>("all");
  const [logNodeFilter, setLogNodeFilter] = useState<string>("all");
  const [logQuery, setLogQuery] = useState("");
  const [customLogs, setCustomLogs] = useState<ServerLogEntry[]>([]);

  // Server node management state
  const [selectedManagedNodeId, setSelectedManagedNodeId] = useState<string>("eu-central-1");
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [createNodeId, setCreateNodeId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRegion, setCreateRegion] = useState("eu-central (Frankfurt)");
  const [createHost, setCreateHost] = useState("85.235.150.189");
  const [createPort, setCreatePort] = useState(7420);
  const [createMaxPlayers, setCreateMaxPlayers] = useState(250);
  const [createTickRate, setCreateTickRate] = useState(20.0);

  const [editingServerNode, setEditingServerNode] = useState<ServerNodeMetric | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxPlayers, setEditMaxPlayers] = useState(250);
  const [editHost, setEditHost] = useState("");
  const [editPort, setEditPort] = useState(7420);
  const [editRegion, setEditRegion] = useState("");
  const [editTickRate, setEditTickRate] = useState(20.0);

  const [serverActionMsg, setServerActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [daemonStatus, setDaemonStatus] = useState<ManagedServerStatus | null>(null);
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
    async (nextSeed?: number, customDaemon?: ManagedServerStatus | null) => {
      setLoading(true);
      try {
        let currentDaemon = customDaemon ?? daemonStatus;
        try {
          const freshDaemon = await getGameServerStatusFn();
          if (freshDaemon) {
            currentDaemon = freshDaemon;
            setDaemonStatus(freshDaemon);
            setDaemonRunning(freshDaemon.running);
            setDaemonUptime(freshDaemon.uptimeSeconds);
          }
        } catch {
          /* ignore in test/browser-only mode */
        }

        const snap = await collectAdminTelemetrySnapshot({
          includeClusterSimulation: includeClusterSim,
          measuredFps,
          tickSeed: nextSeed ?? tickSeed,
          liveDaemonStatus: currentDaemon,
        });
        setSnapshot(snap);
      } finally {
        setLoading(false);
      }
    },
    [includeClusterSim, measuredFps, tickSeed, daemonStatus],
  );

  // Synchronizuj stan formularza z konfiguracją węzłów serwera natychmiast przy zmianie selectedManagedNodeId
  const syncFormWithNodeId = useCallback((nodeId: string) => {
    const cfg = getServerNodeConfigs().find((n) => n.nodeId === nodeId);
    if (!cfg) return;
    setEditName(cfg.name || cfg.nodeId);
    setEditMaxPlayers(cfg.maxPlayers || 250);
    setEditHost(cfg.host || "85.235.150.189");
    setEditPort(cfg.port || 7420);
    setEditRegion(cfg.region || "eu-central");
    setEditTickRate(cfg.tickRateHz || 20.0);
  }, []);

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

  // Synchronizuj formularz wybranego serwera gdy zmienia się selectedManagedNodeId
  const managedNode = useMemo(() => {
    if (!snapshot || snapshot.nodes.length === 0) return null;
    return (
      snapshot.nodes.find((n) => n.nodeId === selectedManagedNodeId) ?? snapshot.nodes[0] ?? null
    );
  }, [snapshot, selectedManagedNodeId]);

  useEffect(() => {
    syncFormWithNodeId(selectedManagedNodeId);
  }, [selectedManagedNodeId, syncFormWithNodeId]);

  const handleTogglePhysicalDaemon = async () => {
    setDaemonLoading(true);
    try {
      if (daemonRunning) {
        const res = await stopGameServerFn();
        setDaemonRunning(false);
        setDaemonStatus(res.status);
        setServerActionMsg({
          type: res.ok ? "success" : "error",
          text: res.message,
        });
        void refresh(tickSeed, res.status);
      } else {
        const target = managedNode;
        const res = await startGameServerFn({
          data: {
            port: target?.port || 7420,
            nodeId: target?.nodeId || "eu-central-1",
            name: target?.name || "Węzeł Główny EU-Central #1",
            region: target?.region || "eu-central (Frankfurt)",
            maxPlayers: target?.maxPlayers || 250,
            tickRateHz: target?.tickRateHz || 20,
          },
        });
        setDaemonRunning(res.ok);
        setDaemonStatus(res.status);
        if (target) {
          setServerNodeStatus(target.nodeId, "online");
        }
        setServerActionMsg({
          type: res.ok ? "success" : "error",
          text: res.message,
        });
        void refresh(tickSeed, res.status);
      }
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
        setServerActionMsg({ type: "error", text: "Podaj identyfikator węzła (np. eu-poland-1)." });
        return;
      }
      if (!createName.trim()) {
        setServerActionMsg({ type: "error", text: "Podaj nazwę wyświetlaną serwera." });
        return;
      }
      const created = createServerNode({
        nodeId: createNodeId,
        name: createName,
        region: createRegion,
        host: createHost,
        port: Number(createPort) || 7420,
        maxPlayers: Number(createMaxPlayers) || 250,
        status: "online",
        tickRateHz: Number(createTickRate) || 20.0,
      });

      // Od razu przełącz widok na nowo utworzony serwer w panelu zarządzania!
      setSelectedManagedNodeId(created.nodeId);
      setEditName(created.name);
      setEditMaxPlayers(created.maxPlayers);
      setEditHost(created.host);
      setEditPort(created.port);
      setEditRegion(created.region);
      setEditTickRate(created.tickRateHz || 20.0);

      setServerActionMsg({
        type: "success",
        text: `Utworzono i otwarto panel zarządzania serwerem '${created.name}' [${created.nodeId}].`,
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
    setSelectedManagedNodeId(n.nodeId);
    setEditingServerNode(n);
    setEditName(n.name || n.label || n.nodeId);
    setEditMaxPlayers(n.maxPlayers || 250);
    const hostParts = n.host.split(":");
    setEditHost(hostParts[0] || "85.235.150.189");
    setEditPort(n.port || (hostParts[1] ? Number(hostParts[1]) : 7420));
    setEditRegion(n.region || "eu-central");
    setEditTickRate(n.tickRateHz || 20.0);
    setServerActionMsg(null);
  };

  const handleSaveEdit = async (targetNodeId?: string) => {
    const nodeIdToUpdate = targetNodeId || editingServerNode?.nodeId || managedNode?.nodeId;
    if (!nodeIdToUpdate) return;
    try {
      const updated = updateServerNode(nodeIdToUpdate, {
        name: editName,
        maxPlayers: Number(editMaxPlayers) || 250,
        host: editHost,
        port: Number(editPort) || 7420,
        region: editRegion,
        tickRateHz: Number(editTickRate) || 20.0,
      });

      if (daemonRunning && daemonStatus?.nodeId === nodeIdToUpdate) {
        try {
          const res = await startGameServerFn({
            data: {
              nodeId: updated.nodeId,
              name: updated.name,
              region: updated.region,
              maxPlayers: updated.maxPlayers,
              tickRateHz: updated.tickRateHz || 20,
            },
          });
          setDaemonStatus(res.status);
        } catch {
          /* ignore */
        }
      }

      setServerActionMsg({
        type: "success",
        text: `Zaktualizowano konfigurację serwera '${editName}' [${nodeIdToUpdate}].`,
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
      const updated = setServerNodeStatus(nodeId, "online");
      setSelectedManagedNodeId(nodeId);
      if (!daemonRunning || daemonStatus?.nodeId === nodeId) {
        try {
          const res = await startGameServerFn({
            data: {
              port: updated.port || 7420,
              nodeId: updated.nodeId,
              name: updated.name,
              region: updated.region,
              maxPlayers: updated.maxPlayers,
              tickRateHz: updated.tickRateHz || 20,
            },
          });
          setDaemonRunning(res.ok);
          setDaemonStatus(res.status);
        } catch {
          /* ignore */
        }
      }
      setServerActionMsg({
        type: "success",
        text: `Serwer '${updated.name}' [${nodeId}] został pomyślnie uruchomiony (status: ONLINE).`,
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
      const updated = setServerNodeStatus(nodeId, "offline");
      setSelectedManagedNodeId(nodeId);
      if (daemonRunning && daemonStatus?.nodeId === nodeId) {
        try {
          const res = await stopGameServerFn();
          setDaemonRunning(false);
          setDaemonStatus(res.status);
        } catch {
          /* ignore */
        }
      }
      setServerActionMsg({
        type: "success",
        text: `Serwer '${updated.name}' [${nodeId}] został zatrzymany i wyłączony (status: OFFLINE).`,
      });
      void refresh();
    } catch (err) {
      setServerActionMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Błąd zatrzymywania serwera",
      });
    }
  };

  const handleRestartServer = async (nodeId: string) => {
    await handleStopServer(nodeId);
    await handleStartServer(nodeId);
    setServerActionMsg({
      type: "success",
      text: `Serwer [${nodeId}] został zrestartowany i jest ponownie ONLINE.`,
    });
  };

  const handleDrainServer = (nodeId: string) => {
    try {
      setServerNodeStatus(nodeId, "draining");
      setSelectedManagedNodeId(nodeId);
      setServerActionMsg({
        type: "success",
        text: `Serwer [${nodeId}] przełączony w tryb konserwacji / opróżniania (DRAINING - brak nowych połączeń).`,
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
      if (selectedManagedNodeId === nodeId) {
        setSelectedManagedNodeId("eu-central-1");
      }
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
    setSelectedManagedNodeId("eu-central-1");
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
    const safePlayers = players.filter(
      (p) => p.online && (p.inSafeCity || p.activity === "safe"),
    ).length;
    const combatPlayers = players.filter((p) => p.online && p.activity === "combat").length;

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
          <div style={{ fontSize: "0.82rem", opacity: 0.85, marginTop: 2 }}>
            Ostatni odczyt: <b>{snapshot ? fmtTime(snapshot.collectedAt) : "trwa…"}</b> · Gracze
            Online:{" "}
            <b style={{ color: clusterTotals.onlinePlayers > 0 ? "#5cd68d" : "#9aa0a6" }}>
              {clusterTotals.onlinePlayers} online
            </b>{" "}
            <small>({clusterTotals.totalPlayers} zapisanych postaci w bazie)</small> · Baza Danych:{" "}
            <b style={{ color: snapshot?.dbConnected ? "#5cd68d" : "#ff8577" }}>
              {snapshot?.dbConnected ? "POŁĄCZONO" : "OFFLINE"}
            </b>
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
            title="Włącza testowych botów symulacyjnych na mapie i w węzłach klastra"
          >
            <input
              type="checkbox"
              checked={includeClusterSim}
              onChange={(e) => setIncludeClusterSim(e.target.checked)}
            />
            <span>Symulacja testowych graczy (Boty)</span>
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

      {/* Karty głównych wskaźników (Gracze Online, Serwery Gry, CPU/RAM, Tick/Ping, Baza Danych) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Gracze Online (Teraz w Grze)</small>
          <div
            style={{
              fontSize: "1.45rem",
              fontWeight: 700,
              color: clusterTotals.onlinePlayers > 0 ? "#5cd68d" : "#f5d48a",
              margin: "4px 0",
            }}
          >
            {clusterTotals.onlinePlayers} online{" "}
            <span style={{ fontSize: "0.82rem", fontWeight: 400, color: "#9aa0a6" }}>
              (zapisanych: {clusterTotals.totalPlayers})
            </span>
          </div>
          <small>
            W bezpiecznym mieście: {clusterTotals.safePlayers} · W walce:{" "}
            {clusterTotals.combatPlayers}
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Status Głównego Serwera Gry</small>
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: daemonRunning ? "#5cd68d" : "#f5d48a",
              margin: "4px 0",
            }}
          >
            {daemonRunning ? `ONLINE (Port ${daemonStatus?.port ?? 7420})` : "GOTOWY / STANDBY"}
          </div>
          <small>
            Węzły gry: {snapshot?.nodes.filter((n) => n.status === "online").length ?? 0} /{" "}
            {snapshot?.nodes.length ?? 0} aktywnych
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Obciążenie CPU i Pamięć RAM</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#7cc5ff", margin: "4px 0" }}>
            {clusterTotals.avgCpu}% CPU{" "}
            <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              · {clusterTotals.totalMemUsed} MB RAM
            </span>
          </div>
          <small>
            JS Heap przeglądarki: {snapshot?.clientHeapUsedMb ?? 0} MB ·{" "}
            {snapshot?.clientFps ?? measuredFps} FPS
          </small>
        </div>

        <div className="ki-admin-panel" style={{ padding: 12 }}>
          <small>Pętla Ticku (20 Hz) i Sieć</small>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "#5cd68d", margin: "4px 0" }}>
            {clusterTotals.avgTickP95} ms{" "}
            <span style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              (Śr. ping: {clusterTotals.avgPing} ms)
            </span>
          </div>
          <small>
            Ruch: {clusterTotals.totalPacketsIn} pkt/s WEJ · {clusterTotals.totalPacketsOut} pkt/s
            WYJ
          </small>
        </div>

        <div
          className="ki-admin-panel"
          style={{ padding: 12, cursor: "pointer" }}
          onClick={() => setSubTab("database")}
          title="Kliknij, aby przejść do sekcji Baza Danych (Supabase i PostgreSQL)"
        >
          <small>Baza Danych (Supabase / PostgreSQL)</small>
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: snapshot?.dbConnected ? "#5cd68d" : "#ff8577",
              margin: "4px 0",
            }}
          >
            {snapshot?.dbConnected ? `ONLINE (${snapshot.dbLatencyMs} ms)` : "TRYB LOKALNY"}
          </div>
          <small>
            Konta: {snapshot?.dbStats.profilesCount ?? 0} · Postacie:{" "}
            {snapshot?.dbStats.charactersCount ?? 0} → Zarządzaj
          </small>
        </div>
      </section>

      {/* Nawigacja podzakładek monitoringu i zarządzania */}
      <div className="ki-admin-tabs" role="tablist" aria-label="Sekcje monitoringu">
        {(
          [
            ["servers", `🖥️ Serwery Gry i Zarządzanie (${snapshot?.nodes.length ?? 0})`],
            [
              "world-players",
              `🗺️ Fizyczna Mapa Świata i Gracze (${clusterTotals.onlinePlayers} online / ${snapshot?.players.length ?? 0})`,
            ],
            [
              "database",
              `🗄️ BAZA DANYCH (Supabase i PostgreSQL · ${snapshot?.dbStats.charactersCount ?? 0} zapisów)`,
            ],
            ["overview", "📊 Przegląd Lądów i Zasobów"],
            ["logs", `📜 Logi Serwera, Sieci i Anti-Cheat (${allLogs.length})`],
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

      {/* ================================================================================= */}
      {/* 1. SERWERY GRY I ZARZĄDZANIE (DEDYKOWANY PANEL STEROWANIA + LISTA SERWERÓW)        */}
      {/* ================================================================================= */}
      {subTab === "servers" && snapshot && (
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

          {/* Szybki pasek procesu fizycznego serwera WebSocket */}
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
                  Fizyczny Proces Serwera Gry (WebSocket Daemon):{" "}
                  <span style={{ color: daemonRunning ? "#5cd68d" : "#f5d48a" }}>
                    {daemonRunning
                      ? `URUCHOMIONY NA PORCIE ${daemonStatus?.port ?? 7420} (${daemonStatus?.nodeId ?? "eu-central-1"})`
                      : "ZATRZYMANY (GOTOWY DO STARTU)"}
                  </span>
                </strong>
              </div>
              <small style={{ color: "#cbd5e1" }}>
                {daemonRunning
                  ? `Aktywne połączenia WebSocket: ${daemonStatus?.activePlayers ?? 0} / ${daemonStatus?.maxPlayers ?? 250} graczy · Czas działania (Uptime): ${daemonUptime}s · Pętla: ${daemonStatus?.tickRateHz ?? 20} Hz.`
                  : "Możesz uruchomić fizyczny serwer gry jednym kliknięciem poniżej lub wybrać konkretny serwer z listy i kliknąć Uruchom."}
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
                    ? "🛑 Wyłącz Proces Serwera Gry"
                    : "🚀 Uruchom Serwer Gry (1 kliknięcie)"}
              </button>
              <button
                type="button"
                className="ki-admin-btn"
                onClick={() => setShowCreateServerModal(true)}
                style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px" }}
              >
                ➕ Utwórz nowy serwer gry
              </button>
            </div>
          </section>

          {/* Formularz tworzenia nowego serwera */}
          {showCreateServerModal && (
            <section
              className="ki-admin-panel"
              style={{
                border: "2px solid #7cc5ff",
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
                  ✕ Zamknij
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
                    Identyfikator serwera (unikalny ID):
                  </label>
                  <input
                    aria-label="Identyfikator serwera"
                    placeholder="np. pl-warszawa-1"
                    value={createNodeId}
                    onChange={(e) => setCreateNodeId(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Nazwa wyświetlana serwera:
                  </label>
                  <input
                    aria-label="Nazwa serwera"
                    placeholder="np. Serwer Polska #1 (Warszawa)"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Region geograficzny:
                  </label>
                  <input
                    aria-label="Region serwera"
                    placeholder="np. eu-central (Warszawa)"
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
                    placeholder="np. 85.235.150.189"
                    value={createHost}
                    onChange={(e) => setCreateHost(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", marginBottom: 4 }}>
                    Port sieciowy (TCP/WebSocket):
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

          {/* ================================================================================= */}
          {/* DEDYKOWANA SEKCJA ZARZĄDZANIA WYBRANYM / UTWORZONYM SERWEREM GRY                  */}
          {/* ================================================================================= */}
          {managedNode && (
            <section
              className="ki-admin-panel"
              style={{
                border: "2px solid #c8a35a",
                background: "#181420",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 12,
                  marginBottom: 14,
                  borderBottom: "1px solid #3a3242",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ margin: 0, color: "#f5d48a" }}>
                      🎛️ Panel Zarządzania Aktywnym Serwerem: {managedNode.name}
                    </h3>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 4,
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        background:
                          managedNode.status === "online"
                            ? "#1b4d2e"
                            : managedNode.status === "draining"
                              ? "#4d3d1b"
                              : "#3d1b1b",
                        color:
                          managedNode.status === "online"
                            ? "#5cd68d"
                            : managedNode.status === "draining"
                              ? "#f5d48a"
                              : "#ff8577",
                      }}
                    >
                      {managedNode.status.toUpperCase()}
                    </span>
                  </div>
                  <small style={{ color: "#cbd5e1" }}>
                    ID węzła: <code>{managedNode.nodeId}</code> · Adres:{" "}
                    <code>{managedNode.host}</code> · Region: <b>{managedNode.region}</b> · Sloty:{" "}
                    <b>
                      {managedNode.activePlayers} / {managedNode.maxPlayers} graczy online
                    </b>
                  </small>
                </div>

                {/* Wybór którym serwerem zarządzamy + przyciski akcji zasilania */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: "0.82rem", margin: 0 }}>
                    Wybrany serwer:{" "}
                    <select
                      aria-label="Wybierz serwer do zarządzania"
                      value={managedNode.nodeId}
                      onChange={(e) => setSelectedManagedNodeId(e.target.value)}
                    >
                      {snapshot.nodes.map((n) => (
                        <option key={n.nodeId} value={n.nodeId}>
                          {n.name} [{n.nodeId}] ({n.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </label>

                  {managedNode.status === "offline" || managedNode.status === "stopping" ? (
                    <button
                      type="button"
                      className="ki-admin-btn"
                      onClick={() => void handleStartServer(managedNode.nodeId)}
                      style={{
                        background: "#2e7d32",
                        color: "#fff",
                        fontWeight: "bold",
                        padding: "6px 14px",
                      }}
                    >
                      ▶ Uruchom ten serwer
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ki-admin-btn"
                      onClick={() => void handleStopServer(managedNode.nodeId)}
                      style={{
                        background: "#c53030",
                        color: "#fff",
                        fontWeight: "bold",
                        padding: "6px 14px",
                      }}
                    >
                      ⏹ Wyłącz ten serwer
                    </button>
                  )}

                  <button
                    type="button"
                    className="ki-admin-btn"
                    onClick={() => void handleRestartServer(managedNode.nodeId)}
                    style={{ padding: "6px 12px" }}
                  >
                    🔄 Restartuj
                  </button>

                  <button
                    type="button"
                    className="ki-admin-btn"
                    onClick={() => handleDrainServer(managedNode.nodeId)}
                    style={{ padding: "6px 12px" }}
                  >
                    ⏳ Tryb konserwacji (Draining)
                  </button>

                  <button
                    type="button"
                    className="ki-admin-btn"
                    onClick={() => handleDeleteServer(managedNode.nodeId)}
                    style={{ padding: "6px 12px", color: "#ff8577" }}
                  >
                    🗑 Usuń serwer
                  </button>
                </div>
              </div>

              {/* Dwie kolumny wewnątrz Panelu Zarządzania Serwerem: Konfiguracja na żywo + Telemetria tego serwera */}
              <div className="ki-admin-grid">
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "#120f17",
                    border: "1px solid #2e2638",
                  }}
                >
                  <h4 style={{ marginTop: 0, marginBottom: 10, color: "#f5d48a" }}>
                    ⚙️ Konfiguracja i Parametry Serwera ({managedNode.nodeId})
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
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
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                        Limit graczy (Max Sloty):
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
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                        Host / IP serwera:
                      </label>
                      <input
                        aria-label="Edycja hosta serwera"
                        value={editHost}
                        onChange={(e) => setEditHost(e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                        Port TCP / WS:
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
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
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
                      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                        Częstotliwość Tick Rate (Hz):
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

                  <button
                    type="button"
                    className="ki-admin-btn"
                    onClick={() => void handleSaveEdit(managedNode.nodeId)}
                    style={{
                      background: "#e65100",
                      color: "#fff",
                      fontWeight: "bold",
                      padding: "7px 16px",
                    }}
                  >
                    💾 Zapisz zmiany serwera
                  </button>
                </div>

                {/* Statystyki na żywo dla wybranego serwera */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "#120f17",
                    border: "1px solid #2e2638",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <h4 style={{ marginTop: 0, marginBottom: 4, color: "#7cc5ff" }}>
                    📈 Telemetria i Obciążenie Serwera ({managedNode.nodeId})
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 8,
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Połączeni Gracze</small>
                      <div style={{ fontSize: "1.15rem", fontWeight: "bold", color: "#5cd68d" }}>
                        {managedNode.activePlayers} / {managedNode.maxPlayers}
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Obciążenie CPU</small>
                      <div style={{ fontSize: "1.15rem", fontWeight: "bold", color: "#f5d48a" }}>
                        {managedNode.cpuPercent}% <small>(load {managedNode.loadAvg1m})</small>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Pamięć RAM</small>
                      <div style={{ fontSize: "1.15rem", fontWeight: "bold", color: "#7cc5ff" }}>
                        {managedNode.memUsedMb} / {managedNode.memTotalMb} MB
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Pętla Symulacji</small>
                      <div style={{ fontSize: "1.15rem", fontWeight: "bold" }}>
                        {managedNode.tickRateHz} Hz <small>(p95: {managedNode.tickP95Ms} ms)</small>
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Średni Ping RTT</small>
                      <div style={{ fontSize: "1.15rem", fontWeight: "bold", color: "#5cd68d" }}>
                        {managedNode.avgPingMs} ms
                      </div>
                    </div>
                    <div style={{ padding: 8, background: "#1a1622", borderRadius: 6 }}>
                      <small>Ruch Sieciowy</small>
                      <div style={{ fontSize: "1.0rem", fontWeight: "bold" }}>
                        {managedNode.packetsInSec} wej / {managedNode.packetsOutSec} wyj pkt/s
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tabela wszystkich serwerów gry */}
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
                  Lista skonfigurowanych serwerów gry (bez bazy danych Supabase, która znajduje się
                  w sekcji BAZA DANYCH). Kliknij wiersz lub przycisk „Zarządzaj / Edytuj”, aby
                  sterować wybranym serwerem powyżej.
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
                  <th>Gracze Online / Limit</th>
                  <th>CPU % · Load 1m</th>
                  <th>RAM (Used / Total)</th>
                  <th>Tick (p50 / p95)</th>
                  <th>Ping</th>
                  <th>Zarządzanie Serwerem</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.nodes.map((n) => {
                  const maxCap = n.maxPlayers || 250;
                  const pct = Math.round((n.activePlayers / maxCap) * 100);
                  const isOff = n.status === "offline" || n.status === "stopping";
                  const isOnline = n.status === "online" || n.status === "degraded";
                  const isSelected = managedNode?.nodeId === n.nodeId;

                  return (
                    <tr
                      key={n.nodeId}
                      onClick={() => setSelectedManagedNodeId(n.nodeId)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "#261f30" : undefined,
                      }}
                    >
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
                      <td style={{ minWidth: 140 }}>
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
                              background: pct > 90 ? "#ff6b6b" : pct > 75 ? "#f5d48a" : "#5cd68d",
                              transition: "width 0.2s ease",
                            }}
                          />
                        </div>
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
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {isOff ? (
                            <button
                              type="button"
                              className="ki-admin-btn"
                              onClick={() => void handleStartServer(n.nodeId)}
                              style={{
                                background: "#1b4d2e",
                                color: "#5cd68d",
                                padding: "3px 8px",
                                fontSize: "0.78rem",
                              }}
                            >
                              ▶ Uruchom
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ki-admin-btn"
                              onClick={() => void handleStopServer(n.nodeId)}
                              style={{
                                background: "#4d1b1b",
                                color: "#ff8577",
                                padding: "3px 8px",
                                fontSize: "0.78rem",
                              }}
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
                            >
                              ⏳ Drenuj
                            </button>
                          )}

                          <button
                            type="button"
                            className="ki-admin-btn"
                            onClick={() => handleOpenEdit(n)}
                            style={{ padding: "3px 8px", fontSize: "0.78rem" }}
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
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ================================================================================= */}
      {/* 2. FIZYCZNA MAPA ŚWIATA I GRACZE NA ŚWIECIE                                        */}
      {/* ================================================================================= */}
      {subTab === "world-players" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
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
                <div>
                  <h3 style={{ margin: 0 }}>
                    Radar Świata 2D — Fizyczna Mapa Planety Superior i Siatka AOI
                  </h3>
                  <small style={{ color: "#9aa0a6" }}>
                    Fizyczna tekstura świata (atlas-v2) z drogami, miastami, siatką AOI i pozycjami
                    graczy ({clusterTotals.onlinePlayers} online, {snapshot.players.length}{" "}
                    zapisanych)
                  </small>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <select
                    aria-label="Wybierz ląd radaru"
                    value={radarWorld}
                    onChange={(e) => setRadarWorld(e.target.value as "all" | FeatureId)}
                  >
                    <option value="all">
                      🌍 Cała Planeta Superior ({snapshot.players.length})
                    </option>
                    {FEATURE_IDS.map((fid) => (
                      <option key={fid} value={fid}>
                        {getFeatureDisplayName(fid)} (
                        {snapshot.players.filter((p) => p.worldId === fid).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Przełączniki warstw fizycznej mapy */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 8,
                  fontSize: "0.8rem",
                }}
              >
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showAoiGrid}
                    onChange={(e) => setShowAoiGrid(e.target.checked)}
                  />
                  <span>Siatka sektorów AOI</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showRoadsLayer}
                    onChange={(e) => setShowRoadsLayer(e.target.checked)}
                  />
                  <span>Drogi i szlaki</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showPlacesLayer}
                    onChange={(e) => setShowPlacesLayer(e.target.checked)}
                  />
                  <span>Miasta i lokacje</span>
                </label>
              </div>

              <PhysicalWorldPlayerMapSvg
                worldId={radarWorld}
                players={
                  radarWorld === "all"
                    ? snapshot.players
                    : snapshot.players.filter((p) => p.worldId === radarWorld)
                }
                selectedId={selectedPlayer?.id ?? null}
                showAoiGrid={showAoiGrid}
                showRoads={showRoadsLayer}
                showPlaces={showPlacesLayer}
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
                          <b>{selectedPlayer.source.toUpperCase()}</b> · Status:{" "}
                          <b style={{ color: selectedPlayer.online ? "#5cd68d" : "#9aa0a6" }}>
                            {selectedPlayer.online ? "ONLINE (W GRZE)" : "OFFLINE (ZAPIS)"}
                          </b>
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
                      Przybliż mapę na ląd gracza ({selectedPlayer.worldId})
                    </button>
                    <button type="button" onClick={() => setRadarWorld("all")}>
                      Pokaż całą planetę
                    </button>
                    <small style={{ alignSelf: "center" }}>
                      Ostatni zapis: {fmtDateTime(selectedPlayer.lastSeenAt)} · Rewizja:{" "}
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
                <p>
                  Brak wybranego gracza. Jeśli nikt nie jest online, możesz przejrzeć zapisane
                  postacie poniżej lub włączyć „Symulację testowych graczy (Boty)” na górnym pasku.
                </p>
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
                Lista Graczy i Zapisanych Postaci na Świecie ({filteredPlayers.length} /{" "}
                {snapshot.players.length} · Online: {clusterTotals.onlinePlayers})
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
                  <option value="all">Wszystkie (Online + Zapisy Offline)</option>
                  <option value="online">Tylko Online (Aktywni w grze)</option>
                  <option value="safe">W bezpiecznym mieście</option>
                  <option value="combat">W walce</option>
                  <option value="exploring">Eksploracja</option>
                  <option value="interior">Wnętrze</option>
                  <option value="offline">Offline (Zapis w bazie)</option>
                </select>
                <select
                  aria-label="Filtruj źródło"
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as "all" | "cloud" | "local" | "multiplayer")
                  }
                >
                  <option value="all">Wszystkie źródła</option>
                  <option value="multiplayer">Sesje Serwera Gry (Live WS)</option>
                  <option value="cloud">Chmura (Supabase)</option>
                  <option value="local">Lokalne urządzenie</option>
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
                          {p.online
                            ? `● ONLINE (${ACTIVITY_LABELS[p.activity]})`
                            : "○ OFFLINE (Zapis)"}
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

      {/* ================================================================================= */}
      {/* 3. BAZA DANYCH (SUPABASE I POSTGRESQL 17) — WYDZIELONA SEKCJA                     */}
      {/* ================================================================================= */}
      {subTab === "database" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
          <section
            className="ki-admin-panel"
            style={{
              border: `1px solid ${snapshot.dbStats.connected ? "#5cd68d" : "#ff8577"}`,
              background: "#141824",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#7cc5ff" }}>
                  🗄️ Zarządzanie Bazą Danych — Supabase Cloud & PostgreSQL 17 Multiplayer
                </h3>
                <small style={{ color: "#cbd5e1" }}>
                  Centralny panel diagnostyki, połączeń, tabel kont (`profiles`, `characters`,
                  `user_roles`, `admin_audit`) oraz silnika PostgreSQL 17 (`game.active_sessions`,
                  `game.character_snapshots`).
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="ki-admin-btn"
                  onClick={() => void refresh()}
                  style={{ background: "#1e3a5f", color: "#fff", fontWeight: "bold" }}
                >
                  🔄 Testuj połączenie i odśwież bazę
                </button>
              </div>
            </div>

            <div className="ki-admin-grid">
              <div className="ki-admin-stat-card">
                <small>Status Połączenia Supabase</small>
                <h3 style={{ color: snapshot.dbStats.connected ? "#5cd68d" : "#ff8577" }}>
                  {snapshot.dbStats.connected ? "ONLINE (POŁĄCZONO)" : "OFFLINE / BŁĄD"}
                </h3>
                <small>
                  Host: <code>{snapshot.dbStats.host}</code> · Ping RTT:{" "}
                  <b>{snapshot.dbStats.latencyMs} ms</b>
                </small>
              </div>

              <div className="ki-admin-stat-card">
                <small>Zarejestrowane Konta i Role</small>
                <h3>{snapshot.dbStats.profilesCount} kont</h3>
                <small>
                  Przypisane role (`user_roles`): <b>{snapshot.dbStats.rolesCount}</b>
                </small>
              </div>

              <div className="ki-admin-stat-card">
                <small>Zapisane Postacie w Bazie (`characters`)</small>
                <h3 style={{ color: "#f5d48a" }}>{snapshot.dbStats.charactersCount} postaci</h3>
                <small>
                  Wpisy audytu (`admin_audit`): <b>{snapshot.dbStats.auditsCount}</b>
                </small>
              </div>

              <div className="ki-admin-stat-card">
                <small>Pula Połączeń PostgreSQL Pooler</small>
                <h3>
                  {snapshot.dbStats.poolActive} aktywne / {snapshot.dbStats.poolMax} max
                </h3>
                <small style={{ color: "#5cd68d" }}>
                  Idle: {snapshot.dbStats.poolIdle} · Tabele UNLOGGED HOT:{" "}
                  {snapshot.dbStats.hotTablesUnlogged ? "AKTYWNE" : "WYŁ."}
                </small>
              </div>
            </div>

            {snapshot.dbStats.error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 6,
                  background: "#3d1b1b",
                  color: "#ffc2bc",
                }}
              >
                <b>Komunikat błędu bazy danych:</b> {snapshot.dbStats.error}
              </div>
            )}
          </section>

          <div className="ki-admin-grid">
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

            <section className="ki-admin-panel">
              <h3 style={{ marginTop: 0 }}>
                Najbardziej Obciążone Sektory AOI 512×512 w Bazie (Hotspoty)
              </h3>
              <table className="ki-admin-table">
                <thead>
                  <tr>
                    <th>Ląd</th>
                    <th>Komórka AOI [X, Y]</th>
                    <th>Środek (X, Y)</th>
                    <th>Postacie (Online)</th>
                    <th>W walce</th>
                    <th>Śr. Ping / FPS</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.hotspots.slice(0, 10).map((h) => (
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
                      <td colSpan={6}>Brak zapisanych pozycji w sektorach AOI.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* 4. PRZEGLĄD LĄDÓW I ZASOBÓW (OVERVIEW)                                             */}
      {/* ================================================================================= */}
      {subTab === "overview" && snapshot && (
        <div style={{ display: "grid", gap: 14 }}>
          <section className="ki-admin-panel">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              Populacja i Wydajność na Lądach Planety Superior (10 Lądów)
            </h3>
            <table className="ki-admin-table">
              <thead>
                <tr>
                  <th>Ląd / Kraina</th>
                  <th>Aktywni Gracze (Online)</th>
                  <th>Zapisane Postacie (Łącznie)</th>
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
                      <td style={{ color: st.onlinePlayers > 0 ? "#5cd68d" : undefined }}>
                        <b>{st.onlinePlayers} online</b>
                      </td>
                      <td>{st.totalPlayers}</td>
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
                          Pokaż na fizycznej mapie
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ================================================================================= */}
      {/* 5. KONSOLA LOGÓW SERWERA, SIECI I ANTI-CHEAT                                      */}
      {/* ================================================================================= */}
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
                <option value="baza-supabase">baza-supabase</option>
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

/**
 * Fizyczna mapa świata Superior v2 (`atlas-v2-3840.webp`) z nałożoną siatką AOI, drogami,
 * miastami, lokacjami i pozycjami graczy przeliczanymi przez `worldToAtlas`.
 */
function PhysicalWorldPlayerMapSvg({
  worldId,
  players,
  selectedId,
  showAoiGrid,
  showRoads,
  showPlaces,
  onSelectPlayer,
}: {
  worldId: "all" | FeatureId;
  players: WorldPlayerPresence[];
  selectedId: string | null;
  showAoiGrid: boolean;
  showRoads: boolean;
  showPlaces: boolean;
  onSelectPlayer: (id: string) => void;
}) {
  // Wyliczamy bounding box na atlasie (2000 x 1000) dla wybranego lądu lub całej planety
  const viewBox = useMemo(() => {
    if (worldId === "all") {
      return { x: 0, y: 0, w: 2000, h: 1000 };
    }
    const landTiles = projection.tiles.filter((t) => t.land === worldId);
    if (landTiles.length === 0) {
      return { x: 0, y: 0, w: 2000, h: 1000 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of landTiles) {
      const [cx, cy, cw, ch] = t.crop as [number, number, number, number];
      const [a, b, c, d, e, f] = t.m as [number, number, number, number, number, number];
      const corners: [number, number][] = [
        [cx, cy],
        [cx + cw, cy],
        [cx, cy + ch],
        [cx + cw, cy + ch],
      ];
      for (const [px, py] of corners) {
        const ax = a * px + c * py + e;
        const ay = b * px + d * py + f;
        if (ax < minX) minX = ax;
        if (ay < minY) minY = ay;
        if (ax > maxX) maxX = ax;
        if (ay > maxY) maxY = ay;
      }
    }
    const padX = Math.max(25, (maxX - minX) * 0.12);
    const padY = Math.max(20, (maxY - minY) * 0.12);
    const x = Math.max(0, minX - padX);
    const y = Math.max(0, minY - padY);
    const w = Math.min(2000 - x, maxX - minX + padX * 2);
    const h = Math.min(1000 - y, maxY - minY + padY * 2);
    return { x, y, w, h };
  }, [worldId]);

  const roadPaths = useMemo(() => {
    const filteredRoads =
      worldId === "all" ? projection.roads : projection.roads.filter((r) => r.land === worldId);
    return ["road", "trail"].map((kind) => ({
      kind,
      d: filteredRoads
        .filter((r) => (kind === "road" ? r.kind !== "trail" : r.kind === "trail"))
        .map((r) => r.points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(""))
        .join(""),
    }));
  }, [worldId]);

  const placesOnView = useMemo(() => {
    return worldId === "all"
      ? projection.places
      : projection.places.filter((p) => p.land === worldId);
  }, [worldId]);

  // Projektujemy pozycje graczy na współrzędne fizycznego atlasu (2000 x 1000)
  const projectedPlayers = useMemo(() => {
    return players.flatMap((p) => {
      const pt = worldToAtlas(projection, p.worldId, p.x, p.y);
      if (!pt) return [];
      return [{ player: p, ax: pt.x, ay: pt.y }];
    });
  }, [players]);

  const scaleFactor = viewBox.w / 2000;
  const markerRadius = Math.max(2.2, 11 * scaleFactor);
  const strokeW = Math.max(0.4, 2.0 * scaleFactor);
  const fontSize = Math.max(3.2, 16 * scaleFactor);

  // Siatka sektorów AOI nałożona na fizyczną mapę
  const gridLines = useMemo(() => {
    const stepX = viewBox.w / 8;
    const stepY = viewBox.h / 6;
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 1; i < 8; i++) {
      lines.push({
        x1: viewBox.x + i * stepX,
        y1: viewBox.y,
        x2: viewBox.x + i * stepX,
        y2: viewBox.y + viewBox.h,
      });
    }
    for (let j = 1; j < 6; j++) {
      lines.push({
        x1: viewBox.x,
        y1: viewBox.y + j * stepY,
        x2: viewBox.x + viewBox.w,
        y2: viewBox.y + j * stepY,
      });
    }
    return lines;
  }, [viewBox]);

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #6b5a3a",
        borderRadius: 8,
        overflow: "hidden",
        background: "#0b1520",
      }}
    >
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        role="img"
        aria-label={`Radar pozycji graczy na lądzie ${worldId}`}
        style={{ width: "100%", height: 380, display: "block" }}
      >
        {/* FIZYCZNA MAPA ŚWIATA (Tekstura Atlasu Planety Superior) */}
        <image
          href={atlas}
          x={0}
          y={0}
          width={2000}
          height={1000}
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Siatka sektorów AOI */}
        {showAoiGrid &&
          gridLines.map((ln, idx) => (
            <line
              key={idx}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke="rgba(124, 197, 255, 0.25)"
              strokeDasharray={`${strokeW * 3} ${strokeW * 2}`}
              strokeWidth={strokeW * 0.6}
            />
          ))}

        {/* Drogi i ścieżki na fizycznej mapie */}
        {showRoads &&
          roadPaths.map((r) => (
            <path
              key={r.kind}
              d={r.d}
              fill="none"
              stroke={r.kind === "road" ? "#f5d28a" : "#87d8bd"}
              strokeWidth={r.kind === "road" ? 1.5 : 0.9}
              strokeOpacity={0.85}
              vectorEffect="non-scaling-stroke"
            />
          ))}

        {/* Miasta i lokacje na fizycznej mapie */}
        {showPlaces &&
          placesOnView.map((pl, idx) => {
            const isCity = pl.kind === "capital" || pl.kind === "town" || pl.kind === "city";
            return (
              <g key={`${pl.id}-${idx}`}>
                <circle
                  cx={pl.x}
                  cy={pl.y}
                  r={isCity ? markerRadius * 0.85 : markerRadius * 0.5}
                  fill={isCity ? "#1f4d36" : "#3c2f52"}
                  stroke={isCity ? "#5cd68d" : "#b392f0"}
                  strokeWidth={strokeW * 0.6}
                >
                  <title>{pl.name || pl.id}</title>
                </circle>
                {isCity && (
                  <text
                    x={pl.x}
                    y={pl.y - markerRadius * 1.1}
                    fill="#d8ffe4"
                    stroke="#09130d"
                    strokeWidth={strokeW * 0.35}
                    paintOrder="stroke"
                    fontSize={fontSize * 0.85}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {pl.name || pl.id}
                  </text>
                )}
              </g>
            );
          })}

        {/* Znaczniki graczy na fizycznej mapie */}
        {projectedPlayers.map(({ player: p, ax, ay }) => {
          const isSelected = p.id === selectedId;
          const color = ACTIVITY_COLORS[p.activity];
          const r = isSelected ? markerRadius * 1.45 : markerRadius;
          return (
            <g key={p.id} onClick={() => onSelectPlayer(p.id)} style={{ cursor: "pointer" }}>
              {isSelected && (
                <circle
                  cx={ax}
                  cy={ay}
                  r={r * 1.7}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={strokeW * 1.1}
                />
              )}
              <circle
                cx={ax}
                cy={ay}
                r={r}
                fill={color}
                stroke="#0f0d14"
                strokeWidth={strokeW * 0.9}
              >
                <title>
                  {p.nick} (poz. {p.level}) — {p.nearestPlace} ({p.x}, {p.y})
                </title>
              </circle>
              <text
                x={ax}
                y={ay - r * 1.35}
                fill="#ffffff"
                stroke="#0b0910"
                strokeWidth={strokeW * 0.45}
                paintOrder="stroke"
                fontSize={fontSize}
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
