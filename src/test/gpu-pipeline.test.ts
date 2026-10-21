// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, cp, readFile, writeFile, rm, readdir, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { validatePackage, importPackage } from "../../scripts/lib/gpu-import";
import { makeCatalog, worldAssets } from "../game/assets/catalog";
import { PackSchema, DIRECTIONS } from "../game/assets/schema";
import { GPU_CONTRACT } from "../game/assets/contract";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function delivery() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ki-gpu-"));
  roots.push(root);
  const source = path.join(root, "delivery");
  await cp("art/pipeline/examples/technical-delivery", source, { recursive: true });
  const manifest = path.join(source, "manifest.json"),
    pack = JSON.parse(await readFile(manifest, "utf8"));
  return { root, source, manifest, pack, save: () => writeFile(manifest, JSON.stringify(pack)) };
}
async function app(root: string) {
  const target = path.join(root, "app");
  await mkdir(path.join(target, "src/game/assets"), { recursive: true });
  await writeFile(path.join(target, "src/game/assets/imported.json"), "[]\n");
  const assets = path.join(target, "public/game/assets");
  await mkdir(assets, { recursive: true });
  for (const entry of await readdir("public/game/assets", { withFileTypes: true })) {
    if (entry.name === "gpu") continue;
    await symlink(
      path.resolve("public/game/assets", entry.name),
      path.join(assets, entry.name),
      entry.isDirectory() ? "dir" : "file",
    );
  }
  return target;
}
describe("GPU import validates actual pixels, frames and immutable publication", () => {
  it("imports losslessly, rebinds only Aetheria and leaves character saves/other worlds alone", async () => {
    const f = await delivery(),
      root = await app(f.root);
    f.pack.actorBindings = { "aether.hero": "technical-mannequin" };
    await f.save();
    const before = await readFile(path.join(root, "src/game/assets/imported.json"), "utf8");
    const plan = await importPackage(f.manifest, { root });
    expect(plan.installed).toBe(false);
    expect(await readFile(path.join(root, "src/game/assets/imported.json"), "utf8")).toBe(before);
    const result = await importPackage(f.manifest, { root, install: true });
    const installed = PackSchema.parse(
      JSON.parse(await readFile(path.join(root, "src/game/assets/imported.json"), "utf8"))[0],
    );
    expect(result.directory).toContain(result.digest.slice(0, 12));
    const afterImage = path.join(root, "public", installed.assets[0]!.url);
    expect(await sharp(afterImage).raw().toBuffer()).toEqual(
      await sharp(path.join(f.source, "actor.webp")).raw().toBuffer(),
    );
    const catalog = makeCatalog([installed]);
    expect(worldAssets("aether", false, catalog).map((a) => a.id)).toContain("technical-rig");
    expect(worldAssets("verdant", false, catalog).map((a) => a.id)).not.toContain("technical-rig");
    expect(result.worlds["aether"]).toBeLessThan(GPU_CONTRACT.maxWorldTextureBytes);
    expect(await importPackage(f.manifest, { root, install: true })).toEqual(result);
  }, 20000);
  it("requires a version bump for changed content and keeps the installed registry on failure", async () => {
    const f = await delivery(),
      root = await app(f.root);
    await importPackage(f.manifest, { root, install: true });
    const registry = path.join(root, "src/game/assets/imported.json"),
      before = await readFile(registry, "utf8");
    f.pack.actors[0].id = "changed-rig";
    await f.save();
    await expect(importPackage(f.manifest, { root, install: true })).rejects.toThrow("--replace");
    await expect(importPackage(f.manifest, { root, install: true, replace: true })).rejects.toThrow(
      "version bump",
    );
    expect(await readFile(registry, "utf8")).toBe(before);
  });
  it("rejects missing, corrupt, mismatched and out-of-atlas images", async () => {
    const f = await delivery();
    f.pack.assets[0].width = 900;
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("resolution mismatch");
    f.pack.assets[0].width = 1024;
    await f.save();
    const jsonPath = path.join(f.source, "actor.json"),
      atlas = JSON.parse(await readFile(jsonPath, "utf8"));
    Object.values(atlas.frames as Record<string, { frame: { x: number } }>)[0]!.frame.x = 1024;
    await writeFile(jsonPath, JSON.stringify(atlas));
    await expect(validatePackage(f.manifest)).rejects.toThrow("Invalid atlas frame");
    await writeFile(path.join(f.source, "actor.webp"), "not an image");
    await expect(validatePackage(f.manifest)).rejects.toThrow();
  });
  it("rejects path traversal and symlinks leaving the delivery", async () => {
    const f = await delivery();
    f.pack.assets[0].url = "../outside.webp";
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("relative local path");
    await symlink(
      path.resolve("public/game/assets/technical-v1/actor.webp"),
      path.join(f.source, "outside.webp"),
    );
    f.pack.assets[0].url = "outside.webp";
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("escapes package");
  });
  it("rejects absent or duplicated frames, invalid trim and absent production states", async () => {
    const f = await delivery();
    f.pack.actors[0].clips.walk.directions.down[1] = "missing-frame";
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("Missing texture/frame");
    f.pack.actors[0].clips.walk.directions.down[1] = f.pack.actors[0].clips.walk.directions.down[0];
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("Duplicate frames");
    f.pack.technical = false;
    await f.save();
    await expect(validatePackage(f.manifest)).rejects.toThrow("Invalid production");
  });
  it("validates the production NPC contract: all eight directions, 128px frames, real FPS and counts", async () => {
    const f = await delivery(),
      frames: Record<string, unknown> = {},
      clips: Record<string, unknown> = {};
    const raw = Buffer.alloc(2048 * 1024 * 4);
    let index = 0;
    for (const state of ["idle", "walk"] as const) {
      const directions: Record<string, string[]> = {};
      for (const dir of DIRECTIONS) {
        directions[dir] = [];
        for (let n = 0; n < 8; n++) {
          const x = (index % 16) * 128,
            y = Math.floor(index / 16) * 128,
            name = `npc/${state}/${dir}/${String(n).padStart(2, "0")}`;
          directions[dir]!.push(name);
          frames[name] = {
            frame: { x, y, w: 128, h: 128 },
            rotated: false,
            trimmed: false,
            sourceSize: { w: 128, h: 128 },
            spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
          };
          const pixel = ((y + 64) * 2048 + x + 64 + n) * 4;
          raw[pixel] = index + 1;
          raw[pixel + 1] = 170;
          raw[pixel + 3] = 255;
          index++;
        }
      }
      clips[state] = {
        asset: "production-npc",
        fps: GPU_CONTRACT.animations[state].fps,
        loop: true,
        directions,
      };
    }
    await sharp(raw, { raw: { width: 2048, height: 1024, channels: 4 } })
      .png()
      .toFile(path.join(f.source, "npc.png"));
    await writeFile(path.join(f.source, "npc.json"), JSON.stringify({ frames }));
    f.pack = {
      ...f.pack,
      technical: false,
      assets: [
        {
          id: "production-npc",
          version: "1.0.0",
          kind: "atlas",
          url: "npc.png",
          atlasUrl: "npc.json",
        },
      ],
      actors: [
        {
          id: "production-npc",
          profile: "npc",
          size: [96, 96],
          origin: [0.5, 0.95],
          tintable: false,
          clips,
        },
      ],
    };
    await writeFile(f.manifest, JSON.stringify(f.pack));
    expect((await validatePackage(f.manifest)).pack.actors[0]!.profile).toBe("npc");
    f.pack.actors[0].clips.walk.directions.down.pop();
    await writeFile(f.manifest, JSON.stringify(f.pack));
    await expect(validatePackage(f.manifest)).rejects.toThrow("Invalid frame count");
  });
});

it.each(["legacy", "grounded"] as const)(
  "packs a complete 416-frame %s render delivery and rejects overwrite",
  async (presentation) => {
    const { frameLayout } = await import("../../scripts/lib/frame-layout");
    const { packFrames } = await import("../../scripts/lib/pack-frames");
    const root = await mkdtemp(path.join(os.tmpdir(), "ki-frames-"));
    roots.push(root);
    const source = path.join(root, "renders"),
      out = path.join(root, "delivery"),
      layout = frameLayout("hero-test", "verdant", "hero", "1.0.0", presentation);
    for (const [i, frame] of layout.sources.entries()) {
      const filename = path.join(source, frame.path);
      await mkdir(path.dirname(filename), { recursive: true });
      const shape = Buffer.from(
        `<svg width="512" height="512"><rect x="${180 + (i % 20)}" y="180" width="100" height="240" rx="20" fill="rgb(${60 + (i % 150)},${50 + (Math.floor(i / 3) % 150)},130)"/></svg>`,
      );
      await sharp(shape).png().toFile(filename);
    }
    const result = await packFrames(
      source,
      out,
      "hero-test",
      "verdant",
      "hero",
      "1.0.0",
      presentation,
      presentation === "grounded" ? "lanczos2" : "lanczos3",
    );
    expect(result.frames).toBe(416);
    expect(result.pages).toBe(2);
    const expected = presentation === "grounded" ? GPU_CONTRACT.groundedHero : GPU_CONTRACT.hero;
    const validated = await validatePackage(result.manifest);
    expect(validated.pack.actors[0]!.size).toEqual(expected.size);
    expect(validated.pack.actors[0]!.origin).toEqual(expected.origin);
    const wrong = JSON.parse(await readFile(result.manifest, "utf8"));
    wrong.actors[0].origin = [0.5, 0.5];
    await writeFile(result.manifest, JSON.stringify(wrong));
    await expect(validatePackage(result.manifest)).rejects.toThrow("scale/feet anchor");
    await writeFile(result.manifest, JSON.stringify(validated.pack));
    expect(validated.pack.actors[0]!.clips.attack!.directions["down-left"]).toHaveLength(8);
    expect(validated.infos.get("hero-test-page-1")!.height).toBe(1280);
    await expect(packFrames(source, out, "hero-test", "verdant")).rejects.toThrow(
      "Output already exists",
    );
  },
  60000,
);

it("rejects atlas frame pivots that Phaser would use to override the configured feet", async () => {
  const f = await delivery(),
    atlasFile = path.join(f.source, "actor.json"),
    atlas = JSON.parse(await readFile(atlasFile, "utf8"));
  const first = Object.values(
    atlas.frames as Record<
      string,
      { pivot?: { x: number; y: number }; anchor?: { x: number; y: number } }
    >,
  )[0]!;
  first.pivot = { x: 0.5, y: 0.5 };
  await writeFile(atlasFile, JSON.stringify(atlas));
  await expect(validatePackage(f.manifest)).rejects.toThrow(
    "Keep pivots in actor/map configuration",
  );
  delete first.pivot;
  first.anchor = { x: 0.5, y: 0.95 };
  await writeFile(atlasFile, JSON.stringify(atlas));
  await expect(validatePackage(f.manifest)).rejects.toThrow(
    "Keep pivots in actor/map configuration",
  );
});

it("keeps grounded framing explicit and rejects it for enemy/NPC profiles", async () => {
  const { frameLayout } = await import("../../scripts/lib/frame-layout");
  expect(() => frameLayout("enemy", "verdant", "enemy", "1.0.0", "grounded")).toThrow(
    "heroes only",
  );
  expect(() => frameLayout("npc", "verdant", "npc", "1.0.0", "grounded")).toThrow("heroes only");
  expect(frameLayout("hero", "pyra").pack.actors[0]!.origin).toEqual([0.5, 0.95]);
});

it("keeps unapproved hero packs opt-in while validating and importing their actual files", async () => {
  const f = await delivery(),
    root = await app(f.root);
  f.pack.previewOnly = true;
  f.pack.actorBindings = { "aether.hero": "technical-mannequin" };
  await f.save();
  await importPackage(f.manifest, { root, install: true });
  const packs = JSON.parse(
    await readFile(path.join(root, "src/game/assets/imported.json"), "utf8"),
  ).map((p: unknown) => PackSchema.parse(p));
  expect(worldAssets("aether", false, makeCatalog(packs)).map((a) => a.id)).not.toContain(
    "technical-rig",
  );
  expect(worldAssets("aether", false, makeCatalog(packs, true)).map((a) => a.id)).toContain(
    "technical-rig",
  );
  expect(worldAssets("verdant", false, makeCatalog(packs, true)).map((a) => a.id)).not.toContain(
    "technical-rig",
  );
});

it("a race-specific preview opt-in cannot activate another race pack", async () => {
  const f = await delivery();
  const sage = PackSchema.parse({
    ...f.pack,
    id: "hero-sage",
    previewOnly: true,
    actorBindings: { "aether.hero": "technical-mannequin" },
  });
  const planetary = PackSchema.parse({
    ...f.pack,
    id: "hero-planetary",
    previewOnly: true,
    actorBindings: { "verdant.hero": "technical-mannequin" },
  });
  const source = makeCatalog([sage, planetary], ["hero-sage"]);
  expect(source.actorBindings["aether.hero"]).toBe("technical-mannequin");
  expect(source.actorBindings["verdant.hero"]).toBeUndefined();
});
