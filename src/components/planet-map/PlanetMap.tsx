import { Link } from "@tanstack/react-router";
import { ArrowLeft, Globe2, Layers, Minus, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import atlasHi from "@/assets/planet-map/atlas-3840.webp";
import atlasLo from "@/assets/planet-map/atlas-1920.webp";
import {
  CONTINENTS,
  MAP_H,
  MAP_W,
  QUEST_ISLANDS,
  REGIONS,
  clampView,
  focusOn,
  initialView,
  panBy,
  regionPath,
  viewBox,
  wholeView,
  zoomAt,
  zoomLevel,
  type MapRegion,
  type View,
} from "./mapData";
import { thumbStyle } from "./thumb";
import "./planet-map.css";

type Size = { w: number; h: number };
type Gesture = { x: number; y: number; region: string | null; moved: boolean };

const FALLBACK: Size = { w: 1280, h: 800 };
const PATHS = Object.fromEntries(REGIONS.map((r) => [r.id, regionPath(r)]));

export function PlanetMap({
  onShowGlobe,
  notice,
  embedded = false,
  onClose,
}: {
  /** Switch back to the 3D globe; omitted when WebGL 2 is unavailable. */
  onShowGlobe?: (() => void) | undefined;
  /** Why the flat atlas is shown instead of the globe, if not by choice. */
  notice?: string | null | undefined;
  embedded?: boolean;
  onClose?: (() => void) | undefined;
} = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sizeRef = useRef<Size>(FALLBACK);
  const measured = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const anim = useRef<number | null>(null);

  const [size, setSize] = useState<Size>(FALLBACK);
  const [view, setView] = useState<View>(() => initialView(FALLBACK.w, FALLBACK.h));
  const [ready, setReady] = useState(false);
  const [hiRes, setHiRes] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [fog, setFog] = useState(false);
  const [perspective, setPerspective] = useState<string>("verdant");
  /** null = layout default (open on desktop, closed on phones). */
  const [legend, setLegend] = useState<boolean | null>(null);

  const selectedRegion = REGIONS.find((r) => r.id === selected) ?? null;

  const stopAnimation = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const animateTo = useCallback((target: View) => {
    stopAnimation();
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setView(target);
      return;
    }
    let from: View | null = null;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 520);
      const e = 1 - Math.pow(1 - t, 3);
      setView((current) => {
        from ??= current;
        return {
          cx: from.cx + (target.cx - from.cx) * e,
          cy: from.cy + (target.cy - from.cy) * e,
          s: Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e),
        };
      });
      anim.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  // Track container size; the first real measurement sets the opening view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      sizeRef.current = { w, h };
      setSize({ w, h });
      if (!measured.current) {
        measured.current = true;
        setView(initialView(w, h));
        setReady(true);
      } else {
        setView((v) => clampView(v, w, h));
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      stopAnimation();
      // StrictMode re-runs effects; let the next run measure afresh.
      measured.current = false;
    };
  }, []);

  // Load the 3840 px atlas after first paint; the 1920 px one shows meanwhile.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.src = atlasHi;
    img
      .decode()
      .then(() => alive && setHiRes(true))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Native non-passive wheel listener so the page does not scroll behind the map.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnimation();
      const rect = svg.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { w, h } = sizeRef.current;
      setView((v) =>
        zoomAt(v, Math.exp(-dy * 0.0015), e.clientX - rect.left, e.clientY - rect.top, w, h),
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnimation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Capture is an enhancement; gestures still work without it.
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      const hit = (e.target as Element).closest?.("[data-region]");
      gesture.current = { ...p, region: hit?.getAttribute("data-region") ?? null, moved: false };
    } else if (pointers.current.size === 2) {
      if (gesture.current) gesture.current.moved = true;
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const { w, h } = sizeRef.current;
    if (pointers.current.size === 1 && gesture.current) {
      const g = gesture.current;
      if (!g.moved && Math.hypot(p.x - g.x, p.y - g.y) > 6) g.moved = true;
      if (g.moved) setView((v) => panBy(v, p.x - prev.x, p.y - prev.y, w, h));
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const last = pinch.current;
      setView((v) =>
        panBy(zoomAt(v, dist / last.dist, mx, my, w, h), mx - last.mx, my - last.my, w, h),
      );
      pinch.current = { dist, mx, my };
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0) {
      const g = gesture.current;
      gesture.current = null;
      if (e.type === "pointerup" && g && !g.moved) {
        setSelected(g.region);
        if (g.region) setLegend((l) => (isNarrow() ? false : l));
      }
    } else if (pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      if (rest) gesture.current = { ...rest, region: null, moved: true };
    }
  };

  const zoomButton = (factor: number) => {
    const { w, h } = sizeRef.current;
    animateTo(zoomAt(view, factor, w / 2, h / 2, w, h));
  };
  const showWhole = () => {
    const { w, h } = sizeRef.current;
    animateTo(wholeView(w, h));
  };
  const focusRegion = (region: MapRegion) => {
    setSelected(region.id);
    if (isNarrow()) setLegend(false);
    const { w, h } = sizeRef.current;
    animateTo(focusOn(region, w, h));
  };
  const toggleLegend = () => setLegend((l) => !(l ?? size.w > 1600));

  const onMapKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const { w, h } = sizeRef.current;
    const regionId = (e.target as Element).getAttribute?.("data-region");
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [80, 0],
      ArrowRight: [-80, 0],
      ArrowUp: [0, 80],
      ArrowDown: [0, -80],
    };
    if ((e.key === "Enter" || e.key === " ") && regionId) {
      e.preventDefault();
      setSelected(regionId);
    } else if (pan[e.key]) {
      e.preventDefault();
      const delta = pan[e.key];
      if (!delta) return;
      const [dx, dy] = delta;
      setView((v) => panBy(v, dx, dy, w, h));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomButton(1.4);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomButton(1 / 1.4);
    } else if (e.key === "0") {
      e.preventDefault();
      showWhole();
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  const zoom = zoomLevel(view, size.w, size.h);
  /** Map units for a constant on-screen size (px). */
  const px = (screen: number) => screen / view.s;
  const labelPx = Math.min(30, Math.max(13, 15 * Math.pow(zoom, 0.3)));
  const showSettlements = zoom >= 1.7;
  const isRevealed = (id: string) => !fog || id === perspective;
  const legendOpen = legend ?? size.w > 1600;
  const legendClass = legendOpen ? " is-open" : " is-closed";

  const atlasImage = useMemo(
    () => (
      <>
        <image
          href={atlasLo}
          width={MAP_W}
          height={MAP_H}
          preserveAspectRatio="none"
          className="pm-atlas"
        />
        {hiRes && (
          <image
            href={atlasHi}
            width={MAP_W}
            height={MAP_H}
            preserveAspectRatio="none"
            className="pm-atlas pm-atlas-hi"
          />
        )}
      </>
    ),
    [hiRes],
  );

  return (
    <main
      className={`planet-map${ready ? " is-ready" : ""}${legendOpen || selectedRegion ? " has-panel" : ""}`}
    >
      <div ref={wrapRef} className="pm-viewport">
        <svg
          ref={svgRef}
          className="pm-svg"
          viewBox={viewBox(view, size.w, size.h)}
          preserveAspectRatio="none"
          role="group"
          aria-label="Interaktywna mapa planety Superior, wersja DEMO"
          aria-describedby="pm-help"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onMapKey}
        >
          <defs>
            <radialGradient id="pm-vignette" cx="50%" cy="50%" r="72%">
              <stop offset="0.62" stopColor="#030a12" stopOpacity="0" />
              <stop offset="1" stopColor="#030a12" stopOpacity="0.62" />
            </radialGradient>
            <linearGradient id="pm-edge-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#04101b" stopOpacity="0.95" />
              <stop offset="0.07" stopColor="#04101b" stopOpacity="0" />
              <stop offset="0.93" stopColor="#04101b" stopOpacity="0" />
              <stop offset="1" stopColor="#04101b" stopOpacity="0.95" />
            </linearGradient>
            <filter id="pm-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id="pm-fog-filter" x="0" y="0" width="100%" height="100%">
              <feGaussianBlur stdDeviation="5" />
              <feColorMatrix
                type="matrix"
                values="0.16 0.2 0.06 0 0.03  0.16 0.22 0.06 0 0.05  0.16 0.22 0.1 0 0.09  0 0 0 1 0"
              />
            </filter>
            <mask
              id="pm-fog-mask"
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={MAP_W}
              height={MAP_H}
            >
              <rect width={MAP_W} height={MAP_H} fill="white" />
              <path
                d={PATHS[perspective]}
                fill="black"
                stroke="black"
                strokeWidth={60}
                strokeLinejoin="round"
                filter="url(#pm-soft)"
              />
            </mask>
            {selectedRegion && (
              <mask
                id="pm-spot-mask"
                maskUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={MAP_W}
                height={MAP_H}
              >
                <rect width={MAP_W} height={MAP_H} fill="white" />
                <path
                  d={PATHS[selectedRegion.id]}
                  fill="black"
                  stroke="black"
                  strokeWidth={30}
                  strokeLinejoin="round"
                  filter="url(#pm-soft)"
                />
              </mask>
            )}
          </defs>

          {atlasImage}

          {fog && (
            <g mask="url(#pm-fog-mask)" className="pm-fog" aria-hidden>
              <image
                href={atlasLo}
                width={MAP_W}
                height={MAP_H}
                preserveAspectRatio="none"
                filter="url(#pm-fog-filter)"
              />
              <rect width={MAP_W} height={MAP_H} />
            </g>
          )}

          {selectedRegion && (
            <rect
              width={MAP_W}
              height={MAP_H}
              mask="url(#pm-spot-mask)"
              className="pm-spot"
              aria-hidden
            />
          )}
          <rect width={MAP_W} height={MAP_H} fill="url(#pm-vignette)" className="pm-vig" />
          <rect width={MAP_W} height={MAP_H} fill="url(#pm-edge-fade)" className="pm-vig" />

          <g className="pm-hits">
            {REGIONS.map((region) => (
              <path
                key={region.id}
                d={PATHS[region.id]}
                data-region={region.id}
                tabIndex={0}
                role="button"
                aria-pressed={selected === region.id}
                aria-label={
                  region.kind === "continent"
                    ? `${region.name} — kontynent ${region.people}`
                    : `${region.name} — przyszła wyspa questowa`
                }
                className={`pm-hit pm-${region.kind}${selected === region.id ? " is-selected" : ""}${hovered === region.id ? " is-hovered" : ""}`}
                vectorEffect="non-scaling-stroke"
                onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(region.id)}
                onPointerLeave={() => setHovered((h) => (h === region.id ? null : h))}
                onFocus={() => setHovered(region.id)}
                onBlur={() => setHovered(null)}
              />
            ))}
          </g>

          {CONTINENTS.map((c) =>
            c.settlementPoint && (showSettlements || selected === c.id) ? (
              <g key={`set-${c.id}`} className="pm-settlement" aria-hidden>
                <rect
                  x={c.settlementPoint.x - px(4.5)}
                  y={c.settlementPoint.y - px(4.5)}
                  width={px(9)}
                  height={px(9)}
                  transform={`rotate(45 ${c.settlementPoint.x} ${c.settlementPoint.y})`}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  className={zoom < 3 ? "pm-settlement-name-hidden" : undefined}
                  x={c.settlementPoint.x}
                  y={c.settlementPoint.y + px(20)}
                  fontSize={px(12)}
                  strokeWidth={px(3)}
                >
                  {c.settlement}
                </text>
              </g>
            ) : null,
          )}

          <g className="pm-labels" aria-hidden>
            {CONTINENTS.map((c) => (
              <text
                key={c.id}
                x={c.label.x}
                y={c.label.y}
                fontSize={px(labelPx)}
                strokeWidth={px(4)}
                className={`pm-label${isRevealed(c.id) ? "" : " is-fogged"}`}
              >
                {c.name.toUpperCase()}
                <tspan
                  x={c.label.x}
                  dy={px(labelPx * 0.95)}
                  fontSize={px(labelPx * 0.52)}
                  className="pm-sub"
                >
                  {c.people}
                </tspan>
              </text>
            ))}
            {QUEST_ISLANDS.map((i) => (
              <text
                key={i.id}
                x={i.label.x}
                y={i.label.y}
                fontSize={px(labelPx * 0.72)}
                strokeWidth={px(3.5)}
                className="pm-label pm-island-label"
              >
                {i.numeral}
              </text>
            ))}
          </g>
        </svg>
      </div>

      <header className="pm-topbar">
        {embedded && onClose ? (
          <button
            type="button"
            className="pm-back"
            onClick={onClose}
            aria-label="Zamknij mapę i wróć do gry"
          >
            <ArrowLeft aria-hidden size={16} />
            <span>Gra</span>
          </button>
        ) : (
          <Link to="/" className="pm-back" aria-label="Wróć do gry">
            <ArrowLeft aria-hidden size={16} />
            <span>Gra</span>
          </Link>
        )}
        <div className="pm-title">
          <p className="pm-eyebrow">Ki Legends · Atlas</p>
          <h1>
            Planeta Superior <span className="pm-demo">DEMO</span>
          </h1>
        </div>
        {onShowGlobe && (
          <Button
            variant="ghost"
            type="button"
            className="pm-mode"
            onClick={onShowGlobe}
            aria-label="Globus 3D"
            title="Globus 3D"
          >
            <Globe2 size={18} aria-hidden />
            <span>Globus 3D</span>
          </Button>
        )}
      </header>

      {notice && (
        <p className="pm-notice" role="status">
          {notice}
        </p>
      )}

      <p className="pm-demo-chip" role="note">
        <strong>DEMO</strong> · niepołączona z grą · bez pozycji gracza
      </p>

      <div className="pm-controls" role="toolbar" aria-label="Sterowanie mapą">
        <Button
          variant="ghost"
          type="button"
          onClick={() => zoomButton(1.4)}
          aria-label="Przybliż"
          title="Przybliż"
        >
          <Plus size={18} aria-hidden />
        </Button>
        <output className="pm-zoom" aria-label="Powiększenie">
          {Math.round(zoom * 100)}%
        </output>
        <Button
          variant="ghost"
          type="button"
          onClick={() => zoomButton(1 / 1.4)}
          aria-label="Oddal"
          title="Oddal"
        >
          <Minus size={18} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={showWhole}
          aria-label="Pokaż całą planetę"
          title="Pokaż całą planetę"
        >
          <Globe2 size={17} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={toggleLegend}
          aria-label="Legenda i warstwy"
          title="Legenda i warstwy"
          aria-expanded={legendOpen}
          aria-controls="pm-legend-panel"
          className="pm-legend-toggle"
        >
          <Layers size={17} aria-hidden />
        </Button>
      </div>

      <aside id="pm-legend-panel" className={`pm-panel${legendClass}`} aria-label="Legenda mapy">
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

        <h3 className="pm-h3">Mgła wojny · podgląd</h3>
        <label className="pm-toggle">
          <input type="checkbox" checked={fog} onChange={(e) => setFog(e.target.checked)} />
          <span>Pokaż mgłę wojny</span>
        </label>
        {fog && (
          <fieldset className="pm-perspective">
            <legend>Odkryty kontynent startowy</legend>
            {CONTINENTS.map((c) => (
              <label key={c.id}>
                <input
                  type="radio"
                  name="pm-perspective"
                  value={c.id}
                  checked={perspective === c.id}
                  onChange={() => setPerspective(c.id)}
                />
                {c.people} · {c.name}
              </label>
            ))}
          </fieldset>
        )}
        <p className="pm-small">
          Wyłącznie wizualizacja. Mapa nie odczytuje postępu, nie zna pozycji gracza i nie zapisuje
          niczego w grze ani w przeglądarce.
        </p>
        <p id="pm-help" className="sr-only">
          Przeciągnij, aby przesunąć. Kółko myszy, szczypanie lub +/− zmieniają powiększenie.
          Kliknij region, aby zobaczyć opis. Klawiatura: strzałki, + / −, 0.
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
            {!embedded && ["verdant", "aether", "nexus", "pyra"].includes(selectedRegion.id) && (
              <Link
                to="/"
                search={{ continent: selectedRegion.id } as never}
                className="pm-enter-world"
              >
                Wejdź do gry — {selectedRegion.name}
              </Link>
            )}
            <p className="pm-status">{selectedRegion.status}</p>
            {fog && !isRevealed(selectedRegion.id) && (
              <p className="pm-fog-note">W podglądzie mgły ten obszar jest nieodkryty.</p>
            )}
            <Button
              variant="ghost"
              type="button"
              className="pm-primary"
              onClick={() => focusRegion(selectedRegion)}
            >
              Przybliż region
            </Button>
          </>
        )}
      </section>
    </main>
  );
}

function isNarrow() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
}
