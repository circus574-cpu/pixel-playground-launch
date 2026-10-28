/** Component-only browser fixture. No authentication bypass and no Phaser staff state. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CharacterEditor } from "../../../../../src/components/admin/CoderAdminPanel";
import { PlanetMap } from "../../../../../src/components/planet-map/PlanetMap";
import { newPlayer } from "../../../../../src/game/session";
import "../../../../../src/components/account/account.css";

declare global {
  interface Window {
    __gmComponentQA: { saves: unknown[]; points: unknown[]; closes: number };
  }
}
window.__gmComponentQA = { saves: [], points: [], closes: 0 };
function Fixture() {
  const [map, setMap] = useState(false);
  const [data, setData] = useState<unknown>({ player: newPlayer() });
  return map ? (
    <PlanetMap
      onClose={() => {
        window.__gmComponentQA.closes++;
      }}
      onTravel={() => {}}
      onTeleport={async (land, x, y) => {
        window.__gmComponentQA.points.push({ land, x, y });
        return true;
      }}
    />
  ) : (
    <div className="ki-coder-panel">
      <div className="ki-account" style={{ padding: 12 }}>
        <button onClick={() => setMap(true)}>Test mapy 2D</button>
        <CharacterEditor
          row={{
            user_id: "qa-fixture",
            save_key: "qa-fixture",
            revision: 1,
            data,
            updated_at: "2026-10-28T00:00:00Z",
            updated_by: null,
          }}
          onSaveData={async (next) => {
            window.__gmComponentQA.saves.push(next);
            setData(next);
          }}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
