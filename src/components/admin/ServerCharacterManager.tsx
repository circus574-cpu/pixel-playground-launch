import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listServerCharactersFn,
  getServerCharacterFn,
  updateServerCharacterFn,
  executeLiveAdminActionFn,
} from "@/lib/serverCharacters.functions";
import type {
  ServerCharacterSummary,
  ServerCharacterDetail,
  ServerCharacterUpdatePatch,
  LiveAdminAction,
  QuestStatus,
} from "@/server/adminCharacterService";
import { RACE_IDS, RACES, type RaceId, type WorldId } from "@/game/world/races";
import { KIT_NODES, RACE_BASE } from "@/game/kit/nodes.generated";
import { unlockAllowed } from "@/game/kit/progression";
import { ITEM_CATALOG } from "@/game/items/catalog";
import { ItemHoverTooltip } from "./AdminCatalogInfo";
import { getItemById } from "@/game/items";
import { itemFitsSlot } from "@/game/items/slots";
import {
  ITEMS,
  ITEM_IDS,
  type ItemId,
  characterFullStats,
  type CharacterFullStatsResult,
} from "@/game/session";
import {
  emptyCombatTraining,
  trainingRequirement,
  type CombatTraining,
} from "@/game/combatTraining";
import { CHARACTER_STAT_FIELDS } from "@/game/characterStats";
import { useAccount } from "@/components/account/useAccount";

const RACE_LABELS: Record<RaceId, string> = {
  planetary: "Planetarni (Verdantia)",
  sage: "Mędrcy (Aetheria)",
  android: "Androidy (Nexus-9)",
  legend: "Legendy (Pyra)",
};

const CONTINENT_OPTIONS: { id: WorldId; name: string }[] = [
  { id: "verdant", name: "Verdantia (Planeta Główna)" },
  { id: "aether", name: "Aetheria (Podniebne Wyspy)" },
  { id: "nexus", name: "Nexus-9 (Metropolia Maszyn)" },
  { id: "pyra", name: "Pyra (Wulkaniczne Pustkowia)" },
];

const QUEST_STATUSES: QuestStatus[] = ["locked", "active", "ready", "done"];

export function ServerCharacterManager() {
  const account = useAccount();
  const token = account.session?.access_token;

  const [characters, setCharacters] = useState<ServerCharacterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [raceFilter, setRaceFilter] = useState<string>("all");
  const [onlyOnline, setOnlyOnline] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServerCharacterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stan edycji postaci
  const [form, setForm] = useState<ServerCharacterUpdatePatch>({});
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<
    "breakdown" | "overrides" | "stats" | "world" | "equipment" | "bag" | "quests" | "skills"
  >("breakdown");

  // Dodawanie przedmiotu do torby / depozytu
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>(ITEM_CATALOG[0]?.id || "");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemSearch, setItemSearch] = useState<string>("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>("all");
  const [itemRarityFilter, setItemRarityFilter] = useState<string>("all");
  const [itemSortBy, setItemSortBy] = useState<"name" | "id" | "level" | "price" | "rarity">(
    "name",
  );

  // Wczytywanie listy postaci serwera
  const loadCharacters = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const list = await listServerCharactersFn({
        data: {
          search: search.trim() || undefined,
          race: raceFilter === "all" ? undefined : raceFilter,
          onlyOnline,
          authToken: token,
        },
      });
      setCharacters(list);
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "Błąd pobierania listy postaci",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }, [search, raceFilter, onlyOnline, token]);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  // Wczytywanie szczegółów wybranej postaci
  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setStatusMessage(null);
      try {
        const data = (await getServerCharacterFn({
          data: { characterId: id, authToken: token },
        })) as ServerCharacterDetail | null;
        setDetail(data);
        if (data && data.player) {
          const p = data.player;
          setForm({
            name: p.name,
            level: p.level,
            xp: p.xp,
            hp: p.hp,
            ki: p.ki,
            gold: p.gold,
            depotGold: p.depot?.gold ?? 0,
            dead: p.dead,
            respecs: p.respecs ?? 0,
            continent: p.continent,
            x: Math.round(p.x),
            y: Math.round(p.y),
            interior: p.interior ?? null,
            statOverrides: { ...p.statOverrides },
            equipment: { ...p.equipment },
            bagItems: { ...(p.bagItems || {}) },
            items: { ...(p.items || {}) },
            depotItems: {
              items: { ...(p.depot?.items || {}) },
              materials: { ...(p.depot?.materials || {}) },
              bagItems: { ...(p.depot?.bagItems || {}) },
            },
            quests: {
              steps: p.quests?.steps ?? "locked",
              boars: p.quests?.boars ?? "locked",
              gear: p.quests?.gear ?? "locked",
            },
            skills: [...(p.skills || ["R"])],
            combatTraining: p.combatTraining
              ? structuredClone(p.combatTraining)
              : emptyCombatTraining(),
          });
        }
      } catch (err) {
        setStatusMessage({
          text: err instanceof Error ? err.message : "Błąd ładowania szczegółów postaci",
          error: true,
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  // Zapis postaci
  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await updateServerCharacterFn({
        data: {
          characterId: selectedId,
          patch: form,
          authToken: token,
        },
      });
      if (res.ok) {
        setStatusMessage({ text: `Zapisano! Nowa rewizja bazy: v${res.revision}` });
        await loadCharacters();
        await loadDetail(selectedId);
      } else {
        setStatusMessage({ text: res.error || "Błąd zapisu postaci", error: true });
      }
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "Wyjątek zapisu",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  // Akcje Live
  const handleLiveAction = async (action: LiveAdminAction) => {
    if (!selectedId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await executeLiveAdminActionFn({
        data: {
          characterId: selectedId,
          action,
          authToken: token,
        },
      });
      if (res.ok) {
        setStatusMessage({ text: res.message });
        await loadCharacters();
        await loadDetail(selectedId);
      } else {
        setStatusMessage({ text: res.message, error: true });
      }
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "Błąd akcji live",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtrowany i sortowany katalog przedmiotów do wyszukiwarki
  const filteredCatalogItems = useMemo(() => {
    const list = ITEM_CATALOG.filter((it) => {
      if (itemCategoryFilter !== "all" && it.category !== itemCategoryFilter) return false;
      if (itemRarityFilter !== "all" && it.rarity !== itemRarityFilter) return false;
      if (itemSearch.trim()) {
        const q = itemSearch.toLowerCase();
        if (
          !it.id.toLowerCase().includes(q) &&
          !it.name.toLowerCase().includes(q) &&
          !it.category.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const rarityOrder: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5,
      mythic: 6,
    };

    list.sort((a, b) => {
      if (itemSortBy === "name") return a.name.localeCompare(b.name, "pl");
      if (itemSortBy === "id") return a.id.localeCompare(b.id);
      if (itemSortBy === "level") return (a.level ?? 0) - (b.level ?? 0);
      if (itemSortBy === "price") return a.price - b.price;
      if (itemSortBy === "rarity")
        return (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0);
      return 0;
    });

    return list.slice(0, 80);
  }, [itemSearch, itemCategoryFilter, itemRarityFilter, itemSortBy]);

  const activeKitNodes = useMemo(() => {
    if (!detail) return [];
    return KIT_NODES[detail.player.race] || [];
  }, [detail]);

  // Obliczanie pełnych aktualnych/efektywnych statystyk w czasie rzeczywistym
  const liveStats = useMemo<CharacterFullStatsResult | null>(() => {
    if (!detail) return null;
    const p = detail.player;

    const cleanOverrides = form.statOverrides
      ? (Object.fromEntries(
          Object.entries(form.statOverrides).filter(
            ([_, v]) => v !== undefined && v !== null && !isNaN(Number(v)),
          ),
        ) as Record<string, number>)
      : undefined;

    const normalizedCt =
      form.combatTraining?.dodge &&
      form.combatTraining?.attackSpeed &&
      form.combatTraining?.technique
        ? {
            dodge: {
              rank: form.combatTraining.dodge.rank ?? 0,
              progress: form.combatTraining.dodge.progress ?? 0,
            },
            attackSpeed: {
              rank: form.combatTraining.attackSpeed.rank ?? 0,
              progress: form.combatTraining.attackSpeed.progress ?? 0,
            },
            technique: {
              rank: form.combatTraining.technique.rank ?? 0,
              progress: form.combatTraining.technique.progress ?? 0,
            },
          }
        : p.combatTraining;

    const eq = form.equipment ?? p.equipment;
    const normalizedEq = eq
      ? {
          head: eq.head ?? null,
          weapon: eq.weapon ?? null,
          armor: eq.armor ?? null,
          offhand: eq.offhand ?? null,
          hands: eq.hands ?? null,
          ring: eq.ring ?? null,
          amulet: eq.amulet ?? null,
          feet: eq.feet ?? null,
        }
      : undefined;

    const simulated = {
      ...p,
      level: form.level ?? p.level,
      weapon: form.equipment?.weapon !== undefined ? (form.equipment.weapon ?? null) : p.weapon,
      armor: form.equipment?.armor !== undefined ? (form.equipment.armor ?? null) : p.armor,
      upgrade:
        form.equipment?.weaponUpgradeTier !== undefined
          ? form.equipment.weaponUpgradeTier
          : p.upgrade,
      skills: form.skills ?? p.skills,
      ...(cleanOverrides ? { statOverrides: cleanOverrides } : {}),
      ...(normalizedCt ? { combatTraining: normalizedCt } : {}),
      ...(normalizedEq ? { equipment: normalizedEq } : {}),
    };

    try {
      return characterFullStats(simulated);
    } catch {
      return detail.fullStats || null;
    }
  }, [detail, form]);

  return (
    <div className="ki-admin-server-characters" style={{ marginTop: 12 }}>
      {/* Pasek statusu / komunikatów */}
      {statusMessage && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 6,
            background: statusMessage.error ? "#4a151b" : "#1b3a24",
            color: statusMessage.error ? "#ffb0b0" : "#a8f5b8",
            border: `1px solid ${statusMessage.error ? "#8c2a34" : "#2f693e"}`,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="ki-admin-grid">
        {/* Lewa kolumna: Lista postaci serwera i filtry */}
        <section>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              placeholder="Szukaj (postać, nick, ID)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={() => void loadCharacters()} title="Odśwież listę">
              🔄
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <select
              value={raceFilter}
              onChange={(e) => setRaceFilter(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="all">Wszystkie rasy</option>
              {RACE_IDS.map((r) => (
                <option key={r} value={r}>
                  {RACES[r].name}
                </option>
              ))}
            </select>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                margin: 0,
                fontSize: "0.85rem",
              }}
            >
              <input
                type="checkbox"
                checked={onlyOnline}
                onChange={(e) => setOnlyOnline(e.target.checked)}
              />
              Tylko Online 🟢
            </label>
          </div>

          <p style={{ margin: "4px 0 8px", fontSize: "0.8rem", opacity: 0.8 }}>
            Postaci w bazie: <b>{characters.length}</b> (
            {characters.filter((c) => c.isOnline).length} online)
          </p>

          {loading ? (
            <p>Wczytywanie postaci...</p>
          ) : characters.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Brak postaci na serwerze spełniających kryteria.</p>
          ) : (
            <div className="ki-admin-list" style={{ maxHeight: "72dvh" }}>
              {characters.map((c) => (
                <button
                  key={c.characterId}
                  aria-pressed={c.characterId === selectedId}
                  onClick={() => setSelectedId(c.characterId)}
                  style={{
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    background: c.characterId === selectedId ? "#2e243b" : "#17141d",
                    borderLeft: `4px solid ${c.isOnline ? "#46d369" : c.retired ? "#777" : "#c8a35a"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <b style={{ color: "#f5d48a" }}>{c.characterName}</b>
                    <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                      {c.isOnline ? (
                        <span style={{ color: "#46d369" }}>🟢 ONLINE</span>
                      ) : (
                        <span style={{ opacity: 0.5 }}>⚪ Offline</span>
                      )}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8rem", display: "flex", gap: 8, opacity: 0.85 }}>
                    <span>
                      Lvl <b>{c.level}</b>
                    </span>
                    <span>{RACES[c.race]?.name || c.race}</span>
                    <span>💰 {c.gold}</span>
                  </div>

                  <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                    Konto: <b>{c.playerNick}</b>
                  </div>

                  {c.dead && (
                    <span style={{ fontSize: "0.75rem", color: "#ff6b6b", fontWeight: 600 }}>
                      💀 MARTWY
                    </span>
                  )}
                  {c.retired && (
                    <span style={{ fontSize: "0.75rem", color: "#aaa" }}>🗑️ WYCOFANA</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Prawa kolumna: Pełny Edytor Postaci */}
        <section className="ki-admin-panel">
          {!selectedId ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
              <h3>Wybierz postać z listy po lewej stronie</h3>
              <p>
                Możesz przeglądać wszystkich graczy na serwerze dedykowanym, zarządzać ich stanem na
                żywo oraz edytować każdą statystykę.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <p>Wczytywanie szczegółów postaci {selectedId}...</p>
          ) : (
            <div>
              {/* Nagłówek wybranej postaci */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid #3a3242",
                  paddingBottom: 12,
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <h2 style={{ margin: "0 0 4px", color: "#f5d48a" }}>
                    {form.name || detail.player.name}
                    {detail.isOnline && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          marginLeft: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#163d21",
                          color: "#46d369",
                          border: "1px solid #2f693e",
                        }}
                      >
                        🟢 POŁĄCZONY NA SERWERZE
                      </span>
                    )}
                  </h2>
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    Rasa: <b>{RACE_LABELS[detail.player.race]}</b> · Konto:{" "}
                    <b>{detail.playerNick}</b> · Rewizja: v<b>{detail.revision}</b>
                    <br />
                    <small>ID: {detail.characterId}</small>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="ki-account-primary"
                    disabled={saving}
                    onClick={() => void handleSave()}
                    style={{ fontSize: "0.95rem", padding: "8px 18px" }}
                  >
                    {saving ? "Zapisywanie..." : "💾 ZAPISZ ZMIANY W BAZIE"}
                  </button>
                </div>
              </div>

              {/* PASEK SZYBKICH AKCJI LIVE */}
              <div
                style={{
                  background: "#221c2c",
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  border: "1px solid #4a3d5e",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#f5d48a",
                    marginBottom: 6,
                  }}
                >
                  ⚡ SZYBKIE AKCJE LIVE (NATYCHMIASTOWE NA SERWERZE):
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    disabled={saving}
                    onClick={() => void handleLiveAction({ type: "heal" })}
                    title="Ulecz HP i Ki do 100%"
                  >
                    💖 Wylecz (Full HP & Ki)
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void handleLiveAction({ type: "revive" })}
                    title="Ożyw postać jeśli poległa"
                  >
                    🔄 Ożyw postać
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void handleLiveAction({ type: "giveGold", amount: 10000 })}
                  >
                    💰 +10 000 Złota
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void handleLiveAction({ type: "giveGold", amount: 100000 })}
                  >
                    💰 +100 000 Złota
                  </button>

                  <button
                    disabled={saving}
                    onClick={() =>
                      void handleLiveAction({
                        type: "setLevel",
                        level: Math.min(20, (form.level || 1) + 1),
                      })
                    }
                  >
                    ⬆️ +1 Poziom
                  </button>

                  <button
                    disabled={saving}
                    onClick={() => void handleLiveAction({ type: "setLevel", level: 20 })}
                  >
                    ⭐ Max 20 Poziom
                  </button>

                  {detail.isOnline && (
                    <button
                      disabled={saving}
                      onClick={() =>
                        void handleLiveAction({
                          type: "kick",
                          reason: "Rozłączono przez administratora gry.",
                        })
                      }
                      style={{ background: "#4a1c22", borderColor: "#7a2b36" }}
                    >
                      🚪 Wyrzuć z serwera (Kick)
                    </button>
                  )}

                  <button
                    disabled={saving}
                    onClick={() =>
                      void handleLiveAction({ type: "retire", retired: !detail.retiredAt })
                    }
                    style={{ background: detail.retiredAt ? "#203a28" : "#382329" }}
                  >
                    {detail.retiredAt ? "♻️ Przywróć postać" : "🗑️ Wycofaj postać"}
                  </button>
                </div>
              </div>

              {/* KOMPLETNA KARTA AKTUALNYCH STATYSTYK BIEŻĄCYCH */}
              {liveStats && (
                <div
                  style={{
                    background: "linear-gradient(180deg, #181424 0%, #120e1a 100%)",
                    padding: "14px 16px",
                    borderRadius: 8,
                    marginBottom: 16,
                    border: "1px solid #4a3d6a",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      borderBottom: "1px solid #2e263d",
                      paddingBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f5d48a" }}>
                      📊 AKTUALNE EFEKTYWNE STATYSTYKI POSTACI (LIVE):
                    </div>
                    <button
                      onClick={() => setActiveTab("breakdown")}
                      style={{
                        fontSize: "0.75rem",
                        padding: "3px 10px",
                        background: "#332244",
                        borderColor: "#664488",
                      }}
                    >
                      🔍 Pełne Rozbicie (Breakdown Table)
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {/* Prędkość poruszania się */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>🏃 Szybkość ruchu:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#74f0ed" }}>
                        {liveStats.stats.speed.toFixed(2)}{" "}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>j./s</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        {form.statOverrides?.speed !== undefined
                          ? "⚠️ Nadpisanie GM"
                          : `Baza: ${RACE_BASE[detail.player.race].base.speed} (+5%/lvl)`}
                      </div>
                    </div>

                    {/* Szybkość ataku / Odstęp */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>⚔️ Szybkość ataku:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f7ca65" }}>
                        {liveStats.attacksPerSecond.toFixed(2)}{" "}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>ataku/s</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        Odstęp: {Math.round(liveStats.stats.attackInterval)} ms (premia: +
                        {liveStats.stats.attackSpeedPct.toFixed(1)}%)
                      </div>
                    </div>

                    {/* Atak */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>💥 Siła ataku:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ff8282" }}>
                        {liveStats.stats.attack.toFixed(0)}
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        {form.statOverrides?.attack !== undefined
                          ? "⚠️ Nadpisanie GM"
                          : `Ekwipunek: +${liveStats.gearBonuses?.attack ?? 0}`}
                      </div>
                    </div>

                    {/* Obrona */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>🛡️ Obrona:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#82a8ff" }}>
                        {liveStats.stats.defense.toFixed(1)}
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        {form.statOverrides?.defense !== undefined
                          ? "⚠️ Nadpisanie GM"
                          : `Pancerz: +${liveStats.gearBonuses?.defense ?? 0}`}
                      </div>
                    </div>

                    {/* HP */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                        ❤️ Punkty życia (HP):
                      </div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ff6677" }}>
                        {form.hp ?? detail.player.hp} / {liveStats.stats.maxHp.toFixed(0)}
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        Maksymalne: {liveStats.stats.maxHp.toFixed(0)}
                      </div>
                    </div>

                    {/* Ki */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>🌀 Energia Ki:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#4deeea" }}>
                        {form.ki ?? detail.player.ki} / {liveStats.stats.maxKi.toFixed(0)}
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        Regen: +{liveStats.stats.kiRegen.toFixed(2)}/s
                      </div>
                    </div>

                    {/* Szansa na unik */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>💨 Szansa na unik:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#a5ff94" }}>
                        {liveStats.stats.dodgeChance.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        Trening uniku: ranga {form.combatTraining?.dodge?.rank ?? 0}/100
                      </div>
                    </div>

                    {/* Technika */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>🎯 Technika:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#e090ff" }}>
                        {liveStats.stats.technique.toFixed(0)}
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        +{liveStats.techniqueEffects.crit.toFixed(1)}% kryt, +
                        {(liveStats.techniqueEffects.kiDamage * 100).toFixed(0)}% Ki dmg
                      </div>
                    </div>

                    {/* Szansa krytyczna */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                        ⚡ Trafienie krytyczne:
                      </div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffb454" }}>
                        {liveStats.stats.crit.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>Mnożnik: ×1.5 obrażeń</div>
                    </div>

                    {/* Zasięg ataku */}
                    <div
                      style={{
                        background: "#221c30",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #3d3252",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>🏹 Zasięg ataku:</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffd582" }}>
                        {liveStats.stats.range.toFixed(0)}{" "}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>j.</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                        {form.statOverrides?.range !== undefined
                          ? "⚠️ Nadpisany"
                          : "Zasięg podstawowy"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ZAKŁADKI EDYCJI */}
              <div
                className="ki-admin-tabs"
                role="tablist"
                style={{ borderBottom: "1px solid #3a3242", paddingBottom: 6 }}
              >
                {(
                  [
                    ["breakdown", "📊 Pełna Tabela Statystyk"],
                    ["overrides", "⚡ Nadpisania Walki & Trening"],
                    ["stats", "📈 Podstawowe & Postęp"],
                    ["world", "🗺️ Pozycja & Świat"],
                    ["equipment", "🛡️ Ekwipunek (8 slotów)"],
                    ["bag", "🎒 Torba & Depozyt"],
                    ["quests", "📜 Zadania (Quests)"],
                    ["skills", "🌳 Drzewko Umiejętności"],
                  ] as const
                ).map(([tabId, label]) => (
                  <button
                    key={tabId}
                    role="tab"
                    aria-selected={activeTab === tabId}
                    onClick={() => setActiveTab(tabId)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 1. ZAKŁADKA: STATYSTYKI PODSTAWOWE */}
              {activeTab === "stats" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label>
                      Imię / Nick postaci:
                      <input
                        value={form.name ?? ""}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </label>

                    <label>
                      Poziom (1–20):
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={form.level ?? 1}
                        onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Punkty doświadczenia (XP):
                      <input
                        type="number"
                        min={0}
                        value={form.xp ?? 0}
                        onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Punkty życia (HP) [Max: {detail.maxHp}]:
                      <input
                        type="number"
                        min={0}
                        value={form.hp ?? 100}
                        onChange={(e) => setForm({ ...form, hp: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Energia Ki [Max: {detail.maxKi}]:
                      <input
                        type="number"
                        min={0}
                        value={form.ki ?? 50}
                        onChange={(e) => setForm({ ...form, ki: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Złoto w sakiewce:
                      <input
                        type="number"
                        min={0}
                        value={form.gold ?? 0}
                        onChange={(e) => setForm({ ...form, gold: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Złoto w depozycie miejskim:
                      <input
                        type="number"
                        min={0}
                        value={form.depotGold ?? 0}
                        onChange={(e) => setForm({ ...form, depotGold: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Liczba resetów (Respecs):
                      <input
                        type="number"
                        min={0}
                        value={form.respecs ?? 0}
                        onChange={(e) => setForm({ ...form, respecs: Number(e.target.value) })}
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 18,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!form.dead}
                        onChange={(e) => setForm({ ...form, dead: e.target.checked })}
                      />
                      <b style={{ color: form.dead ? "#ff6b6b" : "inherit" }}>
                        Status zgonu (Dead)
                      </b>
                    </label>
                  </div>
                </div>
              )}

              {/* 2. ZAKŁADKA: POZYCJA & ŚWIAT */}
              {activeTab === "world" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label>
                      Kontynent / Świat:
                      <select
                        value={form.continent || "verdant"}
                        onChange={(e) => setForm({ ...form, continent: e.target.value as WorldId })}
                      >
                        {CONTINENT_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Współrzędna X:
                      <input
                        type="number"
                        value={form.x ?? 0}
                        onChange={(e) => setForm({ ...form, x: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      Współrzędna Y:
                      <input
                        type="number"
                        value={form.y ?? 0}
                        onChange={(e) => setForm({ ...form, y: Number(e.target.value) })}
                      />
                    </label>

                    <label>
                      ID wnętrza budynku (Interior / null):
                      <input
                        value={form.interior || ""}
                        placeholder="null (na zewnątrz)"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            interior:
                              (e.target.value.trim() as ServerCharacterUpdatePatch["interior"]) ||
                              null,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      background: "#221c2c",
                      padding: "12px",
                      borderRadius: 6,
                      border: "1px solid #4a3d5e",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.85rem" }}>
                      Szybki skok do stolic kontynentów:
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            continent: "verdant",
                            x: 4200,
                            y: 2500,
                            interior: null,
                          })
                        }
                      >
                        🏰 Miasto Verdantia (4200, 2500)
                      </button>
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            continent: "aether",
                            x: 4200,
                            y: 2500,
                            interior: null,
                          })
                        }
                      >
                        ☁️ Miasto Aetheria (4200, 2500)
                      </button>
                      <button
                        onClick={() =>
                          setForm({ ...form, continent: "nexus", x: 4200, y: 2500, interior: null })
                        }
                      >
                        ⚙️ Miasto Nexus-9 (4200, 2500)
                      </button>
                      <button
                        onClick={() =>
                          setForm({ ...form, continent: "pyra", x: 4200, y: 2500, interior: null })
                        }
                      >
                        🌋 Miasto Pyra (4200, 2500)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ZAKŁADKA: PEŁNA TABELA ROZBICIA STATYSTYK */}
              {activeTab === "breakdown" && liveStats && (
                <div style={{ display: "grid", gap: 14 }}>
                  <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>
                    Dokładne rozbicie matematyczne każdej statystyki: baza rasy i poziomu, trening,
                    umiejętności z drzewka, bonusy z ekwipunku, efekty buff oraz nadpisania GM.
                  </p>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.85rem",
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#261f33", borderBottom: "2px solid #4a3d6a" }}>
                          <th style={{ padding: "8px 10px" }}>Parametr / Statystyka</th>
                          <th style={{ padding: "8px 10px" }}>Baza (Rasa/Poziom)</th>
                          <th style={{ padding: "8px 10px" }}>Trening</th>
                          <th style={{ padding: "8px 10px" }}>Drzewko Skilli</th>
                          <th style={{ padding: "8px 10px" }}>Ekwipunek</th>
                          <th style={{ padding: "8px 10px" }}>Efekty/Buff</th>
                          <th style={{ padding: "8px 10px" }}>Nadpisanie GM</th>
                          <th style={{ padding: "8px 10px", color: "#f5d48a" }}>WARTOŚĆ KOŃCOWA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "speed", label: "🏃 Szybkość ruchu (j./s)", unit: "j./s" },
                          { key: "attackInterval", label: "⚔️ Odstęp ataku (ms)", unit: "ms" },
                          {
                            key: "attackSpeedPct",
                            label: "💨 Premia szybkości ataku (%)",
                            unit: "%",
                          },
                          { key: "attack", label: "💥 Atak", unit: "" },
                          { key: "defense", label: "🛡️ Obrona", unit: "" },
                          { key: "maxHp", label: "❤️ Maksymalne HP", unit: "" },
                          { key: "maxKi", label: "🌀 Maksymalne KI", unit: "" },
                          { key: "kiRegen", label: "⚡ Regeneracja KI / s", unit: "/s" },
                          { key: "crit", label: "🎯 Szansa krytyczna (%)", unit: "%" },
                          { key: "dodgeChance", label: "💨 Szansa na unik (%)", unit: "%" },
                          { key: "technique", label: "🎯 Technika", unit: "" },
                          { key: "range", label: "🏹 Zasięg ataku", unit: "j." },
                          { key: "dealt", label: "🔮 Mnożnik zadawanych obrażeń", unit: "×" },
                          { key: "cooldownMul", label: "⏱️ Mnożnik odnowienia skilli", unit: "×" },
                          { key: "kiCostMul", label: "📉 Mnożnik kosztu KI", unit: "×" },
                          { key: "ccMul", label: "⛓️ Mnożnik podatności na CC", unit: "×" },
                        ].map(({ key, label, unit }) => {
                          const row = liveStats.breakdown[key as keyof typeof liveStats.breakdown];
                          const hasGm =
                            form.statOverrides?.[key as keyof typeof form.statOverrides] !==
                            undefined;
                          return (
                            <tr
                              key={key}
                              style={{
                                borderBottom: "1px solid #332b40",
                                background: hasGm ? "#382329" : "transparent",
                              }}
                            >
                              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{label}</td>
                              <td style={{ padding: "8px 10px", opacity: 0.8 }}>
                                {row ? row.base.toFixed(1) : "-"} {unit}
                              </td>
                              <td style={{ padding: "8px 10px", opacity: 0.8 }}>
                                {row && row.training !== 0
                                  ? row.training > 0
                                    ? `+${row.training.toFixed(1)}`
                                    : row.training.toFixed(1)
                                  : "-"}
                              </td>
                              <td style={{ padding: "8px 10px", opacity: 0.8 }}>
                                {row && row.skills !== 0
                                  ? row.skills > 0
                                    ? `+${row.skills.toFixed(1)}`
                                    : row.skills.toFixed(1)
                                  : "-"}
                              </td>
                              <td style={{ padding: "8px 10px", opacity: 0.8 }}>
                                {row && row.items !== 0
                                  ? row.items > 0
                                    ? `+${row.items.toFixed(1)}`
                                    : row.items.toFixed(1)
                                  : "-"}
                              </td>
                              <td style={{ padding: "8px 10px", opacity: 0.8 }}>
                                {row && row.effects !== 0
                                  ? row.effects > 0
                                    ? `+${row.effects.toFixed(1)}`
                                    : row.effects.toFixed(1)
                                  : "-"}
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  color: hasGm ? "#ff7080" : "inherit",
                                }}
                              >
                                {hasGm
                                  ? `${form.statOverrides?.[key as keyof typeof form.statOverrides]} ${unit}`
                                  : "-"}
                              </td>
                              <td
                                style={{ padding: "8px 10px", fontWeight: 700, color: "#f5d48a" }}
                              >
                                {row ? row.total.toFixed(2) : "-"} {unit}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. ZAKŁADKA: NADPISANIA WALKI & TRENING BOJOWY */}
              {activeTab === "overrides" && (
                <div style={{ display: "grid", gap: 18 }}>
                  {/* Sekcja szybkiej konfiguracji presetów GM */}
                  <div
                    style={{
                      background: "#221c2c",
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid #4a3d5e",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "#f5d48a",
                        marginBottom: 8,
                      }}
                    >
                      ⚡ SZYBKIE PRESETY ADMINISTRACYJNE (GM PRESETS):
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            statOverrides: {
                              ...form.statOverrides,
                              maxHp: 99999,
                              maxKi: 99999,
                              attack: 99999,
                              defense: 99999,
                              speed: 500,
                              attackInterval: 200,
                            },
                          })
                        }
                      >
                        ⚡ God Mode (HP/Ki/Atk/Def: 99999, Speed: 500)
                      </button>

                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            statOverrides: {
                              ...form.statOverrides,
                              speed: 450,
                              attackInterval: 250,
                            },
                          })
                        }
                      >
                        🏃 Super Szybkość (Ruch 450 j./s, Odstęp 250 ms)
                      </button>

                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            statOverrides: {
                              ...form.statOverrides,
                              range: 300,
                              crit: 50,
                            },
                          })
                        }
                      >
                        🎯 Snajper (Zasięg 300 j., Krytyk 50%)
                      </button>

                      <button
                        onClick={() => setForm({ ...form, statOverrides: {} })}
                        style={{ background: "#4a1c22", borderColor: "#7a2b36" }}
                      >
                        🔄 Resetuj wszystkie nadpisania do wartości naturalnych
                      </button>
                    </div>
                  </div>

                  {/* Bezpośrednia edycja każdego parametru walki */}
                  <div>
                    <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "#f5d48a" }}>
                      🛠️ Bezpośrednie Nadpisania Statystyk Bojowych:
                    </h3>
                    <p style={{ fontSize: "0.8rem", opacity: 0.8, margin: "0 0 12px" }}>
                      Wpisz dowolną wartość, aby natychmiast nadpisać statystykę w pamięci serwera i
                      bazie. Pozostawienie pustego pola przywraca naturalną wartość wynikającą z
                      rasy, poziomu i ekwipunku.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {(
                        Object.entries(CHARACTER_STAT_FIELDS) as [
                          keyof typeof CHARACTER_STAT_FIELDS,
                          { label: string; min: number; max: number },
                        ][]
                      ).map(([statKey, fieldInfo]) => {
                        const val = form.statOverrides?.[statKey];
                        const naturalVal =
                          liveStats?.breakdown[statKey as keyof typeof liveStats.breakdown]?.base ??
                          "-";
                        return (
                          <div
                            key={statKey}
                            style={{
                              background: val !== undefined ? "#301d24" : "#1a1624",
                              padding: "10px",
                              borderRadius: 6,
                              border: `1px solid ${val !== undefined ? "#8a3542" : "#382e47"}`,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 4,
                              }}
                            >
                              <label style={{ fontWeight: 600, fontSize: "0.85rem", margin: 0 }}>
                                {fieldInfo.label}:
                              </label>
                              {val !== undefined && (
                                <button
                                  onClick={() => {
                                    const next = { ...form.statOverrides };
                                    delete next[statKey];
                                    setForm({ ...form, statOverrides: next });
                                  }}
                                  style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                                  title="Usuń to nadpisanie"
                                >
                                  ✕ Usuń
                                </button>
                              )}
                            </div>

                            <input
                              type="number"
                              min={fieldInfo.min}
                              max={fieldInfo.max}
                              placeholder={`Naturalna: ${naturalVal}`}
                              value={val !== undefined && val !== null ? val : ""}
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                const next = { ...form.statOverrides };
                                if (raw === "") {
                                  delete next[statKey];
                                } else {
                                  next[statKey] = Number(raw);
                                }
                                setForm({ ...form, statOverrides: next });
                              }}
                              style={{ width: "100%", marginTop: 4 }}
                            />
                            <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: 4 }}>
                              Zakres: {fieldInfo.min} – {fieldInfo.max}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PEŁNA EDYCJA TRENINGU BOJOWEGO (COMBAT TRAINING) */}
                  <div
                    style={{
                      background: "#1e1829",
                      padding: "14px",
                      borderRadius: 8,
                      border: "1px solid #4a3d5e",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "#f5d48a" }}>
                          🥊 Trening Bojowy Postaci (Combat Training):
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
                          Rangi 0–100 dla Uniku, Szybkości Ataku oraz Techniki.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => {
                            setForm({
                              ...form,
                              combatTraining: {
                                dodge: { rank: 100, progress: 0 },
                                attackSpeed: { rank: 100, progress: 0 },
                                technique: { rank: 100, progress: 0 },
                              },
                            });
                          }}
                          style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                        >
                          ⭐ Wymaksuj Trening (100/100)
                        </button>

                        <button
                          onClick={() => {
                            setForm({
                              ...form,
                              combatTraining: emptyCombatTraining(),
                            });
                          }}
                          style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                        >
                          🔄 Zresetuj (0/0)
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {/* Unik */}
                      <div
                        style={{
                          background: "#261e33",
                          padding: "10px",
                          borderRadius: 6,
                          border: "1px solid #3c3050",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#a5ff94", marginBottom: 6 }}>
                          💨 Unik (Dodge):
                        </div>
                        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 6 }}>
                          Ranga (0–100):
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.combatTraining?.dodge?.rank ?? 0}
                            onChange={(e) => {
                              const r = Math.max(0, Math.min(100, Number(e.target.value)));
                              setForm({
                                ...form,
                                combatTraining: {
                                  dodge: {
                                    rank: r,
                                    progress:
                                      r === 100
                                        ? 0
                                        : Math.min(
                                            form.combatTraining?.dodge?.progress ?? 0,
                                            trainingRequirement(r) - 1,
                                          ),
                                  },
                                  attackSpeed: form.combatTraining?.attackSpeed ?? {
                                    rank: 0,
                                    progress: 0,
                                  },
                                  technique: form.combatTraining?.technique ?? {
                                    rank: 0,
                                    progress: 0,
                                  },
                                },
                              });
                            }}
                            style={{ width: "100%", marginTop: 2 }}
                          />
                        </label>
                        <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                          Bonus do uniku: +
                          {((form.combatTraining?.dodge?.rank ?? 0) * 0.1).toFixed(1)}%
                        </div>
                      </div>

                      {/* Szybkość Ataku */}
                      <div
                        style={{
                          background: "#261e33",
                          padding: "10px",
                          borderRadius: 6,
                          border: "1px solid #3c3050",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#f7ca65", marginBottom: 6 }}>
                          ⚔️ Szybkość Ataku:
                        </div>
                        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 6 }}>
                          Ranga (0–100):
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.combatTraining?.attackSpeed?.rank ?? 0}
                            onChange={(e) => {
                              const r = Math.max(0, Math.min(100, Number(e.target.value)));
                              setForm({
                                ...form,
                                combatTraining: {
                                  dodge: form.combatTraining?.dodge ?? { rank: 0, progress: 0 },
                                  attackSpeed: {
                                    rank: r,
                                    progress:
                                      r === 100
                                        ? 0
                                        : Math.min(
                                            form.combatTraining?.attackSpeed?.progress ?? 0,
                                            trainingRequirement(r) - 1,
                                          ),
                                  },
                                  technique: form.combatTraining?.technique ?? {
                                    rank: 0,
                                    progress: 0,
                                  },
                                },
                              });
                            }}
                            style={{ width: "100%", marginTop: 2 }}
                          />
                        </label>
                        <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                          Bonus szybkości ataku: +
                          {((form.combatTraining?.attackSpeed?.rank ?? 0) * 0.25).toFixed(1)}%
                        </div>
                      </div>

                      {/* Technika */}
                      <div
                        style={{
                          background: "#261e33",
                          padding: "10px",
                          borderRadius: 6,
                          border: "1px solid #3c3050",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#e090ff", marginBottom: 6 }}>
                          🎯 Technika:
                        </div>
                        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 6 }}>
                          Ranga (0–100):
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.combatTraining?.technique?.rank ?? 0}
                            onChange={(e) => {
                              const r = Math.max(0, Math.min(100, Number(e.target.value)));
                              setForm({
                                ...form,
                                combatTraining: {
                                  dodge: form.combatTraining?.dodge ?? { rank: 0, progress: 0 },
                                  attackSpeed: form.combatTraining?.attackSpeed ?? {
                                    rank: 0,
                                    progress: 0,
                                  },
                                  technique: {
                                    rank: r,
                                    progress:
                                      r === 100
                                        ? 0
                                        : Math.min(
                                            form.combatTraining?.technique?.progress ?? 0,
                                            trainingRequirement(r) - 1,
                                          ),
                                  },
                                },
                              });
                            }}
                            style={{ width: "100%", marginTop: 2 }}
                          />
                        </label>
                        <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                          Bonus techniki: +{form.combatTraining?.technique?.rank ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ZAKŁADKA: EKWIPUNEK (8 SLOTÓW) */}
              {activeTab === "equipment" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>
                    Pełny 8-slotowy ekwipunek postaci. Wybierz przedmiot z katalogu V2 lub klasyczny
                    dla każdego slotu.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {(
                      [
                        ["head", "Głowa / Hełm"],
                        ["weapon", "Broń"],
                        ["armor", "Pancerz"],
                        ["offhand", "Druga ręka / Tarcza"],
                        ["hands", "Rękawice / Dłonie"],
                        ["ring", "Pierścień"],
                        ["amulet", "Amulet"],
                        ["feet", "Buty / Stopy"],
                      ] as const
                    ).map(([slotKey, label]) => {
                      const currentItem = form.equipment?.[slotKey];
                      return (
                        <div
                          key={slotKey}
                          style={{
                            padding: "10px",
                            borderRadius: 6,
                            background: "#221c2c",
                            border: "1px solid #4a3d5e",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              marginBottom: 4,
                              color: "#f5d48a",
                            }}
                          >
                            {label}:
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              minHeight: 38,
                            }}
                          >
                            {currentItem && (
                              <ItemHoverTooltip id={currentItem}>
                                <img
                                  src={`/game/items/${currentItem}.webp`}
                                  alt=""
                                  style={{
                                    width: 32,
                                    height: 32,
                                    objectFit: "contain",
                                    borderRadius: 4,
                                    border: "1px solid #4a3d5e",
                                    background: "rgba(0,0,0,0.35)",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </ItemHoverTooltip>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                  color: currentItem ? "#f5d48a" : "inherit",
                                  wordBreak: "break-all",
                                }}
                              >
                                {currentItem ? (
                                  getItemById(currentItem)?.name || currentItem
                                ) : (
                                  <span style={{ opacity: 0.5 }}>(Pusty slot)</span>
                                )}
                              </div>
                              {currentItem && (
                                <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                                  {currentItem}
                                </div>
                              )}
                            </div>
                            {currentItem && (
                              <button
                                onClick={() => {
                                  const nextEq = { ...form.equipment };
                                  delete nextEq[slotKey];
                                  setForm({ ...form, equipment: nextEq });
                                }}
                                style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                                title="Zdejmij przedmiot ze slotu"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div style={{ marginTop: 8 }}>
                            <select
                              value={currentItem || ""}
                              onChange={(e) => {
                                const val = e.target.value as ItemId;
                                setForm({
                                  ...form,
                                  equipment: {
                                    ...form.equipment,
                                    [slotKey]: val || null,
                                  },
                                });
                              }}
                              style={{ width: "100%", fontSize: "0.8rem" }}
                            >
                              <option value="">-- Wybierz przedmiot --</option>
                              {/* Klasyczne */}
                              <optgroup label="Klasyczne przedmioty">
                                {ITEM_IDS.filter((it) => itemFitsSlot(slotKey, it)).map((it) => (
                                  <option key={it} value={it}>
                                    {ITEMS[it]?.name || it} ({it})
                                  </option>
                                ))}
                              </optgroup>
                              {/* V2 Item Catalog */}
                              <optgroup label="Katalog V2 (tylko pasujące do slotu)">
                                {ITEM_CATALOG.filter((it) => itemFitsSlot(slotKey, it.id)).map(
                                  (it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.name} [{it.rarity}] ({it.id})
                                    </option>
                                  ),
                                )}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    <label style={{ gridColumn: "1 / -1", maxWidth: 300 }}>
                      Poziom ulepszenia broni (Weapon Upgrade Tier: 0–10):
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={form.equipment?.weaponUpgradeTier ?? 0}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            equipment: {
                              ...form.equipment,
                              weaponUpgradeTier: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* 5. ZAKŁADKA: TORBA (BAG) & DEPOZYT */}
              {activeTab === "bag" && (
                <div style={{ display: "grid", gap: 16 }}>
                  {/* Panel dodawania przedmiotu */}
                  <div
                    style={{
                      background: "#221c2c",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #4a3d5e",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#f5d48a",
                        marginBottom: 8,
                        fontSize: "0.9rem",
                      }}
                    >
                      ➕ Dodaj przedmiot do Torby lub Depozytu z Katalogu Gry:
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        placeholder="Szukaj (nazwa, ID, typ)..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        style={{ flex: 1, minWidth: 160 }}
                      />

                      <select
                        value={itemCategoryFilter}
                        onChange={(e) => setItemCategoryFilter(e.target.value)}
                        style={{ minWidth: 140 }}
                      >
                        <option value="all">Wszystkie kategorie</option>
                        <option value="weapon">Broń (Weapon)</option>
                        <option value="armor">Pancerz (Armor)</option>
                        <option value="helmet">Hełm (Helmet)</option>
                        <option value="boots">Buty (Boots)</option>
                        <option value="gloves">Rękawice (Gloves)</option>
                        <option value="legs">Nagolenniki (Legs)</option>
                        <option value="ring">Pierścień (Ring)</option>
                        <option value="amulet">Amulet</option>
                        <option value="consumable">Użytkowy (Consumable)</option>
                        <option value="tool">Narzędzie (Tool)</option>
                        <option value="material">Materiał (Material)</option>
                        <option value="quest">Zadaniowy (Quest)</option>
                        <option value="boss-artifact">Artefakt (Artifact)</option>
                      </select>

                      <select
                        value={itemRarityFilter}
                        onChange={(e) => setItemRarityFilter(e.target.value)}
                        style={{ minWidth: 130 }}
                      >
                        <option value="all">Wszystkie rzadkości</option>
                        <option value="common">Pospolity</option>
                        <option value="uncommon">Niezwykły</option>
                        <option value="rare">Rzadki</option>
                        <option value="epic">Epicki</option>
                        <option value="legendary">Legendarny</option>
                        <option value="mythic">Mityczny</option>
                      </select>

                      <select
                        value={itemSortBy}
                        onChange={(e) => setItemSortBy(e.target.value as typeof itemSortBy)}
                        style={{ minWidth: 130 }}
                      >
                        <option value="name">Sortuj: Nazwa (A-Z)</option>
                        <option value="rarity">Sortuj: Rzadkość (malejąco)</option>
                        <option value="level">Sortuj: Poziom</option>
                        <option value="price">Sortuj: Cena</option>
                        <option value="id">Sortuj: ID</option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                        alignItems: "center",
                      }}
                    >
                      {selectedCatalogItem && (
                        <ItemHoverTooltip id={selectedCatalogItem}>
                          <img
                            src={`/game/items/${selectedCatalogItem}.webp`}
                            alt=""
                            style={{
                              width: 32,
                              height: 32,
                              objectFit: "contain",
                              borderRadius: 4,
                              border: "1px solid #38bdf8",
                              background: "rgba(0,0,0,0.5)",
                              cursor: "pointer",
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </ItemHoverTooltip>
                      )}

                      <select
                        value={selectedCatalogItem}
                        onChange={(e) => setSelectedCatalogItem(e.target.value)}
                        style={{ flex: 2, minWidth: 240 }}
                      >
                        {filteredCatalogItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.category}, {it.rarity}) [{it.id}]
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value)))}
                        style={{ width: 70 }}
                        title="Ilość"
                      />

                      <button
                        onClick={() => {
                          if (!selectedCatalogItem) return;
                          const nextBag = { ...(form.bagItems || {}) };
                          nextBag[selectedCatalogItem] =
                            (nextBag[selectedCatalogItem] || 0) + itemQuantity;
                          setForm({ ...form, bagItems: nextBag });
                        }}
                        className="ki-account-primary"
                      >
                        🎒 Dodaj do Torby
                      </button>

                      <button
                        onClick={() => {
                          if (!selectedCatalogItem) return;
                          const currentDepotItems = form.depotItems?.bagItems || {};
                          const nextDepot = {
                            ...form.depotItems,
                            bagItems: {
                              ...currentDepotItems,
                              [selectedCatalogItem]:
                                (currentDepotItems[selectedCatalogItem] || 0) + itemQuantity,
                            },
                          };
                          setForm({ ...form, depotItems: nextDepot });
                        }}
                      >
                        🏦 Dodaj do Depozytu
                      </button>
                    </div>
                  </div>

                  {/* Przedmioty w torbie */}
                  <div>
                    <h3 style={{ margin: "0 0 8px", color: "#f5d48a", fontSize: "1rem" }}>
                      Zawartość Torby Postaci (Bag Items):
                    </h3>

                    {Object.keys(form.bagItems || {}).length === 0 ? (
                      <p style={{ opacity: 0.6 }}>Torba jest pusta.</p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {Object.entries(form.bagItems || {}).map(([itemId, qty]) => (
                          <div
                            key={itemId}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              background: "#1e1826",
                              border: "1px solid #3d314f",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                overflow: "hidden",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <ItemHoverTooltip id={itemId}>
                                <img
                                  src={`/game/items/${itemId}.webp`}
                                  alt=""
                                  style={{
                                    width: 28,
                                    height: 28,
                                    objectFit: "contain",
                                    borderRadius: 4,
                                    border: "1px solid #3d314f",
                                    background: "rgba(0,0,0,0.3)",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </ItemHoverTooltip>
                              <div style={{ overflow: "hidden" }}>
                                <b
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "#f5d48a",
                                    display: "block",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {getItemById(itemId)?.name || itemId}
                                </b>
                                <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>{itemId}</div>
                                <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                                  Ilość:{" "}
                                  <input
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={qty}
                                    onChange={(e) => {
                                      const next = { ...form.bagItems };
                                      next[itemId] = Number(e.target.value);
                                      setForm({ ...form, bagItems: next });
                                    }}
                                    style={{ width: 55, padding: "2px 4px", fontSize: "0.8rem" }}
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const next = { ...form.bagItems };
                                delete next[itemId];
                                setForm({ ...form, bagItems: next });
                              }}
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              title="Usuń z torby"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Przedmioty w depozycie miejskim */}
                  <div style={{ borderTop: "1px solid #3a3242", paddingTop: 12 }}>
                    <h3 style={{ margin: "0 0 8px", color: "#f5d48a", fontSize: "1rem" }}>
                      Przedmioty w Depozycie Miejskim (Depot Bag Items):
                    </h3>

                    {Object.keys(form.depotItems?.bagItems || {}).length === 0 ? (
                      <p style={{ opacity: 0.6 }}>Skrzynia depozytu jest pusta.</p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {Object.entries(form.depotItems?.bagItems || {}).map(([itemId, qty]) => (
                          <div
                            key={itemId}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              background: "#1e1826",
                              border: "1px solid #3d314f",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                overflow: "hidden",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <ItemHoverTooltip id={itemId}>
                                <img
                                  src={`/game/items/${itemId}.webp`}
                                  alt=""
                                  style={{
                                    width: 28,
                                    height: 28,
                                    objectFit: "contain",
                                    borderRadius: 4,
                                    border: "1px solid #3d314f",
                                    background: "rgba(0,0,0,0.3)",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </ItemHoverTooltip>
                              <div style={{ overflow: "hidden" }}>
                                <b
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "#f5d48a",
                                    display: "block",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {getItemById(itemId)?.name || itemId}
                                </b>
                                <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>{itemId}</div>
                                <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                                  Ilość:{" "}
                                  <input
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={qty}
                                    onChange={(e) => {
                                      const next = {
                                        ...form.depotItems,
                                        bagItems: {
                                          ...form.depotItems?.bagItems,
                                          [itemId]: Number(e.target.value),
                                        },
                                      };
                                      setForm({ ...form, depotItems: next });
                                    }}
                                    style={{ width: 55, padding: "2px 4px", fontSize: "0.8rem" }}
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const next = {
                                  ...form.depotItems,
                                  bagItems: { ...form.depotItems?.bagItems },
                                };
                                delete next.bagItems[itemId];
                                setForm({ ...form, depotItems: next });
                              }}
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              title="Usuń ze skrzyni depozytu"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. ZAKŁADKA: ZADANIA (QUESTS) */}
              {activeTab === "quests" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label>
                      Zadanie kroków (Steps):
                      <select
                        value={form.quests?.steps ?? "locked"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            quests: {
                              ...(form.quests || {
                                steps: "locked",
                                boars: "locked",
                                gear: "locked",
                              }),
                              steps: e.target.value as QuestStatus,
                            },
                          })
                        }
                      >
                        {QUEST_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Zadanie na dziki (Boars):
                      <select
                        value={form.quests?.boars ?? "locked"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            quests: {
                              ...(form.quests || {
                                steps: "locked",
                                boars: "locked",
                                gear: "locked",
                              }),
                              boars: e.target.value as QuestStatus,
                            },
                          })
                        }
                      >
                        {QUEST_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Zadanie na ekwipunek (Gear):
                      <select
                        value={form.quests?.gear ?? "locked"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            quests: {
                              ...(form.quests || {
                                steps: "locked",
                                boars: "locked",
                                gear: "locked",
                              }),
                              gear: e.target.value as QuestStatus,
                            },
                          })
                        }
                      >
                        {QUEST_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    onClick={() =>
                      setForm({
                        ...form,
                        quests: {
                          steps: "done",
                          boars: "done",
                          gear: "done",
                        },
                      })
                    }
                    style={{ alignSelf: "flex-start" }}
                  >
                    ✅ Zalicz wszystkie zadania (Status: done)
                  </button>
                </div>
              )}

              {/* 7. ZAKŁADKA: DRZEWKO UMIEJĘTNOŚCI (SKILLS) */}
              {activeTab === "skills" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => {
                        setForm({
                          ...form,
                          skills: unlockAllowed(
                            detail!.player.race,
                            form.level ?? detail!.player.level,
                          ),
                        });
                      }}
                      className="ki-account-primary"
                    >
                      🌟 Odblokuj dozwolone umiejętności (
                      {
                        unlockAllowed(detail!.player.race, form.level ?? detail!.player.level)
                          .length
                      }{" "}
                      z {activeKitNodes.length})
                    </button>

                    <button
                      onClick={() => setForm({ ...form, skills: ["R"] })}
                      style={{ opacity: 0.8 }}
                    >
                      🔄 Zresetuj drzewko do korzenia (R)
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {activeKitNodes.map((node) => {
                      const isUnlocked = form.skills?.includes(node.id) ?? false;
                      return (
                        <div
                          key={node.id}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: isUnlocked ? "#282038" : "#17141d",
                            border: `1px solid ${isUnlocked ? "#c8a35a" : "#3a3242"}`,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              margin: 0,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isUnlocked}
                              onChange={(e) => {
                                const current = form.skills || ["R"];
                                let next: string[];
                                if (e.target.checked) {
                                  next = Array.from(new Set([...current, node.id]));
                                } else {
                                  next = current.filter((id) => id !== node.id);
                                }
                                setForm({ ...form, skills: next });
                              }}
                            />
                            <b style={{ color: isUnlocked ? "#f5d48a" : "inherit" }}>
                              {node.name} ({node.id})
                            </b>
                          </label>

                          <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                            Typ: <b>{node.type}</b> · Min Lvl: <b>{node.minLevel}</b>
                          </div>

                          <div style={{ fontSize: "0.75rem", opacity: 0.65 }}>{node.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DOLNY PRZYCISK ZAPISU */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 12,
                  borderTop: "1px solid #3a3242",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="ki-account-primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  style={{ fontSize: "1rem", padding: "10px 24px" }}
                >
                  {saving ? "Zapisywanie w toku..." : "💾 ZAPISZ ZMIANY W BAZIE POSTGRESQL"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export default ServerCharacterManager;
