let cachedWebGL2: boolean | null = null;

/**
 * Browser capability probe for the 3D globe. three.js (r163+) needs WebGL 2;
 * without it /mapa shows the flat painted atlas instead. Call only from
 * effects or event handlers, never during render or at module scope.
 */
export function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  if (cachedWebGL2 !== null) return cachedWebGL2;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) {
      cachedWebGL2 = false;
      return false;
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    cachedWebGL2 = true;
    return true;
  } catch {
    cachedWebGL2 = false;
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
