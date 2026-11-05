import { useState } from "react";
import type { GameViewState, Command } from "../../game/session";
import {
  DOMAIN_NAMES,
  TRIALS,
  domainRank,
  trialAvailable,
  trialReward,
  type TrialId,
  type TrialTier,
} from "../../game/development/trials/catalog";

export type StartTrial = (id: TrialId, tier: TrialTier) => void;
export function TrialsPanel({
  state,
  startTrial,
  send,
  close,
}: {
  state: GameViewState;
  startTrial?: StartTrial | undefined;
  send: (command: Command) => void;
  close: () => void;
}) {
  const [selected, setSelected] = useState<{ id: TrialId; tier: TrialTier } | null>(null);
  const p = state.player,
    grades = p.development?.trials ?? {};
  const definitions = TRIALS.filter((t) => t.race === p.race);
  const domains = [...new Set(definitions.map((d) => d.domain))];
  const nearTrainer =
    p.interior === "arena" &&
    state.activeNpcs.some((n) => n.id === "trainer" && Math.hypot(n.x - p.x, n.y - p.y) <= 180);
  const chosen = definitions.find((t) => t.id === selected?.id);
  return (
    <section aria-label="Próby rasowe">
      {domains.map((domain) => (
        <h3 key={domain}>
          {DOMAIN_NAMES[domain]} · stopień dziedziny {domainRank(grades, p.race, domain)}/3
        </h3>
      ))}
      <p>
        Stopień dziedziny wymaga wszystkich trzech prób na danym poziomie trudności. Wyższy stopień
        próby wymaga wcześniejszego. Nagrody 100/150/200 praktyki otrzymasz raz za każdy stopień;
        ponowienia są bezpłatne.
      </p>
      <p>
        W sali używasz wypożyczonego profilu poziomu 20, bez swoich przedmiotów. Po wyjściu
        zachowasz własne HP, KI, umiejętności, wyposażenie i cooldowny. Zaliczenie nie daje XP ani
        łupów.
      </p>
      {!nearTrainer && (
        <button
          onClick={() => {
            close();
            send({ type: "interact", npc: "trainer" });
          }}
        >
          Podejdź do trenera
        </button>
      )}
      {definitions.map((def) => (
        <article key={def.id} className="ki-development-card">
          <h4>
            {def.id} · {def.name} · {DOMAIN_NAMES[def.domain]} · ukończony stopień{" "}
            {grades[def.id] ?? 0}/3
          </h4>
          <div className="ki-development-tabs">
            {([1, 2, 3] as const).map((tier) => (
              <button
                key={tier}
                disabled={!trialAvailable(grades, def.id, tier)}
                onClick={() => setSelected({ id: def.id, tier })}
              >
                Instrukcja · {tier}
              </button>
            ))}
          </div>
        </article>
      ))}
      {chosen && selected && (
        <article className="ki-development-card" aria-label="Instrukcja próby rasowej">
          <h4>
            {chosen.name} · stopień {selected.tier}
          </h4>
          <p>
            {chosen.kind === "focus-cycles"
              ? "Ukończ 2/3/4 pełne kanały C1. Podejdź do stanowiska, poczekaj na sygnał 1500 ms i użyj Skupienia KI. Przerwanie kanału oznacza porażkę; normalne odnowienie pozostaje."
              : chosen.kind === "power-targets"
                ? "Zasil 3/4/5 celów w łącznym limicie 70/65/60% testowego KI. Precyzyjny przepływ kosztuje 10%, szeroki 25% maksimum. Regeneracja nie odnawia limitu."
                : chosen.kind === "sustain-nodes"
                  ? "Utrzymaj 2/3/4 węzły przez 45/60/75 sekund. Odwiedzaj kolejno punkty przed wygaśnięciem i stań w każdym przez 0,5 s. Nie wchodź do oznaczonego zagrożenia."
                  : chosen.kind === "barrier-waves"
                    ? "Osłoń rdzeń przed 3/4/5 falami, pozostawiając minimum 50% HP. Zajmij punkt przechwycenia i włącz wypożyczoną B1 po zapowiedzi; zużywa testowe KI, pojemność i odnowienie."
                    : chosen.kind === "mirrors"
                      ? "Obróć 2/3/4 zwierciadła i przeprowadź promień przez wszystkie do odbiornika O, omijając chroniony punkt !. Plansza pokazuje jawną trasę."
                      : chosen.kind === "cover-windows"
                        ? "Zajmij osłonę w 3/4/5 zapowiedzianych oknach. Reakcja 1800/1500/1300 ms; wymagane ruch po sygnale i rzeczywista ściana względem źródła."
                        : chosen.kind === "supplies"
                          ? "Wybierz dokładnie 3/4/5 składników z jawnych opisów i przygotuj cały zestaw. Materiały są wypożyczone."
                          : chosen.kind === "water-allocation"
                            ? "Rozdziel całe 4/6/8 jednostek wody między obie osady, spełniając podane zapotrzebowanie."
                            : chosen.kind === "camp"
                              ? "Zabezpieczaj 2/3/4 punkty przez 45/60/75 aktywnych sekund. Zajmuj wyznaczone osłony za przeszkodami; co 10 s zmienia się punkt."
                              : chosen.kind === "wind-route"
                                ? "Przejdź 4/6/8 punktów w 180/210/240 s. Maksymalnie dwa wejścia w oznaczone zagrożenie."
                                : chosen.kind === "messenger"
                                  ? "Przeprowadź posłańca przez 2/3/4 punkty, zachowując minimum 50% jego HP. Czeka na gracza; unikaj zapowiedzianych zagrożeń razem z nim."
                                  : chosen.kind === "earth-rhythm"
                                    ? "Uniknij 4/6/8 zapowiedzianych uderzeń i traf 2/3/4 kontry. Oba warunki są wymagane. Trafienie nie zalicza uniku; śmierć przerywa próbę."
                                    : chosen.kind === "counter"
                                      ? "Uniknij czerwonej zapowiedzi i traf bezpieczny cel w oknie kontry. Maksymalnie 2 otrzymane trafienia. Zapowiedź 1800/1500/1300 ms; okno kontrataku 4 s."
                                      : chosen.kind === "restraint"
                                        ? "Wykonuj celne ciosy wyłącznie między sygnałami STOP. 4 s na cios, potem 2 s bez ataku. Zatrzymaj się również po poddaniu mistrza. Błędny cios przerywa próbę."
                                        : chosen.kind === "position"
                                          ? "Przejdź do punktu ustawienia, podejdź do celu i traf zwykłym atakiem, następnie wróć do punktu odwrotu. Pozycje i trafienia sprawdza silnik."
                                          : chosen.kind === "modules"
                                            ? "Dobierz różne moduły do jawnych wymagań, liczby gniazd i budżetu energii. Dostępne są testowe kopie wszystkich sześciu modułów. Niczego nie przeniesiesz do ekwipunku."
                                            : "Podejdź do oznaczonego stanowiska i przeczytaj materiały ćwiczebne. Odpowiedz na podstawie podanych znaków, pomiarów lub dokumentów. Wszystkie potrzebne informacje są dostępne."}
          </p>
          <p>
            Wymagane działania: {chosen.targets[selected.tier - 1]} · dopuszczalne błędy:{" "}
            {chosen.kind === "earth-rhythm"
              ? "śmierć przerywa próbę; otrzymane uderzenie nie zalicza uniku"
              : chosen.maxErrors}
            .
          </p>
          <p>
            {(grades[chosen.id] ?? 0) >= selected.tier
              ? "Ten stopień jest zaliczony. Powtórka nie daje nagrody."
              : `Pierwsze zaliczenie: +${trialReward(selected.tier)} praktyki.`}
          </p>
          <button
            disabled={
              !nearTrainer || !startTrial || !trialAvailable(grades, chosen.id, selected.tier)
            }
            onClick={() => startTrial?.(chosen.id, selected.tier)}
          >
            Rozpocznij próbę rasową
          </button>
        </article>
      )}
      <p>Dostępne są trzy próby tej dziedziny. Pozostałe dziedziny są jeszcze w przygotowaniu.</p>
    </section>
  );
}
