import { CHARACTER_STAT_FIELDS, type CharacterStats } from "@/game/characterStats";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminWorldEditor } from "@/components/admin/AdminWorldEditor";
import { useAccount } from "@/components/account/useAccount";
import {
  accountsDb,
  type AppRole,
  type AuditRow,
  type CharacterRow,
  type Profile,
  type RoleRow,
} from "@/game/account/cloudPort";
import { applyEdit, summarize, type CharacterEdit, type QuestStatus } from "@/game/account/gmEdit";
import { KIT_NODES } from "@/game/kit";
import { MATERIALS, MATERIAL_IDS } from "@/game/monsters/materials";
import { playtestSaveKey } from "@/game/playtest";
import { ITEMS, ITEM_IDS, QUEST_NAMES, type ItemId, type QuestId } from "@/game/session";
import { SuperiorCharacterStore } from "@/game/world/generated/superiorCharacters";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { RACES } from "@/game/world/races";
import "./coder-panel.css";

const ROLE_NAME: Record<AppRole, string> = { admin: "administrator", gm: "game master" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

export default function CoderAdminPanel() {
  const account = useAccount();
  const [tab, setTab] = useState<"world" | "players" | "local" | "audit">("world");
  if (!account.ready) return <section className="ki-account">Wczytywanie…</section>;
  if (!account.session || account.roles.length === 0)
    return (
      <section className="ki-account">
        <section className="ki-account-card">
          <h1>Brak dostępu</h1>
          <p>Panel jest dostępny tylko dla administratorów i game masterów.</p>
          <Link to="/konto">Przejdź do konta</Link>
        </section>
      </section>
    );
  const isAdmin = account.roles.includes("admin");
  return (
    <section className="ki-account">
      <div className="ki-admin">
        <h1>Panel administracyjny i Edytor Świata</h1>
        <small>
          {account.profile?.nick} · {account.roles.map((r) => ROLE_NAME[r]).join(", ")} ·{" "}
          <Link to="/konto">konto</Link> · <Link to="/">gra</Link>
        </small>
        <div className="ki-admin-tabs" role="tablist">
          {(
            [
              ["world", "Panel Świata (Edytuj wszystko)"],
              ["players", "Gracze (Chmura)"],
              ["local", "Postacie lokalne (Urządzenie)"],
              ["audit", "Dziennik zmian"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "world" && <AdminWorldEditor />}
        {tab === "players" && <Players me={account.session.user.id} isAdmin={isAdmin} />}
        {tab === "local" && <LocalCharactersPanel />}
        {tab === "audit" && <Audit />}
      </div>
    </section>
  );
}

function LocalCharactersPanel() {
  const [keys, setKeys] = useState<{ key: string; raw: unknown; text: string }[]>([]);
  const [message, setMessage] = useState("");

  const reload = useCallback(() => {
    try {
      const store = new SuperiorCharacterStore(
        window.localStorage,
        playtestSaveKey(window.location.search),
      );
      const list = store.list();
      const found: { key: string; raw: unknown; text: string }[] = [];
      for (const slot of list) {
        const text = window.localStorage.getItem(slot.key);
        if (!text) continue;
        try {
          found.push({ key: slot.key, raw: JSON.parse(text), text });
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
    window.addEventListener("focus", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  return (
    <section className="ki-admin-panel">
      <h2>Postacie zapisane lokalnie na tym urządzeniu ({keys.length})</h2>
      <button type="button" onClick={reload}>
        Odśwież postacie lokalne
      </button>
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
            if (window.localStorage.getItem(entry.key) !== entry.text) {
              reload();
              throw new Error("Zapis postaci zmienił się. Wczytaj aktualne dane i ponów edycję.");
            }
            window.localStorage.setItem(entry.key, JSON.stringify(nextData));
            setMessage(`Zapisano postać lokalną (${entry.key}).`);
            reload();
          }}
        />
      ))}
    </section>
  );
}

function Players({ me, isAdmin }: { me: string; isAdmin: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const [p, r] = await Promise.all([
      accountsDb.from("profiles").select("*").order("created_at", { ascending: false }),
      accountsDb.from("user_roles").select("*"),
    ]);
    if (p.error || r.error) setError((p.error ?? r.error)!.message);
    setProfiles(p.data ?? []);
    setRoles(r.data ?? []);
  }, []);
  useEffect(() => void reload(), [reload]);
  const shown = profiles.filter((p) => p.nick.toLowerCase().includes(query.toLowerCase()));
  const player = profiles.find((p) => p.id === selected);
  return (
    <div className="ki-admin-grid">
      <section>
        <input
          placeholder="Szukaj nicku…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj gracza"
        />
        <p>
          <small>Graczy: {profiles.length}</small>
        </p>
        {error && <p className="ki-account-error">{error}</p>}
        <div className="ki-admin-list">
          {shown.map((p) => (
            <button key={p.id} aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>
              <b>{p.nick}</b>{" "}
              {roles
                .filter((r) => r.user_id === p.id)
                .map((r) => ROLE_NAME[r.role])
                .join(", ")}
              <br />
              <small>ostatnio: {when(p.last_seen)}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="ki-admin-panel">
        {player ? (
          <PlayerDetail
            key={player.id}
            player={player}
            roles={roles.filter((r) => r.user_id === player.id).map((r) => r.role)}
            me={me}
            isAdmin={isAdmin}
            onRolesChanged={reload}
          />
        ) : (
          <p>Wybierz gracza z listy.</p>
        )}
      </section>
    </div>
  );
}

function PlayerDetail({
  player,
  roles,
  me,
  isAdmin,
  onRolesChanged,
}: {
  player: Profile;
  roles: AppRole[];
  me: string;
  isAdmin: boolean;
  onRolesChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<CharacterRow[]>([]);
  const [message, setMessage] = useState("");
  const loadSequence = useRef(0);
  const invalidateLoads = useCallback(() => {
    loadSequence.current++;
  }, []);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const { data, error } = await accountsDb
      .from("characters")
      .select("*")
      .eq("user_id", player.id)
      .order("save_key");
    if (sequence !== loadSequence.current) return;
    if (error) {
      setMessage("Nie udało się odświeżyć postaci: " + error.message);
      return;
    }
    setRows(data ?? []);
  }, [player.id]);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      invalidateLoads();
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [load, invalidateLoads]);

  const setRole = async (role: AppRole, grant: boolean) => {
    const { error } = grant
      ? await accountsDb.from("user_roles").insert({ user_id: player.id, role, granted_by: me })
      : await accountsDb.from("user_roles").delete().eq("user_id", player.id).eq("role", role);
    setMessage(error ? error.message : grant ? "Nadano rolę." : "Odebrano rolę.");
    await onRolesChanged();
  };

  const characters = rows.filter((r) => summarize(r.data));
  const other = rows.filter((r) => !summarize(r.data));
  return (
    <>
      <h2>{player.nick}</h2>
      <p>
        <small>
          Konto od {when(player.created_at)} · ostatnio w grze {when(player.last_seen)}
        </small>
      </p>
      {isAdmin && player.id !== me && (
        <div className="ki-account-actions">
          {(["gm", "admin"] as const).map((role) =>
            roles.includes(role) ? (
              <button key={role} onClick={() => void setRole(role, false)}>
                Odbierz: {ROLE_NAME[role]}
              </button>
            ) : (
              <button key={role} onClick={() => void setRole(role, true)}>
                Nadaj: {ROLE_NAME[role]}
              </button>
            ),
          )}
        </div>
      )}
      {message && <p className="ki-account-ok">{message}</p>}
      <h3>Postacie ({characters.length})</h3>
      <button type="button" onClick={() => void load()}>
        Odśwież postacie z chmury
      </button>
      {characters.length === 0 && (
        <p>
          <small>Gracz nie ma jeszcze postaci w chmurze.</small>
        </p>
      )}
      {characters.map((row) => (
        <CharacterEditor key={row.save_key} row={row} onSaved={load} />
      ))}
      {other.length > 0 && (
        <details>
          <summary>Pozostałe zapisy ({other.length})</summary>
          {other.map((row) => (
            <p key={row.save_key}>
              <small>
                {row.save_key} · wersja {row.revision} · {when(row.updated_at)}
              </small>
            </p>
          ))}
        </details>
      )}
    </>
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
  const summary = useMemo(() => summarize(row.data)!, [row.data]);
  const [edit, setEditState] = useState<CharacterEdit>({});
  const [editBase, setEditBase] = useState<string | null>(null);
  const [statInputs, setStatInputs] = useState<Partial<Record<keyof CharacterStats, string>>>({});
  const source = useMemo(
    () => JSON.stringify([row.user_id, row.save_key, row.revision, row.data]),
    [row.user_id, row.save_key, row.revision, row.data],
  );
  const stale = editBase !== null && editBase !== source;
  const [saving, setSaving] = useState(false);
  const setEdit = (next: CharacterEdit) => {
    setEditState(next);
    setEditBase(Object.keys(next).length ? (editBase ?? source) : null);
    if (!Object.keys(next).length) setStatInputs({});
  };
  const previewStats = useMemo(() => {
    if (!Object.keys(edit).length) return summary.currentStats;
    const result = applyEdit(row.data, edit);
    return result.ok ? (summarize(result.data)?.currentStats ?? null) : summary.currentStats;
  }, [row.data, summary.currentStats, edit]);
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
    if (saving || stale) return;
    setSaving(true);
    try {
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
      else if (!data.length) {
        setStatus("Gracz zapisał postęp w międzyczasie. Wczytaj aktualne dane i spróbuj ponownie.");
        await onSaved?.();
      } else {
        setStatus("Zapisano. Gracz dostanie zmianę przy następnym wejściu do gry.");
        setEdit({});
        await onSaved?.();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się zapisać postaci.");
    } finally {
      setSaving(false);
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
      {stale && (
        <p role="alert">
          Zapis postaci zmienił się podczas edycji. Zapis zablokowany, aby nie nadpisać postępu.{" "}
          <button
            type="button"
            onClick={() => {
              setEdit({});
              setStatus("");
            }}
          >
            Wczytaj aktualne dane
          </button>
        </p>
      )}
      <fieldset
        className="ki-admin-fields"
        disabled={saving || stale}
        style={{ marginTop: 8, border: 0, padding: 0, minWidth: 0 }}
      >
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
            Aktualne wartości z ostatniego zapisu, obliczane tak samo jak w grze: rasa, poziom,
            trening, umiejętności, wyposażenie i nadpisania GM. Zmiana pola ustawia stałą wartość
            końcową; wyczyszczenie usuwa nadpisanie. Tymczasowe efekty aktywnej sesji nie są
            zapisywane. Zmiany działają po ponownym wejściu do gry.
          </p>
          {!previewStats && (
            <p role="alert">
              Nie można obliczyć statystyk tego zapisu. Nie pokazujemy wartości domyślnych zamiast
              danych postaci.
            </p>
          )}
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
                  placeholder={
                    previewStats
                      ? String(Number(previewStats[key].toFixed(6)))
                      : "Brak poprawnych danych"
                  }
                  value={
                    statInputs[key] ??
                    (previewStats
                      ? Number(previewStats[key].toFixed(6))
                      : ((edit.statOverrides ?? summary.statOverrides)[key] ?? ""))
                  }
                  onBlur={() => {
                    if (statInputs[key] === "")
                      setStatInputs((previous) => {
                        const next = { ...previous };
                        delete next[key];
                        return next;
                      });
                  }}
                  onChange={(event) => {
                    setStatInputs({ ...statInputs, [key]: event.target.value });
                    const values = { ...(edit.statOverrides ?? summary.statOverrides) };
                    if (event.target.value === "") delete values[key];
                    else values[key] = Number(event.target.value);
                    setEdit({ ...edit, statOverrides: values });
                  }}
                />
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setStatInputs({});
              setEdit({ ...edit, statOverrides: {} });
            }}
          >
            Przywróć parametry domyślne
          </button>
          {previewStats && (
            <p>
              Unik: {previewStats.dodgeChance}% · Premia szybkości ataku:{" "}
              {previewStats.attackSpeedPct}% · Technika: {previewStats.technique}
            </p>
          )}
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
              setEdit({
                ...edit,
                weapon:
                  e.target.value === "heritage"
                    ? "heritage"
                    : e.target.value === "sword"
                      ? "sword"
                      : null,
              })
            }
          >
            <option value="">Brak</option>
            <option value="sword">Ostrze strażnika</option>
            {summary.weapon === "heritage" && <option value="heritage">Broń dziedzictwa</option>}
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
      </fieldset>
      <details style={{ marginTop: 8 }}>
        <summary>
          <small>
            Depozyt (skrzynia), Materiały ({Object.keys(materials).length}), Drzewko (
            {skills.length}) i Zadania
          </small>
        </summary>
        <fieldset
          className="ki-admin-fields"
          disabled={saving || stale}
          style={{ marginTop: 8, border: 0, padding: 0, minWidth: 0 }}
        >
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
        </fieldset>

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
          disabled={saving || stale || Object.keys(edit).length === 0}
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

function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nicks, setNicks] = useState<Record<string, string>>({});
  useEffect(() => {
    void (async () => {
      const [a, p] = await Promise.all([
        accountsDb.from("admin_audit").select("*").order("at", { ascending: false }).limit(200),
        accountsDb.from("profiles").select("id, nick"),
      ]);
      setRows(a.data ?? []);
      setNicks(Object.fromEntries((p.data ?? []).map((x) => [x.id, x.nick])));
    })();
  }, []);
  const name = (id: string | null) => (id ? (nicks[id] ?? id.slice(0, 8)) : "system");
  return (
    <section className="ki-admin-panel">
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>Kiedy</th>
            <th>Kto</th>
            <th>Co</th>
            <th>Komu</th>
            <th>Zmiana</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.at)}</td>
              <td>{name(r.actor)}</td>
              <td>{r.action}</td>
              <td>{name(r.target_user)}</td>
              <td>
                <small>{describeChange(r)}</small>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>Brak zmian.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

/** Short "field: before → after" list for character edits. */
function describeChange(r: AuditRow): string {
  if (r.action.startsWith("role-")) return String(r.after ?? "");
  const a = summarize(r.before),
    b = summarize(r.after);
  if (!a || !b) return r.target_key ?? "";
  const out: string[] = [];
  for (const k of ["level", "xp", "hp", "ki", "gold"] as const)
    if (a[k] !== b[k]) out.push(`${k}: ${a[k]} → ${b[k]}`);
  for (const id of ITEM_IDS)
    if (a.items[id] !== b.items[id]) out.push(`${ITEMS[id].name}: ${a.items[id]} → ${b.items[id]}`);
  return out.join(", ") || "zmiana w polach postaci";
}
