import { ContinentDialogueCatalog } from "./types";

export const PYRA_DIALOGUES: ContinentDialogueCatalog = {
  continent: "pyra",
  dialogues: {
    "npc-kaena": {
      npcId: "npc-kaena",
      npcName: "Kaena",
      cityId: "pyra-twierdza-popiolu",
      role: "Strażniczka Twierdzy Popiołu",
      greetings: [
        "Witaj w Twierdzy Popiołu. Tutaj hartuje się stal i męstwo, a słabość spala się w płomieniach.",
        "Ogień Pyry nie pyta o pochodzenie, lecz o siłę woli. Wykaż się czynem, a zyskasz szacunek Legend.",
        "Popiół i krew to fundamenty tej twierdzy. Stań prosto przed wodzem i mów, z czym przychodzisz.",
      ],
      rumors: [
        "Na zachodzie wznosi się Cytadela Pierwszego Płomienia. Mówią, że wieczny ogień w jej sercu zapalili sami pradawni tytani.",
        "Kaplica Krwi i Popiołu kryje ołtarze, na których dawni berserkerzy składali przysięgi przed wielkimi wyprawami wojennymi.",
        "Wulkaniczny Kolos na południowym krańcu kontynentu spogląda w stronę oceanu — legenda głosi, że ożyje, gdy zatrzęsie się cała planeta.",
      ],
      quests: {
        "O-P01": {
          questId: "O-P01",
          before:
            "Jeśli chcesz dowieść swej wartości wśród wojowników Pyry, musisz wyjść poza mury twierdzy i okiełznać wściekłe węgiełki oraz salamandry.",
          during:
            "Zejdź na bazaltowe tarasy i ugaś furię ognistych bestii. Pokaż, że twój duch nie ugina się przed żarem.",
          after:
            "Dobra robota. Twoje ostrze nie zadrżało w ogniu. Zasłużyłeś na prawo noszenia znaku bojowego Twierdzy.",
        },
        "O-P02": {
          questId: "O-P02",
          before:
            "Popielne wilki odcięły szlak zaopatrzeniowy ku Żarowemu Traktowi. Czas ruszyć z kontratakiem.",
          during: "Wytrop przywódcę watahy w załomach skalnych i przywróć porządek na szlaku.",
          after: "Szlak znów jest przejezdny. Kupcy z Twierdzy nie zapomną twojej determinacji.",
        },
        "O-P03": {
          questId: "O-P03",
          before:
            "Cytadela Pierwszego Płomienia tętni niebezpiecznym żarem. Musisz zbadać tamtejszy piec i upewnić się, że magma nie przerwie wałów.",
          during: "Zbadaj ołtarz ognia wewnątrz Cytadeli. Uważaj na tryskające gejzery lawy.",
          after:
            "Wały zostały zabezpieczone. Pradawny ogień tytanów płonie teraz pod kontrolą naszych strażników.",
        },
        "O-P04": {
          questId: "O-P04",
          before:
            "Czas na wyprawę do Cytadeli Kowadeł. Spotkaj się z kowalami i odbierz przygotowany zapas ciężkich płyt pancerza.",
          during:
            "Przejdź przez kanion obsydianu. Ścieżka jest wąska i narażona na spadające odłamki bazaltu.",
          after: "Pancerze dotarły na czas. Nasze oddziały przednie są gotowe na każde starcie.",
        },
        "O-P05": {
          questId: "O-P05",
          before:
            "Port Czerwonych Żagli melduje o podejrzanych statkach u brzegów. Wyrusz na południe i sprawdź gotowość floty.",
          during:
            "Kapitan Daro czeka na nabrzeżu w porcie. Przeprowadź inspekcję umocnień nabrzeżnych.",
          after:
            "Flota stoi w gotowości, a straże przybrzeżne zostały wzmocnione. Południowa granica Pyry jest bezpieczna.",
        },
        "O-P06": {
          questId: "O-P06",
          before:
            "Nadszedł czas na ostateczną próbę ognia na Wielkiej Arenie. Stań naprzeciw elity wojowników i zdobądź tytuł Bohatera Kalderonu.",
          during:
            "Wejdź na piasek areny pod spojrzeniami tysięcy wojowników. Niech twoja energia KI eksploduje pełnią potęgi.",
          after:
            "Niechaj ryk tłumu niesie twoje imię aż po szczyty wulkanów! Jesteś prawdziwym Czempionem Legend!",
        },
        M05: {
          questId: "M05",
          before:
            "Jako uznany wojownik musisz złożyć przysięgę krwi przy Ołtarzu Wygasłych Ostrzy. Przynieś trofeum z pokonanego berserkera.",
          during:
            "Ołtarz wznosi się na samotnej iglicy skalnej. Pokonaj strażnika wzgórza i złóż dar godny wojownika.",
          after:
            "Przysięga została przyjęta przez duchy dawnych wodzów. Twoja broń otrzymała błogosławieństwo ognia.",
        },
        M15: {
          questId: "M15",
          before:
            "Z głębi kaldery wyłania się starożytny kolos ognia. To starcie, o którym pieśni będą śpiewać przez pokolenia.",
          during:
            "Zstąp do krateru. Uderzaj w pęknięcia pancerza kolosa, gdy ten przygotowuje uderzenie obszarowe.",
          after:
            "Tytan padł, a jego serce z krzepnącej lawy spoczęło w skarbcu Twierdzy. Pyra nigdy nie zapomni tego czynu.",
        },
      },
    },
    "npc-yumi": {
      npcId: "npc-yumi",
      npcName: "Yumi",
      cityId: "pyra-twierdza-popiolu",
      role: "Kwatermistrzyni i Kupiec Popiołu",
      greetings: [
        "Potrzebujesz ostrzałki, pyłu lawowego czy solidnych pasów? U Yumi kupisz ekwipunek, który nie stopi się w walce.",
        "Witaj! Pokaż, jakie trofea przynosisz z lawowych pustkowi. Dla rzadkich skór i rogów zawsze mam pełną sakiewkę.",
        "W Pyry nikt nie handluje świecidełkami. Sprzedaję wyłącznie to, co chroni życie i zadaje śmiertelne rany.",
      ],
      rumors: [
        "W kopalniach za Cytadelą Kowadeł natrafiono na żyłę czarnego obsydianu, który odbija zaklęcia eteryczne.",
        "Na szlaku do Portu widywano skalnego berserkera niosącego kamienny kufer z herbem zaginionego legionu.",
        "Mówią, że woda w zatoce Portu Czerwonych Żagli wrze od podwodnych kominów hydrotermalnych.",
      ],
      quests: {
        "S-P01": {
          questId: "S-P01",
          before:
            "Brakuje mi pancerzy magmowych krabów do wzmocnienia napierśników rekrutów. Zapoluj na nie wzdłuż lawowego strumienia.",
          during:
            "Krabie skorupy zbieraj ostrożnie szczypcami — świeża skorupa parzy nawet przez grube rękawice.",
          after:
            "Te pancerze są twarde jak żelazo. Płatnerze od razu wezmą się do kucia dodatkowych wzmocnień.",
        },
        "S-P02": {
          questId: "S-P02",
          before:
            "Żarowe nietoperze zanieczyszczają zapasy suszonego mięsa w zachodnich magazynach. Oczyść pieczary magazynowe.",
          during:
            "Nietoperze chowają się pod stropem jaskini. Wykurz je dymem ze spalonej siarki i zlikwiduj gniazda.",
          after:
            "Magazyny są czyste, a kwatermistrzostwo może znowu wydawać pełne racje dla załogi murów.",
        },
        "S-P03": {
          questId: "S-P03",
          before:
            "Karawana z pyłem siarkowym została zaatakowana przez stado popielnych wilków. Odszukaj porzucone wozy.",
          during:
            "Wozy stoją w wąwozie dymnym. Odeprzyj drapieżniki i zabezpiecz nienaruszone beczki z prochem.",
          after:
            "Cały transport ocalony! Twoja nagroda to nie tylko złoto, ale i szacunek gildii kupieckiej.",
        },
        "H-P04": {
          questId: "H-P04",
          before:
            "Odkryłam starą księgę rachunkową z zaznaczoną skrytką przemytników pod fundamentami muru. Sprawdź, czy coś tam zostało.",
          during:
            "Wejście kryje się za luźną płytą bazaltową w cieniu południowego bastionu. Uważaj na zapadnie.",
          after:
            "Niezwykłe znalezisko! Stare monety z czasów przed podziałem kontynentów i ceremonialny sztylet.",
        },
      },
    },
    "npc-goro": {
      npcId: "npc-goro",
      npcName: "Goro",
      cityId: "pyra-twierdza-popiolu",
      role: "Mistrz Kowadeł Lawowych",
      greetings: [
        "Dźwięk uderzenia młota to najwspanialsza muzyka na tej planecie. Co chcesz wykuć, wojowniku?",
        "Ogień, pot i żelazo — tak powstaje oręż Legend. Pokaż mi swoją broń, a powiem ci, ile jesteś wart.",
        "Witaj przy palenisku. Trzymaj się z dala od kanału spływowego surówki, chyba że chcesz stopić podeszwy butów.",
      ],
      rumors: [
        "W sercu wulkanu żyje salamandra o łuskach tak twardych, że tępią diamentowe przecinaki.",
        "W Cytadeli Kowadeł kują pancerze ze stopu meteorytu z wulkaniczną szlaką. Podobno są lżejsze od skóry, a twardsze od granitu.",
        "Dawni kowale potrafili uwięzić żywiołaka ognia wewnątrz rękojeści miecza, dając mu wieczny płomień.",
      ],
      quests: {
        "S-P05": {
          questId: "S-P05",
          before:
            "Do hartowania ostrzy potrzebuję łusek ognistej salamandry. Przynieś mi kilka okazów prosto z lawowych rozlewisk.",
          during:
            "Salamandry nurkują w płynnej lawie. Wywab je kawałkami siarki i zbierz nienaruszone łuski.",
          after:
            "Wspaniała jakość! Te łuski nie tracą twardości nawet przy temperaturze tysiąca stopni.",
        },
        "S-P06": {
          questId: "S-P06",
          before:
            "Mój ulubiony młot kowalski pękł na meteorytowej rudzie. Potrzebuję nowego rdzenia z czarnego obsydianu.",
          during:
            "Zejdź do głębokiej rozpadliny przy Ołtarzu Wygasłych Ostrzy. Ociosaj monolityczny blok czarnego szkła.",
          after:
            "Ten obsydian jest idealnie czysty. Wykuję młot, który posłuży moim uczniom przez kolejne sto lat.",
        },
        "H-P02": {
          questId: "H-P02",
          before:
            "Znalazłem w starym palenisku wskazówkę prowadzącą do ukrytej pieczary pierwszego kowala Pyry. Sprawdź te koordynaty.",
          during:
            "Wejście zasypane jest przez zastygłą lawę. Rozbij blokadę i odszukaj pradawne kowadło mistrza.",
          after:
            "Pradawne kowadło wciąż rezonuje energią KI! Odnaleźliśmy zaginione schematy oręża bojowego.",
        },
      },
    },
    "npc-rokan": {
      npcId: "npc-rokan",
      npcName: "Rokan",
      cityId: "pyra-twierdza-popiolu",
      role: "Mistrz Wypraw i Prób Areny",
      greetings: [
        "Blizny na ciele to mapa przebytych walk. Ile z nich nosisz ty, przybyszu?",
        "Witaj w kwaterze wypraw. Tutaj planujemy rajdy na najdziksze bestie wulkanicznego płaskowyżu.",
        "Wojownik bez wyzwania gnuśnieje jak stojąca woda. Szukasz chwały czy bezpiecznego kąta?",
      ],
      rumors: [
        "Na szczycie Bazaltowego Rogu gnieździ się stary żarowy nietoperz o rozpiętości skrzydeł przewyższającej rydwan bojowy.",
        "Kaplica Krwi i Popiołu jest nawiedzana przez upiory poległych wojowników, którzy nie zaznali spokoju po przegranej bitwie.",
        "Na granicy z pustynią popiołu widziano gigantycznego skorpiona obsydianowego, którego kolec przebija żelazne tarcze.",
      ],
      quests: {
        "S-P04": {
          questId: "S-P04",
          before:
            "Młodzi rekruci boją się wejść do Przełęczy Płomieni z powodu grasującego skalnego berserkera. Idź i rzuć mu wyzwanie.",
          during:
            "Berserker nie używa uników — polega wyłącznie na brutalnej sile. Wykorzystaj swoją zwinność i uderzaj w plecy.",
          after:
            "Wieść o twoim zwycięstwie już obiegła koszary. Rekruci znowu maszerują przez przełęcz z podniesionym czołem.",
        },
        "S-P07": {
          questId: "S-P07",
          before:
            "Skorpion obsydianowy zaatakował patrol zwiadowczy. Musimy pomścić naszych braci i zdobyć jego jadowy kolec.",
          during:
            "Uważaj na cios z podziemi — skorpion potrafi zakopać się w popiele i uderzyć znienacka.",
          after:
            "Kolec bestii zawiśnie nad wejściem do kwatery. Pokazałeś, czym jest niezłomny duch Legend.",
        },
        "S-P08": {
          questId: "S-P08",
          before:
            "Próba Trzech Żywiołów: musisz pokonać po jednym drapieżniku z każdego z trzech wulkanicznych rejonów w określonym czasie.",
          during:
            "Czas ucieka. Pokonaj salamandrę, popielnego wilka i magmowego kraba, zbierając ich bojowe znaki.",
          after:
            "Znakomity czas i bezbłędna technika! Twoje imię trafiło na tablicę mistrzów wypraw.",
        },
      },
    },
    "npc-pyra-warden-west": {
      npcId: "npc-pyra-warden-west",
      npcName: "Toren (Strażnik Traktu)",
      cityId: "pyra-zarowy-trakt",
      role: "Dowódca Zachodnich Ratowników",
      greetings: [
        "Żarowy Trakt to najgorętsza droga na tej planecie. Trzymaj się kamiennego traktu, jeśli nie chcesz spłonąć.",
        "Witaj na zachodnim posterunku. Pilnujemy, by magma nie zalała jedynego połączenia z Cytadelą Kowadeł.",
        "Dobre buty to podstawa na tym szlaku. Skały są tu tak gorące, że woda w manierce gotuje się w godzinę.",
      ],
      rumors: [
        "Pod Żarowym Traktem płynie podziemna rzeka lawy zasilająca fontanny wulkaniczne w Cytadeli Pierwszego Płomienia.",
        "Ratownicy znaleźli niedawno porzucony wóz kupiecki z Aetherii — jak ci Mędrcy dali radę tu dotrzeć w swoich jedwabiach?",
        "W bezksiężycowe noce w dymie nad traktem układają się sylwetki dawnych gigantów.",
      ],
      quests: {
        "S-P09": {
          questId: "S-P09",
          before:
            "Pęknięcie skorupy ziemskiej zagroziło mostowi na trakcie. Pomóż ratownikom ustabilizować grunt i odpędź golema ruin.",
          during:
            "Golem blokuje podejście do podpory mostu. Rozbij jego kamienny rdzeń i ułóż wsporniki z bazaltu.",
          after:
            "Most uratowany! Karawany z zaopatrzeniem mogą bezpiecznie kontynuować podróż ku Twierdzy.",
        },
        "H-P01": {
          questId: "H-P01",
          before:
            "W szczelinie pod traktem dostrzegłem blask starożytnej kapsuły ratunkowej z czasów pierwszego lądowania. Zbadaj ją.",
          during:
            "Zejdź ostrożnie po linach asekuracyjnych do wąwozu. Temperatura jest tam ekstremalnie wysoka.",
          after:
            "W kapsule znajdował się nienaruszony moduł nawigacyjny i starożytny pancerz ognioodporny!",
        },
      },
    },
    "npc-pyra-smith-east": {
      npcId: "npc-pyra-smith-east",
      npcName: "Hana (Płatnerka Obsydianu)",
      cityId: "pyra-cytadela-kowadel",
      role: "Mistrzyni Pancerzy Płytowych",
      greetings: [
        "Pancerz musi być jak druga skóra — elastyczny tam, gdzie ruch, i nieprzebijalny na piersi. Witaj w Cytadeli Kowadeł.",
        "W moich żyłach płynie płynny metal! Szukasz zbroi, która powstrzyma uderzenie smoczego ogona?",
        "Witaj w stolicy kowalskiego rzemiosła. Tu każde uderzenie młota rozbrzmiewa w całym wąwozie.",
      ],
      rumors: [
        "Najlepszy obsydian wydobywa się w pobliżu Kolosa Pierwszego Bohatera — kamień ten ma naturalną zdolność pochłaniania ciepła.",
        "Pod fundamentami Cytadeli Kowadeł znajduje się sala pamięci ze zbrojami wszystkich wodzów Pyry od zarania dziejów.",
        "Mówią, że kowale z Nexus-9 próbowali podkraść nasze receptury hartowania próżniowego.",
      ],
      quests: {
        "S-P10": {
          questId: "S-P10",
          before:
            "Do wykucia ceremonialnego pancerza potrzebuję czystego pyłu obsydianowego. Rozbij kryształy w Wąwozie Dymu.",
          during:
            "Kryształy są kruche, ale tną skórę jak brzytwy. Zbieraj pył do żelaznego słoja z filtrem.",
          after:
            "Idealna ziarnistość! Pancerz pokryty tą emalią będzie lśnił czernią głębszą niż bezgwiezdna noc.",
        },
        "S-P11": {
          questId: "S-P11",
          before:
            "Mistrzowski test pancerza: ubierz mój prototypowy kirys i przetrwaj serię uderzeń magmowego kraba w kanionie.",
          during:
            "Załóż pancerz i przyjmij uderzenia na tarczę. Obserwuj, jak materiał rozprasza energię kinetyczną.",
          after: "Żadnego pęknięcia, żadnego wgniecenia! To triumf kowalstwa Cytadeli Kowadeł!",
        },
      },
    },
    "npc-pyra-captain": {
      npcId: "npc-pyra-captain",
      npcName: "Daro (Ssternik Przymierza)",
      cityId: "pyra-port-czerwonych-zagli",
      role: "Kapitan Przepraw Południowych",
      greetings: [
        "Ahoj, lądowy szczurze! W Porcie Czerwonych Żagli pachnie smołą, solą i pieczoną rybą. Czego szukasz na nabrzeżu?",
        "Nasze drakary ze stali i żelaznego drewna pływają nawet po wrzącej wodzie. Witaj na pokładzie!",
        "Morze wokół Pyry jest równie zdradliwe jak jej lądy — podwodne wulkany potrafią wysadzić statek w powietrze bez ostrzeżenia.",
      ],
      rumors: [
        "Na południe od portu z wody wystaje Kolos Pierwszego Bohatera — jego kamienne oczy wskazują drogę do Wielkiego Wiru.",
        "Rybacy opowiadają o lewiatanach z lawowymi grzbietami, które wynurzają się nocą, by ogrzać się pod księżycem.",
        "Zatopione wraki w Zatoce Żaru kryją skrzynie z pradawnym złotem z czasów przedwielkich wojen.",
      ],
      quests: {
        "S-P12": {
          questId: "S-P12",
          before:
            "Piracka łódź rozbiła się na rafie żarowej, a ocalali terroryzują naszą latarnię morską. Przepędź korsarzy.",
          during:
            "Wejdź na groblę prowadzącą do latarni i zlikwiduj bandytów okupujących magazyn sygnałowy.",
          after:
            "Latarnia znów bezpieczna, a czerwone żagle mogą bez przeszkód wpływać do przystani.",
        },
        "H-P03": {
          questId: "H-P03",
          before:
            "Wyrzucona na brzeg beczka zawierała mapę prowadzącą do zatopionej jaskini skarbów pod Kolosem. Sprawdź to miejsce.",
          during:
            "Zanurkuj przy stopach Kolosa podczas odpływu. Wejście jest wąskie i porośnięte ostrymi skorupami.",
          after:
            "Skarb z dawnych latarni morskich odnaleziony! Złote monety i starożytna sekstanta nawigacyjna.",
        },
        "IC-09": {
          questId: "IC-09",
          before:
            "Przygotowujemy ekspedycję oceaniczną ku Wyspom Pośrednim. Zgromadź zapasy prowiantu odpornego na sól i wilgoć.",
          during:
            "Zbierz zapasy od kwatermistrzów i dostarcz je na flagowy drakar stojący przy pirsie pierwszym.",
          after:
            "Drakar jest w pełni wyposażony. Gdy tylko nadejdzie rozkaz, ruszymy ku nieznanym archipelagom!",
        },
      },
    },
  },
};
