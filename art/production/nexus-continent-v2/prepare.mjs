import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const jobs = JSON.parse(await readFile(path.join(root, "source/jobs.json"), "utf8"));
const pack = {
  schemaVersion: 1,
  id: "nexus-continent-v2",
  version: "1.0.0",
  previewOnly: true,
  assets: [],
  actors: [],
  actorBindings: {},
  renderBindings: {},
  effects: {},
};
const hashes = [];
async function isolateCell(cropped) {
  const { data, info } = await sharp(cropped)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height,
    labels = new Int32Array(w * h),
    queue = new Int32Array(w * h),
    components = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] <= 24) continue;
    const id = components.length + 1;
    let head = 0,
      tail = 1,
      edge = false;
    queue[0] = start;
    labels[start] = id;
    while (head < tail) {
      const i = queue[head++],
        x = i % w,
        y = Math.floor(i / w);
      if (!x || !y || x === w - 1 || y === h - 1) edge = true;
      for (const j of [
        x > 0 ? i - 1 : -1,
        x < w - 1 ? i + 1 : -1,
        y > 0 ? i - w : -1,
        y < h - 1 ? i + w : -1,
      ])
        if (j >= 0 && !labels[j] && data[j * 4 + 3] > 24) {
          labels[j] = id;
          queue[tail++] = j;
        }
    }
    components.push({ id, area: tail, edge });
  }
  const largest = Math.max(...components.map((c) => c.area));
  const removed = new Set(
    components.filter((c) => c.edge && c.area < largest * 0.12).map((c) => c.id),
  );
  for (let i = 0; i < labels.length; i++) {
    const x = i % w;
    if (
      removed.has(labels[i]) ||
      (!labels[i] &&
        [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].some(
          (j) => j >= 0 && j < labels.length && removed.has(labels[j]),
        ))
    )
      data[i * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

for (const job of jobs) {
  const file = job.name + ".png",
    bytes = await readFile(path.join(root, "source", file));
  hashes.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
  const meta = await sharp(bytes).metadata(),
    cw = Math.floor(meta.width / job.cols),
    ch = Math.floor(meta.height / job.rows);
  for (let i = 0; i < job.names.length; i++) {
    const name = job.names[i],
      surface = job.kind === "terrain" || job.kind === "road";
    let b = await sharp(bytes)
      .extract({
        left: (i % job.cols) * cw,
        top: Math.floor(i / job.cols) * ch,
        width: cw,
        height: ch,
      })
      .png()
      .toBuffer();
    if (!surface && job.kind !== "fx") b = await isolateCell(b);
    let img = sharp(b);
    if (!surface) img = img.trim({ threshold: 2 });
    const side = surface
      ? 512
      : job.kind === "large"
        ? 512
        : job.kind === "fx"
          ? 192
          : job.name === "flora" && i < 4
            ? 384
            : 256;
    img = img.resize({ width: side, height: side, fit: "inside", withoutEnlargement: true });
    if (!surface)
      img = img.extend({
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    const url = name + ".webp";
    await img.webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(root, url));
    const { width, height } = await sharp(path.join(root, url)).metadata(),
      id = "nexus-continent-" + name;
    pack.assets.push({ id, version: pack.version, kind: "image", url, width, height });
    pack.renderBindings[(surface ? "terrain" : "object") + ".nexus-continent." + name] = {
      asset: id,
      ...(surface ? { tileSize: [896, 896] } : { fit: "contain", origin: [0.5, 0.92] }),
    };
  }
}
await writeFile(path.join(root, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
await writeFile(path.join(root, "sources.sha256.json"), JSON.stringify(hashes, null, 2) + "\n");
console.log("Prepared", pack.assets.length, "independent images");
