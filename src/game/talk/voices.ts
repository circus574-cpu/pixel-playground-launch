import type { BuildingId } from "../city/types";
import type { WorldId } from "../world/races";

/**
 * Głosy czterech przewodniczek (Aira, Sora, LYRA-7, Kaena) i fakty o usługach miasta. Fakty są wspólne dla ras i
 * odpowiadają temu, co gra naprawdę oferuje (sprawdza to test), a styl wypowiedzi zależy od kultury ras
 * (docs/RASY-I-POSTACIE.md, `raceLore.ts`). Nazwy budynków, dzielnice, opisy i kierunki pochodzą z danych świata.
 */

/** Co robi gracz w budynku, zgodnie z kodem gry. Używane, gdy dane świata nie mają własnego opisu (miasta poza stolicą). */
export const SERVICE_FACTS: Record<BuildingId, string> = {
  hall: "Tu przyjmiesz zadania, usłyszysz wieści z miasta i dowiesz się, dokąd pójść dalej.",
  shop: "Kupisz tu mikstury i wyposażenie, a zebrane materiały i łupy sprzedasz.",
  inn: "Tu odpoczniesz: za kilka monet odzyskasz całe życie i KI.",
  smithy: "Tu wytworzysz sprzęt i ulepszysz ostrze oraz pancerz.",
  depot: "Tu zostawisz rzeczy w osobistej skrzyni, w bezpiecznym miejscu.",
  arena: "Tu poćwiczysz na manekinie bez ryzyka, bez nagród, z prawdziwym KI i odnowieniami.",
};

export type TourVoice = {
  /** Powitanie, gdy przewodniczka dochodzi do gracza. */
  hello: (city: string, guide: string) => string[];
  /** Szósty fragment wstępu: jak działa oprowadzanie (można chodzić własnym tempem i przerwać). */
  rules: string;
  /** Zdanie ogłaszające kolejny budynek: numer 0–5 w kolejności zwiedzania. */
  frames: readonly ((name: string, where: string) => string)[];
  /** Jedno zdanie charakteru kultury o danym budynku (po opisie z danych świata). */
  flavor: Record<BuildingId, string>;
  /** Wołanie przy ruszaniu do następnego punktu. */
  follow: readonly string[];
  /** Gracz został daleko za przewodniczką. */
  nag: readonly string[];
  /** Gracz dogonił czekającą przewodniczkę. */
  resume: string;
  /** Ostatni punkt trasy: miejsce pierwszego zadania. */
  market: (label: string, where: string) => string[];
  outro: readonly string[];
  skipped: string;
  back: string;
  /** Odpowiedź, gdy gracz klika w przewodniczkę w trakcie oprowadzania. */
  busy: string;
};

const planetary: TourVoice = {
  hello: (city, guide) => [
    "Witaj w mieście „" + city + "”, wędrowcze! Jestem " + guide + ".",
    "Pokażę ci, gdzie co jest, żebyś nie błądził po zaułkach.",
  ],
  rules:
    "Idź własnym tempem, poczekam na ciebie. Gdy będziesz miał dosyć, kliknij „Pomiń oprowadzanie”.",
  frames: [
    (n, w) => "Zacznijmy od najbliższego: „" + n + "”, " + w + ".",
    (n, w) => "Dalej mamy „" + n + "”, " + w + ".",
    (n, w) => "Teraz „" + n + "”, " + w + ".",
    (n, w) => "Nie pomiń też „" + n + "”, " + w + ".",
    (n, w) => "Prawie skończyliśmy. „" + n + "”, " + w + ".",
    (n, w) => "I ostatnia z usług: „" + n + "”, " + w + ".",
  ],
  flavor: {
    hall: "U nas nikt nie zostaje sam z kłopotem, więc zaglądaj tam często.",
    shop: "Kupcy cenią uczciwy targ i dobre kły dzików.",
    inn: "Ciepła strawa i miękkie łóżko stawiają na nogi nawet po złym dniu.",
    smithy: "Kowal wie, że dobre żelazo lubi cierpliwą rękę.",
    depot: "Korzenie trzymają to, co powierzysz ziemi.",
    arena: "Tam nikt nie liczy twoich porażek, tylko uderzenia.",
  },
  follow: ["Chodź za mną!", "Tędy, wędrowcze.", "Za mną, to niedaleko.", "Idziemy dalej."],
  nag: [
    "Wędrowcze, poczekam na ciebie tutaj.",
    "Nie spiesz się, nie ucieknę. Podejdź, jak będziesz gotów.",
  ],
  resume: "Jesteś. Ruszamy dalej.",
  market: (label, where) => [
    "Na koniec „" + label + "”, " + where + ". To cel twojego pierwszego zadania.",
    "Przyjmiesz je u mnie, gdy skończymy: wystarczy, że ze mną porozmawiasz.",
  ],
  outro: [
    "To już całe miasto. Nie zgubisz się, a w razie czego mapa jest zawsze pod ręką.",
    "Porozmawiaj ze mną, gdy będziesz chciał usłyszeć to jeszcze raz.",
  ],
  skipped: "Rozumiem, pewnie wolisz poznać miasto sam. Gdybyś chciał, wróć do mnie.",
  back: "Wracam na swoje miejsce.",
  busy: "Idę przed tobą, wędrowcze. Chodź za mną.",
};

const sage: TourVoice = {
  hello: (city, guide) => [
    "Źródła witają cię w „" + city + "”. Jestem " + guide + ".",
    "Przejdziemy razem przez dzielnice, a ty zapamiętasz, gdzie co płynie.",
  ],
  rules: "Idź tak, jak ci służy. Woda poczeka. Jeśli wolisz iść sam, wybierz „Pomiń oprowadzanie”.",
  frames: [
    (n, w) => "Pierwsze źródło na drodze: „" + n + "”, " + w + ".",
    (n, w) => "Następnie „" + n + "”, " + w + ".",
    (n, w) => "Dalej ścieżka wiedzie do miejsca „" + n + "”, " + w + ".",
    (n, w) => "Zapamiętaj także „" + n + "”, " + w + ".",
    (n, w) => "Niemal u celu: „" + n + "”, " + w + ".",
    (n, w) => "Ostatnia z usług: „" + n + "”, " + w + ".",
  ],
  flavor: {
    hall: "Rada słucha każdego, kto przychodzi z pytaniem.",
    shop: "Zwoje i łupy, które zbierzesz po drodze, też znajdą tu nabywcę.",
    inn: "Przy herbacie umysł wraca do równowagi szybciej niż ciało.",
    smithy: "Pieczęć nie rani, tylko utrwala, co dobre w ostrzu.",
    depot: "Zwój, który spoczywa w archiwum, nie ginie.",
    arena: "Skupienie bez ryzyka uczy więcej niż pospieszna walka.",
  },
  follow: ["Chodź za mną.", "Tędy, spokojnie.", "Idź za strumieniem.", "Dalej."],
  nag: [
    "Zaczekam przy tym źródle, aż do mnie dojdziesz.",
    "Spokojnie. Nikt tu nie goni, podejdź, gdy będziesz gotów.",
  ],
  resume: "Dobrze, że jesteś. Idziemy.",
  market: (label, where) => [
    "Na koniec „" + label + "”, " + where + ". Tam prowadzi twoje pierwsze zadanie.",
    "Przyjmiesz je u mnie, gdy skończymy. Wystarczy rozmowa.",
  ],
  outro: [
    "Teraz znasz Sanktuarium. Reszta przyjdzie z krokami.",
    "Jeśli zapomnisz drogę, zapytaj mnie ponownie.",
  ],
  skipped: "Jak wolisz. Źródła i tak będą ci szemrać drogę. Zapytaj, jeśli zechcesz posłuchać.",
  back: "Wracam do źródeł.",
  busy: "Prowadzę cię, więc chodź za mną. Źródła poczekają.",
};

const android: TourVoice = {
  hello: (city, guide) => [
    "Synchronizacja zakończona. Witaj w mieście „" + city + "”. Jestem " + guide + ".",
    "Zapiszę w twojej pamięci położenie wszystkich węzłów usługowych.",
  ],
  rules:
    "Podążaj we własnym tempie. Poczekam. Aby przerwać procedurę, wybierz „Pomiń oprowadzanie”.",
  frames: [
    (n, w) => "Węzeł pierwszy: „" + n + "”, " + w + ".",
    (n, w) => "Węzeł drugi: „" + n + "”, " + w + ".",
    (n, w) => "Węzeł trzeci: „" + n + "”, " + w + ".",
    (n, w) => "Węzeł czwarty: „" + n + "”, " + w + ".",
    (n, w) => "Węzeł piąty: „" + n + "”, " + w + ".",
    (n, w) => "Węzeł szósty, ostatni usługowy: „" + n + "”, " + w + ".",
  ],
  flavor: {
    hall: "Jeśli się zagubisz, wróć tam i zapytaj o kolejny krok.",
    shop: "Wymiana działa bez targowania, bo ceny są stałe i uczciwe.",
    inn: "Pełna regeneracja trwa krócej niż przeciętna rozmowa.",
    smithy: "Tolerancje wykonania są tam węższe niż twój włos.",
    depot: "Magazyn nie gubi niczego: każda sztuka ma swój znacznik.",
    arena: "Wyniki kalibracji nie wpływają na nic poza twoją wiedzą.",
  },
  follow: ["Podążaj za mną.", "Kolejny węzeł. Za mną.", "Trasa obliczona. Idziemy."],
  nag: [
    "Sygnał słabnie. Czekam na twoją pozycję.",
    "Wstrzymuję procedurę, aż znajdziesz się w zasięgu.",
  ],
  resume: "Sygnał odzyskany. Kontynuuję.",
  market: (label, where) => [
    "Punkt końcowy trasy: „" + label + "”, " + where + ". To cel twojego pierwszego zadania.",
    "Zadanie przypiszę ci po zakończeniu procedury, na twoją prośbę w rozmowie.",
  ],
  outro: [
    "Oprowadzanie zakończone. Mapa miasta jest zapisana także w twojej pamięci.",
    "Mogę powtórzyć procedurę na żądanie.",
  ],
  skipped: "Procedura przerwana na twoje życzenie. Mogę ją wznowić w każdej chwili.",
  back: "Wracam na stanowisko.",
  busy: "Procedura trwa. Podążaj za mną.",
};

const legend: TourVoice = {
  hello: (city, guide) => [
    "Witaj w mieście „" + city + "”, wędrowcze. Nazywam się " + guide + ", strażniczka przysięgi.",
    "Pokażę ci ogniska i kuźnie twierdzy, zanim zażądają od ciebie pierwszej przysięgi.",
  ],
  rules:
    "Idź własnym krokiem, a ja ci nie umknę. Dość tych opowieści? Wybierz „Pomiń oprowadzanie”.",
  frames: [
    (n, w) => "Pierwsze ognisko: „" + n + "”, " + w + ".",
    (n, w) => "Potem „" + n + "”, " + w + ".",
    (n, w) => "Dalej „" + n + "”, " + w + ".",
    (n, w) => "Nie pomiń „" + n + "”, " + w + ".",
    (n, w) => "Blisko końca: „" + n + "”, " + w + ".",
    (n, w) => "I ostatni z klanowych progów: „" + n + "”, " + w + ".",
  ],
  flavor: {
    hall: "Tu przysięga ma wagę większą niż ostrze.",
    shop: "Klany płacą za kły i pancerze, a słowo przy targu jest twarde jak stal.",
    inn: "Przy ognisku nawet zmęczony wojownik odzyskuje żar.",
    smithy: "Ogień szczelin hartuje ostrze tak, że pamięta swego pana.",
    depot: "Skarbiec klanu nie zna zdrady, tylko klucz.",
    arena: "Plac nie wybacza lenistwa, ale też nie karze za błędy.",
  },
  follow: ["Za mną!", "Idź za żarem.", "Naprzód, wędrowcze.", "Tędy."],
  nag: [
    "Stanę tu i zaczekam. Pamiętaj: wojownik nie zostaje w tyle.",
    "Nie biegnę za tobą, więc podejdź, jak będziesz gotów.",
  ],
  resume: "Dobrze. Idziemy dalej.",
  market: (label, where) => [
    "Na koniec „" + label + "”, " + where + ". Tam zaprowadzi cię pierwsza próba.",
    "Przyjmiesz ją u mnie, gdy skończymy. Wystarczy, że ze mną porozmawiasz.",
  ],
  outro: [
    "Znasz już Twierdzę. Reszta należy do ciebie i twojej przysięgi.",
    "Zapytaj mnie, gdy zechcesz usłyszeć to jeszcze raz.",
  ],
  skipped: "Jak chcesz. Twierdza i tak cię pozna. Wróć do mnie, jeśli zmienisz zdanie.",
  back: "Wracam na posterunek.",
  busy: "Prowadzę cię, więc nie zostawaj w tyle.",
};

export const TOUR_VOICES: Record<WorldId, TourVoice> = {
  verdant: planetary,
  aether: sage,
  nexus: android,
  pyra: legend,
};
