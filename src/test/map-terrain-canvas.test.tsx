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
  const clip = vi.fn();
  const context = {
    drawImage,
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip,
  };
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
  // The painted land map is clipped to the land's outline: no rectangular ocean margin on the atlas.
  expect(clip).toHaveBeenCalledTimes(1);
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

// The generator fits each cell with an affine from three exact corners and guesses the fourth; neighbours then disagree
// about their shared edge. The mesh places every grid corner once, from the cells that know it exactly.
import { buildMesh, drawCell } from "../components/planet-map/terrainMesh";
const warp = (x: number, y: number) => ({ x: 100 * x + 12 * x * y, y: 90 * y + 9 * x * x });
function warpedTile(x0: number, y0: number) {
  const tl = warp(x0, y0),
    tr = warp(x0 + 1, y0),
    bl = warp(x0, y0 + 1);
  const a = tr.x - tl.x,
    b = tr.y - tl.y,
    c = bl.x - tl.x,
    d = bl.y - tl.y;
  return {
    land: "verdant",
    crop: [x0, y0, 1, 1],
    m: [a, b, c, d, tl.x - a * x0 - c * y0, tl.y - b * x0 - d * y0],
    size: [2, 2],
  };
}
it("shares grid corners between neighbouring cells and takes the guessed corner from the neighbour", () => {
  const tiles = [warpedTile(0, 0), warpedTile(1, 0), warpedTile(0, 1), warpedTile(1, 1)];
  const mesh = buildMesh(tiles);
  const [a, b, c] = [mesh.get(tiles[0]!)!, mesh.get(tiles[1]!)!, mesh.get(tiles[2]!)!];
  expect(a.q[1]).toEqual(b.q[0]); // right edge of a = left edge of b
  expect(a.q[3]).toEqual(b.q[2]);
  expect(a.q[2]).toEqual(c.q[0]); // bottom edge of a = top edge of c
  expect(a.q[3].x).toBeCloseTo(warp(1, 1).x, 6); // exact, not the parallelogram guess
  expect(a.q[3].y).toBeCloseTo(warp(1, 1).y, 6);
  const guess = { x: a.q[1].x + a.q[2].x - a.q[0].x, y: a.q[1].y + a.q[2].y - a.q[0].y };
  expect(Math.hypot(a.q[3].x - guess.x, a.q[3].y - guess.y)).toBeGreaterThan(5);
});
it("keeps a cell across the atlas seam next to its neighbour instead of a map width away", () => {
  const at = (x: number) => ({
    land: "verdant",
    crop: [x, 0, 1, 1],
    m: [1, 0, 0, 1, x < 1 ? 1999 : -1, 0], // the second cell wrapped to the left edge of the atlas
    size: [2, 1],
  });
  const tiles = [at(0), at(1)];
  const mesh = buildMesh(tiles);
  const first = mesh.get(tiles[0]!)!;
  expect(Math.abs(first.q[1].x - first.q[0].x)).toBeLessThan(1000);
});
it("draws a distorted cell as clipped triangles that cover it without a gap", () => {
  const tiles = [warpedTile(0, 0), warpedTile(1, 0), warpedTile(0, 1), warpedTile(1, 1)];
  const mesh = buildMesh(tiles);
  const drawImage = vi.fn();
  const clip = vi.fn();
  const ctx = {
    drawImage,
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip,
  } as unknown as CanvasRenderingContext2D;
  drawCell(ctx, {} as CanvasImageSource, mesh.get(tiles[0]!)!, 4, -50, -50);
  // Two triangles per sub-cell, each clipped; the cheap rectangle path would be a single draw without a clip.
  expect(drawImage.mock.calls.length).toBeGreaterThanOrEqual(8);
  expect(clip).toHaveBeenCalledTimes(drawImage.mock.calls.length);
  // A cell that is a parallelogram keeps the single rectangle.
  drawImage.mockClear();
  clip.mockClear();
  const flat = buildMesh([
    { land: "x", crop: [0, 0, 10, 10], m: [1, 0, 0, 1, 0, 0], size: [10, 10] },
  ]);
  drawCell(ctx, {} as CanvasImageSource, [...flat.values()][0]!, 4, 0, 0);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(clip).not.toHaveBeenCalled();
});
