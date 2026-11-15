import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  AuthError,
  confirmEmail,
  forgotPassword,
  login,
  register,
  resendActivation,
  resetPassword,
} from "@/game/account/vpsAuth";

type Mode = "login" | "register" | "forgot" | "reset";

const TITLES: Record<Mode, string> = {
  login: "Zaloguj się",
  register: "Załóż konto",
  forgot: "Nie pamiętasz hasła?",
  reset: "Ustaw nowe hasło",
};

/**
 * Sign-in, sign-up and password recovery for players. Used by /konto and by the home page for visitors, so both show the
 * same form. E-mail links (?aktywacja=…, ?nowe-haslo=…) are handled wherever the form is mounted.
 */
export function AccountForm({
  initialMode = "login",
  headingLevel = 1,
  onMessage,
}: {
  initialMode?: "login" | "register";
  headingLevel?: 1 | 2;
  /** Reports results that arrive together with a sign-in (activation, password reset): the form unmounts right after. */
  onMessage?: (kind: "notice" | "error", text: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState("");
  const [resetToken, setResetToken] = useState("");
  const Heading = headingLevel === 1 ? "h1" : "h2";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const activation = params.get("aktywacja");
    const reset = params.get("nowe-haslo");
    if (activation || reset) window.history.replaceState(null, "", window.location.pathname);
    if (reset) {
      setResetToken(reset);
      setMode("reset");
    }
    if (activation) {
      setBusy(true);
      confirmEmail(activation)
        .then(() => {
          setNotice("Konto aktywne. Witaj w Ki Legends!");
          onMessage?.("notice", "Konto aktywne. Witaj w Ki Legends!");
        })
        .catch((e: unknown) => {
          const text = e instanceof Error ? e.message : String(e);
          setError(text);
          onMessage?.("error", text);
        })
        .finally(() => setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, like the page it came from
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
    if (mode === "register" && form.get("zgoda") !== "on") {
      setError("Aby założyć konto, zaakceptuj regulamin i politykę prywatności.");
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
        onMessage?.("notice", "Hasło zmienione. Jesteś zalogowany.");
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

  return (
    <section className="ki-account-card" aria-label="Konto gracza">
      <Heading>{TITLES[mode]}</Heading>
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
        {mode === "register" && (
          <label className="ki-account-consent">
            <input name="zgoda" type="checkbox" required />
            <span>
              Akceptuję <Link to="/regulamin">regulamin</Link> i{" "}
              <Link to="/prywatnosc">politykę prywatności</Link>.
            </span>
          </label>
        )}
        {notice && (
          <p className="ki-account-ok" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="ki-account-error" role="alert">
            {error}
          </p>
        )}
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
    </section>
  );
}
