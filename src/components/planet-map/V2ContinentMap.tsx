/**
 * World v2 preview (?ki-world-v2=1): painted 2D map of a continent, drawn from the same runtime
 * terrain as the game (scripts/worldgen/v2/render_v2_maps.py), with Argon's towns and famous places.
 */
import { useState } from "react";
import index from "../../../public/game/worlds/superior-v2/index.json";
import { v2Places } from "@/game/worlds/v2Places";

const WORLD_V2_MAP =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("ki-world-v2") === "1";

export function V2ContinentMap({ regionId, name }: { regionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const feature = index.features.find((f) => f.id === regionId);
  if (!WORLD_V2_MAP || !feature) return null;
  const places = v2Places(regionId);
  const pins = [
    ...Object.values(places?.cities ?? {}).map((c) => ({ ...c, kind: "town" })),
    ...(places?.famous ?? []).map((f) => ({ name: f.label, x: f.x, y: f.y, kind: "famous" })),
  ];
  return (
    <>
      <button className="pm-enter-world" onClick={() => setOpen(true)}>
        Mapa lądu (świat v2) — {name}
      </button>
      {open && (
        <div className="v2map" role="dialog" aria-label={"Mapa lądu " + name}>
          <button className="v2map-close" onClick={() => setOpen(false)} aria-label="Zamknij">
            ×
          </button>
          <div
            className="v2map-frame"
            style={{ aspectRatio: `${feature.width} / ${feature.height}` }}
          >
            <img src={`/game/worlds/superior-v2/${regionId}/map.webp`} alt={"Mapa " + name} />
            {pins.map((p) => (
              <span
                key={p.kind + p.name}
                className={"v2map-pin v2map-" + p.kind}
                title={p.name}
                tabIndex={p.kind === "famous" ? 0 : undefined}
                style={{
                  left: (100 * p.x) / feature.width + "%",
                  top: (100 * p.y) / feature.height + "%",
                }}
              >
                <i aria-hidden />
                {p.kind === "town" ? <b>{p.name}</b> : <b className="v2map-tip">{p.name}</b>}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
