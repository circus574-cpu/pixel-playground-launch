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
    // Only the real Superior game server is listed, without cloud-supabase mixed in
    expect(snap.nodes.map((n) => n.nodeId)).toEqual(["eu-central-1"]);
    expect(snap.dbStats).toBeDefined();
    expect(snap.dbStats.port).toBe(5432);
    // Without an answer from the server the snapshot reports the database as unreachable instead
    // of showing data from the retired cloud project.
    expect(snap.dbConnected).toBe(false);
    const real = await collectAdminTelemetrySnapshot({
      database: {
        connected: true,
        latencyMs: 4,
        error: null,
        host: "db:5432",
        accounts: 7,
        roles: 2,
        characters: 5,
        audits: 3,
        connections: 6,
        maxConnections: 100,
      },
    });
    expect(real.dbConnected).toBe(true);
    expect(real.dbStats).toMatchObject({ profilesCount: 7, charactersCount: 5, poolMax: 100 });
  });

  it("manages the single Superior server: edit, status; no create, no delete, fixed port", async () => {
    expect(() =>
      createServerNode({
        nodeId: "eu-poland-1",
        name: "Węzeł Polska",
        region: "eu-central (Warszawa)",
        host: "85.235.150.192",
        port: 7421,
        maxPlayers: 350,
        status: "online",
        tickRateHz: 20,
      }),
    ).toThrow(/jeden serwer/);
    expect(getServerNodeConfigs().map((n) => n.nodeId)).toEqual(["eu-central-1"]);

    const updated = updateServerNode("eu-central-1", {
      name: "Superior",
      maxPlayers: 50,
      port: 7425,
      host: "10.0.0.1",
    });
    expect(updated.name).toBe("Superior");
    expect(updated.maxPlayers).toBe(50);
    expect(updated.port).toBe(7420);
    expect(updated.host).toBe("85.235.150.189");

    expect(setServerNodeStatus("eu-central-1", "offline").status).toBe("offline");
    const snapOff = await collectAdminTelemetrySnapshot({ includeClusterSimulation: false });
    const nodeOff = snapOff.nodes.find((n) => n.nodeId === "eu-central-1");
    expect(nodeOff?.status).toBe("offline");
    expect(nodeOff?.activePlayers).toBe(0);

    expect(setServerNodeStatus("eu-central-1", "online").status).toBe("online");
    const snapOn = await collectAdminTelemetrySnapshot({ includeClusterSimulation: false });
    expect(snapOn.nodes.find((n) => n.nodeId === "eu-central-1")?.maxPlayers).toBe(50);

    expect(deleteServerNode("eu-central-1")).toBe(false);
    expect(getServerNodeConfigs().map((n) => n.nodeId)).toEqual(["eu-central-1"]);
  });

  it("collects a full telemetry snapshot with simulated cluster when requested", async () => {
    const snap = await collectAdminTelemetrySnapshot({
      includeClusterSimulation: true,
      measuredFps: 60,
      tickSeed: 1,
    });
    expect(snap.nodes.map((n) => n.nodeId)).toEqual(["eu-central-1"]);
    expect(snap.players.length).toBeGreaterThanOrEqual(8);
    expect(snap.hotspots.length).toBeGreaterThan(0);
    expect(snap.worldStats.verdant.totalPlayers).toBeGreaterThan(0);
    expect(snap.logs.length).toBeGreaterThan(0);
  });

  it("renders AdminMonitoringCenter with dedicated Server Management panel, Physical World Map, and Database section", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    const { getByText, getAllByText, getByLabelText, queryByText } = render(
      <AdminMonitoringCenter />,
    );

    await waitFor(() => {
      expect(getByText(/Centrum Monitoringu Serwera, Zasobów i Graczy na Świecie/i)).toBeTruthy();
      expect(getByText(/Panel Zarządzania Aktywnym Serwerem/i)).toBeTruthy();
    });

    expect(queryByText("➕ Nowy serwer gry")).toBeNull();
    expect(queryByText(/Węzeł Zapasowy EU-West/i)).toBeNull();
    expect(queryByText(/US-East/i)).toBeNull();

    // Edit Superior in the Active Server Management Panel; the port stays read-only
    expect((getByLabelText("Edycja portu serwera") as HTMLInputElement).readOnly).toBe(true);
    const nameInput = getByLabelText("Edycja nazwy serwera");
    fireEvent.change(nameInput, { target: { value: "Superior PvE" } });
    const limitInput = getByLabelText("Edycja limitu graczy");
    fireEvent.change(limitInput, { target: { value: "50" } });
    fireEvent.click(getByText("💾 Zapisz zmiany serwera"));

    await waitFor(() => {
      expect(getAllByText(/Superior PvE/i).length).toBeGreaterThanOrEqual(1);
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

    // Switch to the dedicated database tab (PostgreSQL on the VPS)
    fireEvent.click(getByText(/BAZA DANYCH \(PostgreSQL · /i));
    await waitFor(() => {
      expect(getByText(/Baza danych gry — PostgreSQL na VPS/i)).toBeTruthy();
      expect(getByText(/Status połączenia z bazą/i)).toBeTruthy();
      expect(getByText(/aktywne połączenia \/ limit bazy/i)).toBeTruthy();
    });

    // Switch to Server Logs tab and emit diagnostic probe
    fireEvent.click(getByText(/Logi Serwera, Sieci i Anti-Cheat/i));
    fireEvent.click(getByText("Sonda diagnostyczna"));
    await waitFor(() => {
      expect(getByText(/Ręczny test diagnostyczny administratora/i)).toBeTruthy();
    });
  });
});
