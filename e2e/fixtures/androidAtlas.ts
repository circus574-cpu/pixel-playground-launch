import type { AndroidAtlasSnapshot } from "../../src/game/world/androidOverviewTypes";

export const androidAtlasQa: AndroidAtlasSnapshot = {
  index: {
    version: "0.0-qa",
    createdAt: "2026-11-28T00:00:00Z",
    packHashes: { "core-c101": "0".repeat(64), "world-regions": "0".repeat(64) },
    width: 2000,
    height: 1000,
    image: "/game/admin/android-superior/planet.webp",
    bosses: [{ id: "boss:qa-example", land: "pyra", title: "Boss QA", position: [520, 610] }],
    regions: [
      {
        id: "pyra",
        name: "Pyra",
        kind: "continent",
        outline: [
          [400, 500],
          [600, 500],
          [600, 650],
          [400, 650],
        ],
        label: { x: 500, y: 540 },
        islandPin: null,
      },
      {
        id: "island-1",
        name: "Wyspa QA",
        kind: "island",
        outline: [],
        label: { x: 700, y: 620 },
        islandPin: [700, 620],
      },
    ],
    pendingBosses: ["Model QA"],
  },
  regions: {
    pyra: {
      id: "pyra",
      size: 4096,
      image: "/game/admin/android-superior/pyra.webp",
      procedural: false,
      roads: [],
      unmapped: [],
      points: [
        {
          id: "boss:qa-example",
          kind: "boss",
          title: "Boss QA",
          position: [650.17, 1800.44],
          detail: "Testowe dane atlasu",
          level: 20,
        },
        {
          id: "npc:qa-example",
          kind: "npc",
          title: "NPC QA",
          position: [1000, 1500],
          detail: "",
        },
      ],
      quests: [
        {
          id: "Q-QA1",
          title: "Zadanie QA",
          level: 1,
          giver: "NPC QA",
          sourceLand: "pyra",
          active: true,
          summary: "Sprawdź punkt bossa QA.",
          giverPoints: ["npc:qa-example"],
          objectives: [{ id: "O-QA1", title: "Znajdź bossa QA", refs: ["boss:qa-example"] }],
        },
      ],
    },
    "island-1": {
      id: "island-1",
      size: 512,
      image: "/game/admin/android-superior/island-1.webp",
      procedural: true,
      roads: [],
      unmapped: [],
      quests: [],
      points: [],
    },
  },
};
