import type Phaser from "phaser";
import { renderDepth } from "../assets/layers";

const KEY = "soft-shadow";

/** Soft dark ellipse (radial falloff), shared by every scenery object; one batched texture. */
function shadowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return KEY;
  const tex = scene.textures.createCanvas(KEY, 128, 64);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.translate(64, 32);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, "rgba(22,16,34,0.95)");
  g.addColorStop(0.6, "rgba(22,16,34,0.7)");
  g.addColorStop(1, "rgba(22,16,34,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  return KEY;
}

interface Footed {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  kind: string;
}

/** Objects that lie flat on the ground or are drawn above/below everything else get no cast shadow. */
export function castsShadow(object: Footed, layer?: string) {
  if (object.kind === "bridge" || object.height < 56) return false;
  return layer === undefined || layer === "objects";
}

/** Contact shadow under an object's foot; sits below all sorted scenery so it never covers a character. */
export function objectShadow(scene: Phaser.Scene, object: Footed) {
  const key = shadowTexture(scene);
  if (!key) return null;
  // Footprint of the base, not of the crown: roughly 70 % of the width, flattened to a ground ellipse.
  const w = Math.min(object.width * 0.72, 520);
  const h = Math.max(14, Math.min(w * 0.3, object.height * 0.28));
  return scene.add
    .image(object.x - object.width * (object.anchorX - 0.5), object.y - h * 0.15, key)
    .setDisplaySize(w, h)
    .setAlpha(0.5)
    .setDepth(renderDepth("below") + 1);
}
