/** Lossless atlas repack: preserve every visible pixel, frame name, 128² source and foot anchor. */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [sourceRoot, outputRoot] = process.argv.slice(2);
if (!sourceRoot || !outputRoot)
  throw Error("Usage: node pack-enemy-atlases.mjs deliveries new-output");
await fs.mkdir(outputRoot); // Never overwrite an existing delivery.
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = [];
for (const directory of (await fs.readdir(sourceRoot))
  .filter((n) => n.startsWith("enemy-"))
  .sort()) {
  const source = path.join(sourceRoot, directory);
  const manifestBytes = await fs.readFile(path.join(source, "manifest.json"));
  const pack = JSON.parse(manifestBytes);
  if (pack.actors.length !== 1 || pack.actors[0].profile !== "enemy")
    throw Error("Expected one enemy");
  const actor = pack.actors[0];
  const pages = new Map();
  for (const asset of pack.assets) {
    const rgba = await sharp(path.join(source, asset.url))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const atlas = JSON.parse(await fs.readFile(path.join(source, asset.atlasUrl), "utf8"));
    pages.set(asset.id, { ...rgba, atlas });
  }
  const frames = [];
  const sourcePixels = createHash("sha256");
  for (const [state, clip] of Object.entries(actor.clips)) {
    for (const names of Object.values(clip.directions))
      for (const name of names) {
        const page = pages.get(clip.asset),
          f = page.atlas.frames[name];
        if (!f || f.trimmed || f.rotated || f.frame.w !== 128 || f.frame.h !== 128)
          throw Error("Expected original 128² frames");
        const raw = Buffer.alloc(128 * 128 * 4);
        let x0 = 128,
          y0 = 128,
          x1 = -1,
          y1 = -1;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 128; x++) {
            const at = ((f.frame.y + y) * page.info.width + f.frame.x + x) * 4,
              to = (y * 128 + x) * 4;
            if (page.data[at + 3]) {
              page.data.copy(raw, to, at, at + 4);
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
          }
        if (x1 < 0) throw Error("Empty frame: " + name);
        sourcePixels.update(raw);
        x0 = Math.max(0, x0 - 2);
        y0 = Math.max(0, y0 - 2);
        x1 = Math.min(127, x1 + 2);
        y1 = Math.min(127, y1 + 2);
        const w = x1 - x0 + 1,
          h = y1 - y0 + 1;
        const crop = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++)
          raw.copy(crop, y * w * 4, ((y + y0) * 128 + x0) * 4, ((y + y0) * 128 + x0 + w) * 4);
        frames.push({ name, state, x0, y0, w, h, crop });
      }
  }
  const targets = [];
  const fresh = () => ({ x: 2, y: 2, row: 0, right: 0, bottom: 0, frames: [], states: new Set() });
  let page = fresh();
  targets.push(page);
  const place = (current, list) => {
    const result = { ...current, frames: [...current.frames], states: new Set(current.states) };
    for (const frame of list) {
      if (result.x + frame.w + 2 > 2048) {
        result.x = 2;
        result.y += result.row + 4;
        result.row = 0;
      }
      if (result.y + frame.h + 2 > 2048) return null;
      result.frames.push({ ...frame, x: result.x, y: result.y });
      result.states.add(frame.state);
      result.right = Math.max(result.right, result.x + frame.w + 2);
      result.bottom = Math.max(result.bottom, result.y + frame.h + 2);
      result.x += frame.w + 4;
      result.row = Math.max(result.row, frame.h);
    }
    return result;
  };
  for (const state of Object.keys(actor.clips)) {
    const list = frames.filter((f) => f.state === state);
    let next = place(page, list);
    if (!next) {
      page = fresh();
      targets.push(page);
      next = place(page, list);
    }
    if (!next) throw Error("A clip exceeds the atlas limit");
    Object.assign(page, next);
  }
  const destination = path.join(outputRoot, pack.id + "-1.0.1");
  await fs.mkdir(destination);
  pack.version = "1.0.1";
  pack.assets = [];
  const outputPixels = new Map();
  let bytes = 0;
  for (const [i, target] of targets.entries()) {
    const id = pack.id + "-packed-page-" + i,
      w = target.right,
      h = target.bottom;
    const canvas = Buffer.alloc(w * h * 4);
    for (const f of target.frames)
      for (let y = 0; y < f.h; y++)
        f.crop.copy(canvas, ((f.y + y) * w + f.x) * 4, y * f.w * 4, (y + 1) * f.w * 4);
    const png = await sharp(canvas, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(destination, id + ".png"), png);
    const decoded = await sharp(png).ensureAlpha().raw().toBuffer();
    const atlas = { frames: {}, meta: { image: id + ".png", size: { w, h }, scale: "1" } };
    for (const f of target.frames) {
      const raw = Buffer.alloc(128 * 128 * 4);
      for (let y = 0; y < f.h; y++)
        decoded.copy(
          raw,
          ((f.y0 + y) * 128 + f.x0) * 4,
          ((f.y + y) * w + f.x) * 4,
          ((f.y + y) * w + f.x + f.w) * 4,
        );
      outputPixels.set(f.name, raw);
      atlas.frames[f.name] = {
        frame: { x: f.x, y: f.y, w: f.w, h: f.h },
        rotated: false,
        trimmed: true,
        sourceSize: { w: 128, h: 128 },
        spriteSourceSize: { x: f.x0, y: f.y0, w: f.w, h: f.h },
      };
    }
    await fs.writeFile(path.join(destination, id + ".json"), JSON.stringify(atlas));
    pack.assets.push({
      id,
      version: "1.0.1",
      kind: "atlas",
      url: id + ".png",
      atlasUrl: id + ".json",
      width: w,
      height: h,
    });
    for (const state of target.states) actor.clips[state].asset = id;
    bytes += w * h * 4;
  }
  const resultPixels = createHash("sha256");
  for (const f of frames) resultPixels.update(outputPixels.get(f.name));
  const before = sourcePixels.digest("hex"),
    after = resultPixels.digest("hex");
  if (before !== after) throw Error("Visible pixels changed: " + pack.id);
  await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
  report.push({
    id: pack.id,
    sourceManifestSha256: digest(manifestBytes),
    source: source,
    frames: frames.length,
    pages: targets.length,
    originalRgbaBytes: [...pages.values()].reduce(
      (n, p) => n + p.info.width * p.info.height * 4,
      0,
    ),
    packedRgbaBytes: bytes,
    visiblePixelsBefore: before,
    visiblePixelsAfter: after,
  });
  process.stdout.write(pack.id + " " + Math.round((bytes / 1048576) * 100) / 100 + " MiB\n");
}
await fs.writeFile(
  path.join(outputRoot, "packing-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
