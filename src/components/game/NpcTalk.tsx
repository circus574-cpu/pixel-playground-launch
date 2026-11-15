import { useEffect, useRef, useSyncExternalStore } from "react";
import { isCityStage } from "../../game/city/types";
import { getNpcQuestDialogue } from "../../game/dialogue";
import { questsV2 } from "../../game/quests/v2Tracker";
import { WORLD_V2 } from "../../game/world/generated/worldVersion";
import type { WorldDefinition } from "../../game/world/types";
import type { GameViewState } from "../../game/session";
import { greetingLines } from "../../game/talk/lines";
import { talkStore } from "../../game/talk/store";
import { QuestDeliveries, type SendCommand } from "./AdventurePanels";
import "./talk.css";

/** Role, których usługi wymagają okna (handel, wytwarzanie, wybór leża, plan miasta). Pozostałe działają jednym przyciskiem. */
const WINDOW_SERVICES: Record<string, string> = {
  merchant: "Handel: kupno i sprzedaż",
  smith: "Kuźnia i ulepszenia",
  alchemist: "Pracownia alchemiczna",
  warden: "Leża bossów",
  steward: "Plan miasta i budynki",
};

/**
 * Rozmowa w świecie. Rozmówca mówi dymkami nad głową (rysuje je scena), a tu są tylko wybory: przyjęcie zadania,
 * usługi, plotki, pożegnanie. To nie jest okno: nie ma tła ani blokady, gra biegnie dalej, a rozmowa kończy się sama,
 * gdy gracz odejdzie od rozmówcy. Napisy kwestii są też w obszarze `aria-live`, żeby czytniki ekranu je odczytały.
 */
export function NpcTalk({
  state,
  send,
  world,
  authoritative = false,
  onServices,
}: {
  state: GameViewState;
  send: SendCommand;
  world: WorldDefinition;
  authoritative?: boolean;
  onServices: () => void;
}) {
  useSyncExternalStore(
    questsV2.subscribe,
    () => questsV2.save,
    () => questsV2.save,
  );
  const spoken = useSyncExternalStore(
    talkStore.subscribe,
    talkStore.getSnapshot,
    talkStore.getSnapshot,
  );
  const npc = world.npcs.find((n) => n.id === state.dialogue);
  const p = state.player;
  const guideBusy = spoken.tour.displaced;

  const legacyQuest = npc?.id === "guide" ? "steps" : npc?.id === "hunter" ? "boars" : "gear";
  const legacyState = p.quests[legacyQuest];
  const legacyText = state.quests.find((x) => x.id === legacyQuest)?.text;
  const showLegacy =
    !!npc &&
    ["guide", "hunter", "smith"].includes(npc.id) &&
    !(isCityStage(world) && npc.id === "hunter" && legacyState !== "ready");
  const unlocked =
    npc?.id === "guide" ||
    (npc?.id === "hunter" || isCityStage(world)
      ? p.quests.steps === "done"
      : p.quests.boars === "done");
  const offers =
    WORLD_V2 && npc?.dialogueId
      ? questsV2
          .journal(p.continent)
          .filter((e) => e.quest.giverNpcId === npc.dialogueId && e.state !== "completed")
      : [];

  // Kwestie o zadaniach dochodzą do powitania jako kolejne dymki (nie zastępują go).
  const questLines: string[] = [];
  if (showLegacy && legacyText && legacyState !== "done") questLines.push(legacyText);
  for (const { quest, state: qs } of offers) {
    const talk = getNpcQuestDialogue(quest.giverNpcId, quest.id);
    const said = qs === "active" ? talk?.during : talk?.before;
    if (said) questLines.push(said);
  }
  const questKey = questLines.join("\u0001");
  const lastKey = useRef<string>("");
  useEffect(() => {
    const key = (npc?.id ?? "") + ":" + state.dialogueTurn + ":" + questKey;
    if (!npc || key === lastKey.current) return;
    lastKey.current = key;
    if (questLines.length) talkStore.append(npc.id, ...questLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npc?.id, state.dialogueTurn, questKey]);

  // Plotkę wybiera sesja (serwer w trybie online); tu tylko mówi ją rozmówca, gdy po kliknięciu przyjdzie komunikat.
  const awaitingRumor = useRef(false);
  const seenNotice = useRef(state.noticeId);
  useEffect(() => {
    if (state.noticeId === seenNotice.current) return;
    seenNotice.current = state.noticeId;
    if (awaitingRumor.current && npc && state.notice) {
      awaitingRumor.current = false;
      talkStore.say(npc.id, state.notice);
    }
  }, [state.noticeId, state.notice, npc]);

  if (!npc) return null;
  const line =
    spoken.speech[npc.id]?.text ?? greetingLines(npc, state.dialogueTurn, world, authoritative)[0];
  const windowLabel = WINDOW_SERVICES[npc.id];
  const stats = state.stats;

  return (
    <section
      className="ki-talk"
      data-race={p.race}
      aria-label={"Rozmowa: " + npc.name}
      role="group"
    >
      <header className="ki-talk-who">
        <strong>{npc.name}</strong>
        <small>{npc.role}</small>
      </header>
      <p className="ki-talk-line" aria-live="polite">
        {line}
      </p>
      <div className="ki-talk-choices">
        {showLegacy && legacyState === "locked" && (
          <button disabled={!unlocked} onClick={() => send({ type: "dialogue", action: "accept" })}>
            {unlocked ? "Przyjmij zadanie" : "Najpierw ukończ poprzednie zadanie"}
          </button>
        )}
        {showLegacy && npc.id === "guide" && legacyState === "active" && (
          <button onClick={() => send({ type: "move", x: world.market.x, y: world.market.y })}>
            {world.market.action}
          </button>
        )}
        {showLegacy && legacyState === "ready" && (
          <button onClick={() => send({ type: "dialogue", action: "claim" })}>
            Odbierz nagrodę
          </button>
        )}
        {showLegacy && legacyState === "done" && (
          <span className="ki-talk-note">✓ Zadanie ukończone. Dziękuję za pomoc.</span>
        )}
        {offers.map(({ quest, state: qs }) =>
          qs === "available" ? (
            <button key={quest.id} onClick={() => questsV2.start(quest.id)}>
              Przyjmij: {quest.title} <small>poz. {quest.recommendedLevel}</small>
            </button>
          ) : (
            <span key={quest.id} className="ki-talk-note">
              ◆ W toku: {quest.title}
            </span>
          ),
        )}
        <QuestDeliveries state={state} send={send} />
        {windowLabel && <button onClick={onServices}>{windowLabel}</button>}
        {npc.id === "keeper" && (
          <button onClick={() => send({ type: "chest" })}>Otwórz depozyt / skrytkę</button>
        )}
        {npc.id === "trainer" && (
          <>
            <button onClick={() => send({ type: "training", action: "start" })}>
              Rozpocznij próbę bojową
            </button>
            <button disabled={p.skills.length <= 1} onClick={() => send({ type: "respec" })}>
              Zresetuj węzły talentów KI
            </button>
          </>
        )}
        {npc.id === "innkeeper" && (
          <button
            disabled={p.gold < 5 || (p.hp >= stats.maxHp && p.ki >= stats.maxKi)}
            onClick={() => send({ type: "rest" })}
          >
            Odpocznij · 5 monet (pełne HP i KI)
          </button>
        )}
        {npc.id === "guide" && !guideBusy && (
          <button
            onClick={() => {
              send({ type: "dialogue", action: "close" });
              talkStore.requestTour();
            }}
          >
            Oprowadź mnie po mieście
          </button>
        )}
        <button
          onClick={() => {
            awaitingRumor.current = true;
            send({ type: "dialogue", action: "rumors" });
          }}
        >
          Zapytaj o plotki i wieści
        </button>
        <button className="ki-talk-bye" onClick={() => send({ type: "dialogue", action: "close" })}>
          Do zobaczenia
        </button>
      </div>
    </section>
  );
}
