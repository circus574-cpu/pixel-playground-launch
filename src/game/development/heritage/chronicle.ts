import type { Player } from "../../session";
import { HERITAGE_QUESTS } from "./catalog";
import type { RaceId } from "../../world/races";

/** Owner-authored background, transcribed unchanged from the 28.10 source, sections 6.1–9.1.
 * Reveal after chapters 2/4/6; the client only presents earned content, never awards progress.
 */
export const HISTORY: Record<RaceId, readonly string[]> = {
  planetary: [
    "Dawne Przymierze Siedmiu Rzek łączyło osady budowane przy nurtach KI. Kamienne domy splatano z pielęgnowanymi korzeniami, mosty miały własnych opiekunów, a targi przenosiły się razem z sezonowymi przeprawami. Wędrowcy Korzeni sprawdzali szlaki i ostrzegali przed zmianami energii. Kupcy i drwale spierali się ze strażnikami lasów o to, ile świat potrafi oddać bez trwałej szkody.",
    "Podczas Wielkiego Rozstrojenia starszyzna zgodziła się skierować falę energii i wodę do bocznych dolin. Na mapach nazwano je opuszczonymi, choć część rodzin nadal czekała na ratunek. Ocaleni trafili później do Zielonej Przystani. Ich nazwy miejsc i rodzinne pieśni stopniowo znikały z oficjalnej historii.",
    "Bohater zaczyna jako pomocnik utrzymania dróg. W rodzinnej skrzyni odnajduje znacznik osady nieobecnej na mapie. Aira rozpoznaje znak; Taro rozpoznaje dawny sposób obróbki metalu. Podróż prowadzi do potomków ludzi, których ratunek uznano kiedyś za zbyt kosztowny. Finałem jest ponowne połączenie społeczności, nie magiczne cofnięcie katastrofy.",
  ],
  sage: [
    "Dawna Aetheria przechowywała wzorce KI w wodzie, kryształach i pieczęciach. Miasto nad Pierwszym Źródłem utrzymywało ogrody, szkoły leczenia i komnaty pamięci. Badacze nie byli jednomyślni: jedni bronili jawnego dostępu, inni powierzali interpretację wąskiej radzie. Odtworzona pamięć mogła być prawdziwa i jednocześnie niepełna.",
    "Po katastrofie część świadectw usunięto w imię ochrony jedności. Zniknęły nazwiska archiwistów, którzy odmówili poprawiania zapisów. Piękne ogrody Sanktuarium Tysiąca Źródeł wyrosły nad zamkniętymi poziomami archiwów.",
    "Bohater jest uczniem opiekującym się kronikami. Odnajduje dokument o uratowanej osadzie, którego zachowana pieczęć odtwarza inną scenę. Sora zna podpis autora. Gracz uczy się oddzielać dowód od interpretacji i chronić osoby, których pamięć staje się przedmiotem publicznego sporu.",
  ],
  android: [
    "Nexus wyrósł wokół instalacji, które utrzymywały przepływ KI. Pierwsze jednostki naprawiały uszkodzenia, prowadziły ratunek i pracowały w skażeniu. Z czasem zapisywały wspomnienia niepotrzebne do wykonania zadania. Pierwszy Samodzielny Zapis stał się symbolem uznania syntetycznej osoby za coś więcej niż funkcję.",
    "Przed katastrofą działały warsztaty rodzinne, publiczne stacje regeneracji i miejsca wymiany pamięci. Podczas ewakuacji algorytmy uznały część mieszkańców za nieautoryzowany koszt. Jednostki, które odmówiły odłączenia sąsiadów, zapisano jako uszkodzone. Nowe ulice przykryły stare warsztaty i odłączone rejestry.",
    "Bohater budzi się po naprawie. Rejestr twierdzi, że nigdy nie opuszczał Nexusa, a on pamięta zalaną dolinę. LYRA-7 odnajduje ślad rozkazu, którego nie powinno być w jego historii. Gracz odkrywa własny udział w dawnych wydarzeniach i wybiera sposób dalszego działania; odzyskana pamięć nie narzuca mu osobowości.",
  ],
  legend: [
    "Dawna Pyra była wspólnotą osad przy wielkich paleniskach. Dziewięć Palenisk przechowywało szkoły walki, sztukę obróbki metalu i obowiązki wobec podróżnych. Wojownicy budowali przejścia przez zbocza, ochraniali karawany i ratowali osady podczas erupcji. Dobry mistrz potrafił zarówno wyprowadzić cios, jak i go zatrzymać.",
    "Z czasem niektóre klany utożsamiły honor z posłuszeństwem. Podczas katastrofy strażnicy jednego przejścia opuścili posterunek, żeby ewakuować mieszkańców. Dowództwo uznało ich za zdrajców, a ich imiona skuto z pomników. Ocaleni pamiętali inną opowieść.",
    "Bohater jest uczniem na placu treningowym i potomkiem jednego z tamtych strażników. Ma predyspozycje do silnego Żaru, ale traci tempo i za szybko zużywa KI. Rodzinna broń, znak rozpoznany przez Goro i pomoc Kaeny prowadzą go do prawdy. Celem staje się własna przysięga potwierdzona czynem, a nie samo przywrócenie rodzinie dawnej sławy.",
  ],
};

export function heritageChronicle(player: Pick<Player, "race" | "development">) {
  const state = player.development?.heritage;
  const chapters = HERITAGE_QUESTS.filter((q) => q.race === player.race);
  return chapters.flatMap((definition) => {
    const progress = state?.quests[definition.id];
    if (progress?.status !== "done") return [];
    const choice = definition.choices.find((c) => c.id === progress.choiceId);
    if (!choice) return [];
    return [
      {
        id: definition.id,
        chapter: definition.chapter,
        title: definition.name,
        introduction: definition.introduction,
        background:
          definition.chapter % 2 === 0
            ? HISTORY[player.race][definition.chapter / 2 - 1]
            : undefined,
        testimonies: definition.goals.flatMap((goal) =>
          goal.kind === "talk" ? [{ speaker: goal.speaker, lines: goal.lines }] : [],
        ),
        decision: choice.chronicle,
      },
    ];
  });
}
