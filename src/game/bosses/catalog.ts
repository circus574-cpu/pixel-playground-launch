import { BossDefinition } from "./types";

export const BOSS_CATALOG: BossDefinition[] = [
  // ==========================================
  // KONTYNENT VERDANT (PLANETARNI)
  // ==========================================
  {
    id: "ygdrasha",
    name: "Ygdrasha, Matka Puszczy",
    title: "Starożytna Władczyni Puszczy",
    continent: "verdant",
    race: "Planetarni",
    level: 15,
    icon: "plant",
    variant: 3,
    speed: 0,
    range: 450,
    agro: 600,
    stats: {
      hp: 4520,
      atk: 59,
      def: 37,
      xp: 541,
    },
    mult: {
      hp: 8,
      atk: 1.4,
      def: 1.5,
    },
    behavior:
      "Stacjonarna. Faza 1 (100–60% HP): bicze korzeni i trucizna. Faza 2 (60–30%): co 15 s przyzywa 2 Mchowe Szlamaki. Faza 3 (poniżej 30%): +30% obrażeń, kwiat się otwiera i przyjmuje +25% obrażeń. Regeneruje 1% HP/s w fazach 1–2.",
    weakness: "Ogień i KI; odsłonięta w fazie 3 (+25% obrażeń)",
    lore: "Prastary żywy organizm puszczy, którego korzenie przenikają cały zielony kontynent. Ygdrasha nie walczy z nienawiści — broni pradawnego rytmu rzeki przed mechanicznym zanieczyszczeniem i ludzkim wyzyskiem. Jej kielich rozkwita tylko w obliczu śmiertelnego zagrożenia, uwalniając zarodniki pamięci sprzed tysiąca lat.",
    locationName: "Gaj Pradawnych Korzeni (Głęboka Knieja Verdantii)",
    associatedLocationId: "famous-verdant-4",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Uśpiony Korzeń",
        description:
          "Ygdrasha smaga intruzów potężnymi biczami korzeni i rozpyla trujące opary. Regeneruje 1% HP na sekundę.",
        statModifiers: {
          damageTakenMultiplier: 1.0,
        },
        unlockedAttacks: ["ygdrasha-bicz", "ygdrasha-burza"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 60,
        name: "Przebudzenie Splotu",
        description:
          "Ziemia wokół pnia pęka. Co 15 sekund z korzeni wyłaniają się 2 Mchowe Szlamaki ochraniające rdzeń.",
        statModifiers: {
          damageTakenMultiplier: 1.0,
        },
        unlockedAttacks: ["ygdrasha-bicz", "ygdrasha-burza", "ygdrasha-szlamaki"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 30,
        name: "Rozkwit Gniewu",
        description:
          "Kwiat Ygdrashy otwiera się, wpadając w szał (+30% siły ataku, uderzenia pyłowe). Odsłonięty kielich przyjmuje jednak +25% obrażeń, a regeneracja zostaje zatrzymana.",
        statModifiers: {
          atkMultiplier: 1.3,
          damageTakenMultiplier: 1.25,
        },
        unlockedAttacks: ["ygdrasha-bicz", "ygdrasha-burza", "ygdrasha-rozkwit"],
      },
    ],
    attacks: [
      {
        id: "ygdrasha-bicz",
        name: "Bicz Korzeni",
        cooldownSeconds: 8,
        telegraphSeconds: 1.2,
        description: "Masywny podziemny pęd uderza z wielką siłą w kierunku gracza.",
        damageMultiplier: 1.4,
        isAoe: false,
      },
      {
        id: "ygdrasha-burza",
        name: "Zarodnikowa Burza",
        cooldownSeconds: 20,
        telegraphSeconds: 1.8,
        description:
          "Chmura toksycznych zarodników pokrywająca obszar w promieniu 250 jednostek, zadająca obrażenia z czasem.",
        damageMultiplier: 1.0,
        isAoe: true,
      },
      {
        id: "ygdrasha-szlamaki",
        name: "Przyzwanie Szlamaków",
        cooldownSeconds: 15,
        telegraphSeconds: 1.0,
        description: "Z żywicznych pąków wykluwają się dwa Mchowe Szlamaki spowalniające gracza.",
        damageMultiplier: 0.5,
        isAoe: false,
      },
      {
        id: "ygdrasha-rozkwit",
        name: "Eksplozja Pyłowa",
        cooldownSeconds: 12,
        telegraphSeconds: 1.5,
        description:
          "Gwałtowny wyrzut stężonej energii fotosyntetycznej i pyłków o krytycznej sile rażenia.",
        damageMultiplier: 1.8,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "serce-puszczy",
        itemName: "Serce Puszczy",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "zielona-esencja",
        itemName: "Zielona Esencja",
        chancePercent: 100,
        minCount: 2,
        maxCount: 4,
      },
      {
        itemId: "kwiat-ygdrashy",
        itemName: "Kwiat Ygdrashy",
        chancePercent: 25,
        minCount: 1,
        maxCount: 1,
        isRare: true,
      },
    ],
  },
  {
    id: "thorgar",
    name: "Thorgar, Alfa Kłów",
    title: "Władca Ciernistego Stada",
    continent: "verdant",
    race: "Planetarni",
    level: 20,
    icon: "beast",
    variant: 3,
    speed: 1.2,
    range: 100,
    agro: 500,
    stats: {
      hp: 7560,
      atk: 88,
      def: 45,
      xp: 795,
    },
    mult: {
      hp: 9,
      atk: 1.6,
      def: 1.4,
    },
    behavior:
      "Faza 1: pojedynek, szarże i cięcia. Faza 2 (poniżej 65% HP): wzywa 3 Cierniowe Wilki. Faza 3 (poniżej 30%): berserk, +25% szybkości; Wycie rozprasza gracza.",
    weakness: "Ogłuszony na 1,5 s po chybionej szarży w przeszkodę terenową",
    lore: "Ogromny prabestia z rodu pierwotnych wilków, który przeżył wieki dzięki adaptacji ciernistych narośli na kościach. Thorgar przewodzi najgroźniejszej sforze leśnej, a jego kły są w stanie przeciąć hartowaną stal. Szanowany przez tropicieli Verdantii jako wcielenie nieokiełznanej siły natury.",
    locationName: "Jaskinia Pradawnych Kłów (Północne Wzgórza Verdantii)",
    associatedLocationId: "famous-verdant-3",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Próba Przeżycia",
        description:
          "Thorgar krąży wokół ofiary, wyprowadzając gwałtowne serie cięć i proste szarże.",
        statModifiers: {
          speedMultiplier: 1.0,
        },
        unlockedAttacks: ["thorgar-szarza", "thorgar-rozdarcie"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 65,
        name: "Zew Sfory",
        description: "Potężne wycie przyzywa do walki 3 Cierniowe Wilki oskrzydlające gracza.",
        statModifiers: {
          speedMultiplier: 1.1,
        },
        unlockedAttacks: ["thorgar-szarza", "thorgar-rozdarcie", "thorgar-wycie"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 30,
        name: "Szał Ciernistego Alfy",
        description:
          "Thorgar wpada w niekontrolowany szał (+25% prędkości ruchu i ataku). Każde chybienie może jednak kosztować go utratę równowagi.",
        statModifiers: {
          atkMultiplier: 1.2,
          speedMultiplier: 1.25,
        },
        unlockedAttacks: ["thorgar-szarza", "thorgar-rozdarcie", "thorgar-wycie"],
      },
    ],
    attacks: [
      {
        id: "thorgar-szarza",
        name: "Szarża Alfy",
        cooldownSeconds: 10,
        telegraphSeconds: 1.4,
        description:
          "Błyskawiczny bieg po linii prostej tratujący wszystko na drodze. Jeśli trafi w skałę, Alfa zostaje ogłuszony na 1,5 sekundy.",
        damageMultiplier: 1.6,
        isAoe: false,
      },
      {
        id: "thorgar-rozdarcie",
        name: "Cierniste Rozdarcie",
        cooldownSeconds: 6,
        telegraphSeconds: 0.8,
        description: "Głębokie cięcie potężnymi szponami wywołujące krwawienie przez 5 sekund.",
        damageMultiplier: 1.2,
        isAoe: false,
      },
      {
        id: "thorgar-wycie",
        name: "Wycie Grozy",
        cooldownSeconds: 25,
        telegraphSeconds: 1.5,
        description: "Paraliżujący ryk rozpraszający obronę wroga i wzywający leśne wilki.",
        damageMultiplier: 0.6,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "kiel-alfy",
        itemName: "Kieł Alfy",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "skora-thorgara",
        itemName: "Skóra Thorgara",
        chancePercent: 100,
        minCount: 1,
        maxCount: 2,
      },
      {
        itemId: "pazury-alfy",
        itemName: "Pazury Alfy",
        chancePercent: 25,
        minCount: 1,
        maxCount: 1,
        isRare: true,
      },
    ],
  },

  // ==========================================
  // KONTYNENT AETHER (MĘDRCY)
  // ==========================================
  {
    id: "arcykaplan-pustki",
    name: "Arcykapłan Pustki",
    title: "Kustosz Zgasłej Gwiazdy",
    continent: "aether",
    race: "Mędrcy",
    level: 15,
    icon: "humanoid",
    variant: 2,
    speed: 0.8,
    range: 400,
    agro: 600,
    stats: {
      hp: 4520,
      atk: 59,
      def: 29,
      xp: 541,
    },
    mult: {
      hp: 8,
      atk: 1.4,
      def: 1.2,
    },
    behavior:
      "Faza 1: pieczęcie na ziemi (strefy obrażeń 5 s). Faza 2 (poniżej 60% HP): bariera −70% obrażeń; trzeba zniszczyć 3 Świetliki. Faza 3 (poniżej 25%): Zamknięcie areny i kurczące się strefy.",
    weakness: "Przerwanie rzucania czarów (stagger) ogłusza go na 2 s",
    lore: "Niegdyś najjaśniejszy uczony Akademii Obserwacji, który w poszukiwaniu absolutnej harmonii spojrzał w szczelinę Pustki poza sferą KI. Odrzucił cielesność i zamienił swoje szaty w naczynie próżni. Wierzy, że unicestwienie materii jest jedynym sposobem na zakończenie cierpienia świata.",
    locationName: "Zapomniane Sanktuarium Nicości (Podziemia Aetherii)",
    associatedLocationId: "famous-aether-1",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Rytuał Zgaszenia",
        description:
          "Arcykapłan wyznacza na podłożu mroczne pieczęcie eteru wypalające siły witalne przez 5 sekund.",
        statModifiers: {
          damageTakenMultiplier: 1.0,
        },
        unlockedAttacks: ["arcykaplan-pieczec"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 60,
        name: "Bariera Trzech Świetlików",
        description:
          "Boss wznosi sferę ochronną absorbującą 70% wszelkich obrażeń. Aby ją zdjąć, gracz musi rozbić 3 Świetliki Pieczęci orbitujące wokół ołtarza.",
        statModifiers: {
          damageTakenMultiplier: 0.3,
        },
        unlockedAttacks: ["arcykaplan-pieczec", "arcykaplan-bariera"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 25,
        name: "Zapadlisko Nicości",
        description:
          "Bariery znikają, a zewnętrzny obwód areny zapada się w nicość. Przestrzeń kurczy się z każdą sekundą.",
        statModifiers: {
          atkMultiplier: 1.25,
          damageTakenMultiplier: 1.0,
        },
        unlockedAttacks: ["arcykaplan-pieczec", "arcykaplan-zamkniecie"],
      },
    ],
    attacks: [
      {
        id: "arcykaplan-pieczec",
        name: "Pieczęć Pustki",
        cooldownSeconds: 8,
        telegraphSeconds: 1.0,
        description:
          "Tworzy pod graczem pulsujący krąg czarnego światła zadający periodyczne obrażenia.",
        damageMultiplier: 1.3,
        isAoe: true,
      },
      {
        id: "arcykaplan-bariera",
        name: "Bariera Odwrócenia KI",
        cooldownSeconds: 30,
        telegraphSeconds: 1.5,
        description: "Pochłania 70% obrażeń i odbija część impulsów jako pociski eteryczne.",
        damageMultiplier: 0.8,
        isAoe: false,
      },
      {
        id: "arcykaplan-zamkniecie",
        name: "Zamknięcie Areny",
        cooldownSeconds: 20,
        telegraphSeconds: 2.0,
        description:
          "Potężna implozja wymiarowa spychająca gracza w stronę centrum i zadająca obrażenia strefowe.",
        damageMultiplier: 1.7,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "szaty-arcykaplana",
        itemName: "Szaty Arcykapłana",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "eter-pustki",
        itemName: "Eter Pustki",
        chancePercent: 100,
        minCount: 2,
        maxCount: 4,
      },
      {
        itemId: "pieczec-arcykaplana",
        itemName: "Pieczęć Arcykapłana",
        chancePercent: 25,
        minCount: 1,
        maxCount: 1,
        isRare: true,
      },
    ],
  },
  {
    id: "aurelith",
    name: "Aurelith, Smok Sanktuarium",
    title: "Żywa Pieczęć Archontów",
    continent: "aether",
    race: "Mędrcy",
    level: 20,
    icon: "serpent",
    variant: 1,
    speed: 0.9,
    range: 450,
    agro: 600,
    stats: {
      hp: 8400,
      atk: 88,
      def: 51,
      xp: 870,
    },
    mult: {
      hp: 10,
      atk: 1.6,
      def: 1.6,
    },
    behavior:
      "Faza 1: fale światła i uderzenie ogonem. Faza 2 (poniżej 66% HP): lot i fale obszarowe. Faza 3 (poniżej 33%): Oddech eteru, kanał 4 s (osłona za filarami).",
    weakness: "Po zakończeniu Oddechu Eteru smok ląduje i jest bezbronny przez 3 s (+50% obrażeń)",
    lore: "Istota czystego eteru skrystalizowana w ciele smoka wężowego o alabastrowych łuskach. Aurelith od zarania dziejów strzeże Wielkiego Ołtarza Eteru na szczycie lewitujących wysp. Jego obecność stabilizuje przepływ lewitacji w całym Aetherze — pokonanie go wymaga czystego umysłu i nienagannej dyscypliny w unikaniu jego fal.",
    locationName: "Wielki Ołtarz Eteru (Zawieszona Iglica)",
    associatedLocationId: "famous-aether-4",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Blask Archontów",
        description:
          "Aurelith stąpa majestatycznie po marmurowych płytach, emitując fale światła i zamiatając ogonem.",
        statModifiers: {
          speedMultiplier: 1.0,
        },
        unlockedAttacks: ["aurelith-fala", "aurelith-ogon"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 66,
        name: "Lewitujący Sąd",
        description:
          "Smok unosi się ponad zasięg broni białej, bombardując platformę kaskadami eterycznych komet.",
        statModifiers: {
          speedMultiplier: 1.15,
        },
        unlockedAttacks: ["aurelith-fala", "aurelith-ogon"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 33,
        name: "Pierwotny Oddech Eteru",
        description:
          "Aurelith kumuluje energię przez 4 sekundy, wypalając arenę promienistą strugą. Ukrycie się za kamiennymi filarami jest jedyną ochroną.",
        statModifiers: {
          atkMultiplier: 1.3,
        },
        unlockedAttacks: ["aurelith-fala", "aurelith-ogon", "aurelith-oddech"],
      },
    ],
    attacks: [
      {
        id: "aurelith-fala",
        name: "Fala Światła",
        cooldownSeconds: 8,
        telegraphSeconds: 1.2,
        description: "Koncentryczna fala promienistej energii rozchodząca się po całej arenie.",
        damageMultiplier: 1.3,
        isAoe: true,
      },
      {
        id: "aurelith-ogon",
        name: "Uderzenie Ogonem Sanktuarium",
        cooldownSeconds: 6,
        telegraphSeconds: 0.9,
        description: "Gwałtowny zamach ciężkiego, łuskowatego ogona odrzucający przeciwnika w tył.",
        damageMultiplier: 1.2,
        isAoe: false,
      },
      {
        id: "aurelith-oddech",
        name: "Oddech Eteru",
        cooldownSeconds: 25,
        telegraphSeconds: 2.5,
        description:
          "Ciągły 4-sekundowy strumień czystego eteru niszczący wszystko na swej drodze.",
        damageMultiplier: 2.4,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "luska-aurelitha",
        itemName: "Łuska Aurelitha",
        chancePercent: 100,
        minCount: 2,
        maxCount: 4,
      },
      {
        itemId: "serce-sanktuarium",
        itemName: "Serce Sanktuarium",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
    ],
  },

  // ==========================================
  // KONTYNENT NEXUS (ANDROIDY)
  // ==========================================
  {
    id: "arbiter-zero",
    name: "Arbiter Zero",
    title: "Pierwotny Protokół Porządku",
    continent: "nexus",
    race: "Androidy",
    level: 15,
    icon: "golem",
    variant: 1,
    speed: 0.7,
    range: 400,
    agro: 600,
    stats: {
      hp: 4520,
      atk: 64,
      def: 42,
      xp: 546,
    },
    mult: {
      hp: 8,
      atk: 1.5,
      def: 1.7,
    },
    behavior:
      "Faza 1: pociski i tarcza. Faza 2 (poniżej 60% HP): przeciążenie, kula energii i 2 drony. Faza 3 (poniżej 25%): przegrzanie — brak tarczy i +40% otrzymywanych obrażeń przez 10 s co 30 s.",
    weakness: "Obrażenia elektryczne i ciosy w okienku przegrzania reaktora (+40% obrażeń)",
    lore: "Prototyp ciężkiego mecha obronnego wyprodukowany w pierwszych dekadach rozbudowy Nexusa. Po utracie łączności z głównym serwerem logicznym zinterpretował każde żywe stworzenie jako błąd syntaktyczny w architekturze świata. Jego potężny stop tytanowo-kobaltowy odbija większość konwencjonalnych ataków.",
    locationName: "Sektor Egzekutorów (Przemysłowy Rdzeń Nexus-0)",
    associatedLocationId: "famous-nexus-1",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Procedura Diagnostyczna",
        description:
          "Arbiter prowadzi ogień z działka obrotowego pod osłoną kompozytowej tarczy barierowej.",
        statModifiers: {
          damageTakenMultiplier: 0.85,
        },
        unlockedAttacks: ["arbiter-salwa", "arbiter-tarcza"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 60,
        name: "Przeciążenie Sieci",
        description:
          "Reaktor zaczyna wchodzić w stan niestabilności, wystrzeliwując kule plazmy i przywołując 2 Drony Asystujące.",
        statModifiers: {
          atkMultiplier: 1.15,
        },
        unlockedAttacks: ["arbiter-salwa", "arbiter-tarcza", "arbiter-przeciazenie"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 25,
        name: "Termiczny Wyrzut Awaryjny",
        description:
          "Tarcze padają na stałe. Co 30 sekund reaktor otwiera komory chłodzące na 10 sekund — w tym czasie Arbiter przyjmuje +40% obrażeń.",
        statModifiers: {
          atkMultiplier: 1.3,
          damageTakenMultiplier: 1.4,
        },
        unlockedAttacks: ["arbiter-salwa", "arbiter-przeciazenie"],
      },
    ],
    attacks: [
      {
        id: "arbiter-salwa",
        name: "Salwa Egzekutora",
        cooldownSeconds: 7,
        telegraphSeconds: 1.0,
        description: "Seria trzech kinetycznych pocisków smugowych o wysokiej prędkości wylotowej.",
        damageMultiplier: 1.3,
        isAoe: false,
      },
      {
        id: "arbiter-tarcza",
        name: "Tarcza Polaryzacyjna",
        cooldownSeconds: 20,
        telegraphSeconds: 0.8,
        description: "Włącza pole ochronne pochłaniające nadchodzące ataki dystansowe.",
        damageMultiplier: 0.5,
        isAoe: false,
      },
      {
        id: "arbiter-przeciazenie",
        name: "Kula Przeciążenia",
        cooldownSeconds: 18,
        telegraphSeconds: 1.8,
        description: "Koncentruje energię w ogromną kulę plazmy o wielkim promieniu rażenia.",
        damageMultiplier: 1.7,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "kod-arbitra",
        itemName: "Kod Arbitra",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "plyta-egzekutora",
        itemName: "Płyta Egzekutora",
        chancePercent: 100,
        minCount: 1,
        maxCount: 2,
      },
    ],
  },
  {
    id: "hydra-rdzen",
    name: "Hydra-Rdzeń",
    title: "Wielogłowy Klaster Przeliczeniowy",
    continent: "nexus",
    race: "Androidy",
    level: 20,
    icon: "serpent",
    variant: 0,
    speed: 0,
    range: 400,
    agro: 600,
    stats: {
      hp: 8400,
      atk: 88,
      def: 48,
      xp: 870,
    },
    mult: {
      hp: 10,
      atk: 1.6,
      def: 1.5,
    },
    behavior:
      "Trzy segmenty-głowy atakują różnie (plazma, wiązka, uderzenie). Faza 1: 3 głowy. Faza 2 (poniżej 66% HP): 2 głowy i przyzwanie nanitów. Faza 3 (poniżej 33%): rdzeń odsłonięty, szybsze ataki.",
    weakness: "Odsłonięty centralny rdzeń w fazie 3 przyjmuje +50% obrażeń",
    lore: "Samoreplikujący się superkomputer umieszczony w sercu opuszczonego reaktora podziemnego Nexusa. Posiada trzy mechaniczne segmenty wężowe przypominające głowy mitycznej hydry, sterowane równoległymi wątkami logicznymi. Kontroluje zapomniane fabryki zbrojeniowe i dąży do bezwzględnej optymalizacji planety.",
    locationName: "Podziemna Krypta Rdzenia (Sektor Głęboki)",
    associatedLocationId: "famous-nexus-4",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Trójwątkowość Bojowa",
        description:
          "Wszystkie trzy segmenty atakują jednocześnie: plazmą dalekosiężną, laserową wiązką tnącą oraz uderzeniami miażdżącymi.",
        statModifiers: {
          speedMultiplier: 1.0,
        },
        unlockedAttacks: ["hydra-plazma", "hydra-wiazka", "hydra-uderzenie"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 66,
        name: "Wstrzyknięcie Nanitów",
        description:
          "Jedna z głowic ulega zniszczeniu, a Hydra wypuszcza chmurę nanitów naprawczych i zwiększa częstotliwość wystrzałów.",
        statModifiers: {
          atkMultiplier: 1.15,
        },
        unlockedAttacks: ["hydra-plazma", "hydra-wiazka", "hydra-nanity"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 33,
        name: "Odsłonięcie Macierzy Prime",
        description:
          "Wszystkie segmenty pękają, odsłaniając pulsujący kryształ obliczeniowy. Rdzeń przyjmuje +50% obrażeń, lecz wystrzeliwuje chaotyczne wiązki we wszystkich kierunkach.",
        statModifiers: {
          atkMultiplier: 1.35,
          damageTakenMultiplier: 1.5,
        },
        unlockedAttacks: ["hydra-plazma", "hydra-wiazka", "hydra-uderzenie"],
      },
    ],
    attacks: [
      {
        id: "hydra-plazma",
        name: "Salwa Plazmowa Głowicy Alfa",
        cooldownSeconds: 6,
        telegraphSeconds: 1.0,
        description: "Wystrzał kuli plazmowej pozostawiającej palącą plamę energii na podłodze.",
        damageMultiplier: 1.2,
        isAoe: false,
      },
      {
        id: "hydra-wiazka",
        name: "Tnąca Wiązka Beta",
        cooldownSeconds: 8,
        telegraphSeconds: 1.4,
        description: "Wysokoenergetyczny laser przecinający szeroki łuk areny.",
        damageMultiplier: 1.6,
        isAoe: true,
      },
      {
        id: "hydra-uderzenie",
        name: "Miażdżące Uderzenie Gamma",
        cooldownSeconds: 5,
        telegraphSeconds: 0.8,
        description: "Ciężki segment taranuje ziemię w miejscu gracza, powodując falę uderzeniową.",
        damageMultiplier: 1.1,
        isAoe: false,
      },
      {
        id: "hydra-nanity",
        name: "Chmura Nanitów",
        cooldownSeconds: 20,
        telegraphSeconds: 1.5,
        description:
          "Przywołuje rój mikroskopijnych dronów spowalniających ruch i regenerujących pancerz bossa.",
        damageMultiplier: 0.7,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "rdzen-hydry",
        itemName: "Rdzeń Hydry",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "modul-prime",
        itemName: "Moduł Prime",
        chancePercent: 100,
        minCount: 1,
        maxCount: 2,
      },
    ],
  },

  // ==========================================
  // KONTYNENT PYRA (LEGENDY)
  // ==========================================
  {
    id: "kharzul",
    name: "Kharzul, Mistrz Areny",
    title: "Niezwyciężony Czempion Krateru",
    continent: "pyra",
    race: "Legendy",
    level: 15,
    icon: "humanoid",
    variant: 3,
    speed: 1.1,
    range: 100,
    agro: 600,
    stats: {
      hp: 4520,
      atk: 68,
      def: 34,
      xp: 552,
    },
    mult: {
      hp: 8,
      atk: 1.6,
      def: 1.4,
    },
    behavior:
      "Faza 1: kombinacje 3 ciosów. Faza 2 (poniżej 60% HP): Płomienny szał, +25% szybkości. Faza 3 (poniżej 25%): arena płonie (strefy obrażeń), wyłączone leczenie.",
    weakness: "Po wykonaniu Przełamania traci równowagę i jest odsłonięty przez 2 s",
    lore: "Najsłynniejszy gladiator w historii Krateru Pyry, który stoczył setki pojedynków i nigdy nie opuścił areny pokonany. Jego ciężki pancerz z wulkanicznego obsydianu stopił się z ciałem pod wpływem żaru. Uważa walkę za jedyną prawdziwą formę modlitwy do bóstw ognia i nie zna litości dla słabych.",
    locationName: "Wielka Arena Popiołów (Cytadela Ognia)",
    associatedLocationId: "famous-pyra-1",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Rytuał Gladiatora",
        description:
          "Kharzul testuje kunszt przeciwnika w zwarciu za pomocą dynamicznych kombinacji trzech cięć.",
        statModifiers: {
          speedMultiplier: 1.0,
        },
        unlockedAttacks: ["kharzul-ciecie"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 60,
        name: "Płomienny Szał Areny",
        description:
          "Mistrz podpala swój oręż w koksowniku; jego prędkość ruchu i częstotliwość ataków rośnie o 25%.",
        statModifiers: {
          atkMultiplier: 1.2,
          speedMultiplier: 1.25,
        },
        unlockedAttacks: ["kharzul-ciecie", "kharzul-przelamanie", "kharzul-szal"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 25,
        name: "Piekielny Krąg Śmierci",
        description:
          "Cała podłoga areny staje w płomieniach. Wyjątkowy żar wyłącza możliwość używania mikstur leczących — walka na śmierć i życie.",
        statModifiers: {
          atkMultiplier: 1.35,
          speedMultiplier: 1.3,
        },
        unlockedAttacks: ["kharzul-ciecie", "kharzul-przelamanie"],
      },
    ],
    attacks: [
      {
        id: "kharzul-ciecie",
        name: "Ogniste Cięcie",
        cooldownSeconds: 6,
        telegraphSeconds: 0.8,
        description: "Cięcie wielkim mieczem zostawiające smugę ognia na dystansie kilku kroków.",
        damageMultiplier: 1.3,
        isAoe: false,
      },
      {
        id: "kharzul-przelamanie",
        name: "Przełamanie Pancerza",
        cooldownSeconds: 12,
        telegraphSeconds: 1.6,
        description:
          "Potężne uderzenie z góry rozłupujące tarczę i blok obronny. Po chybieniu odsłania Kharzula na 2 sekundy.",
        damageMultiplier: 1.8,
        isAoe: false,
      },
      {
        id: "kharzul-szal",
        name: "Płomienny Szał",
        cooldownSeconds: 30,
        telegraphSeconds: 1.2,
        description: "Bojowy ryk rozpalający wewnętrzny płomień, zapewniający premię do szybkości.",
        damageMultiplier: 0.5,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "pancerz-kharzula",
        itemName: "Pancerz Kharzula",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "plomien-areny",
        itemName: "Płomień Areny",
        chancePercent: 100,
        minCount: 2,
        maxCount: 3,
      },
    ],
  },
  {
    id: "pyrrhax",
    name: "Pyrrhax, Smok Wulkanu",
    title: "Władca Płonącej Otchłani",
    continent: "pyra",
    race: "Legendy",
    level: 20,
    icon: "serpent",
    variant: 3,
    speed: 0.6,
    range: 450,
    agro: 600,
    stats: {
      hp: 8400,
      atk: 94,
      def: 51,
      xp: 878,
    },
    mult: {
      hp: 10,
      atk: 1.7,
      def: 1.6,
    },
    behavior:
      "Faza 1: ogon i fale żaru. Faza 2 (poniżej 66% HP): lot i deszcz lawy. Faza 3 (poniżej 33%): erupcja — bezpieczne strefy wskazane na ziemi.",
    weakness: "Przy lądowaniu po locie odsłania brzuch (+30% obrażeń przez 3 s)",
    lore: "Prastary tytaniczny gad spoczywający w komorze magmowej pod kalderą Najwyższego Szczytu Pyry. Zbudzony przez wybuchy kopalń i drążenie tuneli przez poszukiwaczy obsydianu. Gdy rozpościera swe skrzydła ze skrzepniętej bazaltowej lawy, niebo nad kontynentem staje się krwistoczerwone.",
    locationName: "Gardziel Wulkanu (Krater Główny Pyry)",
    associatedLocationId: "famous-pyra-4",
    phases: [
      {
        phaseNumber: 1,
        hpThresholdPercent: 100,
        name: "Gniew Kalderowy",
        description:
          "Smok przemieszcza się po brzegu jeziora lawy, smagając ogonem i wyrzucając fale żaru.",
        statModifiers: {
          speedMultiplier: 1.0,
        },
        unlockedAttacks: ["pyrrhax-fala"],
      },
      {
        phaseNumber: 2,
        hpThresholdPercent: 66,
        name: "Ogniste Skrzydła Zagłady",
        description:
          "Pyrrhax wznosi się w powietrze ponad arenę, sprowadzając na walczących nieustanny deszcz odłamków lawy.",
        statModifiers: {
          speedMultiplier: 1.2,
        },
        unlockedAttacks: ["pyrrhax-fala", "pyrrhax-deszcz"],
      },
      {
        phaseNumber: 3,
        hpThresholdPercent: 33,
        name: "Katastrofalna Erupcja",
        description:
          "Smok ląduje z impetem w centrum krateru i inicjuje erupcję całego podłoża. Jedynie wskazane kamienne platformy są bezpieczne.",
        statModifiers: {
          atkMultiplier: 1.35,
        },
        unlockedAttacks: ["pyrrhax-fala", "pyrrhax-deszcz", "pyrrhax-erupcja"],
      },
    ],
    attacks: [
      {
        id: "pyrrhax-fala",
        name: "Fala Żaru",
        cooldownSeconds: 7,
        telegraphSeconds: 1.2,
        description: "Rozległy podmuch gorącego gazu i popiołu w stożku przed paszczą smoka.",
        damageMultiplier: 1.4,
        isAoe: true,
      },
      {
        id: "pyrrhax-deszcz",
        name: "Deszcz Lawy",
        cooldownSeconds: 15,
        telegraphSeconds: 2.0,
        description: "Bombardowanie areny płynną magmą spadającą z góry w oznaczonych punktach.",
        damageMultiplier: 1.7,
        isAoe: true,
      },
      {
        id: "pyrrhax-erupcja",
        name: "Wulkaniczna Erupcja",
        cooldownSeconds: 30,
        telegraphSeconds: 3.0,
        description:
          "Przelanie się magmy przez całą arenę. Po lądowaniu smok odsłania brzuch na 3 sekundy (+30% obrażeń).",
        damageMultiplier: 2.5,
        isAoe: true,
      },
    ],
    lootTable: [
      {
        itemId: "serce-wulkanu",
        itemName: "Serce Wulkanu",
        chancePercent: 100,
        minCount: 1,
        maxCount: 1,
      },
      {
        itemId: "luska-pyrrhaxa",
        itemName: "Łuska Pyrrhaxa",
        chancePercent: 100,
        minCount: 2,
        maxCount: 4,
      },
    ],
  },
];
