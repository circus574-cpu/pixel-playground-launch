import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const groups = [
  [
    "verdantia-podszyt-8-wariantow.png",
    4,
    ["fern", "blueberry", "bramble", "grass", "mushrooms", "flowers", "burdock", "rose"],
  ],
  [
    "verdantia-stare-drzewa-i-drewno-6-wariantow.png",
    3,
    ["ancient-oak", "birch", "willow", "log", "stump", "roots"],
  ],
  [
    "verdantia-naturalne-formy-terenu-6-wariantow.png",
    3,
    ["hill", "cliff", "arch", "spring", "ridge", "cave"],
  ],
  [
    "verdantia-odkrycia-i-rekwizyty-6-wariantow.png",
    3,
    ["bridge", "sign", "cart", "shrine", "camp", "chest"],
  ],
];
const pack = {
  schemaVersion: 1,
  id: "verdantia-extra-runtime",
  version: "1.0.1",
  previewOnly: true,
  assets: [],
  actors: [],
  actorBindings: {},
  renderBindings: {},
  effects: {},
};
const sources = [];
// Remove only small disconnected fragments crossing in from adjacent sheet cells.
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
for (const [file, columns, names] of groups) {
  const bytes = await readFile(path.join(root, "source", file));
  const meta = await sharp(bytes).metadata();
  sources.push({
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    columns,
    rows: 2,
    names,
  });
  for (let i = 0; i < names.length; i++) {
    const name = names[i],
      col = i % columns,
      row = Math.floor(i / columns);
    const left = Math.floor((col * meta.width) / columns),
      top = Math.floor((row * meta.height) / 2);
    const width = Math.floor(((col + 1) * meta.width) / columns) - left,
      height = Math.floor(((row + 1) * meta.height) / 2) - top;
    const side = ["hill", "cliff", "arch", "spring", "ridge", "cave", "bridge"].includes(name)
      ? 512
      : ["ancient-oak", "birch", "willow", "cliff", "arch", "spring", "cave", "bridge"].includes(
            name,
          )
        ? 384
        : columns === 4
          ? 192
          : 256;
    const url = name + ".webp";
    const cropped = await isolateCell(
      await sharp(bytes).extract({ left, top, width, height }).png().toBuffer(),
    );
    await sharp(cropped)
      .trim({ threshold: 2 })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: side, height: side, fit: "inside" })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(path.join(root, url));
    const output = await sharp(path.join(root, url)).metadata();
    const id = "verdantia-extra-" + name;
    pack.assets.push({
      id,
      version: pack.version,
      kind: "image",
      url,
      width: output.width,
      height: output.height,
    });
    pack.renderBindings["object.verdantia-extra." + name] = {
      asset: id,
      fit: "contain",
      origin: [0.5, 0.92],
    };
  }
}
await writeFile(path.join(root, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
await writeFile(path.join(root, "sources.sha256.json"), JSON.stringify(sources, null, 2) + "\n");
