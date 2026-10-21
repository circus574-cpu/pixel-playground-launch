import sharp, { type OverlayOptions } from "sharp";
import { mkdir, writeFile, stat, rename, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { frameLayout } from "./frame-layout.ts";
import { GPU_CONTRACT } from "../../src/game/assets/contract.ts";
import { sourcePath, validatePackage } from "./gpu-import.ts";
export async function packFrames(
  source: string,
  output: string,
  id: string,
  world: string,
  profile: "hero" | "enemy" | "npc" = "hero",
  version = "1.0.0",
  presentation: "legacy" | "grounded" = "legacy",
  resizeKernel: "lanczos3" | "lanczos2" = "lanczos3",
) {
  const rawSide = GPU_CONTRACT.rawFrame,
    side = GPU_CONTRACT.deliveryFrame;
  const layout = frameLayout(id, world, profile, version, presentation),
    out = path.resolve(output),
    staging = out + ".tmp-" + process.pid;
  try {
    await stat(out);
    throw Error("Output already exists; choose a new version directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const files = await readdir(source, { recursive: true });
  const actual = files.filter((f) => f.endsWith(".png")).map((f) => f.split(path.sep).join("/"));
  if (
    actual.length !== layout.sources.length ||
    actual.some((p) => !layout.sources.some((s) => s.path === p))
  )
    throw Error(`Expected exactly ${layout.sources.length} named PNG frames`);
  const layers: OverlayOptions[][] = layout.pages.map(() => []);
  await mkdir(staging, { recursive: true });
  try {
    for (const frame of layout.sources) {
      const file = await sourcePath(source, frame.path),
        meta = await sharp(file, { limitInputPixels: rawSide * rawSide }).metadata();
      if (
        meta.width !== rawSide ||
        meta.height !== rawSide ||
        meta.format !== "png" ||
        meta.depth !== "uchar" ||
        !meta.hasAlpha ||
        meta.channels !== 4
      )
        throw Error("Raw render must be 512x512 8-bit RGBA PNG: " + frame.path);
      const raw = await sharp(file)
        .resize(side, side, { kernel: resizeKernel })
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer();
      let opaque = 0;
      for (let y = 0; y < side; y++)
        for (let x = 0; x < side; x++) {
          const alpha = raw[(y * side + x) * 4 + 3]!;
          if (alpha > 0) {
            opaque++;
            if (x < 2 || x >= side - 2 || y < 2 || y >= side - 2)
              throw Error("Keep a 2px transparent delivery border: " + frame.path);
          }
        }
      if (!opaque) throw Error("Empty animation frame: " + frame.path);
      layers[frame.page]!.push({
        input: await sharp(raw, { raw: { width: side, height: side, channels: 4 } })
          .png()
          .toBuffer(),
        left: frame.x,
        top: frame.y,
      });
    }
    for (const [i, page] of layout.pages.entries()) {
      await sharp({
        create: { width: page.width, height: page.height, channels: 4, background: "#00000000" },
      })
        .composite(layers[i]!)
        .webp({ lossless: true, effort: 4 })
        .toFile(path.join(staging, page.asset + ".webp"));
      await writeFile(
        path.join(staging, page.asset + ".json"),
        JSON.stringify({
          frames: page.frames,
          meta: {
            image: page.asset + ".webp",
            size: { w: page.width, h: page.height },
            scale: "1",
          },
        }) + "\n",
      );
    }
    await writeFile(
      path.join(staging, "manifest.json"),
      JSON.stringify(layout.pack, null, 2) + "\n",
    );
    await validatePackage(path.join(staging, "manifest.json"));
    await rename(staging, out);
    return {
      id,
      world,
      profile,
      frames: layout.sources.length,
      pages: layout.pages.length,
      deliveryFrame: GPU_CONTRACT.deliveryFrame,
      manifest: path.join(out, "manifest.json"),
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
