/**
 * World v2 map (preview switch ?ki-world-v2=1): only maps, no tables. "2D" shows the painted map
 * of a land (same terrain as the game) with towns, famous places and the player; "3D" a globe
 * painted from the planet's real land labels (45% land). Reads no game session code.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./planet-map.css";
import * as THREE from "three";
import index from "../../../public/game/worlds/superior-v2/index.json";
import planet from "../../../public/game/worlds/superior-v2/planet.json";
import { v2Places } from "@/game/worlds/v2Places";

const BASE = "/game/worlds/superior-v2";
const LANDS = ["verdant", "aether", "nexus", "pyra"] as const;
const NAMES: Record<string, string> = Object.fromEntries(index.features.map((f) => [f.id, f.name]));

export function V2WorldMap({
  continent,
  player,
  onClose,
}: {
  continent: string | null;
  player?: { x: number; y: number };
  onClose?: () => void;
}) {
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [land, setLand] = useState<string>(continent ?? "verdant");
  const page = (
    <div className="v2wm" role="dialog" aria-label="Mapa świata">
      <div className="v2wm-bar">
        <div className="v2wm-tabs" role="tablist">
          <button role="tab" aria-selected={view === "2d"} onClick={() => setView("2d")}>
            Mapa 2D
          </button>
          <button role="tab" aria-selected={view === "3d"} onClick={() => setView("3d")}>
            Globus 3D
          </button>
        </div>
        {onClose && (
          <button className="v2wm-close" onClick={onClose} aria-label="Zamknij mapę">
            ×
          </button>
        )}
      </div>
      {view === "2d" ? (
        <LandMap
          land={land}
          player={land === continent ? player : undefined}
          onLand={setLand}
          here={continent}
        />
      ) : (
        <Globe
          here={continent}
          onPick={(id) => {
            if ((LANDS as readonly string[]).includes(id)) {
              setLand(id);
              setView("2d");
            }
          }}
        />
      )}
    </div>
  );
  return typeof document === "undefined" ? page : createPortal(page, document.body);
}

function LandMap({
  land,
  player,
  onLand,
  here,
}: {
  land: string;
  player?: { x: number; y: number } | undefined;
  onLand: (id: string) => void;
  here: string | null;
}) {
  const feature = index.features.find((f) => f.id === land)!;
  const places = v2Places(land);
  const pct = (x: number, y: number) => ({
    left: (100 * x) / feature.width + "%",
    top: (100 * y) / feature.height + "%",
  });
  return (
    <div className="v2wm-land">
      <div className="v2wm-frame" style={{ aspectRatio: `${feature.width} / ${feature.height}` }}>
        <img src={`${BASE}/${land}/map.webp`} alt={"Mapa: " + feature.name} />
        {Object.values(places?.cities ?? {}).map((c) => (
          <span key={c.settlement} className="v2map-pin v2map-town" style={pct(c.x, c.y)}>
            <i aria-hidden />
            <b>{c.name}</b>
          </span>
        ))}
        {(places?.famous ?? []).map((f) => (
          <span
            key={f.label}
            className="v2map-pin v2map-famous"
            style={pct(f.x, f.y)}
            title={f.label}
            tabIndex={0}
          >
            <i aria-hidden />
            <b className="v2map-tip">{f.label}</b>
          </span>
        ))}
        {player && (
          <span className="v2wm-player" style={pct(player.x, player.y)} aria-label="Tu jesteś" />
        )}
      </div>
      <div className="v2wm-lands">
        {LANDS.map((id) => (
          <button key={id} aria-pressed={id === land} onClick={() => onLand(id)}>
            {NAMES[id]}
            {id === here ? " ·  tu jesteś" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function toVector(lon: number, lat: number, r = 1) {
  const phi = (lat * Math.PI) / 180,
    theta = (lon * Math.PI) / 180;
  // SphereGeometry: u = (lon + 180) / 360 → x = cos(lat)·cos(lon), z = −cos(lat)·sin(lon).
  return new THREE.Vector3(
    r * Math.cos(phi) * Math.cos(theta),
    r * Math.sin(phi),
    -r * Math.cos(phi) * Math.sin(theta),
  );
}

function Globe({ here, onPick }: { here: string | null; onPick: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 3.6);
    const globe = new THREE.Group();
    scene.add(globe);
    const texture = new THREE.TextureLoader().load(`${BASE}/planet-2048.webp`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      new THREE.TextureLoader().load(`${BASE}/planet-4096.webp`, (hi) => {
        hi.colorSpace = THREE.SRGBColorSpace;
        material.map = hi;
        material.needsUpdate = true;
      });
    });
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material));
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 48),
      new THREE.MeshBasicMaterial({
        color: 0x5fb4ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      }),
    );
    scene.add(glow);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-3, 2, 4);
    scene.add(sun);
    const start = here && (planet.centres as Record<string, { lon: number; lat: number }>)[here];
    let yaw = start ? (-start.lon * Math.PI) / 180 - Math.PI / 2 : 0,
      pitch = start ? (start.lat * Math.PI) / 180 / 2 : 0.3,
      drag: { x: number; y: number } | null = null,
      raf = 0;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const down = (e: PointerEvent) => (drag = { x: e.clientX, y: e.clientY });
    const move = (e: PointerEvent) => {
      if (!drag) return;
      yaw += (e.clientX - drag.x) * 0.006;
      pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => (drag = null);
    const wheel = (e: WheelEvent) => {
      camera.position.z = Math.max(2, Math.min(6, camera.position.z + e.deltaY * 0.002));
    };
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: true });
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const tick = () => {
      if (!drag) yaw += 0.0007;
      globe.rotation.set(pitch, yaw, 0, "YXZ");
      renderer.render(scene, camera);
      const rect = el.getBoundingClientRect();
      for (const [id, c] of Object.entries(planet.centres)) {
        const label = labels.current[id];
        if (!label) continue;
        const p = toVector(c.lon, c.lat, 1.02).applyEuler(globe.rotation);
        const facing = p.clone().normalize().dot(camera.position.clone().normalize()) > 0.15;
        const s = p.project(camera);
        label.style.opacity = facing ? "1" : "0";
        label.style.pointerEvents = facing ? "auto" : "none";
        label.style.transform = `translate(${((s.x + 1) / 2) * rect.width}px, ${((1 - s.y) / 2) * rect.height}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderer.dispose();
      material.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [here]);
  return (
    <div className="v2wm-globe" ref={host}>
      {Object.keys(planet.centres).map((id) => (
        <button
          key={id}
          ref={(b) => {
            labels.current[id] = b;
          }}
          className={"v2wm-globe-label" + (id === here ? " is-here" : "")}
          onClick={() => onPick(id)}
        >
          {NAMES[id] ?? id}
        </button>
      ))}
      <p className="v2wm-note">Ląd: {planet.landPercent}% planety · przeciągnij, aby obrócić</p>
    </div>
  );
}
