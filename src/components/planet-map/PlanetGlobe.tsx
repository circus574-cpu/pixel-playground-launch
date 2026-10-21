/**
 * Interactive WebGL globe of planet Superior for /mapa.
 *
 * Loaded lazily (React.lazy) on the client only. The sphere is textured with
 * the same painted atlas as the 2D map, so region picking reuses the traced
 * outlines through UV → atlas coordinates. Isolated from the game: it reads no
 * saves or sessions and writes nothing to storage.
 */
import { Link } from "@tanstack/react-router";
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { ArrowLeft, Layers, Map as MapIcon, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Button } from "@/components/ui/button";
import colorHiUrl from "@/assets/planet-map/globe-color-3840.webp";
import colorLoUrl from "@/assets/planet-map/globe-color-1920.webp";
import cloudsUrl from "@/assets/planet-map/globe-clouds-2048.webp";
import lightsUrl from "@/assets/planet-map/globe-lights-2048.webp";
import surfaceUrl from "@/assets/planet-map/globe-surface-2048.webp";
import spaceUrl from "@/assets/planet-map/space.jpg";
import { CONTINENTS, QUEST_ISLANDS, REGIONS, type MapRegion, type Point } from "./mapData";
import {
  cameraFor,
  clampDistance,
  globeFov,
  globeQuality,
  horizonFade,
  mapToSphere,
  markerPoint,
  maxDistance,
  regionAt,
  startCamera,
  uvToMap,
  zoomPercent,
  type GlobeQuality,
  type Vec3,
} from "./globeMath";
import { thumbStyle } from "./thumb";
import { prefersReducedMotion } from "./webgl";
import "./planet-map.css";
import "./globe.css";

/** Sun direction in view space: upper-left, in front — terminator on the right limb. */
const SUN_VIEW = new THREE.Vector3(-0.62, 0.4, 0.68).normalize();
/** Resume the slow idle spin after this long without interaction (ms). */
const IDLE_SPIN_MS = 20_000;

type GlobeApi = {
  flyTo: (target: Vec3, seconds?: number) => void;
  zoomBy: (factor: number) => void;
  rotateBy: (azimuth: number, polar: number) => void;
  reset: () => void;
};

type Flight = { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number };

const noRaycast = () => null;

function configure(tex: THREE.Texture, gl: THREE.WebGLRenderer, srgb: boolean) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Camera rig: orbit controls, flights, idle spin, sun, HUD read-outs  */
/* ------------------------------------------------------------------ */

function Rig({
  apiRef,
  reduced,
  allowSpin,
  zoomRef,
  bgRef,
}: {
  apiRef: MutableRefObject<GlobeApi | null>;
  reduced: boolean;
  allowSpin: boolean;
  zoomRef: MutableRefObject<HTMLOutputElement | null>;
  bgRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const sun = useRef<THREE.DirectionalLight>(null);
  const controls = useRef<OrbitControls | null>(null);
  const flight = useRef<Flight | null>(null);
  const lastInput = useRef(reduced ? Number.POSITIVE_INFINITY : -IDLE_SPIN_MS);
  const readout = useRef("");
  const aspect = size.width / Math.max(1, size.height);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  // Created in an effect (not useMemo) so StrictMode never leaks listeners.
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.085;
    c.zoomSpeed = 0.75;
    c.minPolarAngle = 0.22;
    c.maxPolarAngle = Math.PI - 0.22;
    c.autoRotateSpeed = 0.32;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    const onStart = () => {
      flight.current = null;
      lastInput.current = performance.now();
    };
    const onChange = () => invalidate();
    c.addEventListener("start", onStart);
    c.addEventListener("change", onChange);
    controls.current = c;
    invalidate();
    return () => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("change", onChange);
      c.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate]);

  // Field of view and zoom limits follow the viewport shape.
  useEffect(() => {
    camera.fov = globeFov(aspect);
    camera.updateProjectionMatrix();
    const c = controls.current;
    if (c) {
      c.minDistance = clampDistance(0, aspect);
      c.maxDistance = maxDistance(aspect);
    }
    const len = camera.position.length();
    if (len > maxDistance(aspect)) camera.position.setLength(maxDistance(aspect));
    invalidate();
  }, [aspect, camera, invalidate]);

  useEffect(() => {
    camera.position.set(...startCamera(aspectRef.current));
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    const fly = (to: THREE.Vector3, seconds: number) => {
      lastInput.current = performance.now();
      if (reduced || seconds <= 0) {
        camera.position.copy(to);
        camera.lookAt(0, 0, 0);
        flight.current = null;
      } else {
        flight.current = { from: camera.position.clone(), to, t: 0, dur: seconds };
      }
      invalidate();
    };
    apiRef.current = {
      flyTo: (target, seconds = 1.15) => fly(new THREE.Vector3(...target), seconds),
      zoomBy: (factor) => {
        const a = aspectRef.current;
        const len = clampDistance(camera.position.length() / factor, a);
        fly(camera.position.clone().setLength(len), 0.45);
      },
      rotateBy: (azimuth, polar) => {
        const s = new THREE.Spherical().setFromVector3(camera.position);
        s.theta += azimuth;
        s.phi = Math.min(Math.PI - 0.22, Math.max(0.22, s.phi + polar));
        fly(new THREE.Vector3().setFromSpherical(s), 0.35);
      },
      reset: () => fly(new THREE.Vector3(...startCamera(aspectRef.current)), 1.1),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, invalidate, reduced]);

  const q = useMemo(() => new THREE.Quaternion(), []);
  const qFull = useMemo(() => new THREE.Quaternion(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const c = controls.current;
    const f = flight.current;
    let moving = false;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const t = f.t;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      a.copy(f.from).normalize();
      b.copy(f.to).normalize();
      qFull.setFromUnitVectors(a, b);
      q.identity().slerp(qFull, e);
      const len = Math.exp(
        Math.log(f.from.length()) + (Math.log(f.to.length()) - Math.log(f.from.length())) * e,
      );
      camera.position.copy(a.applyQuaternion(q).multiplyScalar(len));
      camera.lookAt(0, 0, 0);
      moving = true;
      if (t >= 1) flight.current = null;
      if (c) {
        // Sync the controls' spherical state without leftover damping.
        c.enableDamping = false;
        c.update();
        c.enableDamping = true;
      }
    } else if (c) {
      const len = camera.position.length();
      const span = maxDistance(aspectRef.current) - 1;
      c.rotateSpeed = 0.18 + 0.5 * Math.min(1, Math.max(0, (len - 1) / span));
      c.autoRotate = allowSpin && performance.now() - lastInput.current > IDLE_SPIN_MS;
      moving = c.update(dt) || c.autoRotate;
    }

    if (sun.current) {
      sun.current.position.copy(SUN_VIEW).applyQuaternion(camera.quaternion).multiplyScalar(10);
    }

    const len = camera.position.length();
    const text = `${zoomPercent(len, aspectRef.current)}%`;
    if (zoomRef.current && text !== readout.current) {
      readout.current = text;
      zoomRef.current.textContent = text;
    }
    if (bgRef.current) {
      spherical.setFromVector3(camera.position);
      const x = 50 + Math.sin(spherical.theta) * 6;
      const y = 50 + Math.cos(spherical.phi) * 6;
      bgRef.current.style.backgroundPosition = `${x.toFixed(2)}% ${y.toFixed(2)}%`;
    }
    if (moving) invalidate();
  });

  return (
    <>
      <ambientLight intensity={0.16} color="#9fb8d8" />
      <hemisphereLight args={["#bcd6ff", "#1a1206", 0.22]} />
      <directionalLight ref={sun} intensity={2.7} color="#fff1dc" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Planet, clouds and atmosphere                                       */
/* ------------------------------------------------------------------ */

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.4);
    float day = smoothstep(-0.35, 0.55, dot(vNormal, uSun));
    gl_FragColor = vec4(uColor * fres * mix(0.08, 0.62, day), 1.0);
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Back faces of a 1.13x shell: 1 at the planet limb, 0 at the outer edge.
    float d = clamp(-dot(vNormal, vView) / 0.47, 0.0, 1.0);
    float day = smoothstep(-0.6, 0.5, dot(vNormal, uSun));
    gl_FragColor = vec4(uColor * pow(d, 2.6) * mix(0.12, 0.85, day), 1.0);
  }
`;

function atmosphereMaterial(frag: string, side: THREE.Side) {
  return new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERT,
    fragmentShader: frag,
    uniforms: {
      uColor: { value: new THREE.Color("#7cc4ff") },
      uSun: { value: SUN_VIEW },
    },
    side,
    transparent: true,
    depthWrite: false,
    // Add light to colour only: the canvas alpha stays untouched, so the
    // starfield behind the transparent canvas keeps showing through the glow.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

function Planet({
  quality,
  reduced,
  onReady,
  onPick,
  onHover,
}: {
  quality: GlobeQuality;
  reduced: boolean;
  onReady: () => void;
  onPick: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [color, surface, lights, clouds] = useLoader(THREE.TextureLoader, [
    colorLoUrl,
    surfaceUrl,
    lightsUrl,
    cloudsUrl,
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];
  const cloudRef = useRef<THREE.Mesh>(null);
  const hoverId = useRef<string | null>(null);

  const material = useMemo(() => {
    configure(color, gl, true);
    configure(lights, gl, true);
    configure(surface, gl, false);
    const m = new THREE.MeshStandardMaterial({
      map: color,
      bumpMap: surface,
      bumpScale: 2.4,
      roughnessMap: surface,
      roughness: 1,
      metalness: 0,
      emissiveMap: lights,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 1.7,
    });
    // Lava and reactor glow dominate on the night side only.
    m.onBeforeCompile = (shader) => {
      shader.uniforms["uSunView"] = { value: SUN_VIEW };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uSunView;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float pgDay = dot(normal, uSunView);
          totalEmissiveRadiance *= mix(1.0, 0.22, smoothstep(-0.2, 0.35, pgDay));`,
        );
    };
    return m;
  }, [color, gl, lights, surface]);

  const cloudMaterial = useMemo(() => {
    configure(clouds, gl, false);
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      alphaMap: clouds,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
  }, [clouds, gl]);

  const rim = useMemo(() => atmosphereMaterial(RIM_FRAG, THREE.FrontSide), []);
  const halo = useMemo(() => atmosphereMaterial(HALO_FRAG, THREE.BackSide), []);

  useEffect(
    () => () => {
      material.dispose();
      cloudMaterial.dispose();
      rim.dispose();
      halo.dispose();
    },
    [material, cloudMaterial, rim, halo],
  );

  useEffect(() => {
    onReady();
    invalidate();
  }, [onReady, invalidate]);

  // Sharper colour for large screens once the first frame is up.
  useEffect(() => {
    if (!quality.hiResColor) return;
    let alive = true;
    let hi: THREE.Texture | null = null;
    new THREE.TextureLoader()
      .loadAsync(colorHiUrl)
      .then((tex) => {
        if (!alive) return tex.dispose();
        hi = configure(tex, gl, true);
        material.map = hi;
        invalidate();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      hi?.dispose();
    };
  }, [gl, invalidate, material, quality.hiResColor]);

  useFrame((_, dt) => {
    if (cloudRef.current && !reduced) cloudRef.current.rotation.y += Math.min(dt, 0.05) * 0.006;
  });

  const pointAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Point | null =>
    e.uv ? uvToMap(e.uv.x, e.uv.y) : null;

  const segs = quality.segments;
  return (
    <group>
      <mesh
        material={material}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          const p = pointAt(e);
          onPick(p ? (regionAt(p)?.id ?? null) : null);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const p = pointAt(e);
          const id = p ? (regionAt(p)?.id ?? null) : null;
          if (id !== hoverId.current) {
            hoverId.current = id;
            onHover(id);
          }
        }}
        onPointerOut={() => {
          hoverId.current = null;
          onHover(null);
        }}
      >
        <sphereGeometry args={[1, segs, segs / 2]} />
      </mesh>
      <mesh ref={cloudRef} material={cloudMaterial} raycast={noRaycast} renderOrder={1}>
        <sphereGeometry args={[1.011, segs, segs / 2]} />
      </mesh>
      <mesh material={rim} raycast={noRaycast} renderOrder={2}>
        <sphereGeometry args={[1.016, segs, segs / 2]} />
      </mesh>
      <mesh material={halo} raycast={noRaycast} scale={1.13}>
        <sphereGeometry args={[1, 64, 32]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Region outline (fat line hugging the sphere)                        */
/* ------------------------------------------------------------------ */

function RegionOutline({
  region,
  color,
  width,
  opacity,
}: {
  region: MapRegion;
  color: string;
  width: number;
  opacity: number;
}) {
  const size = useThree((s) => s.size);
  const line = useMemo(() => {
    const pts = region.outline;
    const out: number[] = [];
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i % pts.length];
      const q = pts[(i + 1) % pts.length];
      if (!p || !q) continue;
      const steps =
        i === pts.length ? 1 : Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push(...mapToSphere({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }, 1.014));
        if (i === pts.length) break;
      }
    }
    const geometry = new LineGeometry();
    geometry.setPositions(out);
    const mat = new LineMaterial({
      color,
      linewidth: width,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const l = new Line2(geometry, mat);
    l.renderOrder = 3;
    l.raycast = noRaycast;
    return l;
  }, [region, color, width, opacity]);

  useEffect(() => {
    (line.material as LineMaterial).resolution.set(size.width, size.height);
  }, [line, size.width, size.height]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineMaterial).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

/* ------------------------------------------------------------------ */
/* DOM markers projected from the sphere every rendered frame          */
/* ------------------------------------------------------------------ */

const MARKERS = REGIONS.map((r) => ({
  id: r.id,
  pos: mapToSphere(markerPoint(r), 1.02),
}));

function MarkerProjector({ els }: { els: MutableRefObject<Map<string, HTMLElement>> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  const shown = useRef(new Map<string, boolean>());
  useFrame(() => {
    camera.updateMatrixWorld();
    const cam: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    for (const m of MARKERS) {
      const el = els.current.get(m.id);
      if (!el) continue;
      const fade = horizonFade(m.pos, cam);
      v.set(...m.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.82 + 0.18 * fade).toFixed(3)})`;
      el.style.opacity = fade.toFixed(3);
      const visible = fade > 0.25;
      if (shown.current.get(m.id) !== visible) {
        shown.current.set(m.id, visible);
        el.tabIndex = visible ? 0 : -1;
        el.setAttribute("aria-hidden", visible ? "false" : "true");
        el.style.pointerEvents = visible ? "auto" : "none";
      }
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export type GlobeFailure = "context-lost";

const narrow = () => window.matchMedia("(max-width: 900px)").matches;
const aspect = () => window.innerWidth / Math.max(1, window.innerHeight);

export default function PlanetGlobe({
  onShowFlat,
  onFail,
}: {
  onShowFlat: () => void;
  onFail: (reason: GlobeFailure) => void;
}) {
  const [quality] = useState(() =>
    globeQuality({
      devicePixelRatio: window.devicePixelRatio,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      width: window.innerWidth,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      cores: navigator.hardwareConcurrency,
    }),
  );
  const [reduced] = useState(prefersReducedMotion);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [legend, setLegend] = useState<boolean | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth > 1600);
  const api = useRef<GlobeApi | null>(null);
  const zoomRef = useRef<HTMLOutputElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const markerEls = useRef(new Map<string, HTMLElement>());
  /** Unmounting disposes the renderer, which fires an expected context loss. */
  const leaving = useRef(false);
  const releaseRenderer = useRef<(() => void) | null>(null);
  useEffect(() => {
    leaving.current = false;
    return () => {
      leaving.current = true;
      releaseRenderer.current?.();
      releaseRenderer.current = null;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 1600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const selectedRegion = REGIONS.find((r) => r.id === selected) ?? null;
  const hoveredRegion =
    hovered && hovered !== selected ? REGIONS.find((r) => r.id === hovered) : null;
  const legendOpen = legend ?? wide;

  const focusRegion = useCallback((region: MapRegion) => {
    setSelected(region.id);
    if (narrow()) setLegend(false);
    api.current?.flyTo(cameraFor(region, aspect()));
  }, []);

  const onPick = useCallback(
    (id: string | null) => {
      const region = REGIONS.find((r) => r.id === id);
      if (region) focusRegion(region);
      else setSelected(null);
    },
    [focusRegion],
  );
  const onReady = useCallback(() => setReady(true), []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.28;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => api.current?.rotateBy(-step, 0),
      ArrowRight: () => api.current?.rotateBy(step, 0),
      ArrowUp: () => api.current?.rotateBy(0, -step),
      ArrowDown: () => api.current?.rotateBy(0, step),
      "+": () => api.current?.zoomBy(1.3),
      "=": () => api.current?.zoomBy(1.3),
      "-": () => api.current?.zoomBy(1 / 1.3),
      "0": () => api.current?.reset(),
      Escape: () => setSelected(null),
    };
    const action = keys[e.key];
    if (action && e.target === e.currentTarget) {
      e.preventDefault();
      action();
    }
  };

  return (
    <main
      className={`planet-map planet-globe${ready ? " is-ready" : ""}${legendOpen || selectedRegion ? " has-panel" : ""}`}
    >
      <div
        ref={bgRef}
        className="pg-space"
        style={{ backgroundImage: `url(${spaceUrl})` }}
        aria-hidden
      />
      <div
        className="pg-stage"
        role="group"
        aria-roledescription="globus 3D"
        aria-label="Interaktywny globus planety Superior"
        aria-describedby="pg-help"
        tabIndex={0}
        onKeyDown={onKey}
      >
        <Canvas
          className="pg-canvas"
          frameloop="demand"
          dpr={[1, quality.maxDpr]}
          gl={{ antialias: quality.antialias, alpha: true, powerPreference: "high-performance" }}
          camera={{ fov: 38, near: 0.05, far: 60, position: [0, 0, 4] }}
          onCreated={({ gl, scene, camera }) => {
            // Dev-only QA hook for browser checks; never present in production builds.
            if (import.meta.env.DEV) {
              (window as unknown as { __pg?: unknown }).__pg = { gl, scene, camera };
            }
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.setClearColor(0x000000, 0);
            const canvas = gl.domElement;
            const onContextLost = (ev: Event) => {
              ev.preventDefault();
              if (!leaving.current) onFail("context-lost");
            };
            canvas.addEventListener("webglcontextlost", onContextLost);
            releaseRenderer.current = () => {
              canvas.removeEventListener("webglcontextlost", onContextLost);
              if (import.meta.env.DEV) {
                const diagnostics = window as unknown as { __pg?: { gl: unknown } };
                if (diagnostics.__pg?.gl === gl) delete diagnostics.__pg;
              }
            };
          }}
        >
          <Rig
            apiRef={api}
            reduced={reduced}
            allowSpin={!reduced && !selected}
            zoomRef={zoomRef}
            bgRef={bgRef}
          />
          <Suspense fallback={null}>
            <Planet
              quality={quality}
              reduced={reduced}
              onReady={onReady}
              onPick={onPick}
              onHover={setHovered}
            />
            {selectedRegion && (
              <>
                <RegionOutline region={selectedRegion} color="#f0d79a" width={7} opacity={0.22} />
                <RegionOutline region={selectedRegion} color="#f6e3b0" width={2.4} opacity={0.95} />
              </>
            )}
            {hoveredRegion && (
              <RegionOutline region={hoveredRegion} color="#f0d79a" width={1.6} opacity={0.65} />
            )}
          </Suspense>
          <MarkerProjector els={markerEls} />
        </Canvas>

        <div className="pg-markers">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              ref={(el) => {
                if (el) markerEls.current.set(r.id, el);
                else markerEls.current.delete(r.id);
              }}
              className={`pg-marker pg-${r.kind}${selected === r.id ? " is-selected" : ""}`}
              aria-pressed={selected === r.id}
              aria-label={
                r.kind === "continent"
                  ? `${r.name} — kontynent ${r.people}`
                  : `${r.name} — przyszła wyspa questowa`
              }
              onClick={() => focusRegion(r)}
              onPointerEnter={() => setHovered(r.id)}
              onPointerLeave={() => setHovered((h) => (h === r.id ? null : h))}
            >
              {r.kind === "continent" ? (
                <>
                  <span className="pg-name">{r.name}</span>
                  <span className="pg-people">{r.people}</span>
                </>
              ) : (
                <span className="pg-num">{r.numeral}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!ready && (
        <div className="pg-loading" role="status">
          <span className="pg-ring" aria-hidden />
          Wczytywanie globusa planety Superior…
        </div>
      )}

      <header className="pm-topbar">
        <Link to="/" className="pm-back" aria-label="Wróć do gry">
          <ArrowLeft aria-hidden size={16} />
          <span>Gra</span>
        </Link>
        <div className="pm-title">
          <p className="pm-eyebrow">Ki Legends · Atlas</p>
          <h1>Planeta Superior</h1>
        </div>
        <Button
          variant="ghost"
          type="button"
          className="pm-mode"
          onClick={() => {
            leaving.current = true;
            onShowFlat();
          }}
          aria-label="Mapa 2D"
          title="Płaska mapa 2D"
        >
          <MapIcon size={15} aria-hidden />
          <span>Mapa 2D</span>
        </Button>
      </header>

      <p className="pm-demo-chip pg-chip" role="note">
        <strong>Podgląd atlasu</strong> · niepołączony z grą · bez pozycji gracza
      </p>

      <div className="pm-controls" role="toolbar" aria-label="Sterowanie globusem">
        <Button
          variant="ghost"
          type="button"
          onClick={() => api.current?.zoomBy(1.3)}
          aria-label="Przybliż"
          title="Przybliż"
        >
          <Plus size={18} aria-hidden />
        </Button>
        <output ref={zoomRef} className="pm-zoom" aria-label="Powiększenie">
          100%
        </output>
        <Button
          variant="ghost"
          type="button"
          onClick={() => api.current?.zoomBy(1 / 1.3)}
          aria-label="Oddal"
          title="Oddal"
        >
          <Minus size={18} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setSelected(null);
            api.current?.reset();
          }}
          aria-label="Widok całej planety"
          title="Widok całej planety"
        >
          <RotateCcw size={17} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setLegend((l) => !(l ?? wide))}
          aria-label="Legenda"
          title="Legenda"
          aria-expanded={legendOpen}
          aria-controls="pg-legend-panel"
          className="pm-legend-toggle"
        >
          <Layers size={17} aria-hidden />
        </Button>
      </div>

      <aside
        id="pg-legend-panel"
        className={`pm-panel${legendOpen ? " is-open" : " is-closed"}`}
        aria-label="Legenda globusa"
      >
        <div className="pm-panel-head">
          <h2>Atlas Superior</h2>
          <Button
            variant="ghost"
            type="button"
            className="pm-icon"
            onClick={() => setLegend(false)}
            aria-label="Zamknij legendę"
            title="Zamknij legendę"
          >
            <X size={16} aria-hidden />
          </Button>
        </div>
        <h3 className="pm-h3">Kontynenty</h3>
        <ul className="pm-legend">
          {CONTINENTS.map((c) => (
            <li key={c.id}>
              <Button
                variant="ghost"
                type="button"
                aria-pressed={selected === c.id}
                onClick={() => focusRegion(c)}
              >
                <span className="pm-thumb" style={thumbStyle(c)} aria-hidden />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.people}</small>
                </span>
              </Button>
            </li>
          ))}
        </ul>
        <h3 className="pm-h3">Wyspy questowe · planowane</h3>
        <ul className="pm-legend pm-legend-islands">
          {QUEST_ISLANDS.map((i) => (
            <li key={i.id}>
              <Button
                variant="ghost"
                type="button"
                aria-pressed={selected === i.id}
                onClick={() => focusRegion(i)}
                aria-label={`Wyspa questowa ${i.numeral} (nazwa robocza)`}
              >
                <span className="pm-thumb pm-thumb-sm" style={thumbStyle(i, 34)} aria-hidden />
                <strong>{i.numeral}</strong>
              </Button>
            </li>
          ))}
        </ul>
        <p className="pm-small">
          Wyłącznie wizualizacja. Globus nie odczytuje postępu, nie zna pozycji gracza i nie
          zapisuje niczego w grze ani w przeglądarce.
        </p>
        <p id="pg-help" className="sr-only">
          Przeciągnij, aby obrócić planetę. Kółko myszy lub szczypanie zmienia powiększenie. Kliknij
          kontynent lub wyspę, aby zobaczyć opis. Klawiatura: strzałki obracają, plus i minus
          przybliżają, 0 przywraca widok, Escape zamyka opis.
        </p>
      </aside>

      <section
        className={`pm-details${selectedRegion ? " is-open" : ""}`}
        aria-live="polite"
        aria-label="Opis regionu"
      >
        {selectedRegion && (
          <>
            <div className="pm-details-head">
              <span className="pm-thumb pm-thumb-lg" style={thumbStyle(selectedRegion, 64)} />
              <div>
                <p className="pm-kind">
                  {selectedRegion.kind === "continent" ? "Kontynent" : "Wyspa questowa · planowana"}
                </p>
                <h2>{selectedRegion.name}</h2>
              </div>
              <Button
                variant="ghost"
                type="button"
                className="pm-icon"
                onClick={() => setSelected(null)}
                aria-label="Zamknij opis"
                title="Zamknij opis"
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            {selectedRegion.people && (
              <p className="pm-meta">
                Pochodzenie <strong>{selectedRegion.people}</strong> · Region startowy{" "}
                <strong>{selectedRegion.settlement}</strong>
              </p>
            )}
            <p>{selectedRegion.summary}</p>
            {["verdant", "aether", "nexus", "pyra"].includes(selectedRegion.id) && (
              <Link
                to="/"
                search={{ continent: selectedRegion.id } as never}
                className="pm-enter-world"
              >
                Wejdź do gry — {selectedRegion.name}
              </Link>
            )}
            <p className="pm-status">{selectedRegion.status}</p>
          </>
        )}
      </section>
    </main>
  );
}
