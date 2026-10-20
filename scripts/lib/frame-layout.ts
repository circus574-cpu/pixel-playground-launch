import { DIRECTIONS, PackSchema, type ActorVisual } from "../../src/game/assets/schema.ts";
import { GPU_CONTRACT } from "../../src/game/assets/contract.ts";
export function frameLayout(
  id: string,
  world: string,
  profile: ActorVisual["profile"] = "hero",
  version = "1.0.0",
) {
  if (!["verdant", "aether", "nexus", "pyra"].includes(world)) throw Error("Unknown target world");
  const side = GPU_CONTRACT.deliveryFrame,
    columns = GPU_CONTRACT.maxAtlasSide / side,
    capacity = columns * columns;
  type Frame = {
    frame: { x: number; y: number; w: number; h: number };
    rotated: false;
    trimmed: false;
    sourceSize: { w: number; h: number };
    spriteSourceSize: { x: number; y: number; w: number; h: number };
  };
  const pages: {
    asset: string;
    frames: Record<string, Frame>;
    width: number;
    height: number;
    count: number;
  }[] = [];
  const sources: { path: string; name: string; page: number; x: number; y: number }[] = [],
    clips: ActorVisual["clips"] = {};
  const states =
    profile === "npc"
      ? (["idle", "walk"] as const)
      : (Object.keys(GPU_CONTRACT.animations) as (keyof typeof GPU_CONTRACT.animations)[]);
  for (const state of states) {
    const spec = GPU_CONTRACT.animations[state],
      count = spec.frames * DIRECTIONS.length;
    let page = pages.at(-1);
    if (!page || page.count + count > capacity) {
      page = {
        asset: `${id}-page-${pages.length}`,
        frames: {},
        width: GPU_CONTRACT.maxAtlasSide,
        height: 0,
        count: 0,
      };
      pages.push(page);
    }
    const directions: Record<string, string[]> = {};
    for (const direction of DIRECTIONS) {
      directions[direction] = [];
      for (let i = 0; i < spec.frames; i++) {
        const name = `${id}/${state}/${direction}/${String(i).padStart(2, "0")}`,
          x = (page.count % columns) * side,
          y = Math.floor(page.count / columns) * side;
        directions[direction]!.push(name);
        page.frames[name] = {
          frame: { x, y, w: side, h: side },
          rotated: false,
          trimmed: false,
          sourceSize: { w: side, h: side },
          spriteSourceSize: { x: 0, y: 0, w: side, h: side },
        };
        sources.push({
          path: `${state}/${direction}/${String(i).padStart(2, "0")}.png`,
          name,
          page: pages.length - 1,
          x,
          y,
        });
        page.count++;
        page.height = Math.ceil(page.count / columns) * side;
      }
    }
    clips[state] = { asset: page.asset, fps: spec.fps, loop: spec.loop, directions };
  }
  const scale = profile === "enemy" ? GPU_CONTRACT.enemy : GPU_CONTRACT.hero;
  const pack = PackSchema.parse({
    schemaVersion: 1,
    id,
    version,
    technical: false,
    assets: pages.map((p) => ({
      id: p.asset,
      version,
      kind: "atlas",
      url: p.asset + ".webp",
      atlasUrl: p.asset + ".json",
      width: p.width,
      height: p.height,
    })),
    actors: [{ id, profile, size: scale.size, origin: scale.origin, tintable: false, clips }],
    actorBindings: { [world + "." + profile]: id },
    renderBindings: {},
    effects: {},
  });
  // NPC bindings specify a role when installing; the template intentionally does not replace all residents.
  if (profile === "npc") pack.actorBindings = {};
  return { pack, pages, sources };
}
