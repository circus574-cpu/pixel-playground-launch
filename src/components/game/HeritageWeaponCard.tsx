import type { GameViewState, Command } from "../../game/session";
import { equippedAttack, personalWeaponAttack } from "../../game/development/heritage/equipment";
export function HeritageWeaponCard({
  state,
  send,
  depot = false,
}: {
  state: GameViewState;
  send: (c: Command) => void;
  depot?: boolean;
}) {
  const p = state.player,
    w = p.development?.heritage.weapon;
  if (!w) return null;
  const delta = personalWeaponAttack(w.stage) - equippedAttack(p);
  return (
    <article className="ki-item-row ki-heritage-weapon" aria-label="Osobista broń dziedzictwa">
      <div>
        <strong>{w.name}</strong>
        <small>
          Stopień {w.stage}/6 · ATK {personalWeaponAttack(w.stage)} ·{" "}
          {w.location === "bag" ? "plecak" : "depozyt"}
          {p.weapon === "heritage" ? " · założona" : ""}
        </small>
        {p.weapon !== "heritage" && (
          <small>
            Zmiana ataku wyposażenia po założeniu: {delta >= 0 ? "+" : ""}
            {delta}. Premie rasy i umiejętności są przeliczane przez istniejący zestaw.
          </small>
        )}
      </div>
      {depot ? (
        <button
          disabled={p.weapon === "heritage"}
          onClick={() =>
            send({ type: "heritage-weapon", action: w.location === "bag" ? "deposit" : "withdraw" })
          }
        >
          {w.location === "bag" ? "Odłóż osobistą broń" : "Odbierz osobistą broń"}
        </button>
      ) : (
        <button
          disabled={w.location !== "bag"}
          onClick={() =>
            send(
              p.weapon === "heritage"
                ? { type: "unequip", slot: "weapon" }
                : { type: "heritage-weapon", action: "equip" },
            )
          }
        >
          {p.weapon === "heritage" ? "Zdejmij" : "Załóż osobistą broń"}
        </button>
      )}
    </article>
  );
}
