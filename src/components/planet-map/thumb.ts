import type { CSSProperties } from "react";
import atlasLo from "@/assets/planet-map/atlas-1920.webp";
import { MAP_H, MAP_W, type MapRegion } from "./mapData";

/** Small crop of the painted atlas centred on a region, for legends and details. */
export function thumbStyle(region: MapRegion, size = 48): CSSProperties {
  const side = Math.max(region.radius.x, region.radius.y) * 2 * 1.08;
  const k = size / side;
  return {
    backgroundImage: `url(${atlasLo})`,
    backgroundSize: `${MAP_W * k}px ${MAP_H * k}px`,
    backgroundPosition: `${-(region.center.x - side / 2) * k}px ${-(region.center.y - side / 2) * k}px`,
  };
}
