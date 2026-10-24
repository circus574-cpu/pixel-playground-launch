import { memo, useMemo } from "react";
import { FOREST_RIVER } from "../../game/world/forest";
import type { BuildingId } from "../../game/city/types";
import type { WorldDefinition } from "../../game/world/types";

/** Local, schematic map of the place the player is in: roads, buildings with names and one dot. */
const SERVICE_LABEL: Record<BuildingId, string> = {
  hall: "Sala",
  shop: "Sklep",
  smithy: "Kuźnia",
  depot: "Depozyt",
  inn: "Gospoda",
  arena: "Arena",
};
const SERVICE_COLOR: Record<BuildingId, string> = {
  hall: "#d8b4ff",
  shop: "#ffd27a",
  smithy: "#ff9d6e",
  depot: "#9fd3ff",
  inn: "#a6f0b0",
  arena: "#ff8f9c",
};
const GROUND: Record<string, string> = {
  verdant: "#31592f",
  aether: "#3d5a52",
  nexus: "#27384a",
  pyra: "#4a3331",
};
const ROAD = "#d9c9a0";
/** Visible window outside the city, in world units (the city itself is shown whole). */
const OUTSIDE_WIDTH = 4800;
const ASPECT = 1.6;

function StaticLayer({ world }: { world: WorldDefinition }) {
  const t = world.terrain;
  const city = world.city;
  const hazards = world.id === "verdant" ? FOREST_RIVER : world.obstacles.slice(world.border ?? 3);
  return (
    <g>
      {(t?.zones ?? []).map((z) => (
        <polygon
          key={z.id}
          points={z.points.map((p) => p.join(",")).join(" ")}
          fill="#ffffff"
          opacity={0.07}
        />
      ))}
      {hazards.map((h, i) => (
        <rect
          key={i}
          x={h.x}
          y={h.y}
          width={h.width}
          height={h.height}
          fill={world.id === "pyra" ? "#a8402a" : "#3b86a8"}
          opacity={0.85}
        />
      ))}
      {[...(t?.paths ?? []), ...(t?.plazas ?? []), ...(city?.roads ?? [])].map((r, i) => (
        <rect key={"r" + i} x={r.x} y={r.y} width={r.width} height={r.height} fill={ROAD} />
      ))}
      {(t?.roads ?? []).map((r, i) => (
        <polyline
          key={"p" + i}
          points={r.points.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={ROAD}
          strokeWidth={Math.max(60, r.width * 0.8)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {city?.bounds && (
        <rect
          x={city.bounds.x}
          y={city.bounds.y}
          width={city.bounds.width}
          height={city.bounds.height}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.45}
          strokeWidth={22}
          strokeDasharray="120 90"
        />
      )}
      {city?.buildings.map((b) => (
        <g key={b.id}>
          <rect
            x={b.door.x - 150}
            y={b.door.y - 330}
            width={300}
            height={260}
            rx={30}
            fill={SERVICE_COLOR[b.id]}
            stroke="#1a1410"
            strokeWidth={26}
          />
          <rect x={b.door.x - 30} y={b.door.y - 90} width={60} height={50} fill="#1a1410" />
          <text
            x={b.door.x}
            y={b.door.y + 150}
            textAnchor="middle"
            fontSize={190}
            fontWeight={700}
            fill="#fff"
            stroke="#10151a"
            strokeWidth={34}
            paintOrder="stroke"
          >
            {SERVICE_LABEL[b.id]}
          </text>
        </g>
      ))}
    </g>
  );
}
const Static = memo(StaticLayer);

export function LocalMinimap({
  world,
  at,
  inside,
}: {
  world: WorldDefinition;
  at: { x: number; y: number };
  /** Standing in a building: the dot sits at its door. */
  inside: boolean;
}) {
  const view = useMemo(() => {
    const b = world.city?.bounds;
    const inCity =
      !!b && at.x >= b.x && at.x <= b.x + b.width && at.y >= b.y && at.y <= b.y + b.height;
    if (b && inCity) {
      const pad = 160;
      return { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad };
    }
    const w = OUTSIDE_WIDTH,
      h = w / ASPECT;
    return {
      x: Math.max(0, Math.min(world.width - w, at.x - w / 2)),
      y: Math.max(0, Math.min(world.height - h, at.y - h / 2)),
      w,
      h,
    };
  }, [world, at.x, at.y]);
  return (
    <svg
      className="ki-local-map"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={"Mapa okolicy: " + (world.city?.name ?? world.settlement)}
    >
      <rect
        x={view.x - 10}
        y={view.y - 10}
        width={view.w + 20}
        height={view.h + 20}
        fill={GROUND[world.id] ?? "#2c3a2c"}
      />
      <Static world={world} />
      <g data-testid="ki-map-you" className={inside ? "ki-map-inside" : undefined}>
        <circle
          cx={at.x}
          cy={at.y}
          r={170}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.55}
          strokeWidth={26}
        />
        <circle cx={at.x} cy={at.y} r={95} fill="#ff4d3d" stroke="#ffffff" strokeWidth={34} />
      </g>
    </svg>
  );
}
