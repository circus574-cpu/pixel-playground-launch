/** Neutral diagnostic rig. No generated anime artwork or copied reference fragments. */
import sharp, { type OverlayOptions } from "sharp";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { DIRECTIONS, STATES } from "../src/game/assets/schema.ts";
const root = "public/game/assets/technical-v1";
await mkdir(root, { recursive: true });
const frames: Record<string, unknown> = {},
  clips: Record<string, unknown> = {},
  layers: OverlayOptions[] = [];
let index = 0;
for (const state of STATES) {
  const directions: Record<string, string[]> = {};
  for (const [d, direction] of DIRECTIONS.entries()) {
    directions[direction] = [];
    for (let i = 0; i < 2; i++) {
      const name = `technical/${state}/${direction}/${String(i).padStart(2, "0")}`;
      directions[direction]!.push(name);
      const x = (index % 16) * 64,
        y = Math.floor(index / 16) * 64;
      frames[name] = {
        frame: { x, y, w: 64, h: 64 },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
        sourceSize: { w: 64, h: 64 },
      };
      const gait =
        state === "walk" || state === "run" ? (i ? 1 : -1) * (state === "run" ? 10 : 6) : 0;
      const arm = state === "attack" ? (i ? -30 : 35) : state === "skill" ? -50 + i * 10 : 12;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><g opacity="${state === "respawn" ? 0.4 + i * 0.6 : 1}" transform="translate(${state === "hit" ? i * 4 : 0},${state === "idle" ? i : 0}) rotate(${state === "death" ? 45 + i * 40 : 0} 32 60)"><g stroke="#d9f3f6" stroke-width="4" stroke-linecap="round" fill="none"><path d="M27 42 L${27 + gait} 59 M37 42 L${37 - gait} 59"/><path d="M24 25 L16 ${36 + arm / 2} M40 25 L49 ${36 + arm}"/></g><rect x="23" y="22" width="18" height="24" rx="7" fill="${state === "hit" ? "#ef8a8a" : "#47697c"}"/><circle cx="32" cy="14" r="9" fill="#d9f3f6"/><path d="M32 14 L${32 + Math.sin((d * Math.PI) / 4) * 8} ${14 + Math.cos((d * Math.PI) / 4) * 8}" stroke="#203741" stroke-width="3"/>${state === "skill" || state === "respawn" ? `<ellipse cx="32" cy="55" rx="${23 + i * 4}" ry="${5 + i * 2}" fill="none" stroke="#66f4df" stroke-width="2"/>` : ""}${state === "attack" ? `<path d="M49 ${36 + arm} l10 -12" stroke="#ffda85" stroke-width="3"/>` : ""}</g></svg>`;
      layers.push({ input: await sharp(Buffer.from(svg)).png().toBuffer(), left: x, top: y });
      index++;
    }
  }
  clips[state] = {
    asset: "technical-rig",
    fps: 8,
    loop: ["idle", "walk", "run"].includes(state),
    directions,
  };
}
await sharp({ create: { width: 1024, height: 512, channels: 4, background: "#00000000" } })
  .composite(layers)
  .webp({ lossless: true })
  .toFile(root + "/actor.webp");
await writeFile(
  root + "/actor.json",
  JSON.stringify(
    { frames, meta: { image: "actor.webp", size: { w: 1024, h: 512 }, scale: "1" } },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "art/pipeline/examples/technical-pack.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      id: "technical-rig",
      version: "1.0.0",
      technical: true,
      assets: [
        {
          id: "technical-rig",
          version: "1.0.0",
          kind: "atlas",
          url: "/game/assets/technical-v1/actor.webp",
          atlasUrl: "/game/assets/technical-v1/actor.json",
          width: 1024,
          height: 512,
        },
      ],
      actors: [
        { id: "technical-mannequin", size: [96, 96], origin: [0.5, 0.95], tintable: false, clips },
      ],
      actorBindings: {},
      renderBindings: {},
      effects: {},
    },
    null,
    2,
  ) + "\n",
);
console.log("Built 128 distinct neutral diagnostic frames; not production artwork.");

const delivery = "art/pipeline/examples/technical-delivery";
await mkdir(delivery, { recursive: true });
const portable = JSON.parse(await readFile("art/pipeline/examples/technical-pack.json", "utf8"));
portable.assets[0].url = "actor.webp";
portable.assets[0].atlasUrl = "actor.json";
await copyFile(root + "/actor.webp", delivery + "/actor.webp");
await copyFile(root + "/actor.json", delivery + "/actor.json");
await writeFile(delivery + "/manifest.json", JSON.stringify(portable, null, 2) + "\n");
