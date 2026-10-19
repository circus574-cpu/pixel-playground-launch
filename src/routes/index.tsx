import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Ki Legends — Gra 2D" },
    { name: "description", content: "Ki Legends — fantasy RPG 2D w przeglądarce." },
  ] }),
  component: Index,
});

function Index() {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("@/game/mountGame").then(({ mountKileGends }) => {
      if (!cancelled && container.current) cleanup = mountKileGends(container.current);
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Nie można uruchomić gry");
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#101a15] text-white">
      {error ? <p role="alert">Błąd uruchamiania: {error}</p> : null}
      <div ref={container} aria-label="Ki Legends — ekran gry" className="w-full max-w-[1200px] aspect-video overflow-hidden" />
    </main>
  );
}
