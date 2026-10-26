import { ContinentDialogueCatalog } from "./types";

export const AETHER_DIALOGUES: ContinentDialogueCatalog = {
  continent: "aether",
  dialogues: {
    "npc-sora": {
      npcId: "npc-sora",
      npcName: "Sora",
      cityId: "aether-sanktuarium-tysiaca-zrodel",
      role: "Opiekunka Sanktuarium i Kronik",
      greetings: [
        "Pokój twojej duszy, poszukiwaczu prawdy. Niechaj złote glify Aetherii rozjaśnią twoje myśli.",
        "Witaj w Sanktuarium Tysiąca Źródeł. Woda i wiatr śpiewają tu pieśń o pierwotnej harmonii kosmosu.",
        "Wycisz oddech i spójrz w chmury. W Aetherii każda odpowiedź przychodzi w chwili wewnętrznego spokoju.",
      ],
      rumors: [
        "W Sanktuarium Ciszy Dzwonu żaden dźwięk nie rozbrzmiał od stu lat — mówią, że gdy dzwon zadzwoni, zmieni się układ planet.",
        "Wielkie Archiwum Wiatru unosi się na wysokości, gdzie powietrze jest tak rzadkie, że myśli materializują się w postaci złotych iskier.",
        "W Zapomnianych Bibliotekach Siódmej Oktawy ukryto księgi zakazanej wiedzy, które same przewracają swoje karty.",
      ],
      quests: {
        "O-A01": {
          questId: "O-A01",
          before:
            "Czystość naszych źródeł została zakłócona przez świetliki pieczęci. Pomóż nam przywrócić pierwotną czystość rytualnych sadzawek.",
          during:
            "Obejdź dolne tarasy sanktuarium i użyj runicznego dzwonka, by zharmonizować rozproszone świetliki.",
          after:
            "Woda w sadzawkach znów lśni czystym blaskiem. Pierwszy krok na ścieżce mądrości został uczyniony.",
        },
        "O-A06": {
          questId: "O-A06",
          before:
            "Wielki Rytuał Siódmej Oktawy wymaga zjednoczenia wszystkich czterech żywiołów KI na szczycie Iglicy Świtu.",
          during:
            "Wznieś się na najwyższy podest świątyni. Skup całą energię duchową i poprowadź ceremonię zjednoczenia.",
          after:
            "Pieczęcie rezonują pełną harmonią! Zostałeś uznany za Pierwszego Mistrza Złotego Kręgu Aetherii.",
        },
        M19: {
          questId: "M19",
          before:
            "Pierwotne Źródło KI na południu zostało spowite gęstą mgłą zapomnienia. Odszukaj jego rdzeń i odczytaj pierwotną inskrypcję.",
          during:
            "Zejdź do świętej groty pod obłokami. Oczyść monolit z mchu i przepisz znaki na jedwabny zwój.",
          after:
            "Inskrypcja zawiera proroctwo o zjednoczeniu czterech ras. Twoje imię zapisano w Złotej Księdze Mędrców.",
        },
        "S-A08": {
          questId: "S-A08",
          before:
            "Duch dawnego bibliotekarza błąka się po ruinach lektorium. Pomóż mu odnaleźć spokój, odzyskując jego ulubiony kałamarz.",
          during:
            "Przeszukaj zgliszcza dawnego skryptorium. Uważaj na pergaminowych strażników chroniących wejścia.",
          after:
            "Duch uśmiechnął się i rozpłynął w porannej bryzie. W bibliotece znów panuje uświęcona cisza.",
        },
        "IC-10": {
          questId: "IC-10",
          before:
            "Wielka Narada Mędrców ze wszystkimi kontynentami wzywa posłańców. Zgromadź przedstawicieli kultur na neutralnym gruncie.",
          during:
            "Przygotuj ceremonialne dary ze złota i jedwabiu dla delegacji z Verdantii, Pyry i Nexusa.",
          after:
            "Narada zakończyła się podpisaniem Traktatu Świtu. Zjednoczyłeś serca mieszkańców całej planety.",
        },
      },
    },
    "npc-mei": {
      npcId: "npc-mei",
      npcName: "Mei",
      cityId: "aether-sanktuarium-tysiaca-zrodel",
      role: "Kustoszka Depozytu i Kupiec Kolegium",
      greetings: [
        "Kadzidła, pergaminy, kryształy medytacyjne — wszystko, czego potrzebuje adept sztuk wyższych, znajdziesz u Mei.",
        "Witaj! Pokaż mi rzadkie minerały z podniebnych urwisk, a sowicie cię wynagrodzę monetami i rzadkimi zwojami.",
        "Mądrość nie ma ceny, ale pergamin i atrament kosztują niemało. W czym mogę ci dziś usłużyć?",
      ],
      rumors: [
        "Kryształowe motyle żywią się pyłem gwiezdnym opadającym na Tarasy Świtu podczas przesilenia letniego.",
        "W Białej Przystani przewoźnik używa liny splecionej z chmur — mówią, że nie pęka pod żadnym ciężarem.",
        "Złoty skarabeusz znaleziony na stepach Aetherii potrafi wskazywać podziemne żyły płynnego KI.",
      ],
      quests: {
        M09: {
          questId: "M09",
          before:
            "Do sporządzenia atramentu kronikarskiego potrzebuję pyłu ze skrzydeł kryształowych motyli z podniebnych łąk.",
          during:
            "Motyle są płochliwe. Podejdź do nich cicho i zbierz pyłek za pomocą jedwabnej siatki.",
          after:
            "Cudowny, opalizujący pył! Kronikarze będą zachwyceni trwałością nowego atramentu.",
        },
        "S-A01": {
          questId: "S-A01",
          before:
            "Zapasy kadzideł w świątyni wyczerpały się. Zdobądź żywicę szafranową z drzew rosnących na krawędzi chmur.",
          during:
            "Drzewa szafranowe rosną na stromych zboczach. Zbieraj tylko zastygłe, bursztynowe krople.",
          after:
            "Ten zapach napełnia świątynię spokojem. Przyjmij zapłatę i błogosławieństwo kapłanek.",
        },
        "S-A10": {
          questId: "S-A10",
          before:
            "Zaginęła skrzynia z cennymi nefrytowymi figurkami przeznaczonymi dla studentów akademii. Sprawdź trakt ku Białej Przystani.",
          during:
            "Tropy prowadzą ku skalnemu urwisku. Przepędź szmaragdowe węże i odzyskaj ładunek.",
          after:
            "Figurki są nienaruszone! Studenci będą mogli kontynuować swoje ćwiczenia skupienia energii.",
        },
      },
    },
    "npc-enso": {
      npcId: "npc-enso",
      npcName: "Enso",
      cityId: "aether-sanktuarium-tysiaca-zrodel",
      role: "Mistrz Pieczęci i Kosturów",
      greetings: [
        "Równowaga jest wszystkim. Gdy pieczęć jest doskonała, żaden demon nie zdoła jej naruszyć.",
        "Witaj w pracowni pieczęci. Każda runa, którą tu kreślimy, to słowo wyjęte z samego serca wszechświata.",
        "Kostur to nie broń, lecz przedłużenie ramienia maga. Czy twój umysł jest gotów na głębsze wtajemniczenie?",
      ],
      rumors: [
        "Pieczęć chroniąca Wielkie Archiwum Wiatru wymaga odnawiania co dekadę poprzez intonowanie akordu F-dur.",
        "W ruinach Klasztoru Chmur spoczywa kostur pierwszego arcykapłana wykonany ze skamieniałego promienia słońca.",
        "Szmaragdowy wąż pilnujący wąwozów jest w rzeczywistości zaklętym strażnikiem dawnego skarbca.",
      ],
      quests: {
        "O-A02": {
          questId: "O-A02",
          before:
            "Pęknięcia na pieczęci wschodniej bramy grożą przeniknięciem cieni. Pomóż mi wyryć nowe znaki ochronne na kolumnach.",
          during:
            "Użyj rylca z białego złota i dokładnie odtwórz glify harmonii na czterech narożnych filarach.",
          after:
            "Brama znów promienieje złotą barierą. Ani jeden cień nie przedostanie się do wnętrza osady.",
        },
        "S-A02": {
          questId: "S-A02",
          before:
            "Do ukończenia mistrzowskiego kosturu potrzebuję piór mgielnego żurawia zebranego bez czynienia krzywdy ptakom.",
          during:
            "Szukaj gniazd żurawi na wysokich iglicach skalnych o świcie, gdy ptaki wyruszają na żer.",
          after:
            "Te pióra są miękkie jak puch, a przewodzą energię KI lepiej niż srebrny drut. Kostur będzie arcydziełem.",
        },
        "S-A09": {
          questId: "S-A09",
          before:
            "Zbuntowana marionetka rytuału uciekła z laboratorium i niszczy święte ogrody. Trzeba ją unieszkodliwić.",
          during:
            "Przetnij jej zasilające nici eteryczne za pomocą celnego cięcia i zabezpiecz rdzeń pamięci.",
          after:
            "Marionetka została opanowana. Jej rdzeń posłuży do ulepszenia mechanizmów obronnych kolegium.",
        },
        "H-A02": {
          questId: "H-A02",
          before:
            "Odnaleziono zatarte runy wskazujące na ukrytą komnatę medytacyjną pod ołtarzem głównym. Zbadaj ją dyskretnie.",
          during:
            "Wypowiedz hasło w starożytnym dialekcie Mędrców i zejdź spiralnymi schodami w dół.",
          after:
            "Niewiarygodne! Komnata kryła pierwotny rezonator fal KI i zapieczętowany kostur założyciela.",
        },
        "IC-03": {
          questId: "IC-03",
          before:
            "Inżynierowie z Nexus-9 poprosili o konsultację w sprawie izolacji ich generatorów plazmowych naszymi pieczęciami.",
          during: "Sporządź repliki glifów uziemiających i dostarcz je na stację graniczną.",
          after:
            "Naukowe obliczenia androidów potwierdziły skuteczność naszej magii. Most wiedzy został przerzucony.",
        },
      },
    },
    "npc-ishin": {
      npcId: "npc-ishin",
      npcName: "Ishin",
      cityId: "aether-sanktuarium-tysiaca-zrodel",
      role: "Strażnik Zewnętrznych Schodów",
      greetings: [
        "Schody do sanktuarium liczą tysiąc stopni. Każdy krok to próba pokory i wytrwałości. Witaj.",
        "Witaj, wędrowcze. Moja włócznia strzeże spokoju modlących się mędrców przed dzikimi bestiami z mgieł.",
        "Stój i przedstaw swoje intencje. W tych progach nie tolerujemy gniewu ani nieczystych myśli.",
      ],
      rumors: [
        "Gdy mgła opada ze Schodów, w przepaści pod mostem widać ruiny pierwszej świątyni zniszczonej przed wiekami.",
        "Lwy świątynne na zewnątrz nie są z kamienia — w chwilach wielkiego niebezpieczeństwa ożywają, by bronić kapłanów.",
        "Na Tarasach Świtu dzwony same wydają cichy ton przed nadejściem burzy energetycznej.",
      ],
      quests: {
        "O-A03": {
          questId: "O-A03",
          before:
            "Dzikie bestie mgielne zaczęły gromadzić się na półkach skalnych poniżej schodów. Oczyść dolne podejścia.",
          during: "Zejdź do mgielnej strefy i zlikwiduj drapieżniki atakujące pielgrzymów.",
          after: "Schody są bezpieczne. Pielgrzymi mogą bez obaw wznosić swoje modły ku niebiosom.",
        },
        "S-A07": {
          questId: "S-A07",
          before:
            "Jeden z mnichów zgubił swój ceremonialny różaniec ze szmaragdów podczas ucieczki przed drapieżnikiem. Odszukaj go.",
          during:
            "Przeszukaj krzewy jałowca przy pięćsetnym stopniu schodów. Uważaj na śliskie krawędzie urwiska.",
          after:
            "Różaniec powrócił do właściciela. Mnich obiecał modlić się o twoje powodzenie we wszystkich walkach.",
        },
        "H-A04": {
          questId: "H-A04",
          before:
            "W załomie skalnym za wodospadem na dziewięćsetnym stopniu odkryłem szczelinę prowadzącą do jaskini pustelnika.",
          during:
            "Przejdź za kurtynę wody i zbadaj kamienną pryczę pustelnika. Uważaj na wilgotne stopnie.",
          after:
            "Odnaleziono pamiętnik pustelnika opisujący sekretne techniki lewitacji i kontroli oddechu.",
        },
      },
    },
    "npc-nari": {
      npcId: "npc-nari",
      npcName: "Nari (Archiwistka)",
      cityId: "aether-tarasy-switu",
      role: "Opiekunka Zbiorów Prywatnych",
      greetings: [
        "Cicho, proszę... Nawet szelest papieru potrafi przerwać delikatną nić rozważań filozoficznych. Witaj.",
        "Witaj na Tarasach Świtu. W tym ogrodzie ksiąg każda myśl dojrzewa w cieple wschodzącego słońca.",
        "Kataloguję zbiory od pięćdziesięciu lat i wciąż odkrywam zwoje, o których istnieniu nikt nie pamiętał.",
      ],
      rumors: [
        "W Archiwum Nad Chmurami przechowują atlas gwiazd, na którym zaznaczono planety spoza naszego układu słonecznego.",
        "W ogrodzie Tarasów rośnie biała magnolia, która zakwita tylko wtedy, gdy w pobliżu przebywa człowiek o czystym sercu.",
        "Zwierciadlana Przystań odbija nie tylko światło słońca, lecz także projekcje myśli medytujących mędrców.",
      ],
      quests: {
        "S-A03": {
          questId: "S-A03",
          before:
            "Wilgoć z porannych mgieł zagraża najstarszym zwojom pergaminowym. Przynieś mi suche kryształy higroskopijne z jaskiń.",
          during:
            "Kryształy rosną w suchych kawernach na północnym zboczu. Zbierz dwanaście nieuszkodzonych narostów.",
          after:
            "Zwoje są bezpieczne! Suche kryształy wchłoną całą wilgoć i ocalą bezcenne teksty przed pleśnią.",
        },
        "S-A04": {
          questId: "S-A04",
          before:
            "Oko wiedzy w ogrodzie rozregulowało się i rzuca błędne projekcje astronomiczne. Skalibruj pryzmaty na tarasie.",
          during:
            "Obróć trzy szklane pryzmaty tak, by promień porannego słońca trafił w centralną soczewkę.",
          after:
            "Projekcja jest krystalicznie czysta! Konstelacje znów układają się we właściwym porządku.",
        },
        "H-A01": {
          questId: "H-A01",
          before:
            "Pomiędzy półkami z księgami natrafiłam na zamaskowane drzwi biblioteczne. Kluczem jest ułożenie tomów według barw widma.",
          during:
            "Ułóż księgi w kolejności od czerwieni do fioletu i przekręć mosiężną dźwignię ukrytą w regale.",
          after:
            "Drzwi ustąpiły! W tajnym archiwum spoczywały oryginalne mapy nieba Pierwszych Planetarnych.",
        },
      },
    },
    "npc-aether-ferryman": {
      npcId: "npc-aether-ferryman",
      npcName: "Kael (Przewoźnik Mgły)",
      cityId: "aether-biala-przystan",
      role: "Nawigator Białej Przystani",
      greetings: [
        "Wsiadaj do gondoli chmurowej i trzymaj się mocno lin. Lot nad przepaściami Aetherii zapiera dech w piersiach!",
        "Biała Przystań to brama do podniebnych szlaków. Chcesz wzbić się ku wyższym sanktuariom?",
        "Witaj! Wiatr dziś sprzyja żegludze powietrznej. Żagle z jedwabiu łapią każdy powiew prądów wstępujących.",
      ],
      rumors: [
        "Pod Białą Przystanią leży przepaść bez dna — mówią, że kto w nią wpadnie, spada w nieskończoność przez krainę marzeń.",
        "W bezwietrzne dni z gondoli można dostrzec ruiny Archiwum Siódmej Oktawy zawieszone na samotnym skalnym filarze.",
        "Nawigatorzy widzieli smoka Aurelitha szybującego w chmurach o zachodzie słońca — jego łuski lśniły niczym czyste złoto.",
      ],
      quests: {
        "O-A04": {
          questId: "O-A04",
          before:
            "Lina nośna głównej gondoli uległa przetarciu przez ostre skały. Potrzebujemy mocnego jedwabiu od podniebnych pająków.",
          during:
            "Zapoluj na pająki na urwiskach i zbierz nieprzerwane zwoje srebrzystego jedwabiu.",
          after:
            "Lina została wymieniona i wzmocniona. Gondola może znowu bezpiecznie przewozić podróżnych.",
        },
        "S-A05": {
          questId: "S-A05",
          before:
            "Gęsta mgła sparaliżowała ruch na przystani. Musimy zapalić lampy sygnałowe na trzech samotnych iglicach.",
          during:
            "Dostań się do iglic sygnałowych i rozpal ogień w mosiężnych koszach za pomocą iskier KI.",
          after:
            "Światła przebiły mgłę! Nawigatorzy widzą już bezpieczną drogę do pomostów cumowniczych.",
        },
        "S-A11": {
          questId: "S-A11",
          before:
            "Skrzydlaty drapieżnik porwał skrzynię z pocztą dyplomatyczną. Wytrop jego gniazdo i odzyskaj zalakowane listy.",
          during:
            "Gniazdo znajduje się na niedostępnej półce skalnej. Użyj prądów wznoszących, by się tam dostać.",
          after:
            "Wszystkie listy wróciły do torby kurierskiej. Tajemnice państwowe Mędrców pozostały bezpieczne.",
        },
        "H-A03": {
          questId: "H-A03",
          before:
            "Prąd powietrzny zniósł wrak starożytnej barki podniebnej na opuszczoną wysepkę chmurową. Zbadaj jej szczątki.",
          during:
            "Wyląduj na ruchomej wysepce i przeszukaj ładownię wraku. Uważaj, bo grunt może się osunąć.",
          after:
            "Odnaleziono starożytny ster chmurowy z wbudowanym żyroskopem na bazie czystego kryształu eteru!",
        },
      },
    },
    "npc-aether-observer": {
      npcId: "npc-aether-observer",
      npcName: "Talen (Obserwator Niebios)",
      cityId: "aether-archiwum-nad-chmurami",
      role: "Strażnik Zwierciadeł Sygnałowych",
      greetings: [
        "Patrz w gwiazdy, a zobaczysz przeszłość i przyszłość zapisaną w układzie świateł. Witaj w Archiwum Nad Chmurami.",
        "Witaj na najwyższym punkcie Aetherii. Stąd ziemia wydaje się mała, a troski codzienne znikają bez śladu.",
        "Teleskopy i zwierciadła to moje oczy na wszechświat. Czy przyszedłeś badać ruch komet?",
      ],
      rumors: [
        "Zwierciadła sygnałowe mogą przesyłać wiadomości świetlne na odległość tysięcy mil w ułamku sekundy.",
        "Na szczycie Archiwum powietrze jest tak nasycone czystą energią, że rany goją się dwukrotnie szybciej niż na dole.",
        "Podobno Pierwotne Źródło KI na południu wysyła co noc impuls świetlny w stronę Wielkiego Wiru.",
      ],
      quests: {
        "O-A05": {
          questId: "O-A05",
          before:
            "Zwierciadło głównego teleskopu uległo zabrudzeniu przez pył kosmiczny. Oczyść je za pomocą specjalnej mikstury spirytusowej.",
          during:
            "Wejdź na szczyt kopuły obserwatorium i delikatnie przetrzyj soczewkę bawełnianą szmatką.",
          after:
            "Obraz jest nieskazitelny! Na dalekim horyzoncie dostrzegłem aktywność sejsmiczną w wulkanach Pyry.",
        },
        "S-A06": {
          questId: "S-A06",
          before:
            "Zanotowałem anomalię magnetyczną w pobliżu Archiwum Wiatru. Rozstaw czujniki rezonansowe wokół obserwatorium.",
          during:
            "Umieść cztery mosiężne iglice w oznaczonych punktach wokół platformy obserwacyjnej.",
          after:
            "Czujniki działają bez zarzutu. Dane o przepływie fal KI spływają prosto na tablice pomiarowe.",
        },
        "S-A12": {
          questId: "S-A12",
          before:
            "Młody adept astronomii zapatrzył się w gwiazdy i spadł na niższą półkę skalną. Sprowadź go bezpiecznie na górę.",
          during:
            "Zejdź z liną ratunkową na urwisko i zabezpiecz rannego chłopca przed wstrząsami.",
          after:
            "Adept jest cały i zdrowy, choć z pewnością zapamięta tę lekcję ostrożności na całe życie.",
        },
        "IC-05": {
          questId: "IC-05",
          before:
            "Projekt globalnej sieci zwierciadeł: nawiąż kontakt sygnałowy z Wieżą Sygnałową w Nexus-9 i Twierdzą Popiołu w Pyry.",
          during:
            "Skieruj zwierciadło główne na koordynaty partnerskich wież i nadaj kod zjednoczenia.",
          after:
            "Sygnał odebrany i potwierdzony przez oba kontynenty! Globalna łączność planety stała się faktem.",
        },
      },
    },
  },
};
