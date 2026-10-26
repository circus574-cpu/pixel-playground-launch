import { ContinentDialogueCatalog } from "./types";

export const NEXUS_DIALOGUES: ContinentDialogueCatalog = {
  continent: "nexus",
  dialogues: {
    "npc-lyra7": {
      npcId: "npc-lyra7",
      npcName: "LYRA-7",
      cityId: "nexus-wezel-swiadomosci",
      role: "Przewodniczka Węzła Świadomości",
      greetings: [
        "Identyfikator zatwierdzony. Węzeł Świadomości Nexus-9 wita jednostkę organiczną/syntetyczną.",
        "Witaj w Sektorze Pierwszym. Wszystkie procesy logiczne przebiegają zgodnie z protokołem stabilności.",
        "Skaner biometryczny wykazuje stabilny poziom energii KI. Przystąp do transmisji parametrów zapytania.",
      ],
      rumors: [
        "Laboratorium Rdzenia Zero na zachodzie wciąż emituje harmoniczne fale promieniowania z pierwszego cyklu aktywacji.",
        "Reaktor Pulsacyjny Sektora Centralnego wytwarza 80% energii dla podziemnych linii przesyłowych całego kontynentu.",
        "W Terminalu Zaginionych Danych zachowały się wpisy w kodzie binarnym z czasów przed wybudowaniem pierwszych cytadel.",
      ],
      quests: {
        "O-N01": {
          questId: "O-N01",
          before:
            "Protokół powitalny: zwiadowcze drony i pełzacze serwisowe w sektorze wejściowym wykazują błędy oprogramowania. Dokonaj ich formatowania.",
          during:
            "Zlokalizuj niestabilne jednostki na obrzeżach Węzła i zneutralizuj ich jednostki logiczne.",
          after:
            "Formatowanie zakończone sukcesem. Sektor wejściowy osiągnął 99,8% wydajności operacyjnej.",
        },
        "O-N06": {
          questId: "O-N06",
          before:
            "Protokół Transcendencji: kryształ pamięci Pierwszego Architekta wymaga ponownej synchronizacji z głównym serwerem.",
          during:
            "Wprowadź kody autoryzacji do czterech terminali brzegowych i ustabilizuj przepływ danych w komorze rdzenia.",
          after:
            "Synchronizacja globalna zakończona! Zyskałeś status Honorowego Administratora Węzła Nexus-9.",
        },
        M20: {
          questId: "M20",
          before:
            "Kryształ Pamięci Pierwszego Architekta na południu przechowuje zapisy o genezie sztucznej energii KI. Pobierz kopię zapasową.",
          during:
            "Zejdź do podziemnego skarbca danych i podłącz moduł transmisyjny do centralnego monolitu.",
          after:
            "Dane pobrane i zaszyfrowane. Wiedza o początkach Androidów jest bezpieczna w archiwach Węzła.",
        },
        "S-N07": {
          questId: "S-N07",
          before:
            "Rój nanitów rozprzestrzenia się w szybie wentylacyjnym sektora mieszkalnego. Zastosuj impuls dezaktywujący.",
          during:
            "Zejdź do szybu z emiterem zakłóceń elektromagnetycznych i rozprosz skupiska nanitów.",
          after:
            "Szyby wentylacyjne oczyszczone. Przepływ powietrza i chłodziwa powrócił do normy.",
        },
        "H-N01": {
          questId: "H-N01",
          before:
            "Wykryto anomalię w podsieci czwartej — ukryty bufor danych nieodnotowany w oficjalnych rejestrach. Zbadaj jego zawartość.",
          during:
            "Przełam zaporę logiczną za pomocą deszyfratora i odczytaj ukryty blok pamięci operacyjnej.",
          after:
            "Odnaleziono dziennik jednostki prototypowej zawierający algorytmy zwiększające regenerację energii o 15%!",
        },
      },
    },
    "npc-mira2": {
      npcId: "npc-mira2",
      npcName: "MIRA-2",
      cityId: "nexus-wezel-swiadomosci",
      role: "Kwatermistrzyni Magazynu Modułów",
      greetings: [
        "Zapas ogniw, kondensatorów i pasty termoprzewodzącej gotowy do dystrybucji. Co zamawiasz?",
        "Wymiana barterowa lub płatność kredytami. Towary w moim magazynie posiadają certyfikat zerowej awaryjności.",
        "Witaj, jednostko. Przed wyruszeniem poza obwód ochronny upewnij się, że twoje akumulatory są naładowane.",
      ],
      rumors: [
        "W Kuźni Obwodów spawacz KOR-9 konstruuje pancerze ze stopu tytanu i przewodników nadprzewodzących.",
        "W Zardzewiałym Doku handlarze sprzedają zużyte baterie plazmowe, które po regeneracji mają dwukrotnie większą pojemność.",
        "Wieża Sygnałowa na wschodzie rejestruje regularne impulsy dochodzące z dna oceanu między kontynentami.",
      ],
      quests: {
        "S-N01": {
          questId: "S-N01",
          before:
            "Brakuje nam czystego złomu i sprawnych cewek do naprawy jednostek pomocniczych. Pozyskaj je z uszkodzonych robotów na złomowisku.",
          during:
            "Przeszukaj sterty części na zachodnim złomowisku. Uważaj na autonomiczne pająki spawalnicze.",
          after:
            "Materiał spełnia wszystkie normy techniczne. Jednostki pomocnicze zostaną zmontowane przed końcem cyklu.",
        },
        "S-N10": {
          questId: "S-N10",
          before:
            "Transport akumulatorów wysokiego napięcia utknął na szlaku przesyłowym z powodu awarii zasilacza. Zabezpiecz ładunek.",
          during:
            "Odszukaj opuszczoną platformę transportową i podłącz zapasowy kabel uziemiający przed przegrzaniem ogniw.",
          after:
            "Ogniwa ocalone przed eksplozją termiczną. Twoja precyzja i czas reakcji zasługują na premię kredytową.",
        },
      },
    },
    "npc-hef4": {
      npcId: "npc-hef4",
      npcName: "HEF-4",
      cityId: "nexus-wezel-swiadomosci",
      role: "Inżynier Rdzeni i Uzbrojenia",
      greetings: [
        "Moc wyjściowa: 100%. Kalibracja działka plazmowego: idealna. Czego potrzebujesz, rekrucie?",
        "Współczynniki tarcia zminimalizowane, przewodność maksymalna. Pokaż mi swój oręż, a zoptymalizuję jego parametry.",
        "Witaj w laboratorium inżynieryjnym. Pamiętaj o noszeniu okularów z filtrem polaryzacyjnym przy łuku plazmowym.",
      ],
      rumors: [
        "Reaktor Pulsacyjny posiada rezerwę mocy zdolną zasilić działo orbitalne, o ile takie kiedykolwiek istniało.",
        "W starych schematach odkryto projekt wibro-ostrza zasilanego mikro-reaktorem fuzji zimnej.",
        "W kanałach serwisowych pod Stacją Meridian żyją cybernetyczne gryzonie pochłaniające izolację kabli miedzianych.",
      ],
      quests: {
        "O-N02": {
          questId: "O-N02",
          before:
            "Do budowy nowego stabilizatora strumienia potrzebuję rdzeni plazmowych od wieżyczek autonomicznych na poligonie.",
          during:
            "Zneutralizuj wieżyczki bojowe w sektorze testowym i wymontuj nieuszkodzone rdzenie z ich komór.",
          after:
            "Rdzenie w idealnym stanie! Nowy generator impulsów plazmowych będzie gotowy do montażu w pancerzach.",
        },
        "S-N02": {
          questId: "S-N02",
          before:
            "Skaner gąsienicowy na północnym szlaku zaciął się w pętli decyzyjnej i atakuje konwoje. Przeprowadź twardy reset.",
          during:
            "Podejdź od tyłu do maszyny i wciśnij awaryjny wyłącznik zasilania lub zniszcz układ sterowania.",
          after:
            "Maszyna została zresetowana i powróciła do bazy. Uniknęliśmy poważnych strat w zaopatrzeniu.",
        },
        "S-N08": {
          questId: "S-N08",
          before:
            "Potrzebuję elektrod ze stopu wolframu z porzuconego magazynu transformatorów. Zdobądź je z wnętrza instalacji.",
          during:
            "Uważaj na wysokie napięcie w kałużach wody destylowanej. Wyłącz główny bezpiecznik przed demontażem.",
          after: "Elektrody dostarczone. Nasze działa zyskają o 20% większy zasięg efektywny.",
        },
        "H-N02": {
          questId: "H-N02",
          before:
            "Znalazłem w bazie danych koordynaty zablokowanego laboratorium badawczego pod Reaktorem. Złam kod zabezpieczający.",
          during:
            "Wprowadź sekwencję Fibonacciego w konsoli wejściowej i zbadaj wnętrze kriokomory.",
          after:
            "Odnaleziono prototypowy moduł tarczy hardlight zasilany bezpośrednio z rezerwy KI użytkownika!",
        },
        "IC-04": {
          questId: "IC-04",
          before:
            "Protokół wymiany technologicznej: przekaż akumulatory plazmowe kowalom z Pyry w zamian za próbki żaroodpornego bazaltu.",
          during:
            "Dostarcz zapieczętowany kontener do punktu granicznego w Porcie Czerwonych Żagli.",
          after:
            "Próbki bazaltu dotarły do laboratorium. Nasze osłony termiczne będą odporne na każdą temperaturę.",
        },
      },
    },
    "npc-axon": {
      npcId: "npc-axon",
      npcName: "AXON",
      cityId: "nexus-wezel-swiadomosci",
      role: "Koordynator Zwiadu Zewnętrznego",
      greetings: [
        "Zasięg radarów: pełny. Obwód zewnętrzny zabezpieczony. Raportuj stan gotowości bojowej.",
        "Witaj, jednostko operacyjna. Poza barierą energetyczną czyhają mechaniczne drapieżniki pozbawione protokołów etycznych.",
        "Wykryto obecność jednostki sojuszniczej. Przejdź do odprawy taktycznej przed wyjściem w teren.",
      ],
      rumors: [
        "Psy-łowcy w ruinach polują na wszelkie źródła ciepła — najłatwiej zmylić je, stosując race fosforowe lub granaty dymne.",
        "Terminal Zaginionych Danych próbuje nadawać sygnał ratunkowy od stu dwudziestu lat, lecz nikt nie zna hasła zwrotnego.",
        "Latarnia plazmowa w porcie jest zasilana z kabla podmorskiego biegnącego w stronę wysp centralnych.",
      ],
      quests: {
        "O-N03": {
          questId: "O-N03",
          before:
            "Stado cybernetycznych psów-łowców zaatakowało wysunięty posterunek nasłuchowy. Wyrusz natychmiast i odeprzyj atak.",
          during:
            "Psy poruszają się z dużą prędkością. Użyj ataków obszarowych, by przerwać ich koordynację w stadzie.",
          after:
            "Posterunek ocalony, a łączność radiowa z północnymi rubieżami została w pełni przywrócona.",
        },
        M10: {
          questId: "M10",
          before:
            "Laboratorium Rdzenia Zero wymaga pobrania próbek stabilnego kondensatu energetycznego. Zadanie wysokiego ryzyka.",
          during: "Wejdź do komory reaktora w laboratorium i napełnij kriofiolkę płynnym izotopem.",
          after:
            "Próbka zabezpieczona w ołowianym pojemniku. Te dane pozwolą udoskonalić ogniwa całej armii.",
        },
        "S-N04": {
          questId: "S-N04",
          before:
            "Dron zwiadowczy z cennymi danymi kartograficznymi rozbił się w kanionie kablowym. Odzyskaj czarną skrzynkę.",
          during:
            "Wrak leży na dnie szczeliny. Uważaj na spadające kable pod wysokim napięciem i dzikie roboty.",
          after:
            "Czarna skrzynka nienaruszona! Mapy zewnętrznych sektorów zostały zaktualizowane o nowe przejścia.",
        },
      },
    },
    "npc-eko0": {
      npcId: "npc-eko0",
      npcName: "Eko-0 (Jednostka Serwisowa)",
      cityId: "nexus-stacja-meridian",
      role: "Rzecznik Wolnych Jednostek Serwisowych",
      greetings: [
        "Witaj na Stacji Meridian. Tutaj naprawiamy to, co inni uznali za bezużyteczny złom.",
        "Każda śrubka i każdy tranzystor zasługuje na drugą szansę. Jak możemy ci dziś pomóc?",
        "Witaj, przyjacielu mechaniki. W naszych warsztatach zawsze znajdziesz wolny klucz francuski i lutownicę.",
      ],
      rumors: [
        "Stacja Meridian powstała na konstrukcji dawnego pociągu maglev, który kursował w podziemiach kontynentu.",
        "W kanałach odwadniających pod stacją zbiera się emulsja chłodząca o właściwościach przyspieszających regenerację obwodów.",
        "Reaktor Pulsacyjny w nocy słychać stąd jako głęboki, uspokajający pomruk o częstotliwości 50 Hz.",
      ],
      quests: {
        "S-N03": {
          questId: "S-N03",
          before:
            "Główna pompa chłodziwa na stacji przegrzewa się. Potrzebujemy świeżego płynu z instalacji w opuszczonym reaktorze.",
          during:
            "Pobierz płyn z zaworu bezpieczeństwa reaktora i dostarcz go do zbiornika na stacji przed upływem limitu czasu.",
          after:
            "Temperatura pompy spadła do normy roboczej! Cała stacja uniknęła awaryjnego wyłączenia systemów.",
        },
        "S-N11": {
          questId: "S-N11",
          before:
            "Jednostka serwisowa numer 12 została uwięziona przez zawał rur w starym tunelu przesyłowym. Uwolnij naszego towarzysza.",
          during:
            "Użyj ciężkiego oręża, by rozbić stalowe dźwigary i odprowadzić robota do strefy bezpieczeństwa.",
          after:
            "Jednostka 12 znów z nami! Wolne jednostki serwisowe nigdy nie zapomną twojej bezinteresownej pomocy.",
        },
        "H-N04": {
          questId: "H-N04",
          before:
            "Za starym transformatorem odkryłem właz do zapomnianego schronu technicznego z czasów budowy magistrali. Zbadaj go.",
          during:
            "Otwórz zardzewiałą śluzę pneumatyczną i przeszukaj szafki narzędziowe wewnątrz schronu.",
          after:
            "Wspaniałe znalezisko! Oryginalne schematy montażowe pancerzy tytanowych i komplet kluczy z nanodiamentu.",
        },
      },
    },
    "npc-nexus-welder": {
      npcId: "npc-nexus-welder",
      npcName: "KОР-9 (Mistrz Spawu)",
      cityId: "nexus-kuznia-obwodow",
      role: "Specjalista Ogniw i Przewodników R-01/R-04",
      greetings: [
        "Bzzzt! Uwaga na iskry łuku plazmowego! Witaj w Kuźni Obwodów.",
        "Spaw plazmowy nie pęka nawet pod ciśnieniem miliona atmosfer. Co mamy dziś połączyć?",
        "Witaj! Temperatura w kuźni wynosi stałe 400 stopni. Dla androida to optymalne warunki pracy.",
      ],
      rumors: [
        "W głębi kuźni stoi piec indukcyjny zdolny wytapiać pancerze z czystego grafenu domieszkowanego borem.",
        "Pod fundamentami kuźni przebiega główna magistrala danych R-04 łącząca Nexus z podmorskimi kablami.",
        "Kruk danych widywany na dachu kuźni nie jest zwykłym ptakiem — to autonomiczny dron szpiegowski dawnej korporacji.",
      ],
      quests: {
        "O-N04": {
          questId: "O-N04",
          before:
            "Magistrala przesyłowa uległa przerwaniu w trzech miejscach. Musimy zespawać przewody nadprzewodzące w tunelu.",
          during:
            "Zejdź do tunelu kablowego z palnikiem plazmowym i połącz zerwane złącza w oznaczonych punktach.",
          after: "Magistrala znowu przesyła pełną moc! Światła w całym sektorze przestały migotać.",
        },
        "S-N05": {
          questId: "S-N05",
          before:
            "Do hartowania złączy potrzebuję ciekłego azotu ze stacji kriogenicznej. Przynieś mi bezpieczny termos z lodem.",
          during:
            "Pobierz ciekły azot ze zbiornika kriogenicznego. Uważaj na wycieki gazu i zamrożone przeszkody.",
          after:
            "Azot na miejscu! Teraz złącza uzyskają nadprzewodnictwo w temperaturze pokojowej.",
        },
        "S-N09": {
          questId: "S-N09",
          before:
            "Złomiarze zepsuli automatyczną linię spawalniczą. Zastąp uszkodzone ramiona robotów nowymi siłownikami.",
          during:
            "Zamontuj cztery siłowniki hydrauliczne na ramionach manipulatorów i skalibruj kąt zgięcia.",
          after:
            "Linia spawalnicza ruszyła pełną parą! Produkcja nowych płyt pancernych wzrosła dwukrotnie.",
        },
        "H-N03": {
          questId: "H-N03",
          before:
            "Pod starym paleniskiem indukcyjnym odkryłem zapomnianą skrytkę z nanitami montażowymi. Wydobądź ten pojemnik.",
          during:
            "Użyj manipulatora magnetycznego, by wyciągnąć zasobnik z głębokiej szczeliny termicznej.",
          after:
            "Pojemnik jest pełen aktywnych nanitów budowlanych! To przyspieszy naprawy oręża o połowę.",
        },
        "IC-08": {
          questId: "IC-08",
          before:
            "Projekt połączenia magistrali energetycznej z podziemiami Pyry: przygotuj złącza odporne na strumienie lawy.",
          during:
            "Wytop partię dwudziestu złączy z węglika krzemu i dostarcz je do punktu styku w kanionie granicznym.",
          after:
            "Złącza wytrzymały próbę lawy! Pierwsza międzykontynentalna linia energetyczna została połączona.",
        },
      },
    },
    "npc-nexus-portmaster": {
      npcId: "npc-nexus-portmaster",
      npcName: "VEX-3 (Nawigator Portu Zerowego)",
      cityId: "nexus-port-zerowy",
      role: "Dowódca Zabezpieczenia Szlaków Wschodnich",
      greetings: [
        "Port Zerowy przyjmuje statki transportowe i barki kontenerowe. Przedstaw manifest ładunkowy.",
        "Witaj na wschodnim nabrzeżu. Woda morska w połączeniu z plazmą daje widowiskowe wyładowania świetlne.",
        "Wszystkie dźwigi przeładunkowe pracują na maksymalnych obrotach. Szukasz transportu morskiego?",
      ],
      rumors: [
        "Na horyzoncie widać czasami światła Wielkiego Wiru — według sensorów wir emituje zakłócenia kwantowe.",
        "Na dnie basenu portowego spoczywa zatopiona barka z ładunkiem nienaruszonych rdzeni pamięci z Pierwszej Ery.",
        "Wokół latarni plazmowej gromadzą się ryby o świecących łuskach, które żywią się wyciekami jonowymi.",
      ],
      quests: {
        "O-N05": {
          questId: "O-N05",
          before:
            "Latarnia plazmowa na falochronie straciła synchronizację fazową. Wprowadź nowe parametry częstotliwości na wieży.",
          during:
            "Wejdź po stalowych klamrach na szczyt latarni i wpisz kod rezonansu na pulpicie sterowniczym.",
          after:
            "Snop plazmy rozciąga się na pięćdziesiąt mil morskich! Statki handlowe widzą już bezpieczny tor wodny.",
        },
        "S-N06": {
          questId: "S-N06",
          before:
            "Morskie drapieżniki uszkodziły podwodny kabel zasilający dźwigi portowe. Zanurkuj i nałóż mufę ochronną.",
          during:
            "Zejdź na dno basenu portowego w kombinezonie ciśnieniowym i zaciśnij klamrę mufy na kablu.",
          after:
            "Kabel zaizolowany, a dźwigi znów rozładowują kontenery z rudą bazaltu. Świetna robota podwodna!",
        },
        "S-N12": {
          questId: "S-N12",
          before:
            "Zautomatyzowana barka zboczyła z kursu i grozi uderzeniem w pirs główny. Wejdź na pokład i przejmij stery.",
          during:
            "Dostań się motorówką do burty barki, wejdź na mostek kapitański i wyłącz uszkodzonego autopilota.",
          after:
            "Barka bezpiecznie zacumowana przy pirsie trzecim. Katastrofa portowa została zażegnana w ostatniej chwili.",
        },
      },
    },
  },
};
