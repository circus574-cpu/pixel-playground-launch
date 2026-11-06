import { describe, expect, it, vi } from "vitest";

vi.mock("../game/assets/catalog", () => {
  const known = [
    "object.ki-v2-objects.nexus-bush-0",
    "object.ki-v2-objects.nexus-fern-1",
    "object.ki-v2-objects.nexus-flowerbush-2",
    "object.ki-v2-objects.nexus-mushrooms-3",
    "object.ki-v2-objects.nexus-reeds-0",
    "object.ki-v2-objects.nexus-grass-1",
    "object.ki-v2-objects.nexus-oak-3",
    "object.ki-v2-objects.nexus-pine-1",
    "object.ki-v2-objects.nexus-rocks-3",
    "object.ki-v2-objects.nexus-stump-2",
    "object.ki-v2-landmarks.nexus-reactor",
    "object.ki-v2-buildings.nexus-hall",
    "object.island-1.flora",
  ];
  return {
    catalog: { renderBindings: Object.fromEntries(known.map((k) => [k, { asset: "a" }])) },
    textureId: (b: string) => b,
  };
});
import { floraCandidates } from "../game/world/generated/floraBake";

describe("baked flora selection", () => {
  it("keeps ground cover and rejects anything that must stay a scene object", () => {
    const cover = floraCandidates([
      "object.ki-v2-objects.nexus-bush-0",
      "object.ki-v2-objects.nexus-fern-1",
      "object.ki-v2-objects.nexus-flowerbush-2",
      "object.ki-v2-objects.nexus-mushrooms-3",
      "object.ki-v2-objects.nexus-reeds-0",
      "object.ki-v2-objects.nexus-grass-1",
      "object.island-1.flora",
    ]);
    expect(cover.sort()).toEqual(
      [
        "object.island-1.flora",
        "object.ki-v2-objects.nexus-bush-0",
        "object.ki-v2-objects.nexus-fern-1",
        "object.ki-v2-objects.nexus-flowerbush-2",
        "object.ki-v2-objects.nexus-grass-1",
        "object.ki-v2-objects.nexus-mushrooms-3",
        "object.ki-v2-objects.nexus-reeds-0",
      ].sort(),
    );
  });
  it("drops trees, rocks, stumps, structures and unknown bindings", () => {
    expect(
      floraCandidates([
        "object.ki-v2-objects.nexus-oak-3",
        "object.ki-v2-objects.nexus-pine-1",
        "object.ki-v2-objects.nexus-rocks-3",
        "object.ki-v2-objects.nexus-stump-2",
        "object.ki-v2-landmarks.nexus-reactor",
        "object.ki-v2-buildings.nexus-hall",
        "object.nieistnieje.bush",
      ]),
    ).toEqual([]);
  });
  it("is idempotent for repeated bindings", () => {
    const twice = floraCandidates([
      "object.ki-v2-objects.nexus-fern-1",
      "object.ki-v2-objects.nexus-fern-1",
    ]);
    expect(twice).toEqual(["object.ki-v2-objects.nexus-fern-1"]);
  });
});
