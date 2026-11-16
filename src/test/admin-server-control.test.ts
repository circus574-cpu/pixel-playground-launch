import { afterAll, describe, expect, it } from "vitest";
import { GameServer } from "@/server/gameServer";
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

describe("Admin panel restart of the game server", () => {
  afterAll(async () => {
    await stopServerFromAdmin();
    delete process.env["GAME_SERVER_PORT"];
  });

  it("stops and starts the server again inside the same process (a new start time, still running)", async () => {
    process.env["GAME_SERVER_PORT"] = "7437";
    const first = await startServerFromAdmin();
    expect(first.ok).toBe(true);
    const before = getServerStatusFromAdmin().startedAt;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(GameServer.restartHandler).toBeTypeOf("function");
    await GameServer.restartHandler?.();
    const after = getServerStatusFromAdmin();
    expect(after.running).toBe(true);
    expect(after.startedAt).not.toBe(before);
  });
});
