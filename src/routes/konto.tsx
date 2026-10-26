import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/account/useAccount";
import { cloudPort, touchLastSeen } from "@/game/account/cloudPort";
import { syncAll } from "@/game/account/cloudSaves";
import "@/components/account/account.css";

export const Route = createFileRoute("/konto")({
  head: () => ({
    meta: [
      { title: "Konto · Ki Legends" },
      {
        name: "description",
        content: "Konto gracza Ki Legends: logowanie i zapis postaci w chmurze.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Nieprawidłowy e-mail lub hasło.",
  "Email not confirmed": "Potwierdź najpierw adres e-mail (link w wiadomości od nas).",
  "User already registered": "To konto już istnieje. Zaloguj się.",
};
const polish = (message: string) => MESSAGES[message] ?? message;

function AccountPage() {
  const account = useAccount();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const nick = String(form.get("nick") ?? "").trim();
    setError("");
    setNotice("");
    if (mode === "register" && !/^[\p{L}\p{N}_-]{3,20}$/u.test(nick)) {
      setError("Nick: 3–20 znaków, litery, cyfry, - lub _.");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nick }, emailRedirectTo: window.location.origin + "/konto" },
        });
        if (error) throw error;
        setNotice(
          data.session
            ? "Konto utworzone. Jesteś zalogowany."
            : "Konto utworzone. Sprawdź skrzynkę e-mail i kliknij link potwierdzający.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (cause) {
      setError(polish(cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!account.session) return;
    setBusy(true);
    setError("");
    try {
      const id = account.session.user.id;
      const r = await syncAll(window.localStorage, id, cloudPort(id));
      await touchLastSeen(id);
      setNotice(
        `Zsynchronizowano: wysłano ${r.pushed.length}, pobrano ${r.pulled.length}` +
          (r.replaced.length ? `, zastąpiono nowszą wersją z chmury ${r.replaced.length}` : "") +
          ".",
      );
    } catch (cause) {
      setError("Synchronizacja nie powiodła się: " + (cause instanceof Error ? cause.message : ""));
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
            Postacie z tej przeglądarki zapisują się na koncie. Na innym urządzeniu zaloguj się, a
            postacie pobiorą się przy wejściu do gry.
          </p>
          {notice && <p className="ki-account-ok">{notice}</p>}
          {error && <p className="ki-account-error">{error}</p>}
          <div className="ki-account-actions">
            <Link to="/" className="ki-account-primary">
              Graj
            </Link>
            <button onClick={() => void sync()} disabled={busy}>
              Synchronizuj teraz
            </button>
            {account.roles.length > 0 && <Link to="/admin">Panel administracyjny</Link>}
            <button onClick={() => void supabase.auth.signOut()} disabled={busy}>
              Wyloguj
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="ki-account">
      <section className="ki-account-card">
        <h1>{mode === "login" ? "Zaloguj się" : "Załóż konto"}</h1>
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
        <form onSubmit={(e) => void submit(e)}>
          {mode === "register" && (
            <label>
              Nick w grze
              <input name="nick" autoComplete="nickname" required minLength={3} maxLength={20} />
            </label>
          )}
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Hasło
            <input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
          </label>
          {notice && <p className="ki-account-ok">{notice}</p>}
          {error && <p className="ki-account-error">{error}</p>}
          <button type="submit" className="ki-account-primary" disabled={busy}>
            {mode === "login" ? "Zaloguj" : "Załóż konto"}
          </button>
        </form>
        <p className="ki-account-hint">
          Konto jest opcjonalne: bez niego gra zapisuje postacie tylko w tej przeglądarce.
        </p>
        <Link to="/">← Wróć do gry</Link>
      </section>
    </main>
  );
}
