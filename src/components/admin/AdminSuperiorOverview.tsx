import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ANDROID_LAYERS,
  type AndroidAtlasIndex,
  type AndroidAtlasRegion,
  type AndroidLayer,
  type AndroidMarker,
  type AndroidPoint,
} from "@/game/world/androidOverviewTypes";
import "./android-superior.css";

const BrowserOverview = lazy(() =>
  import("./AdminWorldOverview").then((module) => ({ default: module.AdminWorldOverview })),
);
const layers = Object.keys(ANDROID_LAYERS) as AndroidLayer[];
const initialLayers = layers.filter((layer) =>
  ["boss", "spawn", "quest", "objective", "npc", "dungeon", "capital", "town", "secret"].includes(
    layer,
  ),
);
const fmt = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });

function loadAtlas<T>(token: string, signal: AbortSignal, land = ""): Promise<T> {
  const query = land ? `?land=${encodeURIComponent(land)}` : "";
  return fetch("/ws/world/android-superior" + query, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal,
  }).then((response) => {
    if (!response.ok) throw Error(`Atlas Androida jest niedostępny (HTTP ${response.status}).`);
    return response.json() as Promise<T>;
  });
}

export default function AdminSuperiorOverview({ token }: { token: string }) {
  const [source, setSource] = useState<"android" | "browser">("android");
  return (
    <>
      <nav className="ki-android-atlas-switch" aria-label="Wersja świata">
        <button
          type="button"
          onClick={() => setSource("android")}
          aria-pressed={source === "android"}
        >
          Android · Godot
        </button>
        <button
          type="button"
          onClick={() => setSource("browser")}
          aria-pressed={source === "browser"}
        >
          Przeglądarka · Phaser
        </button>
      </nav>
      {source === "android" ? (
        <AndroidAtlas token={token} />
      ) : (
        <Suspense fallback={<p>Wczytywanie atlasu przeglądarki…</p>}>
          <BrowserOverview />
        </Suspense>
      )}
    </>
  );
}

function AndroidAtlas({ token }: { token: string }) {
  const [index, setIndex] = useState<AndroidAtlasIndex | null>(null);
  const [land, setLand] = useState("");
  const [region, setRegion] = useState<AndroidAtlasRegion | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [enabled, setEnabled] = useState(initialLayers);
  const [roads, setRoads] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AndroidMarker | null>(null);
  const [questId, setQuestId] = useState("");
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<AndroidPoint | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setError("");
    setIndex(null);
    loadAtlas<AndroidAtlasIndex>(token, abort.signal)
      .then(setIndex)
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure.message);
      });
    return () => abort.abort();
  }, [token, attempt]);

  useEffect(() => {
    if (!land) return;
    const abort = new AbortController();
    setError("");
    setRegion(null);
    loadAtlas<AndroidAtlasRegion>(token, abort.signal, land)
      .then(setRegion)
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure.message);
      });
    return () => abort.abort();
  }, [token, land, attempt]);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pl");
    return (region?.points ?? []).filter(
      (p) =>
        enabled.includes(p.kind) &&
        (!needle || `${p.id} ${p.title} ${p.detail}`.toLocaleLowerCase("pl").includes(needle)),
    );
  }, [enabled, query, region]);

  const pointIndex = useMemo(() => new Map((region?.points ?? []).map((p) => [p.id, p])), [region]);
  const counts = useMemo(() => {
    const result = new Map<AndroidLayer, number>();
    for (const point of region?.points ?? [])
      result.set(point.kind, (result.get(point.kind) ?? 0) + 1);
    return result;
  }, [region]);
  const quest = region?.quests.find((q) => q.id === questId);
  const changeLand = (id: string, search = "") => {
    setLand(id);
    setRegion(null);
    setSelected(null);
    setQuestId("");
    setQuery(search);
    setPage(0);
    setZoom(1);
    setCenter(null);
  };
  const showPoint = (p: AndroidMarker) => {
    setSelected(p);
    setCenter(p.position);
    if (p.questId) setQuestId(p.questId);
  };
  const toggleLayer = (layer: AndroidLayer) => {
    setEnabled((old) =>
      old.includes(layer) ? old.filter((value) => value !== layer) : [...old, layer],
    );
    setPage(0);
  };
  const span = region ? region.size / zoom : 1;
  const origin = (axis: 0 | 1) =>
    Math.min(
      (region?.size ?? 1) - span,
      Math.max(0, (center?.[axis] ?? (region?.size ?? 1) / 2) - span / 2),
    );
  const order = [...matches].sort((a, b) => layers.indexOf(b.kind) - layers.indexOf(a.kind));
  const view = order
    .slice()
    .reverse()
    .slice(page * 60, (page + 1) * 60);
  return (
    <section className="ki-android-atlas" aria-label="Świat Superior w Androidzie">
      <header>
        <div>
          <h2>Świat Superior</h2>
          <p>
            {index
              ? `Android · aktualizacja ${index.version} · ${new Date(index.createdAt).toLocaleDateString("pl-PL", { timeZone: "UTC" })}`
              : "Android · Godot"}
          </p>
        </div>
        {index && (
          <label>
            Obszar
            <select value={land} onChange={(event) => changeLand(event.target.value)}>
              <option value="">Cała planeta</option>
              {index.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {error && (
        <p className="ki-android-atlas-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Ponów
          </button>
        </p>
      )}
      {!error && (!index || (land && !region)) && <p role="status">Wczytywanie danych Androida…</p>}
      {index && !land && (
        <div className="ki-android-planet">
          <svg
            viewBox={`0 0 ${index.width} ${index.height}`}
            aria-label="Kontury planety z atlasu Godota"
          >
            <image href={index.image} width={index.width} height={index.height} />
            {index.regions.map((r) => (
              <g key={r.id}>
                {r.islandPin ? (
                  <circle
                    cx={r.islandPin[0]}
                    cy={r.islandPin[1]}
                    r={19}
                    fill="#073746"
                    stroke="#98eff0"
                    strokeWidth={4}
                    onClick={() => changeLand(r.id)}
                  >
                    <title>{r.name}</title>
                  </circle>
                ) : (
                  <>
                    {r.outline.map((p, i) => {
                      const next = r.outline[(i + 1) % r.outline.length];
                      if (!next || Math.abs(p[0] - next[0]) > 800) return null;
                      return (
                        <line
                          key={i}
                          x1={p[0]}
                          y1={p[1]}
                          x2={next[0]}
                          y2={next[1]}
                          stroke="#ffe4ae"
                          strokeOpacity={0.62}
                          strokeWidth={2}
                        />
                      );
                    })}
                    <text
                      className="ki-android-atlas-continent"
                      x={r.label.x}
                      y={Math.min(index.height - 32, r.label.y)}
                      onClick={() => changeLand(r.id)}
                    >
                      {r.name}
                    </text>
                  </>
                )}
              </g>
            ))}
            {index.bosses.map((boss) => (
              <g
                className="ki-android-atlas-planet-boss"
                key={boss.id}
                transform={`translate(${boss.position[0]} ${boss.position[1]})`}
                onClick={() => changeLand(boss.land, boss.id)}
              >
                <path
                  d="M 0 -16 L 16 0 L 0 16 L -16 0 Z"
                  fill="#f66a59"
                  stroke="#240e12"
                  strokeWidth={4}
                >
                  <title>{boss.title}</title>
                </path>
              </g>
            ))}
          </svg>
          <div className="ki-android-region-links">
            {index.regions.map((r) => (
              <button type="button" key={r.id} onClick={() => changeLand(r.id)}>
                {r.name}
              </button>
            ))}
          </div>
          <details>
            <summary>Aktywni bossowie ({index.bosses.length})</summary>
            <div className="ki-android-region-links">
              {index.bosses.map((boss) => (
                <button type="button" key={boss.id} onClick={() => changeLand(boss.land, boss.id)}>
                  {boss.title}
                </button>
              ))}
            </div>
          </details>
          <details>
            <summary>Bossowie w przygotowaniu ({index.pendingBosses.length})</summary>
            <p>Modele bez aktywnych aren w tej aktualizacji Androida.</p>
            <ul>
              {index.pendingBosses.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {region && land === region.id && (
        <>
          <div className="ki-android-atlas-toolbar">
            <label>
              Szukaj punktu{" "}
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Nazwa, ID, potwór, quest…"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={roads}
                onChange={(event) => setRoads(event.target.checked)}
              />{" "}
              Drogi
            </label>
            <button
              type="button"
              disabled={zoom <= 1}
              onClick={() => setZoom((z) => z / 2)}
              aria-label="Oddal"
            >
              −
            </button>
            <button
              type="button"
              disabled={zoom >= 16}
              onClick={() => setZoom((z) => z * 2)}
              aria-label="Przybliż"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setCenter(null);
              }}
            >
              Cały obszar
            </button>
          </div>
          <div className="ki-android-atlas-layers" aria-label="Warstwy mapy">
            {layers
              .filter((k) => counts.has(k))
              .map((k) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={enabled.includes(k)}
                  onClick={() => toggleLayer(k)}
                >
                  <span style={{ color: ANDROID_LAYERS[k][1] }}>{ANDROID_LAYERS[k][2]}</span>{" "}
                  {ANDROID_LAYERS[k][0]} {counts.get(k)}
                </button>
              ))}
          </div>
          <div className="ki-android-atlas-content">
            <div>
              <svg
                className="ki-android-land"
                data-testid="android-superior-map"
                viewBox={`${origin(0)} ${origin(1)} ${span} ${span}`}
                aria-label={`Mapa terenu ${index?.regions.find((row) => row.id === land)?.name ?? land}`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setCenter([
                    origin(0) + ((event.clientX - rect.left) / rect.width) * span,
                    origin(1) + ((event.clientY - rect.top) / rect.height) * span,
                  ]);
                }}
              >
                <image href={region.image} width={region.size} height={region.size} />
                {roads &&
                  region.roads.map((road, i) => (
                    <polyline
                      key={i}
                      points={road.points.map((p) => p.join(",")).join(" ")}
                      className={`android-road android-road-${road.tier}`}
                    />
                  ))}
                {order.map((p) => (
                  <g
                    key={p.id}
                    transform={`translate(${p.position[0]} ${p.position[1]})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      showPoint(p);
                    }}
                  >
                    {(p.kind === "capital" || selected?.id === p.id) && p.radius && (
                      <circle r={p.radius} fill={ANDROID_LAYERS[p.kind][1]} fillOpacity=".13" />
                    )}
                    <circle
                      r={span / (p.kind === "scenery" ? 405 : p.kind === "spawn" ? 195 : 106)}
                      fill={ANDROID_LAYERS[p.kind][1]}
                      stroke={selected?.id === p.id ? "white" : "#17222b"}
                      strokeWidth={span / 450}
                    >
                      <title>{p.title}</title>
                    </circle>
                  </g>
                ))}
                {selected && (
                  <circle
                    cx={selected.position[0]}
                    cy={selected.position[1]}
                    r={span / 77}
                    fill="none"
                    stroke="white"
                    strokeWidth={span / 290}
                    pointerEvents="none"
                  />
                )}
              </svg>
              {region.procedural && <small>Podkład odtworzony z algorytmu wyspy w Godocie.</small>}
            </div>
            <aside>
              {selected && <MarkerDetails point={selected} />}
              <label>
                Zadania w krainie
                <select value={questId} onChange={(e) => setQuestId(e.target.value)}>
                  <option value="">Wybierz zadanie · {region.quests.length}</option>
                  {region.quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.id} · {q.title}
                    </option>
                  ))}
                </select>
              </label>
              {quest && (
                <section className="ki-android-atlas-selection">
                  <strong>
                    {quest.title} · poz. {quest.level}
                  </strong>
                  <p>{quest.summary}</p>
                  <p>
                    {quest.active
                      ? `Zleca ${quest.giver}`
                      : "Pozycja z katalogu · wyłączona w tej aktualizacji"}
                  </p>
                  {quest.sourceLand !== land && (
                    <button
                      type="button"
                      onClick={() => {
                        changeLand(quest.sourceLand);
                        setQuestId(quest.id);
                      }}
                    >
                      Kraina zlecenia ·{" "}
                      {index?.regions.find((entry) => entry.id === quest.sourceLand)?.name}
                    </button>
                  )}
                  {quest.giverPoints.map((id) => (
                    <PointLink key={id} marker={pointIndex.get(id)} select={showPoint} />
                  ))}
                  <ol>
                    {quest.objectives.map((o) => (
                      <li key={o.id}>
                        {o.title}
                        {o.refs.length === 0 && <small> · brak pozycji w tej krainie</small>}
                        {o.refs.length > 0 && (
                          <details>
                            <summary>Punkty ({o.refs.length})</summary>
                            {o.refs.map((id) => (
                              <PointLink key={id} marker={pointIndex.get(id)} select={showPoint} />
                            ))}
                          </details>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <div className="ki-android-atlas-list" aria-label="Wyniki wyszukiwania">
                <strong>Widoczne punkty · {matches.length}</strong>
                {view.map((p) => (
                  <PointLink key={p.id} marker={p} select={showPoint} />
                ))}
                {matches.length === 0 && <p>Brak punktów dla wybranych filtrów.</p>}
              </div>
              <div className="ki-android-atlas-pages">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  Wstecz
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * 60 >= matches.length}
                >
                  Dalej
                </button>
              </div>
              {region.unmapped.length > 0 && (
                <details>
                  <summary>
                    Pozycje katalogowe bez współrzędnych Godota ({region.unmapped.length})
                  </summary>
                  <ul>
                    {region.unmapped.map((p) => (
                      <li key={p.id}>
                        <strong>{p.title}</strong> · {p.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function PointLink({
  marker,
  select,
}: {
  marker: AndroidMarker | undefined;
  select: (point: AndroidMarker) => void;
}) {
  if (!marker) return null;
  const [, color, glyph] = ANDROID_LAYERS[marker.kind];
  return (
    <button className="ki-android-atlas-point" type="button" onClick={() => select(marker)}>
      <span style={{ color }} aria-hidden="true">
        {glyph}
      </span>{" "}
      {marker.title}
    </button>
  );
}

function MarkerDetails({ point }: { point: AndroidMarker }) {
  return (
    <section className="ki-android-atlas-selection" aria-label="Szczegóły punktu">
      <h3>{point.title}</h3>
      <p>
        {ANDROID_LAYERS[point.kind][0]}
        {point.level === undefined ? "" : ` · poz. ${point.level}`}
      </p>
      <dl>
        <dt>Identyfikator</dt>
        <dd>{point.id}</dd>
        <dt>Pozycja Godot</dt>
        <dd>
          X {fmt(point.position[0])} · Z {fmt(point.position[1])}
        </dd>
        {point.arena && (
          <>
            <dt>Arena</dt>
            <dd>{point.arena}</dd>
          </>
        )}
        {point.radius !== undefined && (
          <>
            <dt>Promień</dt>
            <dd>{fmt(point.radius)}</dd>
          </>
        )}
        {point.stats && (
          <>
            <dt>Statystyki</dt>
            <dd>
              {fmt(point.stats.hp)} HP · {point.stats.atk} ATK · {point.stats.def} DEF ·{" "}
              {point.stats.xp} PD
            </dd>
          </>
        )}
        {point.gold !== undefined && (
          <>
            <dt>Złoto</dt>
            <dd>{fmt(point.gold)}</dd>
          </>
        )}
        {point.item && (
          <>
            <dt>Przedmiot</dt>
            <dd>{point.item}</dd>
          </>
        )}
      </dl>
      {point.detail && <p>{point.detail}</p>}
      {point.eventSpawn && (
        <p>
          Po aktywacji · {point.eventSpawnCount} × {point.eventSpawn}
        </p>
      )}
      {point.loot && point.loot.length > 0 && (
        <details>
          <summary>Łup bossa</summary>
          <ul>
            {point.loot.map((item) => (
              <li key={item.itemId}>
                {item.itemName} · {item.chancePercent}%
              </li>
            ))}
          </ul>
        </details>
      )}
      {point.grid && (
        <details>
          <summary>Plan podziemia</summary>
          <pre>
            {point.grid
              .map((row, z) =>
                [...row]
                  .map((cell, x) =>
                    point.entryCell?.[0] === x && point.entryCell[1] === z
                      ? "E"
                      : point.exitCell?.[0] === x && point.exitCell[1] === z
                        ? "X"
                        : cell,
                  )
                  .join(""),
              )
              .join("\n")}
          </pre>
          <small>E · wejście, X · wyjście</small>
        </details>
      )}
    </section>
  );
}
