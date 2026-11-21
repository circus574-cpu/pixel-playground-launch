# KI Legends — 2D Isometric World, 4 Continents, 24 Exp-Zones & Real 3D Planet Globe (`Godot 4.6.3`)

Ten projekt (`ports/godot-isometric-world`) łączy **pełne kontynenty 2D w rzucie izometrycznym (`1024 × 1024 m` na kontynent)**, **generator dróg splajnowych Catmull-Rom**, **24 odnogi i polany bojowe (`Expowiska Lv. 1–18`)**, **animowane wody, jeziora, zatoki oceaniczne i rzeki lawy**, **338 ręcznie malowanych obiektów architektury i flory + 12 murów/baszt z Blender Cycles GPU / Geometry Nodes**, **99 żywych animowanych postaci (4 bohaterów, 40 NPC, 41 potworów, 10 zwierząt fauny)** oraz **prawdziwy trójwymiarowy Globus Planety Superior (`GlobeView`)**.

## Kluczowe komponenty (Faza A + Faza C)

1. **4 Kontynenty (`1024 × 1024 m`, siatka `512 × 512`) i Fortyfikowane Stolice:**
   - **Pyra (`Twierdza Popiołu`)**: wielopoziomowa cytadela otoczona murami oporowymi z bazaltu, bramami i basztami, z szerokimi rzekami rozżarzonej lawy, kraterem wulkanicznym NE oraz kalderami magmowymi SW/SE spiętymi kamiennymi mostami.
   - **Verdantia (`Zielona Przystań`)**: szmaragdowa dolina z Fontanną Rynku, szeroką Rzeką Przełomu, Wielkim Szmaragdowym Jeziorem NW z wodospadami oraz południowo-wschodnią Zatoką Oceaniczną.
   - **Aetheria (`Sanktuarium Tysiąca Źródeł`)**: koncentryczne tarasy świątynne otoczone turkusową laguną pierścieniową, górskimi jeziorami lodowcowymi z kaskadami wodospadów oraz południowym fiordem.
   - **Nexus-9 (`Węzeł Świadomości`)**: ośmiokątne tarasy cyber-przemysłowe z głównym reaktorem, świecącymi kanałami plazmowymi (cyjanowe obwody), północno-wschodnim jeziorem chłodziwa i głębokowodnym portem oceanicznym.
2. **Generator Dróg Splajnowych (`Catmull-Rom Spline Road Network`) i 24 Expowiska (`Lv. 1–18`):**
   - Główne aleje miejskie wychodzące przez 4 bramy stolicy przechodzą w **4 magistrale kontynentalne** oraz **6 odnóg prowadzących do 6 szerokich polan bojowych (`Expowisk`) na każdym kontynencie** (`24` expowiska łącznie).
   - Każde expowisko ma wyrównane, odsłonięte centrum bojowe (brak wysokich drzew zasłaniających walkę), kamienny pierścień areny, otaczające ruiny/kryształy/obozy oraz **5 patrolujących potworów odpowiedniego poziomu (`Lv. 1..18`)**.
3. **Żywy Świat (`99` animowanych jednostek 8-kierunkowych + efekty `PyraAmbient`):**
   - **40 NPC** (`10` w każdej stolicy) z polskimi tytułami, znacznikami zadań (`!` / `?`) i trasami patrolowymi.
   - **41 gatunków potworów** (`120` instancji w 24 expowiskach) z paskami HP i odznakami poziomów.
   - **10 gatunków dzikiej fauny (`A-01..A-10`)** (`64` instancje pasące się nad jeziorami i w lasach).
   - **Efekty `PyraAmbient`**: żywy ogień, dym, para wodna nad źródłami i wodospadami, żar nad lawą, poświata latarni i iskry plazmowe.
4. **Prawdziwy Globus 3D Planety Superior (`scripts/globe_view.gd`) + Atlas 2D + Mapa 3D Regionu:**
   - Klawisz `[G]` otwiera interaktywny **Globus 3D** z obracającą się sferą planety, warstwą chmur, blaskiem słońca na oceanie, atmosferą Fresnela i obrysami wszystkich kontynentów i wysp.
   - Klawisz `[Tab]` przełącza na płaski **Atlas 2D (`2048 × 1024`)**, a `[M]` otwiera obracaną **Mapę 3D Kontynentu**.
   - Klawisz `[E]` teleportuje kolejno przez **6 Expowisk** aktualnego kontynentu, a `[C]` wraca do centrum **Stolicy**.
