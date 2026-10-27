/**
 * Kompletny Panel Świata Administratora (World & Content Editor).
 *
 * Umożliwia przeglądanie na interaktywnej mapie i edytowanie w czasie rzeczywistym wszystkich
 * warstw świata Ki Legends:
 * 1. Planeta Superior (10 lądów, punkty przybycia, podgląd mapy z teleportem i stawiającym spawny kursorem)
 * 2. Kontynenty, Stolice, 6 Budynków Usługowych i NPC
 * 3. Miasta V2 (16 miast, strefy bezpieczne, granice bounds)
 * 4. Słynne Miejsca (16), Ukryte Miejsca (17), Szlaki (20) i Wydarzenia Świata (14)
 * 5. Bestiariusz (40 potworów) + Spawny na mapie (dodawanie, przesuwanie, usuwanie)
 * 6. Bossowie (8 bossów z fazami i atakami)
 * 7. Rasy i Drzewka Umiejętności (4 rasy × 29 węzłów)
 * 8. Przedmioty (4 bazowe + 177 katalogowych), Materiały (30) i Receptury Rzemiosła (94)
 * 9. Zadania V2 (106 zadań) i Dialogi NPC
 * 10. Eksport/Import JSON całego świata
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BOSS_CATALOG } from "@/game/bosses/catalog";
import { ALL_NPC_DIALOGUES } from "@/game/dialogue";
import { ITEM_CATALOG } from "@/game/items/catalog";
import { CRAFTING_RECIPES } from "@/game/items/recipes";
import { BRANCH_NAMES, KIT_NODES, RACE_BASE } from "@/game/kit";
import { MONSTER_BASE } from "@/game/monsters/base.generated";
import { MATERIALS, MATERIAL_IDS } from "@/game/monsters/materials";
import { ALL_QUESTS_V2 } from "@/game/quests/engine";
import { ITEMS, ITEM_IDS } from "@/game/session";
import {
  ADMIN_WORLD_STORAGE_KEY,
  applyAdminWorldOverridesToRuntime,
  countActiveOverrides,
  readAdminWorldOverrides,
  resetAdminWorldOverrides,
  subscribeAdminWorld,
  writeAdminWorldOverrides,
  type AdminWorldOverrides,
} from "@/game/world/adminWorldStore";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { WORLD_BASE, WORLD_INDEX } from "@/game/world/generated/worldVersion";
import { RACES, RACE_IDS, WORLD_IDS, type RaceId, type WorldId } from "@/game/world/races";
import { WORLDS } from "@/game/world/worlds";
import {
  ALL_CITIES_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_HIDDEN_PLACES_V2,
  ALL_ROADS_V2,
  ALL_WORLD_EVENTS_V2,
  type AdventureRoad,
} from "@/game/worlds";

const AdminWorldMap = lazy(() =>
  import("./AdminWorldMap").then((m) => ({ default: m.AdminWorldMap })),
);

export type WorldEditorTab =
  | "worldmap"
  | "map"
  | "continents"
  | "cities"
  | "places"
  | "monsters"
  | "bosses"
  | "races"
  | "items"
  | "quests"
  | "io";

export function AdminWorldEditor({
  compact = false,
  initialContinent = "verdant",
  playerPos,
  onTeleport,
  onSpawnLiveMonster,
  onSpawnLiveBoss,
}: {
  compact?: boolean;
  initialContinent?: WorldId;
  playerPos?: { x: number; y: number; feature?: string } | undefined;
  onTeleport?: ((x: number, y: number) => void) | undefined;
  onSpawnLiveMonster?: ((kind: string, x?: number, y?: number) => void) | undefined;
  onSpawnLiveBoss?: ((bossId: string, x?: number, y?: number) => void) | undefined;
}) {
  const [overrides, setOverrides] = useState<AdminWorldOverrides>(() => {
    const o = readAdminWorldOverrides();
    applyAdminWorldOverridesToRuntime(o);
    return o;
  });
  const [tab, setTab] = useState<WorldEditorTab>("map");
  const [continent, setContinent] = useState<WorldId>(initialContinent);
  const [feature, setFeature] = useState<FeatureId>(
    (playerPos?.feature as FeatureId) ?? initialContinent,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeAdminWorld(() => {
      setOverrides(readAdminWorldOverrides());
      setTick((t) => t + 1);
    });
  }, []);

  const saveOverrides = (
    updater: (draft: AdminWorldOverrides) => void,
    msg = "Zapisano zmiany w świecie.",
  ) => {
    const draft = structuredClone(readAdminWorldOverrides());
    updater(draft);
    const saved = writeAdminWorldOverrides(draft);
    setOverrides(saved);
    setStatus(msg);
  };

  const activeCount = countActiveOverrides(overrides);

  return (
    <div className={`ki-world-editor ${compact ? "is-compact" : ""}`}>
      <header className="ki-world-editor-header">
        <div>
          <strong>Edytor Świata gry (Master World Panel)</strong>
          <small style={{ marginLeft: 8 }}>
            Aktywne modyfikacje: <b>{activeCount}</b>
          </small>
        </div>
        <div className="ki-world-editor-bar">
          <label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>Kraina:</span>
            <select
              value={continent}
              onChange={(e) => {
                const next = e.target.value as WorldId;
                setContinent(next);
                setFeature(next);
              }}
            >
              {WORLD_IDS.map((w) => (
                <option key={w} value={w}>
                  {WORLDS[w].name} ({w})
                </option>
              ))}
            </select>
          </label>
          <input
            placeholder="Szukaj w zakładce…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Szukaj w edytorze świata"
            style={{ minWidth: 160 }}
          />
          {activeCount > 0 && (
            <button
              onClick={() => {
                resetAdminWorldOverrides();
                setStatus("Przywrócono kanoniczny stan całego świata.");
              }}
            >
              Resetuj świat do kanonu
            </button>
          )}
        </div>
      </header>

      {status && (
        <div className="ki-world-editor-status" role="status">
          <span>{status}</span>
          <button onClick={() => setStatus("")}>×</button>
        </div>
      )}

      <nav className="ki-admin-tabs" role="tablist" aria-label="Kategorie edytora świata">
        {(
          [
            ["worldmap", "Mapa świata 2D"],
            ["map", "Mapa i Spawny (10 lądów)"],
            ["continents", "Stolice, Budynki i NPC (4)"],
            ["cities", `Miasta V2 (${ALL_CITIES_V2.length})`],
            [
              "places",
              `Lokacje, Szlaki i Eventy (${ALL_FAMOUS_LOCATIONS_V2.length + ALL_HIDDEN_PLACES_V2.length + ALL_ROADS_V2.length + ALL_WORLD_EVENTS_V2.length})`,
            ],
            ["monsters", `Potwory (${MONSTER_BASE.length})`],
            ["bosses", `Bossowie (${BOSS_CATALOG.length})`],
            ["races", "Rasy i Drzewka (4×29)"],
            [
              "items",
              `Przedmioty i Rzemiosło (${ITEM_IDS.length + MATERIAL_IDS.length + ITEM_CATALOG.length + CRAFTING_RECIPES.length})`,
            ],
            ["quests", `Zadania i Dialogi (${ALL_QUESTS_V2.length})`],
            ["io", "Eksport / Import JSON"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "worldmap" && (
        <Suspense fallback={<p role="status">Wczytywanie mapy świata…</p>}>
          <AdminWorldMap overrides={overrides} />
        </Suspense>
      )}
      {tab === "map" && (
        <MapAndSpawnsSection
          feature={feature}
          onFeatureChange={(f) => {
            setFeature(f);
            const info = WORLD_INDEX.features.find((x) => x.id === f);
            if (info) setContinent(info.affinity as WorldId);
          }}
          overrides={overrides}
          saveOverrides={saveOverrides}
          playerPos={playerPos}
          onTeleport={onTeleport}
          onSpawnLiveMonster={onSpawnLiveMonster}
          onSpawnLiveBoss={onSpawnLiveBoss}
        />
      )}

      {tab === "continents" && (
        <ContinentsAndNpcsSection
          continent={continent}
          overrides={overrides}
          saveOverrides={saveOverrides}
          onTeleport={onTeleport}
        />
      )}

      {tab === "cities" && (
        <CitiesV2Section
          continent={continent}
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
          onTeleport={onTeleport}
        />
      )}

      {tab === "places" && (
        <PlacesRoadsEventsSection
          continent={continent}
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
          onTeleport={onTeleport}
        />
      )}

      {tab === "monsters" && (
        <MonstersSection
          continent={continent}
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
          onSpawnLiveMonster={onSpawnLiveMonster}
        />
      )}

      {tab === "bosses" && (
        <BossesSection
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
          onSpawnLiveBoss={onSpawnLiveBoss}
        />
      )}

      {tab === "races" && (
        <RacesAndSkillsSection query={query} overrides={overrides} saveOverrides={saveOverrides} />
      )}

      {tab === "items" && (
        <ItemsMaterialsRecipesSection
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
        />
      )}

      {tab === "quests" && (
        <QuestsAndDialoguesSection
          continent={continent}
          query={query}
          overrides={overrides}
          saveOverrides={saveOverrides}
        />
      )}

      {tab === "io" && (
        <ExportImportSection
          overrides={overrides}
          onImport={(parsed) => {
            writeAdminWorldOverrides(parsed);
            setOverrides(readAdminWorldOverrides());
            setStatus("Zaimportowano i zastosowano pakiet świata.");
          }}
          onReset={() => {
            resetAdminWorldOverrides();
            setOverrides(readAdminWorldOverrides());
            setStatus("Zresetowano wszystkie nadpisania świata.");
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. MAPA PLANETY SUPERIOR (10 LĄDÓW) + INTERAKTYWNY RADAR I SPAWNY          */
/* -------------------------------------------------------------------------- */
function MapAndSpawnsSection({
  feature,
  onFeatureChange,
  overrides,
  saveOverrides,
  playerPos,
  onTeleport,
  onSpawnLiveMonster,
  onSpawnLiveBoss,
}: {
  feature: FeatureId;
  onFeatureChange: (f: FeatureId) => void;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  playerPos?: { x: number; y: number; feature?: string } | undefined;
  onTeleport?: ((x: number, y: number) => void) | undefined;
  onSpawnLiveMonster?: ((kind: string, x?: number, y?: number) => void) | undefined;
  onSpawnLiveBoss?: ((bossId: string, x?: number, y?: number) => void) | undefined;
}) {
  const info = WORLD_INDEX.features.find((f) => f.id === feature) ?? WORLD_INDEX.features[0]!;
  const [clickMode, setClickMode] = useState<"inspect" | "teleport" | "spawn">("teleport");
  const [selectedMonster, setSelectedMonster] = useState<string>(
    MONSTER_BASE.find((m) => m.world === (info.affinity as WorldId))?.id ?? MONSTER_BASE[0]!.id,
  );
  const [selectedBoss, setSelectedBoss] = useState<string>(
    BOSS_CATALOG.find((b) => b.continent === (info.affinity as WorldId))?.id ?? BOSS_CATALOG[0]!.id,
  );
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({
    x: Math.round(info.arrival.x),
    y: Math.round(info.arrival.y),
  });
  const [newSpawnLeash, setNewSpawnLeash] = useState(420);
  const [newSpawnRespawn, setNewSpawnRespawn] = useState(25000);

  const cities = ALL_CITIES_V2.filter(
    (c) => c.continent === info.affinity && feature === info.affinity,
  );
  const famous = ALL_FAMOUS_LOCATIONS_V2.filter(
    (f) => f.continent === info.affinity && feature === info.affinity,
  );
  const hidden = ALL_HIDDEN_PLACES_V2.filter(
    (h) => h.continent === info.affinity && feature === info.affinity,
  );
  const events = ALL_WORLD_EVENTS_V2.filter(
    (e) => e.continent === info.affinity && feature === info.affinity,
  );
  const customSpawns = Object.values(overrides.customSpawns).filter(
    (s) => s.feature === feature && !s.deleted,
  );

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(Math.max(0, Math.min(info.width, rx * info.width)));
    const wy = Math.round(Math.max(0, Math.min(info.height, ry * info.height)));
    setCursorCoords({ x: wx, y: wy });
    if (clickMode === "teleport" && onTeleport) {
      onTeleport(wx, wy);
    } else if (clickMode === "spawn") {
      const id = `${feature}-admin-${Date.now().toString(36)}`;
      saveOverrides((d) => {
        d.customSpawns[id] = {
          id,
          feature,
          kind: selectedMonster,
          x: wx,
          y: wy,
          homeLeash: newSpawnLeash,
          respawnMs: newSpawnRespawn,
        };
      }, `Dodano stały spawn ${selectedMonster} na (${wx}, ${wy}).`);
      onSpawnLiveMonster?.(selectedMonster, wx, wy);
    }
  };

  return (
    <div className="ki-admin-grid">
      <section className="ki-admin-panel">
        <h3>10 Lądów Planety Superior</h3>
        <div className="ki-admin-list" style={{ maxHeight: 320 }}>
          {FEATURE_IDS.map((fid) => {
            const f = WORLD_INDEX.features.find((x) => x.id === fid)!;
            return (
              <button key={fid} aria-pressed={fid === feature} onClick={() => onFeatureChange(fid)}>
                <b>{f.name}</b> <small>({fid})</small>
                <br />
                <small>
                  Afinitet: {f.affinity} · {f.width}×{f.height} · Port: {Math.round(f.arrival.x)},{" "}
                  {Math.round(f.arrival.y)}
                </small>
              </button>
            );
          })}
        </div>

        <h4 style={{ marginTop: 14 }}>Edycja wybranego lądu ({info.id})</h4>
        <div className="ki-admin-fields">
          <label>
            Nazwa lądu
            <input
              value={info.name}
              onChange={(e) =>
                saveOverrides((d) => {
                  d.features[feature] = {
                    ...d.features[feature],
                    name: e.target.value,
                  };
                })
              }
            />
          </label>
          <label>
            Punkt przybycia X
            <input
              type="number"
              value={Math.round(info.arrival.x)}
              onChange={(e) =>
                saveOverrides((d) => {
                  d.features[feature] = {
                    ...d.features[feature],
                    arrival: {
                      x: Number(e.target.value) || 0,
                      y: info.arrival.y,
                    },
                  };
                })
              }
            />
          </label>
          <label>
            Punkt przybycia Y
            <input
              type="number"
              value={Math.round(info.arrival.y)}
              onChange={(e) =>
                saveOverrides((d) => {
                  d.features[feature] = {
                    ...d.features[feature],
                    arrival: {
                      x: info.arrival.x,
                      y: Number(e.target.value) || 0,
                    },
                  };
                })
              }
            />
          </label>
        </div>
        {onTeleport && (
          <div className="ki-account-actions">
            <button
              onClick={() => onTeleport(Math.round(info.arrival.x), Math.round(info.arrival.y))}
            >
              Teleportuj na przystań ({Math.round(info.arrival.x)}, {Math.round(info.arrival.y)})
            </button>
          </div>
        )}

        <h4 style={{ marginTop: 14 }}>Przywołanie na żywo / Stawianie spawnów</h4>
        <div className="ki-admin-fields">
          <label>
            Potwór (40 z bestiariusza)
            <select value={selectedMonster} onChange={(e) => setSelectedMonster(e.target.value)}>
              {MONSTER_BASE.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.world} p.{m.level}] {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Boss (8 z katalogu)
            <select value={selectedBoss} onChange={(e) => setSelectedBoss(e.target.value)}>
              {BOSS_CATALOG.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.continent} p.{b.level}] {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Promień smyczy (leash)
            <input
              type="number"
              value={newSpawnLeash}
              onChange={(e) => setNewSpawnLeash(Number(e.target.value) || 350)}
            />
          </label>
          <label>
            Respawn (ms)
            <input
              type="number"
              value={newSpawnRespawn}
              onChange={(e) => setNewSpawnRespawn(Math.max(1000, Number(e.target.value) || 25000))}
            />
          </label>
        </div>
        <div className="ki-account-actions">
          {onSpawnLiveMonster && (
            <button
              className="ki-account-primary"
              onClick={() => onSpawnLiveMonster(selectedMonster)}
            >
              Przywołaj potwora obok gracza
            </button>
          )}
          {onSpawnLiveBoss && (
            <button onClick={() => onSpawnLiveBoss(selectedBoss)}>
              Przywołaj bossa obok gracza
            </button>
          )}
          <button
            onClick={() => {
              const id = `${feature}-admin-${Date.now().toString(36)}`;
              saveOverrides((d) => {
                d.customSpawns[id] = {
                  id,
                  feature,
                  kind: selectedMonster,
                  x: cursorCoords.x,
                  y: cursorCoords.y,
                  homeLeash: newSpawnLeash,
                  respawnMs: newSpawnRespawn,
                };
              }, `Zapisano nowy spawn ${selectedMonster} na (${cursorCoords.x}, ${cursorCoords.y}).`);
            }}
          >
            Dodaj stały spawn na ({cursorCoords.x}, {cursorCoords.y})
          </button>
        </div>
      </section>

      <section className="ki-admin-panel">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong>
              Interaktywna mapa lądu: {info.name} ({info.width}×{info.height})
            </strong>
            <br />
            <small>
              Wskazany punkt:{" "}
              <b>
                {cursorCoords.x}, {cursorCoords.y}
              </b>
              {playerPos ? ` · Gracz: ${Math.round(playerPos.x)}, ${Math.round(playerPos.y)}` : ""}
            </small>
          </div>
          <div className="ki-admin-tabs" style={{ margin: 0 }}>
            <button
              aria-selected={clickMode === "teleport"}
              onClick={() => setClickMode("teleport")}
            >
              Klik = Teleport
            </button>
            <button aria-selected={clickMode === "spawn"} onClick={() => setClickMode("spawn")}>
              Klik = Postaw Spawn
            </button>
            <button aria-selected={clickMode === "inspect"} onClick={() => setClickMode("inspect")}>
              Klik = Pobierz X,Y
            </button>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: `${info.width} / ${info.height}`,
            maxHeight: "58vh",
            marginTop: 10,
            border: "1px solid #c8a35a",
            borderRadius: 8,
            overflow: "hidden",
            background: "#0b0f17",
          }}
        >
          <img
            src={`${WORLD_BASE}/${info.id}/minimap.svg`}
            alt={`Mapa ${info.name}`}
            style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }}
          />
          <svg
            viewBox={`0 0 ${info.width} ${info.height}`}
            onClick={handleMapClick}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              cursor: "crosshair",
            }}
          >
            {/* Miasta V2 i ich bezpieczne granice (bounds) */}
            {cities.map((c) => {
              const cx = Math.round(c.bounds.x + c.bounds.width / 2);
              const cy = Math.round(c.bounds.y + c.bounds.height / 2);
              return (
                <g key={c.id}>
                  <rect
                    x={c.bounds.x}
                    y={c.bounds.y}
                    width={c.bounds.width}
                    height={c.bounds.height}
                    fill={c.isSafeZone ? "rgba(74, 222, 128, 0.18)" : "rgba(248, 113, 113, 0.18)"}
                    stroke={c.isSafeZone ? "#4ade80" : "#f87171"}
                    strokeWidth={Math.max(120, info.width * 0.0025)}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={Math.max(350, info.width * 0.006)}
                    fill="#4ade80"
                    stroke="#052e16"
                    strokeWidth={80}
                  >
                    <title>{`Miasto: ${c.name} (${cx}, ${cy})`}</title>
                  </circle>
                </g>
              );
            })}

            {/* Słynne miejsca */}
            {famous.map((f) => (
              <circle
                key={f.id}
                cx={f.coordinates.x}
                cy={f.coordinates.y}
                r={Math.max(320, info.width * 0.005)}
                fill="#facc15"
                stroke="#422006"
                strokeWidth={70}
              >
                <title>{`Słynne miejsce: ${f.name} (${f.coordinates.x}, ${f.coordinates.y})`}</title>
              </circle>
            ))}

            {/* Ukryte miejsca */}
            {hidden.map((h) => (
              <circle
                key={h.id}
                cx={h.coordinates.x}
                cy={h.coordinates.y}
                r={Math.max(300, info.width * 0.0045)}
                fill="#c084fc"
                stroke="#3b0764"
                strokeWidth={70}
              >
                <title>{`Ukryte miejsce: ${h.name} (${h.coordinates.x}, ${h.coordinates.y})`}</title>
              </circle>
            ))}

            {/* Wydarzenia świata */}
            {events.map((ev) => (
              <circle
                key={ev.id}
                cx={ev.activationCondition.coordinates.x}
                cy={ev.activationCondition.coordinates.y}
                r={Math.max(ev.activationCondition.radius, info.width * 0.005)}
                fill="rgba(251, 146, 60, 0.25)"
                stroke="#fb923c"
                strokeWidth={70}
              >
                <title>{`Wydarzenie: ${ev.name} (${ev.activationCondition.coordinates.x}, ${ev.activationCondition.coordinates.y})`}</title>
              </circle>
            ))}

            {/* Spawny dodane przez administratora */}
            {customSpawns.map((sp) => (
              <circle
                key={sp.id}
                cx={sp.x}
                cy={sp.y}
                r={Math.max(280, info.width * 0.0045)}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={60}
              >
                <title>{`Spawn: ${sp.kind} (${sp.x}, ${sp.y})`}</title>
              </circle>
            ))}

            {/* Punkt przybycia */}
            <circle
              cx={info.arrival.x}
              cy={info.arrival.y}
              r={Math.max(360, info.width * 0.0055)}
              fill="#38bdf8"
              stroke="#082f49"
              strokeWidth={80}
            >
              <title>{`Port przybycia (${Math.round(info.arrival.x)}, ${Math.round(info.arrival.y)})`}</title>
            </circle>

            {/* Aktualny kursor */}
            <circle
              cx={cursorCoords.x}
              cy={cursorCoords.y}
              r={Math.max(420, info.width * 0.0065)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={100}
            />

            {/* Pozycja gracza */}
            {playerPos && (
              <circle
                cx={playerPos.x}
                cy={playerPos.y}
                r={Math.max(460, info.width * 0.007)}
                fill="#22d3ee"
                stroke="#ffffff"
                strokeWidth={110}
              >
                <title>{`Gracz (${Math.round(playerPos.x)}, ${Math.round(playerPos.y)})`}</title>
              </circle>
            )}
          </svg>
        </div>

        <p style={{ marginTop: 8 }}>
          <small>
            Legenda: <b style={{ color: "#4ade80" }}>● Miasta i strefy bezpieczne</b> ·{" "}
            <b style={{ color: "#facc15" }}>● Słynne miejsca</b> ·{" "}
            <b style={{ color: "#c084fc" }}>● Ukryte miejsca</b> ·{" "}
            <b style={{ color: "#fb923c" }}>● Wydarzenia</b> ·{" "}
            <b style={{ color: "#ef4444" }}>● Spawny Admina ({customSpawns.length})</b> ·{" "}
            <b style={{ color: "#22d3ee" }}>● Gracz</b>
          </small>
        </p>

        {customSpawns.length > 0 && (
          <details open>
            <summary>
              <b>Własne spawny na tym lądzie ({customSpawns.length})</b>
            </summary>
            <table className="ki-admin-table" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Potwór</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Leash</th>
                  <th>Respawn (ms)</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {customSpawns.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      <select
                        value={s.kind}
                        onChange={(e) =>
                          saveOverrides((d) => {
                            d.customSpawns[s.id] = { ...s, kind: e.target.value };
                          })
                        }
                      >
                        {MONSTER_BASE.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 85 }}
                        value={s.x}
                        onChange={(e) =>
                          saveOverrides((d) => {
                            d.customSpawns[s.id] = { ...s, x: Number(e.target.value) || 0 };
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 85 }}
                        value={s.y}
                        onChange={(e) =>
                          saveOverrides((d) => {
                            d.customSpawns[s.id] = { ...s, y: Number(e.target.value) || 0 };
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 75 }}
                        value={s.homeLeash}
                        onChange={(e) =>
                          saveOverrides((d) => {
                            d.customSpawns[s.id] = {
                              ...s,
                              homeLeash: Number(e.target.value) || 300,
                            };
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 90 }}
                        value={s.respawnMs}
                        onChange={(e) =>
                          saveOverrides((d) => {
                            d.customSpawns[s.id] = {
                              ...s,
                              respawnMs: Math.max(1000, Number(e.target.value) || 25000),
                            };
                          })
                        }
                      />
                    </td>
                    <td>
                      {onTeleport && <button onClick={() => onTeleport(s.x, s.y)}>Idź</button>}{" "}
                      <button
                        onClick={() =>
                          saveOverrides((d) => {
                            delete d.customSpawns[s.id];
                          }, "Usunięto spawn.")
                        }
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. STOLICE, 6 BUDYNKÓW USŁUGOWYCH I NPC (WORLDS)                            */
/* -------------------------------------------------------------------------- */
function ContinentsAndNpcsSection({
  continent,
  overrides,
  saveOverrides,
  onTeleport,
}: {
  continent: WorldId;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  onTeleport?: ((x: number, y: number) => void) | undefined;
}) {
  const world = WORLDS[continent];
  const ov = overrides.continents[continent] ?? {};

  return (
    <section className="ki-admin-panel">
      <h3>
        Kraina i Stolica: {world.name} ({world.settlement})
      </h3>
      <div className="ki-admin-fields">
        <label>
          Nazwa krainy
          <input
            value={world.name}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = { ...ov, name: e.target.value };
              })
            }
          />
        </label>
        <label>
          Główna osada (stolica)
          <input
            value={world.settlement}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = { ...ov, settlement: e.target.value };
              })
            }
          />
        </label>
        <label>
          Architektura
          <input
            value={world.architecture}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = { ...ov, architecture: e.target.value };
              })
            }
          />
        </label>
        <label>
          Nazwa polowania (quest)
          <input
            value={world.huntName}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = { ...ov, huntName: e.target.value };
              })
            }
          />
        </label>
        <label>
          Kolor tła
          <input
            value={world.background}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = { ...ov, background: e.target.value };
              })
            }
          />
        </label>
        <label>
          Spawn X
          <input
            type="number"
            value={Math.round(world.spawn.x)}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = {
                  ...ov,
                  spawn: { x: Number(e.target.value) || 0, y: world.spawn.y },
                };
              })
            }
          />
        </label>
        <label>
          Spawn Y
          <input
            type="number"
            value={Math.round(world.spawn.y)}
            onChange={(e) =>
              saveOverrides((d) => {
                d.continents[continent] = {
                  ...ov,
                  spawn: { x: world.spawn.x, y: Number(e.target.value) || 0 },
                };
              })
            }
          />
        </label>
      </div>
      <label>
        Opis krainy
        <input
          value={world.description}
          onChange={(e) =>
            saveOverrides((d) => {
              d.continents[continent] = { ...ov, description: e.target.value };
            })
          }
        />
      </label>

      {world.city && (
        <>
          <h4 style={{ marginTop: 16 }}>
            Budynki usługowe stolicy ({world.city.buildings.length}) — drzwi i opisy
          </h4>
          <table className="ki-admin-table">
            <thead>
              <tr>
                <th>Usługa (ID)</th>
                <th>Nazwa</th>
                <th>Dzielnica</th>
                <th>Drzwi X</th>
                <th>Drzwi Y</th>
                <th>Opis</th>
                <th>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {world.city.buildings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.id}</b>
                  </td>
                  <td>
                    <input
                      value={b.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          const prev = d.continents[continent] ?? {};
                          d.continents[continent] = {
                            ...prev,
                            buildings: {
                              ...prev.buildings,
                              [b.id]: { ...prev.buildings?.[b.id], name: e.target.value },
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={b.district}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          const prev = d.continents[continent] ?? {};
                          d.continents[continent] = {
                            ...prev,
                            buildings: {
                              ...prev.buildings,
                              [b.id]: { ...prev.buildings?.[b.id], district: e.target.value },
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 85 }}
                      value={Math.round(b.door.x)}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          const prev = d.continents[continent] ?? {};
                          d.continents[continent] = {
                            ...prev,
                            buildings: {
                              ...prev.buildings,
                              [b.id]: {
                                ...prev.buildings?.[b.id],
                                door: { x: Number(e.target.value) || 0, y: b.door.y },
                              },
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 85 }}
                      value={Math.round(b.door.y)}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          const prev = d.continents[continent] ?? {};
                          d.continents[continent] = {
                            ...prev,
                            buildings: {
                              ...prev.buildings,
                              [b.id]: {
                                ...prev.buildings?.[b.id],
                                door: { x: b.door.x, y: Number(e.target.value) || 0 },
                              },
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={b.description}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          const prev = d.continents[continent] ?? {};
                          d.continents[continent] = {
                            ...prev,
                            buildings: {
                              ...prev.buildings,
                              [b.id]: { ...prev.buildings?.[b.id], description: e.target.value },
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    {onTeleport && (
                      <button onClick={() => onTeleport(b.door.x, b.door.y)}>Teleport</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4 style={{ marginTop: 16 }}>Postacie niezależne (NPC) w stolicy ({world.npcs.length})</h4>
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Imię</th>
            <th>Rola</th>
            <th>Budynek</th>
            <th>X</th>
            <th>Y</th>
            <th>Odcień (tint)</th>
            <th>Dialog</th>
            <th>Akcja</th>
          </tr>
        </thead>
        <tbody>
          {world.npcs.map((n) => (
            <tr key={n.id}>
              <td>
                <b>{n.id}</b>
              </td>
              <td>
                <input
                  value={n.name}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], name: e.target.value },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={n.role}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], role: e.target.value },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>{n.building ?? "Plener"}</td>
              <td>
                <input
                  type="number"
                  style={{ width: 80 }}
                  value={Math.round(n.x)}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], x: Number(e.target.value) || 0 },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: 80 }}
                  value={Math.round(n.y)}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], y: Number(e.target.value) || 0 },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: 80 }}
                  value={n.tint}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], tint: Number(e.target.value) || 0 },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={n.dialogue ?? ""}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      const prev = d.continents[continent] ?? {};
                      d.continents[continent] = {
                        ...prev,
                        npcs: {
                          ...prev.npcs,
                          [n.id]: { ...prev.npcs?.[n.id], dialogue: e.target.value },
                        },
                      };
                    })
                  }
                />
              </td>
              <td>
                {onTeleport && !n.building && (
                  <button onClick={() => onTeleport(n.x, n.y)}>Teleport</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. MIASTA WORLD V2 (16 MIAST, BEZPIECZNE GRANICE BOUNDS)                    */
/* -------------------------------------------------------------------------- */
function CitiesV2Section({
  continent,
  query,
  overrides,
  saveOverrides,
  onTeleport,
}: {
  continent: WorldId;
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  onTeleport?: ((x: number, y: number) => void) | undefined;
}) {
  const q = query.toLowerCase();
  const list = ALL_CITIES_V2.filter(
    (c) =>
      c.continent === continent &&
      (c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)),
  );

  return (
    <section className="ki-admin-panel">
      <h3>Miasta World V2 ({list.length}) — Strefy Bezpieczne i Wymiary</h3>
      {list.map((city) => {
        const ov = overrides.citiesV2[city.id] ?? {};
        const cx = Math.round(city.bounds.x + city.bounds.width / 2);
        const cy = Math.round(city.bounds.y + city.bounds.height / 2);
        return (
          <article
            key={city.id}
            className="ki-admin-panel"
            style={{ marginBottom: 12, background: "#14111b" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b>{city.name}</b>{" "}
                <small>
                  ({city.id} · {city.role})
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {onTeleport && (
                  <button onClick={() => onTeleport(cx, cy)}>
                    Teleport do centrum ({cx}, {cy})
                  </button>
                )}
              </div>
            </div>
            <div className="ki-admin-fields" style={{ marginTop: 8 }}>
              <label>
                Nazwa miasta
                <input
                  value={city.name}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = { ...ov, name: e.target.value };
                    })
                  }
                />
              </label>
              <label>
                Atmosfera
                <input
                  value={city.atmosphere}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = { ...ov, atmosphere: e.target.value };
                    })
                  }
                />
              </label>
              <label>
                Strefa bezpieczna (isSafeZone)
                <select
                  value={city.isSafeZone ? "true" : "false"}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = { ...ov, isSafeZone: e.target.value === "true" };
                    })
                  }
                >
                  <option value="true">Tak (brak walki)</option>
                  <option value="false">Nie (walka dozwolona)</option>
                </select>
              </label>
              <label>
                Bounds X
                <input
                  type="number"
                  value={city.bounds.x}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = {
                        ...ov,
                        bounds: { ...city.bounds, x: Number(e.target.value) || 0 },
                      };
                    })
                  }
                />
              </label>
              <label>
                Bounds Y
                <input
                  type="number"
                  value={city.bounds.y}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = {
                        ...ov,
                        bounds: { ...city.bounds, y: Number(e.target.value) || 0 },
                      };
                    })
                  }
                />
              </label>
              <label>
                Szerokość (width)
                <input
                  type="number"
                  value={city.bounds.width}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = {
                        ...ov,
                        bounds: { ...city.bounds, width: Number(e.target.value) || 100 },
                      };
                    })
                  }
                />
              </label>
              <label>
                Wysokość (height)
                <input
                  type="number"
                  value={city.bounds.height}
                  onChange={(e) =>
                    saveOverrides((d) => {
                      d.citiesV2[city.id] = {
                        ...ov,
                        bounds: { ...city.bounds, height: Number(e.target.value) || 100 },
                      };
                    })
                  }
                />
              </label>
            </div>
            <label>
              Funkcja gospodarcza i historyczna
              <input
                value={city.economicAndHistoricalFunction}
                onChange={(e) =>
                  saveOverrides((d) => {
                    d.citiesV2[city.id] = {
                      ...ov,
                      economicAndHistoricalFunction: e.target.value,
                    };
                  })
                }
              />
            </label>
          </article>
        );
      })}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. SŁYNNE MIEJSCA, UKRYTE SEKRETY, SZLAKI I WYDARZENIA ŚWIATA               */
/* -------------------------------------------------------------------------- */
function PlacesRoadsEventsSection({
  continent,
  query,
  overrides,
  saveOverrides,
  onTeleport,
}: {
  continent: WorldId;
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  onTeleport?: ((x: number, y: number) => void) | undefined;
}) {
  const [sub, setSub] = useState<"famous" | "hidden" | "roads" | "events">("famous");
  const q = query.toLowerCase();

  return (
    <section className="ki-admin-panel">
      <div className="ki-admin-tabs">
        <button aria-selected={sub === "famous"} onClick={() => setSub("famous")}>
          Słynne Miejsca ({ALL_FAMOUS_LOCATIONS_V2.filter((x) => x.continent === continent).length})
        </button>
        <button aria-selected={sub === "hidden"} onClick={() => setSub("hidden")}>
          Ukryte Miejsca ({ALL_HIDDEN_PLACES_V2.filter((x) => x.continent === continent).length})
        </button>
        <button aria-selected={sub === "roads"} onClick={() => setSub("roads")}>
          Szlaki ({ALL_ROADS_V2.filter((x: AdventureRoad) => x.continent === continent).length})
        </button>
        <button aria-selected={sub === "events"} onClick={() => setSub("events")}>
          Wydarzenia ({ALL_WORLD_EVENTS_V2.filter((x) => x.continent === continent).length})
        </button>
      </div>

      {sub === "famous" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>X</th>
              <th>Y</th>
              <th>Historia i legenda</th>
              <th>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {ALL_FAMOUS_LOCATIONS_V2.filter(
              (f) => f.continent === continent && f.name.toLowerCase().includes(q),
            ).map((f) => {
              const ov = overrides.famousPlaces[f.id] ?? {};
              return (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td>
                    <input
                      value={f.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.famousPlaces[f.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={f.coordinates.x}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.famousPlaces[f.id] = { ...ov, x: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={f.coordinates.y}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.famousPlaces[f.id] = { ...ov, y: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={f.loreAndLegend}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.famousPlaces[f.id] = { ...ov, description: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    {onTeleport && (
                      <button onClick={() => onTeleport(f.coordinates.x, f.coordinates.y)}>
                        Teleport
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "hidden" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>X</th>
              <th>Y</th>
              <th>Promień</th>
              <th>Nagroda XP</th>
              <th>Monety</th>
              <th>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {ALL_HIDDEN_PLACES_V2.filter(
              (h) => h.continent === continent && h.name.toLowerCase().includes(q),
            ).map((h) => {
              const ov = overrides.hiddenPlaces[h.id] ?? {};
              return (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>
                    <input
                      value={h.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={h.coordinates.x}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = { ...ov, x: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={h.coordinates.y}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = { ...ov, y: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={h.radius}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = { ...ov, radius: Number(e.target.value) || 100 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={h.reward.xp}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = { ...ov, rewardXp: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={h.reward.coins}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.hiddenPlaces[h.id] = {
                            ...ov,
                            rewardCoins: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    {onTeleport && (
                      <button onClick={() => onTeleport(h.coordinates.x, h.coordinates.y)}>
                        Teleport
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "roads" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa szlaku</th>
              <th>Poziom zagrożenia (1–5)</th>
              <th>Potwory na szlaku (oddzielone przecinkiem)</th>
              <th>Opis</th>
            </tr>
          </thead>
          <tbody>
            {ALL_ROADS_V2.filter(
              (r: AdventureRoad) => r.continent === continent && r.name.toLowerCase().includes(q),
            ).map((r: AdventureRoad) => {
              const ov = overrides.roadsV2[r.id] ?? {};
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <input
                      value={r.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.roadsV2[r.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={r.dangerLevel}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.roadsV2[r.id] = {
                            ...ov,
                            dangerLevel: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={r.monsterIds.join(", ")}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.roadsV2[r.id] = {
                            ...ov,
                            monsterIds: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={r.description}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.roadsV2[r.id] = { ...ov, description: e.target.value };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "events" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>Poz. min</th>
              <th>X</th>
              <th>Y</th>
              <th>Promień</th>
              <th>XP</th>
              <th>Monety</th>
              <th>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {ALL_WORLD_EVENTS_V2.filter(
              (ev) => ev.continent === continent && ev.name.toLowerCase().includes(q),
            ).map((ev) => {
              const ov = overrides.worldEvents[ev.id] ?? {};
              return (
                <tr key={ev.id}>
                  <td>{ev.id}</td>
                  <td>
                    <input
                      value={ev.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={ev.activationCondition.minLevel}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, minLevel: Number(e.target.value) || 1 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 85 }}
                      value={ev.activationCondition.coordinates.x}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, x: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 85 }}
                      value={ev.activationCondition.coordinates.y}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, y: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={ev.activationCondition.radius}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, radius: Number(e.target.value) || 100 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={ev.reward.xp}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = { ...ov, rewardXp: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={ev.reward.coins}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.worldEvents[ev.id] = {
                            ...ov,
                            rewardCoins: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    {onTeleport && (
                      <button
                        onClick={() =>
                          onTeleport(
                            ev.activationCondition.coordinates.x,
                            ev.activationCondition.coordinates.y,
                          )
                        }
                      >
                        Teleport
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. BESTIARIUSZ — 40 POTWORÓW (PEŁNA EDYCJA STATYSTYK I ŁUPU)               */
/* -------------------------------------------------------------------------- */
function MonstersSection({
  continent,
  query,
  overrides,
  saveOverrides,
  onSpawnLiveMonster,
}: {
  continent: WorldId;
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  onSpawnLiveMonster?: ((kind: string, x?: number, y?: number) => void) | undefined;
}) {
  const [allWorlds, setAllWorlds] = useState(true);
  const q = query.toLowerCase();
  const rows = MONSTER_BASE.filter(
    (m) =>
      (allWorlds || m.world === continent) &&
      (m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)),
  );

  return (
    <section className="ki-admin-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h3>Bestiariusz — 40 Potworów ({rows.length})</h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
          <input
            type="checkbox"
            checked={allWorlds}
            onChange={(e) => setAllWorlds(e.target.checked)}
          />
          Pokaż wszystkie krainy
        </label>
      </div>
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>Nazwa (ID)</th>
            <th>Kraina</th>
            <th>Poz.</th>
            <th>HP</th>
            <th>ATK</th>
            <th>DEF</th>
            <th>XP</th>
            <th>Szybkość</th>
            <th>Zasięg</th>
            <th>Agro</th>
            <th>Rozmiar</th>
            <th>Łup</th>
            <th>Akcja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const ov = overrides.monsters[m.id] ?? {};
            return (
              <tr key={m.id}>
                <td>
                  <input
                    value={m.name}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, name: e.target.value };
                      })
                    }
                  />
                  <br />
                  <small>{m.id}</small>
                </td>
                <td>{m.world}</td>
                <td>
                  <input
                    type="number"
                    style={{ width: 58 }}
                    value={m.level}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, level: Number(e.target.value) || 1 };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 72 }}
                    value={m.hp}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, hp: Math.max(1, Number(e.target.value) || 1) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 64 }}
                    value={m.atk}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, atk: Math.max(1, Number(e.target.value) || 1) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 64 }}
                    value={m.def}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, def: Math.max(0, Number(e.target.value) || 0) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 68 }}
                    value={m.xp}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, xp: Math.max(0, Number(e.target.value) || 0) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.05"
                    style={{ width: 64 }}
                    value={m.speed}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = {
                          ...ov,
                          speed: Math.max(0, Number(e.target.value) || 0),
                        };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 68 }}
                    value={m.range}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = {
                          ...ov,
                          range: Math.max(10, Number(e.target.value) || 60),
                        };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 68 }}
                    value={m.agro}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = {
                          ...ov,
                          agro: Math.max(0, Number(e.target.value) || 200),
                        };
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    value={m.size}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = { ...ov, size: e.target.value as "S" | "M" | "L" };
                      })
                    }
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </select>
                </td>
                <td>
                  <input
                    value={m.loot.join(", ")}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.monsters[m.id] = {
                          ...ov,
                          loot: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        };
                      })
                    }
                  />
                </td>
                <td>
                  {onSpawnLiveMonster && (
                    <button onClick={() => onSpawnLiveMonster(m.id)}>Spawn</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. BOSSOWIE — 8 BOSSÓW ŚWIATOWYCH I LOKALNYCH                              */
/* -------------------------------------------------------------------------- */
function BossesSection({
  query,
  overrides,
  saveOverrides,
  onSpawnLiveBoss,
}: {
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
  onSpawnLiveBoss?: ((bossId: string, x?: number, y?: number) => void) | undefined;
}) {
  const q = query.toLowerCase();
  const list = BOSS_CATALOG.filter(
    (b) => b.name.toLowerCase().includes(q) || b.title.toLowerCase().includes(q),
  );

  return (
    <section className="ki-admin-panel">
      <h3>Bossowie ({list.length}) — Statystyki, Lokalizacje i Przywołanie</h3>
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>Boss</th>
            <th>Tytuł</th>
            <th>Kraina</th>
            <th>Poz.</th>
            <th>HP</th>
            <th>ATK</th>
            <th>DEF</th>
            <th>XP</th>
            <th>Szybkość</th>
            <th>Zasięg</th>
            <th>Lokalizacja</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {list.map((b) => {
            const ov = overrides.bosses[b.id] ?? {};
            return (
              <tr key={b.id}>
                <td>
                  <input
                    value={b.name}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, name: e.target.value };
                      })
                    }
                  />
                  <br />
                  <small>{b.id}</small>
                </td>
                <td>
                  <input
                    value={b.title}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, title: e.target.value };
                      })
                    }
                  />
                </td>
                <td>{b.continent}</td>
                <td>
                  <input
                    type="number"
                    style={{ width: 60 }}
                    value={b.level}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, level: Number(e.target.value) || 1 };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 80 }}
                    value={b.stats.hp}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, hp: Math.max(1, Number(e.target.value) || 1) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 65 }}
                    value={b.stats.atk}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, atk: Math.max(1, Number(e.target.value) || 1) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 65 }}
                    value={b.stats.def}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, def: Math.max(0, Number(e.target.value) || 0) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 75 }}
                    value={b.stats.xp}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, xp: Math.max(0, Number(e.target.value) || 0) };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.05"
                    style={{ width: 65 }}
                    value={b.speed}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, speed: Number(e.target.value) || 0 };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 68 }}
                    value={b.range}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, range: Number(e.target.value) || 100 };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={b.locationName}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.bosses[b.id] = { ...ov, locationName: e.target.value };
                      })
                    }
                  />
                </td>
                <td>
                  {onSpawnLiveBoss && (
                    <button onClick={() => onSpawnLiveBoss(b.id)}>Przywołaj</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. RASY, STATYSTYKI BAZOWE I DRZEWKA UMIEJĘTNOŚCI (4 × 29 WĘZŁÓW)          */
/* -------------------------------------------------------------------------- */
function RacesAndSkillsSection({
  query,
  overrides,
  saveOverrides,
}: {
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
}) {
  const [race, setRace] = useState<RaceId>("planetary");
  const rInfo = RACES[race];
  const rStats = RACE_BASE[race];
  const rov = overrides.races[race] ?? {};
  const q = query.toLowerCase();
  const nodes = KIT_NODES[race].filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      n.text.toLowerCase().includes(q),
  );

  return (
    <section className="ki-admin-panel">
      <div className="ki-admin-tabs">
        {RACE_IDS.map((rid) => (
          <button key={rid} aria-selected={race === rid} onClick={() => setRace(rid)}>
            {RACES[rid].name} ({rid})
          </button>
        ))}
      </div>

      <h3>
        Pochodzenie: {rInfo.name} · {rStats.role} ({rStats.mechanic})
      </h3>
      <div className="ki-admin-fields">
        <label>
          Nazwa rasy
          <input
            value={rInfo.name}
            onChange={(e) =>
              saveOverrides((d) => {
                d.races[race] = { ...rov, name: e.target.value };
              })
            }
          />
        </label>
        <label>
          Tytuł
          <input
            value={rInfo.title}
            onChange={(e) =>
              saveOverrides((d) => {
                d.races[race] = { ...rov, title: e.target.value };
              })
            }
          />
        </label>
        <label>
          Kolor akcentu
          <input
            value={rInfo.color}
            onChange={(e) =>
              saveOverrides((d) => {
                d.races[race] = { ...rov, color: e.target.value };
              })
            }
          />
        </label>
        {(
          [
            ["hp", "HP bazowe"],
            ["ki", "KI bazowe"],
            ["attack", "Atak bazowy"],
            ["defense", "Obrona bazowa"],
            ["speed", "Szybkość bazowa"],
            ["kiRegen", "Regen KI/s"],
            ["criticalChancePercent", "Szansa kryt. (%)"],
            ["attackIntervalMs", "Odstęp ataku (ms)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="0.1"
              value={rStats.base[key]}
              onChange={(e) =>
                saveOverrides((d) => {
                  d.races[race] = {
                    ...rov,
                    base: { ...rov.base, [key]: Number(e.target.value) || 0 },
                  };
                })
              }
            />
          </label>
        ))}
        {(
          [
            ["hp", "Przyrost HP / poz."],
            ["ki", "Przyrost KI / poz."],
            ["attack", "Przyrost ATK / poz."],
            ["defense", "Przyrost DEF / poz."],
          ] as const
        ).map(([key, label]) => (
          <label key={"pl-" + key}>
            {label}
            <input
              type="number"
              step="0.1"
              value={rStats.perLevel[key]}
              onChange={(e) =>
                saveOverrides((d) => {
                  d.races[race] = {
                    ...rov,
                    perLevel: { ...rov.perLevel, [key]: Number(e.target.value) || 0 },
                  };
                })
              }
            />
          </label>
        ))}
      </div>

      <h4 style={{ marginTop: 14 }}>
        Drzewko umiejętności ({nodes.length} węzłów · Gałęzie: A={BRANCH_NAMES[race].A}, B=
        {BRANCH_NAMES[race].B}, C={BRANCH_NAMES[race].C})
      </h4>
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>Węzeł</th>
            <th>Typ</th>
            <th>Nazwa</th>
            <th>Min. poz.</th>
            <th>Wymaga</th>
            <th>Opis działania</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const key = `${race}:${n.id}`;
            const nov = overrides.skillNodes[key] ?? {};
            return (
              <tr key={n.id}>
                <td>
                  <b>{n.id}</b>
                </td>
                <td>{n.type}</td>
                <td>
                  <input
                    value={n.name}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.skillNodes[key] = { ...nov, name: e.target.value };
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 60 }}
                    value={n.minLevel}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.skillNodes[key] = {
                          ...nov,
                          minLevel: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                        };
                      })
                    }
                  />
                </td>
                <td>
                  <small>{n.requires.join(", ") || "—"}</small>
                </td>
                <td>
                  <input
                    value={n.text}
                    onChange={(e) =>
                      saveOverrides((d) => {
                        d.skillNodes[key] = { ...nov, text: e.target.value };
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. PRZEDMIOTY, MATERIAŁY I RECEPTURY RZEMIOSŁA                             */
/* -------------------------------------------------------------------------- */
function ItemsMaterialsRecipesSection({
  query,
  overrides,
  saveOverrides,
}: {
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
}) {
  const [sub, setSub] = useState<"runtime" | "materials" | "catalog" | "recipes">("runtime");
  const q = query.toLowerCase();

  return (
    <section className="ki-admin-panel">
      <div className="ki-admin-tabs">
        <button aria-selected={sub === "runtime"} onClick={() => setSub("runtime")}>
          Przedmioty Bazowe ({ITEM_IDS.length})
        </button>
        <button aria-selected={sub === "materials"} onClick={() => setSub("materials")}>
          Materiały Łupu ({MATERIAL_IDS.length})
        </button>
        <button aria-selected={sub === "catalog"} onClick={() => setSub("catalog")}>
          Katalog Ekwipunku V2 ({ITEM_CATALOG.length})
        </button>
        <button aria-selected={sub === "recipes"} onClick={() => setSub("recipes")}>
          Receptury Rzemiosła ({CRAFTING_RECIPES.length})
        </button>
      </div>

      {sub === "runtime" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>Typ</th>
              <th>Atak</th>
              <th>Obrona</th>
              <th>Cena zakupu</th>
              <th>Cena skupu</th>
            </tr>
          </thead>
          <tbody>
            {ITEM_IDS.map((id) => {
              const it = ITEMS[id];
              const ov = overrides.runtimeItems[id] ?? {};
              return (
                <tr key={id}>
                  <td>
                    <b>{id}</b>
                  </td>
                  <td>
                    <input
                      value={it.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.runtimeItems[id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>{it.type}</td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={it.attack}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.runtimeItems[id] = { ...ov, attack: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={it.defense}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.runtimeItems[id] = { ...ov, defense: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={it.price}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.runtimeItems[id] = { ...ov, price: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={it.sell}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.runtimeItems[id] = { ...ov, sell: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "materials" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID materiału</th>
              <th>Nazwa</th>
              <th>Poziom</th>
              <th>Cena skupu</th>
            </tr>
          </thead>
          <tbody>
            {MATERIAL_IDS.filter(
              (id) => id.toLowerCase().includes(q) || MATERIALS[id]!.name.toLowerCase().includes(q),
            ).map((id) => {
              const mat = MATERIALS[id]!;
              const ov = overrides.materials[id] ?? {};
              return (
                <tr key={id}>
                  <td>
                    <b>{id}</b>
                  </td>
                  <td>
                    <input
                      value={mat.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.materials[id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={mat.level}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.materials[id] = { ...ov, level: Number(e.target.value) || 1 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={mat.sell}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.materials[id] = { ...ov, sell: Number(e.target.value) || 1 };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "catalog" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa</th>
              <th>Kategoria / Rzadkość</th>
              <th>Cena</th>
              <th>ATK Bonus</th>
              <th>DEF Bonus</th>
              <th>HP Bonus</th>
              <th>Opis</th>
            </tr>
          </thead>
          <tbody>
            {ITEM_CATALOG.filter(
              (it) => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q),
            ).map((it) => {
              const ov = overrides.catalogItems[it.id] ?? {};
              return (
                <tr key={it.id}>
                  <td>
                    <b>{it.id}</b>
                  </td>
                  <td>
                    <input
                      value={it.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    {it.category} · {it.rarity}
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={it.price}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = { ...ov, price: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={it.stats?.atkBonus ?? 0}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = {
                            ...ov,
                            atkBonus: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={it.stats?.defBonus ?? 0}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = {
                            ...ov,
                            defBonus: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={it.stats?.hpBonus ?? 0}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = {
                            ...ov,
                            hpBonus: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={it.description}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.catalogItems[it.id] = { ...ov, description: e.target.value };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "recipes" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nazwa receptury</th>
              <th>Stacja</th>
              <th>Wym. poz.</th>
              <th>Koszt monet</th>
              <th>Wynik (ID × szt.)</th>
              <th>Składniki</th>
            </tr>
          </thead>
          <tbody>
            {CRAFTING_RECIPES.filter(
              (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
            ).map((r) => {
              const ov = overrides.recipes[r.id] ?? {};
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <input
                      value={r.name}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.recipes[r.id] = { ...ov, name: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>{r.station}</td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 65 }}
                      value={r.requiredLevel}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.recipes[r.id] = { ...ov, requiredLevel: Number(e.target.value) || 1 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={r.craftingCostCoins}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.recipes[r.id] = {
                            ...ov,
                            craftingCostCoins: Number(e.target.value) || 0,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      style={{ width: 90 }}
                      value={r.resultItemId}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.recipes[r.id] = { ...ov, resultItemId: e.target.value };
                        })
                      }
                    />{" "}
                    ×{" "}
                    <input
                      type="number"
                      style={{ width: 55 }}
                      value={r.resultCount}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.recipes[r.id] = {
                            ...ov,
                            resultCount: Math.max(1, Number(e.target.value) || 1),
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <small>{r.ingredients.map((i) => `${i.itemId} ×${i.count}`).join(", ")}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. ZADANIA V2 (106 ZADAŃ) I DIALOGI NPC                                    */
/* -------------------------------------------------------------------------- */
function QuestsAndDialoguesSection({
  continent,
  query,
  overrides,
  saveOverrides,
}: {
  continent: WorldId;
  query: string;
  overrides: AdminWorldOverrides;
  saveOverrides: (fn: (d: AdminWorldOverrides) => void, msg?: string) => void;
}) {
  const [sub, setSub] = useState<"quests" | "dialogues">("quests");
  const [allContinents, setAllContinents] = useState(true);
  const q = query.toLowerCase();

  const quests = useMemo(
    () =>
      ALL_QUESTS_V2.filter(
        (x) =>
          (allContinents || x.continent === continent) &&
          (x.title.toLowerCase().includes(q) ||
            x.id.toLowerCase().includes(q) ||
            x.giverName.toLowerCase().includes(q)),
      ),
    [allContinents, continent, q],
  );

  const dialogues = useMemo(
    () =>
      Object.values(ALL_NPC_DIALOGUES).filter(
        (d) =>
          d.npcName.toLowerCase().includes(q) ||
          d.npcId.toLowerCase().includes(q) ||
          d.role.toLowerCase().includes(q),
      ),
    [q],
  );

  return (
    <section className="ki-admin-panel">
      <div className="ki-admin-tabs">
        <button aria-selected={sub === "quests"} onClick={() => setSub("quests")}>
          Zadania V2 ({quests.length})
        </button>
        <button aria-selected={sub === "dialogues"} onClick={() => setSub("dialogues")}>
          Dialogi NPC ({dialogues.length})
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={allContinents}
            onChange={(e) => setAllContinents(e.target.checked)}
          />
          Wszystkie krainy
        </label>
      </div>

      {sub === "quests" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tytuł zadania</th>
              <th>Kraina</th>
              <th>Poz.</th>
              <th>Zleceniodawca</th>
              <th>Nagroda XP</th>
              <th>Monety</th>
              <th>Streszczenie</th>
            </tr>
          </thead>
          <tbody>
            {quests.map((x) => {
              const ov = overrides.quests[x.id] ?? {};
              return (
                <tr key={x.id}>
                  <td>
                    <b>{x.id}</b>
                  </td>
                  <td>
                    <input
                      value={x.title}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = { ...ov, title: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>{x.continent}</td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 60 }}
                      value={x.recommendedLevel}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = {
                            ...ov,
                            recommendedLevel: Number(e.target.value) || 1,
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={x.giverName}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = { ...ov, giverName: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={x.reward.xp}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = { ...ov, rewardXp: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 75 }}
                      value={x.reward.coins ?? 0}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = { ...ov, rewardCoins: Number(e.target.value) || 0 };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={x.summary}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.quests[x.id] = { ...ov, summary: e.target.value };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {sub === "dialogues" && (
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>ID NPC</th>
              <th>Imię</th>
              <th>Rola</th>
              <th>Powitanie 1</th>
              <th>Plotka 1</th>
            </tr>
          </thead>
          <tbody>
            {dialogues.map((dlg) => {
              const ov = overrides.dialogues[dlg.npcId] ?? {};
              return (
                <tr key={dlg.npcId}>
                  <td>
                    <b>{dlg.npcId}</b>
                  </td>
                  <td>
                    <input
                      value={dlg.npcName}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.dialogues[dlg.npcId] = { ...ov, npcName: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={dlg.role}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.dialogues[dlg.npcId] = { ...ov, role: e.target.value };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={dlg.greetings[0]}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.dialogues[dlg.npcId] = {
                            ...ov,
                            greetings: [e.target.value, dlg.greetings[1], dlg.greetings[2]],
                          };
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={dlg.rumors[0]}
                      onChange={(e) =>
                        saveOverrides((d) => {
                          d.dialogues[dlg.npcId] = {
                            ...ov,
                            rumors: [e.target.value, dlg.rumors[1], dlg.rumors[2]],
                          };
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. EKSPORT / IMPORT PAKIETU ŚWIATA JSON                                   */
/* -------------------------------------------------------------------------- */
function ExportImportSection({
  overrides,
  onImport,
  onReset,
}: {
  overrides: AdminWorldOverrides;
  onImport: (data: AdminWorldOverrides) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(overrides, null, 2));
  const [err, setErr] = useState("");

  useEffect(() => {
    setText(JSON.stringify(overrides, null, 2));
  }, [overrides]);

  return (
    <section className="ki-admin-panel">
      <h3>Eksport / Import konfiguracji świata ({ADMIN_WORLD_STORAGE_KEY})</h3>
      <p>
        <small>
          Wszystkie zmiany wprowadzone w Edytorze Świata są zapisywane natychmiastowo w pamięci
          przeglądarki i stosowane w grze. Możesz skopiować poniższy JSON lub wkleić gotowy pakiet.
        </small>
      </p>
      {err && <p className="ki-account-error">{err}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="JSON konfiguracji świata"
        style={{ minHeight: 280 }}
      />
      <div className="ki-account-actions">
        <button
          className="ki-account-primary"
          onClick={() => {
            try {
              const parsed = JSON.parse(text) as AdminWorldOverrides;
              if (!parsed || typeof parsed !== "object") throw Error("Nieprawidłowy obiekt JSON");
              setErr("");
              onImport(parsed);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Błąd parsowania JSON");
            }
          }}
        >
          Zastosuj wklejony JSON
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(overrides, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ki-legends-world-overrides-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Pobierz plik .json
        </button>
        <button onClick={onReset}>Resetuj wszystko do oryginału</button>
      </div>
    </section>
  );
}
