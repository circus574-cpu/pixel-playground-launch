import type { Player } from "../../game/session";
import { heritageChronicle } from "../../game/development/heritage/chronicle";
import { RACES } from "../../game/world/races";

/** Private, earned story. It reads character progress and never issues reward commands. */
export function ChroniclePanel({ player }: { player: Pick<Player, "race" | "development"> }) {
  const entries = heritageChronicle(player);
  return (
    <div aria-label="Prywatna kronika">
      <h3>{RACES[player.race].name} · Kronika pochodzenia</h3>
      <p>
        {RACES[player.race].title}. Odkryte rozdziały: {entries.length}/6.
      </p>
      <p>
        Ta kronika zachowuje poznane świadectwa i twoje decyzje. Kolejne fragmenty historii
        odblokujesz po ukończeniu rozdziałów dziedzictwa.
      </p>
      {entries.length === 0 && (
        <p>
          Twoja historia nie ma jeszcze pierwszego zapisu. Porozmawiaj z przewodnikiem i rozpocznij
          dziedzictwo w zakładce „Dziedzictwo”.
        </p>
      )}
      {entries.map((entry) => (
        <article className="ki-development-card" key={entry.id} aria-label={entry.title}>
          <h4>
            {entry.chapter}. {entry.title}
          </h4>
          <p>{entry.introduction}</p>
          {entry.background && (
            <section aria-label="Odkryta historia">
              <h5>Fragment historii</h5>
              <p>{entry.background}</p>
            </section>
          )}
          {entry.testimonies.length > 0 && (
            <details>
              <summary>Świadectwa rozmówców</summary>
              {entry.testimonies.map((testimony, i) => (
                <blockquote key={i}>
                  <strong>{testimony.speaker}</strong>
                  {testimony.lines.map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </blockquote>
              ))}
            </details>
          )}
          <p>
            <strong>Twój zapis:</strong> {entry.decision}
          </p>
        </article>
      ))}
    </div>
  );
}
