import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMonitoringCenter } from "@/components/admin/AdminMonitoringCenter";
import {
  buildSimulatedClusterPresence,
  collectAdminTelemetrySnapshot,
  createServerNode,
  deleteServerNode,
  getServerNodeConfigs,
  resetServerNodesToDefault,
  resolveWorldLocationInfo,
  setServerNodeStatus,
  updateServerNode,
} from "@/game/admin/adminTelemetry";
import { ALL_CITIES_V2 } from "@/game/worlds";

beforeEach(() => {
  resetServerNodesToDefault();
});

afterEach(() => {
  cleanup();
});

describe("AdminMonitoringCenter and global multiplayer telemetry", () => {
  it("resolves safe city bounds and nearest places on Superior continents", () => {
    const verdantCity = ALL_CITIES_V2.find((c) => c.continent === "verdant")!;
    const cx = verdantCity.bounds.x + verdantCity.bounds.width / 2;
    const cy = verdantCity.bounds.y + verdantCity.bounds.height / 2;

    const inside = resolveWorldLocationInfo("verdant", cx, cy);
    expect(inside.inSafeCity).toBe(true);
    expect(inside.cityName).toBe(verdantCity.name);
    expect(inside.nearestPlace).toContain(verdantCity.name);

    const outside = resolveWorldLocationInfo("verdant", 100, 100);
    expect(outside.inSafeCity).toBe(false);
    expect(outside.cityName).toBeNull();
    expect(outside.nearestPlace.length).toBeGreaterThan(0);
  });

  it("builds simulated global cluster presence with 512x512 AOI cells and server logs", () => {
    const sim = buildSimulatedClusterPresence(2);
    expect(sim.players.length).toBeGreaterThanOrEqual(8);
    expect(sim.logs.length).toBeGreaterThanOrEqual(4);

    for (const p of sim.players) {
      expect(p.cellX).toBe(Math.floor(p.x / 512));
      expect(p.cellY).toBe(Math.floor(p.y / 512));
      expect(p.pingMs).toBeGreaterThan(0);
      expect(p.fps).toBeGreaterThan(0);
    }
  });

  it("creates, edits, manages status, and deletes game server nodes", async () => {
    // 1. Create a server node with max players limit
    const created = createServerNode({
      nodeId: "eu-poland-1",
      name: "Węzeł Polska Centralna (Warszawa)",
      region: "eu-central (Warszawa)",
      host: "85.235.150.192",
      port: 7421,
      maxPlayers: 350,
      status: "online",
      tickRateHz: 20,
    });
    expect(created.nodeId).toBe("eu-poland-1");
    expect(created.maxPlayers).toBe(350);
    expect(created.name).toBe("Węzeł Polska Centralna (Warszawa)");

    let configs = getServerNodeConfigs();
    expect(configs.some((n) => n.nodeId === "eu-poland-1")).toBe(true);

    // 2. Edit server name and max players limit
    const updated = updateServerNode("eu-poland-1", {
      name: "Węzeł Polska Zachodnia (Poznań)",
      maxPlayers: 500,
      port: 7425,
    });
    expect(updated.name).toBe("Węzeł Polska Zachodnia (Poznań)");
    expect(updated.maxPlayers).toBe(500);
    expect(updated.port).toBe(7425);

    // 3. Stop server (OFFLINE)
    const stopped = setServerNodeStatus("eu-poland-1", "offline");
    expect(stopped.status).toBe("offline");

    // 4. Verify telemetry when server is offline
    const snapOff = await collectAdminTelemetrySnapshot({ includeClusterSimulation: true });
    const nodeOff = snapOff.nodes.find((n) => n.nodeId === "eu-poland-1");
    expect(nodeOff).toBeDefined();
    expect(nodeOff?.status).toBe("offline");
    expect(nodeOff?.cpuPercent).toBe(0);
    expect(nodeOff?.activePlayers).toBe(0);

    // 5. Start server (ONLINE)
    const started = setServerNodeStatus("eu-poland-1", "online");
    expect(started.status).toBe("online");

    const snapOn = await collectAdminTelemetrySnapshot({ includeClusterSimulation: true });
    const nodeOn = snapOn.nodes.find((n) => n.nodeId === "eu-poland-1");
    expect(nodeOn?.status).toBe("online");
    expect(nodeOn?.maxPlayers).toBe(500);

    // 6. Delete server
    const deleted = deleteServerNode("eu-poland-1");
    expect(deleted).toBe(true);
    configs = getServerNodeConfigs();
    expect(configs.some((n) => n.nodeId === "eu-poland-1")).toBe(false);
  });

  it("collects a full telemetry snapshot with nodes, world stats, AOI hotspots, and logs", async () => {
    const snap = await collectAdminTelemetrySnapshot({
      includeClusterSimulation: true,
      measuredFps: 60,
      tickSeed: 1,
    });
    expect(snap.nodes.length).toBeGreaterThanOrEqual(4);
    expect(snap.players.length).toBeGreaterThanOrEqual(8);
    expect(snap.hotspots.length).toBeGreaterThan(0);
    expect(snap.worldStats.verdant.totalPlayers).toBeGreaterThan(0);
    expect(snap.logs.length).toBeGreaterThan(0);
  });

  it("renders AdminMonitoringCenter tabs, world player radar, server controls, and logs", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const { getByText, getAllByText, getByLabelText, queryByText } = render(
      <AdminMonitoringCenter />,
    );

    await waitFor(() => {
      expect(getByText(/Centrum Monitoringu Serwera, Zasobów i Graczy na Świecie/i)).toBeTruthy();
    });

    // Switch to World Players & Radar tab
    fireEvent.click(getByText(/Gracze na Świecie i Mapa Pozycji/i));
    await waitFor(() => {
      expect(getByText(/Radar Świata 2D/i)).toBeTruthy();
      expect(getByText(/Szczegółowy Inspektor Gracza na Świecie/i)).toBeTruthy();
    });

    const searchInput = getByLabelText("Szukaj gracza na świecie");
    fireEvent.change(searchInput, { target: { value: "Kaelen_V" } });
    expect(getAllByText("Kaelen_V").length).toBeGreaterThanOrEqual(2);

    // Switch to Nodes & DB tab
    fireEvent.click(getByText(/Węzły Serwera, CPU\/RAM i Baza/i));
    await waitFor(() => {
      expect(getByText(/Status Optymalizacji Bazy Danych Multiplayer/i)).toBeTruthy();
      expect(getByText(/Zarządzanie i Monitoring Serwerów Gry/i)).toBeTruthy();
    });

    // Test creating a server via UI modal
    fireEvent.click(getByText("➕ Nowy serwer gry"));
    await waitFor(() => {
      expect(getByText(/Tworzenie Nowego Serwera Gry/i)).toBeTruthy();
    });

    fireEvent.change(getByLabelText("Identyfikator serwera"), { target: { value: "eu-nordic-test" } });
    fireEvent.change(getByLabelText("Nazwa serwera"), {
      target: { value: "Węzeł Skandynawia Test" },
    });
    fireEvent.change(getByLabelText("Maksymalny limit graczy"), { target: { value: "320" } });
    fireEvent.click(getByText("🚀 Zainicjuj i dodaj serwer"));

    await waitFor(() => {
      expect(getByText(/Węzeł Skandynawia Test/i)).toBeTruthy();
    });

    // Test editing server via UI modal
    const editBtns = getAllByText("✏ Edytuj");
    expect(editBtns.length).toBeGreaterThan(0);
    fireEvent.click(editBtns[0]!);

    await waitFor(() => {
      expect(getByText(/Edycja Konfiguracji Serwera/i)).toBeTruthy();
    });

    const nameInput = getByLabelText("Edycja nazwy serwera");
    fireEvent.change(nameInput, { target: { value: "Węzeł Główny EU Zaktualizowany" } });
    const limitInput = getByLabelText("Edycja limitu graczy");
    fireEvent.change(limitInput, { target: { value: "600" } });
    fireEvent.click(getByText("💾 Zapisz zmiany serwera"));

    await waitFor(() => {
      expect(getByText(/Węzeł Główny EU Zaktualizowany/i)).toBeTruthy();
      expect(getByText(/600/i)).toBeTruthy();
    });

    // Switch to Server Logs tab and emit diagnostic probe
    fireEvent.click(getByText(/Logi Serwera, Sieci i Anti-Cheat/i));
    fireEvent.click(getByText("Sonda diagnostyczna"));
    await waitFor(() => {
      expect(getByText(/Ręczny test diagnostyczny administratora/i)).toBeTruthy();
    });
  });
});
