import type { ReactNode } from "react";
import { isCityStage } from "../../game/city/types";
import { CityDirectory } from "./CityPanels";
import { QuestsV2Journal } from "./QuestsV2Journal";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import { WORLDS } from "../../game/world/worlds";
import {
  ITEMS,
  ITEM_IDS,
  MATERIALS,
  xpNeeded,
  type Command,
  type GameViewState,
  type ItemId,
} from "../../game/session";
import { BRANCH_NAMES, KIT_NODES, canLearn } from "../../game/kit";
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
                  (id === "potion" && (p.hp >= state.stats.maxHp || state.potion.remaining > 0))
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
      {Object.keys(p.materials).length > 0 && (
        <div className="ki-item-list" aria-label="Materiały z łupów">
          {Object.entries(p.materials).map(([id, n]) => (
            <article key={id} className="ki-item-row">
              <span
                aria-hidden="true"
                className="ki-icon ki-item-icon"
                style={{ backgroundPosition: "100% 50%" }}
              />
              <div>
                <strong>
                  {MATERIALS[id]?.name ?? id} ×{n}
                </strong>
                <small>Materiał · sprzedaż za {MATERIALS[id]?.sell ?? 0} monet</small>
              </div>
            </article>
          ))}
        </div>
      )}
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
  worldOverride,
}: {
  worldOverride?: import("../../game/world/types").WorldDefinition | undefined;
  state: GameViewState;
  send: SendCommand;
  close: () => void;
}) {
  const world = worldOverride ?? WORLDS[state.player.continent];
  return (
    <div className="ki-adventure-panel">
      {WORLD_V2 && <h3 className="ki-qv2-title">Pierwsze kroki</h3>}
      {state.quests.map((q) => {
        const npcId = q.id === "steps" ? "guide" : q.id === "boars" ? "hunter" : "smith";
        const npcName =
          world.id === "verdant"
            ? q.id === "steps"
              ? "Airy"
              : q.id === "boars"
                ? "Rena"
                : "Taro"
            : world.npcs.find((n) => n.id === npcId)!.name;
        const reward =
          q.id === "steps"
            ? isCityStage(world)
              ? "40 XP · 40 monet"
              : "40 XP"
            : q.id === "boars"
              ? "80 XP · 30 monet · Ostrze strażnika"
              : "40 XP";
        const action =
          q.status !== "done" ? (
            <button
              className={WORLD_V2 ? "ki-qv2-accept" : undefined}
              onClick={() => {
                close();
                if (q.id === "steps" && q.status === "active")
                  send({ type: "move", ...world.market });
                else send({ type: "interact", npc: npcId });
              }}
            >
              {q.id === "steps" && q.status === "active"
                ? world.id === "verdant"
                  ? "Idź na rynek"
                  : world.market.action
                : "Idź do " + npcName}
            </button>
          ) : null;
        if (WORLD_V2) {
          // World v2: the starter quests share the card look of the continent adventures.
          const cardState = q.status === "done" ? "completed" : "active";
          const giver = world.npcs.find((n) => n.id === npcId)?.name ?? npcName;
          return (
            <article className={"ki-qv2-card is-" + cardState} key={q.id}>
              <img
                className="ki-qv2-portrait"
                src={`/game/portraits-v2/npc-${giver.toLowerCase().replace(/[^a-z0-9]/g, "")}.webp`}
                alt={giver}
                width={64}
                height={78}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <h3>
                {q.status === "done" ? "✓ " : "◆ "}
                {q.name}
              </h3>
              <div className="ki-qv2-meta">
                <span className={"ki-qv2-badge is-" + cardState}>
                  {q.status === "done" ? "Ukończone" : "W toku"}
                </span>
                <span>{giver}</span>
                <span className="ki-qv2-reward">+{reward}</span>
              </div>
              <p className="ki-qv2-story">{q.text}</p>
              {action}
            </article>
          );
        }
        return (
          <article className="ki-quest-entry" key={q.id}>
            <h3>
              {q.status === "done" ? "✓ " : "◆ "}
              {q.name}
            </h3>
            <p>{q.text}</p>
            <small>Nagroda: {reward}</small>
            {action}
          </article>
        );
      })}
      <p className="ki-panel-caption">
        Zadania można wykonać kolejno. Postęp i odebrane nagrody zapisują się automatycznie.
      </p>
      <QuestsV2Journal continent={state.player.continent} />
    </div>
  );
}
export function NpcDialogue({
  state,
  send,
  feedback,
  worldOverride,
}: {
  worldOverride?: import("../../game/world/types").WorldDefinition | undefined;
  state: GameViewState;
  send: SendCommand;
  feedback?: ReactNode;
}) {
  const world = worldOverride ?? WORLDS[state.player.continent];
  const npc = world.npcs.find((n) => n.id === state.dialogue);
  if (!npc) return null;
  const p = state.player;
  const quest = npc.id === "guide" ? "steps" : npc.id === "hunter" ? "boars" : "gear";
  const q = p.quests[quest];
  const unlocked =
    npc.id === "guide" ||
    (npc.id === "hunter" || isCityStage(world)
      ? p.quests.steps === "done"
      : p.quests.boars === "done");
  const text =
    npc.dialogue ??
    {
      guide:
        "Witaj, wędrowcze. Klikaj ziemię, aby iść. Na telefonie możesz też przeciągać palcem w lewym dolnym obszarze. " +
        world.market.instruction +
        ". Szukaj złotego znacznika ◆ Rynek albo użyj przycisku Podejdź do rynku. Potem wróć do mnie po nagrodę.",
      hunter:
        "Dziki krążą przy wschodniej drodze i na zachód od rynku. Przyjmij zadanie, pokonaj trzy i wróć. Kliknięcie dzika uruchamia podejście i autoatak. Skróty 1–9, 0 i Q odpowiadają przyciskom na dole; spacja to atak podstawowy.",
      merchant:
        "U mnie kupisz mikstury i pancerz. Płacę za kły dzików. Monety i przedmioty pozostaną na tym urządzeniu po odświeżeniu.",
      smith:
        "Ren daje ostrze za obronę wioski. Przyjmij u mnie zadanie, załóż je w ekwipunku i wróć. Za 15 monet mogę też raz ulepszyć założone ostrze o 4 ataku.",
      keeper: "Twoja skrzynia jest w depozycie.",
      trainer: "Trenuj na manekinie.",
      innkeeper: "Odpocznij w gospodzie.",
      steward: "Poznaj dzielnice miasta.",
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
        {feedback}
        <div className="ki-adventure-panel">
          <p>{text}</p>
          {["guide", "hunter", "smith"].includes(npc.id) &&
            !(isCityStage(world) && npc.id === "hunter" && q !== "ready") && (
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
                {npc.id === "guide" && q === "active" && (
                  <button
                    onClick={() => {
                      send({ type: "dialogue", action: "close" });
                      send({ type: "move", ...world.market });
                    }}
                  >
                    {world.market.action}
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
                <article key={id} className="ki-item-row" aria-label={ITEMS[id].name}>
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
              {Object.entries(p.materials).map(([id, n]) => (
                <article key={id} className="ki-item-row">
                  <span
                    aria-hidden="true"
                    className="ki-icon ki-item-icon"
                    style={{ backgroundPosition: "100% 50%" }}
                  />
                  <div>
                    <strong>{MATERIALS[id]?.name ?? id}</strong>
                    <small>Masz: {n}</small>
                  </div>
                  <div className="ki-trade-actions">
                    <button onClick={() => send({ type: "trade", item: id, buy: false })}>
                      Sprzedaj · {MATERIALS[id]?.sell ?? 0}
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
          {npc.id === "keeper" && (
            <button onClick={() => send({ type: "chest" })}>Podejdź do swojej skrzyni</button>
          )}
          {npc.id === "trainer" && (
            <button onClick={() => send({ type: "training", action: "start" })}>
              Ćwicz na manekinie
            </button>
          )}
          {npc.id === "innkeeper" && (
            <button
              disabled={p.gold < 5 || (p.hp >= state.stats.maxHp && p.ki >= state.stats.maxKi)}
              onClick={() => send({ type: "rest" })}
            >
              Odpocznij · 5 monet
            </button>
          )}
          {npc.id === "steward" && world.city && (
            <CityDirectory
              city={world.city}
              send={send}
              close={() => send({ type: "dialogue", action: "close" })}
            />
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

const TYPE_LABEL: Record<string, string> = {
  starting: "Zdolność startowa",
  active: "Aktywna",
  passive: "Pasywna",
  choice: "Wybór",
  ultimate: "Ostateczna",
  "ki-mode": "Tryb KI",
};
/** Skill tree of the player's race (owner annex 22.10.2026): 29 nodes, 3 branches, one point per level up to 20. */
export function SkillTree({ state, send }: { state: GameViewState; send: SendCommand }) {
  const p = state.player;
  const nodes = KIT_NODES[p.race];
  const names = BRANCH_NAMES[p.race];
  const learned = new Set(p.skills);
  const row = (id: string) => nodes.find((n) => n.id === id)!;
  const branch = (b: "A" | "B" | "C") => nodes.filter((n) => n.id.startsWith(b));
  const node = (id: string) => {
    const n = row(id);
    const have = learned.has(id);
    const check = canLearn(p.race, p.level, p.skills, id);
    const blocked = !have && n.excludes && learned.has(n.excludes);
    return (
      <article
        key={id}
        className={"ki-skill-node" + (have ? " is-learned" : "") + (blocked ? " is-blocked" : "")}
        aria-label={n.name}
      >
        <header>
          <strong>
            {id} · {n.name}
          </strong>
          <small>
            {TYPE_LABEL[n.type]} · poz. {n.minLevel}
          </small>
        </header>
        <p>{n.text}</p>
        {have ? (
          <span className="ki-skill-state">Poznane</span>
        ) : (
          <button
            disabled={!check.ok}
            title={check.ok ? "Poznaj za 1 punkt" : check.reason}
            onClick={() => send({ type: "learn", node: id })}
          >
            {check.ok ? "Poznaj · 1 pkt" : check.reason}
          </button>
        )}
      </article>
    );
  };
  return (
    <div className="ki-adventure-panel ki-skilltree">
      <p>
        <strong>Punkty umiejętności: {state.skillPoints}</strong> · poziom {p.level} (1 punkt na
        poziom do 20.) · wykorzystane {p.skills.length}
      </p>
      <div className="ki-skill-root">{node("R")}</div>
      {(["A", "B", "C"] as const).map((b) => (
        <section key={b} className="ki-skill-branch" aria-label={"Gałąź " + b + ": " + names[b]}>
          <h3>
            {b} · {names[b]}
          </h3>
          {branch(b).map((n) => node(n.id))}
        </section>
      ))}
      <section className="ki-skill-branch" aria-label="Tryb KI">
        <h3>Tryb KI</h3>
        {node("T")}
      </section>
      <button
        onClick={() => send({ type: "respec" })}
        disabled={p.skills.length <= 1 || p.gold < state.respecCost}
      >
        Resetuj drzewko ·{" "}
        {state.respecCost === 0 ? "pierwszy raz za darmo" : state.respecCost + " monet"}
      </button>
      <p className="ki-panel-caption">
        Wymagany poprzednik, poziom i brak wykluczającego wyboru. Efekty i koszty Ki to wartości z
        aneksu projektowego do testów i balansu.
      </p>
    </div>
  );
}
