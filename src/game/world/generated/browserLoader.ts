/** Verified JSON/chunk loading for generated worlds. CPU/NPZ libraries never enter the browser. */
import { browserNavigation, decodeRuns, type GridData } from "./browserTerrain";
import type { Obstacle } from "../../movement";
export type BrowserChunk = {
  format: "superior-browser-1";
  id: string;
  x: number;
  y: number;
  terrain: GridData & { biome: [number, number][] };
  navigation: GridData;
  colliders: (Obstacle & { id: string })[];
  objects: { id: string; x: number; y: number; kind: string; solid: boolean }[];
};
export type BrowserFeature = {
  feature: string;
  geometry: { width: number; height: number; cellSize: number; anchor: { x: number; y: number } };
  [key: string]: unknown;
};
type Manifest = { format: string; files: Record<string, string> };
const FEATURES = /^(verdant|aether|nexus|pyra|island-[1-6])$/;
const hex = (data: ArrayBuffer) =>
  [...new Uint8Array(data)].map((v) => v.toString(16).padStart(2, "0")).join("");
export async function loadBrowserFeature(
  base: string,
  feature: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
) {
  if (!FEATURES.test(feature)) throw Error("Unknown generated planet feature");
  const fetcher = options.fetcher ?? fetch,
    prefix = base.replace(/\/$/, "") + "/" + feature + "/";
  const get = async (path: string, expected?: string) => {
    if (!/^[a-zA-Z0-9/_-]+\.json$/.test(path) || path.includes(".."))
      throw Error("Unsafe generated asset path");
    const response = await fetcher(prefix + path, options.signal ? { signal: options.signal } : {});
    if (!response.ok) throw Error("Generated world HTTP " + response.status);
    const text = await response.text();
    if (
      expected &&
      hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))) !== expected
    )
      throw Error("Generated world checksum mismatch: " + path);
    return JSON.parse(text) as unknown;
  };
  const manifest = (await get("manifest.json")) as Manifest;
  if (
    manifest.format !== "superior-browser-1" ||
    !manifest.files ||
    Object.values(manifest.files).some((v) => typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v))
  )
    throw Error("Unknown generated world manifest");
  const verified = async (path: string) => {
    const expected = manifest.files[path];
    if (!expected) throw Error("Unlisted generated world asset");
    return await get(path, expected);
  };
  const [world, navData, terrain, rectangles] = await Promise.all([
    verified("world.json"),
    verified("navigation.json"),
    verified("terrain.json"),
    verified("collision.json"),
  ]);
  const definition = world as BrowserFeature;
  if (definition.feature !== feature || !definition.geometry || !Array.isArray(rectangles))
    throw Error("Generated feature identity mismatch");
  const navigation = browserNavigation(
    definition.geometry.width,
    definition.geometry.height,
    navData as GridData,
    terrain as GridData,
    rectangles as Obstacle[],
  );
  const cache = new Map<string, BrowserChunk>(),
    pending = new Map<string, Promise<BrowserChunk>>();
  return {
    definition,
    navigation,
    async loadChunk(x: number, y: number): Promise<BrowserChunk> {
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x * 2048 >= definition.geometry.width ||
        y * 2048 >= definition.geometry.height
      )
        throw Error("Generated chunk outside feature");
      const id = x + "-" + y,
        cached = cache.get(id);
      if (cached) {
        cache.delete(id);
        cache.set(id, cached);
        return cached;
      }
      if (pending.has(id)) return pending.get(id)!;
      const promise = (async () => {
        const chunk = (await verified("chunks/" + id + ".json")) as BrowserChunk;
        if (
          chunk.format !== "superior-browser-1" ||
          chunk.id !== id ||
          chunk.x !== x * 2048 ||
          chunk.y !== y * 2048 ||
          !Array.isArray(chunk.objects) ||
          chunk.objects.length > 30000 ||
          chunk.terrain.cell !== 32 ||
          chunk.navigation.cell !== 16 ||
          chunk.terrain.width < 1 ||
          chunk.terrain.width > 64 ||
          chunk.terrain.height < 1 ||
          chunk.terrain.height > 64 ||
          chunk.navigation.width !== chunk.terrain.width * 2 ||
          chunk.navigation.height !== chunk.terrain.height * 2
        )
          throw Error("Invalid generated chunk");
        decodeRuns(chunk.terrain.flags, chunk.terrain.width * chunk.terrain.height);
        decodeRuns(chunk.terrain.biome, chunk.terrain.width * chunk.terrain.height);
        decodeRuns(chunk.navigation.blocked, chunk.navigation.width * chunk.navigation.height);
        cache.set(id, chunk);
        while (cache.size > 12) cache.delete(cache.keys().next().value!);
        return chunk;
      })();
      pending.set(id, promise);
      try {
        return await promise;
      } finally {
        pending.delete(id);
      }
    },
    loadSpawns: () => verified("spawns.json"),
    cachedChunks: () => cache.size,
    clear: () => cache.clear(),
  };
}
