import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameSession, SaveStore } from "../game/session";
import { grants, markStaff, staffMark, STAFF_KEY } from "../game/account/staff";
import { StaffTools } from "../components/game/StaffTools";
import { AdminWorldMap } from "../components/admin/AdminWorldMap";
import { readAdminWorldOverrides } from "../game/world/adminWorldStore";
import projection from "../components/planet-map/worldOverlay.v2.json";

afterEach(cleanup);

const outdoors = (game: GameSession) => {
  // The default session stands in a safe city; the staff rules are tested out in the open.
  Object.defineProperty(game, "safe", { get: () => false });
  return game;
};
const hurt = (game: GameSession, amount: number) =>
  (game as unknown as { damagePlayer(n: number): void }).damagePlayer(amount);

describe("special staff characters", () => {
  it("ignores staff commands for an ordinary character", () => {
    const game = outdoors(new GameSession(new SaveStore(null), "planetary"));
    const before = { x: game.player.x, gold: game.player.gold, level: game.player.level };
    game.command({ type: "staff", action: "teleport", x: before.x + 500, y: game.player.y });
    game.command({ type: "staff", action: "gold" });
    game.command({ type: "staff", action: "level" });
    game.command({ type: "staff", action: "god" });
    expect([game.player.x, game.player.gold, game.player.level, game.god]).toEqual([
      before.x,
      before.gold,
      before.level,
      false,
    ]);
  });

  it("teleports, heals, levels and protects a staff character", () => {
    const game = outdoors(new GameSession(new SaveStore(null), "sage"));
    game.staff = "gm";
    const to = { x: game.player.x + 300, y: game.player.y };
    game.command({ type: "staff", action: "teleport", ...to });
    expect(Math.hypot(game.player.x - to.x, game.player.y - to.y)).toBeLessThan(200);
    hurt(game, 30);
    expect(game.player.hp).toBeLessThan(game.kit.stats.maxHp);
    game.command({ type: "staff", action: "heal" });
    expect(game.player.hp).toBe(game.kit.stats.maxHp);
    game.command({ type: "staff", action: "god" });
    hurt(game, 10_000);
    expect([game.player.hp, game.player.dead]).toEqual([game.kit.stats.maxHp, false]);
    const level = game.player.level;
    game.command({ type: "staff", action: "level" });
    expect([game.player.level, game.player.xp]).toEqual([level + 1, 0]);
    game.command({ type: "staff", action: "potions" });
    expect(game.player.items.potion).toBeLessThanOrEqual(99);
    expect(game.snapshot().staff).toBe("gm");
  });

  it("a game master may not use an administrator character; an administrator may use both", () => {
    expect(grants(["gm"], "gm")).toBe("gm");
    expect(grants(["gm"], "admin")).toBeNull();
    expect(grants(["admin"], "gm")).toBe("gm");
    expect(grants(["admin"], "admin")).toBe("admin");
    expect(grants([], "gm")).toBeNull();
    expect(grants(["admin"], null)).toBeNull();
  });

  it("marks a special character in the synced game storage", () => {
    const map = new Map<string, string>();
    const storage = {
      length: 0,
      key: () => null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    markStaff(storage, "a", "gm");
    markStaff(storage, "b", "admin");
    expect([staffMark(storage, "a"), staffMark(storage, "b"), staffMark(storage, "c")]).toEqual([
      "gm",
      "admin",
      null,
    ]);
    expect(STAFF_KEY.startsWith("ki-legends:")).toBe(true);
  });

  it("shows the tools only to a staff character and sends their commands", () => {
    const game = new GameSession(new SaveStore(null), "android");
    const sent: unknown[] = [];
    const props = {
      send: (c: unknown) => void sent.push(c),
      continents: [
        { id: "verdant", name: "Verdantia" },
        { id: "nexus", name: "Nexus-9" },
      ],
      current: "nexus",
      onTravel: (id: string) => void sent.push({ travel: id }),
    };
    const { container, rerender, getByText } = render(
      <StaffTools state={game.snapshot()} {...props} />,
    );
    expect(container.textContent).toBe("");
    game.staff = "admin";
    rerender(<StaffTools state={game.snapshot()} {...props} />);
    fireEvent.click(getByText("ADM"));
    fireEvent.click(getByText("Lecz"));
    fireEvent.click(getByText("Verdantia"));
    expect(sent).toEqual([{ type: "staff", action: "heal" }, { travel: "verdant" }]);
  });

  it("allows selecting a place marker on AdminWorldMap when only the places layer is enabled", () => {
    const OrigPointerEvent = globalThis.PointerEvent;
    globalThis.PointerEvent = class extends MouseEvent {
      pointerId: number;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 1;
      }
    } as unknown as typeof PointerEvent;
    try {
      const place = projection.places[0]!;
      const { getByLabelText, getAllByRole } = render(
        <AdminWorldMap overrides={readAdminWorldOverrides()} />,
      );
      fireEvent.click(getByLabelText("Spawny potworów"));
      fireEvent.click(getByLabelText("Zadania"));
      const mapSvg = getByLabelText("Pełna mapa 2D Superior z warstwami");
      Object.defineProperty(mapSvg, "getScreenCTM", {
        value: () => ({
          a: 1,
          b: 0,
          inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        }),
      });
      fireEvent.pointerDown(mapSvg, { button: 0, clientX: place.x, clientY: place.y });
      fireEvent.pointerUp(mapSvg, { button: 0, clientX: place.x, clientY: place.y });
      const statuses = getAllByRole("status").map((el) => el.textContent ?? "");
      expect(statuses.some((t) => t.includes(place.land))).toBe(true);
    } finally {
      globalThis.PointerEvent = OrigPointerEvent;
    }
  });
});
