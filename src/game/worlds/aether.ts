import { ContinentWorldData } from './types';

export const AETHER_WORLD_DATA: ContinentWorldData = {
  id: 'aether',
  name: 'Aetheria',
  raceName: 'Mędrcy',
  raceId: 'sage',
  factionId: 'F-A',
  factionName: 'Kolegium Źródeł',
  themeSummary:
    'Świątynie nad chmurami, lustrzane ogrody wodne, wielkie biblioteki pergaminów i dylemat między ochroną świadków a cenzurą niewygodnej prawdy.',
  historicalDebt:
    'Po Wielkim Rozstrojeniu Rada Kolegium uznała część relacji o przymusowej synchronizacji Chóru za zbyt niebezpieczne dla spokoju społecznego i usunęła imiona ofiar z głównych kronik.',
  size: [2400, 1792],
  spawn: { x: 1150, y: 1130 },
  cities: [
    {
      id: 'aether-sanktuarium-tysiaca-zrodel',
      name: 'Sanktuarium Tysiąca Źródeł',
      continent: 'aether',
      role: 'capital',
      isSafeZone: true,
      bounds: { x: 780, y: 560, width: 840, height: 780 },
      economicAndHistoricalFunction:
        'Stolica Aetherii skupiona wokół Źródła Pamięci (ki-source-3) oraz centralnych ogrodów świątynnych. Zapewnia pełny zestaw sześciu usług miejskich: antykwariat i sklep Mei, warsztat kaligraficzno-płatnerski Enso, depozyt pieczęci, dom herbaty i odpoczynku, tablicę kwerend oraz krąg treningowy.',
      atmosphere:
        'Marmurowe tarasy skąpane w złotym świetle, szmer kaskad wodnych, wirujące w powietrzu pierścienie glifów i zapach starego papieru oraz kadzidła.',
      npcs: [
        {
          id: 'npc-sora',
          bindingId: 'aether.npc.guide',
          name: 'Sora',
          role: 'Opiekunka Sanktuarium i Kronik',
          cityId: 'aether-sanktuarium-tysiaca-zrodel',
          coordinates: { x: 1200, y: 650 },
          storyConnection:
            'Zna brakujące imię w najstarszej tablicy świątynnej — sama wykreśliła imię własnej nauczycielki, by chronić ocalałych świadków przed prześladowaniem.',
          offeredQuestIds: ['O-A01', 'O-A02', 'O-A03', 'O-A04', 'O-A05', 'O-A06', 'M04', 'M06', 'C-S1', 'C-S2'],
        },
        {
          id: 'npc-mei',
          bindingId: 'aether.npc.merchant',
          name: 'Mei',
          role: 'Kustoszka Depozytu i Kupiec Kolegium',
          cityId: 'aether-sanktuarium-tysiaca-zrodel',
          coordinates: { x: 950, y: 870 },
          storyConnection:
            'Odkrywa rozbieżności między dwoma egzemplarzami tego samego rejestru darowizn i prowadzi gracza do drugiej kopii prawdy (M07).',
          offeredQuestIds: ['S-A01', 'S-A02', 'S-A03', 'M07'],
        },
        {
          id: 'npc-enso',
          bindingId: 'aether.npc.smith',
          name: 'Enso',
          role: 'Mistrz Pieczęci i Kosturów',
          cityId: 'aether-sanktuarium-tysiaca-zrodel',
          coordinates: { x: 1430, y: 880 },
          storyConnection:
            'Tworzy kostury Białego Archiwum (W-A1..6) oraz bada rezonans kryształowych skrzydeł i szmaragdowych łusek.',
          offeredQuestIds: ['S-A05', 'S-A06'],
        },
        {
          id: 'npc-ishin',
          bindingId: 'aether.npc.hunter',
          name: 'Ishin',
          role: 'Strażnik Zewnętrznych Schodów',
          cityId: 'aether-sanktuarium-tysiaca-zrodel',
          coordinates: { x: 1500, y: 1320 },
          storyConnection:
            'Prowadzi zwiady poza ogrodami i ustawia lustra sygnałowe pozwalające komunikować się podczas Ciszy.',
          offeredQuestIds: ['S-A07', 'S-A08', 'D04'],
        },
      ],
      citizenProblems: [
        'Puste miejsca po wykreślonych imionach na tablicach pamiątkowych budzące nieufność rodzin.',
        'Milknące pieczęcie wodne podczas fal Ciszy, mimo że fizyczny strumień wody nadal płynie.',
        'Duchy Bibliotekarzy i Pergaminowi Strażnicy blokujący dostęp do starszych skrzydeł archiwum.',
      ],
      neighborConnections: [
        {
          targetCityId: 'aether-tarasy-switu',
          roadId: 'road-aether-western-scrolls',
          relation: 'Zachodnia aleja ogrodowa do Tarasów Świtu i Zachodniego Archiwum.',
        },
        {
          targetCityId: 'aether-biala-przystan',
          roadId: 'road-aether-southern-steps',
          relation: 'Południowe schody wiodące ku przystani wodnej.',
        },
        {
          targetCityId: 'aether-archiwum-nad-chmurami',
          roadId: 'road-aether-eastern-observatory',
          relation: 'Wschodni pomost ku wysokim wieżom obserwacyjnym.',
        },
      ],
      availableQuestIds: ['O-A01', 'O-A02', 'O-A03', 'O-A04', 'O-A05', 'O-A06', 'S-A01', 'S-A02', 'S-A03'],
      secretToDiscover: {
        id: 'secret-city-aether-capital',
        title: 'Podwodna Inskrypcja w Źródle Pamięci (ki-source-3)',
        description:
          'Na dnie cembrowiny ki-source-3 wyryto prawdziwe nazwisko nauczycielki Sory oraz datę zamknięcia dolnego skryptorium.',
        triggerCondition: 'Zbadaj ki-source-3 podczas zadania O-A05 lub C-S1.',
        rewardCoins: 40,
        rewardXp: 75,
      },
      reasonToReturn:
        'Katalog Mei, rzemiosło biżuterii i kosturów u Enso, główna biblioteka Kolegium Źródeł oraz wątki Sory.',
    },
    {
      id: 'aether-tarasy-switu',
      name: 'Tarasy Świtu',
      continent: 'aether',
      role: 'craft',
      isSafeZone: true,
      bounds: { x: 460, y: 680, width: 380, height: 360 },
      economicAndHistoricalFunction:
        'Zachodnie skryptorium i osada papierników skupiona wokół Zachodniego Archiwum (archive-1), gdzie wytwarza się zwoje R-03 i atrament pieczęci.',
      atmosphere:
        'Słoneczne krużganki pełne schnących kart pergaminu, zapach żywicznego tuszu i cichy szelest kartek.',
      npcs: [
        {
          id: 'npc-nari',
          bindingId: 'aether.npc.guide',
          name: 'Nari (Archiwistka)',
          role: 'Opiekunka Zbiorów Prywatnych',
          cityId: 'aether-tarasy-switu',
          coordinates: { x: 660, y: 850 },
          storyConnection:
            'Chroni listy świadków przed przymusową publikacją bez zgody żyjących rodzin (zadanie S-A04 „Prawo do ciszy”).',
          offeredQuestIds: ['S-A04', 'S-A09', 'H-A01'],
        },
      ],
      citizenProblems: [
        'Pergaminowi Strażnicy traktujący każdego badacza bez starego stempla jako intruza.',
        'Wilgoć z chmur niszcząca niezabezpieczone zwoje w dolnych salach.',
      ],
      neighborConnections: [
        {
          targetCityId: 'aether-sanktuarium-tysiaca-zrodel',
          roadId: 'road-aether-western-scrolls',
          relation: 'Bezpośredni trakt do stolicy Aetherii.',
        },
      ],
      availableQuestIds: ['S-A04', 'S-A09', 'H-A01'],
      secretToDiscover: {
        id: 'secret-city-aether-west',
        title: 'Indeks Skreślonych Sygnatur',
        description:
          'W szufladzie pod pulpitem archive-1 leży klucz pozwalający odczytać zamazane atramentem akapity.',
        triggerCondition: 'Zbadaj archive-1 po ukończeniu O-A02.',
        rewardCoins: 35,
        rewardXp: 70,
      },
      reasonToReturn: 'Wytwarzanie zwojów R-03 oraz dostęp do bossa B-02 (Regent Białej Strony).',
    },
    {
      id: 'aether-biala-przystan',
      name: 'Biała Przystań',
      continent: 'aether',
      role: 'transport',
      isSafeZone: true,
      bounds: { x: 940, y: 1380, width: 480, height: 320 },
      economicAndHistoricalFunction:
        'Południowy port wodny i stacja przekaźników świetlnych łącząca Aetherię ze szlakami morskimi Ligi.',
      atmosphere:
        'Białe kamienne mola zanurzone w chmurach i spokojnej tafli jeziora, dzwony mgielne i latarnie pryzmatyczne.',
      npcs: [
        {
          id: 'npc-aether-ferryman',
          bindingId: 'aether.npc.merchant',
          name: 'Kael (Przewoźnik Mgły)',
          role: 'Nawigator Białej Przystani',
          cityId: 'aether-biala-przystan',
          coordinates: { x: 1170, y: 1530 },
          storyConnection:
            'Przechowuje nieoficjalny dziennik kursów z czasów ewakuacji wysp (trzecia relacja w zadaniu M07).',
          offeredQuestIds: ['S-A10', 'H-A02'],
        },
      ],
      citizenProblems: [
        'Mgielne Żurawie spowijające podejście do portu gęstą mgłą.',
        'Szmaragdowe Węże gnieżdżące się w trzcinach przy dolnych stopniach.',
      ],
      neighborConnections: [
        {
          targetCityId: 'aether-sanktuarium-tysiaca-zrodel',
          roadId: 'road-aether-southern-steps',
          relation: 'Główne schody pielgrzymie do Sanktuarium.',
        },
      ],
      availableQuestIds: ['S-A10', 'H-A02'],
      secretToDiscover: {
        id: 'secret-city-aether-port',
        title: 'Trzeci Dziennik Pokładowy',
        description:
          'W skrytce pod pomostem (detail-garden-20) ukryto dziennik przewoźnika opisujący prawdziwy przebieg synchronizacji na Wyspie II.',
        triggerCondition: 'Odwiedź południowe ogrody detail-garden-20/21.',
        rewardCoins: 45,
        rewardXp: 85,
      },
      reasonToReturn: 'Podróże międzykontynentalne, handel z Ligą Szlaków i zlecenia morskie.',
    },
    {
      id: 'aether-archiwum-nad-chmurami',
      name: 'Archiwum Nad Chmurami',
      continent: 'aether',
      role: 'expedition',
      isSafeZone: true,
      bounds: { x: 1520, y: 620, width: 420, height: 360 },
      economicAndHistoricalFunction:
        'Wschodnie obserwatorium astronomiczno-sygnałowe wokół Wschodniego Archiwum (archive-2), skąd monitorowane są anomalie Chóru.',
      atmosphere:
        'Wysokie tarasy ponad warstwą chmur, wirujące astrolabia i lustra sygnałowe skierowane ku horyzontowi.',
      npcs: [
        {
          id: 'npc-aether-observer',
          bindingId: 'aether.npc.hunter',
          name: 'Talen (Obserwator Niebios)',
          role: 'Strażnik Zwierciadeł Sygnałowych',
          cityId: 'aether-archiwum-nad-chmurami',
          coordinates: { x: 1700, y: 790 },
          storyConnection:
            'Współpracuje z Ishinem przy budowie optycznej sieci ostrzegania niezależnej od Veyra.',
          offeredQuestIds: ['S-A11', 'S-A12', 'H-A03', 'H-A04'],
        },
      ],
      citizenProblems: [
        'Oczy Wiedzy i Marionetki Rytuału przejmujące kontrolę nad zewnętrznymi wieżami.',
        'Rozkalibrowanie luster po uderzeniach piorunów Ki.',
      ],
      neighborConnections: [
        {
          targetCityId: 'aether-sanktuarium-tysiaca-zrodel',
          roadId: 'road-aether-eastern-observatory',
          relation: 'Most świetlny do centralnego Sanktuarium.',
        },
      ],
      availableQuestIds: ['S-A11', 'S-A12', 'H-A03', 'H-A04'],
      secretToDiscover: {
        id: 'secret-city-aether-east',
        title: 'Mapa Nieznanego Nadajnika',
        description:
          'Lustra w archive-2 odbijają sygnał z opuszczonej stacji na północnym szczycie (detail-cloud-peak-10).',
        triggerCondition: 'Zbadaj archive-2 po rozpoczęciu O-A06.',
        rewardCoins: 50,
        rewardXp: 90,
      },
      reasonToReturn: 'Wyprawy do Północnego Sanktuarium (sanctum-0) i walka z elitarnymi strażnikami poz. 12–18.',
    },
  ],
  roads: [
    {
      id: 'road-aether-western-scrolls',
      name: 'Aleja Pergaminowych Ogrodów',
      continent: 'aether',
      category: 'merchant',
      fromId: 'aether-sanktuarium-tysiaca-zrodel',
      toId: 'aether-tarasy-switu',
      waypoints: [
        { x: 1200, y: 735 },
        { x: 950, y: 870 },
        { x: 660, y: 850 },
      ],
      description:
        'Spokojny trakt łączący Źródło Pamięci z Zachodnim Archiwum (archive-1).',
      dangerLevel: 2,
      monsterIds: ['aether-swietlik-pieczeci', 'aether-pergaminowy-straznik'],
    },
    {
      id: 'road-aether-southern-steps',
      name: 'Schody Poza Ogrodem (Szlak Południowy)',
      continent: 'aether',
      category: 'famous_route',
      fromId: 'aether-sanktuarium-tysiaca-zrodel',
      toId: 'aether-biala-przystan',
      waypoints: [
        { x: 1150, y: 1130 },
        { x: 1030, y: 1350 },
        { x: 1170, y: 1530 },
      ],
      description:
        'Kamienne stopnie prowadzące z tarasów świątynnych przez ogrody wodne do Białej Przystani.',
      dangerLevel: 4,
      monsterIds: ['aether-krysztalowy-motyl', 'aether-szmaragdowy-waz'],
      restPoint: {
        name: 'Pawilon Południowego Ogrodu (detail-garden-14)',
        x: 810,
        y: 1270,
        description: 'Cicha altana z czystą wodą źródlaną.',
      },
    },
    {
      id: 'road-aether-eastern-observatory',
      name: 'Pomost Złotych Pieczęci',
      continent: 'aether',
      category: 'merchant',
      fromId: 'aether-sanktuarium-tysiaca-zrodel',
      toId: 'aether-archiwum-nad-chmurami',
      waypoints: [
        { x: 1200, y: 735 },
        { x: 1430, y: 880 },
        { x: 1700, y: 790 },
      ],
      description:
        'Wschodni trakt łączący warsztat Enso z Wschodnim Obserwatorium (archive-2).',
      dangerLevel: 6,
      monsterIds: ['aether-pergaminowy-straznik', 'aether-duch-bibliotekarza'],
    },
    {
      id: 'road-aether-northern-sanctum',
      name: 'Droga Milczącego Chóru (Szlak Północny)',
      continent: 'aether',
      category: 'dangerous',
      fromId: 'aether-sanktuarium-tysiaca-zrodel',
      toId: 'sanctum-0',
      waypoints: [
        { x: 1200, y: 650 },
        { x: 1200, y: 520 },
        { x: 1200, y: 430 },
      ],
      description:
        'Uroczyste podejście do najwyższego Sanktuarium Pustej Paginy (sanctum-0), strzeżone przez Lwy Świątyni i Złote Skarabeusze.',
      dangerLevel: 12,
      monsterIds: ['aether-zloty-skarabeusz', 'aether-lew-swiatyni', 'aether-oko-wiedzy'],
    },
    {
      id: 'road-aether-cloud-peaks',
      name: 'Grzbiet Mgielnych Żurawi',
      continent: 'aether',
      category: 'ambush',
      fromId: 'aether-tarasy-switu',
      toId: 'aether-archiwum-nad-chmurami',
      waypoints: [
        { x: 660, y: 850 },
        { x: 430, y: 500 },
        { x: 1950, y: 420 },
        { x: 1700, y: 790 },
      ],
      description:
        'Wysokogórski szlak biegnący między drzewami Ki (ki-tree-6..7) i szczytami chmur (detail-cloud-peak-8..11).',
      dangerLevel: 16,
      monsterIds: ['aether-marionetka-rytualu', 'aether-mgielny-zuraw'],
    },
  ],
  famousLocations: [
    {
      id: 'famous-aether-1',
      mapPointId: 'sanctum-0',
      continent: 'aether',
      name: 'Sanktuarium Pustej Paginy (Górna Świątynia)',
      loreAndLegend:
        'Najstarsza i najwyżej położona świątynia Aetherii (sanctum-0), w której przechowuje się kamienny oryginał Paktu Założycielskiego. W centralnej tablicy wyżłobiono puste miejsce po imieniu pierwszego archiwisty, który odmówił zatwierdzenia przymusowej synchronizacji. Nawet podczas najsilniejszej Ciszy wewnątrz kopuły słychać cichy pogłos spadających kropel.',
      canonLink:
        'Punkt kulminacyjny prologu O-A01, wątku osobistego Sory (C-S1) oraz starcia z Regentem Białej Strony (B-02).',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Pokonaj Lwa Świątyni strzegącego wejścia do wewnętrznej nawy, wykorzystując jego odsłoniętą runę na karku.',
        monsterId: 'aether-lew-swiatyni',
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
        factionReputation: { factionId: 'F-A', amount: 35 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-aether-2',
        secretTitle: 'Brakujący Wers z Kamiennej Tablicy',
        description:
          'Odbitka brakującego wersu z sanctum-0 zachowała się na marginesie księgi w Zachodnim Archiwum (archive-1).',
        bonusXp: 90,
      },
      coordinates: { x: 1200, y: 430 },
    },
    {
      id: 'famous-aether-2',
      mapPointId: 'archive-1',
      continent: 'aether',
      name: 'Zachodnie Archiwum Skreślonych Imion',
      loreAndLegend:
        'Rozległy pawilon biblioteczny (archive-1) na Tarasach Świtu, w którym gromadzono duplikaty rejestrów ludności ze wszystkich czterech kontynentów. Przez lata uważano go za zwykły magazyn gospodarczy, dopóki Mei nie zauważyła, że stare kopie zawierają nazwiska wymazane z nowszych ksiąg oficjalnych. Półki patrolują Duchy Bibliotekarzy, którzy po śmierci nadal pilnują ciszy czytelni.',
      canonLink:
        'Kluczowa lokacja zadań O-A02 („Katalog rzeczy odzyskanych”), M06 oraz M07 („Druga kopia prawdy”).',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Uspokój Ducha Bibliotekarza i odzyskaj zapieczętowany tom rejestru.',
        monsterId: 'aether-duch-bibliotekarza',
      },
      discoveryCondition: {
        minLevel: 2,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 80,
        coins: 35,
        itemId: 'potion',
        factionReputation: { factionId: 'F-A', amount: 30 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-pyra-2',
        secretTitle: 'Świadectwo Strażników Popiołu',
        description:
          'Wśród ocalonych zwojów znajduje się raport potwierdzający niewinność ratowników z Kaplicy Dezerterów w Pyrze.',
        bonusXp: 100,
      },
      coordinates: { x: 660, y: 850 },
    },
    {
      id: 'famous-aether-3',
      mapPointId: 'archive-2',
      continent: 'aether',
      name: 'Wschodnie Obserwatorium Lustrzanych Sygnałów',
      loreAndLegend:
        'Wieża archiwalno-pomiarowa (archive-2) zawieszona nad wschodnią krawędzią klifów chmurowych. Dawni uczeni Aetherii zbudowali tu system obrotowych zwierciadeł z polerowanego brązu i kryształu, zdolny przesyłać wiadomości świetlne między wyspami bez użycia energii Chóru. Po przebudzeniu Oczu Wiedzy część luster została zablokowana w jednej pozycji.',
      canonLink:
        'Miejsce wyprawy O-A06 („Schody poza ogrodem”) oraz budowy zapasowej sieci komunikacyjnej w akcie V (M19).',
      challengeOrEncounter: {
        type: 'combat',
        description:
          'Zniszcz Oko Wiedzy blokujące główny pryzmat sygnałowy na tarasie obserwatorium.',
        monsterId: 'aether-oko-wiedzy',
      },
      discoveryCondition: {
        minLevel: 4,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 105,
        coins: 50,
        itemId: 'sword',
        factionReputation: { factionId: 'F-L', amount: 35 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-nexus-4',
        secretTitle: 'Odbicie Wiązki Horyzontu',
        description:
          'Kąt nachylenia wschodniego lustra celuje dokładnie w Pryzmat Sygnału Horyzontu na Nexus-9 (crystal-6).',
        bonusXp: 110,
      },
      coordinates: { x: 1700, y: 790 },
    },
    {
      id: 'famous-aether-4',
      mapPointId: 'ki-source-3',
      continent: 'aether',
      name: 'Źródło Między Kroplami (Źródło Pamięci)',
      loreAndLegend:
        'Święty basen krystalicznej wody i energii Ki (ki-source-3) w centrum Sanktuarium Aetherii. Zgodnie z tradycją Mędrców krople opadające z pierścienia nad taflą odmierzają czas pomiędzy kolejnymi pokoleniami kronikarzy. Podczas Ciszy pieczęcie wokół basenu gasną, lecz sama woda zachowuje rytm siedmiu uderzeń, ujawniając różnicę między naturalnym światem a siecią Veyra.',
      canonLink:
        'Centralny punkt startowy prologu Mędrców (O-A01, O-A05) oraz cel zdefiniowany w gpu-production-targets.json.',
      challengeOrEncounter: {
        type: 'observation',
        description:
          'Policz ręcznie przepływ wody podczas Ciszy i zapisz ton, którego nie rejestrują oficjalne pieczęcie.',
      },
      discoveryCondition: {
        minLevel: 1,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 55,
        coins: 25,
        itemId: 'potion',
        factionReputation: { factionId: 'F-A', amount: 25 },
      },
      crossLocationSecret: {
        linkedLocationId: 'famous-verdant-1',
        secretTitle: 'Podziemna Więź Wód Superior',
        description:
          'Puls Źródła Pamięci jest zsynchronizowany co do sekundy ze Źródłem Pierwszego Oddechu w Verdantii.',
        bonusXp: 80,
      },
      coordinates: { x: 1200, y: 735 },
    },
  ],
  hiddenPlaces: [
    {
      id: 'hidden-aether-1',
      continent: 'aether',
      name: 'Drzewo Świetlistych Glifów (Zachodni Gaj)',
      category: 'shrine',
      mapAnchorId: 'ki-tree-4',
      coordinates: { x: 560, y: 1320 },
      radius: 95,
      implementationStatus: 'active_in_engine',
      description: 'Starożytne drzewo Ki (ki-tree-4), pod którym uczniowie zakopywali ćwiczeniowe pieczęcie.',
      discoveryRequirement: 'Dotrzyj do ki-tree-4 w południowo-zachodnim gaju Aetherii.',
      reward: { xp: 70, coins: 30, itemId: 'potion' },
    },
    {
      id: 'hidden-aether-2',
      continent: 'aether',
      name: 'Ołtarz Złotego Skarabeusza',
      category: 'altar',
      mapAnchorId: 'ki-tree-6',
      coordinates: { x: 430, y: 500 },
      radius: 95,
      implementationStatus: 'active_in_engine',
      description: 'Ukryta krypta pod korzeniami ki-tree-6 strzeżona przez Złotego Skarabeusza.',
      discoveryRequirement: 'Odwiedź północno-zachodnie drzewo ki-tree-6.',
      reward: { xp: 100, coins: 45, itemId: 'tusk' },
    },
    {
      id: 'hidden-aether-3',
      continent: 'aether',
      name: 'Opuszczona Stacja Nadajnika na Szczycie Chmur',
      category: 'artifact',
      mapAnchorId: 'ki-tree-7',
      coordinates: { x: 1950, y: 420 },
      radius: 100,
      implementationStatus: 'active_in_engine',
      description: 'Stary przekaźnik optyczny ukryty przy ki-tree-7, pokazujący mapę spoza katalogu biblioteki.',
      discoveryRequirement: 'Dotrzyj do północno-wschodniego szczytu przy ki-tree-7.',
      reward: { xp: 125, coins: 55, itemId: 'vest' },
    },
    {
      id: 'hidden-aether-4',
      continent: 'aether',
      name: 'Zatoka Zapomnianych Kronik (Krypta Podwodna)',
      category: 'passage',
      mapAnchorId: 'detail-garden-21',
      coordinates: { x: 1310, y: 1530 },
      radius: 90,
      implementationStatus: 'data_only_pending_engine',
      description: 'Zatopione schody prowadzące do podwodnego archiwum (oczekuje na wsparcie podziemi w runtime).',
      discoveryRequirement: 'Oczekuje na wdrożenie warstwy podziemi w silniku.',
      reward: { xp: 150, coins: 65 },
    },
  ],
  worldEvents: [
    {
      id: 'event-aether-butterfly-prism',
      continent: 'aether',
      name: 'Odkrycie na Szlaku: Rój Kryształowych Motyli',
      category: 'exploration_discovery',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 3, coordinates: { x: 810, y: 1270 }, radius: 120 },
      repeatability: 'cooldown_300s',
      description: 'W ogrodach południowych Kryształowe Motyle załamują światło, ujawniając ukryte runy na kamieniach.',
      monsterId: 'aether-krysztalowy-motyl',
      reward: { xp: 65, coins: 30, itemId: 'potion' },
    },
    {
      id: 'event-aether-puppet-ambush',
      continent: 'aether',
      name: 'Zagrożenie Obszarowe: Przebudzenie Marionetek Rytuału',
      category: 'area_hazard',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 12, coordinates: { x: 1430, y: 630 }, radius: 130 },
      repeatability: 'cooldown_300s',
      description: 'Nici eteru napinają się między kolumnami wschodniego pomostu — Marionetki Rytuału blokują drogę.',
      monsterId: 'aether-marionetka-rytualu',
      reward: { xp: 130, coins: 55, itemId: 'tusk' },
    },
    {
      id: 'event-aether-contract-d04',
      continent: 'aether',
      name: 'Zlecenie Odnawialne D04: Archiwum w Terenie',
      category: 'renewable_contract',
      implementationStatus: 'active_in_engine',
      activationCondition: { minLevel: 8, requiredQuestId: 'O-A06', coordinates: { x: 1500, y: 1320 }, radius: 120 },
      repeatability: 'renewable_contract',
      description: 'Kontrakt Kolegium Źródeł: zabezpiecz odczyty z luster sygnałowych i odeprzyj Pergaminowych Strażników.',
      monsterId: 'aether-pergaminowy-straznik',
      reward: { xp: 95, coins: 42 },
    },
  ],
};
