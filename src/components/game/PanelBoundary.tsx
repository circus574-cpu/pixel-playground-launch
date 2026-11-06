import { Component, type ReactNode } from "react";

import { isStaleChunkError, reloadForFreshBuild } from "../../lib/staleChunk";

/**
 * A failing side panel (the world map, for example) must not take the whole game down to the
 * root error page. A stale chunk after a deployment reloads once; any other failure shows a
 * message with a way back to the game.
 */
export class PanelBoundary extends Component<
  { label: string; onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(`[${this.props.label}]`, error);
    if (isStaleChunkError(error)) reloadForFreshBuild();
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="ki-planet-loading" role="alert">
        <p>{this.props.label} nie wczytała się. Odśwież stronę, jeśli problem wraca.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Odśwież
        </button>{" "}
        <button type="button" onClick={this.props.onClose}>
          Wróć do gry
        </button>
      </div>
    );
  }
}
