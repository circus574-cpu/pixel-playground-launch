import { useEffect, useMemo, useState } from "react";
import {
  monsterLevel,
  monsterName,
  summarizeSpawns,
  type SpawnPoint,
} from "@/game/admin/spawnSummary";
import { FEATURE_IDS, type FeatureId } from "@/game/world/generated/superiorSave";
import { WORLD_BASE, WORLD_INDEX } from "@/game/world/generated/worldVersion";
import type { AdminWorldOverrides } from "@/game/world/adminWorldStore";
import { MonsterThumbnail } from "./AdminCatalogInfo";

const PAGE = 50;
const range = ([lo, hi]: [number, number], unit = "") =>
  lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`;

export function AdminSpawnList({
  overrides,
  onTeleport,
}: {
  overrides: AdminWorldOverrides;
  onTeleport?: ((x: number, y: number) => void) | undefined;
}) {
  const [feature, setFeature] = useState<FeatureId>(FEATURE_IDS[0]!);
  const [points, setPoints] = useState<SpawnPoint[] | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<string>("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setPoints(null);
    setError("");
    setKind("");
    setPage(0);
    fetch(`${WORLD_BASE}/${feature}/spawns.json`, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ overworld?: SpawnPoint[] }>;
      })
      .then((data) => setPoints(data.overworld ?? []))
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError("Nie udało się wczytać spawnów: " + (e instanceof Error ? e.message : ""));
      });
    return () => abort.abort();
  }, [feature]);

  const custom = Object.values(overrides.customSpawns).filter(
    (s) => s.feature === feature && !s.deleted,
  );
  const summary = useMemo(() => summarizeSpawns(points ?? []), [points]);
  const filtered = useMemo(
    () => (points ?? []).filter((p) => !kind || p.kind === kind),
    [points, kind],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const info = WORLD_INDEX.features.find((f) => f.id === feature);

  return (
    <section className="ki-admin-panel ki-spawn-list">
      <h3>Spawny potworów</h3>
      <p className="ki-section-hint">
        Wszystkie punkty pojawiania się potworów z danych świata. Kliknij potwora w podsumowaniu,
        aby zobaczyć tylko jego punkty.
      </p>
      <label className="ki-spawn-feature">
        Ląd:{" "}
        <select value={feature} onChange={(e) => setFeature(e.target.value as FeatureId)}>
          {FEATURE_IDS.map((id) => (
            <option key={id} value={id}>
              {WORLD_INDEX.features.find((f) => f.id === id)?.name ?? id}
            </option>
          ))}
        </select>
      </label>
      {info && (
        <p className="ki-section-hint">
          {info.name}: {info.width}×{info.height} j. ·{" "}
          {points
            ? `${points.length} punktów, ${summary.length} rodzajów potworów`
            : "wczytywanie…"}
          {custom.length > 0 && ` · ${custom.length} dodanych w panelu`}
        </p>
      )}
      {error && <p role="alert">{error}</p>}

      {points && (
        <>
          <h4>Podsumowanie</h4>
          <div className="ki-table-scroll">
            <table className="ki-admin-table ki-compact-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Potwór</th>
                  <th>Poz.</th>
                  <th>Punktów</th>
                  <th>Grup</th>
                  <th>Odrodzenie</th>
                  <th>Smycz</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr
                    key={s.kind}
                    className={kind === s.kind ? "is-selected" : ""}
                    onClick={() => {
                      setKind(kind === s.kind ? "" : s.kind);
                      setPage(0);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="ki-spawn-thumb">
                      <MonsterThumbnail id={s.kind} />
                    </td>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td>{s.level}</td>
                    <td>{s.count}</td>
                    <td>{s.groups}</td>
                    <td>{range(s.respawn, " s")}</td>
                    <td>{range(s.leash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4>
            Punkty {kind ? `— ${monsterName(kind)}` : "— wszystkie"} ({filtered.length})
            {kind && (
              <button className="ki-inline-button" onClick={() => setKind("")}>
                pokaż wszystkie
              </button>
            )}
          </h4>
          <div className="ki-table-scroll">
            <table className="ki-admin-table ki-compact-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Potwór</th>
                  <th>Poz.</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Odrodzenie</th>
                  <th>Smycz</th>
                  <th>Grupa</th>
                  {onTeleport && <th></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{monsterName(p.kind)}</td>
                    <td>{p.level ?? monsterLevel(p.kind)}</td>
                    <td>{Math.round(p.x)}</td>
                    <td>{Math.round(p.y)}</td>
                    <td>{Math.round(p.respawnMs / 1000)} s</td>
                    <td>{p.homeLeash}</td>
                    <td>{p.groupId ?? "—"}</td>
                    {onTeleport && (
                      <td>
                        <button onClick={() => onTeleport(p.x, p.y)}>Teleport</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="ki-pager">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ Poprzednie
              </button>
              <span>
                Strona {page + 1} z {pages}
              </span>
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Następne ›
              </button>
            </div>
          )}

          {custom.length > 0 && (
            <>
              <h4>Dodane w panelu ({custom.length})</h4>
              <ul>
                {custom.map((c) => (
                  <li key={c.id}>
                    {monsterName(c.kind)} · ({Math.round(c.x)}, {Math.round(c.y)}) · smycz{" "}
                    {c.homeLeash} · odrodzenie {Math.round(c.respawnMs / 1000)} s
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
