# KI Legends — licencje i pochodzenie

Aktualizacja układu: 23.10.2026. Nie wykonano nowej opinii prawnej i nie zmieniono
statusów plików przez samą segregację. Rejestry indywidualne mają komplet pól:
ścieżka, autor/generator, źródło, licencja, podstawa komercyjna, dowód i status.

| Dane i dowody                      | Pełny rejestr                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Grafiki i modele z audytu 22.10    | [JSON](licenses/asset-inventory.json), [CSV](licenses/asset-inventory.csv)                                         |
| Cztery malowane rasy               | [Aneks indywidualny](licenses/four-painted-races-20261022.json)                                                    |
| Nowe meble/podłogi/minimapa miasta | [Aneks indywidualny](licenses/city-assets-20261023.json)                                                           |
| Zależności package-lock            | [Wszystkie ścieżki i SRI](licenses/dependencies/register.json)                                                     |
| Dowody uzupełniające               | [Supplemental](licenses/dependencies/supplemental.json), [source receipts](licenses/evidence/source-receipts.json) |
| Notices                            | [Pełne teksty](licenses/THIRD-PARTY-NOTICES.txt), `licenses/dependencies/texts/`                                   |
| Podsumowanie liczbowe              | [audit-summary.json](licenses/audit-summary.json)                                                                  |

Nie powielamy tysięcy wierszy tych samych danych w Markdown. JSON/CSV zachowują
indywidualne rekordy i hashe, także wtedy, gdy opis historycznej ścieżki prowadzi
obecnie do [datowanego katalogu dowodów](zmiany/2026-10-23/segregacja.json).

## Grafiki i modele — ustalenia audytu 22.10

Audyt dotyczył bazy `d9599277924e6c3f1ce99b43e2a1b20654b42c22`;
nie jest automatycznie inwentaryzacją wszystkich nowszych dostaw.

## Wniosek i znaczenie dowodów

**Brak podstaw do uznania całej biblioteki grafik za oczyszczoną licencyjnie.**
Najważniejsze nierozstrzygnięcia: oryginalne ilustracje PDF i ich pochodne,
pełne prawa do wyglądu Mędrców/Planetarnych, historia atlasu i grafik Lovable,
oryginały `cover.png`/`test-background.png`, dokładna licencja checkpointu DreamShaper.
Nie jest to twierdzenie o naruszeniu praw; jest to wskazanie brakujących dowodów.

Rozróżniamy: **tożsamość bajtów**, **pochodzenie techniczne**, **tekst licencji**,
**uprawnienie konkretnego podmiotu do konkretnego wykorzystania**. Commit, prompt,
manifest, aprobata wyglądu, upload właściciela, licencja programu oraz etykieta SPDX
nie są zamienne z dowodem praw do obrazu. Nie przypisano automatycznie MIT ani CC0
całemu projektowi. Sam root `package.json` nie ustanawia licencji biblioteki grafik.

Dowód od zewnętrznego wydawcy przypisany do dokładnego pliku/wersji ma większą wagę
niż opis w repo. Zarchiwizowane warunki usług z dnia audytu nie dowodzą, że właśnie
te warunki i to konto obejmowały historyczną generację. Hashe w LFS oznaczają
oczekiwany obiekt: plików binarnych wskazywanych przez pointery nie pobierano w tym
audytowaniu. Nie powtórzono historycznych pomiarów na GPU. Tabela i JSON mówią,
które hashe odczytano teraz, a które są tylko pointerem/raportem/deklaracją.

## 1. PDF i oryginalne referencje

Oryginał `docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf`
**jest w repozytorium** (5 343 097 B, 12 stron). `pdfimages -j` pozwolił odczytać 11 wystąpień obrazów, **10 unikalnych JPEG**.
Obraz Legendy jest powtórzony na okładce i stronie 7. Wszystkie wystąpienia,
numery stron/obiektów, hashe i powiązania są w
[pdf-images.json](licenses/evidence/pdf-images.json).

Potwierdzono SHA-256 identycznych strumieni JPEG:

| Rasa       | Strona PDF    | Oryginał w repo                                      | SHA-256                                                            |
| ---------- | ------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Planetarni | 4             | `public/game/assets/stage3/references/planetary.jpg` | `c9153912519f69f16431e1be21e0a955c5a27889f4c90673a5b1a2b7342ce1a4` |
| Mędrcy     | 5             | `public/game/assets/stage3/references/sage.jpg`      | `a0f3faab56a789e45661e076af18a2b73ed96856090626da33be05151d8de9b4` |
| Androidy   | 6             | `public/game/assets/stage3/references/android.jpg`   | `86bbfebf312938388aa1d7623d279fab293da2d819422981790e122bc88b766a` |
| Legendy    | 7 i okładka 1 | `public/game/assets/stage3/references/legend.jpg`    | `e1c9c27298b82250731b8a38eb78024834597b71b8312f52e5e00127797a77ba` |

`origins-v1/*-{480,960,full}.webp` to kadry/resize tych ilustracji (kod:
`scripts/prepare_stage31_art.py`), **nie nowe niezależne generacje**.
Pozostałe sześć oryginalnych ilustracji też pozostaje bez ustalonego autora/licencji.
Zdanie w PDF „dziesięć ilustracji przekazanych przez autora” nie identyfikuje
uprawnionego autora ani nie udziela licencji na komercję/adaptacje.

Potrzebne dla każdego pierwowzoru: nazwisko/pseudonim i kontakt uprawnionego,
oryginał lub stabilny URL z datą, umowa albo tekst licencji przypisany do obrazu,
zakres komercyjnej dystrybucji i opracowań, sublicencji dla gry, obowiązki atrybucji,
ewentualne ograniczenia terytorium/czasu oraz prawa do postaci/znaków osób trzecich.
Jeśli to generacja: zapis sesji, konto/uprawniony użytkownik, warunki z tej daty,
wejściowe referencje i prawa do nich. Nie wystarcza nowe oświadczenie bez dokumentów
źródłowych; powinno wskazywać sprawdzalny łańcuch praw.

PDF zawiera dwa osadzone podzbiory DejaVuSans/DejaVuSans-Bold. Z ich faktycznej
tabeli `name` odczytano pełne warunki Bitstream Vera/Arev i copyrighty;
DejaVu changes są opisane jako public domain. To odrębny, pozytywny dowód licencji
fontów, **nie ilustracji**. Zachować [PDF-FONT-NOTICES.txt](licenses/evidence/PDF-FONT-NOTICES.txt)
przy dystrybucji fontów/PDF; uwzględnić ograniczenia nazw, sprzedaży samych fontów
i reklamowego użycia nazw autorów. Helvetica jest nieosadzona (brak kopii fontu
w pliku); nie wyciągamy z samej nazwy prawa do dystrybucji jej binariów.

## 2. Mędrcy

`painted-design-provenance.json` deklaruje `image_gen`, malowane widoki
referencyjne i deformację siatki w Blender/CUDA. Ten dokument sam nie dowodzi
praw do ilustracji Mędrca. `owner_approved_eight_base_views=true` dotyczy odbioru
wyglądu, a nie udzielenia licencji. Pochodne nie usuwają praw pierwowzoru.

Dwa atlasy runtime są obecne w `public/game/assets/gpu/hero-sage/…`.
Osiem ścieżek `masters-grounded/*.png` z hashami wskazanymi w provenance **nie
istnieje w tej gałęzi**: wpisano je indywidualnie jako `DECLARED_ABSENT`.
Historyczne 416 klatek i sceny z PR #11 nie zostały przeniesione na tę gałąź
w ramach tego audytu; nie deklarujemy inspekcji ich bajtów ani kompletności
zewnętrznego archiwum. Należy zabezpieczyć źródła i przypisać licencje do nich.
MakeHuman i TripoSR są wymienione jako odrzucone piloty; licencja pilota nie jest
licencją finalnej malowanej postaci. Zgoda na rozpoczęcie animacji nie zastępuje
zgody autora pierwowzoru na opracowanie i wykorzystanie komercyjne.

## 3. Planetarni i modele GPU

`planetary-master.json` wskazuje img2img z `origins-v1/planetary-full.webp`,
seed 5741001, workflow ComfyUI i dokładny checkpoint Animagine. Techniczny
łańcuch jest opisany, lecz referencja prowadzi do nadal niewyjaśnionego JPEG z PDF.
Cytat „Jest dobrze startuj…” jest decyzją produkcyjną, nie umową licencyjną.
416 klatek, źródło mastera i `.blend` są identyfikowane pointerami LFS; odróżniono
ich OID od hashy aktualnie odczytanych bajtów. Atlasy runtime są plikami lokalnymi.

**MakeHuman:** odczytano z publicznego upstream dokładny commit
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482` i porównano SHA-256 sześciu plików
bazy oraz `LICENSE.ASSETS.md`: **7/7 zgodne** z manifestem. Licencja CC0-1.0
dotyczy tych danych siatki/rigów/targetów. Nie przenosi się na strój, włosy,
ilustrację wejściową, master, wszystkie outputy ani aplikację MakeHuman.
Dowody: [source-receipts.json](licenses/evidence/source-receipts.json).

**Animagine XL 3.1:** przypięta karta
`cagliostrolab/animagine-xl-3.1@483f0c322568ed13697ed01dd0be07204746d12b`
wskazuje CreativeML Open RAIL++-M i odsyła do licencji bazowego SDXL.
Odczytano kartę oraz pełny tekst wskazanej licencji. Lokalny `MODEL_LICENSE.txt`
różni się od pobranego tekstu białymi znakami; nie deklarujemy identycznego SHA.
Dokument rozróżnia zgodę na używanie modelu, ograniczenia użycia oraz output.
Licencjodawca nie deklaruje praw do wygenerowanego outputu; użytkownik odpowiada
za jego wykorzystanie. To nie jest gwarancja nienaruszania praw osób trzecich.
Przy przekazywaniu wag/derywatów modelu obowiązują m.in. kopia licencji,
zachowanie notices, oznaczenie zmian i przekazanie ograniczeń użycia.
Nie należy automatycznie traktować samego WebP jako redystrybucji wag.
Nie pobierano wielogigabajtowego checkpointu: jego SHA w rejestrze pochodzi
z historycznego raportu, nie bieżącego readbacku.

**DreamShaper XL Turbo 2.1:** raport identyfikuje nazwę, rozmiar i SHA checkpointu,
ale nie ustala przypiętego źródła i licencji tego dokładnego pliku. Status:
`BRAK_LICENCJI_DOKLADNEGO_CHECKPOINTU`. Nie przypisano mu licencji Animagine
ani zgadywanej wersji repo Lykon. Wymagane źródło/wersja i warunki pobrania/wykorzystania.
Brak dowodu, że ten checkpoint wygenerował którąkolwiek konkretną grafikę tutaj.

## 4. Atlas i globus Lovable

Osiem plików `src/assets/planet-map/` rozpatrzono oddzielnie.
`atlas-1920.webp` i `atlas-3840.webp` nie mają załączonego źródłowego dowodu
autorstwa/licencji. `globe-color-*`, `globe-surface-*`, `globe-lights-*` to
pochodne atlasu z `scripts/build_globe_textures.py` i dziedziczą jego status.
`globe-clouds-2048.webp` i `space.jpg` są **opisane w dokumentacji** jako wygenerowane
narzędziem obrazów Lovable; brak logu konkretnej generacji, wejść, modelu i konta.
Autor commita Lovable/bot jest dowodem dodania pliku do Git, nie autorstwa obrazu.

Zachowano publiczne warunki Lovable z dnia audytu. Mówią o własności Customer Data
i AI Output „as between us”, z zastrzeżeniem praw osób trzecich; nie gwarantują
unikalności ani braku cudzych praw. Nie dowodzi to warunków konkretnej historycznej
sesji ani tego, czy plik został wygenerowany, wgrany lub pochodził od osoby trzeciej.
Potrzebne: eksport historii generacji/uploadu, źródła, daty, konto i właściwa
umowa/warunki. Shadery i biblioteka three.js mają osobny status kodu; ich licencja
MIT nie obejmuje automatycznie tekstur planety.

## 5. cover.png i test-background.png

W repo są **tylko deskryptory**, nie binaria tych dwóch obrazów:

| Obraz                 | Deskryptor                                  | Asset ID                               | Deklarowany rozmiar | Data metadanych      |
| --------------------- | ------------------------------------------- | -------------------------------------- | ------------------- | -------------------- |
| `cover.png`           | `src/assets/cover.png.asset.json`           | `025eb219-7762-413d-996d-135177dfb346` | 2 507 283 B         | 2026-10-19T14:50:25Z |
| `test-background.png` | `src/assets/test-background.png.asset.json` | `f594fa76-0e3c-43c4-8313-b7b7ccf85a4c` | 2 425 567 B         | 2026-10-19T15:07:35Z |

`r2_key`, URL `/__l5e/assets-v1/…`, nazwa i data określają obiekt magazynu,
nie autora/generator ani licencję. Nie odczytywano prywatnego Storage, nie obchodzono
sesji `/test`, nie wysyłano obrazów do zewnętrznych viewerów. Nie podano zmyślonych
hashy oryginałów. Wymagane: oryginalne pliki, ich SHA-256, źródło/generacja,
umowa lub licencja, prawa do wejściowych referencji oraz dopuszczalne użycie
jako okładki/tła i w marketingu. Oba statusy: `BRAK_DOWODU_PRAW`.

## 6. Inne zasoby i zakres

Włączono archiwalne forest-v3/v1/v2, kandydatów anime, proceduralne SVG,
rig techniczny, favicon oraz zrzuty QA. Pliki archiwalne/preview też mogą być
redystrybuowane przez Git/hosting — brak użycia w aktualnej scenie nie usuwa
obowiązków. Zrzuty QA i kompozycje dziedziczą prawa widocznych grafik.
Prompty i manifesty OpenAI są dowodem opisanego procesu, nie odrębną licencją.
Proceduralne SVG mają odtwarzalny kod; prawo do wkładów/umów autora jest odrębne.
Favicon i dawne koncepcyjne SVG nie mają ustalonego źródła/licencji.

Pełny zakres to pliki śledzone w bazie i jawnie wskazane źródła zewnętrzne.
Nie twierdzimy, że obejmuje niewidoczne pliki prywatnego bucketu, wszystkie
historyczne gałęzie, kompletny dysk GPU ani całą bibliotekę plików właściciela.
Zależności npm, ich vendored notices i natywne biblioteki opisuje
[LICENCJE.md](LICENCJE.md).

## 7. Dalsze dokumenty wymagane do rozstrzygnięcia

1. Właściciel: zebrać pierwotne źródła i sprawdzalne dokumenty praw dla dziesięciu
   ilustracji PDF oraz dwóch obrazów z deskryptorów; wskazać licencjodawcę i zakres.
2. Osoba prowadząca grafikę: powiązać master/reference/output i sesje generacji
   dla obu bohaterów oraz atlasu/chmur/kosmosu z prawami do wejść i warunkami usługi.
3. Opiekun archiwum GPU: dostarczyć źródła Mędrca i przypiętą licencję dokładnego
   DreamShaper; nie jest to zlecenie uruchomienia/zmiany stanu GPU.
4. Opiekun wydania: zamknąć luki notices zależności, źródeł LGPL/MPL i biblioteki
   natywne; ustalić rzeczywisty skład dystrybuowanych artefaktów. Gotowe teksty
   pomocnicze w docs nie oznaczają ich opublikowania w aplikacji.
5. Dopiero po weryfikacji dowodów zmienić status konkretnego zasobu; nie zamieniać
   wszystkich wierszy na „OK” na podstawie jednego oświadczenia lub licencji narzędzia.

## Zależności i notices — zakres audytu lockfile

Audyt 22.10.2026 na bazie `d9599277924e6c3f1ce99b43e2a1b20654b42c22`.
Źródło zakresu: dokładny `package-lock.json` (lockfileVersion 3), wszystkie
zależności pośrednie, dev, opcjonalne i warianty platform; bez instalowania
ani uruchamiania pobranych paczek. **To rejestr lockfile, nie potwierdzony SBOM
końcowego bundle klienta/serwera/kontenera.** Etykieta `dev` nie dowodzi sama,
że kod nie trafił do dystrybuowanego narzędzia lub obrazu.

## Jak sprawdzono dowody

Każdą archiwalną paczkę pobrano z `resolved` albo odczytano z cache i sprawdzono
jej bajty względem SRI z lockfile. Zgodność metadanych nazwy/wersji sprawdzono
z uwzględnieniem aliasu `h3-v2` → `h3`; nie pomylono go z innym wydaniem.
Zachowano pełne legal files i hashe, nie sam tag `license`. Pole autora w
package.json pozostaje deklaracją wydawcy, nie niezależnym audytem autorstwa.

`SRI_AND_LEGAL_TEXT` oznacza znaleziony tekst w dokładnej paczce,
**nie automatyczne uznanie wszystkich praw za wyjaśnione**. Wewnętrzne notices
mogą nakładać więcej obowiązków niż pojedyncze SPDX w lockfile (np. Lucide/Feather,
Phaser/Matter.js, victory-vendor/D3). `SRI_NO_LEGAL_TEXT` pozostaje widoczne,
nawet gdy zebrano dokument pomocniczy upstream.

Dla braków odczytano metadane konkretnego wydania npm, sprawdzono zgodność
`dist.integrity` i użyto przypiętego `gitHead` z deklarowanego repozytorium.
Dowody uzupełniające mają osobny plik/status. Nie zastąpiono brakującego wydania
licencją z przypadkowego `main/master`, nie logowano się do prywatnych repozytoriów.
Brak publicznego tekstu nie oznacza automatycznie zakazu ani zgody — pozostaje luką.

## Wymagane notices i działania

| Licencja / przypadek                       | Wymaganie przy odpowiedniej dystrybucji                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT, ISC, BSD-2-Clause                     | Zachować pełny copyright, permission/license i disclaimer; BSD także dla binariów w dokumentacji/innych materiałach. Nie wystarcza napis „MIT”.                                                                                                                                       |
| BSD-3-Clause                               | Jak BSD-2 oraz nie sugerować poparcia autorów/organizacji.                                                                                                                                                                                                                            |
| Apache-2.0                                 | Kopia licencji, zachowanie notices/atrybucji, przekazanie istniejącego NOTICE tam, gdzie dotyczy, oznaczenie zmienionych plików; warunki patentowe. Nie wymyślać NOTICE, którego wydawca nie dostarczył.                                                                              |
| MPL-2.0 (np. lightningcss i warianty)      | Notices i dostępność Source Code Form pokrytych plików przy dystrybucji Executable Form; informacja jak uzyskać źródła. Copyleft dotyczy pokrytych plików, nie automatycznie całego projektu. Ustalić zmiany i faktyczny artefakt.                                                    |
| LGPL-3.0-or-later oraz złożone AND w sharp | Teksty GPL/LGPL, copyright i notices, odpowiedni dostęp do Corresponding Source, warunki modyfikacji/relinkowania lub wymiany biblioteki i dozwolonego reverse engineering do debugowania zmian. Sposób spełnienia zależy od dystrybucji/łączenia; sama lista licencji nie wystarcza. |
| Natywne payloady libvips                   | Własne notices komponentów: m.in. Cairo MPL-1.1, AOM BSD + patent license, FreeType FTL, fontconfig, libpng, libtiff, mozjpeg IJG/zlib/BSD, LGPL biblioteki. To dodatkowy zakres poza SPDX pakietu npm; patrz README/versions z archiwów.                                             |
| CC-BY-4.0 (`caniuse-lite`)                 | Przy udostępnianiu materiału zachować wskazanego autora/źródło, link/licencję, istniejące notices i oznaczenie zmian. Sam tekst CC bez informacji o materiale/atrybucji nie zamyka obowiązku. Ustalić czy dystrybuowane dane trafiają do artefaktu.                                   |
| Python-2.0 (`argparse`)                    | Zachować pełne notices i kolejne licencje historyczne dostarczone w paczce; przy pochodnych spełnić wymóg krótkiego opisu zmian, jeżeli ma zastosowanie.                                                                                                                              |
| BlueOak-1.0.0                              | Zachować copyright i tekst licencji albo wskazany w niej dopuszczalny link przy przekazaniu kopii.                                                                                                                                                                                    |
| MIT AND ISC (`victory-vendor`)             | Spełnić oba zestawy i zachować notices vendored D3. AND nie oznacza wyboru jednej licencji.                                                                                                                                                                                           |
| `lucide-react` (lock: ISC)                 | Pełna paczka zawiera też MIT dla części Feather, Cole Bemis; zachować oba teksty i odpowiednie copyrighty.                                                                                                                                                                            |
| 0BSD, Unlicense                            | Brak ogólnego wymogu atrybucji jak w MIT; zachować teksty w konserwatywnym pakiecie i sprawdzić pozostałe komponenty.                                                                                                                                                                 |

Wersje GNU LGPL/GPL oraz notices **konkretnych bundled bibliotek** trzeba powiązać
z dystrybuowanym binarium, nie tylko skopiować ogólną licencję GNU. Dane `versions.json`
są dowodem wersji wymienionych w paczce, nie kompletnym źródłem ani gotowym source offer.
Nie uznano skryptów Apache repo `sharp-libvips` za licencję LGPL jego binariów.

[THIRD-PARTY-NOTICES.txt](licenses/THIRD-PARTY-NOTICES.txt) zawiera konserwatywny
zestaw wszystkich rzeczywiście zebranych tekstów z przypisaniem paczek/źródeł
(zakres szerszy niż klient WWW). To materiał do dołączenia do odpowiedniej dystrybucji,
**nie deklaracja zakończenia compliance**. Nie dodano odnośnika w UI ani niczego
nie opublikowano. Nie rozstrzygnięto ostatecznego SBOM/deployu, pełnego source offer
LGPL/MPL ani niezebranych notices komponentów natywnych. Do uzupełnienia także
upstreamy bez legal text i prawa aplikacji/grafik z osobnego rejestru.

## Dowody i odtwarzanie

- [register.json](licenses/dependencies/register.json): 1 rekord na ścieżkę lockfile,
  adres archiwum, SRI, SHA-256 archiwum, metadane i pliki prawne z hashami.
- [supplemental.json](licenses/dependencies/supplemental.json): źródła uzupełniające,
  immutable gitHead i jawne błędy/braki; zachowano również ostrzeżenie o zakresie libvips.
- `scripts/licenses/collect_dependencies.py`: zebranie paczek bez uruchamiania ich kodu.
- `scripts/licenses/collect_supplemental.py`: uzupełnienie legal text z powiązanego upstream.
- `scripts/licenses/collect_source_evidence.py`, `collect_assets.py`: dowody zasobów.
- `scripts/licenses/render_registers.py`: offline render obu rejestrów i notices.
- Wymagania narzędzi audytu: Python 3, Poppler (`pdfimages`), PyMuPDF i fontTools
  do analizy fontów PDF; nie są nowymi zależnościami runtime gry.

## Aneks — cztery malowane rasy z dostawy Claude’a, 22.10.2026

Dostawa `83d4c06b91bb34e0d3353f31e9574bfffc6d7de9` i nowa integracja dodają
zasoby spoza historycznego spisu 729 wpisów powyżej. Indywidualne ścieżki, hashe,
rozmiary, deklarowane narzędzia i nierozstrzygnięcia praw są w
[osobnym rejestrze](licenses/four-painted-races-20261022.json).
[Raport integracji](RASY-I-POSTACIE.md) rozdziela
walidację techniczną od odbioru estetycznego i komercyjnych uprawnień.
Nie przypisano nowym aktorom licencji CC0 MakeHuman ani pochodzenia OpenAI
ze starszego Mędrca: nowe paczki bazują na malowanych widokach Animagine,
ControlNet, IP-Adapter i deformacji siatki. Prawa do referencji i outputu,
licencje konkretnych modeli i rembg isnet-anime nadal wymagają dowodów.
Oryginalne PNG na GPU są tylko wskazane w provenance — nie zbadano ich ponownie.

## Grafika główna gry (key art) — 23.10.2026

- Pliki: `public/game/assets/brand/key-art.webp` (pełny obraz z tytułem, niewykorzystany w UI), `loading-heroes.webp` (kadr bez tytułu: ekran ładowania i tło menu od 700 px), `heroes-700.webp` (wersja mobilna tła menu).
- Dodatkowe tła (23.10, poziome, od właściciela): `menu-night.webp` (tło menu od 700 px), `roster-path.webp` (panel „Twoje postacie”), `loading-wide.webp` (ładowanie na szerokich ekranach). Prawa jak niżej: NIEPOTWIERDZONE. Czwarty obraz (akwarela) nie został wykorzystany i nie jest w repo.
- Pochodzenie: obraz dostarczony przez właściciela jako „główna grafika gry”; przycięty i skompresowany do WebP, bez zmiany zawartości. Autor i sposób wygenerowania nieznane.
- Prawa: NIEPOTWIERDZONE. Właściciel musi potwierdzić prawo do publicznego użycia (patrz blokada referencji powyżej).

## Aneks 23.10.2026 — wnętrza Zielonej Przystani

Nowe programowo rysowane SVG, eksporty WebP, minimapa i generatory mają osobny
[rejestr ścieżek, procesu i SHA-256](licenses/city-assets-20261023.json).
[Raport implementacji](SWIAT-I-MIASTA.md) wskazuje dostawę
i potwierdzenie walidowanego importu. Nie użyto nowych referencji zewnętrznych
ani checkpointów. Deklaracja procesu nie zastępuje niezależnego dowodu praw
i nie rozstrzyga wcześniej opisanych praw do istniejących zasobów.

## Utrzymanie rejestrów

`collect_dependencies.py`, `collect_supplemental.py`, `collect_source_evidence.py`
i `collect_assets.py` w `scripts/licenses/` zbierają materiały; nie uruchamiają
kodu paczek ani GPU. Przy nowym audycie ustalić nową bazę i datę zamiast
przypisywać stary wynik nowym zasobom. `render_registers.py` aktualizuje sekcję
liczbową poniżej i notices; nie tworzy osobnych dokumentów dla każdego rejestru.

`verify_registers.py` kontroluje bajty i zakres historycznego audytu; na nowszej
bazie może poprawnie zgłosić zmianę zasobów. Przed tą segregacją już zgłaszał
rozbieżność hasha starego inwentarza (`src/assets/planet-map/atlas-1920.webp`). Nie oznaczamy go PASS po samym przeniesieniu.
Relokacje istniejących dowodów są osobno sprawdzone bajtowo przez kontrolę dokumentacji.
Nie aktualizowano historycznych JSON/CSV tak, aby stworzyć pozór nowego audytu.

<!-- LICENSE-SUMMARY:START -->

## Liczby historycznego audytu — blok generowany

Baza `d9599277924e6c3f1ce99b43e2a1b20654b42c22`, data 2026-10-22.
729 rekordów zasobów; 704 plików w ówczesnym zakresie.
731 ścieżek lockfile; 40 nierozstrzygniętych tekstów/zakresów.
Pełne rekordy w JSON/CSV wskazanym na początku tego dokumentu.

| SPDX według lockfile                     | Ścieżki |
| ---------------------------------------- | ------: |
| 0BSD                                     |       1 |
| Apache-2.0                               |      40 |
| Apache-2.0 AND LGPL-3.0-or-later         |       3 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT |       1 |
| BSD-2-Clause                             |      10 |
| BSD-3-Clause                             |      11 |
| BlueOak-1.0.0                            |       1 |
| CC-BY-4.0                                |       1 |
| ISC                                      |      29 |
| LGPL-3.0-or-later                        |      10 |
| MIT                                      |     596 |
| MIT AND ISC                              |       1 |
| MPL-2.0                                  |      24 |
| Python-2.0                               |       1 |
| Unlicense                                |       2 |

### Nierozstrzygnięte legal text / zakres

| Ścieżka                                            | Wersja  | Deklaracja        | Powód                                                                                                                                                      |
| -------------------------------------------------- | ------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node_modules/@drizzle-team/brocli                  | 0.10.2  | Apache-2.0        | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@humanfs/types                        | 0.15.0  | Apache-2.0        | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/@img/sharp-libvips-darwin-arm64       | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-darwin-x64         | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-arm          | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-arm64        | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-ppc64        | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-riscv64      | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-s390x        | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linux-x64          | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linuxmusl-arm64    | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@img/sharp-libvips-linuxmusl-x64      | 1.3.4   | LGPL-3.0-or-later | Apache-2.0 here licenses sharp-libvips build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations unresolved. |
| node_modules/@lovable.dev/vite-tanstack-config     | 2.26.5  | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@react-three/fiber                    | 9.8.2   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/@rolldown/binding-android-arm64       | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-darwin-arm64        | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-darwin-x64          | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-freebsd-x64         | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-arm-gnueabihf | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-arm64-gnu     | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-arm64-musl    | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-ppc64-gnu     | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-s390x-gnu     | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-x64-gnu       | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-linux-x64-musl      | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-openharmony-arm64   | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-wasm32-wasi         | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-win32-arm64-msvc    | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/@rolldown/binding-win32-x64-msvc      | 1.2.1   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/agent-base                            | 6.0.2   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/drizzle-kit                           | 0.31.11 | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/drizzle-orm                           | 0.45.4  | Apache-2.0        | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/esrecurse                             | 4.3.0   | BSD-2-Clause      | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/http-proxy-agent                      | 5.0.0   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/https-proxy-agent                     | 5.0.1   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/imurmurhash                           | 0.1.4   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/keyv                                  | 4.5.4   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |
| node_modules/natural-compare                       | 1.4.0   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/react-remove-scroll-bar               | 2.3.8   | MIT               | NO_UPSTREAM_TEXT_FOUND                                                                                                                                     |
| node_modules/stackback                             | 0.0.2   | MIT               | no immutable gitHead/GitHub source in version metadata                                                                                                     |

<!-- LICENSE-SUMMARY:END -->


## Nowe dostawy zasobów — kontrola 24.10.2026

Commity z 24.10 obejmują nowe lub poprawione paczki WebP/JSON (`hero-sage-painted`, trzech przeciwników Verdantii) i większą liczbę manifestów `deliveries/`, m.in. miasto Aetherii oraz biomy. Sam fakt obecności manifestu i pliku w Git **nie jest dowodem komercyjnego prawa do assetu**. Przed użyciem produkcyjnym dla każdej dostawy należy prześledzić `provenance.json`, źródło modelu, licencję bazową oraz warunki referencji i elementów zależnych. Nie nadawać automatycznie statusu zatwierdzenia wszystkim plikom z dużego commita `96458e38`; dokładna lista i status integracji muszą wynikać z aktywnego manifestu importu oraz rejestru licencji. Brak udokumentowanego tutaj niezależnego zamknięcia pełnej kontroli praw.
