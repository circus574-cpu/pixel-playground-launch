import { useCallback, useEffect, useState } from "react";
import {
  readRuntimeStatus,
  restartGameServer,
  type RuntimeStatus,
} from "@/game/account/runtimeAdmin";
import { formatUptime } from "./formatUptime";

const LAND_NAMES: Record<string, string> = {
  pyra: "Pyra",
  verdant: "Verdantia",
  aether: "Aetheria",
  nexus: "Nexus-9",
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");
const MISSING = "brak danych";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" style={{ textAlign: "left", fontWeight: 500, width: "46%" }}>
        {label}
      </th>
      <td>{children}</td>
    </tr>
  );
}

function State({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <b style={{ color: ok ? "#5cd68d" : "#ff8577" }}>{children}</b>;
}

/**
 * The "Serwer" tab: what the game server process measures about itself. Every number is read on the server at the moment of the
 * request; a value that cannot be read is shown as missing with the reason (never as 0). There are no estimates, no simulated
 * players and no controls that only change a stored setting.
 */
export function AdminServerStatus() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartNote, setRestartNote] = useState("");
  const reload = useCallback(async () => {
    try {
      setStatus(await readRuntimeStatus());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [auto, reload]);

  const restart = async () => {
    setRestartBusy(true);
    setRestartNote("");
    try {
      setRestartNote(await restartGameServer());
      setConfirming(false);
      // the server is away for a few seconds: read the status again once it is back
      setTimeout(() => void reload(), 5000);
    } catch (e) {
      setRestartNote("Restart nie powiódł się: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRestartBusy(false);
    }
  };

  const db = status?.database;
  const server = status?.server;
  const proc = status?.process;
  const android = status?.android;
  return (
    <div>
      <section className="ki-admin-panel">
        <h3>Stan serwera na żywo</h3>
        <p style={{ margin: "4px 0 10px" }}>
          Wartości są mierzone przez proces serwera gry w chwili odczytu. Brak wartości oznacza, że
          jej nie udało się odczytać (podajemy powód), a nie zero.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => void reload()}>Odśwież teraz</button>
          <label>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{" "}
            Odświeżaj co 5 s
          </label>
          <small>Ostatni odczyt: {status ? when(status.collectedAt) : "—"}</small>
        </div>
        {error && (
          <p className="ki-account-error" role="alert">
            Nie udało się odczytać stanu serwera: {error}
          </p>
        )}
      </section>

      <section className="ki-admin-panel">
        <h3>Restart serwera gry</h3>
        <p style={{ margin: "4px 0 10px" }}>
          Zatrzymuje i uruchamia serwer gry od nowa w tym samym procesie (konta, baza i panel
          zostają). Gracze rozłączą się na kilka sekund i połączą się ponownie. Tylko dla
          administratora.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)}>Restartuj serwer gry</button>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <b>Na pewno zrestartować serwer?</b>
            <button disabled={restartBusy} onClick={() => void restart()}>
              Tak, restartuj
            </button>
            <button disabled={restartBusy} onClick={() => setConfirming(false)}>
              Anuluj
            </button>
          </div>
        )}
        {restartNote && (
          <p role="status" style={{ margin: "10px 0 0" }}>
            {restartNote}
          </p>
        )}
      </section>

      {status && server && proc && db && (
        <>
          <section className="ki-admin-panel">
            <h3>
              Serwer gry „{server.name}” · <State ok>działa</State>
            </h3>
            <div className="ki-table-scroll">
              <table className="ki-admin-table">
                <tbody>
                  <Row label="Węzeł · region · port">
                    {server.nodeId} · {server.region} · {server.port}
                  </Row>
                  <Row label="Czas pracy">{formatUptime(server.uptimeSeconds)}</Row>
                  <Row label="Gracze w grze przeglądarkowej">
                    {server.activePlayers} / {server.maxPlayers}
                  </Row>
                  <Row label="Gracze w grze Android (połączeni teraz)">
                    {server.androidOnline}
                    {server.androidOnline > 0 &&
                      " (" +
                        Object.entries(server.androidByLand)
                          .map(([land, n]) => `${LAND_NAMES[land] ?? land}: ${n}`)
                          .join(", ") +
                        ")"}
                  </Row>
                  <Row label="Pętla serwera (tick)">
                    {server.tickRateHz} Hz · mediana {server.tickP50Ms} ms · p95 {server.tickP95Ms}{" "}
                    ms
                  </Row>
                  <Row label="Pakiety na sekundę (wejście / wyjście)">
                    {server.packetsInSec} / {server.packetsOutSec}
                  </Row>
                  <Row label="Gotowość usług">
                    Konta:{" "}
                    <State ok={server.accountsReady}>{server.accountsReady ? "tak" : "nie"}</State>
                    {" · "}Postacie przeglądarkowe:{" "}
                    <State ok={server.charactersReady}>
                      {server.charactersReady ? "tak" : "nie"}
                    </State>
                    {" · "}Gra Android:{" "}
                    <State ok={server.androidReady}>{server.androidReady ? "tak" : "nie"}</State>
                  </Row>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ki-admin-panel">
            <h3>Proces serwera (zasoby)</h3>
            <div className="ki-table-scroll">
              <table className="ki-admin-table">
                <tbody>
                  <Row label="Obciążenie (load 1 min / liczba rdzeni)">
                    {proc.loadPercent}% (load {proc.loadAvg1m}, rdzeni: {proc.cpuCount})
                  </Row>
                  <Row label="Pamięć procesu (RSS)">
                    {proc.rssMb} MB
                    {proc.memoryLimitMb !== null
                      ? ` z limitu kontenera ${proc.memoryLimitMb} MB`
                      : ` (limit kontenera nieustawiony; pamięć maszyny ${proc.hostMemoryMb} MB)`}
                  </Row>
                  <Row label="Sterta JavaScript">{proc.heapUsedMb} MB</Row>
                  <Row label="Node.js · PID">
                    {proc.nodeVersion} · {proc.pid}
                  </Row>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ki-admin-panel">
            <h3>
              Baza danych (PostgreSQL na VPS) ·{" "}
              <State ok={db.connected}>{db.connected ? "połączona" : "brak połączenia"}</State>
            </h3>
            {db.error && <p className="ki-account-error">Powód: {db.error}</p>}
            <div className="ki-table-scroll">
              <table className="ki-admin-table">
                <tbody>
                  <Row label="Opóźnienie zapytania">
                    {db.latencyMs === null ? MISSING : `${db.latencyMs} ms`}
                  </Row>
                  <Row label="Wersja">{db.version ?? MISSING}</Row>
                  <Row label="Rozmiar bazy">{db.sizeMb === null ? MISSING : `${db.sizeMb} MB`}</Row>
                  <Row label="Połączenia (aktywne / maksimum)">
                    {db.connections === null || db.maxConnections === null
                      ? MISSING
                      : `${db.connections} / ${db.maxConnections}`}
                  </Row>
                  {db.counts.map((c) => (
                    <Row key={c.label} label={c.label}>
                      {c.value === null ? (
                        <span style={{ color: "#ff8577" }}>nie udało się odczytać: {c.error}</span>
                      ) : (
                        c.value
                      )}
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ki-admin-panel">
            <h3>Gra Android</h3>
            {android ? (
              <div className="ki-table-scroll">
                <table className="ki-admin-table">
                  <tbody>
                    <Row label="Aktywne wydanie treści">{android.activeVersion ?? "brak"}</Row>
                    <Row label="Minimalna wersja klienta">{android.minClientCode}</Row>
                    <Row label="Tryb serwisowy">
                      <State ok={!android.maintenance}>
                        {android.maintenance ? "WŁĄCZONY" : "wyłączony"}
                      </State>
                    </Row>
                    <Row label="Wydania na serwerze">{android.releases}</Row>
                    <Row label="Zapisy graczy w chmurze">{android.saves ?? MISSING}</Row>
                    <Row label="Ostatni zapis">{when(android.lastWriteAt)}</Row>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ki-account-error">
                Backend gry Android jest niedostępny (brak schematu w bazie albo błąd odczytu).
              </p>
            )}
            <small>Wydania i ustawienia zmieniasz w zakładce „Gra Android”.</small>
          </section>
        </>
      )}
    </div>
  );
}
