import sharp from "sharp";
import fs from "node:fs/promises";
const dir = "art/production/aether-painted-preview";
const entries = {
  grass: "005cc08210ad6a0a972fb1f5fa",
  forest: "00ef2081f4aee8691893d4a755",
  road: "00b73c820c955127be8fdb694e",
  plaza: "00749881f49f0c3c4cfd962099",
  shop: "008f44821082f1edcedf97cc1b",
  hall: "004e448210acf7b846e578c10e",
  inn: "001a108210ba366a85cedd7664",
  arena: "00bb448210a97d72c31ad48e6a",
  smithy: "00bd0082109e20e00ef8257cba",
  depot: "00d07c8211ba76a77b3ba93f46",
  props: "00b02081f4b94bfbaad53fba6c",
};
const names = await fs.readdir("Grafika");
const assets = [];
const bindings = {};
const provenance = {};
for (const [name, part] of Object.entries(entries)) {
  const file = names.find((n) => n.includes(part));
  const path = "Grafika/" + file;
  const meta = await sharp(path).metadata();
  let image = sharp(path);
  if (!meta.hasAlpha && ["shop", "hall", "inn", "smithy"].includes(name)) {
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height,
      seen = new Uint8Array(n),
      q = new Int32Array(n);
    let head = 0,
      tail = 0;
    const push = (p) => {
      if (p < 0 || p >= n || seen[p]) return;
      const j = p * 4;
      if (Math.min(data[j], data[j + 1], data[j + 2]) < 232) return;
      seen[p] = 1;
      q[tail++] = p;
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
      const p = q[head++];
      data[p * 4 + 3] = 0;
      if (p % info.width) push(p - 1);
      if (p % info.width < info.width - 1) push(p + 1);
      push(p - info.width);
      push(p + info.width);
    }
    image = sharp(data, { raw: info }).trim({ background: "#00000000", threshold: 0 });
  } else if (["arena", "depot"].includes(name))
    image = image.trim({ background: "#00000000", threshold: 0 });
  await image.webp({ quality: 94, alphaQuality: 100 }).toFile(`${dir}/${name}.webp`);
  const out = await sharp(`${dir}/${name}.webp`).metadata();
  assets.push({
    id: `aether-painted-${name}`,
    version: "1.0.0",
    kind: name === "props" ? "atlas" : "image",
    url: `${name}.webp`,
    width: out.width,
    height: out.height,
    ...(name === "props" ? { atlasUrl: "props.json" } : {}),
  });
  provenance[name] = {
    source: "Grafika/" + file,
    processing:
      "PNG conversion; exterior connected white matte removed from opaque buildings only; transparent sprites kept.",
  };
}
for (const name of ["grass", "forest"])
  bindings[`terrain.ki-v2-aether-${name}-0`] = {
    asset: `aether-painted-${name}`,
    tileSize: [768, 768],
  };
bindings["terrain.ki-v2-aether-road-0"] = { asset: "aether-painted-road", tileSize: [640, 640] };
bindings["terrain.ki-v2-city-aether-plaza-0"] = {
  asset: "aether-painted-plaza",
  tileSize: [640, 640],
};
for (const name of ["shop", "hall", "inn", "arena", "smithy", "depot"])
  bindings[`object.ki-v2-buildings.aether-${name === "shop" ? "market" : name}`] = {
    asset: `aether-painted-${name}`,
    fit: "contain",
    origin: [0.5, 0.94],
  };
const frames = {};
const rects = {
  lamp: [140, 35, 140, 290],
  gate: [780, 20, 300, 315],
  blueflowers: [0, 520, 165, 130],
  flowers: [170, 520, 170, 130],
  pinkflowers: [345, 520, 155, 130],
  daisies: [510, 520, 150, 130],
  lavender: [1110, 520, 120, 130],
  sakura: [0, 710, 275, 215],
  bonsai: [510, 710, 185, 220],
  bamboo: [855, 710, 190, 220],
  pond: [1050, 710, 245, 145],
};
for (const [name, [x, y, w, h]] of Object.entries(rects)) {
  frames[name] = {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    sourceSize: { w, h },
    spriteSourceSize: { x: 0, y: 0, w, h },
  };
  bindings[`object.aether-painted.${name}`] = {
    asset: "aether-painted-props",
    frame: name,
    fit: "contain",
  };
}
await fs.writeFile(
  `${dir}/props.json`,
  JSON.stringify({ frames, meta: { image: "props.webp", size: { w: 1536, h: 1024 }, scale: "1" } }),
);
await fs.writeFile(
  `${dir}/manifest.json`,
  JSON.stringify(
    {
      schemaVersion: 1,
      id: "aether-painted-preview",
      version: "1.0.0",
      previewOnly: true,
      assets,
      renderBindings: bindings,
    },
    null,
    2,
  ),
);
await fs.writeFile(`${dir}/provenance.json`, JSON.stringify(provenance, null, 2));
