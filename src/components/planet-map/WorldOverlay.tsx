/**
 * World v2 atlas overlay: the game's roads and places projected onto the planet
 * (scripts/worldgen/v2/build_v2_atlas_overlay.py). Everything is shown for now; each road and
 * place keeps its world id so a fog of war can hide undiscovered ones later.
 */
import { useEffect, useMemo, useState } from "react";
import type { OverlayLands, OverlayTile } from "./worldToAtlas";

type Road = { id: string; land: string; kind: string; width: number; points: [number, number][] };
type Place = { id: string; land: string; kind: string; name: string; x: number; y: number };
type Tile = OverlayTile;
type Overlay = { lands?: OverlayLands; roads: Road[]; places: Place[]; tiles: Tile[] };

const GLYPH: Record<string, string> = {
  capital: "♛",
  town: "⌂",
  village: "•",
  famous: "✦",
  shrine: "⛩",
  watchtower: "♜",
  port: "⚓",
  cave: "◓",
  maze: "▦",
  "hidden-cache": "?",
  wilderness: "▲",
  camp: "⚔",
};
/** Zoom from which a kind of place gets its name (capitals always). */
const NAME_ZOOM: Record<string, number> = { capital: 0, town: 2.5, famous: 3, village: 6, camp: 5 };

type Box = [number, number, number, number];
const meets = (a: Box, b: Box) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
function tileBox(t: Tile): Box {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = t.m;
  const [x0 = 0, y0 = 0, w = 0, h = 0] = t.crop;
  const xs: number[] = [],
    ys: number[] = [];
  for (const [x, y] of [
    [x0, y0],
    [x0 + w, y0],
    [x0, y0 + h],
    [x0 + w, y0 + h],
  ] as const) {
    xs.push(a * x + c * y + e);
    ys.push(b * x + d * y + f);
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function lineBox(points: [number, number][]): Box {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * `bounds` is the visible atlas rectangle: only what meets it is drawn, so panning a zoomed map
 * on a phone does not repaint 1,900 land tiles and 1,700 roads (owner: the 2D view dropped to ~0 fps).
 */
export function WorldOverlay({
  zoom,
  px,
  bounds,
}: {
  zoom: number;
  px: (screen: number) => number;
  bounds: Box;
}) {
  const [data, setData] = useState<Overlay | null>(null);
  useEffect(() => {
    let live = true;
    void import("./worldOverlay.v2.json").then(
      (m) => live && setData(m.default as unknown as Overlay),
    );
    return () => {
      live = false;
    };
  }, []);
  const boxes = useMemo(
    () =>
      data && {
        tiles: data.tiles.map(tileBox),
        roads: data.roads.map((r) => lineBox(r.points)),
      },
    [data],
  );
  if (!data || !boxes) return null;
  const detail = zoom >= 4;
  return (
    <g className="pm-world" aria-hidden>
      {zoom >= 3 &&
        data.tiles.map((t, i) =>
          !meets(boxes.tiles[i]!, bounds) ? null : (
            <g
              key={"t" + i}
              transform={`matrix(${t.m.join(" ")})`}
              opacity={Math.min(1, (zoom - 3) / 2)}
            >
              <svg
                x={t.crop[0]}
                y={t.crop[1]}
                width={t.crop[2]! + 0.6}
                height={t.crop[3]! + 0.6}
                viewBox={`${t.crop[0]} ${t.crop[1]} ${t.crop[2]! + 0.6} ${t.crop[3]! + 0.6}`}
                overflow="hidden"
              >
                <image
                  href={`/game/worlds/superior-v2/${t.land}/map-hi.webp`}
                  width={t.size[0]}
                  height={t.size[1]}
                  preserveAspectRatio="none"
                />
              </svg>
            </g>
          ),
        )}
      {data.roads.map((r, i) =>
        (detail || r.width >= 180) && meets(boxes.roads[i]!, bounds) ? (
          <polyline
            key={i}
            className={"pm-world-road pm-world-" + r.kind}
            points={r.points.map((p) => p.join(",")).join(" ")}
            strokeWidth={px(Math.max(1.2, Math.min(5, (r.width / 160) * zoom * 0.35)))}
          />
        ) : null,
      )}
      {data.places.map((p) => {
        const big = p.kind === "capital" || p.kind === "town" || p.kind === "famous";
        if (!big && zoom < 3) return null;
        if (p.x < bounds[0] || p.x > bounds[2] || p.y < bounds[1] || p.y > bounds[3]) return null;
        const r = px(p.kind === "capital" ? 7 : big ? 5 : 3.5);
        const named = zoom >= (NAME_ZOOM[p.kind] ?? 9) && p.name;
        return (
          <g key={p.land + p.id} className={"pm-world-place pm-world-" + p.kind}>
            <circle cx={p.x} cy={p.y} r={r} />
            <text className="pm-world-glyph" x={p.x} y={p.y + r * 0.45} fontSize={r * 1.3}>
              {GLYPH[p.kind] ?? "•"}
            </text>
            {named && (
              <text
                className="pm-world-name"
                x={p.x}
                y={p.y + r + px(12)}
                fontSize={px(11)}
                strokeWidth={px(3)}
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
