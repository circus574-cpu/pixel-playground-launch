import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { decodedImage } = vi.hoisted(() => ({ decodedImage: vi.fn() }));
vi.mock("../components/planet-map/preload", () => ({
  decodedImage,
  loadWorldOverlay: async () => ({
    roads: [],
    places: [],
    tiles: Array.from({ length: 50 }, (_, i) => ({
      land: "verdant",
      crop: [i, 0, 1, 1],
      m: [1, 0, 0, 1, 0, 0],
      size: [100, 100],
    })),
  }),
}));
import { WorldOverlay } from "../components/planet-map/WorldOverlay";
afterEach(() => vi.restoreAllMocks());
it("draws visible source tiles on one bounded canvas without SVG image nodes", async () => {
  const drawImage = vi.fn();
  const context = { drawImage, setTransform: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  decodedImage.mockResolvedValue({});
  const { container } = render(
    <svg>
      <WorldOverlay zoom={6} px={(p) => p / 2} bounds={[0, 0, 100, 50]} />
    </svg>,
  );
  await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(50));
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(container.querySelectorAll("image")).toHaveLength(0);
  const canvas = container.querySelector("canvas")!;
  expect(canvas.width).toBeLessThanOrEqual(300);
  expect(canvas.height).toBeLessThanOrEqual(150);
  expect(decodedImage).toHaveBeenCalledTimes(1);
});
it("keeps the base map usable if detailed terrain cannot be loaded", async () => {
  decodedImage.mockRejectedValue(Error("offline"));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const { container } = render(
    <svg>
      <WorldOverlay zoom={6} px={(p) => p} bounds={[0, 0, 100, 50]} />
    </svg>,
  );
  await waitFor(() => expect(container.querySelector("canvas")).toBeInTheDocument());
  expect(drawImage).not.toHaveBeenCalled();
});
