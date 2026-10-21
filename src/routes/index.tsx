import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameLoadingScreen } from "../components/game/GameLoadingScreen";
import { preparingWorld, type GameLoadingState } from "../game/loading";
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
  const [mapNotice, setMapNotice] = useState<"verdant" | "aether" | false>(false);
  const [slots, setSlots] = useState<CharacterSlot[]>([]);
  const [active, setActive] = useState<CharacterSlot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  const [startWithOrigins, setStartWithOrigins] = useState(false);
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
    // Explicit continent handoff from /mapa. Never overwrite or auto-create saves.
    const params = new URLSearchParams(window.location.search);
    if (params.get("continent") === "verdant" || params.get("continent") === "aether") {
      setMapNotice(params.get("continent") === "verdant" ? "verdant" : "aether");
      setActive(null);
    }
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
      <main className="ki-bootstrap">
        <GameLoadingScreen state={preparingWorld()} />
      </main>
    );
  if (active?.player)
    return (
      <GameScreen
        key={active.id}
        slot={active}
        onExit={(origins = false) => {
          setStartWithOrigins(origins);
          store?.select(null);
          setActive(null);
          setSlots(store?.list() ?? []);
          setWarning(store?.warning ?? "");
        }}
      />
    );
  return (
    <>
      {mapNotice && (
        <div role="status" style={{ padding: "12px", textAlign: "center" }}>
          {mapNotice === "verdant" ? "Verdantia — Planetarni" : "Aetheria — Mędrcy"}: wybierz istniejącą postać odpowiedniego pochodzenia lub utwórz nową.
        </div>
      )}
      <CharacterSelection
        slots={slots}
        warning={warning}
        onCreate={create}
        onContinue={open}
        startWithOrigins={startWithOrigins || mapNotice}
      />
    </>
  );
}
function GameScreen({
  slot,
  onExit,
}: {
  slot: CharacterSlot;
  onExit: (origins?: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [testMode, setTestMode] = useState(false);
  const [zoom, setZoom] = useState(0.62);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayNotice, setDisplayNotice] = useState({ id: 0, text: "" });
  const displayMessage = (text: string) =>
    setDisplayNotice((previous) => ({ id: previous.id + 1, text }));
  const setWorldLabels = useCallback((visible: boolean) => {
    container.current?.dispatchEvent(new CustomEvent("ki:labels", { detail: visible }));
  }, []);
  const [loading, setLoading] = useState<GameLoadingState>(preparingWorld);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GameViewState>(() => initialView(slot.player!));
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
      else displayMessage("Ta przeglądarka nie udostępnia pełnego ekranu.");
    } catch {
      displayMessage("Nie udało się włączyć pełnego ekranu. Spróbuj ponownie.");
    }
  }
  useEffect(() => {
    setLoading(preparingWorld());
    setState(initialView(slot.player!));
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
            {
              saveKey: slot.key,
              race: slot.player!.race,
              onLoading: (next) => {
                if (!cancelled) setLoading(next);
              },
            },
          );
      })
      .catch(() => {
        if (!cancelled)
          setLoading({
            phase: "error",
            message: "Nie można uruchomić silnika gry. Sprawdź połączenie i ponów próbę.",
            progress: null,
            reload: true,
          });
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [slot.key, slot.player, attempt]);
  return (
    <main ref={stage} className="ki-stage">
      <div ref={container} className="ki-canvas" aria-label="Ki Legends — ekran gry" />
      {state.ready && loading.phase === "ready" && (
        <GameHud
          state={state}
          error={null}
          zoom={zoom}
          onZoom={changeZoom}
          fullscreen={fullscreen}
          onFullscreen={() => void toggleFullscreen()}
          onCommand={sendCommand}
          onWorldLabels={setWorldLabels}
          systemNotice={displayNotice}
          onRaceChange={() => {
            container.current?.dispatchEvent(new Event("ki:flush"));
            onExit(true);
          }}
          onCharacters={() => {
            container.current?.dispatchEvent(new Event("ki:flush"));
            onExit();
          }}
        />
      )}
      {loading.phase !== "ready" && (
        <GameLoadingScreen
          state={loading}
          race={slot.player!.race}
          onRetry={() => {
            if (loading.phase === "error" && loading.reload) window.location.reload();
            else setAttempt((value) => value + 1);
          }}
          onBack={() => onExit()}
        />
      )}
      {testMode && (
        <div className="ki-playtest-badge">
          TEST 3 · oddzielny zapis · <a href="/">Powrót</a>
        </div>
      )}
    </main>
  );
}
