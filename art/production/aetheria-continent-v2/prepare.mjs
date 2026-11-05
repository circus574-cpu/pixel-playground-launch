import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const pack = {
  schemaVersion: 1,
  id: "aetheria-continent-v2",
  version: "1.0.0",
  previewOnly: true,
  assets: [],
  actors: [],
  actorBindings: {},
  renderBindings: {},
  effects: {},
};
const sources = [];
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

async function source(file) {
  const bytes = await readFile(path.join(root, "source", file));
  sources.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
  return bytes;
}
async function add(name, bytes, kind, tileSize) {
  let image = sharp(bytes);
  if (kind !== "terrain") {
    bytes = await isolateCell(bytes);
    image = sharp(bytes).trim({ threshold: 2 });
  }
  const large = [
    "hill",
    "cliff",
    "peak",
    "glacier-ridge",
    "arch",
    "spring",
    "ruin",
    "cave",
  ].includes(name);
  const side =
    kind === "terrain"
      ? 512
      : large
        ? 512
        : ["cherry", "ginkgo", "cypress", "snow-pine"].includes(name)
          ? 384
          : 256;
  image = image.resize({ width: side, height: side, fit: "inside", withoutEnlargement: true });
  if (kind !== "terrain")
    image = image.extend({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  const url = name + ".webp";
  await image.webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(root, url));
  const { width, height } = await sharp(path.join(root, url)).metadata(),
    id = "aetheria-continent-" + name;
  pack.assets.push({ id, version: pack.version, kind: "image", url, width, height });
  pack.renderBindings[kind + ".aetheria-continent." + name] = {
    asset: id,
    ...(tileSize ? { tileSize } : { fit: "contain", origin: [0.5, 0.92] }),
  };
}
const ground = await source("generated-surfaces.png"),
  gm = await sharp(ground).metadata();
for (let i = 0; i < 4; i++) {
  const w = Math.floor(gm.width / 2),
    h = Math.floor(gm.height / 2);
  await add(
    ["grass", "forest", "snow", "ice"][i],
    await sharp(ground)
      .extract({ left: (i % 2) * w, top: Math.floor(i / 2) * h, width: w, height: h })
      .png()
      .toBuffer(),
    "terrain",
    [896, 896],
  );
}
for (const name of ["rockg", "wet", "sand", "water"])
  await add(name, await source("aetheria-" + name + ".png"), "terrain", [896, 896]);
for (const name of ["road1", "road2", "road3", "road4", "road5", "river"]) {
  const bytes = await source("aetheria-" + name + ".png"),
    meta = await sharp(bytes).metadata();
  const crop = {
    left: 0,
    top: Math.floor(meta.height * 0.44),
    width: meta.width,
    height: Math.floor(meta.height * 0.12),
  };
  await add(name, await sharp(bytes).extract(crop).png().toBuffer(), "terrain", [896, 128]);
}
for (const [file, columns, names] of [
  [
    "generated-plants.png",
    4,
    ["cherry", "ginkgo", "cypress", "snow-pine", "bamboo", "lavender", "reeds", "flowers"],
  ],
  ["generated-landforms.png", 3, ["hill", "cliff", "peak", "glacier-ridge", "arch", "spring"]],
  ["generated-props.png", 4, ["camp", "shrine", "ruin", "cave", "chest", "sign", "log", "stump"]],
]) {
  const bytes = await source(file),
    meta = await sharp(bytes).metadata(),
    cw = Math.floor(meta.width / columns),
    ch = Math.floor(meta.height / 2);
  for (let i = 0; i < names.length; i++) {
    const crop = await sharp(bytes)
      .extract({
        left: (i % columns) * cw,
        top: Math.floor(i / columns) * ch,
        width: cw,
        height: ch,
      })
      .png()
      .toBuffer();
    await add(names[i], crop, "object");
  }
}
await writeFile(path.join(root, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
await writeFile(path.join(root, "sources.sha256.json"), JSON.stringify(sources, null, 2) + "\n");
console.log("Prepared", pack.assets.length, "assets");
