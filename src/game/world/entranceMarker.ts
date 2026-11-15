import type Phaser from "phaser";
import { renderDepth } from "../assets/layers";

/**
 * Znacznik wejścia do budynku na ziemi: złoty krąg światła z falą rozchodzącą się od środka, dwie strzałki
 * wędrujące w górę (do budynku) i kilka iskier. Wejście ma być widać z daleka, a przy bohaterze świecić mocniej.
 * To oprawa: nie wpływa na kolizje ani na to, gdzie działa przycisk „Wejdź”.
 */
export type EntranceMarker = {
  setVisible(visible: boolean): void;
  /** `distance`: odległość bohatera od wejścia w jednostkach świata. */
  update(time: number, distance: number): void;
  destroy(): void;
};

const GLOW_KEY = "entrance-glow";
const GOLD = 0xffd877;
const PALE = 0xfff1c0;
const MOTES = 3;

function glowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW_KEY)) return;
  const tex = scene.textures.createCanvas(GLOW_KEY, 256, 128);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.translate(128, 64);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 128);
  g.addColorStop(0, "rgba(255,244,205,0.95)");
  g.addColorStop(0.35, "rgba(255,216,119,0.6)");
  g.addColorStop(0.75, "rgba(255,190,80,0.18)");
  g.addColorStop(1, "rgba(255,180,70,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 128, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

/** Strzałka „w górę” (w stronę budynku) z ciemnym obrysem, żeby była czytelna na jasnej ziemi. */
function chevron(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  for (const [width, color, alpha] of [
    [8, 0x2a1c0a, 0.85],
    [4, PALE, 1],
  ] as const) {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(-24, 8);
    g.lineTo(0, -12);
    g.lineTo(24, 8);
    g.strokePath();
  }
  return g;
}

export function createEntranceMarker(scene: Phaser.Scene, x: number, y: number): EntranceMarker {
  glowTexture(scene);
  const glow = scene.add.image(0, 0, GLOW_KEY).setDisplaySize(380, 150).setBlendMode("ADD");
  const rim = scene.add.ellipse(0, 0, 176, 62).setStrokeStyle(4, PALE, 0.95);
  const ripple = scene.add.ellipse(0, 0, 176, 62).setStrokeStyle(4, GOLD, 0.85);
  const arrows = [chevron(scene), chevron(scene)];
  const motes = Array.from({ length: MOTES }, () =>
    scene.add.circle(0, 0, 3, PALE, 1).setBlendMode("ADD"),
  );
  const body = scene.add
    .container(x, y, [glow, rim, ripple, ...arrows, ...motes])
    // Jak decal na ziemi: sortowany po Y razem z obiektami, więc bohater stoi na nim, a drzewo z przodu go zasłania,
    // ale fasada budynku (jej stopa jest nad drzwiami) go nie przykrywa.
    .setDepth(renderDepth("objects", y))
    .setScale(1.3);
  let destroyed = false;
  return {
    setVisible(visible) {
      if (!destroyed) body.setVisible(visible);
    },
    update(time, distance) {
      if (destroyed || !body.visible) return;
      // Z daleka świeci słabiej, przy bohaterze pełnym blaskiem.
      const near = Math.min(1, Math.max(0.7, 1.35 - distance / 1300));
      const pulse = 0.5 + 0.5 * Math.sin(time / 520);
      glow.setAlpha((0.6 + 0.35 * pulse) * near).setScale(1 + 0.07 * pulse);
      rim.setAlpha((0.7 + 0.25 * pulse) * near);
      const wave = (time % 1800) / 1800;
      ripple.setScale(0.45 + 1.0 * wave).setAlpha(0.85 * (1 - wave) * near);
      arrows.forEach((arrow, i) => {
        const p = ((time % 1200) / 1200 + i * 0.5) % 1;
        arrow.setPosition(0, 6 - 62 * p).setAlpha(Math.sin(p * Math.PI) * near);
      });
      motes.forEach((mote, i) => {
        const p = (time / 1700 + i / MOTES) % 1;
        mote
          .setPosition((i - 1) * 48 + Math.sin(p * 7 + i) * 6, 2 - p * 70)
          .setAlpha(Math.sin(p * Math.PI) * 0.95 * near);
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      body.destroy();
    },
  };
}
