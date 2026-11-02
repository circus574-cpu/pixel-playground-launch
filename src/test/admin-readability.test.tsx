import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeSpawns, type SpawnPoint } from "@/game/admin/spawnSummary";
import { ItemHoverTooltip } from "@/components/admin/AdminCatalogInfo";
import { itemSourceGroups } from "@/game/admin/contentCatalog";
import { ITEM_CATALOG } from "@/game/items";
import { journalEntries, publicationEntry } from "../../scripts/build_publications.mjs";

afterEach(cleanup);

describe("admin spawn list", () => {
  it("summarizes spawn points per monster with counts, groups and ranges", () => {
    const points: SpawnPoint[] = [
      {
        id: "a",
        kind: "verdant-cierniowy-wilk",
        x: 1,
        y: 1,
        homeLeash: 300,
        respawnMs: 25000,
        groupId: "g1",
      },
      {
        id: "b",
        kind: "verdant-cierniowy-wilk",
        x: 2,
        y: 2,
        homeLeash: 450,
        respawnMs: 30000,
        groupId: "g1",
      },
      {
        id: "c",
        kind: "verdant-mchowy-szlamak",
        x: 3,
        y: 3,
        homeLeash: 300,
        respawnMs: 25000,
        groupId: "g2",
      },
    ];
    const summary = summarizeSpawns(points);
    expect(summary.map((s) => s.kind)).toEqual([
      "verdant-mchowy-szlamak",
      "verdant-cierniowy-wilk",
    ]);
    expect(summary[1]).toMatchObject({ count: 2, groups: 1, respawn: [25, 30], leash: [300, 450] });
  });
});

describe("admin item window", () => {
  it("opens a centred dialog with the item's sources on click and closes on Escape", () => {
    const item = ITEM_CATALOG.find((i) => i.category === "weapon")!;
    const { getByText, queryByRole, getByRole } = render(
      <ItemHoverTooltip id={item.id}>
        <span>pokaż</span>
      </ItemHoverTooltip>,
    );
    expect(queryByRole("dialog")).toBeNull();
    fireEvent.click(getByText("pokaż"));
    const dialog = getByRole("dialog");
    expect(dialog.textContent).toContain(item.name);
    expect(dialog.textContent).toContain("Skąd zdobyć");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();
  });

  it("structured sources list every random drop of an item", () => {
    const item = ITEM_CATALOG.find((i) => i.category === "weapon")!;
    const groups = itemSourceGroups(item.id);
    expect(groups.drops.some((d) => d.random)).toBe(true);
    for (let i = 1; i < groups.drops.length; i++)
      expect(groups.drops[i - 1]!.chance).toBeGreaterThanOrEqual(groups.drops[i]!.chance);
  });
});

describe("publication log", () => {
  it("uses the PR title for merges and skips plain sync merges", () => {
    expect(
      publicationEntry(
        "16052fd06ef5617b001d3d693597007845822e94",
        "2026-11-02T11:03:13+01:00",
        'Merge PR #74: single real game server "Superior"',
        "Admin: jeden prawdziwy serwer gry „Superior”\n\nCo-Authored-By: x",
      ),
    ).toMatchObject({
      sha: "16052fd",
      pr: 74,
      title: "Admin: jeden prawdziwy serwer gry „Superior”",
    });
    expect(
      publicationEntry("abc1234", "d", "Merge remote-tracking branch 'origin/main'", ""),
    ).toBeNull();
    expect(publicationEntry("abc1234def", "d", "feat(admin): x", "")).toMatchObject({
      pr: null,
      title: "feat(admin): x",
    });
  });

  it("reads the newest daily journals newest first", () => {
    const days = journalEntries(process.cwd(), 2);
    expect(days).toHaveLength(2);
    expect(days[0]!.date > days[1]!.date).toBe(true);
    expect(days[0]!.items.length).toBeGreaterThan(0);
  });
});
