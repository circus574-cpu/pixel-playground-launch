import { describe, expect, it } from "vitest";
import { clampZoom, initialZoom } from "../game/view";
describe("camera presentation", () => {
  it("starts zoomed out on desktop and farther out on narrow phones", () => {
    expect(initialZoom(1363)).toBe(0.62);
    expect(initialZoom(414)).toBe(0.48);
  });
  it("keeps invalid or extreme settings within readable limits", () => {
    expect(clampZoom(0)).toBe(0.35);
    expect(clampZoom(3)).toBe(1);
    expect(clampZoom(Number.NaN)).toBe(0.62);
  });
});
