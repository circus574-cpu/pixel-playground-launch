import { ContinentDialogueCatalog } from "./types";

export const VERDANT_DIALOGUES: ContinentDialogueCatalog = {
  continent: "verdant",
  dialogues: {
    "npc-aira": {
      npcId: "npc-aira",
      npcName: "Aira",
      cityId: "verdant-zielona-przystan",
      role: "Przewodniczka Zielonej Przystani",
      greetings: [
        "Niech korzenie Verdantii prowadzą twe kroki, wędrowcze. Czuję w tobie czysty przepływ energii KI.",
        "Witaj w Zielonej Przystani. Prastare korony szumią dziś niespokojnie, lecz w naszej osadzie jesteś bezpieczny.",
        "Niech zieleń da ci ukojenie. Jeśli twoje serce bije w rytmie Puszczy, znajdziesz tu dom i cel.",
      ],
      rumors: [
        "Na południe stąd leży Źródło Pierwszego Drzewa. Mówią, że woda czerpana o świcie leczy rany duszy, lecz pilnują jej czujne leśne bestie.",
        "Most Splątanych Korzeni łączy nas z wschodnimi bagnami. Uważaj pod nim — nocami pnącza same zaciskają się na nieostrożnych stopach.",
        "W głębi kniei, w Opuszczonej Chacie Zielarza Pierwszej Ery, wciąż tli się zapomniana receptura eliksiru żywicznego.",
      ],
      quests: {
        "O-V01": {
          questId: "O-V01",
          before:
            "Witaj w Verdantii. Zanim wyruszymy w głąb puszczy, musisz zrozumieć tutejszy rytm życia i oczyścić najbliższy szlak z niespokojnych szlamaków.",
          during:
            "Mchowe Szlamaki wciąż podchodzą pod palisadę Zielonej Przystani. Odszukaj je na ścieżce i przywróć równowagę.",
          after:
            "Doskonale. Wyczuwam, że las przyjął twój dar. Szlak jest znów bezpieczny dla zbieraczy mchu.",
        },
        "O-V02": {
          questId: "O-V02",
          before:
            "Nasze patrole meldują o Cierniowych Wilkach grasujących w pobliżu mostów. Potrzebujemy zwiadu wzdłuż starego traktu.",
          during:
            "Uważaj na watahę w cieniu paproci. Cierniowe Wilki atakują stadnie, gdy wyczują wahanie.",
          after:
            "Wataha została rozproszona. Dzięki tobie kurierzy mogą przejść suchą stopą do Przystani Trzech Mostów.",
        },
        "O-V03": {
          questId: "O-V03",
          before:
            "Z pradawnych ruin dochodzą echa dziwnego pulsu. Czas, abyś zbadał Źródło Pierwszego Drzewa i jego pradawne mechanizmy.",
          during:
            "Źródło tętni na południowym skraju polany. Sprawdź, co zakłóca pierwotny rezonans KI.",
          after:
            "Woda w źródle znowu płynie krystalicznym błękitem. Prastary duch puszczy odetchnął z ulgą.",
        },
        "O-V04": {
          questId: "O-V04",
          before:
            "Zaburzenia rozprzestrzeniają się ku wschodnim lasom. Czas udać się do Kamiennego Sadu i skonsultować mapy z Orenem.",
          during:
            "Droga do Kamiennego Sadu jest długa. Pamiętaj o uzupełnieniu zapasów w sakwie przed wyruszeniem.",
          after:
            "Wiadomości od Orena potwierdzają moje obawy — zjawisko dotyka całej Verdantii, nie tylko naszej doliny.",
        },
        "O-V05": {
          questId: "O-V05",
          before:
            "Północne pnącza oplatają Latarnię Korzeni. Strażniczka Lina potrzebuje wsparcia doświadczonego wojownika KI.",
          during:
            "Latarnia Korzeni stoi na stromym wzgórzu. Jej światło nie może zgasnąć, bo zagubią się nocne karawany.",
          after:
            "Światło latarni rozprasza mgły. Twoje poświęcenie dla Planetarnych staje się pieśnią powtarzaną wśród gałęzi.",
        },
        "O-V06": {
          questId: "O-V06",
          before:
            "Czas na ostateczne oczyszczenie matecznika. Rdzeń Puszczy wzywa cię na próbę hartu ducha i siły uderzeń.",
          during:
            "Skup całą energię w uderzeniach. Nie pozwól, aby mrok zachwiał harmonicznym przepływem energii KI.",
          after:
            "Dokonałeś tego! Puszcza jest wolna, a twoje imię zostało wyryte w zwojach Zielonej Przystani na wieki.",
        },
        M01: {
          questId: "M01",
          before:
            "Jako nowo mianowany obrońca puszczy musisz przejść Rytuał Pierwszego Pąka. Przynieś mi dowód swej więzi z lasem.",
          during:
            "Rytuał wymaga skupienia i szacunku dla powalonych pni. Znajdź święte nasiono w gęstwinie.",
          after:
            "Pąk zakwitł w twojej dłoni szmaragdowym blaskiem. Prawdziwy z ciebie wojownik Planetarnych.",
        },
        M13: {
          questId: "M13",
          before:
            "Głęboko w Kniewie zagnieździł się pradawny relikt. To zadanie dla mistrza, który potrafi stawić czoła pradawnym bestiom.",
          during:
            "Zmierzasz ku zapomnianym zrębom. Bądź czujny, bo tamtejsze bestie nie znają litości.",
          after:
            "Relikt spoczął w bezpiecznym archiwum. Verdantia zawdzięcza ci ocalenie swojego prastarego dziedzictwa.",
        },
        "IC-02": {
          questId: "IC-02",
          before:
            "Dotarły do nas niepokojące wieści z Aetherii. Złote zwoje Mędrców wspominają o wspólnym zagrożeniu dla obu światów.",
          during:
            "Przygotuj raport dla posłów Mędrców. Mosty międzykontynentalne wymagają czujności.",
          after:
            "Posłowie przyjęli naszą przestrogę. Sojusz Planetarnych z Mędrcami nabiera realnych kształtów.",
        },
        "IC-06": {
          questId: "IC-06",
          before:
            "Wielki Trakt Dyplomatyczny wymaga otwarcia bezpiecznego kanału z Nexus-9 i Pyrą. Podejmij się tej misji.",
          during:
            "Podróżuj z poselstwem. Każdy kontynent ma własne prawa, lecz wspólna planeta wymaga jedności.",
          after:
            "Wielki Trakt został zaprzysiężony. Twoje czyny przekroczyły granice samej Verdantii.",
        },
      },
    },
    "npc-mio": {
      npcId: "npc-mio",
      npcName: "Mio",
      cityId: "verdant-zielona-przystan",
      role: "Kupiec Zielonej Przystani",
      greetings: [
        "Zioła, esencje, żywiczne bandaże! U Mio kupisz tylko towar najwyższej próby.",
        "Witaj! Pokaż, co znalazłeś w kniei — płacę uczciwie brzęczącą monetą za rzadkie składniki.",
        "Potrzebujesz zapasów na drogę? Bez dobrej mikstury w ostępy Verdantii lepiej się nie zapuszczać.",
      ],
      rumors: [
        "Mówią, że w Mszanej Przystani rybacy wyławiają bursztyny wielkości pięści z zatopionych korzeni.",
        "Stara Kuźnia Żywego Korzenia na wschodzie wciąż dymi w bezwietrzne noce, choć mistrz kowalski odszedł stamtąd lata temu.",
        "Kupcy szeptają, że na szlaku do Kamiennego Sadu grasuje złodziej kradnący wyłącznie nasiona świecących mchów.",
      ],
      quests: {
        "S-V01": {
          questId: "S-V01",
          before:
            "Brakuje mi mchowej galaretki do wywaru leczniczego. Czy przyniesiesz mi kilka próbek od szlamaków z doliny?",
          during:
            "Szukaj szlamaków w wilgotnych parowach na zachód od osady. Uważaj, by galaretka nie wyschła!",
          after:
            "Świetny materiał! Teraz uwarzę maści, które postawią na nogi każdego zmęczonego zwiadowcę.",
        },
        "S-V02": {
          questId: "S-V02",
          before:
            "Zasadziłam lecznicze zioła przy południowym strumieniu, ale zagnieździły się tam jadowite żądła. Pomóż mi je zebrać.",
          during:
            "Uważaj na brzęczące osy przy zaroślach. Chodzi o zebranie świeżych liści i oczyszczenie terenu.",
          after:
            "Zapach tych ziół przywraca siły od samego wdechu. Masz tu swoją dolę monet i miksturę na drogę.",
        },
        "S-V05": {
          questId: "S-V05",
          before:
            "Karawana handlowa utknęła na starym nasypie przez rozszalałe korzeniowce. Zabezpiecz ładunek rzadkich korzeni.",
          during: "Rozprosz korzeniowce wokół wozów i przynieś mi plombowaną skrzynię z nasionami.",
          after: "Wszystkie nasiona nienaruszone! Uratowałeś mój miesięczny dochód, wędrowcze.",
        },
      },
    },
    "npc-taro": {
      npcId: "npc-taro",
      npcName: "Taro",
      cityId: "verdant-zielona-przystan",
      role: "Mistrz Kowal Korzeni",
      greetings: [
        "Uderzaj w żelazo póki tętni w nim energia KI! W czym mogę ci pomóc?",
        "Ostrza z zielonej żywicy nie pękają pod żadnym ciosem. Szukasz solidnego oręża?",
        "Witaj przy kowadle. Dym z żywicznego drewna dobrze robi na płuca i odstrasza leśne insekty.",
      ],
      rumors: [
        "W Kuźni Żywego Korzenia spoczywa matryca, która potrafi stopić stal bez użycia węgla, wyłącznie żarem żywicy.",
        "Powiadają, że na bagnach można znaleźć skamieniałe kły bestii twardsze niż zahartowany bazalt.",
        "Gdy rzeka opada po ulewach, przy Mostach ukazują się ślady dawnych wojennych rydwanów.",
      ],
      quests: {
        "S-V03": {
          questId: "S-V03",
          before:
            "Moje zapasy twardej kory i kłów do oprawy rękojeści wyczerpały się. Zdobądź dla mnie materiał od leśnych drapieżników.",
          during:
            "Potrzebuję nienaruszonych kłów i włókien korzeniowych. Sprawdź okolice gęstwin na północ od kuźni.",
          after:
            "Te kły mają idealną strukturę. Wykuję z nich rękojeść, która nigdy nie wyślizgnie się z dłoni.",
        },
        "S-V06": {
          questId: "S-V06",
          before:
            "Chcę odtworzyć legendarny szmaragdowy miecz z Pierwszej Ery. Potrzebuję fragmentu żywego korzenia ze sławnej kuźni.",
          during:
            "Udaj się do Kuźni Żywego Korzenia i zbadaj pradawny piec. Przynieś mi nasyconą szlakę.",
          after:
            "Niewiarygodne! Żar w tym kruszcu wciąż pulsuje. Zaraz zabieram się do kucia prototypu oręża.",
        },
        "IC-01": {
          questId: "IC-01",
          before:
            "Kowale z Pyry przysłali wyzwanie rzemieślnicze. Musimy udowodnić wyższość żywicznego hartowania nad czystą lawą.",
          during: "Przygotuj wzorcowy stop oręża Verdantii do wysyłki na południowy kontynent.",
          after:
            "Mistrzowie z Kalderonu zaniemówili na widok elastyczności naszej klingi. Honor kowali Verdantii został obroniony!",
        },
      },
    },
    "npc-ren": {
      npcId: "npc-ren",
      npcName: "Ren",
      cityId: "verdant-zielona-przystan",
      role: "Zwiadowca Kręgu Żywych Szlaków",
      greetings: [
        "Cisza. W lesie najpierw słuchasz, potem patrzysz, a dopiero na końcu sięgasz po broń.",
        "Wróciłem ze zwiadu. Szlaki na północ stają się coraz bardziej zdradliwe.",
        "Witaj, cichy wędrowcze. Twoje kroki są lekkie, a to rzadka zaleta w tych czasach.",
      ],
      rumors: [
        "Widziałem ze szczytu dębów dziwne światła wokół Mostu Splątanych Korzeni. To nie były świetliki ani ogniska kłusowników.",
        "W zaroślach niedaleko Kamiennego Sadu odnaleziono opuszczony obóz zwiadowców z emblematem dawnego królestwa.",
        "Puchacze pyłowe krążą nad starymi kurhanami. Gdy te ptaki nie śpią za dnia, w ziemi budzi się coś niespokojnego.",
      ],
      quests: {
        "S-V04": {
          questId: "S-V04",
          before:
            "Zauważyłem tropy leśnych pająków wokół zachodniego duktu. Sprawdź ich gniazdo i zabezpiecz ścieżkę zwiadowczą.",
          during:
            "Gniazdo znajduje się pod wykrotem starego wiązu. Wytnij kokony i zlikwiduj pajęcze straże.",
          after: "Ścieżka zwiadu jest czysta. Znakomicie poruszasz się w gęstwinie.",
        },
        "S-V07": {
          questId: "S-V07",
          before:
            "Zaginął jeden z naszych młodszych tropicieli. Ostatni raz widziano go przy zwalonym pniu na wschodnich mokradłach.",
          during:
            "Podążaj za śladami złamanych gałęzi ku bagnom. Miejmy nadzieję, że chłopak jeszcze żyje.",
          after:
            "Odnaleziony i bezpieczny w chacie medyka. Verdantia nie zapomina o tych, którzy ratują jej synów.",
        },
        "S-V08": {
          questId: "S-V08",
          before:
            "Wataha puchaczy pyłowych zaślepia wędrowców pyłkami ze swoich piór. Musimy ukrócić ich agresję na głównym szlaku.",
          during:
            "Puchacze gnieżdżą się w koronach drzew przy starym trakcie. Wywabić je możesz tylko dźwiękiem rogu.",
          after:
            "Niebo nad traktem znowu jest czyste. Podróżni nie muszą już obawiać się pyłowego zaślepienia.",
        },
        "H-V04": {
          questId: "H-V04",
          before:
            "Odkryłem ukryte przejście w korzeniach najstarszego dębu. Legenda mówi o sanktuarium pradawnego strażnika puszczy.",
          during:
            "Wejdź w szczelinę między korzeniami. Zapal żywiczną pochodnię, by nie zabłądzić w plątaninie korytarzy.",
          after:
            "Skarb pradawnych strażników ujrzał światło dzienne. Znalazłeś artefakt, który pamięta narodziny kontynentu.",
        },
        "IC-07": {
          questId: "IC-07",
          before:
            "Doniesienia z Wysp Pośrednich mówią o dziwnych prądach morskich spychających łodzie w stronę Wielkiego Wiru.",
          during: "Zbadaj wybrzeże i zbierz dane nawigacyjne od przybrzeżnych obserwatorów.",
          after:
            "Mapy prądów zostały zaktualizowane. To bezcenna wiedza przed planowaną ekspedycją oceaniczną.",
        },
      },
    },
    "npc-nela": {
      npcId: "npc-nela",
      npcName: "Nela (Przewoźniczka)",
      cityId: "verdant-przystan-trzech-mostow",
      role: "Przewoźniczka Rzeczna i Kurierka",
      greetings: [
        "Woda płynie wartko, ale moja łódź nigdy nie zawodzi. Dokąd chcesz się przeprawić?",
        "Przystań Trzech Mostów wita wędrowca! Rzeka to najszybsza droga przez gęste ostępy Verdantii.",
        "Witaj! Uważaj na śliskie deski pomostu — rzeka wezbrała po wczorajszych opadach w górnym biegu.",
      ],
      rumors: [
        "Pod Trzema Mostami żyją sumy tak olbrzymie, że potrafią wywrócić pustą łódź. Żywią się żywicznymi orzechami.",
        "Na drugim brzegu, tuż za trzcinami, znajduje się zapomniany ołtarz rzecznego ducha, gdzie dawniej składano lilie wodne.",
        "Most Splątanych Korzeni widać stąd o zmierzchu — korzenie świecą wtedy bladym, szmaragdowym blaskiem.",
      ],
      quests: {
        "S-V09": {
          questId: "S-V09",
          before:
            "Rzeka naniosła pnie i zablokowała środkowe przęsło mostu. Potrzebuję kogoś silnego, by rozbił zator i odpędził rzeczne pełzacze.",
          during:
            "Zejdź na płyciznę przy filarach mostu. Oczyść koryto i uważaj na wiry pod filarem.",
          after:
            "Nurt znów płynie swobodnie! Łodzie handlowe mogą bezpiecznie cumować przy naszych pomostach.",
        },
        "S-V10": {
          questId: "S-V10",
          before:
            "Muszę dostarczyć pilną przesyłkę z lekarstwami do odciętej osady rybackiej. Czy podejdziesz wzdłuż szuwarów?",
          during:
            "Droga brzegiem jest podmokła. Uważaj na błotne zasadzki i dostarcz pakunek w całości.",
          after:
            "Rybacy dziękują ci ze łzami w oczach. Bez tych lekarstw gorączka z bagien zabrałaby niejedno życie.",
        },
        "H-V01": {
          questId: "H-V01",
          before:
            "Znalazłam w mule rzecznym starożytną tabliczkę z wyrytą mapą zalanej pieczary. Czy odważysz się tam zajrzeć?",
          during:
            "Jaskinia znajduje się za kurtyną wodospadu na północ od przystani. Weź ze sobą zapas powietrza.",
          after:
            "Niewiarygodne! Zatopiony ołtarz krył nienaruszony kryształ czystej energii wodnej.",
        },
      },
    },
    "npc-oren": {
      npcId: "npc-oren",
      npcName: "Oren (Kartograf Osady)",
      cityId: "verdant-kamienny-sad",
      role: "Starszy Mierniczy i Rzemieślnik",
      greetings: [
        "Kamień milczy, ale pamięta więcej niż najstarsze księgi. Witaj w Kamiennym Sadzie.",
        "Każda rysa na tych głazach to zapis dawnych trzęsień i przemian KI. Co sprowadza cię w nasze skromne progi?",
        "Witaj, podróżniku. Jeśli szukasz dokładnych map tutejszych wąwozów, trafiłeś pod właściwy adres.",
      ],
      rumors: [
        "Głazy w Kamiennym Sadzie nie leżą tu przypadkowo — to pradawny kalendarz astronomiczny dawnych Planetarnych.",
        "Wąwóz Cieni na wschodzie odbija echa kroków, nawet gdy nikt w nim nie idzie. Miejscowi omijają go po zmroku.",
        "Kuźnia Żywego Korzenia była niegdyś połączona podziemnym kanałem z naszymi kamieniołomami.",
      ],
      quests: {
        "S-V11": {
          questId: "S-V11",
          before:
            "Skalne jelenie zniszczyły moje punkty triangulacyjne na wzgórzach. Muszę odnowić pomiary granicy lasu.",
          during:
            "Odwiedź trzy punkty pomiarowe na skalnych graniach i odnotuj odczyty na pergaminie.",
          after:
            "Pomiary są kompletne! Dzięki tobie nowa mapa wschodniej Verdantii będzie najdokładniejsza od stuleci.",
        },
        "H-V02": {
          questId: "H-V02",
          before:
            "Jeden z głazów w sadzie ma wydrążony otwór pasujący do runicznego klucza. Odszukaj brakujący fragment w wąwozie.",
          during:
            "Klucz runiczny został porzucony w starym legowisku bestii. Odszukaj go i dopasuj do monolitu.",
          after:
            "Mechanizm zaskoczył! Wewnątrz głazu spoczywał pradawny traktat o harmonii kamienia i drzewa.",
        },
      },
    },
    "npc-lina": {
      npcId: "npc-lina",
      npcName: "Lina (Strażniczka Latarni)",
      cityId: "verdant-latarnia-korzeni",
      role: "Opiekunka Północnych Szlaków",
      greetings: [
        "Dopóki ogień latarni płonie, żaden wędrowiec nie zginie w północnych moczarach. Witaj!",
        "Witaj na północnej rubieży. Wiatr od morza niesie chłód, ale w cieple latarni zawsze znajdziesz schronienie.",
        "Krocz ostrożnie po wąskich stopniach. Widok ze szczytu latarni obejmuje całą zieloną koronę Verdantii.",
      ],
      rumors: [
        "Gdy w nocy patrzy się z latarni na północ, na horyzoncie majaczą kontury Latających Wysp Mędrców z Aetherii.",
        "Pod fundamentami latarni znajduje się naturalna szczelina geotermalna, która zasila jej wieczny płomień.",
        "W starym gnieździe puchaczy na klifie znaleziono pierścień z herbem dawnego admirała floty handlowej.",
      ],
      quests: {
        "S-V12": {
          questId: "S-V12",
          before:
            "Olej żywiczny do zasilania zwierciadła latarni kończy się. Przynieś mi czystą żywicę z prastarych sosen na klifie.",
          during:
            "Żywicę zbieraj tylko z naciętych pni oznaczonych znakiem strażników. Uważaj na strome zbocza.",
          after:
            "Zwierciadło lśni pełnym blaskiem! Dziękuję ci w imieniu wszystkich żeglarzy i wędrowców nocy.",
        },
        "H-V03": {
          questId: "H-V03",
          before:
            "Zauważyłam jaskinię odsłoniętą przez ostatnie oberwanie klifu pod latarnią. Wygląda na zapomniany skład rozbitków.",
          during:
            "Zejdź po linie na półkę skalną i zbadaj wejście do jaskini. Miej broń w pogotowiu.",
          after:
            "Odnaleźliśmy skrzynię nawigatora z nienaruszonym kompasem i zapiskami o sekretnych zatokach!",
        },
      },
    },
  },
};
