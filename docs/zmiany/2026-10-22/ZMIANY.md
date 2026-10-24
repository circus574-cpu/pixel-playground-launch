# KI Legends — zmiany 2026-10-22

Dziennik historyczny; stan aktualny jest w [indeksie](../../INDEX.md).
Nie przenosi starych zgód/statusów na nowe wydania.

## Lista zmian

- Zarchiwizowano oryginalny 12-stronicowy PDF bezstratnie w częściach binarnych; hash i oryginalne ilustracje zachowano.
- Audyt praw objął 729 rekordów zasobów oraz 731 ścieżek lockfile; nie rozstrzygnął wszystkich praw i notices.
- Dostarczono cztery malowane rasy, statystyki i drzewka 4×29, silnik 40 potworów, tekstury kontynentów i przyrodę.
- Rozwinięto globus/atlas i geometrię planety: 80 000 jednostek między głównymi miastami.

## Zgoda właściciela na tamto wydanie

bezpośrednie polecenie właściciela z 2026-10-22 w rozmowie projektowej: „Ok. Zapisz w raporcie że udzielam zgody na publikację i scalają do main I publikuj grę. Trzeba sprawdzić na androidzie ją”.

Zapis oznacza otrzymanie zgody na wskazany zakres, nie dowód wykonania deployu ani licencji.

## Wybrane tożsamości — historyczne dowody

### android-v1

| Plik                                                                      | SHA-256                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `android-s5741102-d62.png` (wybrany)                                      | `02a5fdc8cd3f465267c44a05cfb01b8f46ff24cd8cb98911c68047ff9b50ae67` |
| `contact-sheet.jpg`                                                       | `c096f97d0980ee28dc4f73ee7d32631e6ce19199d5288d84c862e00a2af60255` |
| `metadata.json`                                                           | `a5fa84adadb98fc0fc4b50a820680632eab450a2f61a831538cc3f9fa5f62677` |
| referencja `public/game/assets/origins-v1/android-full.webp` (PDF str. 6) | `04559d7507f7c3bfa92ebbbf4f1f2b43734546546fd262fa8bfeaaf1afa0eef0` |
| skrypt `scripts/gpu/identity_candidates.py`                               | `4f52c7019e1e61d3e268513b2858f529b25a306acba4424c4fc06efe05607397` |

Wybrany kandydat jest źródłem późniejszej produkcji; ówczesne „animacja nierozpoczęta” nie opisuje stanu dzisiejszego.

### legend-v1

| Plik                                                                     | SHA-256                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `legend-s5741102-d62.png` (wybrany)                                      | `35421413ffe928e53aa50916fa2028cdb3d89cf5c0db3d0982c6db32d29d121b` |
| `contact-sheet.jpg`                                                      | `16fb2d73bf77dd7176e574f0b3f020781719650c6427237d3bae94384993ee5d` |
| `metadata.json`                                                          | `78c2d6745b415773539c2fe72054e31bcf72cf2e2a8795c116a5a916eb69fbf9` |
| referencja `public/game/assets/origins-v1/legend-full.webp` (PDF str. 7) | `ba7c4d962595ae469adeaa00939549af2f77597caf175f29fff2122e75a87e80` |
| skrypt `scripts/gpu/identity_candidates.py`                              | `4f52c7019e1e61d3e268513b2858f529b25a306acba4424c4fc06efe05607397` |

Wybrany kandydat jest źródłem późniejszej produkcji; ówczesne „animacja nierozpoczęta” nie opisuje stanu dzisiejszego.

### planetary-v1

| Plik                                                                        | SHA-256                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `planetary-s5741102-d62.png` (wybrany)                                      | `086d7e1377b2c8639c9c01532298631e44e952d18b9bfdc64733e27214a3eeb8` |
| `contact-sheet.jpg`                                                         | `62df4252f745a04503449c8928b8fa9ac32dc44aeb0fc8dd1a57354dd9517c81` |
| referencja `public/game/assets/origins-v1/planetary-full.webp` (PDF str. 4) | `db5caf89604fe974cbf38bd750795f3e362f954c695d8df94ba149e7598ea851` |
| skrypt `scripts/gpu/identity_candidates.py`                                 | `dd065f345c755d4a2f0943c8f6c7b1a271aeb2ac25ac6a3202bf529d4ca470ab` |

Wybrany kandydat jest źródłem późniejszej produkcji; ówczesne „animacja nierozpoczęta” nie opisuje stanu dzisiejszego.

### sage-v2

| Plik                                                                   | SHA-256                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `sage-s5741102-d55.png` (wybrany)                                      | `f8c049347ccf2ffa0e3364c8c2bfa46488d37edf528c02a9066cad393a10d38a` |
| `contact-sheet.jpg`                                                    | `ad8753396984f35898e0cb47b5624e16f8a6c0b72ead962f64b40d8b49fa2de1` |
| referencja `public/game/assets/origins-v1/sage-full.webp` (PDF str. 5) | `46801a39930815b6621a8433e5396f25fee22460604cbda4158c617fc5d99147` |
| skrypt `scripts/gpu/identity_candidates.py` (commit `9f17bd09`)        | `708cd6017f30e01d45b43d2c6c5f115a3fb7f5d8779a76ac0f816c72cda2375a` |

Wybrany kandydat jest źródłem późniejszej produkcji; ówczesne „animacja nierozpoczęta” nie opisuje stanu dzisiejszego.

## Rejestr decyzji z tego dnia

| Data | Decyzja | Dowód | Status |
| --- | --- | --- | --- |
| 2026-10-22 | ETAP 1 Androidy: kandydat tożsamości `android-s5741102-d62.png` zaakceptowany; kolejne kroki (rig, 8 widoków, animacja) po przywróceniu runtime. | [design/identity/android-v1/SELECTED.md](ZMIANY.md) | Zaakceptowany kandydat tożsamości; produkcja nierozpoczęta |
| 2026-10-22 | ETAP 2 Legendy: kandydat tożsamości `legend-s5741102-d62.png` zaakceptowany; rig/animacja po odbiorze Androidów i przywróceniu runtime. | [design/identity/legend-v1/SELECTED.md](ZMIANY.md) | Zaakceptowany kandydat tożsamości; produkcja nierozpoczęta |
| 2026-10-22 | Planetarni: odrzucona poprzednia wersja; wybrany nowy kandydat tożsamości `planetary-s5741102-d62.png`. | [design/identity/planetary-v1/SELECTED.md](ZMIANY.md) | Wybrany kandydat; produkcja nierozpoczęta |
| 2026-10-22 | Mędrcy: odrzucona poprzednia wersja; wybrany kandydat tożsamości (wersja męska) `sage-s5741102-d55.png`. | [design/identity/sage-v2/SELECTED.md](ZMIANY.md) | Wybrany kandydat; produkcja nierozpoczęta |
| 2026-10-22 | Porzucono rigi 3D z prymitywów („tragiczne”); bohaterowie z malowanych widoków + deformacja siatki. | [RASY-I-POSTACIE.md](../../RASY-I-POSTACIE.md) | Obowiązuje |
| 2026-10-22 | Usunięcie z volume: model Flux (17 GB), koder umt5 (6,7 GB), archiwum Flux (8,3 GB). | [RASY-I-POSTACIE.md](../../RASY-I-POSTACIE.md) | Wykonane |
| 2026-10-22 | Wybór wariantów Legend i Mędrców (wiersz 1) oraz skinowania delegowany agentowi; przeglądy ruchu Androida i Planetarnych zaakceptowane do pełnego renderu. | [RASY-I-POSTACIE.md](../../RASY-I-POSTACIE.md) | Wybór agenta, bez akceptacji końcowej |
| 2026-10-22 | Zlecono wygenerowanie zestawu przyrody (woda, oceany, lodowce, wulkany, lawa, teren); paczki `nature-textures-v1` i `nature-objects-v1` w `deliveries/`, bez instalacji. | [GPU-I-ZASOBY.md](../../GPU-I-ZASOBY.md) | Wykonane; nieocenione przez właściciela |
| 2026-10-22 | Wdrożono aneks właściciela (statystyki ras, drzewka 4×29, zasoby rasowe, model obrażeń `max(1, Atak × mnożnik − Obrona/2)`) oraz 40 potworów z bestiariusza HTML. Szybkość ruchu: +5% bazowej na poziom do poz. 20 (zmiana względem aneksu). Założenia nieobecne w aneksie: krytyk ×1,5; mikstura leczy 40% maks. życia; baza regeneracji poza walką 0,3%/s maks. życia; reset drzewka kosztuje 50 × poziom monet (pierwszy darmowy do poz. 10); koszt korzenia = 1 punkt; zapis wersji 4. | [ROZWOJ-I-WALKA.md](../../ROZWOJ-I-WALKA.md) | Zatwierdzone przez właściciela 23.10.2026 (prędkość i wszystkie założenia) |
| 2026-10-22 | Wdrożyć publicznie rasy, tekstury i przyrodę z GPU. Odległość 80 000 j. między głównymi miastami (czworościan na kuli), wyspy na środkach krawędzi, docelowo 4 miasta na kontynent, jedna wielka mapa na kontynent. | Polecenia właściciela w sesji; [SWIAT-I-MIASTA.md](../../SWIAT-I-MIASTA.md) | Obowiązuje (do dopracowania) |

## Commity w kolejności historii

- `fb8940c` — docs: archive original Ki Legends 12-page design PDF in verified binary parts
- `eddc657` — docs: index committed lossless original PDF and its restore procedure
- `e4e4107` — docs: mark original PDF binary archival verified on PR16 branch
- `015787c` — docs: align docs/INDEX.md with archived original PDF in PR16
- `21ddac7` — docs: align docs/INDEX.md with archived original PDF in PR16
- `65bb321` — docs: align docs/PLAN-I-ZADANIA.md with archived original PDF in PR16
- `b44d409` — docs: align docs/PLAN-I-ZADANIA.md with archived original PDF in PR16
- `fe7a9bd` — docs: align docs/ARCHITEKTURA-I-TESTY.md with archived original PDF in PR16
- `5f0bb9d` — docs: audit asset provenance and lockfile licenses with evidence and notices
- `5a39535` — docs: record owner's explicit merge and publish authorization with audit gates
- `3129ea4` — Merge PR #15: verified Sage/Planetary and globe regressions
- `0b9e261` — Merge PR #16: canonical source and owner publication authorization
- `02a390e` — Merge current main into license audit branch, preserve both indices
- `9e8b0ed` — Merge PR #17: original art provenance and dependency license register
- `f79cefb` — Changes
- `20aa98b` — Changes
- `f75c0d1` — Changes
- `23a0643` — Changes
- `7619eab` — Changes
- `827123d` — Changes
- `e979a7c` — Changes
- `a4c91dd` — Changes
- `7769cab` — Changes
- `badfaf8` — Dodano anime start Aetherii
- `b8eb4fd` — Changes
- `9a2636c` — Changes
- `46c0e04` — Changes
- `e104316` — Changes
- `8d1285d` — Changes
- `64d8934` — Changes
- `6ea79c8` — Changes
- `b9ef407` — Changes
- `80d8586` — Changes
- `b17851e` — Changes
- `2c22aa2` — Dodał nową grafikę Nexus-9
- `16744ee` — Changes
- `1c4b14e` — Changes
- `a01fa34` — Changes
- `5b370e7` — Changes
- `279cff3` — Changes
- `2c74678` — Dodano 4. grafiki Verdantii
- `ded9c89` — Changes
- `f5207a1` — Dodano tekstury krajów
- `d5697f1` — Changes
- `ed0434a` — Changes
- `87b1aa1` — Changes
- `59b4e60` — Changes
- `d5d8ead` — Changes
- `f275cbf` — Changes
- `bd71275` — Changes
- `f6e562b` — Changes
- `c77202b` — Changes
- `2c9fdfa` — Changes
- `b7375e2` — Changes
- `d78b602` — Changes
- `9b4512a` — Dodano Aetherię do gry
- `0a1a3de` — Changes
- `9a9b773` — Changes
- `a47f226` — Changes
- `1a13783` — Changes
- `3f038da` — Changes
- `cf42472` — Changes
- `3e7717b` — Changes
- `66a615d` — Podłączono mapy 2D/3D w grze
- `f8384b7` — Dodano skrypt kandydatów tożsamości bohatera (Androidy/Legendy) z kanonu PDF
- `ad94171` — Zapisano wybór kandydata tożsamości Androida (ETAP 1)
- `12ffb26` — Zaakceptowano kandydata tożsamości Androida; odnotowano blokadę runtime Blendera
- `7f1fdd0` — Zaakceptowano kandydata tożsamości Legend (ETAP 2)
- `1140d0f` — Dodano kandydatów tożsamości Planetarnych; pobranie referencji odporne na 403
- `c19af2d` — Dodano skrypty rigu i animacji Androida (na bazie rigu Planetarnych)
- `9314a43` — Wybrano nowego kandydata tożsamości Planetarnych
- `a6e4478` — Rozbudowa rigu Androida: płaszcz od pasa, warstwowy pancerz, włosy
- `e125715` — Kandydaci Mędrców; rig Androida v3 (dłuższe poły, płyty piersiowe, pancerz ud)
- `9f17bd0` — Mędrcy: wersja męska, osobny katalog serii
- `bf48e0a` — Rig Androida v4 (płaszcz skinowany, chód bez przysiadu), rig Planetarnych v3 wg nowego kandydata
- `da9d0f1` — Wybrano kandydata tożsamości Mędrców (wersja męska)
- `9523e49` — Chód Androida/Planetarnych bez przysiadu (krok 65%, pochylenie), rig Planetarnych v4 z poprawionymi połami i kolorami
- `70adac0` — Skrypt punktów szkieletu z rigu Androida (wskazówka póz dla widoków malowanych)
- `24403b1` — Skrypt 8 malowanych widoków bohatera (ControlNet pozy + IP-Adapter tożsamości)
- `2fd76be` — Malowane widoki: parametr siły IP-Adaptera, białe tło, bez efektów energii
- `152746a` — Malowane widoki: opis bez efektów energii, wsparcie Planetarnych
- `f26f412` — Wycinanie tła i układanie masterów 512 (kotwica stóp, jedna skala)
- `cab5a89` — Mastery: zapis przesunięcia i skali do metadanych
- `a458627` — Animacja malowanych widoków: deformacja siatki 2D ze szkieletem z rigu
- `aa517a6` — Animacja malowana: margines liczony tylko z wierzchołków postaci
- `89dca8a` — Diagnostyka maks. przemieszczenia wierzchołków
- `856fd40` — Animacja malowana: upadek leży na ziemi i jest wyśrodkowany
- `3e0be12` — Diagnostyka przekroczeń marginesu
- `d01dbe8` — Malowane widoki: Legendy i Mędrcy (wspólny szkielet rigu)
- `2dd6203` — Animacja malowana: centrowanie upadku, margines bezpieczeństwa 14 px
- `ed01c18` — Animacja malowana: opcjonalny katalog wyjściowy na dysku lokalnym
- `7d70c94` — Animacja malowana: konfigurowalny margines bezpieczeństwa (KI_SAFE)
- `d790659` — Animacja malowana: margines dolny niezależny od KI_SAFE
- `96e7c63` — Animacja malowana: przyciąganie klatek do linii ziemi
- `02033ad` — Skinowanie: łańcuchy kończyn (bez mieszania lewej i prawej nogi), unoszenie stóp
- `881e7c1` — Dokumentacja pipeline'u malowanych widoków i decyzji z 22.10
- `d14f0f7` — Generator bezszwowych tekstur terenu dla kontynentów (SDXL, kołowe dopełnienie)
- `83d4c06` — Cztery rasy: paczki 416 klatek, mastery, widoki malowane i provenance (do integracji przez Codexa)
- `d1aef48` — Generator tekstur: wybór checkpointu, kroków i trybu kołowego
- `8beaa61` — feat: activate Claude's four painted hero deliveries with race regressions
- `13b460f` — Enlarge the four painted heroes without changing camera or physics
- `23bfec8` — Gotowe w repo: cztery rasy, tekstury terenu trzech kontynentów i instrukcja dla Codexa
- `3bad71c` — Generator zestawu przyrody: tekstury wody, oceanu, lodu, lawy oraz sprite'y wulkanów, lodowców, gór, drzew
- `29c82b4` — Skrypty: wycinanie sprite'ów przyrody i budowa paczek
- `228618f` — Przyroda: selekcja i rozróżnienie wycinków i łat
- `b1b0aa1` — Check guidance clearance against enlarged hero bounds
- `4faa092` — Zestaw przyrody: tekstury wody, lodu, lawy i obiekty (wulkany, lodowce, góry, drzewa) oraz sekcja w instrukcji dla Codexa
- `457eabb` — Bestiariusz właściciela, rozpiska 40 potworów z własnymi projektami i generator kandydatów
- `70894ce` — Skrypty potworów: widoki (IP-Adapter), wycinanie, animacja siatką wg archetypu
- `958619a` — Wybór kandydatów potworów (selection-v1)
- `988233e` — feat: wdroż tekstury kontynentów i przyrodę do gry
- `c8efcd0` — test: zaktualizuj e2e do publicznych domyślnych tekstur startowych i v2
- `eaa596f` — docs: dokumentacja 40 potworów, skrypt pakujący i generator opisów
- `8bc710b` — Klucze <świat>.enemy.<slug>: walidator, ładowanie wizerunków wrogów świata, test i dokumentacja
- `ec190c3` — feat: otwarte mapy Aetherii, Nexus-9 i Pyry (strefy N/S/E/W) zintegrowane z mapą i globusem
- `590fe68` — Silnik ras z aneksu 22.10: statystyki, 4×29 węzłów, zasoby, zdolności i testy (jeszcze niepodpięte do sesji)
- `97df05a` — feat: przycisk Usuń w wyborze postaci z potwierdzeniem
- `38ae3c3` — feat: podgląd kontynentu w menu z atlasu planety; test podglądu zaktualizowany
- `860a940` — Rozgrywka: kity ras z aneksu 22.10 (statystyki, drzewka, zasoby), 40 potworów, statusy, zapis v4, UI drzewka
- `db8acbf` — Obrażenia ułamkowe zgodne z tabelą pojedynków z aneksu; dokumentacja rozgrywki ras i potworów
- `472f34a` — Paczki 40 potworów (416 klatek każdy, niezainstalowane), klucze wiązań, pochodzenie i sumy SHA-256
- `7e30566` — feat: geometria planety — miasta w czworościanie (80 000 j. między każdą parą), wyspy na krawędziach
- `ccc5e3d` — docs: przekazanie sesji 22.10.2026 — stan, decyzje i plan na rano
- `63c1d6e` — Dokumentacja dostosowana do zmian z 22.10.2026; stabilne selektory umiejętności i pomocniki pod testy e2e
- `cba7cde` — docs: zapisz usterkę webgl CI (liczba tekstur zależna od historii kamery) i plan poprawki

## Dowody

- [four-painted-races-20261022](qa/four-painted-races-20261022/)

Baza segregacji: `927146f4e5d84ed1b71cd1a732d4f9efd430615c`. Starsze liczby testów dotyczą ich własnych SHA, nie aktualnej głowy.
