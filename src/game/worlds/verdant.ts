import { ContinentWorldData } from "./types";

export const VERDANT_WORLD_DATA: ContinentWorldData = {
  id: "verdant",
  name: "Verdantia",
  raceName: "Planetarni",
  raceId: "planetary",
  factionId: "F-V",
  factionName: "Krąg Żywych Szlaków",
  themeSummary:
    "Żywe lasy, pradawne korzenie, rozlewiska i spór o równowagę między korzystaniem z zasobów natury a obowiązkiem odbudowy szlaków.",
  historicalDebt:
    "Przed laty podczas wielkiego wezbrania rzeki władze skierowały falę powodziową na doliny uznane w oficjalnych mapach za opuszczone, choć wciąż mieszkały tam rodziny zbieraczy.",
  size: [3072, 2048],
  spawn: { x: 1495, y: 1260 },
  cities: [
    {
      id: "verdant-zielona-przystan",
      name: "Zielona Przystań",
      continent: "verdant",
      role: "capital",
      isSafeZone: true,
      bounds: { x: 950, y: 520, width: 1120, height: 1050 },
      economicAndHistoricalFunction:
        "Stolica Verdantii i główne sanktuarium wymiany nasion, map szlakowych oraz rzemiosła opartego na żywym drewnie. Oferuje pełny zestaw sześciu usług miejskich: rynek kupiecki, kuźnię, depozyt, gospodę, tablicę kontraktów oraz bezpieczną strefę odpoczynku.",
      atmosphere:
        "Rozświetlone latarniami korzennymi tarasy pod gigantycznymi dębami, szum centralnej fontanny Rynku i zapach żywicy mieszający się z herbatą źródeł.",
      npcs: [
        {
          id: "npc-aira",
          bindingId: "verdant.npc.guide",
          name: "Aira",
          role: "Przewodniczka Zielonej Przystani",
          cityId: "verdant-zielona-przystan",
          coordinates: { x: 1480, y: 800 },
          storyConnection:
            "Podpisała dawne mapy ewakuacyjne z błędnym oznaczeniem dolin jako niezamieszkanych; prowadzi gracza od prologu O-V01 do prawdy o Rozdzielni Rzeki.",
          offeredQuestIds: ["O-V01", "O-V02", "O-V03", "O-V04", "O-V05", "O-V06", "M01", "M13"],
        },
        {
          id: "npc-mio",
          bindingId: "verdant.npc.merchant",
          name: "Mio",
          role: "Kupiec Zielonej Przystani",
          cityId: "verdant-zielona-przystan",
          coordinates: { x: 1190, y: 1020 },
          storyConnection:
            "Utrzymuje handel z osadami rzecznymi i zbiera raporty od przewoźniczki Neli o brakujących dostawach ziół.",
          offeredQuestIds: ["S-V01", "S-V02", "S-V05"],
        },
        {
          id: "npc-taro",
          bindingId: "verdant.npc.smith",
          name: "Taro",
          role: "Mistrz Kowal Korzeni",
          cityId: "verdant-zielona-przystan",
          coordinates: { x: 1050, y: 1510 },
          storyConnection:
            "Kuje ostrza z hartowanego drewna i kamienia rzecznego; uczy gracza odróżniać uczciwą naprawę od prowizorycznego łatania.",
          offeredQuestIds: ["S-V03", "S-V06", "P01"],
        },
        {
          id: "npc-ren",
          bindingId: "verdant.npc.hunter",
          name: "Ren",
          role: "Zwiadowca Kręgu Żywych Szlaków",
          cityId: "verdant-zielona-przystan",
          coordinates: { x: 2070, y: 1040 },
          storyConnection:
            "Kieruje wyprawami poza bezpieczne mury i bada nagłe przebudzenie Strażników Ruin oraz migracje Skalnych Jeleni.",
          offeredQuestIds: ["S-V04", "S-V07", "S-V08", "D01"],
        },
      ],
      citizenProblems: [
        "Nadejścia Ciszy gaszące latarnie korzenne i dezorientujące tragarzy.",
        "Sprzeczność między oficjalną mapą Orena a listami przynoszonymi przez Nelę z rzekomo pustych dolin.",
        "Niedobór mchowej galaretki i ziół leczniczych po zablokowaniu wschodniego mostu.",
      ],
      neighborConnections: [
        {
          targetCityId: "verdant-przystan-trzech-mostow",
          roadId: "road-verdant-eastern-bridges",
          relation: "Główny szlak spławu drewna i poczty rzecznej na wschód.",
        },
        {
          targetCityId: "verdant-kamienny-sad",
          roadId: "road-verdant-southern-orchard",
          relation: "Droga dostaw rudy korzennej i żywicy rzemieślniczej z południa.",
        },
        {
          targetCityId: "verdant-latarnia-korzeni",
          roadId: "road-verdant-northern-canopy",
          relation: "Leśna ścieżka zwiadowcza prowadząca do północnych punktów obserwacyjnych.",
        },
      ],
      availableQuestIds: [
        "O-V01",
        "O-V02",
        "O-V03",
        "O-V04",
        "O-V05",
        "O-V06",
        "M01",
        "S-V01",
        "S-V02",
        "S-V03",
      ],
      secretToDiscover: {
        id: "secret-city-verdant-capital",
        title: "Skrytka pod Fontanną Rynku",
        description:
          "W cembrowinie fontanny (fountain-5) wyryto stare stany wód pokazujące, że śluzy celowo zamknięto od strony zachodniej doliny.",
        triggerCondition: "Zbadaj fontannę Rynku po ukończeniu O-V03.",
        rewardCoins: 35,
        rewardXp: 60,
      },
      reasonToReturn:
        "Pełny zestaw 6 usług (kuźnia Taro, sklep Mio, depozyt, tablica kontraktów Ligi, rozmowy z Airą w aktach I, IV i VI).",
    },
    {
      id: "verdant-przystan-trzech-mostow",
      name: "Przystań Trzech Mostów",
      continent: "verdant",
      role: "transport",
      isSafeZone: true,
      bounds: { x: 2220, y: 820, width: 480, height: 380 },
      economicAndHistoricalFunction:
        "Węzeł transportu rzecznego i przepraw promowych łączący Verdantię z Wyspą Pierwszego Echa oraz wschodnimi rozlewiskami.",
      atmosphere:
        "Drewniane pomosty zawieszone nad bystrym nurtem, dzwonki ostrzegawcze we mgle i sterty lin konopnych.",
      npcs: [
        {
          id: "npc-nela",
          bindingId: "verdant.npc.merchant",
          name: "Nela (Przewoźniczka)",
          role: "Przewoźniczka Rzeczna i Kurierka",
          cityId: "verdant-przystan-trzech-mostow",
          coordinates: { x: 2463, y: 1000 },
          storyConnection:
            "Regularnie przepływa obok zatopionych domów i przechowuje nieodebrane listy rodzin z doliny.",
          offeredQuestIds: ["S-V09", "S-V10", "H-V01"],
        },
      ],
      citizenProblems: [
        "Korzeniowe Pełzacze podmywające filary wschodniego mostu (bridge-6).",
        "Zatrzymanie barek z zaopatrzeniem podczas wahań poziomu wody.",
      ],
      neighborConnections: [
        {
          targetCityId: "verdant-zielona-przystan",
          roadId: "road-verdant-eastern-bridges",
          relation: "Bezpośredni trakt kupiecki do Rynku stolicy.",
        },
        {
          targetCityId: "verdant-latarnia-korzeni",
          roadId: "road-verdant-river-bend",
          relation: "Szlak wzdłuż górnego biegu rzeki.",
        },
      ],
      availableQuestIds: ["S-V09", "S-V10", "M02"],
      secretToDiscover: {
        id: "secret-city-verdant-bridges",
        title: "Podwójny Dziennik Przewozowy",
        description:
          "Pod deskami przystani znajduje się skrzynka z kwitami przewozowymi potwierdzającymi dostawy żywności do „nieistniejącej” osady.",
        triggerCondition: "Odwiedź most (bridge-6) z aktywnym zadaniem O-V04 lub S-V09.",
        rewardCoins: 40,
        rewardXp: 75,
      },
      reasonToReturn:
        "Wyprawy rzeczne, odbiór kontraktów transportowych Ligi Szlaków oraz skrót na wschodnie łowiska.",
    },
    {
      id: "verdant-kamienny-sad",
      name: "Kamienny Sad",
      continent: "verdant",
      role: "craft",
      isSafeZone: true,
      bounds: { x: 420, y: 1280, width: 460, height: 420 },
      economicAndHistoricalFunction:
        "Osada rzemieślnicza położona wśród omszałych głazów i sadów bursztynowych, specjalizująca się w obróbce ziół, żywicy i skór.",
      atmosphere:
        "Ciche tarasy otoczone kamiennymi murkami (fence-286..288), suszarnie ziół i stuki dłut kamieniarzy.",
      npcs: [
        {
          id: "npc-oren",
          bindingId: "verdant.npc.smith",
          name: "Oren (Kartograf Osady)",
          role: "Starszy Mierniczy i Rzemieślnik",
          cityId: "verdant-kamienny-sad",
          coordinates: { x: 674, y: 1436 },
          storyConnection:
            "Wykonał oficjalny odpis mapy po powodzi na polecenie rady; zmaga się z poczuciem winy.",
          offeredQuestIds: ["S-V11", "H-V02"],
        },
      ],
      citizenProblems: [
        "Bursztynowe Osy zakładające gniazda w starych sadach.",
        "Pękanie kamiennych koryt nawadniających przez ruchy korzeni.",
      ],
      neighborConnections: [
        {
          targetCityId: "verdant-zielona-przystan",
          roadId: "road-verdant-southern-orchard",
          relation: "Szlak dostaw rzemieślniczych do kuźni Taro.",
        },
      ],
      availableQuestIds: ["S-V11", "H-V02"],
      secretToDiscover: {
        id: "secret-city-verdant-orchard",
        title: "Znak Powodziowy na Głazie (rock-255)",
        description:
          "Na głazie granicznym zachowała się oryginalna kreska pomiarowa, o półtora łokcia wyższa niż w oficjalnym rejestrze.",
        triggerCondition: "Zbadaj głaz rock-255 w Kamiennym Sadzie.",
        rewardCoins: 30,
        rewardXp: 70,
      },
      reasonToReturn:
        "Skup rzadkich materiałów roślinnych (zarodniki, żywy korzeń) i rzemiosło użytkowe.",
    },
    {
      id: "verdant-latarnia-korzeni",
      name: "Latarnia Korzeni",
      continent: "verdant",
      role: "expedition",
      isSafeZone: true,
      bounds: { x: 1180, y: 180, width: 520, height: 320 },
      economicAndHistoricalFunction:
        "Północny posterunek wyprawowy strzegący wejścia do głębokiej puszczy, megalitów i Rozdzielni Rzeki.",
      atmosphere:
        "Wysoka strażnica opleciona świecącymi pnączami, skąd widać mgłę nad północnymi ruinami.",
      npcs: [
        {
          id: "npc-lina",
          bindingId: "verdant.npc.hunter",
          name: "Lina (Strażniczka Latarni)",
          role: "Opiekunka Północnych Szlaków",
          cityId: "verdant-latarnia-korzeni",
          coordinates: { x: 1492, y: 418 },
          storyConnection:
            "Utrzymuje sygnały świetlne podczas Ciszy bez użycia sieci Chóru, polegając na ręcznych lampach olejowych.",
          offeredQuestIds: ["S-V12", "H-V03", "H-V04"],
        },
      ],
      citizenProblems: [
        "Puchacze Pyłowe i Strażnicy Ruin schodzący z północnych wzgórz.",
        "Zanik naturalnego blasku pnączy w pobliżu starych megalitów.",
      ],
      neighborConnections: [
        {
          targetCityId: "verdant-zielona-przystan",
          roadId: "road-verdant-northern-canopy",
          relation: "Droga alarmowa i zaopatrzeniowa do stolicy.",
        },
      ],
      availableQuestIds: ["S-V12", "H-V03", "H-V04"],
      secretToDiscover: {
        id: "secret-city-verdant-beacon",
        title: "Kod Ręcznych Błysków",
        description:
          "W latarni zapisano sekwencję sygnałów używaną przez zwiadowców do ostrzegania dolin poza oficjalną siecią.",
        triggerCondition: "Porozmawiaj z Liną po ukończeniu O-V05.",
        rewardCoins: 45,
        rewardXp: 85,
      },
      reasonToReturn:
        "Baza wypadowa na wysokopoziomowe potwory Verdantii (poz. 12–18) oraz wejście na szlak do bossa B-04 (Serce Splątanych Korzeni).",
    },
  ],
  roads: [
    {
      id: "road-verdant-eastern-bridges",
      name: "Trakt Trzech Mostów",
      continent: "verdant",
      category: "merchant",
      fromId: "verdant-zielona-przystan",
      toId: "verdant-przystan-trzech-mostow",
      waypoints: [
        { x: 1480, y: 1000 },
        { x: 1860, y: 1020 },
        { x: 2260, y: 1000 },
        { x: 2463, y: 1000 },
      ],
      description:
        "Główny szlak kupiecki prowadzący od Fontanny Rynku przez aleję latarń (lamp-12..14) do wschodniego mostu.",
      dangerLevel: 2,
      monsterIds: ["verdant-mchowy-szlamak", "verdant-cierniowy-wilk"],
      restPoint: {
        name: "Ławka pod Latarnią Wschodnią (lamp-13)",
        x: 2260,
        y: 890,
        description: "Bezpieczny krąg światła przed wejściem na drewniany most.",
      },
      roadsideSecret: {
        id: "road-secret-verdant-1",
        title: "Znak Przewoźników na Barierce",
        x: 2250,
        y: 1120,
        description:
          "Nacięcia na słupku latarni lamp-14 wskazujące ukryty schowek na liny i prowiant.",
        rewardCoins: 20,
      },
    },
    {
      id: "road-verdant-southern-orchard",
      name: "Szlak Kamiennego Sadu",
      continent: "verdant",
      category: "famous_route",
      fromId: "verdant-zielona-przystan",
      toId: "verdant-kamienny-sad",
      waypoints: [
        { x: 1190, y: 1020 },
        { x: 1050, y: 1350 },
        { x: 840, y: 1490 },
        { x: 674, y: 1436 },
      ],
      description:
        "Kamienista droga łącząca kuźnię Taro z południowo-zachodnimi sadami i płotami granicznymi.",
      dangerLevel: 4,
      monsterIds: ["verdant-cierniowy-wilk", "verdant-lisciak-skrytobojca"],
      restPoint: {
        name: "Przyczółek przy Płocie (fence-286)",
        x: 840,
        y: 1490,
        description: "Osłonięty od wiatru murek, przy którym odpoczywają tragarze rudy.",
      },
    },
    {
      id: "road-verdant-northern-canopy",
      name: "Ścieżka Koron i Megalitów",
      continent: "verdant",
      category: "dangerous",
      fromId: "verdant-zielona-przystan",
      toId: "verdant-latarnia-korzeni",
      waypoints: [
        { x: 1480, y: 800 },
        { x: 1480, y: 600 },
        { x: 1492, y: 418 },
      ],
      description: "Stroma leśna droga wiodąca na północ ku starym dębom i posterunkowi Liny.",
      dangerLevel: 8,
      monsterIds: [
        "verdant-korzeniowy-pelzacz",
        "verdant-grzybowy-zarodnik",
        "verdant-skalny-jelen",
      ],
    },
    {
      id: "road-verdant-drowned-valley",
      name: "Zapomniana Droga Zatopionej Doliny",
      continent: "verdant",
      category: "forgotten",
      fromId: "verdant-kamienny-sad",
      toId: "cottage-0",
      waypoints: [
        { x: 674, y: 1436 },
        { x: 746, y: 927 },
        { x: 1040, y: 610 },
      ],
      description:
        "Zarośnięty mchem trakt prowadzący do opuszczonych domostw z czasów wielkiej powodzi.",
      dangerLevel: 10,
      monsterIds: ["verdant-bursztynowa-osa", "verdant-lesny-pajak"],
      roadsideSecret: {
        id: "road-secret-verdant-2",
        title: "Zatarty Słup Milowy",
        x: 746,
        y: 664,
        description: "Słup z dawną nazwą doliny skuto dłutem, lecz pod mchem wciąż widać kierunek.",
        rewardCoins: 30,
      },
    },
    {
      id: "road-verdant-ambush-thicket",
      name: "Gąszcz Liściaków (Odcinek Zasadzek)",
      continent: "verdant",
      category: "ambush",
      fromId: "verdant-latarnia-korzeni",
      toId: "verdant-przystan-trzech-mostow",
      waypoints: [
        { x: 1492, y: 418 },
        { x: 1986, y: 565 },
        { x: 2323, y: 828 },
        { x: 2463, y: 1000 },
      ],
      description:
        "Wąski przesmyk między gęstymi krzewami (bush-253..259), w którym czają się Liściaki Skrytobójcy i Leśne Pająki.",
      dangerLevel: 14,
      monsterIds: ["verdant-lisciak-skrytobojca", "verdant-lesny-pajak", "verdant-puchacz-pylowy"],
    },
    {
      id: "road-verdant-ancient-ruins",
      name: "Szlak Strażników Ruin",
      continent: "verdant",
      category: "secret",
      fromId: "verdant-latarnia-korzeni",
      toId: "rock-264",
      waypoints: [
        { x: 1492, y: 418 },
        { x: 2166, y: 944 },
        { x: 2732, y: 1798 },
      ],
      description:
        "Ukryta ścieżka wiodąca ku południowo-wschodnim megalitom (rock-264), patrolowana przez Strażników Ruin.",
      dangerLevel: 18,
      monsterIds: ["verdant-puchacz-pylowy", "verdant-straznik-ruin"],
    },
  ],
  famousLocations: [
    {
      id: "famous-verdant-1",
      mapPointId: "fountain-5",
      continent: "verdant",
      name: "Źródło Pierwszego Oddechu (Fontanna Rynku)",
      loreAndLegend:
        "Zbudowana nad najgłębszym splotem korzeni Verdantii fontanna była niegdyś naturalnym barometrem ciśnienia wód podziemnych. Według legendy Planetarnych pierwszy wędrowiec usłyszał tu puls lasu i nauczył się synchronizować oddech z nurtem rzeki. Podczas Ciszy woda w misie przestaje szemrać, choć jej poziom ani drgnie.",
      canonLink:
        "Bezpośrednio powiązana z prologiem O-V01/O-V05 oraz tajemnicą zamkniętych śluz zachodniej doliny.",
      challengeOrEncounter: {
        type: "observation",
        description:
          "Porównaj rytm wypływu wody z nacięciami na kamiennej cembrowinie podczas Ciszy i odczytaj ukrytą sygnaturę poziomu śluz.",
      },
      discoveryCondition: {
        minLevel: 1,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 50,
        coins: 25,
        itemId: "potion",
        factionReputation: { factionId: "F-V", amount: 25 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-aether-4",
        secretTitle: "Wspólny Rytm Dwóch Źródeł",
        description:
          "Liczba uderzeń wody w Fontannie Rynku (7 uderzeń) pokrywa się dokładnie z rytmem Źródła Pamięci w Aetherii.",
        bonusXp: 80,
      },
      coordinates: { x: 1480, y: 1000 },
    },
    {
      id: "famous-verdant-2",
      mapPointId: "bridge-6",
      continent: "verdant",
      name: "Most Trzech Nurtów i Zaginionych Znaków",
      loreAndLegend:
        "Potężna drewniano-kamienna przeprawa spinająca wschodni brzeg Zielonej Przystani ze szlakiem ku wybrzeżu. Pod jego przęsłami łączą się trzy odnogi rzeki, z których jedna została sztucznie przegrodzona podczas Wielkiego Rozstrojenia. Przewoźnicy zostawiają pod belkami mostu tabliczki z nazwiskami osób, które wyruszyły w głąb puszczy i jeszcze nie wróciły.",
      canonLink:
        "Kluczowy punkt wyprawy O-V06 oraz szlaku morskiego do Wyspy Pierwszego Echa (M03).",
      challengeOrEncounter: {
        type: "combat",
        description:
          "Oczyść przyczółek mostu z Mchowych Szlamaków i Cierniowych Wilków blokujących przejazd wozów Neli.",
        monsterId: "verdant-cierniowy-wilk",
      },
      discoveryCondition: {
        minLevel: 2,
        requirePhysicalArrival: true,
        arrivalRadius: 120,
      },
      firstDiscoveryReward: {
        xp: 75,
        coins: 35,
        itemId: "tusk",
        factionReputation: { factionId: "F-L", amount: 30 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-verdant-3",
        secretTitle: "Spławione Drzwi z Doliny",
        description:
          "Pod przęsłem mostu zatrzymała się rzeźbiona framuga pasująca do opuszczonej chaty cottage-0.",
        bonusXp: 90,
      },
      coordinates: { x: 2463, y: 1000 },
    },
    {
      id: "famous-verdant-3",
      mapPointId: "cottage-0",
      continent: "verdant",
      name: "Dom Podwójnego Echa (Opuszczona Chata Doliny)",
      loreAndLegend:
        "Chata stojąca na północno-zachodnim skraju osady (cottage-0), którą oficjalny rejestr Orena oznaczył jako niezamieszkaną ruinę. W rzeczywistości wewnątrz wciąż palono w piecu, a na framudze drzwi zachowały się kreski wzrostu dzieci oraz ślady wysokiej wody sprzed dwudziestu lat. To żywy dowód na to, że dolina nie była pusta w dniu otwarcia śluz.",
      canonLink:
        "Centralne miejsce zadania O-V04 („Mapa pustych domów”) oraz dowód w konfrontacji z radą w akcie IV (M16).",
      challengeOrEncounter: {
        type: "puzzle",
        description:
          "Zestaw trzy zachowane znaki powodziowe na ścianie chaty z mapą Orena, aby udokumentować prawdziwy zasięg zalania.",
      },
      discoveryCondition: {
        minLevel: 2,
        requirePhysicalArrival: true,
        arrivalRadius: 110,
      },
      firstDiscoveryReward: {
        xp: 90,
        coins: 40,
        itemId: "vest",
        factionReputation: { factionId: "F-V", amount: 35 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-nexus-3",
        secretTitle: "Zbieżność Numeru Ewakuacji",
        description:
          "Numer spisowy na belce stropowej nosi ten sam prefiks audytowy co logi ewakuacyjne w Terminalu Nexus-9.",
        bonusXp: 100,
      },
      coordinates: { x: 1040, y: 610 },
    },
    {
      id: "famous-verdant-4",
      mapPointId: "forge-2",
      continent: "verdant",
      name: "Korzenna Kuźnia Pradawnych Rytów",
      loreAndLegend:
        "Warsztat Taro zbudowany bezpośrednio wokół żywego pnia prastarego dębu, gdzie miechy poruszane są prądem strumienia. Dawni mistrzowie Verdantii nie przetapiali tu żelaza na ślepo — każde ostrze musiało przejść próbę sprężystości na kamiennym kowadle, by nie łamać gałęzi bez potrzeby. W fundamentach kuźni spoczywa stary klucz nastawczy do rzecznych wrót.",
      canonLink:
        "Miejsce rozpoczęcia ścieżki rzemiosła P01 oraz wykuwania broni Zielonego Traktu (W-V1..W-V6).",
      challengeOrEncounter: {
        type: "combat",
        description:
          "Powstrzymaj Korzeniowego Pełzacza, który przebił się przez kanał chłodzący pod kuźnią.",
        monsterId: "verdant-korzeniowy-pelzacz",
      },
      discoveryCondition: {
        minLevel: 4,
        requirePhysicalArrival: true,
        arrivalRadius: 115,
      },
      firstDiscoveryReward: {
        xp: 110,
        coins: 50,
        itemId: "sword",
        factionReputation: { factionId: "F-V", amount: 40 },
      },
      crossLocationSecret: {
        linkedLocationId: "famous-pyra-2",
        secretTitle: "Stop Żelaza i Popiołu",
        description:
          "Pod kowadłem Taro spoczywa próbka bazaltowej stali podarowana przed wiekiem przez kowali z Pyry.",
        bonusXp: 110,
      },
      coordinates: { x: 1050, y: 1510 },
    },
  ],
  hiddenPlaces: [
    {
      id: "hidden-verdant-1",
      continent: "verdant",
      name: "Zapomniana Kapliczka Siewców",
      category: "shrine",
      mapAnchorId: "oak-24",
      coordinates: { x: 1235, y: 164 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description:
        "Mała kapliczka ukryta w korzeniach północnego dębu (oak-24), gdzie podróżni zostawiają nasiona przed wyprawą.",
      discoveryRequirement: "Dotrzyj pieszo w pobliże dębu oak-24 na północy Verdantii.",
      reward: { xp: 60, coins: 25, itemId: "potion" },
    },
    {
      id: "hidden-verdant-2",
      continent: "verdant",
      name: "Opuszczony Obóz Mierniczych",
      category: "camp",
      mapAnchorId: "rock-250",
      coordinates: { x: 975, y: 1255 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description: "Pozostałości namiotu i tuby kreślarskiej ukryte za głazem rock-250.",
      discoveryRequirement: "Zbadaj okolicę głazu rock-250 między Rynkiem a Kuźnią.",
      reward: { xp: 70, coins: 30, itemId: "tusk" },
    },
    {
      id: "hidden-verdant-3",
      continent: "verdant",
      name: "Starożytny Ołtarz Mchu i Rosy",
      category: "altar",
      mapAnchorId: "rock-261",
      coordinates: { x: 373, y: 1617 },
      radius: 95,
      implementationStatus: "active_in_engine",
      description:
        "Kamienny krąg na południowym zachodzie (rock-261), który pulsuje słabym zielonym światłem.",
      discoveryRequirement: "Odwiedź południowo-zachodni narożnik mapy (rock-261).",
      reward: { xp: 95, coins: 40, itemId: "potion" },
    },
    {
      id: "hidden-verdant-4",
      continent: "verdant",
      name: "Ślady Zaginionej Wyprawy Botaników",
      category: "lost_expedition",
      mapAnchorId: "rock-264",
      coordinates: { x: 2732, y: 1798 },
      radius: 100,
      implementationStatus: "active_in_engine",
      description:
        "Porzucony dziennik zielarski i zielone ostrze wbite w szczelinę skały rock-264.",
      discoveryRequirement: "Dotrzyj do południowo-wschodniego głazu rock-264.",
      reward: { xp: 130, coins: 55, itemId: "sword" },
    },
    {
      id: "hidden-verdant-5",
      continent: "verdant",
      name: "Podziemny Kanał Przelewowy pod Rozdzielnią",
      category: "passage",
      mapAnchorId: "fountain-5",
      coordinates: { x: 1340, y: 750 },
      radius: 85,
      implementationStatus: "data_only_pending_engine",
      description:
        "Właz prowadzący do podziemnych korytarzy łączących Verdantię z dawną siecią retencyjną (oczekuje na wsparcie instancji podziemnych w runtime).",
      discoveryRequirement: "Oczekuje na wdrożenie warstwy podziemi w silniku.",
      reward: { xp: 150, coins: 60 },
    },
  ],
  worldEvents: [
    {
      id: "event-verdant-trail-wolves",
      continent: "verdant",
      name: "Zasadzka Watahy Cierniowych Wilków",
      category: "trail_encounter",
      implementationStatus: "active_in_engine",
      activationCondition: { minLevel: 2, coordinates: { x: 1860, y: 1020 }, radius: 130 },
      repeatability: "cooldown_300s",
      description:
        "Na Trakcie Trzech Mostów wataha Cierniowych Wilków próbuje odciąć drogę tragarzom z przystani.",
      monsterId: "verdant-cierniowy-wilk",
      reward: { xp: 55, coins: 25, itemId: "tusk" },
    },
    {
      id: "event-verdant-missing-courier",
      continent: "verdant",
      name: "Poszukiwania Zaginionego Posłańca Neli",
      category: "missing_traveler",
      implementationStatus: "active_in_engine",
      activationCondition: { minLevel: 4, coordinates: { x: 746, y: 664 }, radius: 120 },
      repeatability: "once",
      description:
        "Młody pomocnik Neli utknął na drzewie po ataku Leśnego Pająka na drodze do Zatopionej Doliny.",
      monsterId: "verdant-lesny-pajak",
      reward: { xp: 90, coins: 40, itemId: "potion" },
    },
    {
      id: "event-verdant-spore-hazard",
      continent: "verdant",
      name: "Zagrożenie Obszarowe: Wykwit Grzybowych Zarodników",
      category: "area_hazard",
      implementationStatus: "active_in_engine",
      activationCondition: { minLevel: 6, coordinates: { x: 1480, y: 520 }, radius: 130 },
      repeatability: "cooldown_300s",
      description:
        "Gęsta chmura toksycznych zarodników blokuje północną ścieżkę do Latarni Korzeni.",
      monsterId: "verdant-grzybowy-zarodnik",
      reward: { xp: 110, coins: 45, itemId: "potion" },
    },
    {
      id: "event-verdant-contract-d01",
      continent: "verdant",
      name: "Zlecenie Odnawialne D01: Patrol Oznaczeń Szlaku",
      category: "renewable_contract",
      implementationStatus: "active_in_engine",
      activationCondition: {
        minLevel: 4,
        requiredQuestId: "O-V06",
        coordinates: { x: 2070, y: 1040 },
        radius: 120,
      },
      repeatability: "renewable_contract",
      description:
        "Odnawialny kontrakt Ligi Szlaków: oczyść wschodni trakt i odnów zatarte znaki drogowe.",
      monsterId: "verdant-lisciak-skrytobojca",
      reward: { xp: 80, coins: 35 },
    },
    {
      id: "event-verdant-convoy-pending",
      continent: "verdant",
      name: "Konwój Kupiecki Drewna Żywicznego (Dane oczekujące)",
      category: "merchant_convoy",
      implementationStatus: "data_only_pending_engine",
      activationCondition: { minLevel: 8, coordinates: { x: 1480, y: 1000 }, radius: 100 },
      repeatability: "cooldown_300s",
      description:
        "Dynamiczny ruchomy konwój wozów między Kamiennym Sadem a Przystanią Trzech Mostów (wydzielony jako dane nieaktywne do czasu obsługi ruchomych karawan w silniku).",
      reward: { xp: 120, coins: 50 },
    },
  ],
};
