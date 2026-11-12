import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyAdminWorldOverrides,
  readAdminWorldOverrides,
  type AdminWorldOverrides,
} from "@/game/world/adminWorldStore";
import { fetchPublishedWorld } from "@/game/world/worldOverridesClient";
import { cityRoom } from "@/game/city/room";
import type { BuildingId } from "@/game/city/types";
import type { Obstacle } from "@/game/movement";
import { OverviewCanvas, type Camera } from "./world-overview/OverviewCanvas";
import {
  LAYERS,
  matches,
  overviewCatalog,
  questEntries,
  visibleChunks,
  roomKey,
  type Entry,
  type LandData,
  type Layer,
  type Scope,
} from "./world-overview/model";
import {
  loadOverview,
  loadScenery,
  jsonFile,
  OVERVIEW_BASE,
  OVERVIEW_INDEX,
} from "./world-overview/loader";
import { PointFacts } from "./world-overview/PointFacts";
import "./world-overview/overview.css";

const DEFAULT_CAMERA: Camera = { x: 0.5, y: 0.5, zoom: 1 };
const INITIAL_LAYERS = Object.fromEntries(
  Object.keys(LAYERS).map((k) => [k, !["collision", "scenery", "resources"].includes(k)]),
) as Record<Layer, boolean>;
const statusName = { runtime: "W grze", data: "Dane / plan", unresolved: "Brak pozycji" };
const fmt = (n: number) => Math.round(n).toLocaleString("pl-PL");
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read-only administrator view: no publication, mutation, save access or gameplay commands. */
export function AdminWorldOverview() {
  const [mode, setMode] = useState<"published" | "canonical" | "draft">("published"),
    [revision, setRevision] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<AdminWorldOverrides>(emptyAdminWorldOverrides),
    [lands, setLands] = useState<LandData[]>([]);
  const [progress, setProgress] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<Scope>({ land: "planet" }),
    [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA),
    [layers, setLayers] = useState(INITIAL_LAYERS);
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState(""),
    [quest, setQuest] = useState(""),
    [plans, setPlans] = useState(true),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Entry | null>(null),
    [panel, setPanel] = useState<"map" | "unmapped">("map"),
    [drawn, setDrawn] = useState(0);
  const [bounds, setBounds] = useState<Obstacle>({ x: 0, y: 0, width: 2000, height: 1000 }),
    [scenery, setScenery] = useState<Entry[]>([]),
    [sceneryError, setSceneryError] = useState("");
  const [minLevel, setMinLevel] = useState(1),
    [maxLevel, setMaxLevel] = useState(40);
  const artHashes = useRef<Record<string, string> | null>(null),
    sceneryCache = useRef(new Map<string, Entry[]>());
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setLands([]);
    setProgress(0);
    setSelected(null);
    setScenery([]);
    sceneryCache.current.clear();
    void (async () => {
      let next: AdminWorldOverrides;
      if (mode === "published") {
        const result = await fetchPublishedWorld(abort.signal);
        next = result.data;
        if (!abort.signal.aborted) setRevision(result.revision);
      } else {
        next = mode === "draft" ? readAdminWorldOverrides() : emptyAdminWorldOverrides();
        if (!abort.signal.aborted) setRevision(null);
      }
      const data = await loadOverview(next, abort.signal, (n) => {
        if (!abort.signal.aborted) setProgress(n);
      });
      if (!abort.signal.aborted) {
        setOverrides(next);
        setLands(data);
        setLoading(false);
      }
    })().catch((e) => {
      if (!abort.signal.aborted) {
        setError(e instanceof Error ? e.message : "Nie można odczytać świata.");
        setLoading(false);
      }
    });
    return () => abort.abort();
  }, [mode, attempt]);
  const land = lands.find((l) => l.info.id === scope.land);
  const joined = useMemo(() => questEntries(lands, overrides), [lands, overrides]);
  const anchors = useMemo(() => lands.flatMap((l) => l.entries), [lands]);
  const allEntries = useMemo(
    () => [...lands.flatMap((l) => l.entries), ...joined.entries],
    [lands, joined.entries],
  );
  const filtered = useMemo(
    () =>
      allEntries.filter(
        (e) =>
          (scope.land === "planet" || e.land === scope.land) &&
          (!scope.room || e.room === scope.room) &&
          (plans || e.status === "runtime") &&
          layers[e.layer] &&
          matches(e, query) &&
          (!kind || e.kind === kind || e.layer !== "spawns") &&
          (e.layer !== "spawns" || ((e.level ?? 1) >= minLevel && (e.level ?? 1) <= maxLevel)) &&
          (!quest || e.layer !== "quests" || e.sourceId === quest) &&
          (e.layer !== "quests" ||
            quest ||
            (e.details as { target?: { type?: string } }).target?.type !== "combat"),
      ),
    [allEntries, scope, plans, layers, query, kind, minLevel, maxLevel, quest],
  );
  const mapEntries = useMemo(
    () => [
      ...filtered,
      ...scenery.filter(
        (e) => layers.scenery && (plans || e.status === "runtime") && matches(e, query),
      ),
    ],
    [filtered, scenery, layers.scenery, query, plans],
  );
  const changeScope = useCallback((next: Scope) => {
    setScope(next);
    if (next.room) setQuery("");
    setCamera(DEFAULT_CAMERA);
    setPage(0);
    setScenery([]);
    sceneryCache.current.clear();
  }, []);
  const choose = useCallback(
    (e: Entry) => {
      setSelected(e);
      setPanel("map");
      const targetLand = lands.find((l) => l.info.id === e.land);
      if (!targetLand) return;
      setScope({ land: e.land, ...(e.room ? { room: e.room } : {}) });
      setScenery([]);
      const dimensions = e.room ? cityRoom(e.building!, targetLand.info.affinity) : targetLand.info;
      setCamera({ x: e.x / dimensions.width, y: e.y / dimensions.height, zoom: e.room ? 1.3 : 14 });
    },
    [lands],
  );
  const onBounds = useCallback(
    (next: Obstacle) =>
      setBounds((old) =>
        Object.keys(next).every((k) => old[k as keyof Obstacle] === next[k as keyof Obstacle])
          ? old
          : next,
      ),
    [],
  );
  const chunkKey =
    land && !scope.room && layers.scenery
      ? visibleChunks(bounds, land.info.width, land.info.height)
          .map((p) => p.x + "-" + p.y)
          .join(",")
      : "";
  useEffect(() => {
    const abort = new AbortController();
    setSceneryError("");
    if (!land || !chunkKey || scope.room) {
      setScenery([]);
      sceneryCache.current.clear();
      return () => abort.abort();
    }
    const needed = chunkKey.split(",");
    for (const k of sceneryCache.current.keys())
      if (!needed.includes(k)) sceneryCache.current.delete(k);
    setScenery([...sceneryCache.current.values()].flat());
    const timer = setTimeout(
      () =>
        void (async () => {
          const hashes =
            artHashes.current ??
            (await jsonFile<Record<string, string>>(
              OVERVIEW_BASE + "/art/manifest.json",
              abort.signal,
            ));
          artHashes.current = hashes;
          const pending = needed.filter((k) => !sceneryCache.current.has(k));
          const worker = async () => {
            while (pending.length && !abort.signal.aborted) {
              const key = pending.shift()!,
                [x, y] = key.split("-").map(Number);
              const objects = await loadScenery(land, x!, y!, abort.signal, hashes);
              if (!abort.signal.aborted) {
                sceneryCache.current.set(key, objects);
                setScenery([...sceneryCache.current.values()].flat());
              }
            }
          };
          await Promise.all([worker(), worker()]);
        })().catch((e) => {
          if (!abort.signal.aborted)
            setSceneryError(e instanceof Error ? e.message : "Błąd dekoracji.");
        }),
      200,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [land, chunkKey, scope.room]);
  useEffect(() => setPage(0), [query, kind, quest, plans, minLevel, maxLevel, layers]);
  const totalSpawns = allEntries.filter((e) => e.layer === "spawns").length,
    totalNpcs = allEntries.filter((e) => e.layer === "npcs").length;
  const currentQuest = joined.quests.find((q) => q.id === quest);
  const selectionRelated = selected
    ? allEntries
        .filter((e) => e.layer === "quests")
        .filter((e) => e.related?.includes(selected.id))
        .map((e) => e.sourceId)
        .filter((id, i, a) => a.indexOf(id) === i)
    : [];
  return (
    <section className="ki-world-overview" aria-label="Świat — przegląd">
      <header className="ki-overview-header">
        <div>
          <span className="ki-overview-eyebrow">ATLAS ADMINISTRATORA · SUPERIOR V2</span>
          <h2>Świat — przegląd</h2>
          <p>Cała planeta. Każdy punkt. Wszystkie sekrety.</p>
        </div>
        <label>
          Źródło danych
          <select
            aria-label="Źródło danych świata"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="published">Gra — opublikowane na serwerze</option>
            <option value="canonical">Dane bazowe z repozytorium</option>
            <option value="draft">Lokalny szkic edytora</option>
          </select>
        </label>
      </header>
      <div className="ki-overview-stats">
        <span>
          <b>{lands.length}/10</b> lądów
        </span>
        <span>
          <b>{fmt(totalSpawns)}</b> punktów odrodzenia
        </span>
        <span>
          <b>{fmt(totalNpcs)}</b> pozycji NPC
        </span>
        <span>
          <b>{joined.quests.length}</b> questów V2 · 3 wstępne
        </span>
        <span>
          <b>{allEntries.filter((e) => e.layer === "secrets").length}</b> sekretów
        </span>
        <span className="ki-overview-source">
          {mode === "published"
            ? `Serwer · rewizja ${revision ?? "…"}`
            : mode === "draft"
              ? "Szkic lokalny · nieopublikowany"
              : "Bazowa zawartość V2"}
        </span>
      </div>
      {loading && (
        <p role="status" className="ki-overview-status">
          Odczyt i sprawdzanie danych świata… {progress}/10 lądów
        </p>
      )}
      {error && (
        <div role="alert" className="ki-overview-error">
          <p>{error} Wybierz inne źródło danych lub ponów odczyt.</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Ponów odczyt świata</button>
        </div>
      )}
      <div className="ki-overview-layout">
        <aside className="ki-overview-sidebar">
          <label>
            Szukaj na całym świecie
            <input
              aria-label="Szukaj na mapie świata"
              placeholder="NPC, potwór, quest, ID, zasób…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Ląd
            <select
              aria-label="Ląd na mapie"
              value={scope.land}
              onChange={(e) => changeScope({ land: e.target.value })}
            >
              <option value="planet">Cała planeta Superior</option>
              {(lands.length ? lands.map((l) => l.info) : OVERVIEW_INDEX.features).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Potwór
            <select
              aria-label="Gatunek potwora"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Wszystkie gatunki</option>
              {overviewCatalog.monsters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · poz. {m.level}
                </option>
              ))}
            </select>
          </label>
          <div className="ki-overview-levels">
            <label>
              Poziom od
              <input
                aria-label="Poziom potwora od"
                type="number"
                min={1}
                max={40}
                value={minLevel}
                onChange={(e) => setMinLevel(Number(e.target.value))}
              />
            </label>
            <label>
              do
              <input
                aria-label="Poziom potwora do"
                type="number"
                min={1}
                max={40}
                value={maxLevel}
                onChange={(e) => setMaxLevel(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Quest
            <select
              aria-label="Quest na mapie"
              value={quest}
              onChange={(e) => {
                setQuest(e.target.value);
                setLayers((l) => ({ ...l, quests: true }));
              }}
            >
              <option value="">Wszystkie questy — miejsca i zleceniodawcy</option>
              {Object.entries(overviewCatalog.tutorialQuests).map(([id, name]) => (
                <option key={id} value={"tutorial:" + id}>
                  {name} · zadanie wstępne
                </option>
              ))}
              {joined.quests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id} · {q.title}
                  {q.playableInCurrentRuntime ? "" : " · plan"}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="ki-overview-layers">
            <legend>Warstwy i legenda</legend>
            {(Object.entries(LAYERS) as [Layer, (typeof LAYERS)[Layer]][]).map(([key, l]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={(e) => setLayers((old) => ({ ...old, [key]: e.target.checked }))}
                />
                <i style={{ color: l.color }} aria-hidden="true">
                  {l.symbol}
                </i>
                {l.name}
                <small>
                  {key === "scenery"
                    ? scenery.length
                    : key === "collision"
                      ? ""
                      : allEntries.filter((e) => e.layer === key).length}
                </small>
              </label>
            ))}
          </fieldset>
          <label className="ki-overview-plan-toggle">
            <input type="checkbox" checked={plans} onChange={(e) => setPlans(e.target.checked)} />
            Pokaż też zaprojektowane / niepodłączone
          </label>
          <p className="ki-overview-note">
            Pełny znacznik: element gry. Przygaszony: dane lub plan. Spawny oznaczają miejsca
            odradzania, nie liczbę żywych potworów.
          </p>
        </aside>
        <div className="ki-overview-main">
          <nav className="ki-overview-toolbar" aria-label="Nawigacja przeglądu">
            <button onClick={() => changeScope({ land: "planet" })}>◎ Planeta</button>
            {land && (
              <button onClick={() => changeScope({ land: land.info.id })}>{land.info.name}</button>
            )}
            {scope.room && <span>Wnętrze · {scope.room}</span>}
            <span className="ki-overview-spacer" />
            <button
              aria-label="Oddal mapę"
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(1, c.zoom / 1.6) }))}
            >
              −
            </button>
            <button
              aria-label="Przybliż mapę"
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(160, c.zoom * 1.6) }))}
            >
              +
            </button>
            <button onClick={() => setCamera(DEFAULT_CAMERA)}>Dopasuj</button>
            <button
              onClick={() =>
                download("superior-v2-przeglad.json", {
                  world: "superior-v2",
                  coordinateSystem:
                    "land-local world units; room entries use room-local units, not latitude/longitude",
                  source: mode,
                  revision,
                  scope,
                  entries: mapEntries.map(({ search, ...e }) => e),
                  unmapped: joined.unmapped,
                })
              }
            >
              Eksport JSON
            </button>
          </nav>
          <div className="ki-overview-panel-tabs" role="tablist" aria-label="Widok przeglądu">
            <button role="tab" aria-selected={panel === "map"} onClick={() => setPanel("map")}>
              Mapa szczegółowa
            </button>
            <button
              role="tab"
              aria-selected={panel === "unmapped"}
              onClick={() => setPanel("unmapped")}
            >
              Bez pozycji / katalog ({joined.unmapped.length})
            </button>
            <span>{fmt(drawn)} znaczników w kadrze</span>
          </div>
          {panel === "map" ? (
            <OverviewCanvas
              scope={scope}
              land={land}
              entries={mapEntries}
              anchors={anchors}
              layers={layers}
              selected={selected}
              camera={camera}
              onCamera={setCamera}
              onPick={choose}
              onBounds={onBounds}
              onMetrics={setDrawn}
            />
          ) : (
            <div className="ki-overview-unmapped">
              <h3>Jawne braki powiązań</h3>
              <p>
                Nie przypisujemy tym elementom wymyślonych współrzędnych. Quest może mieć część
                celów powiązaną z mapą i część bez wiązania.
              </p>
              {joined.unmapped.map((u, i) => (
                <p key={i}>
                  <b>{u.quest}</b> · {u.target}
                  <br />
                  {u.description}
                </p>
              ))}
              <h3>Bossowie bez rozmieszczenia w świecie</h3>
              {overviewCatalog.bosses.map((b) => (
                <details key={b.id}>
                  <summary>
                    {b.name} · poziom {b.level}
                  </summary>
                  <pre>{JSON.stringify(b, null, 2)}</pre>
                </details>
              ))}
              <h3>Drogi fabularne i ich sekrety — katalog bez geometrii V2</h3>
              {overviewCatalog.roads.map((r) => (
                <details key={r.id}>
                  <summary>
                    {r.name} · {r.category}
                  </summary>
                  <pre>{JSON.stringify(r, null, 2)}</pre>
                </details>
              ))}
              <h3>Wydarzenia — katalog</h3>
              {overviewCatalog.events.map((e) => (
                <details key={e.id}>
                  <summary>
                    {e.name} · {e.implementationStatus}
                  </summary>
                  <pre>{JSON.stringify(e, null, 2)}</pre>
                </details>
              ))}
              <p>
                Przedmioty: {overviewCatalog.items.length} · receptury:{" "}
                {overviewCatalog.recipes.length} · dialogi:{" "}
                {Object.keys(overviewCatalog.dialogues).length}. Statystyki i łupy powiązane z
                potworami są w szczegółach punktów; pełny katalog pozostaje w „Świat i zawartość”.
              </p>
            </div>
          )}
          <div className="ki-overview-map-footer">
            <span>
              Przeciągnij, aby przesunąć · kółko / dwa palce: zbliżenie · klawiatura: strzałki, +,
              −, 0
            </span>
            <span>
              {mode === "published" ? "Definicje świata serwera" : "Podgląd danych"} · odczyt
            </span>
          </div>
          {land?.source.biomeNames && (
            <p className="ki-overview-note">Biomy: {land.source.biomeNames.join(" · ")}</p>
          )}
          {layers.scenery && (
            <p className="ki-overview-note" role="status">
              {scope.land === "planet" || !chunkKey
                ? "Wybierz ląd i zbliż mapę, aby odczytać dekoracje (maksymalnie 12 fragmentów naraz)."
                : `Dekoracje: ${scenery.length} obiektów w ${chunkKey.split(",").length} fragmentach. Widoczne są zapisane obiekty paczek oprawy. Renderer może je przerzedzać i dodawać roślinność proceduralną; ta warstwa nie jest podglądem klatki gry.`}
            </p>
          )}
          {sceneryError && <p role="alert">{sceneryError}</p>}
          {currentQuest && (
            <article className="ki-overview-quest">
              <h3>{currentQuest.title}</h3>
              <p>{currentQuest.summary}</p>
              <p>
                Poziom {currentQuest.recommendedLevel} · XP {currentQuest.reward.xp} · monety{" "}
                {currentQuest.reward.coins} ·{" "}
                {currentQuest.playableInCurrentRuntime
                  ? "Dostępny silnik zadania"
                  : "Zaprojektowane; ograniczenia runtime"}
              </p>
              <details>
                <summary>Wszystkie etapy, warunki i nagrody</summary>
                <pre>{JSON.stringify(currentQuest, null, 2)}</pre>
              </details>
            </article>
          )}
          <div className="ki-overview-bottom">
            <section aria-label="Wyniki przeglądu świata" className="ki-overview-results">
              <h3>
                Indeks punktów <small>{fmt(mapEntries.length)}</small>
              </h3>
              {mapEntries.slice(page * 40, (page + 1) * 40).map((e) => (
                <button
                  key={e.id}
                  data-entry-layer={e.layer}
                  data-entry-id={e.sourceId}
                  aria-pressed={selected?.id === e.id}
                  onClick={() => choose(e)}
                >
                  <i style={{ color: LAYERS[e.layer].color }}>{LAYERS[e.layer].symbol}</i>
                  <span>
                    <strong>{e.name}</strong>
                    <small>
                      {e.land} · {fmt(e.x)}, {fmt(e.y)}
                      {e.room ? " · wnętrze" : ""} · {statusName[e.status]}
                    </small>
                  </span>
                </button>
              ))}
              {!mapEntries.length && !loading && <p>Brak punktów dla wybranych filtrów.</p>}
              <div className="ki-overview-pagination">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Poprzednie
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(mapEntries.length / 40))}
                </span>
                <button
                  disabled={(page + 1) * 40 >= mapEntries.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Następne
                </button>
              </div>
            </section>
            <article className="ki-overview-detail" aria-label="Szczegóły punktu">
              {selected ? (
                <>
                  <span className="ki-overview-eyebrow">
                    {LAYERS[selected.layer].name} · {statusName[selected.status]}
                  </span>
                  <h3>{selected.name}</h3>
                  <dl>
                    <dt>Identyfikator</dt>
                    <dd>{selected.sourceId}</dd>
                    <dt>Pozycja</dt>
                    <dd>
                      {selected.land} · X {fmt(selected.x)} / Y {fmt(selected.y)}
                      {selected.room ? ` · wnętrze ${selected.room}` : ""}
                    </dd>
                    <dt>Źródło</dt>
                    <dd>{selected.source}</dd>
                  </dl>
                  {selected.layer === "buildings" && selected.building && !selected.room && (
                    <button
                      onClick={() =>
                        changeScope({
                          land: selected.land,
                          room: roomKey(selected.town!, selected.building!),
                        })
                      }
                    >
                      Zobacz wnętrze budynku
                    </button>
                  )}
                  {selectionRelated.length > 0 && (
                    <p>
                      Powiązane questy:{" "}
                      {selectionRelated.map((q) => (
                        <button key={q} onClick={() => setQuest(q)}>
                          {q}
                        </button>
                      ))}
                    </p>
                  )}
                  <PointFacts entry={selected} />
                  <details>
                    <summary>Pełne dane punktu</summary>
                    <pre>{JSON.stringify(selected.details, null, 2)}</pre>
                  </details>
                  <button onClick={() => download(selected.sourceId + ".json", selected)}>
                    Pobierz dane punktu
                  </button>
                </>
              ) : (
                <>
                  <span className="ki-overview-eyebrow">INSPEKTOR ŚWIATA</span>
                  <h3>Wybierz dowolny punkt</h3>
                  <p>
                    Kliknij znacznik lub pozycję indeksu. Tutaj znajdziesz dokładne współrzędne,
                    parametry, powiązania i ukryte warunki.
                  </p>
                  <p>Przegląd nie zmienia świata, zapisów postaci ani stanu questów.</p>
                </>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
