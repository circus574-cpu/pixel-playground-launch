/**
 * /mapa shell: the 3D globe when WebGL 2 is available, otherwise (or on
 * request, or after a GPU failure) the flat painted atlas. The globe chunk
 * (three.js) is loaded lazily on the client only; SSR renders a light shell.
 */
import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import spaceUrl from "@/assets/planet-map/space.jpg";
import { PlanetMap } from "./PlanetMap";
import { supportsWebGL2 } from "./webgl";
import type { GameLink } from "./MapChrome";
import "./planet-map.css";
import "./globe.css";

const PlanetGlobe = lazy(() => import("./PlanetGlobe"));

type Mode = "checking" | "globe" | "flat";

export const FALLBACK_NOTICE = {
  "no-webgl": "To urządzenie nie obsługuje WebGL 2 — wyświetlono płaską mapę atlasu.",
  error: "Globus 3D nie mógł się uruchomić — wyświetlono płaską mapę atlasu.",
  "context-lost": "Karta graficzna przerwała renderowanie globusa — wyświetlono płaską mapę.",
} as const;
type FallbackReason = keyof typeof FALLBACK_NOTICE;

class GlobeBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("[mapa] Globe 3D unavailable, showing the 2D atlas.", error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? <GlobeLoading /> : this.props.children;
  }
}

export function GlobeLoading() {
  return (
    <main className="planet-map planet-globe">
      <div className="pg-space" style={{ backgroundImage: `url(${spaceUrl})` }} aria-hidden />
      <div className="pg-loading" role="status">
        <span className="pg-ring" aria-hidden />
        Wczytywanie globusa planety Superior…
      </div>
    </main>
  );
}

export function MapaView({
  probe = supportsWebGL2,
  current,
  onClose,
  onTravel,
  focus,
}: GameLink & { probe?: () => boolean }) {
  const [mode, setMode] = useState<Mode>("checking");
  const focused = Boolean(focus);
  const [canGlobe, setCanGlobe] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ok = probe();
    setCanGlobe(ok);
    // Opened on the player's position: the flat atlas first, the globe one tap away.
    setMode(ok && !focused ? "globe" : "flat");
    setNotice(ok ? null : FALLBACK_NOTICE["no-webgl"]);
  }, [probe, focused]);

  const fallBack = useCallback((reason: FallbackReason) => {
    setMode("flat");
    setNotice(FALLBACK_NOTICE[reason]);
  }, []);
  const onBoundaryError = useCallback(() => fallBack("error"), [fallBack]);

  if (mode === "checking") return <GlobeLoading />;
  if (mode === "flat") {
    return (
      <PlanetMap
        current={current}
        focus={focus}
        onClose={onClose}
        onTravel={onTravel}
        notice={notice}
        onShowGlobe={
          canGlobe
            ? () => {
                setNotice(null);
                setAttempt((n) => n + 1);
                setMode("globe");
              }
            : undefined
        }
      />
    );
  }
  return (
    <GlobeBoundary key={attempt} onError={onBoundaryError}>
      <Suspense fallback={<GlobeLoading />}>
        <PlanetGlobe
          current={current}
          onClose={onClose}
          onTravel={onTravel}
          onShowFlat={() => setMode("flat")}
          onFail={fallBack}
        />
      </Suspense>
    </GlobeBoundary>
  );
}
