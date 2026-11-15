import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { logout } from "@/game/account/vpsAuth";
import { useAccount } from "@/components/account/useAccount";
import { AccountForm } from "@/components/account/AccountForm";
import "@/components/account/account.css";

export const Route = createFileRoute("/konto")({
  head: () => ({
    meta: [
      { title: "Konto · Ki Legends" },
      {
        name: "description",
        content: "Konto gracza Ki Legends: logowanie i serwerowy zapis postaci.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const account = useAccount();
  const [message, setMessage] = useState<{ kind: "notice" | "error"; text: string } | null>(null);

  if (!account.ready) return <main className="ki-account">Wczytywanie…</main>;

  if (account.session)
    return (
      <main className="ki-account">
        <section className="ki-account-card">
          <h1>Twoje konto</h1>
          <p>
            Nick: <b>{account.profile?.nick ?? "—"}</b>
            <br />
            E-mail: {account.session.user.email}
            {account.roles.length > 0 && (
              <>
                <br />
                Rola:{" "}
                {account.roles
                  .map((r) => (r === "admin" ? "administrator" : "game master"))
                  .join(", ")}
              </>
            )}
          </p>
          <p className="ki-account-hint">
            Postacie i postęp zapisuje serwer gry. Na innym urządzeniu zaloguj się na to samo konto.
            Do rozgrywki potrzebne jest połączenie z serwerem.
          </p>
          {message && (
            <p
              className={message.kind === "notice" ? "ki-account-ok" : "ki-account-error"}
              role="status"
            >
              {message.text}
            </p>
          )}
          <div className="ki-account-actions">
            <Link to="/" className="ki-account-primary">
              Graj
            </Link>
            {account.roles.length > 0 && <Link to="/admin">Panel administracyjny</Link>}
            <button onClick={() => void logout()}>Wyloguj</button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="ki-account">
      <AccountForm onMessage={(kind, text) => setMessage({ kind, text })} />
      <p className="ki-account-back">
        <Link to="/">← Wróć do strony głównej</Link>
      </p>
    </main>
  );
}
