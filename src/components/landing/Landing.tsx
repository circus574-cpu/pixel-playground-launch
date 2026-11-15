import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AccountForm } from "../account/AccountForm";
import { RACES, RACE_IDS, type RaceId } from "../../game/world/races";
import { WORLDS } from "../../game/world/worlds";
import { RACE_LORE } from "../../game/world/raceLore";
import "../account/account.css";
import "./landing.css";

/** Home page for visitors without a session: what the game is, the four origins and the account panel. */
export function Landing() {
  const [open, setOpen] = useState<RaceId | null>(null);
  return (
    <div className="ki-landing">
      <header className="ki-landing-hero">
        <p className="ki-landing-kicker">Przygoda PvE na serwerze</p>
        <h1>KI LEGENDS</h1>
        <p className="ki-landing-lead">
          Cztery pochodzenia, cztery krainy i jedna zagadka: Cisza, która co jakiś czas wyłącza
          energię KI. Wybierz swoje pochodzenie, rozwijaj postać i poznaj świat Superior.
        </p>
        <div className="ki-landing-cta">
          <a className="ki-landing-primary" href="#konto">
            Załóż konto i zagraj
          </a>
          <a href="#rasy">Poznaj cztery pochodzenia</a>
        </div>
      </header>

      <section className="ki-landing-section" aria-labelledby="o-grze">
        <h2 id="o-grze">O grze</h2>
        <ul className="ki-landing-facts">
          <li>
            <b>Cztery rasy, cztery kontynenty.</b> Każda ma własne miasto, rozwój i sposób walki.
          </li>
          <li>
            <b>Postać na serwerze.</b> Zapis jest na koncie: kontynuujesz na dowolnym urządzeniu,
            także na telefonie.
          </li>
          <li>
            <b>Bezpieczne miasta.</b> Wrogowie nie wchodzą do dzielnic miasta, a walka zaczyna się
            za jego granicą.
          </li>
          <li>
            <b>Własne drzewka umiejętności.</b> Zdolności rozwijasz z poziomu na poziom, a ekwipunek
            wybierasz sam.
          </li>
          <li>
            <b>Mapa planety.</b> Zobacz cały świat na <Link to="/mapa">mapie Superior</Link>, zanim
            wybierzesz drogę.
          </li>
        </ul>
      </section>

      <section className="ki-landing-section" id="rasy" aria-labelledby="rasy-h">
        <h2 id="rasy-h">Cztery pochodzenia</h2>
        <p className="ki-landing-sub">
          Rasę wybierasz przy tworzeniu postaci. Nie zmienia się później, ale na jednym koncie
          możesz mieć kilka postaci.
        </p>
        <div className="ki-landing-races">
          {RACE_IDS.map((id) => {
            const race = RACES[id];
            const lore = RACE_LORE[id];
            const world = WORLDS[race.world];
            const expanded = open === id;
            return (
              <article
                key={id}
                className="ki-landing-race"
                style={{ ["--race" as string]: race.color }}
                data-race={id}
              >
                <img
                  src={race.portrait}
                  alt={`Postać rasy ${race.name}`}
                  loading="lazy"
                  width="320"
                  height="320"
                />
                <div className="ki-landing-race-body">
                  <p className="ki-landing-world">
                    {world.name} · {lore.settlement}
                  </p>
                  <h3>{race.name}</h3>
                  <p className="ki-landing-title">{race.title}</p>
                  <p>{race.description}</p>
                  <dl className="ki-landing-meta">
                    <div>
                      <dt>Rola</dt>
                      <dd>{lore.role}</dd>
                    </div>
                    <div>
                      <dt>Mechanika</dt>
                      <dd>{lore.mechanic}</dd>
                    </div>
                    <div>
                      <dt>Zasada kultury</dt>
                      <dd>{lore.principle}</dd>
                    </div>
                    <div>
                      <dt>Pierwsza zdolność</dt>
                      <dd>
                        <b>{lore.starter.name}.</b> {lore.starter.text}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="ki-landing-more"
                    aria-expanded={expanded}
                    aria-controls={`bio-${id}`}
                    onClick={() => setOpen(expanded ? null : id)}
                  >
                    {expanded ? "Zwiń biografię" : "Przeczytaj biografię"}
                  </button>
                  <div id={`bio-${id}`} className="ki-landing-bio" hidden={!expanded}>
                    {lore.biography.map((paragraph) => (
                      <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ki-landing-section ki-landing-join" id="konto" aria-labelledby="konto-h">
        <h2 id="konto-h">Dołącz</h2>
        <p className="ki-landing-sub">
          Załóż konto, aktywuj je linkiem z e-maila i wybierz swoje pochodzenie. Masz już konto?
          Zaloguj się w tym samym panelu.
        </p>
        <div className="ki-account ki-account-embedded">
          <AccountForm initialMode="register" headingLevel={2} />
        </div>
      </section>

      <footer className="ki-landing-footer">
        <nav aria-label="Informacje">
          <Link to="/regulamin">Regulamin</Link>
          <Link to="/prywatnosc">Polityka prywatności</Link>
          <Link to="/mapa">Mapa świata</Link>
          <Link to="/konto">Konto</Link>
        </nav>
        <p>Ki Legends · gra w rozwoju. Teksty i grafiki chronione prawem autorskim.</p>
      </footer>
    </div>
  );
}
