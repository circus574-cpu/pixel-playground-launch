import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "../account/useAccount";
import { accessToken } from "../../game/account/vpsAuth";

type Status = { maintenance: boolean; canEnter: boolean; message: string };

/** The backend enforces admission too. Polling unmounts an already open game when the owner closes the server. */
export function ServiceGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!account.ready) return;
    let stopped = false;
    let busy = false;
    const controller = new AbortController();
    setStatus(null);
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const token = account.session ? await accessToken() : null;
        const response = await fetch("/ws/godot/status", {
          cache: "no-store",
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw Error("Nie można sprawdzić dostępności serwera.");
        const value: unknown = await response.json();
        if (
          !value ||
          typeof value !== "object" ||
          !("maintenance" in value) ||
          !("canEnter" in value) ||
          typeof value.maintenance !== "boolean" ||
          typeof value.canEnter !== "boolean"
        )
          throw Error("Nieprawidłowa odpowiedź serwera.");
        if (!stopped) {
          setStatus({
            maintenance: value.maintenance,
            canEnter: value.canEnter,
            message:
              "message" in value && typeof value.message === "string"
                ? value.message
                : "Serwer jest w trakcie konserwacji.",
          });
          setError("");
        }
      } catch {
        if (!stopped) {
          setStatus(null);
          setError("Serwer jest chwilowo niedostępny. Ponawiam połączenie…");
        }
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5000);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [account.ready, account.session]);
  if (status?.canEnter) return <>{children}</>;
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "max(24px, env(safe-area-inset-top)) 24px",
        background: "#0a101b",
        color: "#eee5d3",
        textAlign: "center",
      }}
    >
      <section style={{ maxWidth: 580 }}>
        <p style={{ color: "#d6b578", letterSpacing: 4 }}>KI LEGENDS</p>
        <h1>{status?.maintenance ? "Serwer w trakcie konserwacji" : "Łączenie z serwerem"}</h1>
        <p role="status">{error || status?.message || "Sprawdzanie dostępności gry…"}</p>
        <p>Twoje postacie i postępy pozostają zachowane.</p>
        <a
          href="/konto"
          style={{ display: "inline-block", padding: "14px 22px", color: "#f6d59b", minHeight: 48 }}
        >
          Logowanie administratora
        </a>
      </section>
    </main>
  );
}
