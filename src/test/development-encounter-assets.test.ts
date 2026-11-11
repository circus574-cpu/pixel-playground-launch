import { it, expect } from "vitest";
import { reconcileEncounterAssets } from "../game/development/encounterAssets";
it("leases each temporary species once, preserves other streams and releases only retired encounters", () => {
  const owners = new Set(["spawn:unchanged", "chunk:1", "encounter:old"]),
    requests: string[] = [],
    released: string[] = [];
  const acquire = (kind: string, owner: string) => {
      requests.push(kind);
      owners.add(owner);
    },
    release = (owner: string) => {
      released.push(owner);
      owners.delete(owner);
    };
  reconcileEncounterAssets(["heavy", "heavy", "ranged"], owners, acquire, release);
  expect(requests).toEqual(["heavy", "ranged"]);
  expect(released).toEqual(["encounter:old"]);
  expect(owners.has("spawn:unchanged")).toBe(true);
  reconcileEncounterAssets(["heavy", "ranged"], owners.values(), acquire, release);
  expect(requests).toHaveLength(2);
  reconcileEncounterAssets([], owners, acquire, release);
  expect([...owners]).toEqual(["spawn:unchanged", "chunk:1"]);
});
