import sharp from "sharp";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("./", import.meta.url),
  rows = JSON.parse(await fs.readFile(new URL("drive-sources.json", root), "utf8"));
const entries = {
  props: 0,
  arena: 1,
  depot: 2,
  forest: 3,
  road: 4,
  plaza: 5,
  grass: 6,
  stone: 7,
  hall: 8,
  shop: 9,
};
const assets = [],
  renderBindings = {},
  provenance = {};
for (const [name, i] of Object.entries(entries)) {
  const row = rows[i],
    source = await fs.readFile(new URL("sources/" + row.name, root));
  let image = sharp(source);
  if (["hall", "shop", "depot", "arena"].includes(name)) {
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
    image = sharp(data, { raw: info }).trim({ background: "#00000000", threshold: 0 });
  }
  await image
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(new URL(name + ".webp", root).pathname);
  const m = await sharp(new URL(name + ".webp", root).pathname).metadata();
  assets.push({
    id: "nexus-painted-" + name,
    version: "1.1.0",
    kind: name === "props" ? "atlas" : "image",
    url: name + ".webp",
    width: m.width,
    height: m.height,
    ...(name === "props" ? { atlasUrl: "props.json" } : {}),
  });
  provenance[name] = {
    source: "sources/" + row.name,
    driveId: row.driveId,
    sha256: createHash("sha256").update(source).digest("hex"),
    processing:
      "WebP 94/alpha 100; buildings: connected exterior white removal and transparent trim; atlas alpha preserved",
    author: "Owner supplied via Google Drive; rights not independently verified",
  };
}
// Additional flat pavement requested after the first in-game review; owner PNGs remain intact.
const courtyardSource = await fs.readFile(new URL("sources/courtyard-generated.png", root));
await sharp(courtyardSource).webp({ quality: 94 }).toFile(new URL("courtyard.webp", root).pathname);
const courtyardMeta = await sharp(courtyardSource).metadata();
assets.push({
  id: "nexus-painted-courtyard",
  version: "1.1.0",
  kind: "image",
  url: "courtyard.webp",
  width: courtyardMeta.width,
  height: courtyardMeta.height,
});
renderBindings["terrain.nexus-painted-courtyard"] = {
  asset: "nexus-painted-courtyard",
  tileSize: [640, 640],
};
provenance.courtyard = {
  source: "sources/courtyard-generated.png",
  sha256: createHash("sha256").update(courtyardSource).digest("hex"),
  generator: "OpenAI image_gen; local generation on 2026-11-03",
  purpose:
    "Flat light grey irregular flagstone courtyard matching owner scene reference; separate tile, never a scene backdrop",
  references: ["sources/reference.jpg", "sources/file_00000000f01481f4a866bf992e774bc4.png"],
  processing: "WebP quality 94",
};
for (const [biome, name] of [
  ["grass", "grass"],
  ["forest", "forest"],
  ["mountain", "stone"],
  ["wetland", "grass"],
])
  renderBindings[`terrain.ki-v2-nexus-${biome}-0`] = {
    asset: "nexus-painted-" + name,
    tileSize: [768, 768],
  };
renderBindings["terrain.ki-v2-nexus-road-0"] = {
  asset: "nexus-painted-road",
  tileSize: [512, 512],
};
renderBindings["terrain.ki-v2-city-nexus-plaza-0"] = {
  asset: "nexus-painted-plaza",
  tileSize: [640, 640],
};
for (const name of ["hall", "shop", "depot", "arena"])
  renderBindings[`object.ki-v2-buildings.nexus-${name === "shop" ? "market" : name}`] = {
    asset: "nexus-painted-" + name,
    fit: "contain",
    origin: name === "shop" ? [0.5, 0.91] : [0.5, 0.94],
  };
const rects = {
  pinktree: [0, 330, 205, 165],
  bluetree: [780, 330, 160, 165],
  cyanplant: [1082, 345, 116, 145],
  mushrooms: [1315, 355, 115, 135],
  cyanflowers: [1440, 355, 96, 135],
  flowers: [0, 500, 120, 88],
  pylon: [187, 715, 78, 174],
  terminal: [1385, 710, 150, 140],
  reactor: [1338, 866, 198, 158],
  garden: [1070, 735, 190, 110],
  pond: [955, 590, 180, 115],
  waterfall: [290, 589, 193, 120],
  gate: [1134, 858, 197, 166],
  runestone: [884, 200, 126, 130],
  crystal: [520, 200, 130, 130],
};
const frames = {};
for (const [name, [x, y, w, h]] of Object.entries(rects)) {
  frames[name] = {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    sourceSize: { w, h },
    spriteSourceSize: { x: 0, y: 0, w, h },
  };
  renderBindings["object.nexus-painted." + name] = {
    asset: "nexus-painted-props",
    frame: name,
    fit: "contain",
  };
}
await fs.writeFile(
  new URL("props.json", root),
  JSON.stringify(
    { frames, meta: { image: "props.webp", size: { w: 1536, h: 1024 }, scale: "1" } },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  new URL("manifest.json", root),
  JSON.stringify(
    {
      schemaVersion: 1,
      id: "nexus-painted-preview",
      version: "1.1.0",
      previewOnly: true,
      assets,
      renderBindings,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(new URL("provenance.json", root), JSON.stringify(provenance, null, 2) + "\n");
