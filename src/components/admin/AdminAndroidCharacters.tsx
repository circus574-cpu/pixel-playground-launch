import { useCallback, useEffect, useState } from "react";
import {
  godotAdminCharacters,
  godotAdminCreateCharacter,
  godotAdminDeleteCharacter,
  godotAdminUpdateCharacter,
  type AndroidCharacterAdmin,
  type AndroidItemDef,
  type AndroidItemStack,
} from "@/game/account/godotAdmin";

const LAND_NAMES: Record<AndroidCharacterAdmin["land"], string> = {
  pyra: "Pyra",
  verdant: "Verdantia",
  aether: "Aetheria",
  nexus: "Nexus-9",
};

const RACE_NAMES: Record<AndroidCharacterAdmin["race"], string> = {
  legend: "Legenda (Pyra)",
  planetary: "Planetarny (Verdantia)",
  sage: "Mędrzec (Aetheria)",
  android: "Android (Nexus-9)",
};

const EQUIP_SLOT_LABELS = [
  "0: Hełm",
  "1: Amulet",
  "2: Broń",
  "3: Rękawice",
  "4: Zbroja",
  "5: Tarcza",
  "6: Pierścień",
  "7: Buty",
] as const;

const STAT_LABELS: { key: keyof AndroidCharacterAdmin["state"]["bonusStats"]; label: string }[] = [
  { key: "hp", label: "Bonus HP (+25/pkt)" },
  { key: "ki", label: "Bonus KI (+15/pkt)" },
  { key: "atk", label: "Bonus Atak (+5/pkt)" },
  { key: "def", label: "Bonus Obrona (+4/pkt)" },
  { key: "spd", label: "Bonus Szybkość (+15/pkt)" },
  { key: "crit", label: "Bonus Kryt (+2%/pkt)" },
];

const when = (iso: string) => new Date(iso).toLocaleString("pl-PL");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AdminAndroidCharacters({
  isAdmin,
  accountId,
  accountNick,
}: {
  isAdmin: boolean;
  accountId?: string;
  accountNick?: string;
}) {
  const [query, setQuery] = useState("");
  const [chars, setChars] = useState<AndroidCharacterAdmin[]>([]);
  const [catalog, setCatalog] = useState<AndroidItemDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Create form (when accountId is provided or admin pastes account UUID)
  const [newAcctId, setNewAcctId] = useState(accountId ?? "");
  const [newName, setNewName] = useState("");
  const [newRace, setNewRace] = useState<AndroidCharacterAdmin["race"]>("legend");
  const [newLevel, setNewLevel] = useState("1");
  const [newGold, setNewGold] = useState("120");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (accountId) setNewAcctId(accountId);
  }, [accountId]);

  const reload = useCallback(async () => {
    try {
      const res = await godotAdminCharacters(query, accountId);
      setChars(res.characters);
      setCatalog(res.catalog);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [query, accountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = chars.find((c) => c.id === selectedId) ?? null;

  const handleCreate = async () => {
    try {
      const res = await godotAdminCreateCharacter({
        accountId: (accountId ?? newAcctId).trim(),
        name: newName.trim(),
        race: newRace,
        level: Number(newLevel) || 1,
        gold: Number(newGold) || 120,
      });
      setInfo(`Utworzono postać: ${res.character.name}`);
      setError("");
      setNewName("");
      setShowCreate(false);
      await reload();
      setSelectedId(res.character.id);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <section className="ki-admin-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h3>
          {accountNick
            ? `Postacie Android konta: ${accountNick} (${chars.length})`
            : `Autorytatywne postacie Android (${chars.length})`}
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void reload()}>Odśwież</button>
          {isAdmin && (
            <button onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Anuluj tworzenie" : "+ Nowa postać Android"}
            </button>
          )}
        </div>
      </div>

      {!accountId && (
        <input
          placeholder="Szukaj postaci po nicku postaci, nicku konta lub e-mailu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginTop: 8, marginBottom: 8, width: "100%", maxWidth: 460 }}
        />
      )}

      {error && <p className="ki-account-error">{error}</p>}
      {info && <p className="ki-account-ok">{info}</p>}

      {showCreate && isAdmin && (
        <div
          style={{ border: "1px solid #4a3f2a", padding: 12, borderRadius: 8, marginBottom: 12 }}
        >
          <h4>Utwórz nową postać na serwerze</h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
            }}
          >
            {!accountId && (
              <label>
                UUID konta właściciela
                <input
                  value={newAcctId}
                  onChange={(e) => setNewAcctId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-..."
                />
              </label>
            )}
            <label>
              Nick postaci (3–16 znaków)
              <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={16} />
            </label>
            <label>
              Rasa
              <select
                value={newRace}
                onChange={(e) => setNewRace(e.target.value as AndroidCharacterAdmin["race"])}
              >
                {Object.entries(RACE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Poziom startowy
              <input
                type="number"
                min={1}
                max={100}
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
              />
            </label>
            <label>
              Złoto startowe
              <input
                type="number"
                min={0}
                max={10000000}
                value={newGold}
                onChange={(e) => setNewGold(e.target.value)}
              />
            </label>
          </div>
          <button
            style={{ marginTop: 10 }}
            onClick={() => void handleCreate()}
            disabled={!newName.trim()}
          >
            Utwórz postać w PostgreSQL
          </button>
        </div>
      )}

      <div className="ki-table-scroll">
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>Postać</th>
              {!accountId && <th>Konto</th>}
              <th>Rasa / Kontynent</th>
              <th>Poziom / PD</th>
              <th>Złoto / Bank</th>
              <th>Statystyki (serwer)</th>
              <th>Zmieniono</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chars.map((c) => (
              <tr
                key={c.id}
                style={
                  c.id === selectedId ? { background: "rgba(241, 199, 127, 0.12)" } : undefined
                }
              >
                <td>
                  <b>{c.name}</b>
                  <br />
                  <small>rew. {c.revision}</small>
                </td>
                {!accountId && (
                  <td>
                    {c.ownerNick ?? "—"}
                    <br />
                    <small>{c.ownerEmail ?? c.accountId}</small>
                  </td>
                )}
                <td>
                  {RACE_NAMES[c.race]}
                  <br />
                  <small>Kontynent: {LAND_NAMES[c.land]}</small>
                </td>
                <td>
                  Poz. <b>{c.level}</b>
                  <br />
                  <small>
                    PD {c.state.xp}/{c.stats.xpNeeded}
                  </small>
                </td>
                <td>
                  <b>{c.gold}</b> zł
                  <br />
                  <small>Bank: {c.state.bankGold} zł</small>
                </td>
                <td>
                  <small>
                    HP {c.state.hp}/{c.stats.maxHp} · KI {c.state.ki}/{c.stats.maxKi}
                    <br />
                    ATK {c.stats.attack} · DEF {c.stats.defense} · SPD {c.stats.speed} · KRYT{" "}
                    {c.stats.critChance}%
                  </small>
                </td>
                <td>
                  <small>{when(c.updatedAt)}</small>
                </td>
                <td>
                  <button onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}>
                    {c.id === selectedId ? "Zamknij" : "Edytuj"}
                  </button>{" "}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(`Usunąć postać ${c.name}? Tej operacji nie można cofnąć.`)
                        )
                          void godotAdminDeleteCharacter(c.id)
                            .then(() => {
                              if (selectedId === c.id) setSelectedId(null);
                              setInfo(`Usunięto postać ${c.name}.`);
                              return reload();
                            })
                            .catch((e: unknown) => setError(errMsg(e)));
                      }}
                    >
                      Usuń
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {chars.length === 0 && (
              <tr>
                <td colSpan={accountId ? 7 : 8}>Brak autorytatywnych postaci Android.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <CharacterEditor
          key={`${selected.id}-${selected.revision}`}
          character={selected}
          catalog={catalog}
          isAdmin={isAdmin}
          onSaved={async (msg) => {
            setInfo(msg);
            setError("");
            await reload();
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </section>
  );
}

function CharacterEditor({
  character,
  catalog,
  isAdmin,
  onSaved,
  onError,
}: {
  character: AndroidCharacterAdmin;
  catalog: AndroidItemDef[];
  isAdmin: boolean;
  onSaved: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(character.name);
  const [race, setRace] = useState(character.race);
  const [land, setLand] = useState(character.land);
  const [level, setLevel] = useState(String(character.level));
  const [xp, setXp] = useState(String(character.state.xp));
  const [gold, setGold] = useState(String(character.gold));
  const [bankGold, setBankGold] = useState(String(character.state.bankGold));
  const [hp, setHp] = useState(String(character.state.hp));
  const [ki, setKi] = useState(String(character.state.ki));
  const [freeStatPoints, setFreeStatPoints] = useState(String(character.state.freeStatPoints));
  const [skillPoints, setSkillPoints] = useState(String(character.state.skillPoints));
  const [bonusStats, setBonusStats] = useState({ ...character.state.bonusStats });
  const [equipment, setEquipment] = useState<Record<string, string | null>>({
    ...character.state.equipment,
  });
  const [backpack, setBackpack] = useState<(AndroidItemStack | null)[]>(
    character.state.backpack.map((s) => (s ? { ...s } : null)),
  );
  const [bankItems, setBankItems] = useState<(AndroidItemStack | null)[]>(
    character.state.bankItems.map((s) => (s ? { ...s } : null)),
  );
  const [nodesText, setNodesText] = useState(character.state.unlockedNodes.join(", "));
  const [completedQuests, setCompletedQuests] = useState<Record<string, string>>({
    ...character.state.completedQuests,
  });
  const [addItemId, setAddItemId] = useState(catalog[0]?.id ?? "potion_hp");
  const [addQty, setAddQty] = useState("1");
  const [addTarget, setAddTarget] = useState<"backpack" | "bank">("backpack");
  const [saving, setSaving] = useState(false);

  const itemName = (id: string) => catalog.find((i) => i.id === id)?.name ?? id;

  const addItem = () => {
    const qty = Math.max(1, Math.min(999, Number(addQty) || 1));
    const list = addTarget === "backpack" ? [...backpack] : [...bankItems];
    const existingIdx = list.findIndex((s) => s && s.id === addItemId);
    if (existingIdx !== -1 && list[existingIdx]) {
      list[existingIdx] = { id: addItemId, qty: Math.min(999, list[existingIdx]!.qty + qty) };
    } else {
      const empty = list.findIndex((s) => s === null);
      if (empty === -1) {
        onError(
          addTarget === "backpack" ? "Plecak jest pełny (15/15)." : "Bank jest pełny (12/12).",
        );
        return;
      }
      list[empty] = { id: addItemId, qty };
    }
    if (addTarget === "backpack") setBackpack(list);
    else setBankItems(list);
  };

  const save = async () => {
    setSaving(true);
    try {
      const unlockedNodes = nodesText
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const res = await godotAdminUpdateCharacter(character.id, {
        name: name.trim(),
        race,
        land,
        level: Number(level) || 1,
        xp: Math.max(0, Number(xp) || 0),
        gold: Math.max(0, Number(gold) || 0),
        bankGold: Math.max(0, Number(bankGold) || 0),
        hp: Math.max(1, Number(hp) || 1),
        ki: Math.max(0, Number(ki) || 0),
        freeStatPoints: Math.max(0, Number(freeStatPoints) || 0),
        skillPoints: Math.max(0, Number(skillPoints) || 0),
        bonusStats,
        equipment,
        backpack,
        bankItems,
        unlockedNodes,
        completedQuests,
      });
      await onSaved(
        `Zapisano postać ${res.character.name} (rewizja ${res.character.revision}) w PostgreSQL.`,
      );
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 14, border: "1px solid #d4a656", borderRadius: 10 }}>
      <h4>
        Pełna edycja postaci: {character.name} (rew. {character.revision})
      </h4>
      <p>
        <small>
          Efektywne statystyki na serwerze: <b>HP {character.stats.maxHp}</b> ·{" "}
          <b>KI {character.stats.maxKi}</b> · <b>ATK {character.stats.attack}</b> ·{" "}
          <b>DEF {character.stats.defense}</b> · <b>SPD {character.stats.speed}</b> ·{" "}
          <b>KRYT {character.stats.critChance}%</b>
        </small>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        <label>
          Nick postaci
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Rasa
          <select
            value={race}
            onChange={(e) => setRace(e.target.value as AndroidCharacterAdmin["race"])}
            disabled={!isAdmin}
          >
            {Object.entries(RACE_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Aktualny kontynent
          <select
            value={land}
            onChange={(e) => setLand(e.target.value as AndroidCharacterAdmin["land"])}
            disabled={!isAdmin}
          >
            {Object.entries(LAND_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Poziom (1–100)
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          PD (XP)
          <input
            type="number"
            min={0}
            value={xp}
            onChange={(e) => setXp(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Złoto w sakwie
          <input
            type="number"
            min={0}
            value={gold}
            onChange={(e) => setGold(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Złoto w banku
          <input
            type="number"
            min={0}
            value={bankGold}
            onChange={(e) => setBankGold(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Aktualne HP
          <input
            type="number"
            min={1}
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Aktualne KI
          <input
            type="number"
            min={0}
            value={ki}
            onChange={(e) => setKi(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Wolne pkt statystyk
          <input
            type="number"
            min={0}
            value={freeStatPoints}
            onChange={(e) => setFreeStatPoints(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          Punkty umiejętności
          <input
            type="number"
            min={0}
            value={skillPoints}
            onChange={(e) => setSkillPoints(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
      </div>

      <h5 style={{ marginTop: 14 }}>Przydzielone punkty statystyk</h5>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
        }}
      >
        {STAT_LABELS.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={0}
              max={500}
              value={bonusStats[key]}
              disabled={!isAdmin}
              onChange={(e) =>
                setBonusStats((prev) => ({
                  ...prev,
                  [key]: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </label>
        ))}
      </div>

      <h5 style={{ marginTop: 14 }}>Założony ekwipunek (8 slotów)</h5>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {EQUIP_SLOT_LABELS.map((label, slotIdx) => {
          const validItems = catalog.filter((i) => i.slot === slotIdx);
          const key = String(slotIdx);
          return (
            <label key={key}>
              {label}
              <select
                value={equipment[key] ?? ""}
                disabled={!isAdmin}
                onChange={(e) =>
                  setEquipment((prev) => ({ ...prev, [key]: e.target.value || null }))
                }
              >
                <option value="">— pusty —</option>
                {validItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.desc})
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <h5 style={{ marginTop: 14 }}>Plecak (15) i Depozyt Bankowy (12)</h5>
      {isAdmin && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <select value={addItemId} onChange={(e) => setAddItemId(e.target.value)}>
            {catalog.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.cat})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={999}
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            style={{ width: 70 }}
          />
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value as "backpack" | "bank")}
          >
            <option value="backpack">Do plecaka</option>
            <option value="bank">Do banku</option>
          </select>
          <button type="button" onClick={addItem}>
            + Dodaj przedmiot
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <strong>Plecak</strong>
          <ul style={{ marginTop: 4 }}>
            {backpack.map((s, idx) =>
              s ? (
                <li key={idx}>
                  [{idx}] {itemName(s.id)} ×{s.qty}{" "}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setBackpack((prev) => prev.map((x, i) => (i === idx ? null : x)))
                      }
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ) : null,
            )}
            {backpack.every((s) => s === null) && <li>Pusty plecak</li>}
          </ul>
        </div>
        <div>
          <strong>Bank (depozyt)</strong>
          <ul style={{ marginTop: 4 }}>
            {bankItems.map((s, idx) =>
              s ? (
                <li key={idx}>
                  [{idx}] {itemName(s.id)} ×{s.qty}{" "}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setBankItems((prev) => prev.map((x, i) => (i === idx ? null : x)))
                      }
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ) : null,
            )}
            {bankItems.every((s) => s === null) && <li>Pusty bank</li>}
          </ul>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
        <label>
          Odblokowane węzły talentów (np. R, A1, B1)
          <input
            value={nodesText}
            onChange={(e) => setNodesText(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <div>
          <strong>Ukończone zlecenia ({Object.keys(completedQuests).length})</strong>
          <div>
            {Object.keys(completedQuests).length === 0 ? (
              <small>Brak</small>
            ) : (
              Object.keys(completedQuests).map((qid) => (
                <span key={qid} style={{ marginRight: 8 }}>
                  <code>{qid}</code>{" "}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setCompletedQuests((prev) => {
                          const next = { ...prev };
                          delete next[qid];
                          return next;
                        })
                      }
                    >
                      Resetuj
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button disabled={saving} onClick={() => void save()}>
            {saving ? "Zapisywanie…" : "💾 Zapisz zmiany postaci w PostgreSQL"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminAndroidCharacters;
