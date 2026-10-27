import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/account/useAccount";
import {
  accountsDb,
  type AppRole,
  type AuditRow,
  type CharacterRow,
  type Profile,
  type RoleRow,
} from "@/game/account/cloudPort";
import { fromCloud } from "@/game/account/cloudSaves";
import { applyEdit, summarize, type CharacterEdit } from "@/game/account/gmEdit";
import { ITEMS, ITEM_IDS, type ItemId } from "@/game/session";
import { MONSTER_BASE } from "@/game/monsters/base.generated";
import { ALL_QUESTS_V2 } from "@/game/quests/engine";
import { BOSS_CATALOG } from "@/game/bosses/catalog";
import { RACES } from "@/game/world/races";
import "@/components/account/account.css";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel administracyjny · Ki Legends" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

const CoderAdminPanel = lazy(() => import("@/components/admin/CoderAdminPanel"));

const ROLE_NAME: Record<AppRole, string> = { admin: "administrator", gm: "game master" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

function AdminPage() {
  const account = useAccount();
  const [tab, setTab] = useState<"players" | "audit" | "content" | "coder">("players");
  if (!account.ready) return <main className="ki-account">Wczytywanie…</main>;
  if (!account.session || account.roles.length === 0)
    return (
      <main className="ki-account">
        <section className="ki-account-card">
          <h1>Brak dostępu</h1>
          <p>Panel jest dostępny tylko dla administratorów i game masterów.</p>
          <Link to="/konto">Przejdź do konta</Link>
        </section>
      </main>
    );
  const isAdmin = account.roles.includes("admin");
  return (
    <main className="ki-account">
      <div className="ki-admin">
        <h1>Panel administracyjny</h1>
        <small>
          {account.profile?.nick} · {account.roles.map((r) => ROLE_NAME[r]).join(", ")} ·{" "}
          <Link to="/konto">konto</Link> · <Link to="/">gra</Link>
        </small>
        <div className="ki-admin-tabs" role="tablist">
          {(
            [
              ["players", "Gracze"],
              ["audit", "Dziennik zmian"],
              ["content", "Zawartość gry"],
              ["coder", "Coder · Edytor świata"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "players" && <Players me={account.session.user.id} isAdmin={isAdmin} />}
        {tab === "audit" && <Audit />}
        {tab === "content" && <Content />}
        {tab === "coder" && (
          <div className="ki-coder-panel">
            <p>
              Edytor Coder. Nadpisania świata są zapisywane na tym urządzeniu; można je eksportować
              do JSON.
            </p>
            <Suspense fallback={<p role="status">Wczytywanie edytora…</p>}>
              <CoderAdminPanel />
            </Suspense>
          </div>
        )}
      </div>
    </main>
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
  const load = useCallback(async () => {
    const { data, error } = await accountsDb
      .from("characters")
      .select("*")
      .eq("user_id", player.id)
      .order("save_key");
    if (error) setMessage(error.message);
    setRows(data ?? []);
  }, [player.id]);
  useEffect(() => void load(), [load]);

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

function CharacterEditor({ row, onSaved }: { row: CharacterRow; onSaved: () => Promise<void> }) {
  const summary = summarize(row.data)!;
  const [edit, setEdit] = useState<CharacterEdit>({});
  const [status, setStatus] = useState("");
  const value = (k: "level" | "xp" | "hp" | "gold") => edit[k] ?? summary[k];
  const item = (id: ItemId) => edit.items?.[id] ?? summary.items[id];
  const save = async () => {
    const result = applyEdit(row.data, edit);
    if (!result.ok) {
      setStatus(result.reason);
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
      await onSaved();
    }
  };
  const num = (raw: string) => (raw === "" ? NaN : Number(raw));
  return (
    <article className="ki-admin-panel" style={{ marginBottom: 12 }}>
      <b>
        {RACES[summary.race]?.name ?? summary.race} · poziom {summary.level}
      </b>{" "}
      <small>
        {summary.continent} · wersja {row.revision} · zmiana {when(row.updated_at)}
      </small>
      <div className="ki-admin-fields" style={{ marginTop: 8 }}>
        {(["level", "xp", "hp", "gold"] as const).map((k) => (
          <label key={k}>
            {{ level: "Poziom", xp: "Doświadczenie", hp: "Życie", gold: "Złoto" }[k]}
            <input
              type="number"
              value={Number.isNaN(value(k)) ? "" : value(k)}
              onChange={(e) => setEdit({ ...edit, [k]: num(e.target.value) })}
            />
          </label>
        ))}
        {ITEM_IDS.map((id) => (
          <label key={id}>
            {ITEMS[id].name}
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
  for (const k of ["level", "xp", "hp", "gold"] as const)
    if (a[k] !== b[k]) out.push(`${k}: ${a[k]} → ${b[k]}`);
  for (const id of ITEM_IDS)
    if (a.items[id] !== b.items[id]) out.push(`${ITEMS[id].name}: ${a.items[id]} → ${b.items[id]}`);
  return out.join(", ") || "bez zmian w polach postaci";
}

function Content() {
  const [kind, setKind] = useState<"monsters" | "items" | "quests" | "bosses">("monsters");
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const table = useMemo(() => {
    if (kind === "monsters")
      return {
        head: ["Potwór", "Kraina", "Poz.", "HP", "ATK", "DEF", "XP", "Rozmiar", "Łup"],
        rows: MONSTER_BASE.map((m) => [
          m.name,
          m.world,
          m.level,
          m.hp,
          m.atk,
          m.def,
          m.xp,
          m.size,
          m.loot.join(", "),
        ]),
      };
    if (kind === "items")
      return {
        head: ["Przedmiot", "Atak", "Obrona", "Cena", "Skup"],
        rows: ITEM_IDS.map((id) => [
          ITEMS[id].name,
          ITEMS[id].attack,
          ITEMS[id].defense,
          ITEMS[id].price,
          ITEMS[id].sell,
        ]),
      };
    if (kind === "quests")
      return {
        head: ["Zadanie", "Kraina", "Poz.", "Zleca", "Nagroda"],
        rows: ALL_QUESTS_V2.map((x) => [
          x.title,
          x.continent,
          x.recommendedLevel,
          x.giverName,
          `${x.reward.xp} XP` + (x.reward.coins ? ` · ${x.reward.coins} monet` : ""),
        ]),
      };
    return {
      head: ["Boss", "Tytuł", "Kraina", "Poz.", "HP", "ATK", "DEF"],
      rows: BOSS_CATALOG.map((b) => [
        b.name,
        b.title,
        b.continent,
        b.level,
        b.stats.hp,
        b.stats.atk,
        b.stats.def,
      ]),
    };
  }, [kind]);
  const rows = table.rows.filter((r) => r.join(" ").toLowerCase().includes(q));
  return (
    <section className="ki-admin-panel">
      <div className="ki-admin-tabs">
        {(
          [
            ["monsters", `Potwory (${MONSTER_BASE.length})`],
            ["items", `Przedmioty (${ITEM_IDS.length})`],
            ["quests", `Zadania (${ALL_QUESTS_V2.length})`],
            ["bosses", `Bossowie (${BOSS_CATALOG.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-selected={kind === id} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
        <input placeholder="Filtruj…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p>
        <small>
          Podgląd tylko do odczytu. Liczby pochodzą z dokumentów właściciela; ich edycja z panelu to
          osobny etap.
        </small>
      </p>
      <table className="ki-admin-table">
        <thead>
          <tr>
            {table.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{String(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
