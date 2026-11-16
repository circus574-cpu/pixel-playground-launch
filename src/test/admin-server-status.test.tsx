import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeStatus } from "@/game/account/runtimeAdmin";

const read = vi.fn<() => Promise<RuntimeStatus>>();
vi.mock("@/game/account/runtimeAdmin", () => ({
  readRuntimeStatus: () => read(),
}));

import { AdminServerStatus } from "@/components/admin/AdminServerStatus";
import { formatUptime } from "@/components/admin/formatUptime";

const status = (over: Partial<RuntimeStatus> = {}): RuntimeStatus => ({
  collectedAt: "2026-11-16T12:00:00.000Z",
  players: [],
  server: {
    name: "Superior",
    nodeId: "eu-central-1",
    region: "eu-central (Aruba VPS)",
    port: 7420,
    tickRateHz: 20,
    maxPlayers: 50,
    activePlayers: 2,
    tickP50Ms: 1.5,
    tickP95Ms: 3.1,
    packetsInSec: 12,
    packetsOutSec: 30,
    accountsReady: true,
    charactersReady: true,
    androidReady: true,
    uptimeSeconds: 3700,
    androidOnline: 4,
    androidByLand: { pyra: 3, verdant: 1 },
  },
  process: {
    pid: 1,
    nodeVersion: "v22.1.0",
    uptimeSeconds: 3700,
    rssMb: 210.5,
    heapUsedMb: 80.1,
    loadAvg1m: 0.4,
    cpuCount: 2,
    loadPercent: 20,
    memoryLimitMb: null,
    hostMemoryMb: 4096,
  },
  database: {
    connected: true,
    latencyMs: 4,
    error: null,
    version: "PostgreSQL 16.4",
    sizeMb: 52.3,
    connections: 6,
    maxConnections: 100,
    counts: [
      { label: "Konta", value: 12, error: null },
      { label: "Wpisy dziennika audytu", value: null, error: "permission denied for table audit" },
    ],
  },
  android: {
    activeVersion: "2026.11.17.2",
    minClientCode: 1,
    maintenance: false,
    releases: 2,
    saves: 5,
    lastWriteAt: null,
  },
  ...over,
});

afterEach(() => {
  cleanup();
  read.mockReset();
});

describe("admin server tab", () => {
  it("formats uptime", () => {
    expect(formatUptime(45)).toBe("45 s");
    expect(formatUptime(125)).toBe("2 min 5 s");
    expect(formatUptime(3700)).toBe("1 h 1 min");
    expect(formatUptime(190000)).toBe("2 d 4 h 46 min");
  });

  it("shows only measured values and Android players per land", async () => {
    read.mockResolvedValue(status());
    render(<AdminServerStatus />);
    await waitFor(() => expect(screen.getByText(/Serwer gry „Superior”/)).toBeTruthy());
    expect(screen.getByText("PostgreSQL 16.4")).toBeTruthy();
    expect(screen.getByText("połączona")).toBeTruthy();
    expect(screen.getByText(/Pyra: 3, Verdantia: 1/)).toBeTruthy();
    expect(screen.getByText("2026.11.17.2")).toBeTruthy();
    // nothing that used to be simulated
    expect(screen.queryByText(/Symulacja/i)).toBeNull();
    expect(screen.queryByText(/Uruchom Serwer/i)).toBeNull();
    expect(screen.queryByText(/Restartuj/i)).toBeNull();
  });

  it("shows a table that cannot be counted as missing with its reason, not as zero, and the database as connected", async () => {
    read.mockResolvedValue(status());
    render(<AdminServerStatus />);
    await waitFor(() => expect(screen.getByText("połączona")).toBeTruthy());
    expect(
      screen.getByText(/nie udało się odczytać: permission denied for table audit/),
    ).toBeTruthy();
    expect(screen.queryByText("brak połączenia")).toBeNull();
  });

  it("shows the reason when the database really is not connected", async () => {
    read.mockResolvedValue(
      status({
        database: {
          connected: false,
          latencyMs: null,
          error: "connect ECONNREFUSED 127.0.0.1:5432",
          version: null,
          sizeMb: null,
          connections: null,
          maxConnections: null,
          counts: [],
        },
      }),
    );
    render(<AdminServerStatus />);
    await waitFor(() => expect(screen.getByText("brak połączenia")).toBeTruthy());
    expect(screen.getByText(/ECONNREFUSED/)).toBeTruthy();
    expect(screen.getAllByText("brak danych").length).toBeGreaterThan(0);
  });

  it("says plainly when the server cannot be read, instead of showing invented values", async () => {
    read.mockRejectedValue(new Error("Serwer gry nie odpowiada."));
    render(<AdminServerStatus />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Serwer gry nie odpowiada."),
    );
    expect(screen.queryByText(/Serwer gry „/)).toBeNull();
    expect(screen.queryByText(/CPU/)).toBeNull();
  });
});
