/** Test authority is isolated localhost PG fixture, never a production bypass. */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { GameScreen } from "../src/routes/index";
import { CharacterSelection } from "../src/components/game/CharacterSelection";
import { OnlineClient } from "../src/game/online/client";
import type { CharacterSlot } from "../src/game/characters";
const token = async () => "online-fixture-token-only";
const client = new OnlineClient(token, () => {});
export function App() {
  const [slot, setSlot] = useState<CharacterSlot>();
  const [error, setError] = useState("");
  const start = async (id?: string, race = "planetary", name = "Tester") => {
    try {
      const records = await client.characters();
      const r = id
        ? records.find((c) => c.id === id)!
        : await client.create(race as "planetary", name);
      history.replaceState(null, "", "?character=" + r.id);
      setSlot({ id: r.id, key: r.id, player: r.state.player, warning: "" });
    } catch (e) {
      setError(String(e));
    }
  };
  const saved = new URLSearchParams(location.search).get("character");
  if (saved && !slot && !error)
    return <button onClick={() => void start(saved)}>Wczytaj z serwera</button>;
  if (slot)
    return (
      <GameScreen
        slot={slot}
        online
        tokenProvider={token}
        onExit={() => {
          setSlot(undefined);
          history.replaceState(null, "", location.pathname);
        }}
      />
    );
  return (
    <CharacterSelection
      online
      slots={[]}
      warning={error}
      onCreate={(race, name) => void start(undefined, race, name)}
      onContinue={() => {}}
    />
  );
}
createRoot(document.getElementById("app")!).render(<App />);
