/**
 * World v2 on a phone is played in landscape: in portrait this screen covers the game and the
 * session waits (paused). Android can turn the screen itself once the game is fullscreen;
 * iOS cannot lock the orientation from a web page, so it shows the instruction only.
 */
import { useEffect, useRef } from "react";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import type { Command } from "../../game/session";

const PORTRAIT = "(orientation: portrait) and (pointer: coarse)";

export function RotateNotice({
  stage,
  onCommand,
}: {
  stage: HTMLElement | null;
  onCommand: (command: Command) => void;
}) {
  const pausedByUs = useRef(false);
  useEffect(() => {
    if (!WORLD_V2 || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(PORTRAIT);
    const apply = () => {
      if (query.matches && !pausedByUs.current) {
        pausedByUs.current = true;
        onCommand({ type: "pause", value: true });
      } else if (!query.matches && pausedByUs.current) {
        pausedByUs.current = false;
        onCommand({ type: "pause", value: false });
      }
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [onCommand]);
  if (!WORLD_V2) return null;
  const turn = async () => {
    try {
      if (!document.fullscreenElement) await stage?.requestFullscreen?.();
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      // Not supported here (iOS, desktop): the player turns the phone by hand.
    }
  };
  return (
    <div className="ki-rotate" role="alert">
      <div className="ki-rotate-icon" aria-hidden />
      <strong>Obróć telefon poziomo</strong>
      <p>Ki Legends gra się w poziomie: joystick po lewej, walka po prawej.</p>
      <button onClick={() => void turn()}>Pełny ekran</button>
    </div>
  );
}
