import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  PackSchema,
  DIRECTIONS,
  type AssetPack,
  type AssetDefinition,
  type TextureRef,
} from "../../src/game/assets/schema.ts";
import { GPU_CONTRACT } from "../../src/game/assets/contract.ts";
import {
  makeCatalog,
  worldAssets,
  actorVisual,
  worldRenderRefs,
  catalog,
} from "../../src/game/assets/catalog.ts";
import { WORLD_IDS } from "../../src/game/world/races.ts";
import { WORLDS } from "../../src/game/world/worlds.ts";
export type Inspected = {
  width: number;
  height: number;
  frames: Map<string, { width: number; height: number; trimmed: boolean }>;
  bytes: number;
  alpha: boolean;
};
function requireThat(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}
export async function sourcePath(root: string, relative: string) {
  requireThat(
    !path.isAbsolute(relative) &&
      !relative.includes("\\") &&
      !relative.split("/").includes("..") &&
      !relative.includes(":"),
    "Source must be a relative local path: " + relative,
  );
  const base = await realpath(root),
    file = await realpath(path.resolve(base, relative));
  requireThat(file.startsWith(base + path.sep), "Source escapes package directory: " + relative);
  return file;
}
export async function inspectAsset(
  asset: AssetDefinition,
  file: string,
  atlasFile?: string,
  rasterOnly = false,
): Promise<Inspected> {
  const meta = await sharp(file, { limitInputPixels: GPU_CONTRACT.maxAtlasSide ** 2 }).metadata();
  if (rasterOnly)
    requireThat(
      (meta.format === "png" || meta.format === "webp") && meta.depth === "uchar",
      "Deliver 8-bit PNG or WebP pixels: " + asset.id,
    );
  const width = meta.width,
    height = meta.height;
  requireThat(width && height, "Cannot decode image: " + asset.id);
  requireThat(
    width <= GPU_CONTRACT.maxAtlasSide && height <= GPU_CONTRACT.maxAtlasSide,
    "Atlas exceeds 2048 px: " + asset.id,
  );
  requireThat(
    (!asset.width || width === asset.width) && (!asset.height || height === asset.height),
    "Image resolution mismatch: " + asset.id,
  );
  // Decode the entire payload, not just a valid-looking header.
  await sharp(file, { limitInputPixels: GPU_CONTRACT.maxAtlasSide ** 2 })
    .raw()
    .toBuffer();
  const frames: Inspected["frames"] = new Map([["__BASE", { width, height, trimmed: false }]]);
  if (asset.kind === "atlas") {
    requireThat(atlasFile, "Atlas JSON missing: " + asset.id);
    const json = JSON.parse(await readFile(atlasFile, "utf8"));
    requireThat(
      json && json.frames && !Array.isArray(json.frames) && typeof json.frames === "object",
      "Expected Phaser JSON hash: " + asset.id,
    );
    for (const [name, entry] of Object.entries(json.frames)) {
      const f = entry as {
        frame: { x: number; y: number; w: number; h: number };
        rotated?: boolean;
        trimmed?: boolean;
        sourceSize?: { w: number; h: number };
        spriteSourceSize?: { x: number; y: number; w: number; h: number };
      };
      const r = f?.frame,
        s = f?.sourceSize,
        t = f?.spriteSourceSize;
      requireThat(
        r &&
          [r.x, r.y, r.w, r.h].every(Number.isInteger) &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.w > 0 &&
          r.h > 0 &&
          r.x + r.w <= width &&
          r.y + r.h <= height,
        "Invalid atlas frame: " + name,
      );
      requireThat(!f.rotated, "Rotated frames are unsupported: " + name);
      requireThat(
        s &&
          t &&
          [s.w, s.h, t.x, t.y, t.w, t.h].every(Number.isInteger) &&
          s.w > 0 &&
          s.h > 0 &&
          t.x >= 0 &&
          t.y >= 0 &&
          t.w === r.w &&
          t.h === r.h &&
          t.x + t.w <= s.w &&
          t.y + t.h <= s.h,
        "Missing/invalid trim metadata: " + name,
      );
      requireThat(
        f.trimmed || (t.x === 0 && t.y === 0 && t.w === s.w && t.h === s.h),
        "Invalid untrimmed frame metadata: " + name,
      );
      frames.set(name, { width: s.w, height: s.h, trimmed: !!f.trimmed });
    }
    requireThat(frames.size > 1, "Empty atlas: " + asset.id);
  } else if (asset.kind === "sheet" || asset.grid) {
    const w = asset.frameWidth ?? Math.floor(width / asset.grid!.columns),
      h = asset.frameHeight ?? Math.floor(height / asset.grid!.rows);
    requireThat(w && h && w > 0 && h > 0, "Missing sheet frame dimensions: " + asset.id);
    // The two legacy 1254px sheets intentionally contain a 2px unused remainder.
    requireThat(
      asset.version.startsWith("legacy-") || (width % w === 0 && height % h === 0),
      "Sheet dimensions are not divisible by frame size: " + asset.id,
    );
    for (let i = 0; i < Math.floor(width / w) * Math.floor(height / h); i++)
      frames.set(String(i), { width: w, height: h, trimmed: false });
  }
  for (const c of asset.crops ?? []) {
    requireThat(
      c.x + c.width <= width && c.y + c.height <= height,
      "Crop outside image: " + asset.id,
    );
    frames.set(String(c.name), { width: c.width, height: c.height, trimmed: false });
  }
  return { width, height, frames, bytes: (await stat(file)).size, alpha: meta.hasAlpha ?? false };
}
function frameInfo(ref: TextureRef, infos: Map<string, Inspected>) {
  const info = infos.get(ref.asset),
    frame = info?.frames.get(String(ref.frame ?? "__BASE"));
  requireThat(
    info && frame,
    "Missing texture/frame: " + ref.asset + "/" + String(ref.frame ?? "__BASE"),
  );
  return { info, frame };
}
export async function validatePackage(manifest: string) {
  const sourceRoot = path.dirname(path.resolve(manifest));
  const pack = PackSchema.parse(JSON.parse(await readFile(manifest, "utf8")));
  requireThat(
    new Set(pack.assets.map((a) => a.id)).size === pack.assets.length,
    "Duplicate asset ID",
  );
  requireThat(
    new Set(pack.actors.map((a) => a.id)).size === pack.actors.length,
    "Duplicate actor ID",
  );
  const infos = new Map<string, Inspected>(),
    files = new Map<string, string>();
  for (const asset of pack.assets) {
    requireThat(
      asset.version === pack.version,
      "Asset and package versions must match: " + asset.id,
    );
    requireThat(
      asset.kind !== "svg" && /\.(png|webp)$/i.test(asset.url),
      "GPU deliveries must use PNG or WebP: " + asset.id,
    );
    const file = await sourcePath(sourceRoot, asset.url),
      atlasFile = asset.atlasUrl && (await sourcePath(sourceRoot, asset.atlasUrl));
    requireThat(
      (await stat(file)).size <= 32 * 1024 * 1024,
      "Input image exceeds 32 MiB: " + asset.id,
    );
    const inspected = await inspectAsset(asset, file, atlasFile, true);
    if (inspected.alpha) {
      const alpha = (await sharp(file).stats()).channels[3];
      inspected.alpha = !!alpha && alpha.min < 255 && alpha.max > 0;
    }
    if (asset.id === "ui-icons")
      requireThat(
        asset.kind === "sheet" &&
          asset.frameWidth === 256 &&
          asset.frameHeight === 256 &&
          inspected.width === 768 &&
          inspected.height === 768,
        "HUD requires the current 3x3 / 256px icon grid",
      );
    if (asset.id === "forest-terrain")
      requireThat(
        asset.kind === "image" && inspected.width === 1904 && inspected.height === 1904,
        "Preserve the accepted forest autotile layout (1904x1904, tile64/margin2/spacing4)",
      );
    infos.set(asset.id, inspected);
    files.set(asset.id, file);
    if (atlasFile) files.set(asset.id + ".json", atlasFile);
  }
  for (const actor of pack.actors) {
    const required =
      actor.profile === "npc"
        ? (["idle", "walk"] as const)
        : (Object.keys(GPU_CONTRACT.animations) as (keyof typeof GPU_CONTRACT.animations)[]);
    if (!pack.technical) {
      const expected = actor.profile === "enemy" ? GPU_CONTRACT.enemy : GPU_CONTRACT.hero;
      requireThat(
        actor.size.every((n, i) => n === expected.size[i]) &&
          actor.origin.every((n, i) => n === expected.origin[i]),
        "Keep current world scale/feet anchor: " + actor.id,
      );
      for (const state of required)
        requireThat(actor.clips[state], "Missing production state: " + actor.id + "/" + state);
    }
    for (const [state, clip] of Object.entries(actor.clips)) {
      const spec =
        GPU_CONTRACT.animations[state as keyof typeof GPU_CONTRACT.animations] ??
        GPU_CONTRACT.animations.walk;
      if (!pack.technical)
        requireThat(
          DIRECTIONS.every((d) => clip.directions[d]) &&
            Object.keys(clip.directions).length === 8 &&
            clip.fps === spec.fps &&
            clip.loop === spec.loop,
          "Invalid production directions/FPS/loop: " + actor.id + "/" + state,
        );
      for (const [direction, names] of Object.entries(clip.directions)) {
        if (!pack.technical)
          requireThat(
            names.length === spec.frames,
            "Invalid frame count: " + actor.id + "/" + state + "/" + direction,
          );
        requireThat(
          new Set(names).size === names.length,
          "Duplicate frames within a clip: " + actor.id + "/" + state,
        );
        for (const name of names) {
          const { info, frame } = frameInfo({ asset: clip.asset, frame: name }, infos);
          requireThat(info.alpha, "Actor image needs transparency: " + actor.id);
          if (!pack.technical)
            requireThat(
              frame.width === GPU_CONTRACT.deliveryFrame &&
                frame.height === GPU_CONTRACT.deliveryFrame,
              "Actor sourceSize must be 128x128: " + actor.id,
            );
        }
      }
    }
  }
  for (const [key, actor] of Object.entries(pack.actorBindings)) {
    requireThat(
      /^(hero\.human-v2|enemy|npc|(verdant|aether|nexus|pyra)\.(hero|enemy|npc)(\.(default|guide|hunter|merchant|smith))?)$/.test(
        key,
      ),
      "Unknown actor binding: " + key,
    );
    requireThat(
      pack.actors.some((a) => a.id === actor),
      "Actor binding missing definition: " + actor,
    );
  }
  for (const [key, ref] of Object.entries(pack.renderBindings)) {
    requireThat(
      /^(object\.|terrain\.|atmosphere\.|effect\.shield$)/.test(key),
      "Unknown render binding: " + key,
    );
    const { info, frame } = frameInfo(ref, infos);
    if (key === "terrain.verdant")
      requireThat(
        !ref.frame &&
          !ref.tileSize &&
          info.width === 1904 &&
          info.height === 1904 &&
          pack.assets.find((a) => a.id === ref.asset)?.kind === "image",
        "Preserve forest autotile source layout for terrain.verdant",
      );
    if (key.startsWith("terrain.") || key.startsWith("atmosphere."))
      requireThat(!frame.trimmed, "Repeatable texture must not be trimmed: " + key);
    else requireThat(info.alpha, "Object/effect image needs transparency: " + key);
  }
  for (const effect of Object.values(pack.effects))
    for (const frame of effect.frames) frameInfo({ asset: effect.asset, frame }, infos);
  return { pack, infos, files };
}
export async function checkActiveAssets(root = process.cwd()) {
  const results: Record<string, { textures: number; rgbaBytes: number }> = {};
  const measured = new Map<string, Inspected>();
  for (const a of catalog.assets.values())
    measured.set(
      a.id,
      await inspectAsset(
        a,
        path.join(root, "public", a.url),
        a.atlasUrl ? path.join(root, "public", a.atlasUrl) : undefined,
      ),
    );
  for (const world of WORLD_IDS) {
    const assets = worldAssets(world);
    let bytes = 0;
    for (const a of assets) {
      const i = measured.get(a.id)!;
      bytes += i.width * i.height * 4;
    }
    requireThat(
      bytes <= GPU_CONTRACT.maxWorldTextureBytes,
      "World exceeds 128 MiB decoded texture budget: " + world,
    );
    results[world] = { textures: assets.length, rgbaBytes: bytes };
    validateWorldReferences(world, catalog, measured);
  }
  return results;
}
function validateWorldReferences(
  world: (typeof WORLD_IDS)[number],
  source: ReturnType<typeof makeCatalog>,
  measured: Map<string, Inspected>,
) {
  for (const ref of worldRenderRefs(world, source)) frameInfo(ref, measured);
  const actors = [
    actorVisual(world, "hero", undefined, false, source),
    actorVisual(world, "enemy", undefined, false, source),
    ...WORLDS[world].npcs.map((n) => actorVisual(world, "npc", n.id, false, source)),
  ];
  for (const actor of actors)
    for (const clip of Object.values(actor.clips))
      for (const frames of Object.values(clip.directions))
        for (const frame of frames!) frameInfo({ asset: clip.asset, frame }, measured);
  for (const [key, effect] of Object.entries(source.effects))
    if (!key.includes(".") || key.startsWith(world + "."))
      for (const frame of effect.frames) frameInfo({ asset: effect.asset, frame }, measured);
}
export async function importPackage(
  manifest: string,
  options: { root?: string; install?: boolean; replace?: boolean } = {},
) {
  const root = options.root ?? process.cwd(),
    validated = await validatePackage(manifest);
  const pack = structuredClone(validated.pack),
    outputFiles = new Map<string, Buffer>();
  let bytesBefore = 0,
    bytesAfter = 0;
  for (const asset of pack.assets) {
    const file = validated.files.get(asset.id)!,
      info = validated.infos.get(asset.id)!;
    const image = await sharp(file).webp({ lossless: true, effort: 4 }).toBuffer();
    requireThat(image.length <= 8 * 1024 * 1024, "Optimized image exceeds 8 MiB: " + asset.id);
    const filename = asset.id + ".webp";
    outputFiles.set(filename, image);
    bytesBefore += info.bytes;
    bytesAfter += image.length;
    asset.url = filename;
    asset.width = info.width;
    asset.height = info.height;
    if (asset.atlasUrl) {
      const atlas = JSON.parse(await readFile(validated.files.get(asset.id + ".json")!, "utf8"));
      atlas.meta = { ...atlas.meta, image: filename };
      asset.atlasUrl = asset.id + ".json";
      outputFiles.set(asset.atlasUrl, Buffer.from(JSON.stringify(atlas) + "\n"));
    }
  }
  const hash = createHash("sha256").update(JSON.stringify(pack));
  for (const [name, file] of [...outputFiles].sort(([a], [b]) => a.localeCompare(b)))
    hash.update(name).update(file);
  const digest = hash.digest("hex"),
    directory = `game/assets/gpu/${pack.id}/${pack.version}-${digest.slice(0, 12)}`;
  for (const asset of pack.assets) {
    asset.url = "/" + directory + "/" + asset.url;
    if (asset.atlasUrl) asset.atlasUrl = "/" + directory + "/" + asset.atlasUrl;
  }
  const registry = path.join(root, "src/game/assets/imported.json");
  const current = JSON.parse(await readFile(registry, "utf8")).map((p: unknown) =>
    PackSchema.parse(p),
  ) as AssetPack[];
  const previous = current.find((p) => p.id === pack.id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(pack)) {
    requireThat(options.replace, "Package already installed; use --replace for a reviewed update");
    requireThat(previous.version !== pack.version, "Content changed without a version bump");
  }
  const others = current.filter((p) => p.id !== pack.id);
  for (const other of others)
    for (const asset of pack.assets)
      requireThat(
        !other.assets.some((a) => a.id === asset.id),
        "Asset ID owned by another package: " + asset.id,
      );
  // Validate links and the complete replacement catalogue before touching active files.
  const combined = makeCatalog([...others, pack]);
  for (const actor of combined.actors.values())
    for (const clip of Object.values(actor.clips))
      requireThat(combined.assets.has(clip.asset), "Clip references unknown asset: " + clip.asset);
  const measured = new Map(validated.infos),
    worlds: Record<string, number> = {};
  for (const world of WORLD_IDS) {
    let bytes = 0;
    for (const asset of worldAssets(world, false, combined)) {
      let info = measured.get(asset.id);
      if (!info) {
        info = await inspectAsset(
          asset,
          path.join(root, "public", asset.url),
          asset.atlasUrl ? path.join(root, "public", asset.atlasUrl) : undefined,
        );
        measured.set(asset.id, info);
      }
      bytes += info.width * info.height * 4;
    }
    requireThat(
      bytes <= GPU_CONTRACT.maxWorldTextureBytes,
      "World exceeds decoded texture budget: " + world,
    );
    worlds[world] = bytes;
    validateWorldReferences(world, combined, measured);
  }
  const result = {
    id: pack.id,
    version: pack.version,
    digest,
    assets: pack.assets.length,
    bytesBefore,
    bytesAfter,
    worlds,
    installed: !!options.install,
    directory,
  };
  if (!options.install) return result;
  const target = path.join(root, "public", directory),
    staging = target + ".tmp-" + process.pid;
  await mkdir(staging, { recursive: true });
  try {
    for (const [name, file] of outputFiles) await writeFile(path.join(staging, name), file);
    await writeFile(path.join(staging, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
    try {
      await stat(target);
      await rm(staging, { recursive: true });
    } catch {
      await rename(staging, target);
    }
    const next = path.join(path.dirname(registry), "imported.tmp-" + process.pid + ".json");
    await writeFile(next, JSON.stringify([...others, pack], null, 2) + "\n");
    await rename(next, registry);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return result;
}
