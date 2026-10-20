/** Ground feet sort scenery and actors together. Art never defines collision geometry. */
export const LAYERS = {
  ground: -100000,
  paths: -99990,
  below: -10000,
  objects: 0,
  actors: 0,
  overhead: 20000,
  atmosphere: 30000,
  combat: 40000,
  labels: 50000,
  controls: 60000,
} as const;
export type RenderLayer = keyof typeof LAYERS;
export function renderDepth(layer: RenderLayer, footY = 0) {
  return LAYERS[layer] + footY;
}
