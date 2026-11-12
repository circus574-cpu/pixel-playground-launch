import indexData from "../../../../public/game/worlds/superior-v2/index.json";
import { browserNavigation, type GridData } from "@/game/world/generated/browserTerrain";
import type { AuthoredSpawn } from "@/game/world/generated/spawnStream";
import type { FeatureInfo } from "@/game/world/generated/superiorSave";
import type { AdminWorldOverrides } from "@/game/world/adminWorldStore";
import type { BrowserChunk } from "@/game/world/generated/browserLoader";
import type { Obstacle } from "@/game/movement";
import {
  buildLandEntries,
  type Entry,
  type LandData,
  type OverviewSource,
  normalized,
} from "./model";
export const OVERVIEW_BASE = "/game/worlds/superior-v2";
// Clone: the editor mutates the runtime index; this view never changes shared catalogues.
export const OVERVIEW_INDEX = structuredClone(indexData) as {
  revision: string;
  features: FeatureInfo[];
};
export async function jsonFile<T>(url: string, signal: AbortSignal, expected?: string): Promise<T> {
  const r = await fetch(url, { signal, cache: "no-cache" });
  if (!r.ok) throw Error(`Nie można odczytać ${url} (${r.status}).`);
  const text = await r.text();
  if (expected) {
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== expected) throw Error(`Niezgodna suma danych: ${url}`);
  }
  return JSON.parse(text) as T;
}
export async function loadOverviewLand(
  info: FeatureInfo,
  overrides: AdminWorldOverrides,
  signal: AbortSignal,
): Promise<LandData> {
  const base = `${OVERVIEW_BASE}/${info["id"]}/`;
  const manifest = await jsonFile<{ files: Record<string, string> }>(
    base + "manifest.json",
    signal,
  );
  const read = <T>(path: string) => {
    const hash = manifest.files[path];
    if (!hash) throw Error("Brak pliku w manifeście: " + path);
    return jsonFile<T>(base + path, signal, hash);
  };
  const [source, spawns, nav, terrain, collision] = await Promise.all([
    read<OverviewSource>("world.json"),
    read<{ feature: string; overworld: AuthoredSpawn[] }>("spawns.json"),
    read<GridData>("navigation.json"),
    read<GridData>("terrain.json"),
    read<Obstacle[]>("collision.json"),
  ]);
  if (
    source.feature !== info["id"] ||
    spawns.feature !== info["id"] ||
    manifest.files["world.json"] !== info.worldSha256
  )
    throw Error("Niezgodny ląd lub wersja danych: " + info["id"]);
  const navigation = browserNavigation(info.width, info.height, nav, terrain, collision);
  const built = buildLandEntries(info, source, spawns.overworld, navigation, overrides);
  return { info, source, ...built, collision, manifest: manifest.files };
}
export async function loadOverview(
  overrides: AdminWorldOverrides,
  signal: AbortSignal,
  onProgress: (n: number) => void,
) {
  // Fetch the same index as prepareSuperior; the editor can mutate its in-memory import.
  const index = await jsonFile<{ format: string; features: FeatureInfo[] }>(
    OVERVIEW_BASE + "/index.json",
    signal,
  );
  const allowed = new Set(OVERVIEW_INDEX.features.map((f) => f.id));
  if (
    index.format !== "superior-runtime-1" ||
    index.features.length !== 10 ||
    new Set(index.features.map((f) => f.id)).size !== 10 ||
    index.features.some((f) => !allowed.has(f.id))
  )
    throw Error("Nieobsługiwany indeks Superior v2");
  const pending = [...index.features],
    lands: LandData[] = [];
  const worker = async () => {
    while (pending.length && !signal.aborted) {
      const info = pending.shift()!;
      lands.push(await loadOverviewLand(info, overrides, signal));
      onProgress(lands.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return lands.sort((a, b) => a.info["id"].localeCompare(b.info["id"]));
}
/** Twelve visible cells at most. The caller keeps only its current cells; no planet-wide prop cache. */
export async function loadScenery(
  land: LandData,
  x: number,
  y: number,
  signal: AbortSignal,
  artHashes: Record<string, string>,
): Promise<Entry[]> {
  const id = `${x}-${y}`,
    key = `${land.info["id"]}/chunks/${id}.art.json`;
  const hash = land.manifest[`chunks/${id}.json`];
  if (!hash || !artHashes[key]) throw Error("Nieznany fragment dekoracji: " + id);
  const [chunk, art] = await Promise.all([
    jsonFile<BrowserChunk>(`${OVERVIEW_BASE}/${land.info["id"]}/chunks/${id}.json`, signal, hash),
    jsonFile<{ sourceChunkSha256: string; objects: Record<string, unknown>[] }>(
      `${OVERVIEW_BASE}/art/${key}`,
      signal,
      artHashes[key],
    ),
  ]);
  if (art.sourceChunkSha256 !== hash) throw Error("Dekoracje innej wersji terenu");
  return art.objects.map((o) => ({
    id: `scenery:${land.info["id"]}:${String(o["id"])}`,
    sourceId: String(o["id"]),
    land: land.info["id"],
    x: Number(o["x"]),
    y: Number(o["y"]),
    name: String(o["binding"] ?? o["kind"] ?? o["id"]),
    layer: "scenery",
    status: "data",
    source: key + " (paczka oprawy; o widoczności decyduje renderer)",
    details: { ...o, terrainChunk: chunk.id },
    search: normalized(JSON.stringify(o)),
  }));
}
