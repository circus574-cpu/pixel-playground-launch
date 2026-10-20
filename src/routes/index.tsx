import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterSelection } from "../components/game/CharacterSelection";
import { CharacterStore, type CharacterSlot } from "../game/characters";
import { playtestSaveKey } from "../game/playtest";
import type { RaceId } from "../game/world/races";
import { GameHud } from "../components/game/GameHud";
import { clampZoom, initialZoom } from "../game/view";
import type { GameViewState } from "../game/mountGame";
import { isPlaytest, STAGE21_BUILD } from "../game/playtest";
import { initialView, type Command } from "../game/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ki Legends — Cztery światy" },
      { name: "ki-build", content: STAGE21_BUILD },
      {
        name: "description",
        content: "Cztery pochodzenia, cztery krainy. Rozpocznij lokalną przygodę PvE w Ki Legends.",
      },
    ],
  }),
  component: Index,
});
export function Index() {
  const [store, setStore] = useState<CharacterStore | null>(null);
  const [slots, setSlots] = useState<CharacterSlot[]>([]);
  const [active, setActive] = useState<CharacterSlot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    try {
      const profiles = new CharacterStore(
        window.localStorage,
        playtestSaveKey(window.location.search),
      );
      setStore(profiles);
      setSlots(profiles.list());
      setActive(profiles.active() ?? null);
      setWarning(profiles.warning);
    } catch {
      setWarning(
        "Pamięć lokalna jest zablokowana. Zezwól na zapis, aby bezpiecznie utworzyć postać.",
      );
    }
    setLoaded(true);
  }, []);
  const open = (slot: CharacterSlot) => {
    store?.select(slot);
    setActive(slot);
  };
  const create = (race: RaceId) => {
    const slot = store?.create(race);
    if (slot) open(slot);
    else setWarning(store?.warning || "Nie można utworzyć zapisu na tym urządzeniu.");
  };
  if (!loaded)
    return (
      <main className="ki-origins">
        <p role="status">Otwieranie kronik Ki Legends…</p>
      </main>
    );
  if (active?.player)
    return (
      <GameScreen
        key={active.id}
        slot={active}
        onExit={() => {
          store?.select(null);
          setActive(null);
          setSlots(store?.list() ?? []);
          setWarning(store?.warning ?? "");
        }}
      />
    );
  return <CharacterSelection slots={slots} warning={warning} onCreate={create} onContinue={open} />;
}
function GameScreen({ slot, onExit }: { slot: CharacterSlot; onExit: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [testMode, setTestMode] = useState(false);
  const [zoom, setZoom] = useState(0.62);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayNotice, setDisplayNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameViewState>(initialView);
  const sendCommand = useCallback((command: Command) => {
    container.current?.dispatchEvent(new CustomEvent("ki:command", { detail: command }));
  }, []);
  useEffect(() => {
    setTestMode(isPlaytest(window.location.search));
    const initial = initialZoom(window.innerWidth, window.innerHeight);
    setZoom(initial);
    if (container.current) container.current.dataset["zoom"] = String(initial);
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  function changeZoom(value: number) {
    const next = clampZoom(value);
    setZoom(next);
    if (container.current) {
      container.current.dataset["zoom"] = String(next);
      container.current.dispatchEvent(new Event("ki:zoom"));
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setDisplayNotice("Ta przeglądarka nie udostępnia pełnego ekranu.");
    } catch {
      setDisplayNotice("Nie udało się włączyć pełnego ekranu. Spróbuj ponownie.");
    }
  }
  useEffect(() => {
    const resourceError = (event: Event) => setError(String((event as CustomEvent<string>).detail));
    container.current?.addEventListener("ki:error", resourceError);
    const host = container.current;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("../game/mountGame")
      .then(({ mountKileGends }) => {
        if (!cancelled && container.current)
          cleanup = mountKileGends(
            container.current,
            (next) => {
              if (!cancelled) setState(next);
            },
            { saveKey: slot.key, race: slot.player!.race },
          );
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Nie można uruchomić gry");
      });
    return () => {
      cancelled = true;
      host?.removeEventListener("ki:error", resourceError);
      cleanup?.();
    };
  }, [slot.key, slot.player]);
  return (
    <main ref={stage} className="ki-stage">
      <div ref={container} className="ki-canvas" aria-label="Ki Legends — ekran gry" />
      <GameHud
        state={state}
        error={error}
        zoom={zoom}
        onZoom={changeZoom}
        fullscreen={fullscreen}
        onFullscreen={() => void toggleFullscreen()}
        onCommand={sendCommand}
        onCharacters={() => {
          container.current?.dispatchEvent(new Event("ki:flush"));
          onExit();
        }}
      />
      {testMode && (
        <div className="ki-playtest-badge">
          TEST 3 · oddzielny zapis · <a href="/">Powrót</a>
        </div>
      )}
      {displayNotice && (
        <button className="ki-display-notice" onClick={() => setDisplayNotice("")}>
          {displayNotice} ×
        </button>
      )}
    </main>
  );
}
