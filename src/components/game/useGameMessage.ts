import { useEffect, useRef, useState } from "react";
export const GAME_MESSAGE_DURATION_MS = 5000;
export type MessageEvent = { id: number; text: string };
type VisibleMessage = MessageEvent & { scope: string; expiresAt: number };
/** Runs on wall time, including paused dialogues. Repeated snapshots never restart a message. */
export function useGameMessage({ id, text }: MessageEvent, scope: string, enabled = true) {
  const seen = useRef(0);
  const [message, setMessage] = useState<VisibleMessage | null>(null);
  useEffect(() => {
    const fresh = id !== seen.current;
    seen.current = id;
    setMessage((current) => {
      if (!enabled) return null;
      if (!fresh)
        return current?.scope === scope && current.expiresAt > Date.now() ? current : null;
      if (!text) return null;
      if (current?.text === text && current.scope === scope && current.expiresAt > Date.now())
        return current;
      return { id, text, scope, expiresAt: Date.now() + GAME_MESSAGE_DURATION_MS };
    });
  }, [id, text, scope, enabled]);
  useEffect(() => {
    if (!message) return;
    const expire = () => {
      if (Date.now() >= message.expiresAt)
        setMessage((current) => (current === message ? null : current));
    };
    const timer = window.setTimeout(expire, Math.max(0, message.expiresAt - Date.now()));
    document.addEventListener("visibilitychange", expire);
    window.addEventListener("focus", expire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", expire);
      window.removeEventListener("focus", expire);
    };
  }, [message]);
  return { message, dismiss: () => setMessage(null) };
}
