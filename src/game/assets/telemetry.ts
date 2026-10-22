import type Phaser from "phaser";
/** Read-only diagnostics, updated once/second. No frame-sized allocations or HUD overlay. */
export function installRenderTelemetry(scene: Phaser.Scene, parent: HTMLElement) {
  const samples = new Float64Array(240);
  let count = 0,
    cursor = 0,
    start = performance.now(),
    previous = start,
    stopped = false;
  const events = scene.game.events;
  const sample = () => {
    const now = performance.now();
    if (document.hidden || parent.dataset["focused"] === "false") {
      start = previous = now;
      count = cursor = 0;
      return;
    }
    samples[cursor++ % samples.length] = now - previous;
    previous = now;
    count++;
    if (now - start < 1000) return;
    const times = Array.from(samples.slice(0, Math.min(cursor, samples.length))).sort(
      (a, b) => a - b,
    );
    let total = 0,
      active = 0,
      visible = 0;
    const visit = (objects: readonly Phaser.GameObjects.GameObject[]) => {
      for (const object of objects) {
        total++;
        if (object.active) active++;
        if ((object as Phaser.GameObjects.Image).visible) visible++;
        if (object.type === "Container") visit((object as Phaser.GameObjects.Container).list);
      }
    };
    visit(scene.children.list);
    let textureBytes = 0,
      bakedBytes = 0;
    const keys = scene.textures.getTextureKeys();
    for (const key of keys)
      for (const source of scene.textures.get(key).source) {
        textureBytes += source.width * source.height * 4;
        if (key.startsWith("road-cache:")) bakedBytes += source.width * source.height * 4;
      }
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    parent.dataset["metrics"] = JSON.stringify({
      sampleAtMs: Math.round(now),
      fps: Number(((count * 1000) / (now - start)).toFixed(2)),
      frameP50Ms: times[Math.floor(times.length * 0.5)] ?? null,
      frameP95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] ?? null,
      objects: total,
      activeObjects: active,
      visibleObjects: visible,
      textures: keys.length,
      estimatedTextureBytes: textureBytes,
      bakedTextureBytes: bakedBytes,
      jsHeapBytes: memory?.usedJSHeapSize ?? null,
      renderer: scene.game.renderer.type === 2 ? "WebGL" : "Canvas",
      drawCalls: null,
    });
    start = now;
    count = cursor = 0;
  };
  events.on("postrender", sample);
  const release = () => {
    if (stopped) return;
    stopped = true;
    events.off("postrender", sample);
  };
  scene.events.once("shutdown", release);
  scene.events.once("destroy", release);
  return release;
}
