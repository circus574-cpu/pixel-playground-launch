import sharp from "sharp";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("./", import.meta.url);
const entries = {
  ground: "ground.jpg",
  forest: "forest.jpg",
  plaza: "plaza.jpg",
  road: "road.jpg",
  hall: "B1_sala_wodza.png",
  shop: "B2_targ.png",
  inn: "B3_karczma.png",
  smithy: "B4_kuznia_goro.png",
  depot: "B5_skarbiec.png",
  arena: "B6_arena_treningowa.png",
};
const assets = [],
  renderBindings = {},
  provenance = {};
for (const [name, file] of Object.entries(entries)) {
  const source = await fs.readFile(new URL("sources/" + file, root));
  let image = sharp(source);
  // Supplied building sprites already have alpha; retain smoke and all original pixels.
  await image
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(new URL(name + ".webp", root).pathname);
  const m = await sharp(new URL(name + ".webp", root).pathname).metadata();
  assets.push({
    id: "pyra-painted-" + name,
    version: "1.0.1",
    kind: "image",
    url: name + ".webp",
    width: m.width,
    height: m.height,
  });
  provenance[name] = {
    source: "sources/" + file,
    sha256: createHash("sha256").update(source).digest("hex"),
    processing: "WebP quality 94, alpha 100; no repaint or crop",
    author: "Owner supplied; rights not independently verified",
  };
}
for (const biome of ["grass", "mountain"])
  renderBindings[`terrain.ki-v2-pyra-${biome}-0`] = {
    asset: "pyra-painted-ground",
    tileSize: [1024, 1024],
  };
renderBindings["terrain.ki-v2-pyra-forest-0"] = {
  asset: "pyra-painted-forest",
  tileSize: [256, 256],
};
renderBindings["terrain.ki-v2-pyra-road-0"] = { asset: "pyra-painted-road", tileSize: [640, 640] };
renderBindings["terrain.ki-v2-city-pyra-plaza-0"] = {
  asset: "pyra-painted-plaza",
  tileSize: [768, 768],
};
for (const name of ["hall", "shop", "inn", "smithy", "depot", "arena"])
  renderBindings[`object.ki-v2-buildings.pyra-${name === "shop" ? "market" : name}`] = {
    asset: "pyra-painted-" + name,
    fit: "contain",
    origin: name === "shop" ? [0.53, 0.93] : name === "inn" ? [0.53, 0.93] : [0.5, 0.94],
  };
await fs.writeFile(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      schemaVersion: 1,
      id: "pyra-painted-preview",
      version: "1.0.1",
      previewOnly: true,
      assets,
      renderBindings,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(new URL("provenance.json", root), JSON.stringify(provenance, null, 2) + "\n");
