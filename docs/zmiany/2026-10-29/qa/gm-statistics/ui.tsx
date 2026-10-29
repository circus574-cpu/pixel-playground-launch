import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CharacterEditor } from "../../../../../src/components/admin/CoderAdminPanel";
import type { CharacterRow } from "../../../../../src/game/account/cloudPort";
import { newPlayer, stats, type Player } from "../../../../../src/game/session";
import { RACE_IDS, type RaceId } from "../../../../../src/game/world/races";
import { emptyCombatTraining } from "../../../../../src/game/combatTraining";
import "../../../../../src/components/account/account.css";
const rowFor = (race: RaceId): CharacterRow => {
  const player = newPlayer(race);
  player.level = 7;
  player.skills = ["R", "A1", "A2"];
  player.weapon = "sword";
  player.items.sword = 1;
  player.upgrade = 1;
  player.armor = "vest";
  player.items.vest = 1;
  player.combatTraining = emptyCombatTraining();
  player.combatTraining.technique.rank = 20;
  player.combatTraining.attackSpeed.rank = 20;
  return {
    user_id: "qa",
    save_key: "qa-gm-browser",
    revision: 1,
    updated_at: "2026-10-29T00:00:00Z",
    updated_by: null,
    data: { player },
  };
};
export default function Harness() {
  const [row, setRow] = useState(rowFor("planetary"));
  const player = (row.data as { player: Player }).player;
  return (
    <div className="ki-coder-panel">
      <main className="ki-account">
        <h1>QA — rzeczywisty formularz Coder</h1>
        <p>Kontrolowane dane lokalne, bez połączenia z kontami lub bazą.</p>
        <label>
          Rasa QA
          <select value={player.race} onChange={(e) => setRow(rowFor(e.target.value as RaceId))}>
            {RACE_IDS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() =>
            setRow({
              ...row,
              revision: row.revision + 1,
              data: { player: { ...player, level: 8 } },
            })
          }
        >
          Nowszy zapis QA
        </button>
        <output id="expected" hidden>
          {JSON.stringify(stats(player))}
        </output>
        <CharacterEditor
          row={row}
          onSaveData={async (data) => setRow({ ...row, revision: row.revision + 1, data })}
        />
      </main>
    </div>
  );
}
createRoot(document.getElementById("app")!).render(<Harness />);
