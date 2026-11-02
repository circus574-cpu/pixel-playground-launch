import { useEffect, useState } from "react";

export type Publication = {
  sha: string;
  date: string;
  pr: number | null;
  title: string;
  technical: string | null;
};
export type PublicationLog = {
  format: "ki-publications-1";
  generatedAt: string;
  deployedSha: string;
  entries: Publication[];
  journal: { date: string; items: string[] }[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });

/** Production publications and daily change notes, written by the deploy (`scripts/build_publications.mjs`). */
export function AdminPublications() {
  const [log, setLog] = useState<PublicationLog | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    fetch("/publications.json", { signal: abort.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error(String(r.status));
        return r.json() as Promise<PublicationLog>;
      })
      .then((data) => {
        if (data.format !== "ki-publications-1") throw Error("format");
        setLog(data);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Brak dziennika publikacji. Powstaje przy każdym wdrożeniu na produkcję — pojawi się po najbliższej publikacji.",
          );
      });
    return () => abort.abort();
  }, []);

  if (error) return <p className="ki-section-hint">{error}</p>;
  if (!log) return <p role="status">Wczytywanie publikacji…</p>;
  return (
    <div className="ki-publications">
      <p className="ki-section-hint">
        Na produkcji: <b>{log.deployedSha}</b> · wdrożono {when(log.generatedAt)}
      </p>
      <ol className="ki-publication-list">
        {log.entries.map((e, i) => (
          <li key={e.sha} className={i === 0 ? "is-current" : ""}>
            <time dateTime={e.date}>{when(e.date)}</time>
            <div>
              <b>{e.title}</b>
              <small>
                {e.pr !== null ? `PR #${e.pr} · ` : "bezpośrednio na main · "}
                {e.sha}
                {i === 0 ? " · aktualna wersja" : ""}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <h4>Dziennik zmian (ostatnie dni)</h4>
      {log.journal.map((day) => (
        <details key={day.date} open={day === log.journal[0]}>
          <summary>
            {new Date(day.date).toLocaleDateString("pl-PL", { dateStyle: "long" })} ·{" "}
            {day.items.length} wpisów
          </summary>
          <ul>
            {day.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
