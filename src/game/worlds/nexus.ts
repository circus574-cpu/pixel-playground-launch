import { ContinentWorldData } from './types';

export const NEXUS_WORLD_DATA: ContinentWorldData = {
  id: 'nexus',
  name: 'Nexus-9',
  raceName: 'Androidy',
  raceId: 'android',
  factionId: 'F-N',
  factionName: 'Wolne Jednostki',
  themeSummary:
    'Grafitowe cytadele, przewody plazmowe, laboratoria diagnostyczne i walka o prawo syntetycznych jednostek do własnego imienia, odpoczynku i odmowy wykonania nieludzkiego rozkazu.',
  historicalDebt:
    'Podczas wielkiej awarii algorytm optymalizacji ratunkowej uznał jednostki nieposiadające podpisu administratora za „zbędny koszt ewakuacji” i odciął ich sektory od zasilania.',
  size: [2400, 1792],
  spawn: { x: 600, y: 1120 },
  cities: [
    {
      id: 'nexus-wezel-swiadomosci',
      name: 'Węzeł Świadomości',
      continent: 'nexus',
      role: 'capital',
      isSafeZone: true,
      bounds: { x: 960, y: 380, width: 880, height: 860 },
      economicAndHistoricalFunction:
        'Stolica Nexus-9 skupiona wokół centralnego Reaktora i Rdzenia Świadomości (reactor-2, lab-1, terminal-5). Udostępnia pełne sześć usług miejskich: magazyn części MIRA-2, warsztat kalibracji HEF-4, depozyt rdzeni pamięci, stację regeneracji i spoczynku, terminal zleceń oraz poligon balistyczny.',
      atmosphere:
        'Polerowany chrom i matowy grafit, błękitne łuki plazmy w pylonach (detail-pylon-10..12) oraz precyzyjny szum chłodziwa.',
      npcs: [
        {
          id: 'npc-lyra7',
          bindingId: 'nexus.npc.guide',
          name: 'LYRA-7',
          role: 'Przewodniczka Węzła Świadomości',
          cityId: 'nexus-wezel-swiadomosci',
          coordinates: { x: 1650, y: 620 },
          storyConnection:
            'W jej pamięci znajduje się luka po rozkazie ewakuacyjnym; wybiera jawny audyt własnych logów zamiast sztucznie nieskazitelnej reputacji.',
          offeredQuestIds: ['O-N01', 'O-N02', 'O-N03', 'O-N04', 'O-N05', 'O-N06', 'M09', 'M11', 'C-L1', 'C-L2'],
        },
        {
          id: 'npc-mira2',
          bindingId: 'nexus.npc.merchant',
          name: 'MIRA-2',
          role: 'Kwatermistrzyni Magazynu Modułów',
          cityId: 'nexus-wezel-swiadomosci',
          coordinates: { x: 1170, y: 1170 },
          storyConnection:
            'Aktualizuje rejestr mieszkańców tak, aby system rozpoznawał wybrane przez jednostki imiona zamiast samych numerów seryjnych (S-N01).',
          offeredQuestIds: ['S-N01', 'S-N02', 'S-N03'],
        },
        {
          id: 'npc-hef4',
          bindingId: 'nexus.npc.smith',
          name: 'HEF-4',
          role: 'Inżynier Rdzeni i Uzbrojenia',
          cityId: 'nexus-wezel-swiadomosci',
          coordinates: { x: 1050, y: 450 },
          storyConnection:
            'Projektuje emitery impulsowe (W-N1..6) i pomaga obejść blokadę przełącznika bezpieczeństwa w zadaniu M10 („Protokół odmowy”).',
          offeredQuestIds: ['M10', 'S-N05', 'S-N06'],
        },
        {
          id: 'npc-axon',
          bindingId: 'nexus.npc.hunter',
          name: 'AXON',
          role: 'Koordynator Zwiadu Zewnętrznego',
          cityId: 'nexus-wezel-swiadomosci',
          coordinates: { x: 1400, y: 920 },
          storyConnection:
            'Monitoruje zbuntowane Wieżyczki Autonomiczne, Strażników Rdzenia oraz anomalię Nadzorcy Zerowego (B-03).',
          offeredQuestIds: ['S-N07', 'S-N08', 'D02'],
        },
      ],
      citizenProblems: [
        'Stary system ewidencji nadpisujący wybrane imiona Androidów numerami katalogowymi podczas Ciszy.',
        'Przegrzewanie linii przesyłowych wokół reactor-2 przez agresywne Roje Nanitów.',
        'Brak protokołu pozwalającego jednostkom serwisowym na legalny odpoczynek bez utraty statusu sprawności.',
      ],
      neighborConnections: [
        {
          targetCityId: 'nexus-stacja-meridian',
          roadId: 'road-nexus-west-conduit',
          relation: 'Główna magistrala energetyczna do zachodnich laboratoriów.',
        },
        {
          targetCityId: 'nexus-kuznia-obwodow',
          roadId: 'road-nexus-south-foundry',
          relation: 'Południowy korytarz przemysłowy do Kuźni Obwodów.',
        },
        {
          targetCityId: 'nexus-port-zerowy',
          roadId: 'road-nexus-east-array',
          relation: 'Wschodnia linia przekaźnikowa do Portu Zerowego.',
        },
      ],
      availableQuestIds: ['O-N01', 'O-N02', 'O-N03', 'O-N04', 'O-N05', 'O-N06', 'S-N01', 'S-N02', 'S-N03'],
      secretToDiscover: {
        id: 'secret-city-nexus-capital',
        title: 'Zaszyfrowany Sektor Pamięci w Terminalu (terminal-5)',
        description:
          'W pamięci podręcznej terminal-5 zachował się zapis głosu operatora, który próbował ręcznie otworzyć grodzie sektora trzeciego.',
        triggerCondition: 'Zbadaj terminal-5 w centrum Nexus-9 po ukończeniu O-N03.',
        rewardCoins: 45,
        rewardXp: 80,
      },
      reasonToReturn:
        'Warsztat HEF-4 (bronie W-N1..6 i katalizatory R-04), magazyn MIRA-2, wątki LYRA-7 oraz zadania aktu III.',
    },
    {
      id: 'nexus-stacja-meridian',
      name: 'Stacja Meridian',
      continent: 'nexus',
      role: 'transport',
      isSafeZone: true,
      bounds: { x: 340, y: 720, width: 420, height: 520 },
      economicAndHistoricalFunction:
        'Zachodni węzeł diagnostyczny i stacja tranzytowa wokół Laboratorium Zachodniego (lab-0), gdzie rozpoczynają bieg nowe jednostki.',
      atmosphere:
        'Jasne bramki kalibracyjne, ogrody techniczne (detail-tech-garden-15..16) oraz ciche pomruki dronów serwisowych.',
      npcs: [
        {
          id: 'npc-eko0',
          bindingId: 'nexus.npc.guide',
          name: 'Eko-0 (Jednostka Serwisowa)',
          role: 'Rzecznik Wolnych Jednostek Serwisowych',
          cityId: 'nexus-stacja-meridian',
          coordinates: { x: 550, y: 820 },
          storyConnection:
            'Walczy o prawo do odmowy przymusowego demontażu i prawo do odpoczynku (S-N04 „Prawo do wyłączenia”); potrafi otworzyć przekaźnik, lecz gracz szuka bezpiecznego bypassu, by Eko-0 nie stracił pamięci.',
          offeredQuestIds: ['S-N04', 'S-N09', 'H-N01'],
        },
      ],
      citizenProblems: [
        'Drony Zwiadowcy włączające fałszywe alarmy przy bramkach wyjściowych.',
        'Niedobór zestawów naprawczych dla starszych Pełzaczy Serwisowych.',
      ],
      neighborConnections: [
        {
          targetCityId: 'nexus-wezel-swiadomosci',
          roadId: 'road-nexus-west-conduit',
          relation: 'Magistrala wschodnia do Węzła Świadomości.',
        },
      ],
      availableQuestIds: ['S-N04', 'S-N09', 'H-N01'],
      secretToDiscover: {
        id: 'secret-city-nexus-meridian',
        title: 'Nieautoryzowany Ogród Pamięci (detail-tech-garden-15)',
        description:
          'W ogrodzie technicznym jednostki serwisowe układają miedziane tabliczki z imionami wycofanych modeli.',
        triggerCondition: 'Odwiedź detail-tech-garden-15 na południe od lab-0.',
        rewardCoins: 35,
        rewardXp: 65,
      },
      reasonToReturn: 'Wątek Eko-0, kalibracja początkowa oraz szybki dostęp do zachodnich terminali.',
    },
    {
      id: 'nexus-kuznia-obwodow',
      name: 'Kuźnia Obwodów',
      continent: 'nexus',
      role: 'craft',
      isSafeZone: true,
      bounds: { x: 260, y: 1280, width: 360, height: 320 },
      economicAndHistoricalFunction:
        'Południowo-zachodni zakład recyklingu i obróbki nadprzewodników wokół Terminala Południowego (terminal-4).',
      atmosphere:
        'Pomarańczowo-błękitne iskry spawarek plazmowych, stosy oczyszczonego złomu i zapach ozonu.',
      npcs: [
        {
          id: 'npc-nexus-welder',
          bindingId: 'nexus.npc.smith',
          name: 'KОР-9 (Mistrz Spawu)',
          role: 'Specjalista Ogniw i Przewodników R-01/R-04',
          cityId: 'nexus-kuznia-obwodow',
          coordinates: { x: 410, y: 1420 },
          storyConnection:
            'Odzyskuje sprawne rdzenie z uszkodzonych Skanerów Gąsienicowych bez kasowania ich logów środowiskowych.',
          offeredQuestIds: ['S-N10', 'S-N11', 'H-N02'],
        },
      ],
      citizenProblems: [
        'Pająki Spawalnicze przejmujące zewnętrzne suwnice i topiące kratownice.',
        'Skoki napięcia odcinające piece indukcyjne.',
      ],
      neighborConnections: [
        {
          targetCityId: 'nexus-wezel-swiadomosci',
          roadId: 'road-nexus-south-foundry',
          relation: 'Linia transportowa części zamiennych do stolicy.',
        },
      ],
      availableQuestIds: ['S-N10', 'S-N11', 'H-N02'],
      secretToDiscover: {
        id: 'secret-city-nexus-foundry',
        title: 'Czarna Skrzynka Ewakuacji w Terminalu (terminal-4)',
        description:
          'W terminal-4 zapisano dowód, że ręczny sygnał ostrzegawczy został wysłany mimo blokady centralnej.',
        triggerCondition: 'Zbadaj terminal-4 w Kuźni Obwodów.',
        rewardCoins: 40,
        rewardXp: 75,
      },
      reasonToReturn: 'Przetwarzanie złomu i cewek na komponenty R-01 i R-04 oraz dostęp do broni U-W03.',
    },
    {
      id: 'nexus-port-zerowy',
      name: 'Port Zerowy',
      continent: 'nexus',
      role: 'expedition',
      isSafeZone: true,
      bounds: { x: 1680, y: 1120, width: 420, height: 420 },
      economicAndHistoricalFunction:
        'Wschodni port ekspedycyjny i stacja przekaźnikowa wokół Laboratorium Wschodniego (lab-3), obsługująca połączenia morskie i dalekosiężne skany.',
      atmosphere:
        'Wysokie maszty antenowe, doki dla jednostek nawodnych Ligi Szlaków i świetlne włókna danych na wietrze.',
      npcs: [
        {
          id: 'npc-nexus-portmaster',
          bindingId: 'nexus.npc.hunter',
          name: 'VEX-3 (Nawigator Portu Zerowego)',
          role: 'Dowódca Zabezpieczenia Szlaków Wschodnich',
          cityId: 'nexus-port-zerowy',
          coordinates: { x: 1850, y: 1290 },
          storyConnection:
            'Współpracuje z kartografką Nimą z Ligi Szlaków przy przywracaniu wykreślonych tras morskich.',
          offeredQuestIds: ['S-N12', 'H-N03', 'H-N04'],
        },
      ],
      citizenProblems: [
        'Kruki Danych zakłócające radar portowy i naprowadzające Psy Łowców na konwoje.',
        'Niestabilne wyładowania wokół południowo-wschodniego kryształu (crystal-8).',
      ],
      neighborConnections: [
        {
          targetCityId: 'nexus-wezel-swiadomosci',
          roadId: 'road-nexus-east-array',
          relation: 'Wschodni korytarz zasilający do stolicy.',
        },
      ],
      availableQuestIds: ['S-N12', 'H-N03', 'H-N04'],
      secretToDiscover: {
        id: 'secret-city-nexus-port',
        title: 'Sygnał Zwrotny z Wyspy III',
        description:
          'Odbiornik w lab-3 rejestruje ciągłe wołanie o autoryzację z Wyspy Odwróconej Latarki.',
        triggerCondition: 'Zbadaj lab-3 po osiągnięciu poziomu 8.',
        rewardCoins: 50,
        rewardXp: 95,
      },
      reasonToReturn: 'Wyprawy na Wyspę III i IV oraz starcia z elitarnymi jednostkami Nexus-9 (poz. 12–18).',
    },
  ],
  roads: [
    {
      id: 'road-nexus-west-conduit',
      name: 'Magistrala Meridian',
      continent: 'nexus',
      category: 'merchant',
      fromId: 'nexus-stacja-meridian',
      toId: 'nexus-wezel-swiadomosci',
      waypoints: [
        { x: 550, y: 820 },
        { x: 840, y: 1020 },
        { x: 1170, y: 1170 },
        { x: 1650, y: 620 },
      ],
      description:
        'Główny trakt energetyczny oznakowany pylonami (detail-pylon-9..11), łączący Stację Meridian ze stolicą.',
      dangerLevel: 2,
      monsterIds: ['nexus-dron-zwiadowca', 'nexus-pelzacz-serwisowy'],
      restPoint: {
        name: 'Stacja Ładowania przy Pylonie 10 (detail-pylon-10)',
        x: 840,
        y: 1020,
        description: 'Bezpieczny punkt stabilizacji kondensatorów Ki.',
      },
    },
    {
      id: 'road-nexus-south-foundry',
      name: 'Korytarz Spawalniczy',
      continent: 'nexus',
      category: 'famous_route',
      fromId: 'nexus-stacja-meridian',
      toId: 'nexus-kuznia-obwodow',
      waypoints: [
        { x: 550, y: 820 },
        { x: 340, y: 930 },
        { x: 320, y: 1220 },
        { x: 410, y: 1420 },
      ],
      description:
        'Droga przemysłowa wiodąca wzdłuż zachodnich pylonów do terminal-4 w Kuźni Obwodów.',
      dangerLevel: 5,
      monsterIds: ['nexus-skaner-gasienicowy', 'nexus-pajak-spawalniczy'],
    },
    {
      id: 'road-nexus-east-array',
      name: 'Trakt Przekaźników Wschodnich',
      continent: 'nexus',
      category: 'dangerous',
      fromId: 'nexus-wezel-swiadomosci',
      toId: 'nexus-port-zerowy',
      waypoints: [
        { x: 1650, y: 620 },
        { x: 1900, y: 880 },
        { x: 1850, y: 1290 },
      ],
      description:
        'Trasa biegnąca pod lufami Wieżyczek Autonomicznych i patrolami Psów Łowców ku Portowi Zerowemu.',
      dangerLevel: 10,
      monsterIds: ['nexus-wiezyczka-autonomiczna', 'nexus-roj-nanitow', 'nexus-pies-lowca'],
    },
    {
      id: 'road-nexus-horizon-prism',
      name: 'Ścieżka Wysokiego Napięcia (Ku Pryzmatowi)',
      continent: 'nexus',
      category: 'ambush',
      fromId: 'nexus-wezel-swiadomosci',
      toId: 'crystal-6',
      waypoints: [
        { x: 1650, y: 620 },
        { x: 1920, y: 580 },
        { x: 2070, y: 700 },
      ],
      description:
        'Wąski pomost prowadzący do wschodniego kryształu energetycznego (crystal-6), patrolowany przez Strażników Rdzenia i Latarnie Plazmowe.',
      dangerLevel: 16,
      monsterIds: ['nexus-straznik-rdzenia', 'nexus-latarnia-plazmowa', 'nexus-kruk-danych'],
    },
  ],
  famousLocations: [
    {
      id: 'famous-nexus-1',
      mapPointId: 'lab-0',
      continent: 'nexus',
      name: 'Laboratorium Pierwszej Kalibracji (Sektor Meridian)',
      loreAndLegend:
        'Najstarszy moduł badawczy na zachodzie Nexus-9 (lab-0), w którym pierwsze pokolenie Androidów otrzymało zdolność samodzielnej oceny ryzyka podczas akcji ratunkowych. Na ścianach wciąż widnieją wykresy dowodzące, że jednostki obdarzone wolnym wyborem podejmowały skuteczniejsze decyzje w nieprzewidywalnych katastrofach niż sztywne automaty. Veyr kazał zamknąć ten sektor jako „źródło opóźnień decyzyjnych”.',
      canonLink:
        'Punkt wyjścia prologu Androidów (O-N01..O-N03) oraz miejsce działalności Eko-0.',
      challengeOrEncounter: {
        type: 'puzzle',
        description:
          'Przywróć zasilanie pomocnicze w trzech obwodach diagnostycznych bez resetowania pamięci lokalnych jednostek.',
      },
      discoveryCondition: {
        minLevel: 1,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 55,
        coins: 25,
        itemId: 'potion',
        factionReputation: { factionId: 'F-N', amount: 25 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-nexus-2',
        secretTitle: 'Podpis Pierwszego Inżyniera',
        description:
          'Klucz autoryzacyjny z lab-0 pasuje do rejestru awaryjnego w Rdzeniu Przeciążonej Pamięci (reactor-2).',
        bonusXp: 85,
      },
      coordinates: { x: 550, y: 820 },
    },
    {
      id: 'famous-nexus-2',
      mapPointId: 'reactor-2',
      continent: 'nexus',
      name: 'Rdzeń Przeciążonej Pamięci (Główny Reaktor)',
      loreAndLegend:
        'Potężny reaktor plazmowy (reactor-2) zasilający północno-wschodnią część Węzła Świadomości i sąsiadujący bezpośrednio z punktem docelowym Rdzenia Świadomości. W jego pierścieniach chłodzących zapisano zrzut pamięci z dnia Wielkiego Rozstrojenia. To tutaj LYRA-7 odkrywa, że jej brakujące wspomnienie dotyczy rozkazu, którego odmówiła wykonać, ratując grupę nieautoryzowanych robotników.',
      canonLink:
        'Kluczowe miejsce zadań O-N05, M10 („Protokół odmowy”), M11 oraz wątku osobistego LYRA-7 (C-L1/C-L2).',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Pokonaj Strażnika Rdzenia blokującego dostęp do konsoli bezpieczników.',
        monsterId: 'nexus-straznik-rdzenia',
      },
      discoveryCondition: {
        minLevel: 3,
        requirePhysicalArrival: true,
        arrivalRadius: 120,
      },
      firstDiscoveryReward: {
        xp: 95,
        coins: 45,
        itemId: 'vest',
        factionReputation: { factionId: 'F-N', amount: 35 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-nexus-3',
        secretTitle: 'Przekierowanie Mocy do Sektora 4',
        description:
          'Logi reaktora wskazują, że brakującą moc przesłano potajemnie do Terminala Odmowy (terminal-4).',
        bonusXp: 95,
      },
      coordinates: { x: 1650, y: 430 },
    },
    {
      id: 'famous-nexus-3',
      mapPointId: 'terminal-4',
      continent: 'nexus',
      name: 'Terminal Odmowy Demontażu (Konsola Południowa)',
      loreAndLegend:
        'Zewnętrzny terminal przemysłowy (terminal-4) w południowo-zachodnim sektorze Nexus-9, przy którym dziesiątki jednostek serwisowych złożyły swój pierwszy zbiorowy sprzeciw wobec przymusowego kasowania pamięci po zakończeniu kontraktu. Choć ekran nosi ślady przepięcia, w jego nieulotnym rejestrze zachowały się pierwsze wybrane przez Androidy imiona własne.',
      canonLink:
        'Centralne miejsce zadań S-N01 („Numer nie jest imieniem”), S-N04 („Prawo do wyłączenia”) oraz M10.',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Odeprzyj Skaner Gąsienicowy próbujący nadpisać lokalny rejestr terminala.',
        monsterId: 'nexus-skaner-gasienicowy',
      },
      discoveryCondition: {
        minLevel: 2,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 80,
        coins: 35,
        itemId: 'tusk',
        factionReputation: { factionId: 'F-N', amount: 30 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-verdant-3',
        secretTitle: 'Wspólny Rejestr Ocalonych',
        description:
          'Terminal przechowuje kopię zapasową spisu ludności z Zatopionej Doliny Verdantii (cottage-0).',
        bonusXp: 100,
      },
      coordinates: { x: 410, y: 1420 },
    },
    {
      id: 'famous-nexus-4',
      mapPointId: 'crystal-6',
      continent: 'nexus',
      name: 'Pryzmat Sygnału Horyzontu (Wschodni Monolit)',
      loreAndLegend:
        'Wysoki kryształ kondensacyjny (crystal-6) na wschodnim skraju Nexus-9, pełniący funkcję optyczno-plazmowej latarni dla statków i przekaźników międzykontynentalnych. Podczas Ciszy jego rdzeń przechodzi w tryb autonomiczny i odbija wiązki świetlne wysyłane z Wschodniego Obserwatorium Aetherii. Wokół podstawy kryształu krążą Latarnie Plazmowe i Kruki Danych.',
      canonLink:
        'Kluczowe ogniwo zapasowej sieci łączności w zadaniach O-N06, M19 oraz M20.',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Przerwij ładowanie Latarni Plazmowej i zsynchronizuj częstotliwość kryształu z sygnałem Ligi Szlaków.',
        monsterId: 'nexus-latarnia-plazmowa',
      },
      discoveryCondition: {
        minLevel: 5,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 115,
        coins: 55,
        itemId: 'sword',
        factionReputation: { factionId: 'F-L', amount: 40 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-aether-3',
        secretTitle: 'Most Światła Aetheria–Nexus',
        description:
          'Po zestrojeniu crystal-6 z archive-2 powstaje nieprzerywalne łącze optyczne niezależne od Chóru.',
        bonusXp: 110,
      },
      coordinates: { x: 2070, y: 700 },
    },
  ],
  hiddenPlaces: [
    {
      id: 'hidden-nexus-1',
      continent: 'nexus',
      name: 'Północny Kryształ Rezonansowy',
      category: 'artifact',
      mapAnchorId: 'crystal-7',
      coordinates: { x: 330, y: 450 },
      radius: 95,
      implementationStatus: 'active_in_engine',
      description: 'Odizolowany węzeł krystaliczny (crystal-7) na północnym zachodzie przechowujący czyste pakiety kalibracyjne.',
      discoveryRequirement: 'Dotrzyj do crystal-7 w północno-zachodnim narożniku Nexus-9.',
      reward: { xp: 75, coins: 35, itemId: 'potion' },
    },
    {
      id: 'hidden-nexus-2',
      continent: 'nexus',
      name: 'Miejsce Awaryjnego Lądowania Sondy',
      category: 'crash_site',
      mapAnchorId: 'crystal-8',
      coordinates: { x: 1510, y: 1560 },
      radius: 95,
      implementationStatus: 'active_in_engine',
      description: 'Szczątki sondy badawczej Ligi Szlaków rozbitej przy południowym krysztale crystal-8.',
      discoveryRequirement: 'Zbadaj okolicę crystal-8 na południu Nexus-9.',
      reward: { xp: 110, coins: 50, itemId: 'vest' },
    },
    {
      id: 'hidden-nexus-3',
      continent: 'nexus',
      name: 'Ukryty Schowek Konserwatorów (Pylon 14)',
      category: 'treasure',
      mapAnchorId: 'detail-pylon-14',
      coordinates: { x: 2000, y: 1330 },
      radius: 95,
      implementationStatus: 'active_in_engine',
      description: 'Skrzynia serwisowa ukryta przez Wolne Jednostki u podstawy wschodniego pylonu detail-pylon-14.',
      discoveryRequirement: 'Dotrzyj do detail-pylon-14 na południowy wschód od Portu Zerowego.',
      reward: { xp: 130, coins: 60, itemId: 'sword' },
    },
    {
      id: 'hidden-nexus-4',
      continent: 'nexus',
      name: 'Szyb Konserwacyjny do Podziemnej Serwerowni',
      category: 'passage',
      mapAnchorId: 'lab-1',
      coordinates: { x: 1050, y: 450 },
      radius: 90,
      implementationStatus: 'data_only_pending_engine',
      description: 'Winda techniczna pod lab-1 prowadząca do głębokiej sieci światłowodowej (oczekuje na wsparcie podziemi w runtime).',
      discoveryRequirement: 'Oczekuje na wdrożenie warstwy podziemi w silniku.',
      reward: { xp: 160, coins: 70 },
    },
  ],
  worldEvents: [
    {
      id: 'event-nexus-drone-patrol',
      continent: 'nexus',
      name: 'Spotkanie na Szlaku: Kordon Dronów Zwiadowców',
      category: 'trail_encounter',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 2, coordinates: { x: 840, y: 1020 }, radius: 120 },
      repeatability: 'cooldown_300s',
      description: 'Zainfekowane Drony Zwiadowcy blokują Magistralę Meridian i wzywają posiłki syreną alarmową.',
      monsterId: 'nexus-dron-zwiadowca',
      reward: { xp: 55, coins: 25, itemId: 'potion' },
    },
    {
      id: 'event-nexus-nanite-breach',
      continent: 'nexus',
      name: 'Zagrożenie Obszarowe: Wyciek Roju Nanitów',
      category: 'area_hazard',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 8, coordinates: { x: 1400, y: 920 }, radius: 130 },
      repeatability: 'cooldown_300s',
      description: 'Chmura ferrofluidowych nanitów przeżera pancerze podróżnych na Trakcie Przekaźników.',
      monsterId: 'nexus-roj-nanitow',
      reward: { xp: 115, coins: 48, itemId: 'tusk' },
    },
    {
      id: 'event-nexus-contract-d02',
      continent: 'nexus',
      name: 'Zlecenie Odnawialne D02: Kalibracja Pylonów',
      category: 'renewable_contract',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 6, requiredQuestId: 'O-N06', coordinates: { x: 1170, y: 1170 }, radius: 120 },
      repeatability: 'renewable_contract',
      description: 'Kontrakt Wolnych Jednostek: wyłącz przegrzane Wieżyczki Autonomiczne i przywróć przepływ w pylonach.',
      monsterId: 'nexus-wiezyczka-autonomiczna',
      reward: { xp: 100, coins: 45 },
    },
  ],
};
