# Zielona Przystań — funkcjonalne miasto Planetarnych, 23.10.2026

Gałąź: `feature/verdantia-functional-city-20261023`. Baza: `f443013d68fffe4088a25ffc7974cb5cfee7004b`.
Zakres właściciela: jedno przestronne miasto, funkcjonalne wnętrza, NPC, handel,
kowal, osobisty depozyt i trening. Bez scalania i publikacji.
Podział z Claude’em: [wspólny kontrakt](CITY-INTEGRATION-CONTRACT-2026-10-23.md).

## Miasto i usługi

Verdantia ma sześć rozdzielonych budynków: sklep Mio, Dom Wspólnoty Orena,
gospodę Liny, kuźnię Taro, Depozyt Korzeni Neli i arenę Iwa. Aira i Ren pozostają
na ulicach. Drzwi dzieli co najmniej 700 jednostek; każda usługa ma nazwę,
dzielnicę i dostęp z planu miasta. Kliknięcie usługi prowadzi postać do drzwi.

`city/verdantia.ts` wyprowadza układ z dotychczasowego lasu: zachowuje źródłowy
`forest-map.json`, rzekę, most i fontannę, odsuwa kolidujące drzewa, dodaje ulice
oraz sześć osobnych parceli. Minimapę generuje `scripts/city/build-minimap.ts`
z rzeczywistych dróg, obiektów i rzeki. Atlas i geometria globusa nie zmieniają się;
zmienia się etykieta osady Planetarnych.

Każdy budynek ma osobne wnętrze z lokalnymi współrzędnymi, kolizjami ścian
oraz mebli. NPC usługi występuje tylko w odpowiednim pomieszczeniu. Wyjście
wraca przed właściwe drzwi; polecenie odwiedzenia innego NPC prowadzi przez wyjście.
Wnętrze i pozycja postaci odtwarzają się po przeładowaniu.

W tym etapie cała Verdantia jest bezpieczna: brak potworów i dzików, również
przy zachowanych starych danych spawnów. Pozostałe trzy regiony zachowują walkę.
Nowe spawny poza miastami stanowią późniejsze zadanie.

## Ekonomia i trening

- Sklep kupuje/sprzedaje dotychczasowe przedmioty; kowal ulepsza miecz i obsługuje zadanie ekwipunku.
- Wprowadzenie Airy daje jednorazowo 40 XP i 40 złota. Nowe postacie nie muszą
  zabijać dzików w mieście, aby kupić miecz. Zachowane stare zadanie łowieckie
  nie znika z zapisu; wcześniej spełnione zadanie można rozliczyć.
- Gospoda odnawia HP/KI za 5 złota, bez resetowania cooldownów. Pełne zasoby nie powodują opłaty.
- Manekin przyjmuje rzeczywiste zdolności, koszty KI i cooldowny. Licznik mierzy
  bezpośrednie trafienia/obrażenia przy zerowej obronie. Nie daje XP, złota ani
  łupu, nie ma AI i nie atakuje. Nie symuluje pełnych efektów kontroli ani obrażeń okresowych.

## Depozyt i zapis

Zapis v5 dodaje wnętrze i zawartość skrzyni do istniejącego slotu postaci.
Wersje 1/3/4 nadal się wczytują; surowy zapis przed migracją trafia do kopii
`ki-legends:recovery:before-v5:<klucz>`. Historyczne kopie v4 pozostają zachowane.
Ochrona uszkodzonych/nowszych zapisów oraz konfliktów między kartami pozostaje aktywna.

Skrzynię trzeba otworzyć przy meblu w depozycie. Operacje sprawdzają ilość,
własność, limit 99 sztuk i do 30 rodzajów materiałów; nie zostawiają częściowych
zmian przy błędzie. Ostatnia wyposażona sztuka nie może opuścić plecaka.
Ulepszenie miecza przenosi się z ostatnią sztuką, bez kopiowania flagi.
Depozyt jest lokalny dla postaci, przeglądarki i domeny; nie jest bankiem sieciowym.
Nie zmieniono Supabase ani zabezpieczeń `/test`.

## Grafika i pochodzenie

Dodano autorskie, programowo narysowane SVG sześciu mebli i dwóch podłóg,
bez zewnętrznych obrazów referencyjnych i bez checkpointów. Są to proste grafiki
użytkowe wnętrz, odrębne od istniejących malowanych fasad. Źródła i generator:
`deliveries/city-interiors-1.0.0/`, `scripts/city/build-interior-art.py` i `.ts`.
WebP eksportowano bezstratnie i zainstalowano walidowanym importerem.
[Potwierdzenie importu](qa/verdantia-city-20261023/asset-import.txt).
Nie uruchamiano GPU ani generatora obrazów.

[Rejestr nowych zasobów z SHA-256](licenses/city-assets-20261023.json) odtwarza
`scripts/city/record-licenses.ts`. Zapis autorstwa i procesu nie jest niezależną
opinią prawną. Nierozstrzygnięte prawa istniejących grafik pozostają opisane
w [głównym rejestrze](ASSET-LICENSE-REGISTER.md).

## Weryfikacja i ograniczenia

Testy jednostkowe sprawdzają osiągalność sześciu drzwi, przejścia, kolizje,
izolację usług, bezpieczeństwo miasta, ekonomię, depozyt, migracje i zachowaną
walkę poza Verdantią. Testy przeglądarkowe wykonują rzeczywiste wejścia, handel,
przeładowanie depozytu oraz trening na desktopie i telefonach w obu orientacjach.
Osobny test Software WebGL porównuje liczbę obiektów/tekstur i oszacowanie pamięci
po powrotach z wnętrza. Wyniki końcowego SHA należy odczytać z raportu QA/PR.

Nie wykonano odbioru właściciela, testu na fizycznym telefonie ani długiej sesji.
Kolejne miasta i przyszłe spawny zewnętrzne pozostają osobnymi zadaniami.
