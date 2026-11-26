import { useCallback, useEffect, useState } from "react";
import { AdminAndroidCharacters } from "./AdminAndroidCharacters";
import {
  formatMegabytes,
  godotActivate,
  godotBroadcast,
  godotDeleteRelease,
  godotDeleteSave,
  godotOverview,
  godotPublish,
  godotSaveDetail,
  godotSaves,
  godotUpdateSettings,
  type ContentManifest,
  type GodotOverview,
  type GodotSaveRow,
} from "@/game/account/godotAdmin";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");
const LAND_NAMES: Record<string, string> = {
  pyra: "Pyra",
  verdant: "Verdantia",
  aether: "Aetheria",
  nexus: "Nexus-9",
};
const RACE_NAMES: Record<string, string> = {
  legend: "Legenda",
  planetary: "Planetarny",
  sage: "Mędrzec",
  android: "Android",
};
const field = { display: "flex", flexDirection: "column", gap: 4, margin: "10px 0" } as const;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Android game (Godot): releases of downloadable content, client gating, maintenance, authoritative characters, cloud saves, who is online. */
export function AdminGodotPanel({ isAdmin }: { isAdmin: boolean }) {
  const [overview, setOverview] = useState<GodotOverview | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const reload = useCallback(async () => {
    try {
      setOverview(await godotOverview());
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 15000);
    return () => clearInterval(timer);
  }, [reload]);
  const run = async (what: () => Promise<unknown>, ok: string) => {
    try {
      await what();
      setInfo(ok);
      setError("");
      await reload();
    } catch (e) {
      setError(message(e));
    }
  };

  if (!overview) return <p role="status">{error || "Wczytywanie danych gry Android…"}</p>;
  const s = overview.settings;
  const livePlayers = overview.onlinePlayers ?? [];
  return (
    <>
      {error && <p className="ki-account-error">{error}</p>}
      {info && <p role="status">{info}</p>}
      <section className="ki-admin-panel">
        <h3>Stan gry Android</h3>
        <ul>
          <li>
            Aktywne wydanie treści: <b>{s.activeVersion ?? "— brak (gra nie ruszy)"}</b>
          </li>
          <li>
            Online teraz: <b>{overview.online.count}</b>{" "}
            {Object.entries(overview.online.byLand)
              .map(([land, n]) => `${LAND_NAMES[land] ?? land}: ${n}`)
              .join(", ")}
          </li>
          <li>
            Zapisy w chmurze: <b>{overview.stats.saves}</b> (kont: {overview.stats.accounts},{" "}
            {formatMegabytes(overview.stats.bytes)}), ostatni zapis{" "}
            {when(overview.stats.lastWriteAt)}
          </li>
          <li>
            TEST SERWER: <b>{s.maintenance ? "tylko administrator" : "otwarty dla graczy"}</b>,
            minimalna wersja aplikacji (versionCode): <b>{s.minClientCode}</b>
          </li>
        </ul>
        {livePlayers.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <strong>Połączeni gracze na żywo ({livePlayers.length}):</strong>
            <ul>
              {livePlayers.map((p) => (
                <li key={p.id}>
                  <b>{p.name}</b> ({p.nick}){p.guildTag ? ` <${p.guildTag}>` : ""} — Poz. {p.level}{" "}
                  · {RACE_NAMES[p.race] ?? p.race} · {LAND_NAMES[p.land] ?? p.land} · MOC KI:{" "}
                  {p.power}
                  {p.ki ? " [FORMA KI]" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              value={broadcastMsg}
              maxLength={240}
              placeholder="Ogłoszenie na żywo dla graczy Android (np. Restart za 5 min)…"
              onChange={(e) => setBroadcastMsg(e.target.value)}
              style={{ flex: "1 1 280px" }}
            />
            <button
              type="button"
              disabled={!broadcastMsg.trim()}
              onClick={() =>
                void run(async () => {
                  const res = await godotBroadcast(broadcastMsg.trim());
                  setBroadcastMsg("");
                  setInfo(`Wysłano ogłoszenie na żywo (odbiorców: ${res.delivered}).`);
                }, "Wysłano ogłoszenie na żywo.")
              }
            >
              Wyślij ogłoszenie
            </button>
          </div>
        )}
        <small>
          Ekonomia i postęp postaci Android (poziom, PD, złoto, bank, ekwipunek, sklep, kuźnia,
          zlecenia, znajomi i gildie) są liczone i zapisywane autorytatywnie na serwerze w
          PostgreSQL.
        </small>
      </section>

      <AdminAndroidCharacters isAdmin={isAdmin} />
      <Settings key={s.updatedAt} settings={s} isAdmin={isAdmin} run={run} />
      <Releases overview={overview} isAdmin={isAdmin} run={run} setError={setError} />
      <Saves isAdmin={isAdmin} />
    </>
  );
}

function Settings({
  settings,
  isAdmin,
  run,
}: {
  settings: GodotOverview["settings"];
  isAdmin: boolean;
  run: (what: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [min, setMin] = useState(String(settings.minClientCode));
  const [maintenance, setMaintenance] = useState(settings.maintenance);
  const [text, setText] = useState(settings.maintenanceMessage ?? "");
  const [news, setNews] = useState(settings.news ?? "");
  return (
    <section className="ki-admin-panel">
      <h3>Dostęp klientów i komunikaty</h3>
      <label style={field}>
        Minimalna wersja aplikacji (versionCode; starsze dostaną komunikat „zainstaluj nowszą”){" "}
        <input
          type="number"
          min={0}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          disabled={!isAdmin}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={maintenance}
          onChange={(e) => setMaintenance(e.target.checked)}
          disabled={!isAdmin}
        />{" "}
        TEST SERWER — tylko administrator (strona gry i Android; pozostali widzą konserwację)
      </label>
      <p>
        Włączenie zamyka również aktywne połączenia zwykłych graczy. Konto z samą rolą GM nie ma
        dostępu. Administrator może testować izometryczny prototyp Godota.
      </p>
      <label style={field}>
        Komunikat serwisowy{" "}
        <input
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          disabled={!isAdmin}
        />
      </label>
      <label style={field}>
        Wiadomość dnia (pokazywana w grze){" "}
        <input
          value={news}
          maxLength={300}
          onChange={(e) => setNews(e.target.value)}
          disabled={!isAdmin}
        />
      </label>
      <button
        disabled={!isAdmin}
        onClick={() =>
          void run(
            () =>
              godotUpdateSettings({
                minClientCode: Math.max(0, Number(min) || 0),
                maintenance,
                maintenanceMessage: text.trim() ? text.trim() : null,
                news: news.trim() ? news.trim() : null,
              }),
            "Zapisano ustawienia.",
          )
        }
      >
        Zapisz ustawienia
      </button>
    </section>
  );
}

function Releases({
  overview,
  isAdmin,
  run,
  setError,
}: {
  overview: GodotOverview;
  isAdmin: boolean;
  run: (what: () => Promise<unknown>, ok: string) => Promise<void>;
  setError: (text: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const publish = async () => {
    const manifestFile = files.find((f) => f.name === "manifest.json");
    if (!manifestFile)
      return setError("Wybierz folder wydania z plikiem manifest.json i paczkami .pck.");
    setBusy(true);
    try {
      const manifest = JSON.parse(await manifestFile.text()) as ContentManifest;
      const map = new Map(files.map((f) => [f.name, f]));
      await godotPublish(manifest, map, note, (done, total, file) =>
        setProgress(
          file
            ? `Wysyłanie ${file}: ${formatMegabytes(done)} z ${formatMegabytes(total)}`
            : "Zatwierdzanie wydania…",
        ),
      );
      setProgress(`Wydanie ${manifest.version} zarejestrowane. Aktywuj je poniżej.`);
      setError("");
      setFiles([]);
      await run(async () => undefined, "Wydanie dodane.");
    } catch (e) {
      setError(message(e));
      setProgress("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ki-admin-panel">
      <h3>Wydania treści (paczki pobierane przez aplikację)</h3>
      <div className="ki-table-scroll">
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>Wersja</th>
              <th>Paczki</th>
              <th>Rozmiar</th>
              <th>Dodano</th>
              <th>Notatka</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {overview.releases.map((r) => {
              const active = r.version === overview.settings.activeVersion;
              return (
                <tr key={r.version}>
                  <td>
                    {r.version} {active && <b>(aktywne)</b>}
                  </td>
                  <td>{r.packs}</td>
                  <td>{formatMegabytes(r.bytes)}</td>
                  <td>{when(r.createdAt)}</td>
                  <td>{r.note ?? ""}</td>
                  <td>
                    <button
                      disabled={!isAdmin || active}
                      onClick={() =>
                        void run(() => godotActivate(r.version), "Aktywowano wydanie " + r.version)
                      }
                    >
                      Aktywuj
                    </button>{" "}
                    <button
                      disabled={!isAdmin || active}
                      onClick={() => {
                        if (window.confirm(`Usunąć wydanie ${r.version} wraz z plikami?`))
                          void run(() => godotDeleteRelease(r.version), "Usunięto wydanie.");
                      }}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              );
            })}
            {overview.releases.length === 0 && (
              <tr>
                <td colSpan={6}>
                  Brak wydań. Zbuduj paczki (<code>python3 scripts/godot/build_packs.py build</code>
                  ) i dodaj je poniżej.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h4>Dodaj wydanie</h4>
      <p>
        Wybierz wszystkie pliki z folderu <code>deploy/godot-content/&lt;wersja&gt;/</code>{" "}
        (manifest.json i *.pck). Serwer sprawdza rozmiar i SHA-256 każdej paczki; wydanie nie
        zmienia się, dopóki go nie aktywujesz.
      </p>
      <input
        type="file"
        multiple
        disabled={!isAdmin || busy}
        onChange={(e) => setFiles([...(e.target.files ?? [])])}
      />
      <input
        placeholder="Notatka (opcjonalnie)"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        disabled={!isAdmin || busy}
      />
      <button disabled={!isAdmin || busy || files.length === 0} onClick={() => void publish()}>
        Wyślij wydanie ({files.length} plików)
      </button>
      {progress && <p role="status">{progress}</p>}
    </section>
  );
}

function Saves({ isAdmin }: { isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<GodotSaveRow[]>([]);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await godotSaves(query));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [query]);
  useEffect(() => void load(), [load]);
  return (
    <section className="ki-admin-panel">
      <h3>Zapisy graczy w chmurze</h3>
      <input
        placeholder="Szukaj: nick lub e-mail"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="ki-account-error">{error}</p>}
      <div className="ki-table-scroll">
        <table className="ki-admin-table">
          <thead>
            <tr>
              <th>Gracz</th>
              <th>Postać</th>
              <th>Kraina</th>
              <th>Wersja zapisu</th>
              <th>Aplikacja / treść</th>
              <th>Zapisano</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.accountId + r.slot}>
                <td>
                  {r.nick}
                  <br />
                  <small>{r.email}</small>
                </td>
                <td>
                  {RACE_NAMES[r.race] ?? r.race}, poz. {r.level}
                </td>
                <td>{LAND_NAMES[r.land] ?? r.land}</td>
                <td>
                  {r.revision} ({formatMegabytes(r.bytes)})
                </td>
                <td>
                  {r.clientCode} / {r.contentVersion ?? "—"}
                </td>
                <td>{when(r.updatedAt)}</td>
                <td>
                  <button
                    onClick={() =>
                      void godotSaveDetail(r.accountId, r.slot)
                        .then((d) => setDetail(JSON.stringify(d.save, null, 2)))
                        .catch((e: unknown) => setError(message(e)))
                    }
                  >
                    Podgląd JSON
                  </button>{" "}
                  <button
                    disabled={!isAdmin}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Usunąć zapis gracza ${r.nick} (slot ${r.slot})? Tego nie da się cofnąć.`,
                        )
                      )
                        void godotDeleteSave(r.accountId, r.slot)
                          .then(load)
                          .catch((e: unknown) => setError(message(e)));
                    }}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7}>Brak zapisów.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {detail && <pre style={{ maxHeight: 320, overflow: "auto" }}>{detail}</pre>}
    </section>
  );
}

export default AdminGodotPanel;
