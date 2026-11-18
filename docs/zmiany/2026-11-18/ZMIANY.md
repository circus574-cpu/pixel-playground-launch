# Zmiany — 18.11.2026

## Kamera w prototypie Pyry

W osadzie kamera celuje nieco wyżej i obejmuje około 20% więcej terenu
w poziomie (zoom 0,54). Po wyjściu przechodzi płynnie na 0,65 i wyprzedza
bohatera w kierunku marszu. Po zatrzymaniu wraca nad postać. Bufor przy
granicy łagodzi wahania kadru. Strefa kadrowania obejmuje istniejący
płaskowyż Pyry. Skala sprite'ów i zasady rozgrywki pozostały bez zmian.

[Prototyp Godot 74/74](qa/pyra-camera/prototype.json) obejmuje przejście
w obie strony, bufor na granicy, przesunięcie kadru podczas marszu,
powrót po zatrzymaniu oraz próbę ręcznego zoomu kółkiem i gestem.
[Podgląd w trybie serwisowym 54/54](qa/pyra-camera/service.json).
Testy wykonano w Godot 4.6.3 z programowym OpenGL. Telefon i publikacja
serwerowa czekają na osobny odbiór.

## Pierwsze prototypy Verdantii, Aetherii i Nexusa-9

Trzy osobne sceny w Godocie pokazują po około 1 km² terenu. Verdantia ma
dolinę z błękitną rzeką i nawierzchnią przeprawy. Aetheria ma górskie
tarasy z trasą o stopniowym nachyleniu i lodowcowe zagłębienie.
Nexus-9 ma przemysłowy uskok i przeprawę serwisową. Dziewięć głównych
tras sprawdzono na siatce nawigacji w próbkach co około metr.
Każda scena ma sześć budynków, bohatera swojej rasy, jednego NPC i kamerę
z osobnym kadrem osady. Każda mapa 2D korzysta z właściwej sceny gry,
a przełączany widok 3D używa tych samych wysokości i materiałów.

Na RTX 6000 Ada utworzono 30 wariantów SDXL i trzy mniej kontrastowe podłoża,
po ekranowej ocenie efektu powtarzania pierwszej partii. Dla każdej sceny
wybrano cztery materiały 512 px. Rzeka w obu rzutach używa tej samej maski
i funkcji cieniowania z błękitem, turkusem i animowanymi refleksami.
GPT Image przygotował trzy nowo zaprojektowane budynki główne. Pozostałe
pięć budynków każdej osady zachowuje wcześniejsze grafiki do czasu wymiany.
Źródła i hashe znajdują się w `deliveries/superior-isometric-20261118`.

- [Verdantia, 33/33](qa/superior-prototypes/verdantia/results.json) i [przeprawa w Godocie](qa/superior-prototypes/verdantia/landmark-1.jpg).
- [Aetheria, 33/33](qa/superior-prototypes/aetheria/results.json) i [osada w Godocie](qa/superior-prototypes/aetheria/city.jpg).
- [Nexus-9, 33/33](qa/superior-prototypes/nexus/results.json) i [osada w Godocie](qa/superior-prototypes/nexus/city.jpg).

Każda scena sprawdza sumy zasobów, ruch dotykiem, animację bohatera,
obecność nowych budynków głównych i zgodność obu map. Wizualne i projektowe
dopracowanie placów, wnętrza i usługi, odbiór na fizycznym telefonie oraz
publikacja prototypów pozostają otwarte. Można uruchamiać osobne sceny
`verdantia.tscn`, `aetheria.tscn` i `nexus.tscn` w projekcie
`ports/godot-isometric-pyra`. Ten etap nie zmienia aktywnej wersji na serwerze.

## Różne układy osad w trzech prototypach

Poprzedni generator kładł wspólny płaski plac pod każdą z trzech osad.
Zielona Przystań zajmuje teraz oba brzegi rzeki. Dwie przeprawy prowadzą
do różnych części osady, a sala stoi na wyższej zachodniej skarpie.
Sanktuarium Tysiąca Źródeł ma trzy poziomy połączone ukośnymi drogami
z łagodniejszym nachyleniem. Węzeł Świadomości dostał prostokątną górną
platformę, niższy plac techniczny i ulice biegnące na różnych wysokościach.

Generator definiuje wysokość i rozmiar każdej parceli. Te same dane określają
położenie sprite'ów oraz przeszkody. Kontrola sprawdziła ciągłość dróg w próbkach
co około metr i osiągalność wszystkich 18 parcel z uwzględnieniem kolizji.
Sceny korzystają z tego samego reliefu w grze i na mapach.

- Verdantia [widok całej osady](qa/superior-city-relief/verdantia/settlement-overview.jpg) i [33/33 kontroli](qa/superior-city-relief/verdantia/results.json).
- Aetheria [widok całej osady](qa/superior-city-relief/aetheria/settlement-overview.jpg) i [33/33 kontroli](qa/superior-city-relief/aetheria/results.json).
- Nexus-9 [widok całej osady](qa/superior-city-relief/nexus/settlement-overview.jpg) i [33/33 kontroli](qa/superior-city-relief/nexus/results.json).

Kadry przeglądowe pokazują geometrię w uruchomionym Godocie. W prototypach
pozostaje dopracowanie zabudowy, otoczenia budynków i konstrukcji przepraw.
Pyra ma nadal własną dotychczasową rzeźbę, a obecne wydanie na serwerze
nie zawiera tych trzech przebudowanych scen.

## Ulice i place czterech miast

[Plany czterech miast](qa/city-streets/plany-czterech-miast.png) pokazują
osobne układy ulic, parceli i trzech placów w każdym mieście. Pyra ma
Trakt Popiołu i obejście areny. Verdantia spina oba brzegi łukami dróg
wokół przepraw. Pasaż Aetherii wpisuje się w tarasy, a w Nexusie-9 pętle
łączą strefy techniczne i handlowe.

`scripts/gpu/design-city-streets.py` wygładza kierunki dróg, rasteruje
place z indywidualnie opisanych obrysów i zapisuje osobne maski nawierzchni.
Kształty placów mają wyraźny brzeg i większą skalę bruku. Renderery 2D/3D
używają wspólnych masek. Zachowano wysokości, przechodniość oraz kolizje.
Test danych próbkował osie ulic, sprawdził połączenia wszystkich ulic
z siecią i dojście z tej sieci w okolice wszystkich 24 budynków.

- [Pyra](qa/city-streets/pyra/settlement-overview.jpg), [81/81 kontroli](qa/city-streets/pyra/results.json).
- [Verdantia](qa/city-streets/verdantia/settlement-overview.jpg), [40/40 kontroli](qa/city-streets/verdantia/results.json).
- [Aetheria](qa/city-streets/aetheria/settlement-overview.jpg), [40/40 kontroli](qa/city-streets/aetheria/results.json).
- [Nexus-9](qa/city-streets/nexus/settlement-overview.jpg), [40/40 kontroli](qa/city-streets/nexus/results.json).

Kadry są z Godota 4.6.3. Układy są zmianą gałęzi prototypów.

## Plan rozbudowy czterech stolic

[Atlas stolic w PDF](qa/capital-plans/stolice-superiora.pdf) pokazuje
istniejące centrum i trzy nowe dzielnice każdej stolicy. Łącznie zaplanowano
12 dzielnic, 12 nowych placów, 16 przebiegów ulic i 63 kwartały pod zabudowę.

- [Pyra](qa/capital-plans/pyra.jpg) ma cytadelę, targ bramny i Dolne Kuźnie.
- [Verdantia](qa/capital-plans/verdantia.jpg) ma zachodni targ z nabrzeżem, domy ogrodowe i sady.
- [Aetheria](qa/capital-plans/aetheria.jpg) prowadzi od miasta gości przez tarasy nauki do sanktuariów.
- [Nexus-9](qa/capital-plans/nexus.jpg) ma górną platformę administracji, przesiadki i niższe warsztaty.

[Źródła planów](../../design/superior-capital-plans.json) zapisują granice,
osie ulic, place i kwartały we współrzędnych prototypów. Plansze korzystają
z danych wysokości Godota. Kontrola wykazała, że kwartały mieszczą się w
dzielnicach i nie pokrywają istniejących budynków, placów ani osi dróg.
[Przegląd terenu](qa/capital-plans/terrain-review.json) oznacza próbki
projektowanych ulic wypadające poza aktualną maską ruchu. Rampa, mur
oporowy lub korekta przebiegu będzie wymagana przy wykonaniu tych odcinków.
To etap projektu urbanistycznego. Aktualny teren, serwer i budynki pozostają
w dotychczasowej wersji.

## Pyra — Plac Koronny

Osobna scena Godota `res://pyra-citadel.tscn` pokazuje początek dzielnicy
cytadeli na północ od centrum. Kręte podejście prowadzi na lokalny taras,
gdzie na placu znajdują się brązowa rozeta, brama, odcinki muru i paleniska.
Przejście między filarami jest dostępne pieszo. Podejście ma wyrównany spadek.
Oba widoki mapy korzystają z tych samych danych wysokości i materiałów.

Modele bramy, muru i paleniska wyrenderowano w Blenderze 4.5.3 (Cycles)
na RTX 6000 Ada. Grafikę bramy dopracowano w GPT Image na podstawie kadru z
Blendera i istniejącej ilustracji hali Pyry. W grze jej podstawy dopasowano
do kolizji filarów. [Paczka źródłowa z manifestem, modelami i logiem GPU](../../../deliveries/pyra-citadel-20261118/manifest.json).

- [Widok gracza](qa/pyra-citadel/player-view.jpg) i [widok placu](qa/pyra-citadel/royal-square.jpg) pochodzą z uruchomionej sceny.
- [Kontrole Godota](qa/pyra-citadel/results.json) obejmują przejście przez bramę, kolizje filarów i zgodność danych widoków mapy.
- Aby odtworzyć scenę, wypakuj `citadel-source.zip` i podaj katalog z oryginalnymi renderami do
  polecenia odtwarzania podanego poniżej w sekcji o rozbudowie dzielnicy.
  Otwórz `pyra-citadel.tscn` w projekcie `ports/godot-isometric-pyra`.

To działający fragment Pyry. Zabudowa kwartałów cytadeli, jej wnętrza i ruch NPC
pozostają w planie. Scenę sprawdzono na komputerze w Godot 4.6.3. Trafia na
gałąź prototypów.

### Zabudowa przy drodze do cytadeli

W scenie Placu Koronnego stoi siedem nowych budynków. Przy zakręcie
i za bramą są wartownie, przy bocznych drogach trzy domy, a przy podejściu
do placu hala kupców i podcienia targowe. Łuk Kupców i Zaułek Miedziarza
rozchodzą się na bok głównej drogi. Przy hali powstał brukowany dziedziniec.
Bryły mają kolizje i lokalnie wypoziomowane podstawy. Wejścia są na razie
zamknięte. Kamera nad dzielnicą zachowuje szerszy widok miejski.

Cztery malowane sylwetki pochodzą z GPT Image i zostały rozdzielone na
osobne sprite'y. Model latarni powstał w Blenderze 4.5.3 i został
wyrenderowany w Cycles na RTX 6000 Ada. W scenie pięć latarni migocze,
a trzy kominy mają animowany dym. Oba widoki mapy używają tych samych
pozycji i wysokości zabudowy. Dym i migotanie są dodatkami widoku 2D.

[Widok dzielnicy w Godocie](qa/pyra-citadel-district/district.jpg) ·
[Widok gracza](qa/pyra-citadel-district/player-view.jpg) ·
[Kontrole dzielnicy](qa/pyra-citadel-district/results.json) ·
[Regresja podstawowej sceny](qa/pyra-citadel-district/pyra-regression.json).

Odtwarzanie wymaga wypakowania `citadel-source.zip` i `street-source.zip`
do osobnych katalogów. [Manifest źródeł i sumy SHA-256](../../../deliveries/pyra-citadel-20261118/manifest.json).

```sh
python3 scripts/godot/prepare_pyra_citadel.py \
  --renders katalog-cytadeli --street-renders katalog-latarni \
  --painted-gate deliveries/pyra-citadel-20261118/gate-painted-source.png \
  --district-sheet deliveries/pyra-citadel-20261118/district-sheet.png
```

**Kontynuacja.** Otwórz `ports/godot-isometric-pyra/pyra-citadel.tscn`
w Godocie 4.6.3. Pozycje domów, tras, latarni i kęp drzew zmieniaj w
`scripts/godot/prepare_pyra_citadel.py`, po czym wygeneruj dane ponownie.
Uruchom obie sceny z argumentem `-- --qa` w trybie graficznym: dla
`pyra-citadel.tscn` oczekuj 24/24, a dla `world.tscn` 81/81. Ścieżkę
zrzutów ustawia `KI_ISO_QA_DIR`. Następny fragment to Targ Bramny
i Dolne Kuźnie według planu miasta. Wnętrza i ruch NPC pozostają do wdrożenia.

Render latarni można odtworzyć w Blenderze, podając do
`scripts/gpu/render-pyra-citadel.py` kolejno: `common.py` i `contract.json`
z paczki cytadeli, plik JSON z pustą listą `[]`, katalog wynikowy oraz
`street-lantern`. Paczka latarni zawiera edytowalny `.blend`, render PNG
i log Cycles. Scena jest w gałęzi prototypowej. Aktualizację serwerową
przygotowuje się osobno z tej gałęzi po akceptacji sceny.

### Plac Koronny w trybie TEST SERWER

Wydanie treści Android `1.14.2` podmienia wyłącznie pakiet podglądu
`core-c101`, zachowując zależności lądów i wszystkie 29 pozostałych
pakietów z 1.14.1. Ekran serwisowy otwiera scenę Pyry przy Placu Koronnym.
Paczka ma 45 774 548 bajtów. Obowiązuje istniejące APK 1.14 i autoryzacja
administratorów. Włączenie wydania przez workflow wymaga aktywnej
konserwacji i poprzedniej aktywnej wersji wskazanej w `test_base`.
[Manifest wydania](../../../deliveries/godot-content-1.14.2/manifest.json).

Test HTTP z zasobami oryginalnego APK 1.14, w Godot 4.6.3, przeszedł
52/52 kontroli. Test objął montaż aktualizacji, otwarcie dla administratora,
odmowę gościowi i zamknięcie podglądu po odebraniu dostępu, budynki,
animacje otoczenia, mapy oraz niezmienione bajty zapisów.
[Wyniki i zrzut](qa/pyra-test-server/results.json) ·
[Widok pobranej sceny](qa/pyra-test-server/downloaded-preview.jpg).
Test fizycznego telefonu pozostaje otwarty.

Wdrożenie 1.14.2 zakończone. Serwer potwierdził aktywną wersję 1.14.2 i
włączoną konserwację. Anonimowe żądania manifestu i paczki testowej
otrzymały HTTP 503. [Weryfikacja serwera](qa/pyra-test-server/live.json) ·
[GitHub Actions](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/44251931494).

### Targ Bramny i Dolne Kuźnie

Rozbudowa prototypu Pyry na CPU z istniejących grafik. Trakt Bramy biegnie
od gospody do targu na zboczu, z bocznym Zaułkiem Karawan. Dolne Kuźnie
łączą Plac Węglowy oraz składy z centrum przez Obwód Kuźni i Zaułek Węglowy.
Powstały cztery ulice, dwa place i dziesięć nowych budynków z kolizjami.
Od strony wzgórza targ kończy się przy Strażnicy Karawan. W obydwu dzielnicach
kamera pokazuje więcej otoczenia, a HUD podaje nazwę okolicy.

Tragarz, straż i pomocnik kuźni idą po sprawdzonych trasach i zawracają na
końcach. Do oświetlenia dodano sześć latarni. Budynki pozostają zamknięte,
więc handel, warsztaty, rozmowy i wyposażenie wnętrz pozostają do wykonania.

Układ, wysokości i trasy utrzymujemy w `scripts/godot/pyra_quarters.py`.
Dane, kolizje i materiały są współdzielone przez podgląd i mapy.
Ponowna generacja używa polecenia z sekcji Placu Koronnego.
Godot zaliczył 56/56 kontroli sceny, w tym kolizje i osadzenie każdego
z 17 budynków rozbudowy, przechodniość ulic i ruch trzech postaci.
Podstawowa Pyra zaliczyła 81/81. Próba lokalnej aktualizacji na zasobach APK
1.14 zaliczyła 54/54, w tym zachowanie zapisów. Serwer nadal używa 1.14.2.

- [Targ Bramny](qa/pyra-quarters/market.jpg) i [Dolne Kuźnie](qa/pyra-quarters/forges.jpg) z Godota.
- [Kontrole sceny](qa/pyra-quarters/results.json), [regresja Pyry](qa/pyra-quarters/pyra-regression.json) i [próba aktualizacji](qa/pyra-quarters/installed-update.json).

### Nawierzchnie i wyposażenie ulic Pyry

Próba izometryczna otrzymała nawierzchnie z czterech niezależnych tekstur
256 px, generowanych na CPU przez `scripts/godot/paint_pyra_surfaces.py`.
Drogi mają bruk ze spoinami i ciemniejszą krawędź, place oraz dojazdy pod
budynkami mają większe płyty, a na miejskich stokach użyto osobnego
materiału warstwowego. Gęstsza maska oddziela place, ulice i ubite podłoże.
Wysokość terenu i siatka przechodniości pochodzą z poprzedniej sceny.

Drzewa rosną poza zabudową. Przy targu i kuźniach ustawiono wozy,
skrzynie i beczki z istniejących zasobów Pyry. Ich pozycje i pochodzenie
tekstur zapisano w danych architektury. Rozstawienie sprawdzono razem
z kolizjami i przechodniością ulic.

[Widok Targu Bramnego](qa/pyra-paving/market.jpg) i
[widok Dolnych Kuźni](qa/pyra-paving/forges.jpg) pochodzą z kamery gracza
w Godot 4.6.3. [Kontrole prototypu](qa/pyra-paving/results.json) objęły
materiały, drzewa, rekwizyty, przechodniość oraz współdzielenie nawierzchni
z mapą 3D. Zmiana jest na gałęzi prototypowej, serwer nadal używa 1.14.2.

### Referencje Superiora dla architekta świata

[Pełny atlas 2D](qa/superior-reference/superior-atlas-2d.jpg) oraz
cztery zbliżenia mapy i obroty globusa wykonano w Godot 4.6.3 z zasobów
APK 1.14. [Pochodzenie zrzutów](qa/superior-reference/provenance.json).

| Kontynent | Atlas 2D | Globus 3D |
| --- | --- | --- |
| Verdantia | [Zrzut](qa/superior-reference/verdant-atlas-2d.jpg) | [Zrzut](qa/superior-reference/verdant-globe-3d.jpg) |
| Aetheria | [Zrzut](qa/superior-reference/aether-atlas-2d.jpg) | [Zrzut](qa/superior-reference/aether-globe-3d.jpg) |
| Nexus-9 | [Zrzut](qa/superior-reference/nexus-atlas-2d.jpg) | [Zrzut](qa/superior-reference/nexus-globe-3d.jpg) |
| Pyra | [Zrzut](qa/superior-reference/pyra-atlas-2d.jpg) | [Zrzut](qa/superior-reference/pyra-globe-3d.jpg) |

[Cztery prompty dla architekta](qa/superior-reference/prompty-architekt-superiora.txt)
opisują geometrię, krajobrazy, komunikację i wycinki stolic w izometrii.
Wytyczne projektowe pozostają propozycjami do szkiców.
