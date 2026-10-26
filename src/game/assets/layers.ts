/** Ground feet sort scenery and actors together. Art never defines collision geometry. */
// Feet in world v2 reach y ≈ 60,000, so each layer is a million apart: nothing y-sorted can climb
// over an overhead layer (combat effects, labels) or sink under the ground.
export const LAYERS = {
  ground: -2_000_000,
  paths: -1_999_990,
  below: -1_000_000,
  objects: 0,
  actors: 0,
  overhead: 1_000_000,
  atmosphere: 2_000_000,
  combat: 3_000_000,
  labels: 4_000_000,
  controls: 5_000_000,
} as const;
export type RenderLayer = keyof typeof LAYERS;
export function renderDepth(layer: RenderLayer, footY = 0) {
  return LAYERS[layer] + footY;
}
