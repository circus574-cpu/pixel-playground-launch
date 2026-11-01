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

  it("reports 0 online players by default when simulation is disabled and no one is connected", async () => {
    const snap = await collectAdminTelemetrySnapshot({
      includeClusterSimulation: false,
      measuredFps: 60,
      tickSeed: 1,
    });
    const onlinePlayers = snap.players.filter((p) => p.online);
    expect(onlinePlayers.length).toBe(0);
    // Game server nodes are always returned, without cloud-supabase mixed in
    expect(snap.nodes.length).toBeGreaterThanOrEqual(3);
    expect(snap.nodes.some((n) => n.nodeId === "cloud-supabase")).toBe(false);
    expect(snap.dbStats).toBeDefined();
    expect(snap.dbStats.port).toBe(5432);
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
    const snapOff = await collectAdminTelemetrySnapshot({ includeClusterSimulation: false });
    const nodeOff = snapOff.nodes.find((n) => n.nodeId === "eu-poland-1");
    expect(nodeOff).toBeDefined();
    expect(nodeOff?.status).toBe("offline");
    expect(nodeOff?.cpuPercent).toBe(0);
    expect(nodeOff?.activePlayers).toBe(0);

    // 5. Start server (ONLINE)
    const started = setServerNodeStatus("eu-poland-1", "online");
    expect(started.status).toBe("online");

    const snapOn = await collectAdminTelemetrySnapshot({ includeClusterSimulation: false });
    const nodeOn = snapOn.nodes.find((n) => n.nodeId === "eu-poland-1");
    expect(nodeOn?.status).toBe("online");
    expect(nodeOn?.maxPlayers).toBe(500);

    // 6. Delete server
    const deleted = deleteServerNode("eu-poland-1");
    expect(deleted).toBe(true);
    configs = getServerNodeConfigs();
    expect(configs.some((n) => n.nodeId === "eu-poland-1")).toBe(false);
  });

  it("collects a full telemetry snapshot with simulated cluster when requested", async () => {
    const snap = await collectAdminTelemetrySnapshot({
      includeClusterSimulation: true,
      measuredFps: 60,
      tickSeed: 1,
    });
    expect(snap.nodes.length).toBeGreaterThanOrEqual(3);
    expect(snap.players.length).toBeGreaterThanOrEqual(8);
    expect(snap.hotspots.length).toBeGreaterThan(0);
    expect(snap.worldStats.verdant.totalPlayers).toBeGreaterThan(0);
    expect(snap.logs.length).toBeGreaterThan(0);
  });

  it("renders AdminMonitoringCenter with dedicated Server Management panel, Physical World Map, and Database section", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const { getByText, getAllByText, getByLabelText } = render(<AdminMonitoringCenter />);

    await waitFor(() => {
      expect(getByText(/Centrum Monitoringu Serwera, Zasobów i Graczy na Świecie/i)).toBeTruthy();
      expect(getByText(/Panel Zarządzania Aktywnym Serwerem/i)).toBeTruthy();
    });

    // Test creating a server via UI modal and verifying it opens in the management panel
    fireEvent.click(getByText("➕ Nowy serwer gry"));
    await waitFor(() => {
      expect(getByText(/Tworzenie Nowego Serwera Gry/i)).toBeTruthy();
    });

    fireEvent.change(getByLabelText("Identyfikator serwera"), {
      target: { value: "eu-nordic-test" },
    });
    fireEvent.change(getByLabelText("Nazwa serwera"), {
      target: { value: "Węzeł Skandynawia Test" },
    });
    fireEvent.change(getByLabelText("Maksymalny limit graczy"), { target: { value: "320" } });
    fireEvent.click(getByText("🚀 Zainicjuj i dodaj serwer"));

    await waitFor(() => {
      expect(getAllByText(/Węzeł Skandynawia Test/i).length).toBeGreaterThanOrEqual(1);
      expect(getByText(/Konfiguracja i Parametry Serwera \(eu-nordic-test\)/i)).toBeTruthy();
    });

    // Edit the newly created server directly in the Active Server Management Panel
    const nameInput = getByLabelText("Edycja nazwy serwera");
    fireEvent.change(nameInput, { target: { value: "Węzeł Główny EU Zaktualizowany" } });
    const limitInput = getByLabelText("Edycja limitu graczy");
    fireEvent.change(limitInput, { target: { value: "600" } });
    fireEvent.click(getByText("💾 Zapisz zmiany serwera"));

    await waitFor(() => {
      expect(getAllByText(/Węzeł Główny EU Zaktualizowany/i).length).toBeGreaterThanOrEqual(1);
    });

    // Switch to Physical World Map & Players tab
    fireEvent.click(getByText(/Fizyczna Mapa Świata i Gracze/i));
    await waitFor(() => {
      expect(
        getByText(/Radar Świata 2D — Fizyczna Mapa Planety Superior i Siatka AOI/i),
      ).toBeTruthy();
      expect(getByText(/Szczegółowy Inspektor Gracza na Świecie/i)).toBeTruthy();
    });

    // Enable simulation bots to test searching a player on the physical map
    fireEvent.click(getByText(/Symulacja testowych graczy \(Boty\)/i));
    await waitFor(() => {
      expect(getAllByText("Kaelen_V").length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = getByLabelText("Szukaj gracza na świecie");
    fireEvent.change(searchInput, { target: { value: "Kaelen_V" } });
    expect(getAllByText("Kaelen_V").length).toBeGreaterThanOrEqual(2);

    // Switch to dedicated BAZA DANYCH (Supabase & PostgreSQL) tab
    fireEvent.click(getByText(/BAZA DANYCH \(Supabase i PostgreSQL/i));
    await waitFor(() => {
      expect(
        getByText(/Zarządzanie Bazą Danych — Supabase Cloud & PostgreSQL 17 Multiplayer/i),
      ).toBeTruthy();
      expect(getByText(/Status Optymalizacji Bazy Danych Multiplayer/i)).toBeTruthy();
    });

    // Switch to Server Logs tab and emit diagnostic probe
    fireEvent.click(getByText(/Logi Serwera, Sieci i Anti-Cheat/i));
    fireEvent.click(getByText("Sonda diagnostyczna"));
    await waitFor(() => {
      expect(getByText(/Ręczny test diagnostyczny administratora/i)).toBeTruthy();
    });
  });
});
