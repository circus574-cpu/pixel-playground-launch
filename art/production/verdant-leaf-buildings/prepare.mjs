import sharp from "sharp";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const dir = new URL("./", import.meta.url);
const assets = [],
  renderBindings = {},
  provenance = {};
for (const name of ["hall", "arena", "depot", "shop", "inn", "smithy"]) {
  const source = await fs.readFile(new URL(`sources/${name}.jpg`, dir));
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height,
    seen = new Uint8Array(n),
    queue = new Int32Array(n);
  let head = 0,
    tail = 0;
  const push = (p) => {
    if (p < 0 || p >= n || seen[p]) return;
    const j = p * 4;
    if (Math.min(data[j], data[j + 1], data[j + 2]) < 232) return;
    seen[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < info.width; x++) {
    push(x);
    push(n - info.width + x);
  }
  for (let y = 0; y < info.height; y++) {
    push(y * info.width);
    push(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    if (p % info.width) push(p - 1);
    if (p % info.width < info.width - 1) push(p + 1);
    push(p - info.width);
    push(p + info.width);
  }
  const path = new URL(`${name}.webp`, dir);
  await sharp(data, { raw: info })
    .trim({ background: "#00000000", threshold: 0 })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(path.pathname);
  const out = await sharp(path.pathname).metadata();
  assets.push({
    id: `verdant-leaf-${name}`,
    version: "1.0.0",
    kind: "image",
    url: `${name}.webp`,
    width: out.width,
    height: out.height,
  });
  renderBindings[`object.ki-v2-buildings.verdant-${name === "shop" ? "market" : name}`] = {
    asset: `verdant-leaf-${name}`,
    fit: "contain",
    origin: [0.5, 0.85],
  };
  provenance[name] = {
    source: `sources/${name}.jpg`,
    sha256: createHash("sha256").update(source).digest("hex"),
    author: "Owner supplied; rights not independently verified",
    processing:
      "Edge-connected white matte removal, transparent trim, WebP quality 94; original retained unchanged",
    removedPixels: tail,
  };
}
await fs.writeFile(
  new URL("manifest.json", dir),
  JSON.stringify(
    {
      schemaVersion: 1,
      id: "verdant-leaf-buildings",
      version: "1.0.0",
      previewOnly: true,
      assets,
      renderBindings,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(new URL("provenance.json", dir), JSON.stringify(provenance, null, 2) + "\n");
