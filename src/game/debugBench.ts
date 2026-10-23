import type Phaser from "phaser";

type Step = {
  name: string;
  hide?: (o: Phaser.GameObjects.GameObject) => boolean;
  hud?: boolean;
  half?: boolean;
};
type Tex = { texture?: { key?: string } };
const key = (o: Phaser.GameObjects.GameObject) => (o as Tex).texture?.key ?? "";
const STEPS: Step[] = [
  { name: "pełna gra" },
  { name: "bez podłoża (TileSprite)", hide: (o) => o.type === "TileSprite" },
  { name: "bez nakładki dróg", hide: (o) => key(o).startsWith("road-cache") },
  { name: "bez obiektów przyrody", hide: (o) => key(o).includes("nature-obj") },
  { name: "bez wszystkich obrazów", hide: (o) => o.type === "Image" },
  { name: "bez nazw i pasków", hide: (o) => !["TileSprite", "Image", "Sprite"].includes(o.type) },
  { name: "bez HUD (DOM)", hud: true },
  { name: "połowa rozdzielczości", half: true },
];

/** `?ki-debug=bench`: hides one layer at a time and reports FPS so slow GPUs can be diagnosed from a phone. */
export function runBench(
  game: Phaser.Game,
  parent: HTMLElement,
  report: (lines: string[]) => void,
) {
  const scene = game.scene.scenes[0];
  if (!scene) return () => undefined;
  const results: string[] = [];
  let cancelled = false;
  const fpsFor = (ms: number) =>
    new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = (now: number) => {
        frames++;
        if (cancelled || now - start >= ms) resolve((frames * 1000) / (now - start));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  void (async () => {
    const hud =
      parent.querySelector<HTMLElement>(".ki-hud") ??
      document.querySelector<HTMLElement>(".ki-hud");
    const w = game.scale.width,
      h = game.scale.height;
    for (const step of STEPS) {
      if (cancelled) return;
      // Hide right before each render: the game re-shows its own objects every update, so a timer is overwritten.
      const apply = () => {
        if (step.hide)
          for (const o of scene.children.list)
            if (step.hide(o)) (o as Phaser.GameObjects.Image).setVisible(false);
      };
      game.events.on("prerender", apply);
      if (step.hud && hud) hud.style.display = "none";
      if (step.half) game.scale.resize(Math.round(w / 2), Math.round(h / 2));
      await new Promise((r) => setTimeout(r, 1200));
      const fps = await fpsFor(3000);
      game.events.off("prerender", apply);
      if (step.hud && hud) hud.style.display = "";
      if (step.half) game.scale.resize(w, h);
      results.push(`${fps.toFixed(1).padStart(5)} fps  ${step.name}`);
      report([...results, "…"]);
      await new Promise((r) => setTimeout(r, 1500));
    }
    report(["TEST ZAKOŃCZONY", ...results]);
  })();
  return () => {
    cancelled = true;
  };
}
