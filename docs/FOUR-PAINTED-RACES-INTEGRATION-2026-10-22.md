# Cztery malowane rasy — integracja dostawy Claude’a, 22.10.2026

## Źródło i zakres

Baza gry: `main` **66a615dec1d4259e1bf668956ec1cb09e9aa177e**.
Dostawa Claude’a: gałąź `ccr-b63f9ce9-bu75ez`, commit
**83d4c06b91bb34e0d3353f31e9574bfffc6d7de9**, bezpośredni potomek tej bazy.
Integracja: `integration/four-painted-races-20261022`.
Zachowano całą historię dostawy oraz poprzednie wersje aktorów/atlasów.
Nie wykonywano merge do main, deployu, generacji nowych grafik ani operacji GPU.

Polecenie właściciela: wykorzystać cztery przygotowane przez Claude’a rasy w grze.
Dostawa zawierała paczki w `deliveries/`, ale żaden z czterech nowych manifestów
nie był zaimportowany do `src/game/assets/imported.json`.

## Dostarczone i włączone paczki

| Rasa / świat | Nowy domyślny aktor | Katalog runtime po importerze | WebP razem |
| --- | --- | --- | ---: |
| Planetarni / Verdantia | `hero-planetary-painted` | `public/game/assets/gpu/hero-planetary-painted/1.0.0-046664cc3ff1/` | 3 992 308 B |
| Mędrcy / Aetheria | `hero-sage-painted` | `public/game/assets/gpu/hero-sage-painted/1.0.0-103e4447b84c/` | 5 497 008 B |
| Androidy / Nexus-9 | `hero-android` | `public/game/assets/gpu/hero-android/1.0.0-f49d5582052e/` | 4 667 560 B |
| Legendy / Pyra | `hero-legend` | `public/game/assets/gpu/hero-legend/1.0.0-64672b3aa5f8/` | 3 809 196 B |

Dokładne ścieżki/digesty po instalacji są autorytatywnie zapisane w
[paragonach importera](qa/four-painted-races-20261022/) i w aktywnym rejestrze.
Każda paczka: **416 klatek**, 7 stanów × 8 kierunków = **56 klipów**,
2 atlasy (2048×2048 i 2048×1280), klatka 128×128.
Razem **1664 klatki / 224 klipy kierunkowe / 8 atlasów**.
Profil dostawy `legacy`: rozmiar świata 96×96, kotwica (0.5, 0.95), bez tintowania.
To profil zgodny z linią stóp masterów, nie dawny profil riga `grounded` 128/(.5,.75).

Po zgłoszeniu właściciela „Postacie są za małe!” prezentacja czterech bohaterów
w `actorVisual()` ma **160×160 jednostek świata zamiast 96×96** (+66,7% liniowo).
Manifesty dostawy i zaimportowane tekstury zachowują zweryfikowany kontrakt 96×96.
Kotwica stóp (0.5, 0.95), kamera i collider 12 pozostają bez zmian; większy obrys
jest też używany przy unikaniu nakładania nazw NPC na bohatera. Rozmiary NPC,
przeciwników i technicznego manekina nie są powiększane.
Test komunikatów nad grą sprawdza obrys 160×160 z tą samą kotwicą w pięciu
rozmiarach ekranu, zamiast dawnego obrysu 96×96.

Każdy bohater jest aktywny bez flag. Historyczne `ki-hero-art=1` i `ki-sage-art=1`
nie przywracają dawnych aktorów ani nie tworzą osobnego zapisu. Flagi otoczenia
pozostają niezależne. NPC nadal korzystają z `human-v2`, przeciwnicy z `boar-v1`.

## Kontrola dostawy

- Zweryfikowano 72 SHA-256: cztery obrazy tożsamości, 32 mastery, 32 widoki WebP
  i cztery manifesty; wszystkie zgodne z provenance. Sprawdzono też zgodność
  pięciu wskazanych skryptów generacji z ich deklarowanymi hashami.
- Otworzono osiem atlasów i odczytano piksele wszystkich 1664 klatek: RGBA,
  niepusta alfa, prawidłowy wymiar i komplet odwołań. Każdy z 224 klipów
  kierunkowych ma więcej niż jedną różniącą się pikselowo klatkę.
- Minimalny margines alfy w **klatce runtime 128 px**: Android/Legenda/Planetarny
  3 px, Mędrzec 4 px. To nie jest pomiar marginesu surowych PNG 512 px.
  Oryginalne tarballe 416 PNG na woluminie GPU nie były pobierane ani ponownie
  weryfikowane w tej sesji. Obecność spakowanych klatek nie dowodzi kompletności
  zewnętrznego archiwum roboczego.
- Wykonano cztery dry-run, potem cztery **sekwencyjne** instalacje przez
  `npm run assets:import -- deliveries/<id>-1.0.0/manifest.json --install`.
  Importer sprawdza kompletność/parametry animacji, alfę, atlas, budżet,
  optymalizuje bezstratnie i atomowo aktualizuje rejestr. Nie obchodzono walidacji
  ręcznym wpisaniem katalogów do aktywnego JSON.
- Źródła i wyniki: [source-verification.json](qa/four-painted-races-20261022/source-verification.json),
  [atlas-verification.json](qa/four-painted-races-20261022/atlas-verification.json).

Po instalacji kontrola produkcyjnego katalogu oraz katalogu preview przeszła.
Budżet bazowych tekstur + cache terenu: Verdantia **99 164 960 B**, Aetheria
**63 166 752 B**, Nexus-9 **54 149 920 B**, Pyra **55 920 416 B** — każdy poniżej
128 MiB. To wyliczenie katalogu, nie pomiar VRAM sterownika ani gwarancja FPS.

## Zachowane mechaniki

Nie zmieniono `GameSession`, nawigacji, collidera 12, rozkładu świata,
parametrów kamery, mapy/globusa, slotów, migracji ani kluczy zapisów.
Nie zmieniono prywatnego `/test`, sesji, walidacji uploadu ani Storage.
Zmiana aplikacji obejmuje import paczek, powiększenie prezentacji bohaterów
i usunięcie wymuszanego w katalogu historycznego preview Mędrca/Planetarnego.
Oryginalne ilustracje wyboru ras
pozostają materiałami prezentacyjnymi; ta dostawa podmienia animowane postacie gry.
Nie dodano umiejętności, ekwipunku ani mechaniki kostura na podstawie samych obrazów.

## Testy i ograniczenia dowodów

Przed finalnym przebiegiem: pełny TypeScript aplikacji/e2e/tools PASS,
**150/150 Vitest PASS**, assets:check PASS, build PASS, lint 0 błędów
(9 zastanych ostrzeżeń). Wstępny Software WebGL: **8/8** dla czterech ras,
1280 i 390 px, identyfikacja renderera, poprawny atlas i rzeczywisty ruch.
To wstępne kontrole; końcowe dowody muszą wskazywać SHA głowy PR.

Zaktualizowano dotychczasowe asercje konkretnych aktorów do nowej dostawy.
Nie usunięto scenariuszy zachowania zapisu ani uszkodzonego atlasu/retry.
Test fallbacku animacji używa teraz rzeczywistego NPC `human-v2`, bo bohater Pyry
ma już komplet klipów i nie jest reprezentantem brakującej animacji.
Testy ośmiu kierunków sprawdzają dodatkowo odpowiadające im klatki ruchu
klawiatury i CDP touch dla wszystkich ras. Test cyklu życia obejmuje teraz
każdą rasę: idle/walk/attack/skill/hit/death/respawn w prawdziwej walce.
Nie zmienia HP, czasu, XP ani zapisów w celu zaliczenia.

Pełny Playwright zawiera **103 scenariusze**: gameplay Canvas, Software WebGL,
trasy aplikacji Canvas/WebGL (w tym globus i zamknięty `/test`). Osobny workflow
`Four hero WebGL regressions` sprawdza 14 scenariuszy Software WebGL.
Końcowe wyniki, SHA i odnośniki do artefaktów są w opisie PR/Actions; nie nadawać
statusu PASS przebiegom w toku. Zrzuty runtime trafiają do `testInfo.outputPath`
i artefaktów, bez nadpisywania historycznych plików `docs/qa`.

Nie wykonano testu na fizycznym Androidzie, sprzętowym WebGL, pomiarów temperatury,
wielogodzinnej sesji ani końcowego odbioru estetycznego. Canvas/SwiftShader
z emulowanym viewportem nie zastępują tych kontroli.

## Znane wady grafiki i prawa

[Pipeline Claude’a](PAINTED-MESH-PIPELINE.md) wymienia niespójność szczegółów
między kierunkami, rozciąganie na styku nóg/tuniki, niewielki ruch chodu z przodu,
zmniejszenie sylwetek dla marginesu death, brak narysowanego kostura Mędrca
i ślady czerwonej energii w widokach Legendy. Nie maskowano tych wad duplikacją
klatek, zmianą kolizji ani deklaracją końcowego odbioru.

Nowe pliki mają osobny [aneks rejestru](licenses/four-painted-races-20261022.json)
z indywidualnymi ścieżkami, rozmiarami, SHA i opisem pochodzenia.
Nie przenoszono na nie etykiety „OpenAI imagegen” ze starszego Mędrca: ta dostawa
używa deklarowanego Animagine + ControlNet + IP-Adapter i deformacji malowanych
widoków. Nazwy modeli, ich SHA i deklaracje Apache-2.0 z provenance nie zastępują
przypiętych tekstów licencji, praw do checkpointów/rembg `isnet-anime` ani praw
do referencji. **Prawa do pierwowzorów i komercyjnego outputu pozostają
nierozstrzygnięte**, zgodnie z deklaracją samej dostawy.
Akceptacja kandydata tożsamości lub przeglądu ruchu nie oznacza odbioru końcowego
spakowanych atlasów ani weryfikacji praw. Integracja i testy nie są publikacją.
