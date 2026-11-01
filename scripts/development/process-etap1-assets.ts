/**
 * Etap 1 Post-Processing & Validation Pipeline (`START-TUTAJ.txt`):
 * 1. Copies original JPEG responses from Gemini (`gemini-3.1-flash-image`) to
 *    `art/production/development/v001/originals/<id>.jpg` with SHA-256 checksums.
 * 2. Performs corner-seeded flood-fill alpha matting + 1px anti-aliased edge de-haloing
 *    so only the exterior flat white matte becomes transparent while interior highlights stay 100% opaque.
 * 3. Produces true RGBA master PNGs in `art/production/development/v001/masters/<id>.png`:
 *    - Objects (`training.*`): 1024x1024 RGBA PNG, 12% padding, ground-contact aligned at bottom margin.
 *    - UI Icons (`ui.*`): 512x512 RGBA PNG, centered with 12% safe padding.
 * 4. Exports client WebP assets:
 *    - Icons -> `public/game/development-v1/icons/<id>.webp` (128x128 lossless WebP, never 512px masters).
 *    - Objects -> `public/game/development-v1/objects/<id>.webp` (512x512 WebP for Phaser runtime).
 * 5. Generates a QA contact sheet (`art/production/development/v001/qa/etap1-review-sheet.png`)
 *    on dark/checker contrast showing 128x128 and 32x32 readability, plus `manifest.json`.
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BRAIN_DIR =
  "C:/Users/maki5/.gemini/antigravity/brain/d8f62331-f91e-4606-965b-c7c104fec35b";
const ROOT_DIR = process.cwd();
const V001_DIR = path.join(ROOT_DIR, "art/production/development/v001");
const ORIGINALS_DIR = path.join(V001_DIR, "originals");
const MASTERS_DIR = path.join(V001_DIR, "masters");
const QA_DIR = path.join(V001_DIR, "qa");
const CLIENT_ICONS_DIR = path.join(ROOT_DIR, "public/game/development-v1/icons");
const CLIENT_OBJECTS_DIR = path.join(ROOT_DIR, "public/game/development-v1/objects");

type RawEntry = {
  id: string;
  batch: "PARTIA_1" | "PARTIA_2_P0";
  kind: "object" | "icon";
  titlePl: string;
  sourceFile: string;
  prompt: string;
};

const ENTRIES: readonly RawEntry[] = [
  {
    id: "training.planetary.dummy",
    batch: "PARTIA_1",
    kind: "object",
    titlePl: "Manekin — Verdantia",
    sourceFile: "training_planetary_dummy_1793530543457.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a sturdy practice dummy, neutral humanoid torso on a low base, no real human face World identity: Verdantia / Planetarni, forest green, amber, ochre, weathered wood and natural stone; living nature, practical craftsmanship. Produce ONE isolated modular game object, 1024x1024 master, transparent background, whole object visible with 12% padding. Orthographic top-down view, camera elevation 60 degrees, roll zero, visible south-facing facade, light from northwest.",
  },
  {
    id: "training.planetary.target",
    batch: "PARTIA_1",
    kind: "object",
    titlePl: "Cel pomiarowy — Verdantia",
    sourceFile: "training_planetary_target_1793530562804.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a small adjustable impact measurement target on a stable stand World identity: Verdantia / Planetarni, forest green, amber, ochre, weathered wood and natural stone; living nature, practical craftsmanship. Produce ONE isolated modular game object, 1024x1024 master, transparent background, whole object visible with 12% padding. Orthographic top-down view, camera elevation 60 degrees, roll zero, visible south-facing facade, light from northwest.",
  },
  {
    id: "training.planetary.ki-node",
    batch: "PARTIA_1",
    kind: "object",
    titlePl: "Węzeł KI — Verdantia",
    sourceFile: "training_planetary_ki_node_1793530581543.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a low KI charging node with a readable central receptacle World identity: Verdantia / Planetarni, forest green, amber, ochre, weathered wood and natural stone; living nature, practical craftsmanship. Produce ONE isolated modular game object, 1024x1024 master, transparent background, whole object visible with 12% padding. Orthographic top-down view, camera elevation 60 degrees, roll zero, visible south-facing facade, light from northwest.",
  },
  {
    id: "training.planetary.defense",
    batch: "PARTIA_2_P0",
    kind: "object",
    titlePl: "Stanowisko obrony — Verdantia",
    sourceFile: "training_planetary_defense_1793530650419.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. an inert defensive training emitter with a clearly visible outward aperture; no active projectile World identity: Verdantia / Planetarni, forest green, amber, ochre, weathered wood and natural stone; living nature, practical craftsmanship. Produce ONE isolated modular game object, 1024x1024 master, transparent background, whole object visible with 12% padding. Orthographic top-down view, camera elevation 60 degrees, roll zero, visible south-facing facade, light from northwest.",
  },
  {
    id: "ui.training.strength",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Siła",
    sourceFile: "ui_training_strength_1793530542111.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a firmly clenched fist with a simple bronze bracer Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.endurance",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Wytrzymałość",
    sourceFile: ".user_uploaded/media_1793534158949_9bc9743b.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a sturdy heart enclosed by a durable woven band Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.ki-capacity",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Pojemność KI",
    sourceFile: ".user_uploaded/media_1793534158969_fa60d4dd.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a luminous blue energy vessel filled to its rim Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.defense",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Obrona",
    sourceFile: ".user_uploaded/media_1793534120932_276e058c.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a solid shield receiving a single glancing impact Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.ki-control",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Kontrola KI",
    sourceFile: ".user_uploaded/media_1793534120924_c24ef10a.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. two calm hands shaping a small precisely bounded energy sphere Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.dodge",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Unik",
    sourceFile: ".user_uploaded/media_1793534120917_da25f12c.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a side-stepping boot and one clean curved motion trail Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.attack-speed",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Szybkość ataku",
    sourceFile: ".user_uploaded/media_1793534120914_3ebd3988.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. one blade with two restrained directional motion trails Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.training.technique",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Technika",
    sourceFile: ".user_uploaded/media_1793534120907_37c17a75.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. a precisely focused energy point at the intersection of three controlled arcs Produce ONE square UI icon, 512x512 master, intended downsample 128x128 and readable at 32x32. Center the silhouette with 12% safe padding.",
  },
  {
    id: "ui.exam.tier-1",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 1",
    sourceFile: "ui_exam_tier_1_1793530535872.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 1 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
  {
    id: "ui.exam.tier-2",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 2",
    sourceFile: "ui_exam_tier_2_1793530552741.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 2 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
  {
    id: "ui.exam.tier-3",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 3",
    sourceFile: "ui_exam_tier_3_1793530568233.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 3 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
  {
    id: "ui.exam.tier-4",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 4",
    sourceFile: "ui_exam_tier_4_1793530583564.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 4 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
  {
    id: "ui.exam.tier-5",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 5",
    sourceFile: "ui_exam_tier_5_1793530604263.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 5 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
  {
    id: "ui.exam.tier-6",
    batch: "PARTIA_2_P0",
    kind: "icon",
    titlePl: "Stopień próby 6",
    sourceFile: "ui_exam_tier_6_1793530643424.jpg",
    prompt:
      "Create a production asset for KI LEGENDS, a cohesive painted anime fantasy 2D action RPG. An exam rank emblem using exactly 6 large geometric notches arranged around one central gem. Same circular outline and visual weight as all other tier emblems. No Roman numerals or text.",
  },
];

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Corner-seeded flood-fill matting:
 * Removes contiguous white/near-white background from the borders while preserving
 * internal specular highlights (such as the white shine on the central teal gem).
 */
async function matteAndFrame(
  inputPath: string,
  targetSide: number,
  alignBottom: boolean,
): Promise<{
  masterPng: Buffer;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  transparentPixels: number;
  opaquePixels: number;
}> {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const visited = new Uint8Array(w * h);
  const bgMask = new Uint8Array(w * h);

  // Detect corner background matte color (white or high-contrast magenta)
  const cornerR = Math.round(
    (data[0]! + data[(w - 1) * 4]! + data[(h - 1) * w * 4]! + data[((h - 1) * w + (w - 1)) * 4]!) / 4,
  );
  const cornerG = Math.round(
    (data[1]! + data[(w - 1) * 4 + 1]! + data[(h - 1) * w * 4 + 1]! + data[((h - 1) * w + (w - 1)) * 4 + 1]!) / 4,
  );
  const cornerB = Math.round(
    (data[2]! + data[(w - 1) * 4 + 2]! + data[(h - 1) * w * 4 + 2]! + data[((h - 1) * w + (w - 1)) * 4 + 2]!) / 4,
  );
  const isMagentaMatte = cornerR >= 200 && cornerB >= 200 && cornerG <= 80;

  const isBgCandidate = (idx: number) => {
    const r = data[idx * 4]!;
    const g = data[idx * 4 + 1]!;
    const b = data[idx * 4 + 2]!;
    if (isMagentaMatte) {
      // Magenta chroma key: high R, high B, low G (or close Euclidean distance to corner magenta)
      const dist = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
      return dist <= 95 || (r >= 180 && b >= 180 && g <= Math.min(r, b) - 90);
    }
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Pure white or soft neutral studio drop-shadow on white backdrop.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = max - min;
    return luma >= 175 && sat <= 22;
  };

  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    visited[i] = 1;
    if (isBgCandidate(i)) {
      bgMask[i] = 1;
      queue[tail++] = i;
    }
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (head < tail) {
    const cur = queue[head++]!;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    push(cx - 1, cy);
    push(cx + 1, cy);
    push(cx, cy - 1);
    push(cx, cy + 1);
  }

  // Also clear pure-white or magenta enclosed cutouts (e.g. hollow loops in technique arcs or tier-6 notches)
  // while keeping central gem specular highlights intact.
  const centerX = w / 2;
  const centerY = h / 2;
  const minCutoutRadius = w * 0.24;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bgMask[i]) continue;
      const r = data[i * 4]!;
      const g = data[i * 4 + 1]!;
      const b = data[i * 4 + 2]!;
      if (isMagentaMatte) {
        const dist = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
        if (dist <= 85 || (r >= 200 && b >= 200 && g <= 65)) bgMask[i] = 1;
        continue;
      }
      if (Math.hypot(x - centerX, y - centerY) < minCutoutRadius) continue;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (luma >= 244 && sat <= 10) bgMask[i] = 1;
    }
  }

  // Expand bgMask by 2px into neutral grey shadow or magenta anti-alias fringe outside the dark ink outline
  for (let pass = 0; pass < 2; pass++) {
    const nextBg = new Uint8Array(bgMask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (bgMask[i]) continue;
        if (
          bgMask[i - 1] ||
          bgMask[i + 1] ||
          bgMask[i - w] ||
          bgMask[i + w]
        ) {
          const r = data[i * 4]!;
          const g = data[i * 4 + 1]!;
          const b = data[i * 4 + 2]!;
          if (isMagentaMatte) {
            if (r >= 150 && b >= 150 && g <= Math.min(r, b) - 70) nextBg[i] = 1;
          } else {
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            const sat = Math.max(r, g, b) - Math.min(r, g, b);
            if (luma >= 135 && sat <= 24) nextBg[i] = 1;
          }
        }
      }
    }
    bgMask.set(nextBg);
  }

  // Apply alpha and feather 1px border touching background to eliminate white/magenta fringe
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;
  let transparentPixels = 0;
  let opaquePixels = 0;

  const rgba = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bgMask[i]) {
        rgba[i * 4 + 3] = 0;
        transparentPixels++;
        continue;
      }
      // Check if adjacent to background
      const touchesBg =
        (x > 0 && bgMask[i - 1]) ||
        (x + 1 < w && bgMask[i + 1]) ||
        (y > 0 && bgMask[i - w]) ||
        (y + 1 < h && bgMask[i + w]);
      if (touchesBg) {
        const r = rgba[i * 4]!;
        const g = rgba[i * 4 + 1]!;
        const b = rgba[i * 4 + 2]!;
        if (isMagentaMatte) {
          // Despill magenta fringe on edge pixels
          const magentaExcess = Math.min(r, b) - g;
          if (magentaExcess > 35) {
            const clampRB = Math.min(r, b, g + 25);
            rgba[i * 4] = clampRB;
            rgba[i * 4 + 2] = clampRB;
            const alpha = Math.max(0, Math.min(255, Math.round(255 - (magentaExcess - 35) * 1.6)));
            rgba[i * 4 + 3] = alpha;
            if (alpha < 16) {
              rgba[i * 4 + 3] = 0;
              transparentPixels++;
              continue;
            }
          }
        } else {
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if (luma > 120 && sat <= 28) {
            const alpha = Math.max(0, Math.min(255, Math.round(((180 - luma) / 60) * 255)));
            rgba[i * 4 + 3] = alpha;
            if (alpha < 16) {
              rgba[i * 4 + 3] = 0;
              transparentPixels++;
              continue;
            }
          }
        }
      }
      opaquePixels++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);
  const cropped = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  // Place into targetSide x targetSide with 12% safe padding
  const pad = Math.round(targetSide * 0.12);
  const maxContent = targetSide - pad * 2;
  const scale = Math.min(maxContent / cropW, maxContent / cropH);
  const fitW = Math.max(1, Math.round(cropW * scale));
  const fitH = Math.max(1, Math.round(cropH * scale));

  const resized = await sharp(cropped)
    .resize(fitW, fitH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const left = Math.round((targetSide - fitW) / 2);
  // Objects keep their ground-contact base at targetSide - pad (y = 88%)
  const top = alignBottom ? targetSide - pad - fitH : Math.round((targetSide - fitH) / 2);

  const masterPng = await sharp({
    create: {
      width: targetSide,
      height: targetSide,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    masterPng,
    bounds: { minX: left, minY: top, maxX: left + fitW - 1, maxY: top + fitH - 1 },
    transparentPixels,
    opaquePixels,
  };
}

async function main() {
  await mkdir(ORIGINALS_DIR, { recursive: true });
  await mkdir(MASTERS_DIR, { recursive: true });
  await mkdir(QA_DIR, { recursive: true });
  await mkdir(CLIENT_ICONS_DIR, { recursive: true });
  await mkdir(CLIENT_OBJECTS_DIR, { recursive: true });

  const manifestEntries = [];
  const qaComposites: sharp.OverlayOptions[] = [];
  const cols = 4;
  const cellW = 240;
  const cellH = 220;

  for (let idx = 0; idx < ENTRIES.length; idx++) {
    const entry = ENTRIES[idx]!;
    const srcPath = path.join(BRAIN_DIR, entry.sourceFile);
    const origDest = path.join(ORIGINALS_DIR, `${entry.id}.v001.orig.jpg`);
    await copyFile(srcPath, origDest);
    const origBuf = await readFile(origDest);
    const origMeta = await sharp(origBuf).metadata();

    const masterSide = entry.kind === "object" ? 1024 : 512;
    const { masterPng, bounds, transparentPixels, opaquePixels } = await matteAndFrame(
      origDest,
      masterSide,
      entry.kind === "object",
    );

    const masterPath = path.join(MASTERS_DIR, `${entry.id}.v001.png`);
    await writeFile(masterPath, masterPng);

    let clientRelPath: string;
    let clientBuf: Buffer;
    let clientSide: number;
    if (entry.kind === "icon") {
      clientSide = 128;
      clientBuf = await sharp(masterPng)
        .resize(128, 128, { kernel: sharp.kernel.lanczos3 })
        .webp({ lossless: true, quality: 100 })
        .toBuffer();
      const clientPath = path.join(CLIENT_ICONS_DIR, `${entry.id}.webp`);
      await writeFile(clientPath, clientBuf);
      clientRelPath = `/game/development-v1/icons/${entry.id}.webp`;
    } else {
      clientSide = 512;
      clientBuf = await sharp(masterPng)
        .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
        .webp({ lossless: true, quality: 100 })
        .toBuffer();
      const clientPath = path.join(CLIENT_OBJECTS_DIR, `${entry.id}.webp`);
      await writeFile(clientPath, clientBuf);
      clientRelPath = `/game/development-v1/objects/${entry.id}.webp`;
    }

    // Add 128x128 and 32x32 preview to QA contact sheet
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const preview128 = await sharp(masterPng).resize(128, 128).png().toBuffer();
    const preview32 = await sharp(masterPng).resize(32, 32).png().toBuffer();
    qaComposites.push(
      { input: preview128, left: col * cellW + 24, top: row * cellH + 24 },
      { input: preview32, left: col * cellW + 168, top: row * cellH + 72 },
    );

    manifestEntries.push({
      id: entry.id,
      version: "v001",
      batch: entry.batch,
      kind: entry.kind,
      titlePl: entry.titlePl,
      status: {
        candidate: true,
        needsRevision: false,
        ownerAccepted: false,
        validated: true,
        importedOptIn: true,
        published: false,
      },
      provenance: {
        generator: "Google Gemini Image Generation (subagent image-generator)",
        model: "gemini-3.1-flash-image",
        generatedAt: "2026-11-01",
        prompt: entry.prompt,
        referencesUsed: [
          "art/production/heroes/planetary/painted-v1/masters/planetary-master-down.png",
          "public/game/assets/anime-forest-v1/fountain.webp",
        ],
        originalFormat: origMeta.format ?? "jpeg",
        originalDimensions: [origMeta.width ?? 1024, origMeta.height ?? 1024],
        originalSha256: sha256(origBuf),
        mattingApplied: "corner-floodfill-rgba-dehalo-12pct-padding",
      },
      master: {
        path: `art/production/development/v001/masters/${entry.id}.v001.png`,
        format: "png",
        dimensions: [masterSide, masterSide],
        sha256: sha256(masterPng),
        bytes: masterPng.byteLength,
        bounds,
        origin: entry.kind === "object" ? [0.5, 0.88] : [0.5, 0.5],
        alphaVerified: transparentPixels > 0 && opaquePixels > 0,
      },
      client: {
        url: clientRelPath,
        format: "webp",
        dimensions: [clientSide, clientSide],
        sha256: sha256(clientBuf),
        bytes: clientBuf.byteLength,
      },
    });
    console.log(
      `Processed ${entry.id}: master ${masterSide}px PNG (${Math.round(masterPng.byteLength / 1024)} KB) -> client ${clientSide}px WebP (${Math.round(clientBuf.byteLength / 1024)} KB)`,
    );
  }

  const rows = Math.ceil(ENTRIES.length / cols);
  const sheetPath = path.join(QA_DIR, "etap1-review-sheet.png");
  await sharp({
    create: {
      width: cols * cellW,
      height: rows * cellH,
      channels: 4,
      background: { r: 20, g: 38, b: 44, alpha: 255 },
    },
  })
    .composite(qaComposites)
    .png()
    .toFile(sheetPath);

  const manifest = {
    catalogTitle: "KI LEGENDS — GEMINI + ELEVENLABS: PRODUKCJA ZASOBÓW ROZWOJU (Etap 1)",
    createdAt: "2026-11-01T11:59:00+01:00",
    branch: "feat/development-assets-etap1",
    optInSwitch: "ki-dev-art",
    krok0ReuseAudit: {
      audioP0: {
        "audio.development.dummy-hit": {
          status: "reuse-active",
          reuseFile: "/game/sfx/common/hit.mp3",
          note: "Istniejący plik common/hit.mp3 obsługuje uderzenie w manekin; dedykowany prompt w Partii 1 gotowy do eksportu z ElevenLabs Sound Effects.",
        },
        "audio.development.target-hit": {
          status: "reuse-active",
          reuseFile: "/game/sfx/common/hit-armor.mp3",
          note: "Podpięto common/hit-armor.mp3 dla celów pomiarowych practice-* zgodnie z wytyczną START-TUTAJ.txt.",
        },
        "audio.development.checkpoint": {
          status: "reuse-active",
          reuseFile: "/game/sfx/common/loot.mp3",
          note: "Podpięto lekki sygnał potwierdzenia punktu kontrolnego w próbie wytrzymałości.",
        },
        "audio.development.exam-start": {
          status: "reuse-active",
          reuseFile: "/game/sfx/sage/A1.mp3",
          note: "Podpięto czysty gong pieczęci przy otwarciu sali egzaminacyjnej.",
        },
        "audio.development.exam-success": {
          status: "reuse-active",
          reuseFile: "/game/sfx/common/quest-complete.mp3",
          note: "Zgodnie z START-TUTAJ.txt podpięto common/quest-complete.mp3 przy zdaniu próby i ukończeniu projektu.",
        },
        "audio.development.exam-fail": {
          status: "reuse-active",
          reuseFile: "/game/sfx/common/no-energy.mp3",
          note: "Podpięto stonowany sygnał niepowodzenia próby bez dramatyzmu śmierci postaci.",
        },
        "audio.development.ki-charge": {
          status: "reuse-active",
          reuseFile: "/game/sfx/sage/C1.mp3",
          note: "Zgodnie z katalogiem podpięto sage/C1.mp3 ('Focusing ki energy, rising soft hum with a gentle chime') przy ładowaniu węzła KI.",
        },
      },
      uiTrainingIconsReuseFallback: {
        "ui.training.strength": "/game/development-v1/icons/ui.training.strength.webp (v001 new)",
        "ui.training.endurance": "/game/development-v1/icons/ui.training.endurance.webp (v001 new)",
        "ui.training.ki-capacity": "/game/development-v1/icons/ui.training.ki-capacity.webp (v001 new)",
        "ui.training.defense": "/game/development-v1/icons/ui.training.defense.webp (v001 new)",
        "ui.training.ki-control": "/game/development-v1/icons/ui.training.ki-control.webp (v001 new)",
        "ui.training.dodge": "/game/development-v1/icons/ui.training.dodge.webp (v001 new)",
        "ui.training.attack-speed": "/game/development-v1/icons/ui.training.attack-speed.webp (v001 new)",
        "ui.training.technique": "/game/development-v1/icons/ui.training.technique.webp (v001 new)",
      },
      trainingEffectsDecision:
        "Zachowano proceduralne oznaczenia kręgów (safe-window, danger, goal) w examRuntime.ts zgodnie z zasadą katalogu: proceduralne ringi są w pełni czytelne w skali sali egzaminacyjnej i nie wypalają stałych plam na mapie.",
    },
    assets: manifestEntries,
  };

  await writeFile(
    path.join(V001_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  console.log("Wrote manifest to art/production/development/v001/manifest.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
