import { useMemo, useRef, useState } from "react";
import {
  SUPERIOR_LIVE_WORLD,
  type SuperiorLandId,
  type SuperiorLabyrinth,
} from "@/game/world/superiorLiveWorld.generated";
import { ANDROID_GOALS_CATALOG } from "@/game/world/superiorGoalsCatalog";

type LayerKey =
  | "safe"
  | "roads"
  | "buildings"
  | "subbiomes"
  | "monsters"
  | "fauna"
  | "npcs"
  | "labyrinths"
  | "treasures";

type InspectorTab =
  "monsters" | "labyrinths" | "treasures" | "npcs" | "fauna" | "buildings" | "quests";

type SelectedPoint = {
  kind: string;
  title: string;
  subtitle: string;
  x?: number;
  z?: number;
  details: [string, string][];
  labyrinth?: SuperiorLabyrinth;
};

const LAND_META: Record<
  SuperiorLandId,
  { name: string; race: string; raceId: "legend" | "planetary" | "sage" | "android"; color: string }
> = {
  pyra: { name: "Pyra", race: "Legendy", raceId: "legend", color: "#ff7b3b" },
  verdant: { name: "Verdantia", race: "Planetarni", raceId: "planetary", color: "#4de27c" },
  aether: { name: "Aetheria", race: "Mędrcy", raceId: "sage", color: "#68d3ff" },
  nexus: { name: "Nexus-9", race: "Androidy", raceId: "android", color: "#2cf5ff" },
};

const LAYER_LABELS: [LayerKey, string, string][] = [
  ["safe", "Bezpieczna stolica (r = 250 m)", "#4eff98"],
  ["roads", "Drogi i trakty", "#f2dca5"],
  ["buildings", "Miasta i budynki", "#78d2ff"],
  ["subbiomes", "5 Sub-biomów", "#cbd5e1"],
  ["monsters", "Spawny potworów (10 stref / 38 mobów)", "#ff4d4f"],
  ["labyrinths", "Labirynty i wejścia (ukryte skarby)", "#c864ff"],
  ["treasures", "Ukryte skarby terenowe", "#ffd84a"],
  ["npcs", "NPC i Questy", "#ffe66d"],
  ["fauna", "Zwierzęta (Fauna)", "#5ce68a"],
];

const BAND_COLOR: Record<string, string> = {
  green: "#40e06e",
  gold: "#ffd444",
  orange: "#ff8a30",
  red: "#ff4448",
};

const GOAL_KIND_LABEL: Record<string, string> = {
  heritage: "Rozdział Dziedzictwa",
  development: "Cel Rozwoju Rasy",
  adventure: "Przygoda / Labirynt",
};

export function AdminSuperiorWorld() {
  const [landId, setLandId] = useState<SuperiorLandId>("pyra");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    safe: true,
    roads: true,
    buildings: true,
    subbiomes: true,
    monsters: true,
    fauna: true,
    npcs: true,
    labyrinths: true,
    treasures: true,
  });
  const [activeTab, setActiveTab] = useState<InspectorTab>("monsters");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedPoint | null>(null);

  const land = SUPERIOR_LIVE_WORLD[landId];
  const meta = LAND_META[landId];
  const ws = land.world_size;
  const half = ws * 0.5;

  const planetTotals = useMemo(() => {
    const all = Object.values(SUPERIOR_LIVE_WORLD);
    return {
      continents: all.length,
      buildings: all.reduce((s, c) => s + c.buildings.length, 0),
      expZones: all.reduce((s, c) => s + c.exp_zones.length, 0),
      monsters: all.reduce((s, c) => s + c.monsters.length, 0),
      fauna: all.reduce((s, c) => s + c.fauna.length, 0),
      npcs: all.reduce((s, c) => s + c.npcs.length, 0),
      labyrinths: all.reduce((s, c) => s + c.labyrinths.length, 0),
      labChests: all.reduce(
        (s, c) => s + c.labyrinths.reduce((ls, l) => ls + l.chests.length, 0),
        0,
      ),
      worldTreasures: all.reduce((s, c) => s + c.treasures.length, 0),
      props: all.reduce((s, c) => s + c.props_count, 0),
      quests: ANDROID_GOALS_CATALOG.length,
    };
  }, []);

  const landGoals = useMemo(
    () => ANDROID_GOALS_CATALOG.filter((g) => g.race === meta.raceId),
    [meta.raceId],
  );

  const w2svg = (wx: number, wz: number): [number, number] => [
    ((wx + half) / ws) * 1000,
    ((wz + half) / ws) * 1000,
  ];

  const distCap = (wx: number, wz: number) =>
    Math.round(Math.hypot(wx - land.capital_center[0], wz - land.capital_center[1]));

  const focusPoint = (pt: SelectedPoint) => {
    setSelected(pt);
    if (pt.x !== undefined && pt.z !== undefined) {
      const [sx, sy] = w2svg(pt.x, pt.z);
      const nextZ = Math.max(zoom, 2.2);
      setZoom(nextZ);
      setPan({ x: (500 - sx) * nextZ * 0.55, y: (500 - sy) * nextZ * 0.55 });
    }
  };

  const toggleLayer = (k: LayerKey) => setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  const q = query.trim().toLowerCase();

  return (
    <section className="ki-admin-panel" aria-label="Świat Superior — mapa rzeczywista 1:1">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Świat Superior — Rzeczywista Mapa i Spis Zawartości (1:1)</h2>
          <small style={{ opacity: 0.85 }}>
            Dane generowane bezpośrednio z żywego świata gry (`4096 × 4096 m` / kontynent): spawny
            potworów, zwierzęta, NPC, questy, labirynty, wejścia i wszystkie ukryte skarby.
          </small>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["pyra", "verdant", "aether", "nexus"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setLandId(id);
                setSelected(null);
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                fontWeight: 700,
                border: `2px solid ${landId === id ? LAND_META[id].color : "rgba(255,255,255,0.18)"}`,
                background: landId === id ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.3)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {LAND_META[id].name} ({LAND_META[id].race})
            </button>
          ))}
        </div>
      </div>

      {/* Global Planet Totals Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
          gap: 8,
          marginTop: 12,
          marginBottom: 14,
        }}
      >
        {[
          ["Kontynenty", `${planetTotals.continents} × 4096 m`],
          ["Strefy / Potwory", `${planetTotals.expZones} / ${planetTotals.monsters}`],
          ["Labirynty / Skrzynie", `${planetTotals.labyrinths} / ${planetTotals.labChests}`],
          ["Skarby terenowe", `${planetTotals.worldTreasures}`],
          ["Zwierzęta (Fauna)", `${planetTotals.fauna}`],
          ["NPC na świecie", `${planetTotals.npcs}`],
          ["Questy i Cele", `${planetTotals.quests}`],
          ["Obiekty biomów", `${planetTotals.props.toLocaleString("pl-PL")}`],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              background: "rgba(15, 23, 42, 0.72)",
              border: "1px solid rgba(255, 215, 128, 0.24)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.75 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffe59e" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Layer Toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {LAYER_LABELS.map(([key, label, color]) => (
          <label
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              cursor: "pointer",
              background: layers[key] ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.28)",
              border: `1px solid ${layers[key] ? color : "rgba(255,255,255,0.15)"}`,
            }}
          >
            <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                background: color,
                display: "inline-block",
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {/* Main Split: Interactive 1:1 Map + Right Inspector Panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(340px, 1.45fr) minmax(280px, 1fr)",
          gap: 14,
        }}
      >
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(255,215,128,0.35)",
            background: "#08121f",
          }}
        >
          <div
            style={{ position: "absolute", top: 10, left: 10, zIndex: 5, display: "flex", gap: 6 }}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(6, +(z * 1.35).toFixed(2)))}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z / 1.35).toFixed(2)))}
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset ({zoom.toFixed(1)}×)
            </button>
          </div>
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              maxHeight: 620,
              overflow: "hidden",
              cursor: dragging ? "grabbing" : "grab",
              userSelect: "none",
            }}
            onMouseDown={(e) => {
              setDragging(true);
              dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              setPan({
                x: dragStart.current.px + (e.clientX - dragStart.current.x),
                y: dragStart.current.py + (e.clientY - dragStart.current.y),
              });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onWheel={(e) => {
              e.preventDefault();
              setZoom((z) =>
                Math.max(1, Math.min(6, +(z * (e.deltaY < 0 ? 1.18 : 0.85)).toFixed(2))),
              );
            }}
          >
            <svg
              viewBox="0 0 1000 1000"
              style={{
                width: "100%",
                height: "100%",
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <image
                href={land.map_image}
                x="0"
                y="0"
                width="1000"
                height="1000"
                preserveAspectRatio="none"
              />

              {/* Roads */}
              {layers.roads &&
                land.roads.map((r, ri) => (
                  <polyline
                    key={ri}
                    fill="none"
                    stroke={r.tier === "highway" ? "#f8e3a2" : "#dfd0a0"}
                    strokeOpacity={r.tier === "highway" ? 0.82 : 0.55}
                    strokeWidth={r.tier === "highway" ? 2.4 : 1.3}
                    points={r.pts.map(([px, pz]) => w2svg(px, pz).join(",")).join(" ")}
                  />
                ))}

              {/* Safe Capital Circle */}
              {layers.safe &&
                (() => {
                  const [cx, cy] = w2svg(land.capital_center[0], land.capital_center[1]);
                  const sr = (land.safe_city_radius / ws) * 1000;
                  return (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={sr}
                        fill="rgba(78,255,152,0.16)"
                        stroke="#4eff98"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      <text
                        x={cx}
                        y={cy - sr - 6}
                        textAnchor="middle"
                        fill="#7dffb2"
                        fontSize="14"
                        fontWeight="700"
                        stroke="#000"
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        STOLICA (r={land.safe_city_radius}m • 0 mobów)
                      </text>
                    </g>
                  );
                })()}

              {/* Sub-biomes */}
              {layers.subbiomes &&
                land.sub_biomes.map((sb) => {
                  const [sx, sy] = w2svg(sb.x, sb.z);
                  return (
                    <text
                      key={sb.id}
                      x={sx}
                      y={sy}
                      textAnchor="middle"
                      fill="#dbeafe"
                      fillOpacity="0.82"
                      fontSize="13"
                      fontWeight="700"
                      stroke="#020617"
                      strokeWidth="3.5"
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {sb.name}
                    </text>
                  );
                })}

              {/* Monster Spawn Zones + Individual Monsters */}
              {layers.monsters &&
                land.exp_zones.map((ez) => {
                  const [zx, zy] = w2svg(ez.x, ez.z);
                  const zr = Math.max(18, (ez.radius / ws) * 1000);
                  const col = BAND_COLOR[ez.band] ?? "#ff4d4f";
                  return (
                    <g
                      key={ez.id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected({
                          kind: "Strefa spawnu potworów",
                          title: `#${ez.num} ${ez.monster_name} (Poz. ${ez.level})`,
                          subtitle: `${meta.name} • ${ez.count} osobników • promień ${ez.radius} m`,
                          x: ez.x,
                          z: ez.z,
                          details: [
                            ["ID strefy", ez.id],
                            ["Gatunek", `${ez.monster_name} (${ez.monster_id})`],
                            ["Poziom", String(ez.level)],
                            ["Liczebność stada", `${ez.count} szt.`],
                            ["Współrzędne", `x=${ez.x}, z=${ez.z}`],
                            ["Odległość od stolicy", `${distCap(ez.x, ez.z)} m`],
                          ],
                        })
                      }
                    >
                      <circle
                        cx={zx}
                        cy={zy}
                        r={zr}
                        fill={col}
                        fillOpacity="0.18"
                        stroke={col}
                        strokeWidth="2.4"
                      />
                      <circle cx={zx} cy={zy} r={10} fill="#111827" stroke={col} strokeWidth="2" />
                      <text
                        x={zx}
                        y={zy + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="11"
                        fontWeight="800"
                      >
                        {ez.num}
                      </text>
                    </g>
                  );
                })}

              {/* Buildings */}
              {layers.buildings &&
                land.buildings
                  .filter((b) => b.role !== "labyrinth" && b.role !== "prop")
                  .map((b) => {
                    const [bx, by] = w2svg(b.x, b.z);
                    const isCap = b.map_kind === "capital";
                    const isTown = b.map_kind === "town";
                    return (
                      <rect
                        key={b.id}
                        x={bx - (isCap ? 6 : isTown ? 5 : 3)}
                        y={by - (isCap ? 6 : isTown ? 5 : 3)}
                        width={isCap ? 12 : isTown ? 10 : 6}
                        height={isCap ? 12 : isTown ? 10 : 6}
                        fill={isCap ? "#ffe058" : isTown ? "#78d2ff" : "#fff2cd"}
                        stroke="#090d16"
                        strokeWidth="1.5"
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setSelected({
                            kind: isCap ? "Stolica" : isTown ? "Miasto / Warownia" : "Budynek",
                            title: b.title || b.id,
                            subtitle: `${b.role} • ${b.enterable ? "Wchodzalny (wnętrze)" : "Dekoracyjny"}`,
                            x: b.x,
                            z: b.z,
                            details: [
                              ["ID", b.id],
                              ["Typ", `${b.role} (${b.map_kind})`],
                              ["Wnętrze", b.enterable ? "Tak (wejście w grze)" : "Nie"],
                              ["Pozycja", `x=${b.x}, z=${b.z}`],
                              ["Odległość od stolicy", `${distCap(b.x, b.z)} m`],
                            ],
                          })
                        }
                      />
                    );
                  })}

              {/* Fauna */}
              {layers.fauna &&
                land.fauna.map((f, fi) => {
                  const [fx, fy] = w2svg(f.x, f.z);
                  return (
                    <circle
                      key={`f-${fi}`}
                      cx={fx}
                      cy={fy}
                      r={4}
                      fill="#5ce68a"
                      stroke="#052e16"
                      strokeWidth="1.2"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected({
                          kind: "Zwierzę (Fauna)",
                          title: f.name,
                          subtitle: `Kod: ${f.actor_id} • Patrol ${f.patrol_radius} m`,
                          x: f.x,
                          z: f.z,
                          details: [
                            ["Gatunek", `${f.name} (${f.actor_id})`],
                            ["Promień patrolu", `${f.patrol_radius} m`],
                            ["Pozycja", `x=${f.x}, z=${f.z}`],
                            ["Odległość od stolicy", `${distCap(f.x, f.z)} m`],
                          ],
                        })
                      }
                    />
                  );
                })}

              {/* NPCs */}
              {layers.npcs &&
                land.npcs.map((n, ni) => {
                  const [nx, ny] = w2svg(n.x, n.z);
                  return (
                    <circle
                      key={`n-${ni}`}
                      cx={nx}
                      cy={ny}
                      r={5.5}
                      fill={n.wilderness ? "#fb923c" : "#ffe66d"}
                      stroke="#1c1917"
                      strokeWidth="1.6"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected({
                          kind: n.wilderness ? "NPC Ekspedycji (Teren)" : "NPC Stolicy",
                          title: `${n.name} ${n.quest_mark}`,
                          subtitle: n.role,
                          x: n.x,
                          z: n.z,
                          details: [
                            ["Aktor", n.actor_id],
                            ["Rola", n.role],
                            ["Znacznik zadania", n.quest_mark || "Brak"],
                            ["Powiązany labirynt", n.labyrinth_id || "Stolica"],
                            ["Pozycja", `x=${n.x}, z=${n.z}`],
                          ],
                        })
                      }
                    />
                  );
                })}

              {/* Hidden World Treasures */}
              {layers.treasures &&
                land.treasures.map((tr) => {
                  const [tx, ty] = w2svg(tr.x, tr.z);
                  return (
                    <g
                      key={tr.id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected({
                          kind: "Ukryty skarb terenowy",
                          title: `★ ${tr.title}`,
                          subtitle: tr.lore,
                          x: tr.x,
                          z: tr.z,
                          details: [
                            ["ID", tr.id],
                            ["Nagroda", `+${tr.gold} zł • +${tr.xp} PD • przedmiot: ${tr.item_id}`],
                            ["Pozycja", `x=${tr.x}, z=${tr.z}`],
                            ["Odległość od stolicy", `${distCap(tr.x, tr.z)} m`],
                          ],
                        })
                      }
                    >
                      <circle
                        cx={tx}
                        cy={ty}
                        r={7}
                        fill="#ffd84a"
                        stroke="#422006"
                        strokeWidth="2"
                      />
                      <text
                        x={tx}
                        y={ty + 3.5}
                        textAnchor="middle"
                        fill="#422006"
                        fontSize="10"
                        fontWeight="900"
                      >
                        ★
                      </text>
                    </g>
                  );
                })}

              {/* Playable Labyrinths */}
              {layers.labyrinths &&
                land.labyrinths.map((lab) => {
                  const [lx, ly] = w2svg(lab.x, lab.z);
                  return (
                    <g
                      key={lab.id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelected({
                          kind: "Wejście do Labiryntu (Grywalne 15×15)",
                          title: `⚔ ${lab.title}`,
                          subtitle: `${lab.subtitle} • Poz. ${lab.level} • ${lab.chests.length} ukrytych skarbów`,
                          x: lab.x,
                          z: lab.z,
                          labyrinth: lab,
                          details: [
                            ["ID labiryntu", lab.id],
                            ["Wymiary", `${lab.width}×${lab.height} pól`],
                            [
                              "Ukryte skarby",
                              `${lab.chests.length} skrzynie (serwerowe claim_treasure)`,
                            ],
                            ["Strażnicy", `${lab.guardians.length} patrole`],
                            ["Pozycja wejścia", `x=${lab.x}, z=${lab.z}`],
                            ["Odległość od stolicy", `${distCap(lab.x, lab.z)} m`],
                          ],
                        })
                      }
                    >
                      <polygon
                        points={`${lx},${ly - 12} ${lx + 12},${ly} ${lx},${ly + 12} ${lx - 12},${ly}`}
                        fill="#a855f7"
                        stroke="#fde047"
                        strokeWidth="2.4"
                      />
                      <text
                        x={lx}
                        y={ly - 16}
                        textAnchor="middle"
                        fill="#f3e8ff"
                        fontSize="12"
                        fontWeight="800"
                        stroke="#000"
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        {lab.title}
                      </text>
                    </g>
                  );
                })}

              {/* Selected highlight ring */}
              {selected &&
                selected.x !== undefined &&
                selected.z !== undefined &&
                (() => {
                  const [sx, sy] = w2svg(selected.x, selected.z);
                  return (
                    <circle
                      cx={sx}
                      cy={sy}
                      r={19}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="3"
                      strokeDasharray="5 3"
                    />
                  );
                })()}
            </svg>
          </div>
        </div>

        {/* Right Detail Inspector */}
        <div
          style={{
            background: "rgba(10, 14, 24, 0.85)",
            border: "1px solid rgba(255,215,128,0.28)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0, color: "#ffe59e" }}>
            {selected ? selected.title : `${meta.name} — Inspekcja punktu`}
          </h3>
          {selected ? (
            <>
              <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>{selected.kind}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{selected.subtitle}</div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {selected.details.map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "5px 4px", opacity: 0.72 }}>{k}</td>
                      <td style={{ padding: "5px 4px", fontWeight: 600, textAlign: "right" }}>
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mini preview of actual 15x15 Labyrinth layout + hidden chests + guardians! */}
              {selected.labyrinth && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#e9d5ff" }}>
                    Rzeczywisty plan labiryntu ({selected.labyrinth.width}×
                    {selected.labyrinth.height}):
                  </div>
                  <svg
                    viewBox="0 0 150 150"
                    style={{
                      width: 180,
                      height: 180,
                      border: "1px solid #a855f7",
                      borderRadius: 6,
                      background: "#05070e",
                    }}
                  >
                    {selected.labyrinth.grid.map((row, ry) =>
                      row
                        .split("")
                        .map((ch, rx) => (
                          <rect
                            key={`${rx}-${ry}`}
                            x={rx * 10}
                            y={ry * 10}
                            width={10}
                            height={10}
                            fill={ch === "#" ? "#334155" : "#0f172a"}
                          />
                        )),
                    )}
                    <circle
                      cx={selected.labyrinth.spawn[0] * 10 + 5}
                      cy={selected.labyrinth.spawn[1] * 10 + 5}
                      r={3.5}
                      fill="#38bdf8"
                    />
                    {selected.labyrinth.chests.map((c) => (
                      <circle
                        key={c.id}
                        cx={c.tx * 10 + 5}
                        cy={c.ty * 10 + 5}
                        r={3.6}
                        fill="#facc15"
                      />
                    ))}
                    {selected.labyrinth.guardians.map((g) => (
                      <circle
                        key={g.id}
                        cx={g.tx * 10 + 5}
                        cy={g.ty * 10 + 5}
                        r={3.2}
                        fill="#ef4444"
                      />
                    ))}
                  </svg>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                    {selected.labyrinth.chests.map((c) => (
                      <li key={c.id}>
                        <b>{c.title}</b> ({c.tx},{c.ty}) — +{c.gold} zł, +{c.xp} PD,{" "}
                        <code>{c.item_id}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              <p>
                Kliknij dowolny punkt na mapie po lewej albo wiersz w tabelach poniżej, aby
                podejrzeć jego dokładne współrzędne, nagrody, spawny lub plan labiryntu.
              </p>
              <p>
                <b>Podsumowanie kontynentu {meta.name}:</b>
              </p>
              <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
                <li>
                  Skala:{" "}
                  <b>
                    {land.world_size} × {land.world_size} m
                  </b>{" "}
                  (bezpieczna stolica r = {land.safe_city_radius} m)
                </li>
                <li>
                  Spawny potworów:{" "}
                  <b>
                    {land.exp_zones.length} stref / {land.monsters.length} osobników
                  </b>
                </li>
                <li>
                  Labirynty: <b>{land.labyrinths.length}</b> (
                  {land.labyrinths.reduce((s, l) => s + l.chests.length, 0)} ukrytych skrzyń)
                </li>
                <li>
                  Ukryte skarby terenowe: <b>{land.treasures.length}</b>
                </li>
                <li>
                  Zwierzęta (fauna): <b>{land.fauna.length}</b> • NPC: <b>{land.npcs.length}</b>
                </li>
                <li>5 Sub-biomów: {land.sub_biomes.map((s) => s.name).join(", ")}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Searchable Full Directory Tabs */}
      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          {(
            [
              [
                "monsters",
                `Potwory / Spawny (${land.exp_zones.length} stref / ${land.monsters.length})`,
              ],
              ["labyrinths", `Labirynty (${land.labyrinths.length})`],
              ["treasures", `Ukryte skarby (${land.treasures.length})`],
              ["npcs", `NPC (${land.npcs.length})`],
              ["fauna", `Zwierzęta (${land.fauna.length})`],
              ["buildings", `Miasta i Budynki (${land.buildings.length})`],
              ["quests", `Questy i Cele (${landGoals.length})`],
            ] as [InspectorTab, string][]
          ).map(([tid, label]) => (
            <button
              key={tid}
              type="button"
              onClick={() => setActiveTab(tid)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: activeTab === tid ? 700 : 500,
                background: activeTab === tid ? "rgba(255,215,128,0.22)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${activeTab === tid ? "#ffd86b" : "rgba(255,255,255,0.14)"}`,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <input
            placeholder="Filtruj po nazwie / ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginLeft: "auto", minWidth: 200, padding: "6px 10px", borderRadius: 8 }}
          />
        </div>

        <div
          style={{
            maxHeight: 360,
            overflowY: "auto",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
          }}
        >
          {activeTab === "monsters" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>Strefa</th>
                  <th>Potwór</th>
                  <th>Poz.</th>
                  <th>Stado</th>
                  <th>Współrzędne</th>
                  <th>Odl. od stolicy</th>
                </tr>
              </thead>
              <tbody>
                {land.exp_zones
                  .filter(
                    (z) =>
                      !q ||
                      z.monster_name.toLowerCase().includes(q) ||
                      z.id.toLowerCase().includes(q),
                  )
                  .map((z) => (
                    <tr
                      key={z.id}
                      onClick={() =>
                        focusPoint({
                          kind: "Strefa spawnu potworów",
                          title: `#${z.num} ${z.monster_name} (Poz. ${z.level})`,
                          subtitle: `${z.count} osobników • promień ${z.radius} m`,
                          x: z.x,
                          z: z.z,
                          details: [
                            ["ID strefy", z.id],
                            ["Gatunek", z.monster_id],
                            ["Poziom", String(z.level)],
                            ["Współrzędne", `x=${z.x}, z=${z.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td
                        style={{ padding: 8, fontWeight: 700, color: BAND_COLOR[z.band] ?? "#fff" }}
                      >
                        #{z.num}
                      </td>
                      <td>{z.monster_name}</td>
                      <td>Poz. {z.level}</td>
                      <td>{z.count} szt.</td>
                      <td>
                        <code>
                          {z.x}, {z.z}
                        </code>
                      </td>
                      <td>{distCap(z.x, z.z)} m</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "labyrinths" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>Labirynt</th>
                  <th>Poz.</th>
                  <th>Ukryte skarby</th>
                  <th>Strażnicy</th>
                  <th>Wejście (x, z)</th>
                </tr>
              </thead>
              <tbody>
                {land.labyrinths
                  .filter((l) => !q || l.title.toLowerCase().includes(q))
                  .map((l) => (
                    <tr
                      key={l.id}
                      onClick={() =>
                        focusPoint({
                          kind: "Wejście do Labiryntu (15×15)",
                          title: `⚔ ${l.title}`,
                          subtitle: l.subtitle,
                          x: l.x,
                          z: l.z,
                          labyrinth: l,
                          details: [
                            ["ID", l.id],
                            ["Poziom", String(l.level)],
                            ["Ukryte skarby", `${l.chests.length} szt.`],
                            ["Strażnicy", `${l.guardians.length} szt.`],
                            ["Wejście", `x=${l.x}, z=${l.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 8, fontWeight: 700, color: "#e9d5ff" }}>{l.title}</td>
                      <td>Poz. {l.level}</td>
                      <td>{l.chests.map((c) => c.title).join(", ")}</td>
                      <td>{l.guardians.length} szt.</td>
                      <td>
                        <code>
                          {l.x}, {l.z}
                        </code>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "treasures" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>Ukryty skarb</th>
                  <th>Nagroda</th>
                  <th>Przedmiot</th>
                  <th>Współrzędne</th>
                </tr>
              </thead>
              <tbody>
                {land.treasures
                  .filter((t) => !q || t.title.toLowerCase().includes(q))
                  .map((t) => (
                    <tr
                      key={t.id}
                      onClick={() =>
                        focusPoint({
                          kind: "Ukryty skarb terenowy",
                          title: `★ ${t.title}`,
                          subtitle: t.lore,
                          x: t.x,
                          z: t.z,
                          details: [
                            ["ID", t.id],
                            ["Złoto / PD", `+${t.gold} zł / +${t.xp} PD`],
                            ["Przedmiot", t.item_id],
                            ["Pozycja", `x=${t.x}, z=${t.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 8, fontWeight: 700, color: "#fde047" }}>{t.title}</td>
                      <td>
                        +{t.gold} zł • +{t.xp} PD
                      </td>
                      <td>
                        <code>{t.item_id}</code>
                      </td>
                      <td>
                        <code>
                          {t.x}, {t.z}
                        </code>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "npcs" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>NPC</th>
                  <th>Rola</th>
                  <th>Lokalizacja</th>
                  <th>Współrzędne</th>
                </tr>
              </thead>
              <tbody>
                {land.npcs
                  .filter(
                    (n) =>
                      !q || n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q),
                  )
                  .map((n, i) => (
                    <tr
                      key={`${n.actor_id}-${i}`}
                      onClick={() =>
                        focusPoint({
                          kind: n.wilderness ? "NPC Ekspedycji (Teren)" : "NPC Stolicy",
                          title: `${n.name} ${n.quest_mark}`,
                          subtitle: n.role,
                          x: n.x,
                          z: n.z,
                          details: [
                            ["Aktor", n.actor_id],
                            ["Rola", n.role],
                            ["Pozycja", `x=${n.x}, z=${n.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 8, fontWeight: 700 }}>
                        {n.name} {n.quest_mark}
                      </td>
                      <td>{n.role}</td>
                      <td>{n.wilderness ? `Teren (${n.labyrinth_id})` : "Stolica"}</td>
                      <td>
                        <code>
                          {n.x}, {n.z}
                        </code>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "fauna" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>Zwierzę</th>
                  <th>Kod</th>
                  <th>Patrol</th>
                  <th>Współrzędne</th>
                </tr>
              </thead>
              <tbody>
                {land.fauna
                  .filter(
                    (f) =>
                      !q ||
                      f.name.toLowerCase().includes(q) ||
                      f.actor_id.toLowerCase().includes(q),
                  )
                  .map((f, i) => (
                    <tr
                      key={`${f.actor_id}-${i}`}
                      onClick={() =>
                        focusPoint({
                          kind: "Zwierzę (Fauna)",
                          title: f.name,
                          subtitle: `Kod: ${f.actor_id}`,
                          x: f.x,
                          z: f.z,
                          details: [
                            ["Gatunek", f.name],
                            ["Kod", f.actor_id],
                            ["Patrol", `${f.patrol_radius} m`],
                            ["Pozycja", `x=${f.x}, z=${f.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 8, fontWeight: 600, color: "#86efac" }}>{f.name}</td>
                      <td>
                        <code>{f.actor_id}</code>
                      </td>
                      <td>{f.patrol_radius} m</td>
                      <td>
                        <code>
                          {f.x}, {f.z}
                        </code>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "buildings" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>Budynek / Miasto</th>
                  <th>Typ</th>
                  <th>Wejście</th>
                  <th>Współrzędne</th>
                </tr>
              </thead>
              <tbody>
                {land.buildings
                  .filter((b) => !q || (b.title || b.id).toLowerCase().includes(q))
                  .map((b) => (
                    <tr
                      key={b.id}
                      onClick={() =>
                        focusPoint({
                          kind:
                            b.role === "labyrinth" ? "Wejście do Labiryntu" : "Budynek / Miasto",
                          title: b.title || b.id,
                          subtitle: `${b.role} • ${b.map_kind}`,
                          x: b.x,
                          z: b.z,
                          details: [
                            ["ID", b.id],
                            ["Typ", b.role],
                            ["Wnętrze", b.enterable ? "Tak" : "Nie"],
                            ["Pozycja", `x=${b.x}, z=${b.z}`],
                          ],
                        })
                      }
                      style={{ cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <td style={{ padding: 8, fontWeight: 600 }}>{b.title || b.id}</td>
                      <td>
                        {b.map_kind} ({b.role})
                      </td>
                      <td>{b.enterable ? "✓ Tak" : "—"}</td>
                      <td>
                        <code>
                          {b.x}, {b.z}
                        </code>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === "quests" && (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: 8 }}>ID</th>
                  <th>Zadanie / Cel</th>
                  <th>Kategoria</th>
                  <th>Mentor</th>
                  <th>Warunek</th>
                  <th>Nagroda</th>
                </tr>
              </thead>
              <tbody>
                {landGoals
                  .filter(
                    (g) =>
                      !q || g.title.toLowerCase().includes(q) || g.id.toLowerCase().includes(q),
                  )
                  .map((g) => (
                    <tr key={g.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: 8 }}>
                        <code>{g.id}</code>
                      </td>
                      <td style={{ fontWeight: 700 }}>{g.title}</td>
                      <td>{GOAL_KIND_LABEL[g.kind] ?? g.kind}</td>
                      <td>{g.mentor}</td>
                      <td>{g.requirementText}</td>
                      <td>
                        +{g.xpReward} PD, +{g.goldReward} zł
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
export default AdminSuperiorWorld;
