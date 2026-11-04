import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const pack = {
  schemaVersion: 1,
  id: "verdantia-continent-v2",
  version: "1.0.1",
  previewOnly: true,
  assets: [],
  actors: [],
  actorBindings: {},
  renderBindings: {},
  effects: {},
};
const sources = [];
async function add(name, source, kind, tileSize, crop) {
  const input = path.join(root, "source", source + ".png");
  const bytes = await readFile(input);
  sources.push({ name: source, sha256: createHash("sha256").update(bytes).digest("hex") });
  let image = sharp(bytes);
  if (crop) image = image.extract(crop);
  if (kind === "object")
    image = image.trim({ threshold: 1 }).extend({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  const url = name + ".webp";
  await image
    .resize({
      width: kind === "object" ? 512 : name === "grass" || name.startsWith("road") ? 768 : 640,
      height: kind === "object" ? 512 : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(path.join(root, url));
  const { width, height } = await sharp(path.join(root, url)).metadata();
  const id = "verdantia-continent-" + name;
  pack.assets.push({ id, version: pack.version, kind: "image", url, width, height });
  pack.renderBindings[kind + ".verdantia-continent." + name] = {
    asset: id,
    ...(tileSize ? { tileSize } : { fit: "contain", origin: [0.5, 0.92] }),
  };
}
await add("grass", "verdantia-meadow-generated", "terrain", [1024, 1024]);
for (const name of ["forest", "rockg", "wet", "sand", "water"])
  await add(name, "verdantia-" + name, "terrain", [1024, 1024]);
for (let i = 1; i <= 4; i++)
  await add("road" + i, "verdantia-road" + i, "terrain", [1024, 176], {
    left: 0,
    top: 970,
    width: 2048,
    height: 290,
  });
for (const [name, source] of [
  ["oak", "verdantia-oak-generated"],
  ["pine", "verdantia-tree2"],
  ["bush", "verdantia-bush"],
  ["rocks", "verdantia-rocks"],
  ["flora", "verdantia-flora"],
])
  await add(name, source, "object");
await writeFile(path.join(root, "manifest.json"), JSON.stringify(pack, null, 2) + "\n");
await writeFile(path.join(root, "sources.sha256.json"), JSON.stringify(sources, null, 2) + "\n");
