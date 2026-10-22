import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { RACES, RACE_IDS, type RaceId, type WorldId } from "../../game/world/races";
import { WORLDS } from "../../game/world/worlds";
import { slotTitle, type CharacterSlot } from "../../game/characters";
import { BrandMark } from "./BrandMark";
import { RaceArtwork } from "./RaceArtwork";
import "./character-selection.css";

type Props = {
  slots: CharacterSlot[];
  startWithOrigins?: boolean;
  requestedContinent?: WorldId | undefined;
  warning: string;
  onCreate: (race: RaceId) => void;
  onContinue: (slot: CharacterSlot) => void;
  onDelete?: (slot: CharacterSlot) => void;
};
export function CharacterSelection({
  slots,
  warning,
  onCreate,
  onContinue,
  onDelete,
  startWithOrigins = false,
  requestedContinent,
}: Props) {
  const [selected, setSelected] = useState<RaceId>(
    requestedContinent === "aether"
      ? "sage"
      : requestedContinent === "nexus"
        ? "android"
        : requestedContinent === "pyra"
          ? "legend"
          : "planetary",
  );
  const [showSlots, setShowSlots] = useState(!startWithOrigins && slots.length > 0);
  const [showArt, setShowArt] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const carousel = useRef<HTMLElement>(null),
    detail = useRef<HTMLElement>(null),
    artButton = useRef<HTMLButtonElement>(null);
  const visibleSlots = requestedContinent
    ? slots.filter((slot) => slot.player?.continent === requestedContinent)
    : slots;
  const race = RACES[selected],
    world = WORLDS[race.world];
  function choose(id: RaceId, openDetail = false) {
    if (requestedContinent && RACES[id].world !== requestedContinent) return;
    setSelected(id);
    if (openDetail)
      requestAnimationFrame(() => {
        detail.current?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
        detail.current?.focus({ preventScroll: true });
      });
  }
  function pageRace(index: number) {
    const id = requestedContinent
      ? RACE_IDS.find((candidate) => RACES[candidate].world === requestedContinent)!
      : RACE_IDS[(index + RACE_IDS.length) % RACE_IDS.length]!;
    if (requestedContinent && RACES[id].world !== requestedContinent) return;
    setSelected(id);
    const item = carousel.current?.querySelector<HTMLElement>(`[data-race="${id}"]`),
      track = carousel.current;
    if (item && track && window.matchMedia("(max-width: 700px)").matches)
      track.scrollTo({
        left:
          track.scrollLeft + item.getBoundingClientRect().left - track.getBoundingClientRect().left,
        behavior: "instant",
      });
  }
  function onCarouselKey(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (requestedContinent) return;
    pageRace(RACE_IDS.indexOf(selected) + (event.key === "ArrowRight" ? 1 : -1));
  }
  function closeArt() {
    setShowArt(false);
    requestAnimationFrame(() => artButton.current?.focus());
  }
  return (
    <main className="ki-origins" style={{ "--origin-color": race.color } as CSSProperties}>
      <header className="ki-origins-header">
        <a href="/" aria-label="Ki Legends — początek">
          <BrandMark />
        </a>
        <nav aria-label="Postacie">
          <button aria-pressed={!showSlots} onClick={() => setShowSlots(false)}>
            Nowa podróż
          </button>
          <button aria-pressed={showSlots} onClick={() => setShowSlots(true)}>
            Twoje postacie <span>{visibleSlots.length}</span>
          </button>
        </nav>
      </header>
      {warning && (
        <p className="ki-origin-warning" role="alert">
          {warning}
        </p>
      )}
      {showSlots ? (
        <section className="ki-roster" aria-label="Zapisane postacie">
          <p className="ki-origin-eyebrow">TWOJE HISTORIE</p>
          <h1>Wróć na swój szlak.</h1>
          <p>Każda postać ma własną historię zapisaną na tym urządzeniu.</p>
          <div className="ki-slot-grid">
            {visibleSlots.map((slot) => (
              <article key={slot.id} className="ki-slot">
                {slot.player && <RaceArtwork race={slot.player.race} />}
                <div>
                  <small>
                    {slot.id === "legacy"
                      ? "ZACHOWANY ZAPIS ETAPU 2"
                      : "POSTAĆ " + slot.id.slice(0, 8)}
                  </small>
                  <h2>{slotTitle(slot)}</h2>
                  <p>
                    {slot.player
                      ? WORLDS[slot.player.continent].name +
                        " · " +
                        WORLDS[slot.player.continent].settlement
                      : slot.warning}
                  </p>
                  <button disabled={!slot.player} onClick={() => onContinue(slot)}>
                    Kontynuuj podróż
                  </button>
                  {onDelete && slot.player && confirming !== slot.id && (
                    <button
                      className="ki-slot-delete"
                      aria-label={"Usuń postać: " + slotTitle(slot)}
                      onClick={() => setConfirming(slot.id)}
                    >
                      Usuń
                    </button>
                  )}
                  {onDelete && slot.player && confirming === slot.id && (
                    <div className="ki-slot-confirm" role="group" aria-label="Potwierdź usunięcie">
                      <p>
                        Usunąć tę postać na stałe? Zapis zostanie skasowany z tego urządzenia.
                        {slot.id === "legacy" &&
                          " Oryginał z etapu 2 pozostaje w pamięci przeglądarki."}
                      </p>
                      <button
                        className="ki-slot-delete ki-slot-delete-confirm"
                        onClick={() => {
                          setConfirming(null);
                          onDelete(slot);
                        }}
                      >
                        Tak, usuń
                      </button>
                      <button onClick={() => setConfirming(null)}>Anuluj</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!visibleSlots.length && (
            <p>Brak postaci na wybranym kontynencie. Pozostałe zapisy są zachowane.</p>
          )}
          <button className="ki-origin-primary" onClick={() => setShowSlots(false)}>
            Utwórz nową postać
          </button>
        </section>
      ) : (
        <>
          <section className="ki-origin-intro">
            <div>
              <p className="ki-origin-eyebrow">WYBIERZ SWOJE POCHODZENIE</p>
              <h1>Cztery drogi do wielkości.</h1>
            </div>
            <p>
              Odkryj bohatera. Poznaj jego świat.
              <br />
              Zdecyduj, gdzie zacznie się twoja legenda.
            </p>
          </section>
          <section
            ref={carousel}
            className="ki-race-grid"
            aria-label="Cztery rasy"
            onKeyDown={onCarouselKey}
            onScroll={() => {
              const track = carousel.current;
              if (!track || !window.matchMedia("(max-width: 700px)").matches) return;
              const left = track.getBoundingClientRect().left;
              let closest: RaceId = selected,
                best = Infinity;
              for (const id of RACE_IDS) {
                const el = track.querySelector(`[data-race="${id}"]`);
                if (el) {
                  const delta = Math.abs(el.getBoundingClientRect().left - left);
                  if (delta < best) {
                    best = delta;
                    closest = id;
                  }
                }
              }
              if (!requestedContinent || RACES[closest].world === requestedContinent)
                setSelected(closest);
            }}
          >
            {RACE_IDS.map((id, index) => {
              const r = RACES[id],
                w = WORLDS[r.world];
              return (
                <article
                  key={id}
                  data-race={id}
                  className={"ki-race-card " + (selected === id ? "selected" : "")}
                  style={{ "--race-color": r.color } as CSSProperties}
                >
                  <button
                    className="ki-race-preview"
                    aria-label={"Podgląd kontynentu: " + r.name}
                    aria-pressed={selected === id}
                    disabled={Boolean(requestedContinent && r.world !== requestedContinent)}
                    onClick={() => choose(id, true)}
                  >
                    <RaceArtwork race={id} eager={index === 0} />
                    <span className="ki-race-number">0{index + 1}</span>
                    <span className="ki-race-seal" aria-hidden="true">
                      ◇
                    </span>
                  </button>
                  <div className="ki-race-copy">
                    <small>{w.name}</small>
                    <h2>{r.name}</h2>
                    <p>{r.title}</p>
                  </div>
                  <button
                    disabled={Boolean(requestedContinent && r.world !== requestedContinent)}
                    className="ki-race-choose"
                    aria-label={"Wybierz: " + r.name}
                    onClick={() => choose(id, true)}
                  >
                    Wybierz {r.name}
                    <span aria-hidden="true">→</span>
                  </button>
                </article>
              );
            })}
          </section>
          <nav className="ki-race-pagination" aria-label="Przewijanie ras">
            <button
              disabled={Boolean(requestedContinent)}
              aria-label="Poprzednia rasa"
              onClick={() => pageRace(RACE_IDS.indexOf(selected) - 1)}
            >
              ←
            </button>
            <div>
              {RACE_IDS.map((id, index) => (
                <button
                  key={id}
                  disabled={Boolean(requestedContinent && RACES[id].world !== requestedContinent)}
                  aria-label={"Pokaż rasę: " + RACES[id].name}
                  aria-current={selected === id ? "true" : undefined}
                  onClick={() => pageRace(index)}
                >
                  <span>0{index + 1}</span>
                </button>
              ))}
            </div>
            <button
              disabled={Boolean(requestedContinent)}
              aria-label="Następna rasa"
              onClick={() => pageRace(RACE_IDS.indexOf(selected) + 1)}
            >
              →
            </button>
          </nav>
          <section
            ref={detail}
            tabIndex={-1}
            className="ki-origin-detail"
            aria-label={"Pochodzenie: " + race.name}
            data-selected-race={selected}
          >
            <div className="ki-detail-portrait">
              <RaceArtwork key={selected} race={selected} variant="preview" />
              <button
                ref={artButton}
                aria-label={"Otwórz pełną ilustrację: " + race.name}
                onClick={() => setShowArt(true)}
              >
                Powiększ ilustrację <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="ki-detail-copy">
              <p className="ki-origin-eyebrow">
                {world.name} / {world.settlement}
              </p>
              <h2>{race.name}</h2>
              <p className="ki-detail-title">{race.title}</p>
              <p>{race.description}</p>
              <div className="ki-origin-details">
                <div>
                  <h3>Kultura</h3>
                  <p>{race.culture}</p>
                </div>
                <div>
                  <h3>Energia KI</h3>
                  <p>{race.energy}</p>
                </div>
              </div>
              <section className="ki-continent-preview" aria-label={"Podgląd: " + world.name}>
                <img
                  src={world.minimap}
                  loading="lazy"
                  decoding="async"
                  alt={"Mapa regionu startowego: " + world.settlement}
                />
                <div>
                  <small>KONTYNENT STARTOWY</small>
                  <h3>{world.name}</h3>
                  <small>{world.settlement}</small>
                  <p>{world.description}</p>
                  <p className="ki-origin-architecture">{world.architecture}</p>
                </div>
              </section>
              <button
                className="ki-origin-primary"
                onClick={() =>
                  onCreate(
                    requestedContinent === "aether"
                      ? "sage"
                      : requestedContinent === "verdant"
                        ? "planetary"
                        : selected,
                  )
                }
              >
                Rozpocznij przygodę <span aria-hidden="true">→</span>
              </button>
              <p className="ki-start-caption">
                {race.name} · {world.name} · nowy, osobny zapis
              </p>
            </div>
          </section>
          <footer className="ki-origins-footer">
            <span>Lokalna przygoda PvE · postęp na tym urządzeniu</span>
            <span>
              Oryginalne ilustracje Ki Legends. W rozgrywce wspólny ludzki sprite; nowe krainy
              korzystają z tymczasowej grafiki.
            </span>
          </footer>
        </>
      )}
      {showArt && (
        <div className="ki-art-backdrop" onClick={closeArt}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={"Ilustracja: " + race.name}
            className="ki-art-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeArt();
              if (e.key === "Tab") e.preventDefault();
            }}
          >
            <header>
              <h2>
                {race.name} <span>{world.name}</span>
              </h2>
              <button autoFocus aria-label="Zamknij ilustrację" onClick={closeArt}>
                Zamknij ×
              </button>
            </header>
            <RaceArtwork key={selected} race={selected} variant="full" eager />
          </section>
        </div>
      )}
    </main>
  );
}
