export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 1;
export const DEFAULT_ZOOM = 0.62;
export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(value) ? value : DEFAULT_ZOOM));
}
export function initialZoom(viewportWidth: number, viewportHeight = Infinity): number {
  return viewportWidth <= 600 || (viewportWidth <= 1100 && viewportHeight <= 500)
    ? 0.48
    : DEFAULT_ZOOM;
}
