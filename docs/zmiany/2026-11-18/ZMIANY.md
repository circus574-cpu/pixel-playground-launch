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
