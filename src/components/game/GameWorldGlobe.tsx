import { lazy, Suspense } from "react";
import "./game-world-globe.css";

/** Reuse the existing WebGL globe and its 2D fallback without navigating away from the active session. */
const WorldAtlas = lazy(() =>
  import("../planet-map/MapaView").then(({ MapaView }) => ({ default: MapaView })),
);

export function GameWorldGlobe({ onClose }: { onClose: () => void }) {
  return (
    <section
      className="ki-world-globe"
      role="dialog"
      aria-modal="true"
      aria-label="Globus 3D planety Superior — mapa świata gry"
    >
      <Suspense
        fallback={
          <div className="ki-world-globe-loading" role="status">
            Wczytywanie globusa planety Superior…
          </div>
        }
      >
        <WorldAtlas />
      </Suspense>
      <button
        type="button"
        className="ki-world-globe-close"
        onClick={onClose}
        aria-label="Wróć do mapy 2D"
        title="Wróć do mapy 2D"
        autoFocus
      >
        <span aria-hidden="true">←</span>
        <span className="ki-world-globe-close-text"> Gra</span>
      </button>
      <span className="ki-world-globe-caption">
        Mapa świata · powrót do mapy 2D nie zmienia zapisu postaci
      </span>
    </section>
  );
}
