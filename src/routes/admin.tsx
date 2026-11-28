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

const AdminServerStatus = lazy(() =>
  import("@/components/admin/AdminServerStatus").then((m) => ({
    default: m.AdminServerStatus,
  })),
);
const AdminGodotPanel = lazy(() => import("@/components/admin/AdminGodotPanel"));
const ServerCharacterManager = lazy(() => import("@/components/admin/ServerCharacterManager"));
const AdminWorldEditor = lazy(() =>
  import("@/components/admin/AdminWorldEditor").then((m) => ({
    default: m.AdminWorldEditor,
  })),
);

const AdminSuperiorOverview = lazy(() => import("@/components/admin/AdminSuperiorOverview"));

const ROLE_NAME: Record<AppRole, string> = { admin: "administrator", gm: "game master" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

function AdminPage() {
  const account = useAccount();
  const [tab, setTab] = useState<
    | "server-chars"
    | "players"
    | "monitoring"
    | "audit"
    | "content"
    | "diagnostyka"
    | "world-overview"
    | "android"
    | "logins"
  >(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("view") === "world-overview"
      ? "world-overview"
      : "server-chars",
  );
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
              ...(isAdmin ? [["world-overview", "Świat Superior"] as const] : []),
              ["android", "Gra Android"],
              ["audit", "Dziennik"],
              ["logins", "Logowania"],
              ["diagnostyka", "Diagnostyka urządzenia"],
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
        {tab === "android" && (
          <Suspense fallback={<p role="status">Wczytywanie panelu gry Android…</p>}>
            <AdminGodotPanel isAdmin={isAdmin} />
          </Suspense>
        )}
        {tab === "players" && <Players me={account.session.user.id} isAdmin={isAdmin} />}
        {tab === "monitoring" && (
          <Suspense fallback={<p role="status">Wczytywanie stanu serwera…</p>}>
            <AdminServerStatus />
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
        {tab === "logins" && <Logins />}
        {tab === "world-overview" && isAdmin && (
          <Suspense fallback={<p role="status">Wczytywanie przeglądu świata…</p>}>
            <AdminSuperiorOverview token={account.session.access_token} />
          </Suspense>
        )}
        {tab === "content" && (
          <Suspense fallback={<p role="status">Wczytywanie edytora zawartości…</p>}>
            <AdminWorldEditor />
          </Suspense>
        )}
        {tab === "diagnostyka" && <DeviceDiagnostics />}
      </div>
    </main>
  );
}

/** Uruchamia grę w trybie diagnostyki na urządzeniu administratora (telefon / przeglądarka). */
function DeviceDiagnostics() {
  return (
    <section className="ki-admin-panel">
      <h3>Diagnostyka urządzenia</h3>
      <p>
        Uruchamia grę w trybie pomiarowym: postać przez <b>45 sekund</b> sama chodzi i wykonuje
        polecenia (marsz, walka, unik, leczenie) — <b>bez Twojego udziału</b>. Działa na telefonie i
        w przeglądarce. Na koniec pobiera <b>raport JSON</b> z FPS, p95, zamrożeniem, pamięcią
        tekstur i czasem wejścia, wraz z danymi urządzenia.
      </p>
      <p className="ki-section-hint">
        Otwórz link na urządzeniu, które chcesz zmierzyć, i zaloguj się na postać administratora /
        GM. Diagnostyka startuje sama po wejściu do świata (adres z <code>?ki-diag=1</code>). Możesz
        ją też uruchomić w grze z panelu GM → „Diagnostyka 45 s”.
      </p>
      <div className="ki-account-actions">
        <a className="ki-account-primary" href="/?ki-diag=1" target="_blank" rel="noreferrer">
          Uruchom diagnostykę w grze (45 s)
        </a>
      </div>
      <p className="ki-section-hint">
        Zapisany plik ocenisz bramką wydajności: <code>npm run bench:gate &lt;plik.json&gt;</code>.
        FPS zależy od GPU urządzenia; pamięć i zamrożenie są niezależne od renderera.
      </p>
    </section>
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

const LOGIN_REASONS: Record<string, string> = {
  OK: "zalogowano",
  BRAK_KONTA: "brak takiego konta na serwerze",
  ZLE_HASLO: "konto istnieje, hasło się nie zgadza",
  KONTO_NIEAKTYWNE: "konto nieaktywne (brak potwierdzenia e-mail)",
  KONTO_ZABLOKOWANE: "konto zablokowane",
  NIEPOPRAWNE_DANE: "niepoprawne dane (np. hasło krótsze niż 8 znaków)",
  LIMIT_PROB: "zbyt wiele prób, chwilowa blokada",
};

/** The sign-in log: every attempt with the real reason, the device (the app says "GodotEngine") and the address. Passwords are never stored. */
function Logins() {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const reload = () =>
    adminAudit("login")
      .then((r) => {
        setRows(r);
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void reload();
  }, []);
  const shown = onlyFailed ? rows.filter((r) => r.action === "LOGIN_FAILED") : rows;
  return (
    <section className="ki-admin-panel">
      <h3>Dziennik logowań</h3>
      <p>
        Każda próba logowania z przeglądarki i z aplikacji, z prawdziwym powodem odmowy (gracz widzi
        tylko „nieprawidłowy e-mail lub hasło”). Haseł nie zapisujemy.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => void reload()}>Odśwież</button>
        <label>
          <input
            type="checkbox"
            checked={onlyFailed}
            onChange={(e) => setOnlyFailed(e.target.checked)}
          />{" "}
          Tylko nieudane
        </label>
      </div>
      {error && <p className="ki-account-error">{error}</p>}
      <div className="ki-table-scroll">
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>Kiedy</th>
              <th>E-mail</th>
              <th>Wynik</th>
              <th>Urządzenie</th>
              <th>Adres IP</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = (r.details ?? {}) as Record<string, string | null>;
              const reason = String(d["reason"] ?? "");
              const ua = String(d["ua"] ?? "");
              return (
                <tr key={r.id}>
                  <td>{when(r.at)}</td>
                  <td>{d["email"] ?? r.actor_nick ?? "—"}</td>
                  <td style={{ color: r.action === "LOGIN" ? "#5cd68d" : "#ff8577" }}>
                    {LOGIN_REASONS[reason] ?? reason}
                    {d["legacy"] ? ` (przeniesienie ze starego serwera: ${d["legacy"]})` : ""}
                  </td>
                  <td>
                    <small>{/Godot/i.test(ua) ? "aplikacja Android" : ua || "—"}</small>
                  </td>
                  <td>
                    <small>{d["ip"] ?? "—"}</small>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && !error && (
              <tr>
                <td colSpan={5}>Brak zapisanych logowań.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ACTION_NAMES: Record<string, string> = {
  REGISTER: "Rejestracja",
  CONFIRM_EMAIL: "Aktywacja e-mail",
  MIGRATE_ACCOUNT: "Przeniesienie konta na VPS",
  RESET_PASSWORD: "Zmiana hasła (link)",
  GRANT_ROLE: "Nadanie roli",
  REVOKE_ROLE: "Odebranie roli",
  GODOT_UPLOAD_PACK: "Android: wgranie paczki treści",
  GODOT_CREATE_RELEASE: "Android: nowe wydanie treści",
  GODOT_ACTIVATE_RELEASE: "Android: aktywacja wydania",
  GODOT_DELETE_RELEASE: "Android: usunięcie wydania",
  GODOT_SETTINGS: "Android: ustawienia dostępu",
  GODOT_DELETE_SAVE: "Android: usunięcie zapisu gracza",
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
