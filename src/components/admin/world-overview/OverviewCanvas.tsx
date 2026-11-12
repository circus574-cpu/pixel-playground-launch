import { useEffect, useMemo, useRef, useState } from "react";
import atlas from "@/assets/planet-map/atlas-v2-3840.webp";
import projection from "@/components/planet-map/worldOverlay.v2.json";
import { worldToAtlas } from "@/components/planet-map/worldToAtlas";
import { cityRoom } from "@/game/city/room";
import type { BuildingId } from "@/game/city/types";
import { LAYERS, type Entry, type LandData, type Layer, type Scope, type Point } from "./model";
import type { Obstacle } from "@/game/movement";
import { OVERVIEW_BASE } from "./loader";
export type Camera = { x: number; y: number; zoom: number };
const DEFAULT_CAMERA: Camera = { x: 0.5, y: 0.5, zoom: 1 };
type Plotted = { entry: Entry; point: Point };
export function OverviewCanvas({
  scope,
  land,
  entries,
  anchors,
  layers,
  selected,
  camera,
  onCamera,
  onPick,
  onBounds,
  onMetrics,
}: {
  scope: Scope;
  land: LandData | undefined;
  entries: Entry[];
  anchors: Entry[];
  layers: Record<Layer, boolean>;
  selected: Entry | null;
  camera: Camera;
  onCamera: (c: Camera) => void;
  onPick: (e: Entry) => void;
  onBounds: (b: Obstacle) => void;
  onMetrics: (n: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    pointers = useRef(new Map<number, Point>());
  const [size, setSize] = useState({ width: 900, height: 620 }),
    [image, setImage] = useState<HTMLImageElement | null>(null),
    [imageError, setImageError] = useState(false);
  const drag = useRef<{ point: Point; camera: Camera; moved: boolean; distance?: number } | null>(
    null,
  );
  const room = useMemo(
    () =>
      scope.room && land
        ? cityRoom(scope.room.split(":").at(-1) as BuildingId, land.info.affinity)
        : null,
    [scope.room, land],
  );
  const dimensions =
    room ??
    (land ? { width: land.info.width, height: land.info.height } : { width: 2000, height: 1000 });
  const fit = Math.min(size.width / dimensions.width, size.height / dimensions.height),
    scale = fit * camera.zoom;
  const left = camera.x * dimensions.width - size.width / scale / 2,
    top = camera.y * dimensions.height - size.height / scale / 2;
  const current = useRef({ camera, dimensions, scale, left, top, onCamera });
  current.current = { camera, dimensions, scale, left, top, onCamera };
  const plotted = useRef<Plotted[]>([]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const observer = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (r) setSize({ width: Math.max(1, r.width), height: Math.max(1, r.height) });
    });
    observer.observe(c);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setImage(null);
    setImageError(false);
    const img = new Image();
    let active = true;
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setImageError(true);
    };
    img.src =
      room && land
        ? `/game/interiors/${land.info.affinity}-${scope.room!.split(":").at(-1)}.webp`
        : land
          ? `${OVERVIEW_BASE}/${land.info.id}/map-hi.webp`
          : atlas;
    return () => {
      active = false;
    };
  }, [scope.land, scope.room, land, room]);
  useEffect(() => {
    onBounds({ x: left, y: top, width: size.width / scale, height: size.height / scale });
  }, [left, top, size.width, size.height, scale, onBounds]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const a = current.current,
        r = c.getBoundingClientRect(),
        px = event.clientX - r.left,
        py = event.clientY - r.top;
      const z = Math.min(160, Math.max(1, a.camera.zoom * Math.exp(-event.deltaY * 0.0015))),
        s = (a.scale * z) / a.camera.zoom;
      const wx = a.left + px / a.scale,
        wy = a.top + py / a.scale;
      a.onCamera({
        zoom: z,
        x: (wx + (r.width / 2 - px) / s) / a.dimensions.width,
        y: (wy + (r.height / 2 - py) / s) / a.dimensions.height,
      });
    };
    c.addEventListener("wheel", wheel, { passive: false });
    return () => c.removeEventListener("wheel", wheel);
  }, []);
  const mapped = useMemo(() => {
    const doors = new Map(
      anchors
        .filter((e) => e.layer === "buildings" && !e.room)
        .map((e) => [e.land + ":" + e.town + ":" + e.building, e]),
    );
    return entries.flatMap((entry) => {
      if (scope.room) return entry.room === scope.room ? [{ entry, point: entry }] : [];
      const at = entry.room
        ? doors.get(entry.land + ":" + entry.town + ":" + entry.building)
        : entry;
      if (!at) return [];
      const point = scope.land === "planet" ? worldToAtlas(projection, entry.land, at.x, at.y) : at;
      return point ? [{ entry, point }] : [];
    });
  }, [entries, anchors, scope]);
  const planetRoads = useMemo(
    () =>
      scope.land === "planet"
        ? entries
            .filter((e) => e.layer === "roads" && e.points)
            .map((e) =>
              e.points!.flatMap((p) => {
                const at = worldToAtlas(projection, e.land, p[0], p[1]);
                return at ? [at] : [];
              }),
            )
        : [],
    [entries, scope.land],
  );
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size.width * ratio);
    c.height = Math.round(size.height * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#07151d";
    ctx.fillRect(0, 0, size.width, size.height);
    const screen = (p: Point) => ({ x: (p.x - left) * scale, y: (p.y - top) * scale });
    const origin = screen({ x: 0, y: 0 });
    if (image)
      ctx.drawImage(image, origin.x, origin.y, dimensions.width * scale, dimensions.height * scale);
    const inside = (p: Point) =>
      p.x >= -20 && p.x <= size.width + 20 && p.y >= -20 && p.y <= size.height + 20;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#b8d8d510";
    const step = Math.pow(10, Math.floor(Math.log10(160 / scale)));
    for (let x = Math.ceil(left / step) * step; x < left + size.width / scale; x += step) {
      const p = screen({ x, y: 0 });
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, size.height);
      ctx.stroke();
    }
    for (let y = Math.ceil(top / step) * step; y < top + size.height / scale; y += step) {
      const p = screen({ x: 0, y });
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(size.width, p.y);
      ctx.stroke();
    }
    if (scope.land !== "planet" && layers.collision) {
      ctx.fillStyle = "#ff4e8d30";
      ctx.strokeStyle = "#ff4e8d88";
      for (const r of room?.obstacles ?? land?.collision ?? []) {
        const p = screen(r);
        if (
          p.x + r.width * scale < 0 ||
          p.y + r.height * scale < 0 ||
          p.x > size.width ||
          p.y > size.height
        )
          continue;
        ctx.fillRect(p.x, p.y, r.width * scale, r.height * scale);
        ctx.strokeRect(p.x, p.y, r.width * scale, r.height * scale);
      }
    }
    plotted.current = [];
    for (const { entry: e, point: at } of mapped) {
      if (!layers[e.layer]) continue;
      if (e.points) {
        if (scope.land === "planet" || scope.room) continue;
        ctx.beginPath();
        for (const [i, p] of e.points.entries()) {
          const a = screen({ x: p[0]!, y: p[1]! });
          if (i === 0) ctx.moveTo(a.x, a.y);
          else ctx.lineTo(a.x, a.y);
        }
        ctx.strokeStyle = e.kind === "trail" ? "#e5c99b88" : "#efcb8ab0";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        continue;
      }
      const p = screen(at);
      if (!inside(p)) continue;
      if (e.bounds && e.layer === "towns" && scope.land !== "planet") {
        const b = screen(e.bounds);
        ctx.fillStyle = "#71d99b15";
        ctx.strokeStyle = "#71d99b80";
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, e.bounds.width * scale, e.bounds.height * scale);
        ctx.fillRect(b.x, b.y, e.bounds.width * scale, e.bounds.height * scale);
      }
      const active = selected?.id === e.id;
      ctx.fillStyle = LAYERS[e.layer].color;
      ctx.globalAlpha = e.status === "runtime" ? 0.9 : 0.52;
      const r = active
        ? 6
        : e.layer === "spawns" || e.layer === "resources" || e.layer === "scenery"
          ? scope.land === "planet" && camera.zoom < 3
            ? 1
            : 2.5
          : scope.land === "planet" && camera.zoom < 3
            ? 2.5
            : 4;
      ctx.beginPath();
      if (e.layer === "spawns") {
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x, p.y + r);
        ctx.lineTo(p.x - r, p.y);
        ctx.closePath();
      } else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (e.layer !== "roads") plotted.current.push({ entry: e, point: p });
      if (active) {
        ctx.strokeStyle = "#fff4c1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        if (e.radius && scope.land !== "planet") {
          ctx.fillStyle = LAYERS[e.layer].color + "20";
          ctx.beginPath();
          ctx.arc(p.x, p.y, e.radius * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = LAYERS[e.layer].color;
          ctx.stroke();
        }
      }
      if ((e.layer === "towns" || active) && camera.zoom > 1.3) {
        ctx.font = "600 12px system-ui";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#07151d";
        ctx.strokeText(e.name, p.x + 10, p.y - 8);
        ctx.fillStyle = "#fff1d5";
        ctx.fillText(e.name, p.x + 10, p.y - 8);
      }
    }
    if (scope.land === "planet" && layers.roads) {
      ctx.strokeStyle = "#d4b99075";
      ctx.lineWidth = 0.8;
      for (const r of planetRoads) {
        ctx.beginPath();
        r.forEach((p, i) => {
          const at = screen(p);
          if (i && Math.abs(p.x - r[i - 1]!.x) < 1000) ctx.lineTo(at.x, at.y);
          else ctx.moveTo(at.x, at.y);
        });
        ctx.stroke();
      }
    }
    if (scope.land === "planet") {
      for (const e of anchors.filter((e) => e.sourceId === "arrival")) {
        const p = worldToAtlas(projection, e.land, e.x, e.y);
        if (!p) continue;
        const at = screen(p);
        if (!inside(at)) continue;
        const info = e.details as { name: string };
        ctx.font = e.land.startsWith("island-") ? "600 11px system-ui" : "600 19px Georgia";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#091820";
        ctx.strokeText(info.name, at.x, at.y - 16);
        ctx.fillStyle = "#ffe7ab";
        ctx.fillText(info.name, at.x, at.y - 16);
        ctx.textAlign = "start";
      }
    }
    onMetrics(plotted.current.length);
  }, [
    size,
    image,
    mapped,
    planetRoads,
    anchors,
    layers,
    selected,
    scope,
    land,
    camera,
    left,
    top,
    scale,
    dimensions.width,
    dimensions.height,
    room,
    onMetrics,
  ]);
  const release = (id: number) => {
    pointers.current.delete(id);
    if (ref.current?.hasPointerCapture(id)) ref.current.releasePointerCapture(id);
    if (!pointers.current.size) drag.current = null;
    else if (pointers.current.size === 1)
      drag.current = {
        point: [...pointers.current.values()][0]!,
        camera: current.current.camera,
        moved: true,
      };
  };
  return (
    <div className="ki-overview-canvas-wrap">
      <canvas
        ref={ref}
        tabIndex={0}
        aria-label="Interaktywna mapa świata Superior"
        data-testid="world-overview-canvas"
        data-background-loaded={image ? "1" : "0"}
        data-scope={scope.room ?? scope.land}
        data-road-count={
          scope.land === "planet"
            ? planetRoads.length
            : entries.filter((e) => e.layer === "roads").length
        }
        data-zoom={camera.zoom}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 1)
            drag.current = { point: { x: e.clientX, y: e.clientY }, camera, moved: false };
          else if (drag.current) {
            drag.current.moved = true;
            const [a, b] = [...pointers.current.values()];
            drag.current.distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId) || !drag.current) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size > 1) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
            if (drag.current.distance)
              onCamera({
                ...camera,
                zoom: Math.min(160, Math.max(1, (camera.zoom * d) / drag.current.distance)),
              });
            drag.current.distance = d;
            return;
          }
          const dx = e.clientX - drag.current.point.x,
            dy = e.clientY - drag.current.point.y;
          if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
          onCamera({
            ...camera,
            x: drag.current.camera.x - dx / scale / dimensions.width,
            y: drag.current.camera.y - dy / scale / dimensions.height,
          });
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const r = e.currentTarget.getBoundingClientRect(),
              p = { x: e.clientX - r.left, y: e.clientY - r.top };
            const near = plotted.current
              .map((m) => ({ ...m, d: Math.hypot(m.point.x - p.x, m.point.y - p.y) }))
              .filter((m) => m.d < 12)
              .sort((a, b) => a.d - b.d);
            if (near[0]) onPick(near[0].entry);
          }
          release(e.pointerId);
        }}
        onPointerCancel={(e) => release(e.pointerId)}
        onLostPointerCapture={(e) => release(e.pointerId)}
        onKeyDown={(e) => {
          if (
            ["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            if (e.key === "0") onCamera(DEFAULT_CAMERA);
            else if (["+", "=", "-"].includes(e.key))
              onCamera({
                ...camera,
                zoom: Math.min(160, Math.max(1, camera.zoom * (e.key === "-" ? 1 / 1.5 : 1.5))),
              });
            else
              onCamera({
                ...camera,
                x:
                  camera.x +
                  (e.key === "ArrowLeft" ? -0.15 : e.key === "ArrowRight" ? 0.15 : 0) / camera.zoom,
                y:
                  camera.y +
                  (e.key === "ArrowUp" ? -0.15 : e.key === "ArrowDown" ? 0.15 : 0) / camera.zoom,
              });
          }
        }}
      />
      {imageError && (
        <p className="ki-overview-map-warning" role="alert">
          Nie udało się wczytać podkładu mapy. Znaczniki i współrzędne pozostają dostępne.
        </p>
      )}
      <span className="ki-overview-compass" aria-hidden="true">
        N<br />↑
      </span>
      <span className="ki-overview-map-caption">
        SUPERIOR · V2 · {Math.round(camera.zoom * 100)}%
      </span>
    </div>
  );
}
