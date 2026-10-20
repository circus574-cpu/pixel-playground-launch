import { useState, type CSSProperties } from "react";
import { RACES, RACE_IDS, type RaceId } from "../../game/world/races";
import { WORLDS } from "../../game/world/worlds";
import { slotTitle, type CharacterSlot } from "../../game/characters";
import "./character-selection.css";

type Props = {
  slots: CharacterSlot[];
  warning: string;
  onCreate: (race: RaceId) => void;
  onContinue: (slot: CharacterSlot) => void;
};
export function CharacterSelection({ slots, warning, onCreate, onContinue }: Props) {
  const [selected, setSelected] = useState<RaceId>("planetary");
  const [showSlots, setShowSlots] = useState(slots.length > 0);
  const race = RACES[selected],
    world = WORLDS[race.world];
  return (
    <main className="ki-origins" style={{ "--origin-color": race.color } as CSSProperties}>
      <header className="ki-origins-header">
        <a href="/" aria-label="Ki Legends — początek" className="ki-wordmark">
          KI <span>LEGENDS</span>
          <small>KRONIKI CZTERECH ŚWIATÓW</small>
        </a>
        <nav aria-label="Postacie">
          <button aria-pressed={!showSlots} onClick={() => setShowSlots(false)}>
            Nowa podróż
          </button>
          <button aria-pressed={showSlots} onClick={() => setShowSlots(true)}>
            Twoje postacie <span>{slots.length}</span>
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
          <p>
            Każda postać ma osobny postęp na tym urządzeniu. Nowa podróż zachowuje istniejące
            zapisy.
          </p>
          <div className="ki-slot-grid">
            {slots.map((slot) => (
              <article key={slot.id} className="ki-slot">
                {slot.player && <img src={RACES[slot.player.race].portrait} alt="" />}
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
                </div>
              </article>
            ))}
          </div>
          {!slots.length && <p>Nie masz jeszcze zapisanej postaci.</p>}
          <button className="ki-origin-primary" onClick={() => setShowSlots(false)}>
            Utwórz nową postać
          </button>
        </section>
      ) : (
        <>
          <section className="ki-origin-intro">
            <p className="ki-origin-eyebrow">JEDNA ENERGIA. CZTERY DROGI.</p>
            <h1>
              Skąd zacznie się
              <br />
              <em>twoja legenda?</em>
            </h1>
            <p>
              Wybierz pochodzenie. Odkryj swój kontynent.
              <br />
              Pierwszy krok należy do ciebie.
            </p>
          </section>
          <section className="ki-race-grid" aria-label="Cztery rasy">
            {RACE_IDS.map((id, index) => {
              const r = RACES[id],
                w = WORLDS[r.world];
              return (
                <article
                  key={id}
                  className={"ki-race-card " + (selected === id ? "selected" : "")}
                  style={{ "--race-color": r.color } as CSSProperties}
                >
                  <button
                    className="ki-race-preview"
                    aria-label={"Podgląd kontynentu: " + r.name}
                    aria-pressed={selected === id}
                    onClick={() => setSelected(id)}
                  >
                    <img
                      src={r.portrait}
                      alt={"Referencja artystyczna rasy " + r.name}
                      loading={index ? "lazy" : "eager"}
                    />
                    <span className="ki-race-number">0{index + 1}</span>
                    <span className="ki-race-copy">
                      <small>{w.name}</small>
                      <strong>{r.name}</strong>
                      <span>{r.title}</span>
                    </span>
                    <span className="ki-preview-caption">
                      {selected === id ? "◆ OGLĄDASZ KONTYNENT" : "ODKRYJ KONTYNENT →"}
                    </span>
                  </button>
                  <button
                    className="ki-race-choose"
                    aria-label={"Wybierz: " + r.name}
                    onClick={() => onCreate(id)}
                  >
                    Wybierz: {r.name} <span>→</span>
                  </button>
                </article>
              );
            })}
          </section>
          <section className="ki-continent-preview" aria-label={"Podgląd: " + world.name}>
            <div className="ki-world-preview-image">
              <img src={world.minimap} alt={"Mapa regionu startowego: " + world.settlement} />
              <span>REGION STARTOWY · PODGLĄD MAPY</span>
            </div>
            <div className="ki-world-preview-copy">
              <p className="ki-origin-eyebrow">
                {race.name} / {world.settlement}
              </p>
              <h2>{world.name}</h2>
              <p>{race.description}</p>
              <p>{world.description}</p>
              <p className="ki-origin-architecture">{world.architecture}</p>
              <div className="ki-origin-details">
                <div>
                  <small>KULTURA</small>
                  <p>{race.culture}</p>
                </div>
                <div>
                  <small>ENERGIA</small>
                  <p>{race.energy}</p>
                </div>
              </div>
              <button className="ki-origin-primary" onClick={() => onCreate(selected)}>
                Rozpocznij w {world.name} <span>→</span>
              </button>
            </div>
          </section>
          <footer className="ki-origins-footer">
            <span>◆ Lokalna przygoda PvE · zapis na urządzeniu</span>
            <span>
              Ilustracje: referencje z dokumentu. W grze wspólny ludzki sprite; nowe krainy używają
              zasobów tymczasowych.
            </span>
          </footer>
        </>
      )}
    </main>
  );
}
