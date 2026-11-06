import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const groups = [
  ["pyra-podloza-4-warianty.png", [2, 2], ["basalt", "ash", "gravel", "leaves"], "terrain"],
  ["pyra-drogi-4-warianty.png", [2, 2], ["road1", "road2", "road3", "road4"], "road"],
  [
    "pyra-woda-lawa-brzegi-6-wariantow.png",
    [3, 3],
    ["water", "lava", "shore", "lava-bank", "sulfur", "ash-rock"],
    "terrain",
  ],
  [
    "pyra-roslinnosc-5-wariantow.png",
    [2, 3],
    ["maple", "pine", "berry-bush", "copper-bush", "lantern-bush"],
    "object",
    0.565,
  ],
  [
    "pyra-formy-terenu-5-wariantow.png",
    [2, 3],
    ["hill", "cliff", "ridge", "crater", "fissure"],
    "large",
  ],
  [
    "pyra-formy-terenu-5-nowych-wariantow.png",
    [2, 3],
    ["obsidian-spire", "rock-arch", "pahoehoe", "spring", "scree"],
    "large",
  ],
  [
    "pyra-drobne-dekoracje-8-wariantow.png",
    [4, 4],
    ["rocks", "shards", "dry-grass", "stump", "log", "leaf-patch", "crystals", "weeds"],
    "object",
  ],
  ["pyra-przejscia-terenowe-4-warianty.png", [2, 2], ["bridge", "steps", "cave", "mine"], "large"],
  [
    "pyra-rekwizyty-swiata-6-wariantow.png",
    [3, 3],
    ["camp", "sign", "fire", "ruin", "cart", "supplies"],
    "object",
  ],
  [
    "pyra-efekty-otoczenia-5-wariantow.png",
    [3, 2],
    ["fx-ash", "fx-embers", "fx-smoke", "fx-heat", "fx-steam"],
    "fx",
  ],
];
const pack = {
  schemaVersion: 1,
  id: "pyra-continent-v2",
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

for (const [file, columns, names, kind, split = 0.5] of groups) {
  const bytes = await readFile(path.join(root, "source", file)),
    meta = await sharp(bytes).metadata();
  sources.push({
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    columns,
    names,
    split,
  });
  let i = 0;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < columns[row]; col++) {
      const name = names[i++],
        left = Math.floor((col * meta.width) / columns[row]),
        rowTop = row === 0 ? 0 : Math.floor(meta.height * split),
        rowEnd = row === 0 ? Math.floor(meta.height * split) : meta.height;
      let top = rowTop,
        width = Math.floor(((col + 1) * meta.width) / columns[row]) - left,
        height = rowEnd - rowTop;
      if (kind === "road") {
        top += Math.floor(height * 0.38);
        height = Math.floor(height * 0.24);
      }
      // Coast/lava-bank samples contribute their solid upper shore, never fake liquid on walkable ground.
      if (name === "shore" || name === "lava-bank") height = Math.floor(height * 0.38);
      let crop = await sharp(bytes).extract({ left, top, width, height }).png().toBuffer();
      const surface = kind === "terrain" || kind === "road";
      if (!surface && kind !== "fx") crop = await isolateCell(crop);
      let image = sharp(crop);
      if (!surface) image = image.trim({ threshold: 2 });
      const side = surface
        ? 512
        : kind === "large"
          ? 512
          : ["maple", "pine"].includes(name)
            ? 384
            : kind === "fx"
              ? 192
              : 256;
      image = image.resize({ width: side, height: side, fit: "inside" });
      if (!surface)
        image = image.extend({
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      const url = name + ".webp";
      await image.webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(root, url));
      const out = await sharp(path.join(root, url)).metadata(),
        id = "pyra-continent-" + name;
      pack.assets.push({
        id,
        version: pack.version,
        kind: "image",
        url,
        width: out.width,
        height: out.height,
      });
      const tileSize = kind === "road" ? [768, 128] : [768, 768];
      pack.renderBindings[(surface ? "terrain" : "object") + ".pyra-continent." + name] = {
        asset: id,
        ...(surface ? { tileSize } : { fit: "contain", origin: [0.5, 0.92] }),
      };
    }
}
await writeFile(path.join(root, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
await writeFile(path.join(root, "sources.sha256.json"), JSON.stringify(sources, null, 2) + "\n");
