import { afterAll, describe, expect, it } from "vitest";
import {
  getServerStatusFromAdmin,
  startServerFromAdmin,
  stopServerFromAdmin,
} from "@/server/managedServer";

describe("Admin panel zero-terminal server control", () => {
  afterAll(async () => {
    await stopServerFromAdmin();
  });

  it("checks initial server status before starting", () => {
    const status = getServerStatusFromAdmin();
    expect(status).toBeDefined();
    expect(typeof status.running).toBe("boolean");
  });

  it("starts the game server physical instance from admin panel without terminal", async () => {
    const res = await startServerFromAdmin({
      port: 7435,
      nodeId: "admin-ui-test-node",
      name: "Serwer z Panelu Admina",
      maxPlayers: 100,
      tickRateHz: 20,
    });

    expect(res.ok).toBe(true);
    expect(res.status.running).toBe(true);
    expect(res.status.nodeId).toBe("admin-ui-test-node");

    // Re-check status function
    const currentStatus = getServerStatusFromAdmin();
    expect(currentStatus.running).toBe(true);
  });

  it("safely stops the game server physical instance from admin panel without terminal", async () => {
    const res = await stopServerFromAdmin();
    expect(res.ok).toBe(true);
    expect(res.status.running).toBe(false);

    const currentStatus = getServerStatusFromAdmin();
    expect(currentStatus.running).toBe(false);
  });
});
