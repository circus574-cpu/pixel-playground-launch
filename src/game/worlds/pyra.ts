import { ContinentWorldData } from "./types";

export const PYRA_WORLD_DATA: ContinentWorldData = {
  id: "pyra",
  name: "Pyra",
  raceName: "Legendy",
  raceId: "legend",
  factionId: "F-P",
  factionName: "Przymierze Popiołu",
  themeSummary:
    "Wulkaniczne wyżyny, bazaltowe kolosy, areny prób honoru i żywa pamięć o ratownikach, którzy przedłożyli ludzkie życie nad ślepy rozkaz klanu.",
  historicalDebt:
    "Podczas dawnej erupcji zwycięski klan ogłosił tchórzami i dezerterami strażników, którzy złamali rozkaz utrzymania pozycji, aby otworzyć boczny korytarz ewakuacyjny dla cywilów.",
  size: [2400, 1792],
  spawn: { x: 1180, y: 1330 },
  cities: [
    {
      id: "pyra-twierdza-popiolu",
      name: "Twierdza Popiołu",
      continent: "pyra",
      role: "capital",
      isSafeZone: true,
      bounds: { x: 760, y: 400, width: 880, height: 980 },
      economicAndHistoricalFunction:
        "Stolica Pyry zbudowana wokół wielkiej Areny Dziedzictwa i północnego bastionu (fortress-0). Skupia wszystkie sześć głównych usług: sklep Yumi, wielką kuźnię Goro, depozyt klanowy, gospodę pod bazaltowym sklepieniem, tablicę prób i bezpieczne palenisko.",
      atmosphere:
        "Czarny polerowany bazalt, łopoczące na gorącym wietrze sztandary klanowe (detail-clan-banner-11..16) oraz pomarańczowy blask kanałów lawowych.",
      npcs: [
        {
          id: "npc-kaena",
          bindingId: "pyra.npc.guide",
          name: "Kaena",
          role: "Strażniczka Twierdzy Popiołu",
          cityId: "pyra-twierdza-popiolu",
          coordinates: { x: 1200, y: 750 },
          storyConnection:
            "Jej rodowa przysięga pochodzi od klanu, który zataił prawdę o ewakuacji; uczy się zamieniać posłuszeństwo wobec herbu na odpowiedzialność za żywych.",
          offeredQuestIds: [
            "O-P01",
            "O-P02",
            "O-P03",
            "O-P04",
            "O-P05",
            "O-P06",
            "M05",
            "M15",
            "C-K1",
            "C-K2",
          ],
        },
        {
          id: "npc-yumi",
          bindingId: "pyra.npc.merchant",
          name: "Yumi",
          role: "Kwatermistrzyni i Kupiec Popiołu",
          cityId: "pyra-twierdza-popiolu",
          coordinates: { x: 930, y: 1180 },
          storyConnection:
            "Prowadzi ewidencję wstęg klanowych i pomaga rodzinom odnaleźć ratowników uznanych niesłusznie za poległych.",
          offeredQuestIds: ["S-P01", "S-P02", "S-P03"],
        },
        {
          id: "npc-goro",
          bindingId: "pyra.npc.smith",
          name: "Goro",
          role: "Mistrz Kowadeł Lawowych",
          cityId: "pyra-twierdza-popiolu",
          coordinates: { x: 1510, y: 1160 },
          storyConnection:
            "Hartuje ostrza w strumieniach geotermalnych i odmawia przekuwania dawnych tablic ratowników na bezimienny złom.",
          offeredQuestIds: ["S-P05", "S-P06"],
        },
        {
          id: "npc-rokan",
          bindingId: "pyra.npc.hunter",
          name: "Rokan",
          role: "Mistrz Wypraw i Prób Areny",
          cityId: "pyra-twierdza-popiolu",
          coordinates: { x: 1540, y: 770 },
          storyConnection:
            "Nadzoruje szlaki wśród kraterów i przygotowuje wojowników do starcia z Bykiem Areny oraz Marszałkiem Pustej Przysięgi (B-05).",
          offeredQuestIds: ["S-P04", "S-P07", "S-P08", "D07"],
        },
      ],
      citizenProblems: [
        "Spór o prawo do wywieszenia wstęg strażników, którzy złamali rozkaz podczas ewakuacji.",
        "Węgielki i Ogniste Salamandry podchodzące pod zewnętrzne mury podczas wstrząsów sejsmicznych.",
        "Młodzi wojownicy podejmujący śmiertelne pojedynki z obawy przed utratą imienia.",
      ],
      neighborConnections: [
        {
          targetCityId: "pyra-zarowy-trakt",
          roadId: "road-pyra-ember-causeway",
          relation: "Główna grobla transportowa na zachód.",
        },
        {
          targetCityId: "pyra-cytadela-kowadel",
          roadId: "road-pyra-eastern-forges",
          relation: "Droga dostaw obsydianu i węgla żarzącego na wschód.",
        },
        {
          targetCityId: "pyra-port-czerwonych-zagli",
          roadId: "road-pyra-southern-harbor",
          relation: "Południowy szlak karawan do przystani morskiej.",
        },
      ],
      availableQuestIds: [
        "O-P01",
        "O-P02",
        "O-P03",
        "O-P04",
        "O-P05",
        "O-P06",
        "S-P01",
        "S-P02",
        "S-P03",
        "S-P04",
      ],
      secretToDiscover: {
        id: "secret-city-pyra-capital",
        title: "Odwrócona Tablica pod Posągiem (statue-3)",
        description:
          "W cokole zachodniego posągu Areny (statue-3) ukryto oryginalną listę dwunastu strażników, którzy przeprowadzili cywilów przez dym.",
        triggerCondition: "Zbadaj posąg statue-3 po rozmowie z Kaeną w O-P04.",
        rewardCoins: 40,
        rewardXp: 70,
      },
      reasonToReturn:
        "Pełne zaplecze kowalskie Goro (bronie W-P1..6), Arena Dziedzictwa, wątki osobiste Kaeny (C-K1..C-K2) oraz akt IV kampanii.",
    },
    {
      id: "pyra-zarowy-trakt",
      name: "Żarowy Trakt",
      continent: "pyra",
      role: "transport",
      isSafeZone: true,
      bounds: { x: 420, y: 980, width: 380, height: 360 },
      economicAndHistoricalFunction:
        "Zachodnia stacja karawan i posterunek ratowników górskich wokół Zachodniej Kaplicy Wojennej (war-shrine-1).",
      atmosphere:
        "Kamienne wiaty osłaniające przed opadem popiołu, dzwony ostrzegające przed burzą żarową i zapach siarki.",
      npcs: [
        {
          id: "npc-pyra-warden-west",
          bindingId: "pyra.npc.hunter",
          name: "Toren (Strażnik Traktu)",
          role: "Dowódca Zachodnich Ratowników",
          cityId: "pyra-zarowy-trakt",
          coordinates: { x: 620, y: 1150 },
          storyConnection:
            "Potomek jednego z „dezerterów”, który bez rozgłosu utrzymuje bezpieczne schrony wzdłuż zachodniej grani.",
          offeredQuestIds: ["S-P09", "H-P01"],
        },
      ],
      citizenProblems: [
        "Popielne Wilki zasypujące zasadzki wzdłuż wąwozów.",
        "Niedobór maści chłodzących (U-13) dla poparzonych tragarzy.",
      ],
      neighborConnections: [
        {
          targetCityId: "pyra-twierdza-popiolu",
          roadId: "road-pyra-ember-causeway",
          relation: "Trakt do Bramy Zachodniej Twierdzy Popiołu.",
        },
      ],
      availableQuestIds: ["S-P09", "H-P01"],
      secretToDiscover: {
        id: "secret-city-pyra-west",
        title: "Znak Ratowników na Kaplicy (war-shrine-1)",
        description:
          "Wewnątrz kaplicy war-shrine-1 przechowywane są liny z klamrami starego klanu ratunkowego.",
        triggerCondition: "Odwiedź war-shrine-1 na zachodzie Pyry.",
        rewardCoins: 35,
        rewardXp: 65,
      },
      reasonToReturn:
        "Punkt zaopatrzenia przed wyprawą na zachodnie wulkany i odnawialne patrole po burzy.",
    },
    {
      id: "pyra-cytadela-kowadel",
      name: "Cytadela Kowadeł",
      continent: "pyra",
      role: "craft",
      isSafeZone: true,
      bounds: { x: 1660, y: 840, width: 380, height: 340 },
      economicAndHistoricalFunction:
        "Wschodnie centrum hutnicze i zbrojownia skupiona wokół Wschodniej Kaplicy Wojennej (war-shrine-2).",
      atmosphere:
        "Rytmiczny łoskot młotów parowych, kaskady iskier i bazaltowe koryta z hartowanym szkłem obsydianowym.",
      npcs: [
        {
          id: "npc-pyra-smith-east",
          bindingId: "pyra.npc.smith",
          name: "Hana (Płatnerka Obsydianu)",
          role: "Mistrzyni Pancerzy Płytowych",
          cityId: "pyra-cytadela-kowadel",
          coordinates: { x: 1830, y: 1000 },
          storyConnection:
            "Wytwarza odczynniki ogniotrwałe R-05 i bada wytrzymałość skorup Magmowych Krabów.",
          offeredQuestIds: ["S-P10", "S-P11", "H-P02"],
        },
      ],
      citizenProblems: [
        "Skalni Berserkerzy i Magmowe Kraby blokujące dostęp do odkrywki obsydianu.",
        "Zanieczyszczenie kanałów spustowych przez zastygły żużel.",
      ],
      neighborConnections: [
        {
          targetCityId: "pyra-twierdza-popiolu",
          roadId: "road-pyra-eastern-forges",
          relation: "Szlak transportu płyt pancernych do stolicy.",
        },
      ],
      availableQuestIds: ["S-P10", "S-P11", "H-P02"],
      secretToDiscover: {
        id: "secret-city-pyra-east",
        title: "Forma Odlewnicza Klingi Powrotu",
        description:
          "W zapieczętowanym warsztacie zachowano matrycę broni U-W04 wykutej dla strażników powracających z wygnania.",
        triggerCondition: "Ukończ zadanie S-P03 lub S-P10.",
        rewardCoins: 45,
        rewardXp: 80,
      },
      reasonToReturn: "Wytwarzanie płyt R-05, ulepszanie pancerzy i skup magmowych pancerzy.",
    },
    {
      id: "pyra-port-czerwonych-zagli",
      name: "Port Czerwonych Żagli",
      continent: "pyra",
      role: "expedition",
      isSafeZone: true,
      bounds: { x: 1320, y: 1460, width: 480, height: 300 },
      economicAndHistoricalFunction:
        "Południowa przystań ekspedycyjna u podnóża bazaltowych klifów (detail-basalt-19), skąd wypływają łodzie ku archipelagowi Superior.",
      atmosphere:
        "Ciepła morska bryza zderzająca się z gorącym powietrzem znad lądu, żagle barwione ochrą i latarnie z wulkanicznego szkła.",
      npcs: [
        {
          id: "npc-pyra-captain",
          bindingId: "pyra.npc.merchant",
          name: "Daro (Ssternik Przymierza)",
          role: "Kapitan Przepraw Południowych",
          cityId: "pyra-port-czerwonych-zagli",
          coordinates: { x: 1500, y: 1620 },
          storyConnection:
            "Utrzymuje łączność morską z Ligą Szlaków i pamięta stary korytarz ewakuacyjny prowadzący na wybrzeże.",
          offeredQuestIds: ["S-P12", "H-P03", "H-P04"],
        },
      ],
      citizenProblems: [
        "Skorpiony Obsydianowe gnieżdżące się w czarnym piasku wokół kotwicowiska.",
        "Uszkodzenie południowej boi nawigacyjnej przez odłamki Golema Ruin.",
      ],
      neighborConnections: [
        {
          targetCityId: "pyra-twierdza-popiolu",
          roadId: "road-pyra-southern-harbor",
          relation: "Droga ewakuacyjna i handlowa do stolicy.",
        },
      ],
      availableQuestIds: ["S-P12", "H-P03", "H-P04"],
      secretToDiscover: {
        id: "secret-city-pyra-port",
        title: "Księga Zaokrętowanych Cywilów",
        description:
          "W kapitanacie zachował się rejestr łodzi, który dowodzi, że „dezerterzy” ocalili ponad trzystu mieszkańców dolnego miasta.",
        triggerCondition: "Zbadaj przystań przy detail-basalt-19.",
        rewardCoins: 50,
        rewardXp: 95,
      },
      reasonToReturn: "Wyprawy morskie na wyspy kampanii oraz polowania na potwory poz. 14–18.",
    },
  ],
  roads: [
    {
      id: "road-pyra-ember-causeway",
      name: "Zachodnia Grobla Żaru",
      continent: "pyra",
      category: "merchant",
      fromId: "pyra-twierdza-popiolu",
      toId: "pyra-zarowy-trakt",
      waypoints: [
        { x: 1180, y: 1180 },
        { x: 930, y: 1180 },
        { x: 620, y: 1150 },
      ],
      description:
        "Utwardzona bazaltem droga łącząca rynek Twierdzy Popiołu z Zachodnią Kaplicą Wojenną (war-shrine-1).",
      dangerLevel: 3,
      monsterIds: ["pyra-wegielek", "pyra-ognista-salamandra"],
      restPoint: {
        name: "Sztandar Zachodniej Straży (detail-clan-banner-11)",
        x: 930,
        y: 1180,
        description: "Punkt zbiórki patroli z beczkami chłodnej wody.",
      },
    },
    {
      id: "road-pyra-eastern-forges",
      name: "Trakt Kowadeł i Żużlu",
      continent: "pyra",
      category: "famous_route",
      fromId: "pyra-twierdza-popiolu",
      toId: "pyra-cytadela-kowadel",
      waypoints: [
        { x: 1200, y: 1160 },
        { x: 1510, y: 1160 },
        { x: 1830, y: 1000 },
      ],
      description:
        "Szeroki gościniec dla wozów z rudą żelaza i obsydianem prowadzący do war-shrine-2.",
      dangerLevel: 6,
      monsterIds: ["pyra-skalny-berserker", "pyra-magmowy-krab"],
    },
    {
      id: "road-pyra-southern-harbor",
      name: "Droga Ocalonych (Szlak Portowy)",
      continent: "pyra",
      category: "forgotten",
      fromId: "pyra-twierdza-popiolu",
      toId: "pyra-port-czerwonych-zagli",
      waypoints: [
        { x: 1180, y: 1330 },
        { x: 1350, y: 1480 },
        { x: 1500, y: 1620 },
      ],
      description:
        "Dawny korytarz ewakuacyjny prowadzący między bazaltowymi iglicami (basalt-7..8) ku wybrzeżu.",
      dangerLevel: 8,
      monsterIds: ["pyra-popielny-wilk", "pyra-magmowy-krab"],
      roadsideSecret: {
        id: "road-secret-pyra-1",
        title: "Porzucona Tarcza Strażnika",
        x: 700,
        y: 1630,
        description: "Przy bazalcie basalt-7 leży pęknięta tarcza z wyrytym mottem ratowników.",
        rewardCoins: 35,
      },
    },
    {
      id: "road-pyra-volcano-ridge",
      name: "Grań Dwóch Kraterów",
      continent: "pyra",
      category: "dangerous",
      fromId: "pyra-zarowy-trakt",
      toId: "fortress-0",
      waypoints: [
        { x: 620, y: 1150 },
        { x: 410, y: 580 },
        { x: 880, y: 470 },
        { x: 1200, y: 450 },
      ],
      description:
        "Niebezpieczna ścieżka pod północno-zachodnim wulkanem (detail-volcano-9) prowadząca do Bastionu fortress-0.",
      dangerLevel: 14,
      monsterIds: ["pyra-zarowy-nietoperz", "pyra-golem-ruin", "pyra-plomien-duch"],
    },
    {
      id: "road-pyra-obsidian-canyon",
      name: "Wąwóz Obsydianowych Skorpionów",
      continent: "pyra",
      category: "ambush",
      fromId: "pyra-cytadela-kowadel",
      toId: "pyra-port-czerwonych-zagli",
      waypoints: [
        { x: 1830, y: 1000 },
        { x: 1930, y: 1570 },
        { x: 1500, y: 1620 },
      ],
      description:
        "Czarny piaszczysty wąwóz na południowym wschodzie (basalt-8), pełen zasadzek Skorpionów i Byków Areny.",
      dangerLevel: 18,
      monsterIds: ["pyra-byk-areny", "pyra-skorpion-obsydianowy"],
    },
  ],
  famousLocations: [
    {
      id: "famous-pyra-1",
      mapPointId: "fortress-0",
      continent: "pyra",
      name: "Bastion Złamanej Przysięgi (Cytadela Północy)",
      loreAndLegend:
        "Monumentalna bazaltowa twierdza (fortress-0) górująca nad północną częścią Pyry, w której starszyzna klanów składała dawniej przysięgi wierności przed wyprawą. W jej głównej sali wisi pęknięty dzwon alarmowy, którego nie użyto na czas w dniu wielkiego wybuchu wulkanu. To tutaj Kaena odkrywa zamknięte archiwum rozkazów swojego rodu.",
      canonLink:
        "Centralna lokacja prologu O-P06, wątku osobistego Kaeny (C-K1/C-K2) oraz starcia z Marszałkiem Pustej Przysięgi (B-05).",
      challengeOrEncounter: {
        type: "combat",
        description: "Pokonaj Golema Ruin strzegącego wewnętrznego dziedzińca Bastionu.",
        monsterId: "pyra-golem-ruin",
      },
      discoveryCondition: {
        minLevel: 3,
        requirePhysicalArrival: true,
        arrivalRadius: 125,
      },
      firstDiscoveryReward: {
        xp: 100,
        coins: 45,
        itemId: "sword",
        factionReputation: { factionId: "F-P", amount: 35 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-pyra-2",
        secretTitle: "Brakujące Ogniwo Łańcucha Bramy",
        description:
          "Odcięte ogniwo łańcucha z bramy Bastionu znajduje się na ołtarzu w Kaplicy Dezerterów (war-shrine-1).",
        bonusXp: 95,
      },
      coordinates: { x: 1200, y: 450 },
    },
    {
      id: "famous-pyra-2",
      mapPointId: "war-shrine-1",
      continent: "pyra",
      name: "Kaplica Dezerterów Popiołu (Zachodnie Sanktuarium)",
      loreAndLegend:
        "Surowa kamienna kaplica (war-shrine-1) na zachodnim szlaku, z której po wojnie klanowej usunięto oficjalne herby. Przez dziesięciolecia mieszkańcy uratowani z dolnego miasta przychodzili tu nocą, by wiązać czerwone wstęgi dla strażników wykreślonych z ksiąg honorowych. Ogień w misie kaplicy podtrzymywany jest bez użycia sieci Chóru.",
      canonLink:
        "Kluczowe miejsce zadań O-P04, S-P01 („Wstęga dla żyjącego”) oraz C-K2 („Ci, którzy zawrócili”).",
      challengeOrEncounter: {
        type: "observation",
        description:
          "Odczytaj inicjały pod warstwą sadzy i dopasuj zawieszone wstęgi do listy rodzin z portu.",
      },
      discoveryCondition: {
        minLevel: 2,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 75,
        coins: 35,
        itemId: "potion",
        factionReputation: { factionId: "F-P", amount: 30 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-aether-2",
        secretTitle: "Kopia Rozkazu Ewakuacji",
        description:
          "Duplikat rozkazu, któremu sprzeciwili się strażnicy, został zdeponowany w Zachodnim Archiwum Aetherii (archive-1).",
        bonusXp: 100,
      },
      coordinates: { x: 620, y: 1150 },
    },
    {
      id: "famous-pyra-3",
      mapPointId: "war-shrine-2",
      continent: "pyra",
      name: "Ołtarz Płomiennego Pojedynku i Przerwanej Walki",
      loreAndLegend:
        "Wschodnie sanktuarium klanowe (war-shrine-2), gdzie wojownicy Pyry rozstrzygali spory w kręgu rozżarzonych bazaltów. Dawny kodeks nakazywał walkę aż do utraty przytomności, lecz po utworzeniu Przymierza Popiołu wyryto tu nową zasadę: przerwanie pojedynku dla ocalenia życia nie plami honoru żadnej ze stron.",
      canonLink:
        "Miejsce zadania S-P04 („Honor przerwanego pojedynku”) oraz prób kowalskich Goro i Hany.",
      challengeOrEncounter: {
        type: "combat",
        description:
          "Zmierz się ze Skalnym Berserkerem w uczciwej próbie kręgu i powstrzymaj jego szał.",
        monsterId: "pyra-skalny-berserker",
      },
      discoveryCondition: {
        minLevel: 5,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 110,
        coins: 50,
        itemId: "vest",
        factionReputation: { factionId: "F-P", amount: 40 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-pyra-4",
        secretTitle: "Pieczęć Mistrza Koloseum",
        description:
          "Rękojeść miecza wbitego w ołtarz nosi ten sam znak co posąg Kolosa Areny (statue-3).",
        bonusXp: 85,
      },
      coordinates: { x: 1830, y: 1000 },
    },
    {
      id: "famous-pyra-4",
      mapPointId: "statue-3",
      continent: "pyra",
      name: "Kolos Areny Dziedzictwa (Zachodni Monument)",
      loreAndLegend:
        "Olbrzymi posąg dawnego czempiona Legend (statue-3) strzegący wejścia na główną Arenę Dziedzictwa w sercu Pyry. Choć oficjalna kronika głosi, że bohater poległ samotnie broniąc szczytu, pęknięcie na jego tarczy pochodzi od uderzenia spadającej belki, którą podtrzymywał nad głowami uciekających rzemieślników.",
      canonLink: "Cel początkowego obchodu Areny Dziedzictwa oraz punkt zborny przed wyprawą M15.",
      challengeOrEncounter: {
        type: "combat",
        description:
          "Uniknij liniowej szarży Byka Areny i wyprowadź kontratak w oknie jego odsłonięcia.",
        monsterId: "pyra-byk-areny",
      },
      discoveryCondition: {
        minLevel: 1,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 65,
        coins: 30,
        itemId: "tusk",
        factionReputation: { factionId: "F-P", amount: 25 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-verdant-4",
        secretTitle: "Kowadło Dwóch Krain",
        description:
          "Stop brązu u podstawy posągu pochodzi z tej samej partii co fundament Korzennej Kuźni w Verdantii.",
        bonusXp: 80,
      },
      coordinates: { x: 860, y: 770 },
    },
  ],
  hiddenPlaces: [
    {
      id: "hidden-pyra-1",
      continent: "pyra",
      name: "Starożytny Ołtarz Pierwszego Żaru",
      category: "altar",
      mapAnchorId: "basalt-5",
      coordinates: { x: 410, y: 580 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description:
        "Bazaltowy monolit (basalt-5) u podnóża zachodniego krateru, w którym tli się wieczny węgiel.",
      discoveryRequirement: "Dotrzyj do kolumny bazaltowej basalt-5 na północnym zachodzie Pyry.",
      reward: { xp: 80, coins: 35, itemId: "potion" },
    },
    {
      id: "hidden-pyra-2",
      continent: "pyra",
      name: "Opuszczony Obóz Straży Zaporowej",
      category: "camp",
      mapAnchorId: "basalt-6",
      coordinates: { x: 2040, y: 460 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description:
        "Dawny posterunek obserwacyjny przy basalt-6 z zachowanym zapasem bandaży i dziennikem warty.",
      discoveryRequirement: "Zbadaj północno-wschodnią grań przy basalt-6.",
      reward: { xp: 95, coins: 40, itemId: "vest" },
    },
    {
      id: "hidden-pyra-3",
      continent: "pyra",
      name: "Skarbiec Popielnych Klanów",
      category: "treasure",
      mapAnchorId: "basalt-8",
      coordinates: { x: 1930, y: 1570 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description:
        "Żelazna skrzynia ukryta w rozpadlinie bazaltu basalt-8 na południowym wschodzie.",
      discoveryRequirement: "Dotrzyj do formacji basalt-8 na południowym wschodzie.",
      reward: { xp: 135, coins: 65, itemId: "sword" },
    },
    {
      id: "hidden-pyra-4",
      continent: "pyra",
      name: "Tunel Lawowy pod Kraterem (Wejście Zamknięte)",
      category: "passage",
      mapAnchorId: "detail-volcano-9",
      coordinates: { x: 450, y: 330 },
      radius: 90,
      implementationStatus: "data_only_pending_engine",
      description:
        "Zasypane przejście do podziemnych korytarzy magmowych (oczekuje na wsparcie podziemi w runtime).",
      discoveryRequirement: "Oczekuje na wdrożenie warstwy podziemi w silniku.",
      reward: { xp: 160, coins: 70 },
    },
  ],
  worldEvents: [
    {
      id: "event-pyra-salamander-swarm",
      continent: "pyra",
      name: "Spotkanie na Szlaku: Przemarsz Ognistych Salamander",
      category: "trail_encounter",
      implementationStatus: "active_in_engine",
      activationCondition: { minLevel: 2, coordinates: { x: 930, y: 1180 }, radius: 120 },
      repeatability: "cooldown_300s",
      description: "Ogniste Salamandry zostawiają płonące smugi na Zachodniej Grobli Żaru.",
      monsterId: "pyra-ognista-salamandra",
      reward: { xp: 60, coins: 28, itemId: "potion" },
    },
    {
      id: "event-pyra-ash-storm-hazard",
      continent: "pyra",
      name: "Zagrożenie Obszarowe: Opad Gorącego Popiołu",
      category: "area_hazard",
      implementationStatus: "active_in_engine",
      activationCondition: { minLevel: 6, coordinates: { x: 880, y: 470 }, radius: 130 },
      repeatability: "cooldown_300s",
      description:
        "Wokół północnej grani Popielne Wilki i Płomień-Duchy wykorzystują gęsty pył do ataków z zaskoczenia.",
      monsterId: "pyra-plomien-duch",
      reward: { xp: 120, coins: 50, itemId: "tusk" },
    },
    {
      id: "event-pyra-contract-d07",
      continent: "pyra",
      name: "Zlecenie Odnawialne D07: Szlak po Burzy",
      category: "renewable_contract",
      implementationStatus: "active_in_engine",
      activationCondition: {
        minLevel: 10,
        requiredQuestId: "O-P06",
        coordinates: { x: 1540, y: 770 },
        radius: 120,
      },
      repeatability: "renewable_contract",
      description:
        "Kontrakt Przymierza Popiołu: udrożnij szlak między Cytadelą Kowadeł a Portem Czerwonych Żagli.",
      monsterId: "pyra-magmowy-krab",
      reward: { xp: 115, coins: 48 },
    },
  ],
};
