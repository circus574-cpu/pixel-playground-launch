import {
  ITEMS,
  ITEM_IDS,
  NPCS,
  xpNeeded,
  type Command,
  type GameViewState,
  type ItemId,
} from "../../game/session";
export type SendCommand = (command: Command) => void;
export function ItemIcon({ item }: { item: ItemId }) {
  const n = ITEMS[item].icon;
  return (
    <span
      aria-hidden="true"
      className="ki-icon ki-item-icon"
      style={{ backgroundPosition: (n % 3) * 50 + "% " + Math.floor(n / 3) * 50 + "%" }}
    />
  );
}
export function Inventory({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  return (
    <div className="ki-adventure-panel">
      <p>
        Poziom {p.level} · XP {p.xp}/{xpNeeded(p.level)} · <strong>{p.gold} monet</strong>
      </p>
      <p>
        Atak {state.stats.attack} · Obrona {state.stats.defense}
      </p>
      <div className="ki-equipped">
        <div>
          Broń: {p.weapon ? ITEMS[p.weapon].name + (p.upgrade ? " +1" : "") : "brak"}
          {p.weapon && (
            <button onClick={() => send({ type: "unequip", slot: "weapon" })}>Zdejmij broń</button>
          )}
        </div>
        <div>
          Pancerz: {p.armor ? ITEMS[p.armor].name : "brak"}
          {p.armor && (
            <button onClick={() => send({ type: "unequip", slot: "armor" })}>
              Zdejmij pancerz
            </button>
          )}
        </div>
      </div>
      <div className="ki-item-list">
        {ITEM_IDS.filter((id) => p.items[id] > 0).map((id) => {
          const item = ITEMS[id],
            equipped = p.weapon === id || p.armor === id;
          return (
            <article key={id} className="ki-item-row">
              <ItemIcon item={id} />
              <div>
                <strong>
                  {item.name} ×{p.items[id]}
                </strong>
                <small>
                  {item.attack
                    ? "+" + item.attack + " ataku"
                    : item.defense
                      ? "+" + item.defense + " obrony"
                      : id === "potion"
                        ? "Przywraca do 65 HP"
                        : "Materiał · sprzedaż za 5 monet"}
                </small>
              </div>
              <button
                disabled={
                  equipped ||
                  (id === "potion" && (p.hp >= state.stats.maxHp || p.cooldowns.potion > 0))
                }
                onClick={() => send({ type: "equip", item: id })}
              >
                {equipped
                  ? "Założone"
                  : id === "potion"
                    ? "Użyj"
                    : id === "tusk"
                      ? "Informacje"
                      : "Załóż"}
              </button>
            </article>
          );
        })}
      </div>
      <p className="ki-panel-caption">
        Przedmioty układają się w stosy do 99. Wyposażenie pozostaje w plecaku. Zapis lokalny na tym
        urządzeniu.
      </p>
    </div>
  );
}
export function QuestJournal({
  state,
  send,
  close,
}: {
  state: GameViewState;
  send: SendCommand;
  close: () => void;
}) {
  return (
    <div className="ki-adventure-panel">
      {state.quests.map((q) => (
        <article className="ki-quest-entry" key={q.id}>
          <h3>
            {q.status === "done" ? "✓ " : "◆ "}
            {q.name}
          </h3>
          <p>{q.text}</p>
          <small>
            Nagroda:{" "}
            {q.id === "steps"
              ? "40 XP"
              : q.id === "boars"
                ? "80 XP · 30 monet · Ostrze strażnika"
                : "40 XP"}
          </small>
          {q.status !== "done" && (
            <button
              onClick={() => {
                close();
                if (q.id === "steps" && q.status === "active")
                  send({ type: "move", x: 1480, y: 800 });
                else
                  send({
                    type: "interact",
                    npc: q.id === "steps" ? "guide" : q.id === "boars" ? "hunter" : "smith",
                  });
              }}
            >
              {q.id === "steps" && q.status === "active"
                ? "Idź na rynek"
                : "Idź do " + (q.id === "steps" ? "Airy" : q.id === "boars" ? "Rena" : "Taro")}
            </button>
          )}
        </article>
      ))}
      <p className="ki-panel-caption">
        Zadania można wykonać kolejno. Postęp i odebrane nagrody zapisują się automatycznie.
      </p>
    </div>
  );
}
export function NpcDialogue({ state, send }: { state: GameViewState; send: SendCommand }) {
  const npc = NPCS.find((n) => n.id === state.dialogue);
  if (!npc) return null;
  const p = state.player;
  const quest = npc.id === "guide" ? "steps" : npc.id === "hunter" ? "boars" : "gear";
  const q = p.quests[quest];
  const unlocked =
    npc.id === "guide" ||
    (npc.id === "hunter" ? p.quests.steps === "done" : p.quests.boars === "done");
  const text = {
    guide:
      "Witaj, wędrowcze. Klikaj ziemię, aby iść. Na telefonie możesz też przeciągać palcem w lewym dolnym obszarze. Odwiedź oznaczony rynek na północ od fontanny i wróć do mnie.",
    hunter:
      "Dziki krążą przy wschodniej drodze i na zachód od rynku. Przyjmij zadanie, pokonaj trzy i wróć. Kliknięcie dzika uruchamia podejście i autoatak. Skróty 1–4 i Q odpowiadają przyciskom na dole.",
    merchant:
      "U mnie kupisz mikstury i pancerz. Płacę za kły dzików. Monety i przedmioty pozostaną na tym urządzeniu po odświeżeniu.",
    smith:
      "Ren daje ostrze za obronę wioski. Przyjmij u mnie zadanie, załóż je w ekwipunku i wróć. Za 15 monet mogę też raz ulepszyć założone ostrze o 4 ataku.",
  }[npc.id];
  return (
    <div className="ki-modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={"Rozmowa: " + npc.name}
        className="ki-modal ki-frame ki-npc-dialogue"
      >
        <header>
          <h2>
            {npc.name} · {npc.role}
          </h2>
          <button
            autoFocus
            aria-label="Zamknij rozmowę"
            onClick={() => send({ type: "dialogue", action: "close" })}
          >
            ×
          </button>
        </header>
        <div className="ki-adventure-panel">
          <p>{text}</p>
          {npc.id !== "merchant" && (
            <>
              <p>{state.quests.find((x) => x.id === quest)?.text}</p>
              {q === "locked" && (
                <button
                  disabled={!unlocked}
                  onClick={() => send({ type: "dialogue", action: "accept" })}
                >
                  {unlocked ? "Przyjmij zadanie" : "Najpierw ukończ poprzednie zadanie"}
                </button>
              )}
              {q === "ready" && (
                <button onClick={() => send({ type: "dialogue", action: "claim" })}>
                  Odbierz nagrodę
                </button>
              )}
              {q === "done" && <p>✓ Zadanie ukończone. Dziękuję za pomoc.</p>}
            </>
          )}
          {npc.id === "merchant" && (
            <>
              <p>
                <strong>{p.gold} monet</strong>
              </p>
              {ITEM_IDS.map((id) => (
                <article key={id} className="ki-item-row">
                  <ItemIcon item={id} />
                  <div>
                    <strong>{ITEMS[id].name}</strong>
                    <small>Masz: {p.items[id]}</small>
                  </div>
                  <div className="ki-trade-actions">
                    {ITEMS[id].price > 0 && (
                      <button
                        disabled={p.gold < ITEMS[id].price || p.items[id] >= 99}
                        onClick={() => send({ type: "trade", item: id, buy: true })}
                      >
                        Kup · {ITEMS[id].price}
                      </button>
                    )}
                    <button
                      disabled={p.items[id] <= (p.weapon === id || p.armor === id ? 1 : 0)}
                      onClick={() => send({ type: "trade", item: id, buy: false })}
                    >
                      Sprzedaj · {ITEMS[id].sell}
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
          {npc.id === "smith" && (
            <button
              disabled={!p.weapon || Boolean(p.upgrade) || p.gold < 15}
              onClick={() => send({ type: "dialogue", action: "upgrade" })}
            >
              Ulepsz ostrze · 15 monet {p.upgrade ? "(wykonano)" : ""}
            </button>
          )}
          <p className="ki-panel-caption">
            Rozmowa zatrzymuje lokalną symulację. Zamknij okno, aby wrócić do gry.
          </p>
          <button onClick={() => send({ type: "dialogue", action: "close" })}>Do zobaczenia</button>
        </div>
      </section>
    </div>
  );
}
