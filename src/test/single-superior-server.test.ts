import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVER_NODE_CONFIGS,
  SUPERIOR_NODE_ID,
  SUPERIOR_PORT,
  createServerNode,
  normalizeServerNodes,
} from "../game/admin/adminTelemetry";

describe("single Superior game server", () => {
  it("ships only the real Superior server", () => {
    expect(DEFAULT_SERVER_NODE_CONFIGS).toHaveLength(1);
    expect(DEFAULT_SERVER_NODE_CONFIGS[0]).toMatchObject({
      nodeId: SUPERIOR_NODE_ID,
      name: "Superior",
      host: "85.235.150.189",
      port: 7420,
      maxPlayers: 50,
    });
  });

  it("drops invented nodes from an old stored list and keeps the owner's Superior settings", () => {
    const stored = [
      { nodeId: "eu-central-1", name: "Węzeł Główny", port: 7420, maxPlayers: 250 },
      { nodeId: "eu-west-1", name: "Węzeł Zapasowy EU-West #1 (Amsterdam)", maxPlayers: 200 },
      { nodeId: "us-east-1", name: "Węzeł Międzykontynentalny US-East #1", maxPlayers: 150 },
      { nodeId: "superior", name: "Superior", port: 7500, host: "1.2.3.4", maxPlayers: 50 },
    ];
    const nodes = normalizeServerNodes(stored);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      nodeId: SUPERIOR_NODE_ID,
      name: "Superior",
      maxPlayers: 50,
      port: SUPERIOR_PORT,
      host: "85.235.150.189",
    });
  });

  it("keeps a renamed Superior but replaces the old generated EU-Central name", () => {
    expect(normalizeServerNodes([{ nodeId: "eu-central-1", name: "Superior PvE" }])[0]!.name).toBe(
      "Superior PvE",
    );
    expect(
      normalizeServerNodes([
        { nodeId: "eu-central-1", name: "Węzeł Główny EU-Central #1 (Frankfurt)" },
      ])[0]!.name,
    ).toBe("Superior");
  });

  it("falls back to the default Superior for garbage and empty input", () => {
    expect(normalizeServerNodes("x")).toEqual(DEFAULT_SERVER_NODE_CONFIGS);
    expect(normalizeServerNodes([])).toEqual(DEFAULT_SERVER_NODE_CONFIGS);
  });

  it("refuses to create additional nodes", () => {
    expect(() =>
      createServerNode({
        nodeId: "eu-west-1",
        name: "x",
        region: "x",
        host: "10.0.0.1",
        port: 7420,
        maxPlayers: 10,
        status: "online",
      }),
    ).toThrow(/jeden serwer/);
  });
});
