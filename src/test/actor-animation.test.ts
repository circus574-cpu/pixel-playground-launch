import { describe, expect, it, vi } from "vitest";
import { ActorAnimation } from "../game/assets/actorAnimation";
import { technicalPack, actorVisual, worldAssets, catalog } from "../game/assets/catalog";
import { renderDepth } from "../game/assets/layers";
import { DIRECTIONS } from "../game/assets/schema";
import type Phaser from "phaser";
function rig() {
  const sprite = {
    anims: { pause: vi.fn(), resume: vi.fn() },
    play: vi.fn(),
    stop: vi.fn(),
    setTexture: vi.fn(),
  };
  return {
    sprite,
    animation: new ActorAnimation(
      sprite as unknown as Phaser.GameObjects.Sprite,
      technicalPack.actors[0]!,
    ),
  };
}
describe("animation presentation remains separate from mechanical actions", () => {
  it("maps all eight real movement vectors and does not restart an unchanged clip", () => {
    const { sprite, animation } = rig();
    for (const [i, dir] of DIRECTIONS.entries()) {
      const angle = Math.PI / 2 + (i * Math.PI) / 4;
      animation.update(i * 100, true, false, { x: Math.cos(angle), y: Math.sin(angle) });
      expect(sprite.play).toHaveBeenLastCalledWith(`technical-mannequin/walk/${dir}`);
    }
    const count = sprite.play.mock.calls.length;
    animation.update(1000, true, false, { x: 1, y: 1 });
    animation.update(1100, true, false, { x: 1, y: 1 });
    expect(sprite.play.mock.calls.length).toBeLessThanOrEqual(count + 1);
  });
  it("prioritizes death/hit over attacks and resumes walking only after event animation", () => {
    const { animation } = rig();
    animation.trigger("attack", 0);
    expect(animation.state).toBe("attack");
    animation.trigger("hit", 10);
    animation.trigger("attack", 20);
    expect(animation.state).toBe("hit");
    animation.update(300, true, false, { x: 1, y: 0 });
    expect(animation.state).toBe("walk");
    animation.trigger("death", 400);
    animation.update(5000, false, true, { x: 0, y: 1 });
    expect(animation.state).toBe("death");
    animation.trigger("attack", 5100);
    expect(animation.state).toBe("death");
    animation.update(5200, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("respawn");
    animation.update(5500, false, false, { x: 0, y: 1 });
    expect(animation.state).toBe("idle");
  });
  it("uses legacy fallback without inventing missing painted clips, freezes when paused", () => {
    const sprite = {
      anims: { pause: vi.fn(), resume: vi.fn() },
      play: vi.fn(),
      stop: vi.fn(),
      setTexture: vi.fn(),
    };
    const animation = new ActorAnimation(
      sprite as unknown as Phaser.GameObjects.Sprite,
      actorVisual("pyra", "npc"),
    );
    animation.trigger("skill", 0);
    animation.update(1, false, false, { x: 0, y: 1 });
    expect(sprite.setTexture).toHaveBeenCalledWith("hero-sheet", 0);
    animation.update(2000, false, false, { x: 0, y: 1 }, true);
    expect(sprite.anims.pause).toHaveBeenCalled();
    expect(animation.state).toBe("skill");
  });
  it("separates world layers, selects one continent and never preloads the diagnostic rig by default", () => {
    expect(renderDepth("ground")).toBeLessThan(renderDepth("below"));
    expect(renderDepth("objects", 100)).toBeLessThan(renderDepth("actors", 101));
    expect(renderDepth("overhead")).toBeGreaterThan(renderDepth("actors", 2048));
    expect(renderDepth("combat")).toBeGreaterThan(renderDepth("atmosphere"));
    expect(worldAssets("pyra").map((a) => a.id)).not.toContain("technical-rig");
    expect(worldAssets("pyra", true).map((a) => a.id)).toContain("technical-rig");
    expect(worldAssets("pyra").map((a) => a.id)).not.toContain("forest-objects");
    expect(catalog.actorBindings["hero.human-v2"]).toBe("human-v2");
  });
});
