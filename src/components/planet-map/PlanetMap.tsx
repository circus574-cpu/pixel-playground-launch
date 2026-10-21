import { Link } from "@tanstack/react-router";
import { ArrowLeft, Maximize2, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CONTINENTS,
  MAP_H,
  MAP_W,
  QUEST_ISLANDS,
  REGIONS,
  clampView,
  focusOn,
  fogClouds,
  initialView,
  panBy,
  regionDecorations,
  regionPath,
  viewBox,
  zoomAt,
  zoomLevel,
  type Decoration,
  type MapRegion,
  type View,
} from "./mapData";
import "./planet-map.css";

type Size = { w: number; h: number };
type Geometry = { region: MapRegion; path: string; inner: string; deco: Decoration[] };
type Gesture = { x: number; y: number; region: string | null; moved: boolean };

const FALLBACK: Size = { w: 1000, h: 500 };
const GRID = Array.from({ length: 15 }, (_, i) => (i + 1) * 125);

function Glyph({ d, terrain }: { d: Decoration; terrain: MapRegion["terrain"] }) {
  const k = d.size;
  switch (terrain) {
    case "forest":
      return (
        <g transform={`translate(${d.x} ${d.y}) scale(${k})`}>
          <circle r="8" className="pm-g-tree" />
          <circle r="3.5" cx="-2.5" cy="-2.5" className="pm-g-tree-hi" />
        </g>
      );
    case "sanctum":
      return d.variant === 1 ? (
        <circle cx={d.x} cy={d.y} r={6 * k} className="pm-g-spring" />
      ) : (
        <path
          transform={`translate(${d.x} ${d.y}) scale(${k})`}
          d="M-10 6L0 -10L10 6Z"
          className="pm-g-peak"
        />
      );
    case "tech":
      return d.variant === 2 ? (
        <path
          transform={`translate(${d.x} ${d.y}) scale(${k})`}
          d="M-12 0H-2V-8H10"
          className="pm-g-circuit"
        />
      ) : (
        <rect
          x={d.x - 5 * k}
          y={d.y - 5 * k}
          width={10 * k}
          height={10 * k}
          className="pm-g-node"
        />
      );
    case "volcanic":
      return (
        <g transform={`translate(${d.x} ${d.y}) scale(${k})`}>
          <path d="M-11 7L0 -11L11 7Z" className="pm-g-volcano" />
          {d.variant === 0 && <circle cy="-10" r="3" className="pm-g-lava" />}
        </g>
      );
    default:
      return <circle cx={d.x} cy={d.y} r={5 * k} className="pm-g-isle" />;
  }
}

export function PlanetMap() {
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
  const [selected, setSelected] = useState<string | null>(null);
  const [fog, setFog] = useState(false);
  const [perspective, setPerspective] = useState<string>("verdant");

  const geometry = useMemo<Geometry[]>(
    () =>
      REGIONS.map((region) => ({
        region,
        path: regionPath(region),
        inner: regionPath(region, 0.66, 48),
        deco: regionDecorations(region, region.kind === "continent" ? 48 : 5),
      })),
    [],
  );
  const clouds = useMemo(() => fogClouds(110), []);
  const revealed = geometry.find((g) => g.region.id === perspective) ?? geometry[0]!;
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
      const t = Math.min(1, (now - start) / 380);
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

  // Track container size; first real measurement shows the whole planet.
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
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnimation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
      if (e.type === "pointerup" && g && !g.moved) setSelected(g.region);
    } else if (pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      gesture.current = { ...rest!, region: null, moved: true };
    }
  };

  const zoomButton = (factor: number) => {
    const { w, h } = sizeRef.current;
    animateTo(zoomAt(view, factor, w / 2, h / 2, w, h));
  };
  const reset = () => {
    const { w, h } = sizeRef.current;
    animateTo(initialView(w, h));
  };
  const focusRegion = (region: MapRegion) => {
    setSelected(region.id);
    const { w, h } = sizeRef.current;
    animateTo(focusOn(region, w, h));
  };

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
      const [dx, dy] = pan[e.key]!;
      setView((v) => panBy(v, dx, dy, w, h));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomButton(1.4);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomButton(1 / 1.4);
    } else if (e.key === "0") {
      e.preventDefault();
      reset();
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  const zoom = zoomLevel(view, size.w, size.h);
  const px = (screen: number, min: number) => Math.max(min, screen / view.s);
  const showSettlements = zoom >= 1.6;
  const isRevealed = (id: string) => !fog || id === perspective;

  return (
    <main className="planet-map">
      <header className="pm-header">
        <Link to="/" className="pm-back">
          <ArrowLeft aria-hidden size={16} /> Wróć do gry
        </Link>
        <div className="pm-title">
          <p className="pm-eyebrow">Ki Legends · Atlas</p>
          <h1>
            Planeta Superior <span className="pm-demo">DEMO</span>
          </h1>
        </div>
      </header>

      <p className="pm-notice" role="note">
        <strong>Podgląd demonstracyjny.</strong> Mapa nie jest połączona z grą: nie pokazuje pozycji
        Twojej postaci i nie odczytuje ani nie zmienia zapisów. Ukształtowanie terenu jest
        generowane proceduralnie — w projekcie nie ma jeszcze gotowych grafik mapy planety.
      </p>

      <div className="pm-layout">
        <section className="pm-stage" aria-label="Mapa">
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
                <radialGradient id="pm-ocean" cx="50%" cy="50%" r="70%">
                  <stop offset="0" className="pm-ocean-a" />
                  <stop offset="1" className="pm-ocean-b" />
                </radialGradient>
                <filter id="pm-soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="22" />
                </filter>
                <mask
                  id="pm-fog-mask"
                  maskUnits="userSpaceOnUse"
                  x={-200}
                  y={-200}
                  width={MAP_W + 400}
                  height={MAP_H + 400}
                >
                  <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} fill="white" />
                  <path
                    d={revealed.path}
                    fill="black"
                    stroke="black"
                    strokeWidth={70}
                    filter="url(#pm-soft)"
                  />
                </mask>
              </defs>

              <rect x={-8000} y={-8000} width={18000} height={17000} className="pm-abyss" />
              <rect width={MAP_W} height={MAP_H} fill="url(#pm-ocean)" />
              <g className="pm-grid" aria-hidden>
                {GRID.map((x) => (
                  <line key={`m${x}`} x1={x} y1={0} x2={x} y2={MAP_H} />
                ))}
                {GRID.filter((y) => y < MAP_H).map((y) => (
                  <line key={`p${y}`} x1={0} y1={y} x2={MAP_W} y2={y} />
                ))}
                <line x1={0} y1={MAP_H / 2} x2={MAP_W} y2={MAP_H / 2} className="pm-equator" />
              </g>

              {geometry.map(({ region, path }) => (
                <path key={`shelf-${region.id}`} d={path} className="pm-shelf" aria-hidden />
              ))}

              {geometry.map(({ region, path, inner, deco }) => (
                <g
                  key={region.id}
                  className={`pm-region pm-${region.kind}${selected === region.id ? " is-selected" : ""}`}
                >
                  <path
                    d={path}
                    data-region={region.id}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected === region.id}
                    aria-label={
                      region.kind === "continent"
                        ? `${region.name} — kontynent ${region.people}`
                        : `${region.name} — przyszła wyspa questowa`
                    }
                    style={{ fill: region.fill }}
                    className="pm-land"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={inner}
                    style={{ fill: region.shade }}
                    className="pm-highland"
                    aria-hidden
                  />
                  <g aria-hidden className="pm-deco">
                    {deco.map((d, i) => (
                      <Glyph key={i} d={d} terrain={region.terrain} />
                    ))}
                  </g>
                </g>
              ))}

              {CONTINENTS.map((c) =>
                c.settlementPoint && (showSettlements || selected === c.id) ? (
                  <g key={`set-${c.id}`} className="pm-settlement" aria-hidden>
                    <rect
                      x={c.settlementPoint.x - px(6, 5)}
                      y={c.settlementPoint.y - px(6, 5)}
                      width={px(12, 10)}
                      height={px(12, 10)}
                      transform={`rotate(45 ${c.settlementPoint.x} ${c.settlementPoint.y})`}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={c.settlementPoint.x}
                      y={c.settlementPoint.y + px(22, 18)}
                      fontSize={px(12, 12)}
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
                    x={c.center.x}
                    y={c.center.y - c.radius.y * 0.12}
                    fontSize={px(16, 38)}
                    className="pm-label"
                  >
                    {c.name}
                    <tspan x={c.center.x} dy={px(15, 30)} fontSize={px(11, 22)} className="pm-sub">
                      {c.people}
                    </tspan>
                  </text>
                ))}
                {QUEST_ISLANDS.map((i) => (
                  <text
                    key={i.id}
                    x={i.center.x}
                    y={i.center.y + px(5, 8)}
                    fontSize={px(13, 24)}
                    className="pm-label pm-island-label"
                  >
                    {i.numeral}
                  </text>
                ))}
              </g>

              {fog && (
                <g mask="url(#pm-fog-mask)" className="pm-fog" aria-hidden>
                  <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} />
                  {clouds.map((c, i) => (
                    <circle key={i} cx={c.x} cy={c.y} r={c.size} />
                  ))}
                </g>
              )}

              <g className="pm-compass" transform="translate(1910 905)" aria-hidden>
                <circle r="44" />
                <path d="M0 -38L8 0L0 38L-8 0Z" />
                <text y="-50" fontSize="22">
                  N
                </text>
              </g>
              <rect
                width={MAP_W}
                height={MAP_H}
                className="pm-frame"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="pm-ribbon" aria-hidden>
              DEMO · bez pozycji gracza
            </div>
            <div className="pm-controls">
              <button type="button" onClick={() => zoomButton(1.4)} aria-label="Przybliż">
                <Plus size={18} aria-hidden />
              </button>
              <button type="button" onClick={() => zoomButton(1 / 1.4)} aria-label="Oddal">
                <Minus size={18} aria-hidden />
              </button>
              <button type="button" onClick={reset} aria-label="Pokaż całą planetę">
                <Maximize2 size={16} aria-hidden />
              </button>
              <output className="pm-zoom" aria-label="Powiększenie">
                {Math.round(zoom * 100)}%
              </output>
            </div>
          </div>
          <p id="pm-help" className="pm-help">
            Przeciągnij, aby przesunąć. Kółko myszy, gest szczypania lub przyciski +/− zmieniają
            powiększenie. Kliknij region, aby zobaczyć opis. Klawiatura: strzałki, + / −, 0.
          </p>
        </section>

        <aside className="pm-side">
          <section className="pm-card pm-details" aria-live="polite">
            {selectedRegion ? (
              <>
                <p className="pm-kind">
                  {selectedRegion.kind === "continent" ? "Kontynent" : "Wyspa questowa · planowana"}
                </p>
                <h2>{selectedRegion.name}</h2>
                {selectedRegion.people && (
                  <p className="pm-meta">
                    Pochodzenie: <strong>{selectedRegion.people}</strong>
                    <br />
                    Region startowy: <strong>{selectedRegion.settlement}</strong>
                  </p>
                )}
                <p>{selectedRegion.summary}</p>
                <p className="pm-status">{selectedRegion.status}</p>
                {fog && !isRevealed(selectedRegion.id) && (
                  <p className="pm-fog-note">W podglądzie mgły ten obszar jest nieodkryty.</p>
                )}
                <div className="pm-actions">
                  <button type="button" onClick={() => focusRegion(selectedRegion)}>
                    Przybliż region
                  </button>
                  <button type="button" className="pm-ghost" onClick={() => setSelected(null)}>
                    Zamknij
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="pm-kind">Wybierz region</p>
                <h2>Superior</h2>
                <p>
                  Cztery kanoniczne kontynenty i sześć przyszłych wysp questowych. Kliknij region na
                  mapie albo w legendzie.
                </p>
              </>
            )}
          </section>

          <section className="pm-card" aria-labelledby="pm-legend-c">
            <h3 id="pm-legend-c">Kontynenty</h3>
            <ul className="pm-legend">
              {CONTINENTS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={selected === c.id}
                    onClick={() => focusRegion(c)}
                  >
                    <span className="pm-swatch" style={{ background: c.fill }} aria-hidden />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.people}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="pm-card" aria-labelledby="pm-legend-i">
            <h3 id="pm-legend-i">Wyspy questowe (planowane)</h3>
            <ul className="pm-legend pm-legend-islands">
              {QUEST_ISLANDS.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    aria-pressed={selected === i.id}
                    onClick={() => focusRegion(i)}
                  >
                    <span className="pm-swatch pm-swatch-island" aria-hidden>
                      {i.numeral}
                    </span>
                    <span>
                      <strong>Wyspa {i.numeral}</strong>
                      <small>nazwa robocza</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <ul className="pm-symbols">
              <li>
                <span className="pm-sym-settlement" aria-hidden /> Region startowy (widoczny po
                przybliżeniu)
              </li>
              <li>
                <span className="pm-sym-grid" aria-hidden /> Siatka południków i równik
              </li>
            </ul>
          </section>

          <section className="pm-card" aria-labelledby="pm-fog-h">
            <h3 id="pm-fog-h">Mgła wojny · podgląd</h3>
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
              Wyłącznie wizualizacja. Nie odczytuje postępu i nie zapisuje niczego w grze ani w
              przeglądarce.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
