import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  AuthError,
  confirmEmail,
  forgotPassword,
  login,
  logout,
  register,
  resendActivation,
  resetPassword,
} from "@/game/account/vpsAuth";
import { useAccount } from "@/components/account/useAccount";
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

type Mode = "login" | "register" | "forgot" | "reset";

function AccountPage() {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState("");
  const [resetToken, setResetToken] = useState("");

  // Links from e-mails: ?aktywacja=… activates and signs in, ?nowe-haslo=… opens the reset form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const activation = params.get("aktywacja");
    const reset = params.get("nowe-haslo");
    if (activation || reset) window.history.replaceState(null, "", "/konto");
    if (reset) {
      setResetToken(reset);
      setMode("reset");
    }
    if (activation) {
      setBusy(true);
      confirmEmail(activation)
        .then(() => setNotice("Konto aktywne. Witaj w Ki Legends!"))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setBusy(false));
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const nick = String(form.get("nick") ?? "").trim();
    setError("");
    setNotice("");
    setUnconfirmed("");
    if (mode === "register" && !/^[\p{L}\p{N}_-]{3,20}$/u.test(nick)) {
      setError("Nick: 3–20 znaków, litery, cyfry, - lub _.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        setNotice((await register(email, password, nick)).message);
        setMode("login");
      } else if (mode === "forgot") {
        setNotice((await forgotPassword(email)).message);
        setMode("login");
      } else if (mode === "reset") {
        await resetPassword(resetToken, password);
        setNotice("Hasło zmienione. Jesteś zalogowany.");
      } else {
        await login(email, password);
      }
    } catch (cause) {
      if (cause instanceof AuthError && cause.code === "EMAIL_NOT_CONFIRMED") setUnconfirmed(email);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      setNotice((await resendActivation(unconfirmed)).message);
      setError("");
      setUnconfirmed("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

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
          {notice && <p className="ki-account-ok">{notice}</p>}
          {error && <p className="ki-account-error">{error}</p>}
          <div className="ki-account-actions">
            <Link to="/" className="ki-account-primary">
              Graj
            </Link>
            {account.roles.length > 0 && <Link to="/admin">Panel administracyjny</Link>}
            <button onClick={() => void logout()} disabled={busy}>
              Wyloguj
            </button>
          </div>
        </section>
      </main>
    );

  const titles: Record<Mode, string> = {
    login: "Zaloguj się",
    register: "Załóż konto",
    forgot: "Nie pamiętasz hasła?",
    reset: "Ustaw nowe hasło",
  };
  return (
    <main className="ki-account">
      <section className="ki-account-card">
        <h1>{titles[mode]}</h1>
        {(mode === "login" || mode === "register") && (
          <div className="ki-account-tabs" role="tablist">
            <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>
              Logowanie
            </button>
            <button
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => setMode("register")}
            >
              Rejestracja
            </button>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)}>
          {mode === "register" && (
            <label>
              Nick w grze
              <input name="nick" autoComplete="nickname" required minLength={3} maxLength={20} />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              E-mail
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              {mode === "reset" ? "Nowe hasło" : "Hasło"}
              <input
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
              />
            </label>
          )}
          {notice && <p className="ki-account-ok">{notice}</p>}
          {error && <p className="ki-account-error">{error}</p>}
          {unconfirmed && (
            <button type="button" onClick={() => void resend()} disabled={busy}>
              Wyślij ponownie link aktywacyjny
            </button>
          )}
          <button type="submit" className="ki-account-primary" disabled={busy}>
            {mode === "login"
              ? "Zaloguj"
              : mode === "register"
                ? "Załóż konto"
                : mode === "forgot"
                  ? "Wyślij link"
                  : "Zapisz hasło"}
          </button>
        </form>
        {mode === "login" && (
          <button type="button" className="ki-account-link" onClick={() => setMode("forgot")}>
            Nie pamiętasz hasła?
          </button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button type="button" className="ki-account-link" onClick={() => setMode("login")}>
            ← Wróć do logowania
          </button>
        )}
        <p className="ki-account-hint">
          Konto jest wymagane do gry. Po rejestracji kliknij link aktywacyjny z e-maila. Postacie i
          postęp są zapisywane na serwerze.
        </p>
        <Link to="/">← Wróć do gry</Link>
      </section>
    </main>
  );
}
