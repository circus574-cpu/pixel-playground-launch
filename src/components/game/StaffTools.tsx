/**
 * In-game tools of a special administrator / game-master character (state.staff). The session
 * ignores these commands for every other character, so the panel is only a convenience.
 *
 * Zawiera wygodny wielozakładkowy HUD na żywo (Akcje, Statystyki, Ekwipunek i Materiały,
 * Umiejętności, Zadania, Potwory/Bossowie, Teleport) oraz pełnoekranowy modal Edytora Świata.
 */
import { useState } from "react";
import { AdminWorldEditor } from "../admin/AdminWorldEditor";
import { BOSS_CATALOG } from "../../game/bosses/catalog";
import { KIT_NODES } from "../../game/kit";
import { MONSTER_BASE } from "../../game/monsters/base.generated";
import { MATERIALS, MATERIAL_IDS } from "../../game/monsters/materials";
import {
  ITEMS,
  ITEM_IDS,
  QUEST_NAMES,
  xpNeeded,
  type GameViewState,
  type ItemId,
  type QuestId,
} from "../../game/session";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import { v2Places } from "../../game/worlds/v2Places";
import type { SendCommand } from "./AdventurePanels";

type Destination = { id: string; name: string };
type HudTab = "quick" | "stats" | "bag" | "skills" | "quests" | "spawns" | "world";

export function StaffTools({
  state,
  send,
  continents,
  current,
  onTravel,
}: {
  state: GameViewState;
  send: SendCommand;
  continents: Destination[];
  current: string | undefined;
  onTravel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<HudTab>("quick");
  const [worldModal, setWorldModal] = useState(false);
  const [coords, setCoords] = useState({ x: "", y: "" });
  const [levelInput, setLevelInput] = useState("");
  const [goldInput, setGoldInput] = useState("");
  const [xpInput, setXpInput] = useState("");
  const [matId, setMatId] = useState<string>(MATERIAL_IDS[0] ?? "");
  const [matCount, setMatCount] = useState("10");
  const [selectedMonster, setSelectedMonster] = useState<string>(
    MONSTER_BASE.find((m) => m.world === state.player.continent)?.id ?? MONSTER_BASE[0]!.id,
  );
  const [selectedBoss, setSelectedBoss] = useState<string>(
    BOSS_CATALOG.find((b) => b.continent === state.player.continent)?.id ?? BOSS_CATALOG[0]!.id,
  );

  if (!state.staff) return null;

  const p = state.player;
  const places = WORLD_V2 ? v2Places(p.continent) : undefined;
  const groups: [string, { name: string; x: number; y: number }[]][] = places
    ? [
        ["Miasta", Object.values(places.cities)],
        ["Słynne miejsca", Object.values(places.famousById)],
        ["Ukryte miejsca", Object.values(places.hidden)],
      ]
    : [];
  const teleport = (x: number, y: number) => send({ type: "staff", action: "teleport", x, y });

  return (
    <div className="ki-staff">
      <button
        className="ki-staff-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={state.staff === "admin" ? "Narzędzia administratora" : "Narzędzia game mastera"}
      >
        {state.staff === "admin" ? "ADM" : "GM"}
      </button>

      {open && (
        <section className="ki-staff-panel" aria-label="Narzędzia postaci specjalnej">
          <header>
            <div>
              <b>{state.staff === "admin" ? "Administrator" : "Game master"}</b>{" "}
              <small>
                ({Math.round(state.x)}, {Math.round(state.y)})
              </small>
            </div>
            <button
              onClick={() => setWorldModal(true)}
              style={{ borderColor: "#ffb36b", fontWeight: 600 }}
            >
              Panel Świata ⊞
            </button>
          </header>

          <div className="ki-staff-row" style={{ marginBottom: 8 }}>
            {(
              [
                ["quick", "Szybkie"],
                ["stats", "Postać"],
                ["bag", "Przedmioty"],
                ["skills", "Drzewko"],
                ["quests", "Zadania"],
                ["spawns", "Bestie"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                style={{ fontSize: 12, padding: "3px 7px" }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "quick" && (
            <>
              <div className="ki-staff-row">
                <button onClick={() => send({ type: "staff", action: "heal" })}>Lecz</button>
                <button
                  aria-pressed={state.god}
                  onClick={() => send({ type: "staff", action: "god" })}
                >
                  Nieśmiertelność {state.god ? "✓" : ""}
                </button>
                <button onClick={() => send({ type: "staff", action: "level" })}>+1 poziom</button>
                <button onClick={() => send({ type: "staff", action: "gold" })}>+1000 monet</button>
                <button onClick={() => send({ type: "staff", action: "potions" })}>
                  +10 mikstur
                </button>
                <button onClick={() => send({ type: "staff", action: "killTarget" })}>
                  Zabij cel
                </button>
                <button onClick={() => send({ type: "staff", action: "killAllNearby" })}>
                  Wyczyść okolicę
                </button>
              </div>
              <h4>Teleport na współrzędne</h4>
              <form
                className="ki-staff-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const x = Number(coords.x),
                    y = Number(coords.y);
                  if (Number.isFinite(x) && Number.isFinite(y)) teleport(x, y);
                }}
              >
                <input
                  aria-label="X"
                  inputMode="numeric"
                  placeholder="X"
                  value={coords.x}
                  onChange={(e) => setCoords({ ...coords, x: e.target.value })}
                />
                <input
                  aria-label="Y"
                  inputMode="numeric"
                  placeholder="Y"
                  value={coords.y}
                  onChange={(e) => setCoords({ ...coords, y: e.target.value })}
                />
                <button type="submit">Teleport</button>
              </form>
              {groups.map(([title, list]) => (
                <details key={title}>
                  <summary>
                    {title} ({list.length})
                  </summary>
                  <div className="ki-staff-list">
                    {list.map((place) => (
                      <button key={place.name + place.x} onClick={() => teleport(place.x, place.y)}>
                        {place.name}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
              <details>
                <summary>Inne krainy ({continents.length - 1})</summary>
                <div className="ki-staff-list">
                  {continents
                    .filter((c) => c.id !== current)
                    .map((c) => (
                      <button key={c.id} onClick={() => onTravel(c.id)}>
                        {c.name}
                      </button>
                    ))}
                </div>
              </details>
            </>
          )}

          {tab === "stats" && (
            <div>
              <h4>Poziom, Złoto i XP (Poz. {p.level})</h4>
              <div className="ki-staff-row">
                <input
                  type="number"
                  placeholder={"Poz. " + p.level}
                  value={levelInput}
                  onChange={(e) => setLevelInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const n = Number(levelInput);
                    if (Number.isFinite(n)) send({ type: "staff", action: "setLevel", level: n });
                  }}
                >
                  Ustaw poziom (1–100)
                </button>
              </div>
              <div className="ki-staff-row" style={{ marginTop: 6 }}>
                <button onClick={() => send({ type: "staff", action: "setLevel", level: 1 })}>
                  Poz. 1
                </button>
                <button onClick={() => send({ type: "staff", action: "setLevel", level: 10 })}>
                  Poz. 10
                </button>
                <button onClick={() => send({ type: "staff", action: "setLevel", level: 20 })}>
                  Poz. 20
                </button>
                <button onClick={() => send({ type: "staff", action: "setLevel", level: 50 })}>
                  Poz. 50
                </button>
                <button onClick={() => send({ type: "staff", action: "setLevel", level: 100 })}>
                  Poz. 100
                </button>
              </div>
              <div className="ki-staff-row" style={{ marginTop: 6 }}>
                <input
                  type="number"
                  placeholder={"Złoto " + p.gold}
                  value={goldInput}
                  onChange={(e) => setGoldInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const n = Number(goldInput);
                    if (Number.isFinite(n)) send({ type: "staff", action: "setGold", gold: n });
                  }}
                >
                  Ustaw złoto
                </button>
              </div>
              <div className="ki-staff-row" style={{ marginTop: 6 }}>
                <input
                  type="number"
                  placeholder={`XP (max ${xpNeeded(p.level) - 1})`}
                  value={xpInput}
                  onChange={(e) => setXpInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const n = Number(xpInput);
                    if (Number.isFinite(n)) send({ type: "staff", action: "setXp", xp: n });
                  }}
                >
                  Ustaw XP
                </button>
              </div>
            </div>
          )}

          {tab === "bag" && (
            <div>
              <h4>Przedmioty bazowe i ekwipunek</h4>
              {ITEM_IDS.map((id: ItemId) => (
                <div
                  key={id}
                  className="ki-staff-row"
                  style={{ marginBottom: 4, alignItems: "center" }}
                >
                  <span style={{ flex: 1 }}>
                    {ITEMS[id].name}: <b>{p.items[id]}</b> (schowek: {p.depot.items[id]})
                  </span>
                  <button
                    onClick={() =>
                      send({
                        type: "staff",
                        action: "setItem",
                        item: id,
                        count: Math.min(99, p.items[id] + 1),
                      })
                    }
                  >
                    +1
                  </button>
                  <button
                    onClick={() =>
                      send({
                        type: "staff",
                        action: "setItem",
                        item: id,
                        count: 99,
                      })
                    }
                  >
                    99
                  </button>
                  <button
                    onClick={() =>
                      send({
                        type: "staff",
                        action: "setItem",
                        item: id,
                        count: 0,
                      })
                    }
                  >
                    0
                  </button>
                </div>
              ))}
              <div className="ki-staff-row" style={{ marginTop: 6 }}>
                <button
                  aria-pressed={p.weapon === "sword"}
                  onClick={() =>
                    send({
                      type: "staff",
                      action: "setEquipment",
                      weapon: p.weapon ? null : "sword",
                    })
                  }
                >
                  Miecz {p.weapon ? "✓" : "—"}
                </button>
                <button
                  aria-pressed={p.upgrade > 0}
                  onClick={() =>
                    send({
                      type: "staff",
                      action: "setEquipment",
                      weapon: "sword",
                      upgrade: p.upgrade > 0 ? 0 : 1,
                    })
                  }
                >
                  Ulepszenie +1 {p.upgrade > 0 ? "✓" : "—"}
                </button>
                <button
                  aria-pressed={p.armor === "vest"}
                  onClick={() =>
                    send({
                      type: "staff",
                      action: "setEquipment",
                      armor: p.armor ? null : "vest",
                    })
                  }
                >
                  Pancerz {p.armor ? "✓" : "—"}
                </button>
              </div>

              <h4>Materiały z potworów (30)</h4>
              <div className="ki-staff-row">
                <select
                  value={matId}
                  onChange={(e) => setMatId(e.target.value)}
                  style={{ maxWidth: 165 }}
                >
                  {MATERIAL_IDS.map((id) => (
                    <option key={id} value={id}>
                      {MATERIALS[id]!.name} ({p.materials[id] ?? 0})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  style={{ width: 65 }}
                  value={matCount}
                  onChange={(e) => setMatCount(e.target.value)}
                />
                <button
                  onClick={() =>
                    send({
                      type: "staff",
                      action: "setMaterial",
                      id: matId,
                      count: Number(matCount) || 0,
                    })
                  }
                >
                  Ustaw
                </button>
              </div>
            </div>
          )}

          {tab === "skills" && (
            <div>
              <h4>
                Drzewko umiejętności ({p.skills.length} poznanych · wolne pkt: {state.skillPoints})
              </h4>
              <div className="ki-staff-row" style={{ marginBottom: 6 }}>
                <button onClick={() => send({ type: "staff", action: "resetSkills" })}>
                  Resetuj drzewko do [R]
                </button>
              </div>
              <div className="ki-staff-list" style={{ maxHeight: 220, overflow: "auto" }}>
                {KIT_NODES[p.race].map((n) => {
                  const learned = p.skills.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      aria-pressed={learned}
                      onClick={() => {
                        if (!learned) send({ type: "staff", action: "forceLearn", node: n.id });
                      }}
                      title={`${n.name} (min poz. ${n.minLevel}): ${n.text}`}
                    >
                      {n.id}: {n.name} {learned ? "✓" : `(p.${n.minLevel})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "quests" && (
            <div>
              <h4>Zadania główne sesji</h4>
              {(["steps", "boars", "gear"] as QuestId[]).map((qid) => (
                <div key={qid} style={{ marginBottom: 6 }}>
                  <small>
                    <b>{QUEST_NAMES[qid]}</b> ({p.quests[qid]})
                  </small>
                  <div className="ki-staff-row">
                    {(["locked", "active", "ready", "done"] as const).map((st) => (
                      <button
                        key={st}
                        aria-pressed={p.quests[qid] === st}
                        onClick={() =>
                          send({ type: "staff", action: "setQuest", quest: qid, status: st })
                        }
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "spawns" && (
            <div>
              <h4>Przywołaj potwora obok siebie</h4>
              <div className="ki-staff-row">
                <select
                  value={selectedMonster}
                  onChange={(e) => setSelectedMonster(e.target.value)}
                  style={{ maxWidth: 210 }}
                >
                  {MONSTER_BASE.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.world} p.{m.level}] {m.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    send({ type: "staff", action: "spawnMonster", kind: selectedMonster })
                  }
                >
                  Spawn
                </button>
              </div>
              <h4>Przywołaj Bossa obok siebie</h4>
              <div className="ki-staff-row">
                <select
                  value={selectedBoss}
                  onChange={(e) => setSelectedBoss(e.target.value)}
                  style={{ maxWidth: 210 }}
                >
                  {BOSS_CATALOG.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.continent} p.{b.level}] {b.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => send({ type: "staff", action: "spawnBoss", bossId: selectedBoss })}
                >
                  Boss
                </button>
              </div>
              <div className="ki-staff-row" style={{ marginTop: 8 }}>
                <button onClick={() => send({ type: "staff", action: "killTarget" })}>
                  Zgładź cel
                </button>
                <button onClick={() => send({ type: "staff", action: "killAllNearby" })}>
                  Zgładź wszystkie w zasięgu
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {worldModal && (
        <div
          className="ki-staff-world-modal"
          role="dialog"
          aria-label="Panel Świata Administratora"
        >
          <div className="ki-staff-world-modal-inner ki-account">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <h2 style={{ margin: 0, color: "#f5d48a" }}>
                Panel Świata Administratora (Na Żywo w Grze)
              </h2>
              <button onClick={() => setWorldModal(false)}>Zamknij ×</button>
            </div>
            <AdminWorldEditor
              compact
              initialContinent={p.continent}
              playerPos={{ x: state.x, y: state.y, ...(current ? { feature: current } : {}) }}
              onTeleport={(x, y) => {
                teleport(x, y);
              }}
              onSpawnLiveMonster={(kind, x, y) =>
                send({
                  type: "staff",
                  action: "spawnMonster",
                  kind,
                  ...(x !== undefined ? { x } : {}),
                  ...(y !== undefined ? { y } : {}),
                })
              }
              onSpawnLiveBoss={(bossId, x, y) =>
                send({
                  type: "staff",
                  action: "spawnBoss",
                  bossId,
                  ...(x !== undefined ? { x } : {}),
                  ...(y !== undefined ? { y } : {}),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
