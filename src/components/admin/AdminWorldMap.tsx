import { useEffect, useMemo, useRef, useState } from "react";
import atlas from "@/assets/planet-map/atlas-v2-3840.webp";
import projection from "@/components/planet-map/worldOverlay.v2.json";
import { worldToAtlas } from "@/components/planet-map/worldToAtlas";
import { ALL_QUESTS_V2 } from "@/game/quests/engine";
import { MONSTER_BASE } from "@/game/monsters/base.generated";
import {
  applyCustomSpawnsForFeature,
  type AdminWorldOverrides,
} from "@/game/world/adminWorldStore";
import type { AuthoredSpawn } from "@/game/world/generated/spawnStream";
import type { FeatureId } from "@/game/world/generated/superiorSave";
import index from "../../../public/game/worlds/superior-v2/index.json";
import bindings from "@/game/worlds/v2Places.generated.json";
import "./admin-world-map.css";

type Point = { x: number; y: number };
type Land = {
  id: string;
  spawns: AuthoredSpawn[];
  locations: (Point & { id: string; name?: string })[];
};
type Marker = Point & { id: string; name: string; land: string; quest?: string; kind?: string };
const names = new Map(MONSTER_BASE.map((m) => [m.id, m.name]));
const layerNames = {
  roads: "Drogi i ścieżki",
  spawns: "Spawny potworów",
  quests: "Zadania",
  places: "Miasta i lokacje",
};
const project = (land: string, p: Point) => worldToAtlas(projection, land, p.x, p.y);
const questPlaces = bindings as Record<
  string,
  { cities: Record<string, Point>; famous: Record<string, Point>; hidden: Record<string, Point> }
>;

export function AdminWorldMap({ overrides }: { overrides: AdminWorldOverrides }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(
    null,
  );
  const [lands, setLands] = useState<Land[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [layers, setLayers] = useState({ roads: true, spawns: true, quests: true, places: true });
  const [view, setView] = useState({ cx: 1000, cy: 500, zoom: 1 });
  const [selection, setSelection] = useState<Marker | null>(null);
  const [query, setQuery] = useState("");
  const [quest, setQuest] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const pending = [...index.features];
    const loaded: Land[] = [];
    const read = async (path: string) => {
      const r = await fetch(path, { signal: controller.signal });
      if (!r.ok) throw Error(`Nie można pobrać ${path} (${r.status})`);
      return r.json();
    };
    const worker = async () => {
      while (pending.length && !controller.signal.aborted) {
        const land = pending.shift()!;
        const base = `/game/worlds/superior-v2/${land.id}`;
        const [spawns, world] = await Promise.all([
          read(base + "/spawns.json"),
          read(base + "/world.json"),
        ]);
        if (!Array.isArray(spawns.overworld) || !Array.isArray(world.locations))
          throw Error(`Nieprawidłowe dane lądu ${land.name}`);
        loaded.push({ id: land.id, spawns: spawns.overworld, locations: world.locations });
      }
    };
    void Promise.all([worker(), worker(), worker()])
      .then(() => {
        if (!controller.signal.aborted) {
          setLands(loaded);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Błąd mapy");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const spawns = useMemo(
    () =>
      lands.flatMap((land) =>
        applyCustomSpawnsForFeature(land.id as FeatureId, land.spawns, overrides).flatMap((s) => {
          const p = project(land.id, s);
          return p
            ? [
                {
                  ...p,
                  id: s.id,
                  kind: s.kind,
                  land: land.id,
                  name: `${names.get(s.kind) ?? s.kind} · ${s.id} · (${Math.round(s.x)}, ${Math.round(s.y)}) · odrodzenie ${s.respawnMs / 1000} s`,
                },
              ]
            : [];
        }),
      ),
    [lands, overrides],
  );
  const markers = useMemo(
    () =>
      ALL_QUESTS_V2.flatMap((q) => {
        const land = q.continent,
          places = questPlaces[land];
        const result: Marker[] = [];
        const add = (id: string, at: Point | undefined, label: string) => {
          const p = at && project(land, at);
          if (p)
            result.push({
              ...p,
              id: q.id + ":" + id,
              name: `${q.id} · ${q.title} — ${label}${q.playableInCurrentRuntime ? "" : " (planowane)"}`,
              quest: q.id,
              land,
            });
        };
        add("giver", places?.cities[q.cityId], `zleceniodawca ${q.giverName} (miasto)`);
        for (const stage of q.stages)
          for (const obj of stage.objectives) {
            const at =
              places?.famous[obj.targetId] ??
              places?.hidden[obj.targetId] ??
              places?.cities[obj.targetId] ??
              lands
                .find((l) => l.id === obj.continent)
                ?.locations.find((l) => l.id === obj.targetId);
            // Legacy small-map coordinates are not valid coordinates of the current v2 continent.
            const p = at && project(obj.continent, at);
            if (p)
              result.push({
                ...p,
                id: q.id + ":" + stage.id + ":" + obj.id,
                quest: q.id,
                land: obj.continent,
                name: `${q.id} · ${q.title} — ${obj.description}`,
              });
          }
        return result;
      }),
    [lands],
  );
  const visibleQuests = ALL_QUESTS_V2.filter((q) =>
    `${q.id} ${q.title} ${q.giverName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const shownMarkers = markers.filter((m) => !quest || m.quest === quest);
  const spawnPath = useMemo(() => spawns.map((p) => `M${p.x},${p.y}h0.01`).join(""), [spawns]);
  const roadPaths = useMemo(
    () =>
      ["road", "trail"].map((kind) => ({
        kind,
        d: projection.roads
          .filter((r) => (kind === "road" ? r.kind !== "trail" : r.kind === "trail"))
          .map((r) => r.points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(""))
          .join(""),
      })),
    [],
  );
  const chosenQuest = ALL_QUESTS_V2.find((q) => q.id === quest);
  const combatKinds = new Set(
    chosenQuest?.stages.flatMap((s) =>
      s.objectives.filter((o) => o.type === "combat").map((o) => o.targetId),
    ) ?? [],
  );
  const combatPoints = spawns.filter((s) => combatKinds.has(s.kind ?? ""));
  const width = 2000 / view.zoom,
    height = 1000 / view.zoom;
  const focus = (p: Point) => setView({ cx: p.x, cy: p.y, zoom: 8 });
  const zoom = (factor: number) =>
    setView((v) => ({ ...v, zoom: Math.max(1, Math.min(40, v.zoom * factor)) }));
  const at = (x: number, y: number) => {
    const m = svg.current?.getScreenCTM();
    return m ? new DOMPoint(x, y).matrixTransform(m.inverse()) : null;
  };
  return (
    <section className="ki-admin-world-map" aria-label="Mapa świata administratora">
      <h2>Mapa świata · Superior v2</h2>
      <fieldset>
        <legend>Widoczne warstwy</legend>
        {Object.entries(layerNames).map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={layers[id as keyof typeof layers]}
              onChange={(e) => setLayers({ ...layers, [id]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="ki-world-map-tools">
        <button onClick={() => zoom(1.5)} aria-label="Przybliż mapę">
          +
        </button>
        <button onClick={() => zoom(1 / 1.5)} aria-label="Oddal mapę">
          −
        </button>
        <button onClick={() => setView({ cx: 1000, cy: 500, zoom: 1 })}>Cały świat</button>
        <label>
          Kraina{" "}
          <select
            defaultValue=""
            onChange={(e) => {
              const f = index.features.find((f) => f.id === e.target.value);
              const p = f && project(f.id, f.arrival);
              if (p) focus(p);
            }}
          >
            <option value="">Wybierz ląd…</option>
            {index.features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <span role="status">
          {loading
            ? "Wczytywanie punktów świata…"
            : `${spawns.length} spawnów · ${projection.roads.length} dróg · ${ALL_QUESTS_V2.length} zadań`}
        </span>
      </div>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setAttempt((n) => n + 1)}>Ponów pobieranie</button>
        </p>
      )}
      <div className="ki-world-map-viewport">
        <svg
          ref={svg}
          viewBox={`${view.cx - width / 2} ${view.cy - height / 2} ${width} ${height}`}
          role="img"
          aria-label="Pełna mapa 2D Superior z warstwami"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "+" || e.key === "=") {
              zoom(1.5);
              e.preventDefault();
            } else if (e.key === "-") {
              zoom(1 / 1.5);
              e.preventDefault();
            } else if (e.key.startsWith("Arrow")) {
              e.preventDefault();
              setView((v) => ({
                ...v,
                cx:
                  v.cx +
                  ((e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * 100) / v.zoom,
                cy:
                  v.cy +
                  ((e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0) * 100) / v.zoom,
              }));
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            svg.current?.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = at(e.clientX, e.clientY),
              start = at(d.x, d.y);
            if (p && start) {
              if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
              setView((v) => ({ ...v, cx: d.cx + start.x - p.x, cy: d.cy + start.y - p.y }));
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d || d.moved) return;
            const p = at(e.clientX, e.clientY);
            if (!p) return;
            const candidates = [
              ...(layers.quests ? [...shownMarkers, ...combatPoints] : []),
              ...(layers.spawns ? spawns : []),
            ];
            let best: Marker | null = null,
              dist =
                14 /
                (Math.hypot(
                  svg.current?.getScreenCTM()?.a ?? 1,
                  svg.current?.getScreenCTM()?.b ?? 0,
                ) || 1);
            for (const c of candidates) {
              const n = Math.hypot(c.x - p.x, c.y - p.y);
              if (n < dist) {
                best = c;
                dist = n;
              }
            }
            setSelection(best);
          }}
        >
          <image href={atlas} width={2000} height={1000} />
          {layers.roads &&
            roadPaths.map((r) => (
              <path
                key={r.kind}
                d={r.d}
                fill="none"
                stroke={r.kind === "road" ? "#f5d28a" : "#87d8bd"}
                strokeWidth={r.kind === "road" ? 1.8 : 1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {layers.places &&
            projection.places.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.5 / view.zoom}
                fill="#eee"
                stroke="#18242e"
                strokeWidth={0.6 / view.zoom}
              >
                <title>{p.name || p.id}</title>
              </circle>
            ))}
          {layers.spawns && (
            <path
              d={spawnPath}
              fill="none"
              stroke="#ff665b"
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {layers.quests && combatPoints.length > 0 && (
            <path
              d={combatPoints.map((p) => `M${p.x},${p.y}h0.01`).join("")}
              fill="none"
              stroke="#c799ff"
              strokeWidth={5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {layers.quests &&
            shownMarkers.map((m) => (
              <circle
                key={m.id}
                cx={m.x}
                cy={m.y}
                r={4 / view.zoom}
                fill="#c799ff"
                stroke="#20122e"
                strokeWidth={1 / view.zoom}
              >
                <title>{m.name}</title>
              </circle>
            ))}
          {selection && (
            <circle
              cx={selection.x}
              cy={selection.y}
              r={10 / view.zoom}
              fill="none"
              stroke="#fff"
              strokeWidth={2 / view.zoom}
            />
          )}
        </svg>
      </div>
      <p className="ki-world-map-legend">
        <span>━ złote: drogi</span>
        <span>━ zielone: ścieżki</span>
        <span>● czerwone: spawny</span>
        <span>● fioletowe: punkty zadań i cele walki wybranego zadania</span>
        <span>● białe: miasta i lokacje</span>
      </p>
      <p>
        Przeciągnij mapę lub użyj strzałek; powiększ przyciskami +/−. Kliknij punkt, aby zobaczyć
        szczegóły. Zleceniodawca bez dokładnej pozycji NPC jest oznaczony w centrum jego miasta.
        Cele bez przypisania do v2 nie otrzymują zmyślonych współrzędnych.
      </p>
      {selection && (
        <p role="status">
          {selection.name} · {selection.land}
        </p>
      )}
      <label>
        Szukaj zadania{" "}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nazwa, ID lub NPC"
        />
      </label>
      <label>
        Zadanie na mapie{" "}
        <select
          value={quest}
          onChange={(e) => {
            setQuest(e.target.value);
            const m = markers.find((m) => m.quest === e.target.value);
            if (m) focus(m);
          }}
        >
          <option value="">Wszystkie zadania</option>
          {visibleQuests.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} · {q.title}
              {markers.some((m) => m.quest === q.id) ? "" : " · bez przypisanego punktu"}
            </option>
          ))}
        </select>
      </label>
      {quest &&
        (() => {
          const q = ALL_QUESTS_V2.find((q) => q.id === quest);
          return (
            q && (
              <article>
                <h3>
                  {q.id} · {q.title}
                </h3>
                <p>{q.summary}</p>
                <p>
                  {q.playableInCurrentRuntime
                    ? "Obsługiwane w runtime"
                    : "Planowane / częściowo obsługiwane"}
                </p>
                <ul>
                  {q.stages.flatMap((stage) =>
                    stage.objectives.map((o) => <li key={stage.id + o.id}>{o.description}</li>),
                  )}
                </ul>
              </article>
            )
          );
        })()}
    </section>
  );
}
