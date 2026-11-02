import { CHARACTER_STAT_FIELDS, type CharacterStats } from "@/game/characterStats";
import { useCallback, useEffect, useState } from "react";
import { accountsDb, type CharacterRow } from "@/game/account/cloudPort";
import { applyEdit, summarize, type CharacterEdit, type QuestStatus } from "@/game/account/gmEdit";
import { KIT_NODES } from "@/game/kit";
import { MATERIALS, MATERIAL_IDS } from "@/game/monsters/materials";
import { playtestSaveKey } from "@/game/playtest";
import { ITEMS, ITEM_IDS, QUEST_NAMES, type ItemId, type QuestId } from "@/game/session";
import { SuperiorCharacterStore } from "@/game/world/generated/superiorCharacters";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { RACES } from "@/game/world/races";
import "./coder-panel.css";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

/** Characters saved in this browser (local playtest saves); server characters live in "Postacie (live)". */
export default function CoderAdminPanel() {
  return (
    <section className="ki-admin-panel">
      <LocalCharactersPanel />
    </section>
  );
}

function LocalCharactersPanel() {
  const [keys, setKeys] = useState<{ key: string; raw: unknown }[]>([]);
  const [message, setMessage] = useState("");

  const reload = useCallback(() => {
    try {
      const store = new SuperiorCharacterStore(
        window.localStorage,
        playtestSaveKey(window.location.search),
      );
      const list = store.list();
      const found: { key: string; raw: unknown }[] = [];
      for (const slot of list) {
        const text = window.localStorage.getItem(slot.key);
        if (!text) continue;
        try {
          found.push({ key: slot.key, raw: JSON.parse(text) });
        } catch {
          /* ignore malformed */
        }
      }
      setKeys(found);
    } catch {
      setMessage("Pamięć lokalna przeglądarki jest niedostępna.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="ki-admin-panel">
      <h2>Postacie zapisane lokalnie na tym urządzeniu ({keys.length})</h2>
      {message && <p className="ki-account-ok">{message}</p>}
      {keys.length === 0 && (
        <p>
          <small>Brak postaci na tym urządzeniu. Utwórz postać na ekranie startowym gry.</small>
        </p>
      )}
      {keys.map((entry) => (
        <CharacterEditor
          key={entry.key}
          row={{
            user_id: "local",
            save_key: entry.key,
            data: entry.raw,
            revision: 1,
            updated_at: new Date().toISOString(),
            updated_by: null,
          }}
          onSaveData={async (nextData) => {
            window.localStorage.setItem(entry.key, JSON.stringify(nextData));
            setMessage(`Zapisano postać lokalną (${entry.key}).`);
            reload();
          }}
        />
      ))}
    </section>
  );
}

export function CharacterEditor({
  row,
  onSaved,
  onSaveData,
}: {
  row: CharacterRow;
  onSaved?: () => Promise<void>;
  onSaveData?: (data: unknown) => Promise<void>;
}) {
  const summary = summarize(row.data)!;
  const [edit, setEdit] = useState<CharacterEdit>({});
  const [status, setStatus] = useState("");
  const [matToAdd, setMatToAdd] = useState(MATERIAL_IDS[0] ?? "");
  const [matQty, setMatQty] = useState(5);

  const value = (k: "level" | "xp" | "hp" | "ki" | "gold" | "x" | "y" | "respecs") =>
    edit[k] ?? summary[k];
  const item = (id: ItemId) => edit.items?.[id] ?? summary.items[id];
  const depotItem = (id: ItemId) => edit.depotItems?.[id] ?? summary.depotItems[id];
  const skills = edit.skills ?? summary.skills;
  const materials = { ...summary.materials, ...(edit.materials ?? {}) };

  const save = async () => {
    const result = applyEdit(row.data, edit);
    if (!result.ok) {
      setStatus(result.reason);
      return;
    }
    if (onSaveData) {
      await onSaveData(result.data);
      setStatus("Zapisano postać na urządzeniu.");
      setEdit({});
      return;
    }
    const { data, error } = await accountsDb
      .from("characters")
      .update({ data: result.data })
      .eq("user_id", row.user_id)
      .eq("save_key", row.save_key)
      .eq("revision", row.revision)
      .select("revision");
    if (error) setStatus(error.message);
    else if (!data.length)
      setStatus("Gracz zapisał postęp w międzyczasie. Odśwież i spróbuj ponownie.");
    else {
      setStatus("Zapisano. Gracz dostanie zmianę przy następnym wejściu do gry.");
      setEdit({});
      await onSaved?.();
    }
  };
  const num = (raw: string) => (raw === "" ? NaN : Number(raw));
  return (
    <article className="ki-admin-panel" style={{ marginBottom: 12 }}>
      <b>
        {summary.name ? `${summary.name} · ` : ""}
        {RACES[summary.race]?.name ?? summary.race} · poziom {summary.level}
      </b>{" "}
      <small>
        {summary.feature ?? summary.continent} · ({Math.round(summary.x)}, {Math.round(summary.y)})
        · wersja {row.revision} · zmiana {when(row.updated_at)}
      </small>
      <div className="ki-admin-fields" style={{ marginTop: 8 }}>
        {(
          [
            ["level", "Poziom (1–100)"],
            ["xp", "Doświadczenie"],
            ["hp", "Życie (HP)"],
            ["ki", "Energia (KI)"],
            ["gold", "Złoto"],
            ["x", "Pozycja X"],
            ["y", "Pozycja Y"],
            ["respecs", "Resety drzewka"],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              value={Number.isNaN(value(k)) ? "" : Math.round(value(k))}
              onChange={(e) => setEdit({ ...edit, [k]: num(e.target.value) })}
            />
          </label>
        ))}

        <fieldset className="ki-admin-stat-overrides">
          <legend>Indywidualne parametry postaci</legend>
          <p>
            Stałe wartości końcowe. Puste pole przywraca statystykę rasy, poziomu i wyposażenia.
            Zmiany działają po ponownym wejściu do gry.
          </p>
          {Object.entries(CHARACTER_STAT_FIELDS).map(([id, field]) => {
            const key = id as keyof CharacterStats;
            return (
              <label key={key}>
                {field.label}
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step="any"
                  placeholder="Domyślna"
                  value={(edit.statOverrides ?? summary.statOverrides)[key] ?? ""}
                  onChange={(event) => {
                    const values = { ...(edit.statOverrides ?? summary.statOverrides) };
                    if (event.target.value === "") delete values[key];
                    else values[key] = Number(event.target.value);
                    setEdit({ ...edit, statOverrides: values });
                  }}
                />
              </label>
            );
          })}
          <button type="button" onClick={() => setEdit({ ...edit, statOverrides: {} })}>
            Przywróć parametry domyślne
          </button>
        </fieldset>

        <label>
          Ląd (Feature)
          <select
            value={edit.feature ?? summary.feature ?? summary.continent}
            onChange={(e) => setEdit({ ...edit, feature: e.target.value as FeatureId })}
          >
            {FEATURE_IDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label>
          Założona broń
          <select
            value={(edit.weapon !== undefined ? edit.weapon : summary.weapon) ?? ""}
            onChange={(e) =>
              setEdit({ ...edit, weapon: e.target.value === "sword" ? "sword" : null })
            }
          >
            <option value="">Brak</option>
            <option value="sword">Ostrze strażnika</option>
          </select>
        </label>

        <label>
          Ulepszenie miecza
          <select
            value={String(edit.upgrade ?? summary.upgrade)}
            onChange={(e) => setEdit({ ...edit, upgrade: Number(e.target.value) })}
          >
            <option value="0">0 (zwykłe)</option>
            <option value="1">+1 (ulepszone)</option>
          </select>
        </label>

        <label>
          Założony pancerz
          <select
            value={(edit.armor !== undefined ? edit.armor : summary.armor) ?? ""}
            onChange={(e) => setEdit({ ...edit, armor: e.target.value === "vest" ? "vest" : null })}
          >
            <option value="">Brak</option>
            <option value="vest">Kamizelka podróżnika</option>
          </select>
        </label>

        {ITEM_IDS.map((id) => (
          <label key={id}>
            {ITEMS[id].name} (plecak)
            <input
              type="number"
              value={Number.isNaN(item(id)) ? "" : item(id)}
              onChange={(e) =>
                setEdit({ ...edit, items: { ...edit.items, [id]: num(e.target.value) } })
              }
            />
          </label>
        ))}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary>
          <small>
            Depozyt (skrzynia), Materiały ({Object.keys(materials).length}), Drzewko (
            {skills.length}) i Zadania
          </small>
        </summary>
        <div className="ki-admin-fields" style={{ marginTop: 8 }}>
          {ITEM_IDS.map((id) => (
            <label key={"depot-" + id}>
              Depozyt: {ITEMS[id].name}
              <input
                type="number"
                value={Number.isNaN(depotItem(id)) ? "" : depotItem(id)}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    depotItems: { ...edit.depotItems, [id]: num(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          {(["steps", "boars", "gear"] as QuestId[]).map((qid) => (
            <label key={qid}>
              Zadanie: {QUEST_NAMES[qid]}
              <select
                value={edit.quests?.[qid] ?? summary.quests[qid]}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    quests: { ...edit.quests, [qid]: e.target.value as QuestStatus },
                  })
                }
              >
                <option value="locked">locked</option>
                <option value="active">active</option>
                <option value="ready">ready</option>
                <option value="done">done</option>
              </select>
            </label>
          ))}
        </div>

        <h4 style={{ margin: "10px 0 6px" }}>Materiały w plecaku</h4>
        <div className="ki-account-actions" style={{ marginTop: 4 }}>
          <select value={matToAdd} onChange={(e) => setMatToAdd(e.target.value)}>
            {MATERIAL_IDS.map((id) => (
              <option key={id} value={id}>
                {MATERIALS[id]!.name} ({id})
              </option>
            ))}
          </select>
          <input
            type="number"
            style={{ width: 70 }}
            value={matQty}
            onChange={(e) => setMatQty(Number(e.target.value) || 0)}
          />
          <button
            onClick={() =>
              setEdit({
                ...edit,
                materials: { ...edit.materials, [matToAdd]: Math.max(0, Math.min(99, matQty)) },
              })
            }
          >
            Ustaw materiał
          </button>
        </div>
        <div className="ki-account-actions" style={{ marginTop: 6 }}>
          {Object.entries(materials)
            .filter(([, count]) => count > 0)
            .map(([id, count]) => (
              <span
                key={id}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #6b5a3a",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                }}
              >
                {MATERIALS[id]?.name ?? id}: <b>{count}</b>{" "}
                <button
                  style={{ padding: "1px 5px", marginLeft: 4 }}
                  onClick={() => setEdit({ ...edit, materials: { ...edit.materials, [id]: 0 } })}
                >
                  ×
                </button>
              </span>
            ))}
        </div>

        <h4 style={{ margin: "10px 0 6px" }}>Drzewko umiejętności ({skills.join(", ")})</h4>
        <div className="ki-account-actions" style={{ marginTop: 4 }}>
          <button onClick={() => setEdit({ ...edit, skills: ["R"] })}>
            Zresetuj drzewko do [R]
          </button>
          {KIT_NODES[summary.race].map((n) => {
            const active = skills.includes(n.id);
            return (
              <button
                key={n.id}
                aria-pressed={active}
                onClick={() => {
                  if (n.id === "R") return;
                  const next = active ? skills.filter((s) => s !== n.id) : [...skills, n.id];
                  setEdit({ ...edit, skills: next });
                }}
              >
                {n.id} ({n.name}) {active ? "✓" : ""}
              </button>
            );
          })}
        </div>
      </details>
      <div className="ki-account-actions">
        <button
          className="ki-account-primary"
          disabled={Object.keys(edit).length === 0}
          onClick={() => void save()}
        >
          Zapisz zmiany
        </button>
        {Object.keys(edit).length > 0 && <button onClick={() => setEdit({})}>Cofnij</button>}
      </div>
      {status && <p>{status}</p>}
      <details>
        <summary>
          <small>Pełny zapis (podgląd)</small>
        </summary>
        <textarea readOnly value={JSON.stringify(row.data, null, 2)} />
      </details>
    </article>
  );
}
