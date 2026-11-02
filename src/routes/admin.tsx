import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/account/useAccount";
import {
  adminAccounts,
  adminAudit,
  adminSetRole,
  type AdminAccount,
  type AdminAuditRow,
  type AppRole,
} from "@/game/account/vpsAuth";

import "@/components/account/account.css";
import { AdminPublications } from "@/components/admin/AdminPublications";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Panel administracyjny · Ki Legends" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

const CoderAdminPanel = lazy(() => import("@/components/admin/CoderAdminPanel"));
const AdminMonitoringCenter = lazy(() =>
  import("@/components/admin/AdminMonitoringCenter").then((m) => ({
    default: m.AdminMonitoringCenter,
  })),
);
const ServerCharacterManager = lazy(() => import("@/components/admin/ServerCharacterManager"));
const AdminWorldEditor = lazy(() =>
  import("@/components/admin/AdminWorldEditor").then((m) => ({
    default: m.AdminWorldEditor,
  })),
);

const ROLE_NAME: Record<AppRole, string> = { admin: "administrator", gm: "game master" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

function AdminPage() {
  const account = useAccount();
  const [tab, setTab] = useState<
    "server-chars" | "players" | "monitoring" | "audit" | "content" | "coder"
  >("server-chars");
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
              ["server-chars", "Postacie (live)"],
              ["players", "Konta i role"],
              ["monitoring", "Serwer"],
              ["content", "Świat i zawartość"],
              ["audit", "Dziennik"],
              ["coder", "Postacie lokalne"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "server-chars" && (
          <Suspense fallback={<p role="status">Wczytywanie menedżera postaci serwerowych…</p>}>
            <ServerCharacterManager />
          </Suspense>
        )}
        {tab === "players" && <Players me={account.session.user.id} isAdmin={isAdmin} />}
        {tab === "monitoring" && (
          <Suspense fallback={<p role="status">Wczytywanie telemetrii i monitoringu…</p>}>
            <AdminMonitoringCenter />
          </Suspense>
        )}
        {tab === "audit" && (
          <>
            <section className="ki-admin-panel">
              <h3>Publikacje na produkcji</h3>
              <AdminPublications />
            </section>
            <section className="ki-admin-panel">
              <h3>Zmiany wykonane w panelu</h3>
              <Audit />
            </section>
          </>
        )}
        {tab === "content" && (
          <Suspense fallback={<p role="status">Wczytywanie edytora zawartości…</p>}>
            <AdminWorldEditor />
          </Suspense>
        )}
        {tab === "coder" && (
          <Suspense fallback={<p role="status">Wczytywanie postaci lokalnych…</p>}>
            <CoderAdminPanel />
          </Suspense>
        )}
      </div>
    </main>
  );
}

function Players({ me, isAdmin }: { me: string; isAdmin: boolean }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setAccounts(await adminAccounts());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => void reload(), [reload]);
  const q = query.toLowerCase();
  const shown = accounts.filter(
    (a) => a.nick.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
  );
  const player = accounts.find((a) => a.id === selected);
  const setRole = async (role: AppRole, granted: boolean) => {
    if (!player) return;
    try {
      await adminSetRole(player.id, role, granted);
      setMessage(granted ? "Nadano rolę." : "Odebrano rolę.");
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="ki-admin-grid">
      <section>
        <input
          placeholder="Szukaj nicku lub e-maila…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj gracza"
        />
        <p>
          <small>
            Kont: {accounts.length} · aktywnych: {accounts.filter((a) => a.confirmed).length}
          </small>
        </p>
        {error && <p className="ki-account-error">{error}</p>}
        <div className="ki-admin-list">
          {shown.map((a) => (
            <button key={a.id} aria-pressed={a.id === selected} onClick={() => setSelected(a.id)}>
              <b>{a.nick}</b> {a.roles.map((r) => ROLE_NAME[r]).join(", ")}
              {!a.confirmed && <small> · nieaktywne</small>}
              <br />
              <small>ostatnio: {when(a.lastLoginAt)}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="ki-admin-panel">
        {player ? (
          <>
            <h2>{player.nick}</h2>
            <p>
              E-mail: {player.email}
              <br />
              Status: {player.confirmed ? "aktywne" : "czeka na aktywację z e-maila"}
              <br />
              <small>
                Konto od {when(player.createdAt)} · ostatnie logowanie {when(player.lastLoginAt)}
              </small>
            </p>
            {isAdmin && player.id !== me && (
              <div className="ki-account-actions">
                {(["gm", "admin"] as const).map((role) =>
                  player.roles.includes(role) ? (
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
            <p className="ki-section-hint">
              Postacie gracza edytujesz w zakładce „Postacie (live)”.
            </p>
          </>
        ) : (
          <p>Wybierz gracza z listy.</p>
        )}
      </section>
    </div>
  );
}

const ACTION_NAMES: Record<string, string> = {
  REGISTER: "Rejestracja",
  CONFIRM_EMAIL: "Aktywacja e-mail",
  MIGRATE_ACCOUNT: "Przeniesienie konta na VPS",
  RESET_PASSWORD: "Zmiana hasła (link)",
  GRANT_ROLE: "Nadanie roli",
  REVOKE_ROLE: "Odebranie roli",
};

function Audit() {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    adminAudit()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <div className="ki-table-scroll">
      {error && <p className="ki-account-error">{error}</p>}
      <table className="ki-admin-table">
        <thead>
          <tr>
            <th>Kiedy</th>
            <th>Kto</th>
            <th>Co</th>
            <th>Komu</th>
            <th>Szczegóły</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.at)}</td>
              <td>{r.actor_nick ?? "system"}</td>
              <td>{ACTION_NAMES[r.action] ?? r.action}</td>
              <td>{r.target_nick ?? "—"}</td>
              <td>
                <small>{r.details ? JSON.stringify(r.details) : ""}</small>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !error && (
            <tr>
              <td colSpan={5}>Brak zmian.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
