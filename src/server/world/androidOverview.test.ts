import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "vitest";
import type { AndroidAtlasIndex, AndroidAtlasRegion } from "@/game/world/androidOverviewTypes";
import { androidAtlasQa } from "../../../e2e/fixtures/androidAtlas";
import { androidOverviewHttp, loadAndroidOverview } from "./androidOverview";

test("Superior serves the verified Android snapshot only to administrators", async () => {
  const path = process.env["KI_ANDROID_OVERVIEW_QA_SNAPSHOT"];
  let reads = 0;
  const server = createServer((request, response) =>
    androidOverviewHttp(
      request,
      response,
      async (token) => (token === "admin" ? "owner" : null),
      async () => {
        reads += 1;
        return path ? loadAndroidOverview(path) : androidAtlasQa;
      },
    ),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ws/world/android-superior`;
  const authorized = { Authorization: "Bearer admin" };
  try {
    for (const headers of [
      {},
      { Authorization: "Bearer gm" },
      { Authorization: "Bearer player" },
    ]) {
      const declined = await fetch(base + "?land=pyra", { headers });
      expect(declined.status).toBe(403);
      expect(await declined.json()).toEqual({ error: "FORBIDDEN" });
    }
    expect((await fetch(base, { method: "POST", headers: authorized })).status).toBe(405);
    expect(reads).toBe(0);
    expect((await fetch(base + "?land=__proto__", { headers: authorized })).status).toBe(404);
    const response = await fetch(base, { headers: authorized });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const index = (await response.json()) as AndroidAtlasIndex;
    expect(index.packHashes["core-c101"]).toMatch(/^[a-f0-9]{64}$/);
    expect(index.version).toBe(path ? "1.14.38" : androidAtlasQa.index.version);
    if (path) {
      expect(index.pendingBosses).toHaveLength(10);
      expect(index.bosses).toHaveLength(8);
      expect(index.regions.filter((r) => r.kind === "continent")).toHaveLength(4);
      expect(index.regions.filter((r) => r.kind === "island")).toHaveLength(6);
    }
    const regions = await Promise.all(
      index.regions.map(async ({ id }) => {
        const land = await fetch(base + "?land=" + id, { headers: authorized });
        expect(land.ok).toBe(true);
        return (await land.json()) as AndroidAtlasRegion;
      }),
    );
    const allPoints = regions.flatMap((land) => land.points);
    if (path) {
      expect(allPoints.filter((point) => point.kind === "boss")).toHaveLength(8);
      expect(allPoints.filter((point) => point.kind === "spawn")).toHaveLength(818);
      expect(allPoints.filter((point) => point.kind === "event")).toHaveLength(14);
      expect(
        new Set(
          regions.flatMap((land) =>
            land.quests.filter((quest) => quest.active).map((quest) => quest.id),
          ),
        ).size,
      ).toBe(102);
      expect(
        regions.some((land) => land.quests.some((quest) => quest.sourceLand !== land.id)),
      ).toBe(true);
      expect(
        allPoints
          .filter((point) => point.kind === "boss")
          .map((point) => point.id)
          .sort(),
      ).toEqual(index.bosses.map((point) => point.id).sort());
    } else {
      expect(allPoints).toContainEqual(androidAtlasQa.regions["pyra"]!.points[0]);
    }
    for (const land of regions) {
      const ids = new Set(land.points.map((point) => point.id));
      expect(ids.size).toBe(land.points.length);
      for (const quest of land.quests) {
        expect(
          [...quest.giverPoints, ...quest.objectives.flatMap((o) => o.refs)].every((id) =>
            ids.has(id),
          ),
        ).toBe(true);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
