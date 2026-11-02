/**
 * Publication of world edits: the editor works on a draft in this browser; "Publikuj" stores it
 * on the server as a new revision, which the game server applies for every online player.
 */
import { useCallback, useEffect, useState } from "react";
import {
  countActiveOverrides,
  writeAdminWorldOverrides,
  type AdminWorldOverrides,
} from "@/game/world/adminWorldStore";
import {
  fetchPublishedWorld,
  publishWorld,
  rollbackWorld,
  worldRevisions,
  type PublishedWorld,
  type WorldRevision,
} from "@/game/world/worldOverridesClient";
import { sameWorldOverrides } from "@/game/world/worldOverridesSchema";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "nigdy";

export function AdminWorldPublishBar({
  draft,
  onStatus,
}: {
  draft: AdminWorldOverrides;
  onStatus: (message: string) => void;
}) {
  const [published, setPublished] = useState<PublishedWorld | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<WorldRevision[] | null>(null);

  const load = useCallback(async () => {
    try {
      const world = await fetchPublishedWorld();
      setPublished(world);
      setError("");
      return world;
    } catch {
      setError("Serwer świata jest niedostępny — zmiany zostają tylko w tej przeglądarce.");
      return null;
    }
  }, []);

  useEffect(() => {
    void load().then((world) => {
      // An empty local draft starts from what players have now.
      if (world && countActiveOverrides(draft) === 0 && countActiveOverrides(world.data) > 0)
        writeAdminWorldOverrides(world.data);
    });
    // Only on opening the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = published !== null && !sameWorldOverrides(draft, published.data);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      onStatus((e as Error).message || "Nie udało się.");
    } finally {
      setBusy(false);
    }
  };

  const publish = () =>
    run(async () => {
      if (!published) return;
      const next = await publishWorld(draft, published.revision, note);
      setPublished(next);
      setNote("");
      setHistory(null);
      onStatus(
        `Opublikowano rewizję ${next.revision}. Serwer gry już jej używa; gracze zobaczą ją przy następnym wejściu na ląd.`,
      );
    });

  const discard = () =>
    run(async () => {
      const world = await load();
      if (!world) return;
      if (!window.confirm("Odrzucić niepublikowane zmiany i wczytać wersję z serwera?")) return;
      writeAdminWorldOverrides(world.data);
      onStatus(`Wczytano rewizję ${world.revision} z serwera.`);
    });

  const rollback = (revision: number) =>
    run(async () => {
      if (!window.confirm(`Przywrócić rewizję ${revision} jako nową wersję świata u graczy?`))
        return;
      const next = await rollbackWorld(revision);
      setPublished(next);
      writeAdminWorldOverrides(next.data);
      setHistory(await worldRevisions());
      onStatus(`Przywrócono rewizję ${revision} jako rewizję ${next.revision}.`);
    });

  return (
    <section className="ki-world-publish" aria-label="Publikacja zmian świata">
      <div className="ki-world-publish-state">
        {published ? (
          <>
            <strong>Na serwerze: rewizja {published.revision}</strong>
            <small>
              {countActiveOverrides(published.data)} zmian · opublikowano{" "}
              {when(published.publishedAt)}
            </small>
            <span className={pending ? "is-pending" : "is-synced"}>
              {pending ? "Masz niepublikowane zmiany" : "Szkic = wersja u graczy"}
            </span>
          </>
        ) : (
          <small>{error || "Sprawdzanie wersji na serwerze…"}</small>
        )}
      </div>
      {published && (
        <div className="ki-world-publish-actions">
          <input
            placeholder="Opis zmiany (opcjonalnie)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Opis publikacji"
          />
          <button disabled={!pending || busy} onClick={() => void publish()}>
            Publikuj na serwer
          </button>
          <button disabled={!pending || busy} onClick={() => void discard()}>
            Odrzuć szkic
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => setHistory(history ? null : await worldRevisions()))
            }
          >
            {history ? "Ukryj historię" : "Historia publikacji"}
          </button>
        </div>
      )}
      {history && (
        <table className="ki-world-publish-history">
          <thead>
            <tr>
              <th>Rewizja</th>
              <th>Kiedy</th>
              <th>Kto</th>
              <th>Zmian</th>
              <th>Opis</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={6}>Brak publikacji — gracze mają świat kanoniczny.</td>
              </tr>
            )}
            {history.map((r) => (
              <tr key={r.revision}>
                <td>{r.revision}</td>
                <td>{when(r.publishedAt)}</td>
                <td>{r.nick ?? "—"}</td>
                <td>{r.changes}</td>
                <td>{r.note ?? ""}</td>
                <td>
                  {published && r.revision !== published.revision && (
                    <button disabled={busy} onClick={() => void rollback(r.revision)}>
                      Przywróć
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {history.length > 0 && (
              <tr>
                <td>0</td>
                <td colSpan={4}>Świat kanoniczny (bez zmian)</td>
                <td>
                  <button disabled={busy} onClick={() => void rollback(0)}>
                    Przywróć
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
