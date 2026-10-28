import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...p }: { children: ReactNode; to: string }) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
}));
vi.mock("../components/planet-map/mapData", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ATLAS_V2: true,
}));
vi.mock("../components/planet-map/preload", () => ({
  decodedImage: async () => ({}),
  loadWorldOverlay: async () => ({
    lands: { verdant: { upp: 1 } },
    roads: [],
    places: [],
    tiles: [
      { land: "verdant", m: [1, 0, 0, 1, 0, 0], crop: [0, 0, 2000, 1000], size: [2000, 1000] },
    ],
  }),
}));
import { PlanetMap } from "../components/planet-map/PlanetMap";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 1;
        this.pointerType = options.pointerType ?? "touch";
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(844);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tap = (node: Element, x = 195, y = 422) => {
  fireEvent.pointerDown(node, { pointerId: 1, pointerType: "touch", clientX: x, clientY: y });
  fireEvent.pointerUp(node, { pointerId: 1, pointerType: "touch", clientX: x, clientY: y });
};
it("does not expose teleport on the public or ordinary-player map", () => {
  render(<PlanetMap />);
  expect(screen.queryByRole("button", { name: "Teleportuj" })).toBeNull();
});
it("requires arming then a touch, and closes only on success", async () => {
  const onTeleport = vi.fn(
      async (_land: string, _x: number, _y: number, _signal?: AbortSignal) => true,
    ),
    onClose = vi.fn();
  render(<PlanetMap onTeleport={onTeleport} onClose={onClose} />);
  const map = screen.getByRole("group", {
    name: "Interaktywna mapa planety Superior",
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Teleportuj" })).toBeVisible());
  tap(map);
  expect(onTeleport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Teleportuj" }));
  tap(map);
  await waitFor(() => expect(onTeleport).toHaveBeenCalledTimes(1));
  expect(onTeleport.mock.calls[0]![0]).toBe("verdant");
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
it("dragging or pinching while armed never selects a teleport point", async () => {
  const onTeleport = vi.fn(
    async (_land: string, _x: number, _y: number, _signal?: AbortSignal) => true,
  );
  render(<PlanetMap onTeleport={onTeleport} />);
  fireEvent.click(screen.getByRole("button", { name: "Teleportuj" }));
  const map = screen.getByRole("group", {
    name: "Interaktywna mapa planety Superior",
  });
  fireEvent.pointerDown(map, { pointerId: 1, clientX: 100, clientY: 200 });
  fireEvent.pointerMove(map, { pointerId: 1, clientX: 150, clientY: 200 });
  fireEvent.pointerUp(map, { pointerId: 1, clientX: 150, clientY: 200 });
  fireEvent.pointerDown(map, { pointerId: 1, clientX: 100, clientY: 200 });
  fireEvent.pointerDown(map, { pointerId: 2, clientX: 200, clientY: 200 });
  fireEvent.pointerUp(map, { pointerId: 2, clientX: 200, clientY: 200 });
  fireEvent.pointerUp(map, { pointerId: 1, clientX: 100, clientY: 200 });
  await Promise.resolve();
  expect(onTeleport).not.toHaveBeenCalled();
});
it("keeps the map open on rejected locations and aborts a pending request on close", async () => {
  const onClose = vi.fn();
  const reject = vi.fn(async () => false);
  const { unmount } = render(<PlanetMap onTeleport={reject} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Teleportuj" }));
  tap(screen.getByRole("group", { name: "Interaktywna mapa planety Superior" }));
  await screen.findByText(/Miejsce niedostępne/);
  expect(onClose).not.toHaveBeenCalled();
  unmount();
  let signal: AbortSignal | undefined;
  const pending = vi.fn((_l: string, _x: number, _y: number, s?: AbortSignal) => {
    signal = s;
    return new Promise<boolean>(() => {});
  });
  const view = render(<PlanetMap onTeleport={pending} />);
  fireEvent.click(screen.getByRole("button", { name: "Teleportuj" }));
  tap(screen.getByRole("group", { name: "Interaktywna mapa planety Superior" }));
  await waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
  view.unmount();
  expect(signal!.aborted).toBe(true);
});
