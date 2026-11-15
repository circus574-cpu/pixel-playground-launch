import { getNpcDialogue } from "../dialogue";
import type { WorldNpc } from "../world/types";

/** Co postać mówi na dzień dobry, gdy brak własnego zdania w danych świata i w katalogu rozmów (domyślne dla roli). */
export function roleGreeting(
  role: WorldNpc["id"],
  world: { market: { instruction: string } },
  authoritative: boolean,
): string | undefined {
  return {
    guide:
      "Witaj, wędrowcze. Klikaj ziemię, aby iść. Na telefonie możesz też przeciągać palcem w lewym dolnym obszarze. " +
      world.market.instruction +
      ". Szukaj złotego znacznika ◆ Rynek albo użyj przycisku Podejdź do rynku. Potem wróć do mnie po nagrodę.",
    hunter:
      "Dziki krążą przy wschodniej drodze i na zachód od rynku. Przyjmij zadanie, pokonaj trzy i wróć. Kliknięcie dzika uruchamia podejście i autoatak. Skróty 1–9, 0 i Q odpowiadają przyciskom na dole; spacja to atak podstawowy.",
    merchant:
      "U mnie kupisz mikstury i pancerz. Płacę za kły dzików. " +
      (authoritative
        ? "Monety i przedmioty zapisuje serwer gry."
        : "Monety i przedmioty pozostaną na tym urządzeniu po odświeżeniu."),
    smith:
      "Ren daje ostrze za obronę wioski. Przyjmij u mnie zadanie, załóż je w ekwipunku i wróć. Za 15 monet mogę też raz ulepszyć założone ostrze o 4 ataku.",
    keeper: "Twoja skrzynia jest w depozycie.",
    trainer: "Trenuj na manekinie.",
    innkeeper: "Odpocznij w gospodzie.",
    steward: "Poznaj dzielnice miasta.",
    alchemist:
      "Witaj w pracowni zielarskiej i alchemicznej. Warzę mikstury zdrowia, regenerujące eliksiry energii KI oraz odtrutki zebranych w terenie surowców.",
    warden:
      "Stoisz przed leżem regionalnego bossa. Przed wejściem upewnij się, że posiadasz odpowiedni ekwipunek i znasz taktykę walki.",
  }[role];
}

/**
 * Kwestie postaci po zagadnięciu: autorskie zdanie ze świata wygrywa (ta sama postać bywa przypisana do dwóch ról, a
 * katalog nie rozróżnia ich kontekstem), potem powitanie z katalogu, które zmienia się z kolejnymi rozmowami.
 */
export function greetingLines(
  npc: WorldNpc,
  turn: number,
  world: { market: { instruction: string } },
  authoritative = false,
): string[] {
  const catalogue = getNpcDialogue(npc.dialogueId ?? "");
  const first =
    npc.dialogue ?? catalogue?.greetings[0] ?? roleGreeting(npc.id, world, authoritative) ?? "";
  const second = catalogue ? catalogue.greetings[turn % catalogue.greetings.length] : undefined;
  return [first, second].filter((l, i, all): l is string => !!l && all.indexOf(l) === i);
}

/** Pożegnanie rzucane za graczem, który odszedł od rozmówcy. */
export const FAREWELL = "Do zobaczenia.";
