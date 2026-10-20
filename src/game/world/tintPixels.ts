/** Shader-compatible multiply: keep straight alpha intact when baking static WebGL shadows. */
export function tintPixels(pixels: Uint8ClampedArray, tint: number) {
  const r = ((tint >> 16) & 255) / 255,
    g = ((tint >> 8) & 255) / 255,
    b = (tint & 255) / 255;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i]! * r;
    pixels[i + 1] = pixels[i + 1]! * g;
    pixels[i + 2] = pixels[i + 2]! * b;
  }
}
