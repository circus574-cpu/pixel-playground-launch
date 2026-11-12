# Zmiany 12.11.2026

### 1. Animacje etapu 2 (reakcje) i lustrzane widoki boczne — cztery rasy

- Z filmów `<rasa>-etap2-reakcje.mp4` (Android: `-v2`, Planetar: reakcje w 10–20 s pliku) wycięto `hitheavy`
  (8 klatek, 12 kl./s: odrzut, potknięcie, przyklęk, powrót) i `victory` (8 klatek, 10 kl./s: gest zwycięstwa).
  Skrypt `scripts/anim/reactform_build.py` (atlas `<paczka>-fight-3`, efekty z filmu zachowane jak w etapie 1).
- Silnik: stany `hitheavy` (priorytet jak trafienie) i `victory`; `mountGame` gra `hitheavy`, gdy cios zabiera co
  najmniej 15% maks. życia bohatera, a `victory` przy awansie na poziom.
- Tekstury: klipy z widoku bocznego trzymały prawą stronę i jej lustro. Nowe pole klipu `mirrored` (kierunki rysowane
  jako odbicie, `sprite.setFlipX`, przenoszone też na obrys i ducha bohatera) i `scripts/anim/dedupe_mirror.py`
  (usuwa lustrzane kopie tylko, gdy widoczne piksele są identycznym odbiciem) zmniejszyły atlasy o 13–16 MiB na rasę.
  Paczki bohaterów `2.8.1`; najwyższy świat (Verdantia z cache terenu) 107,1 z 128 MiB mimo nowych klipów.
- Weryfikacja w grze (arena, próbnik klatek, bohater zwrócony w lewo): `hitheavy 00–07` i `victory 00–07` dla czterech ras,
  klipy etapu 1 (`skillb`, `dodge`, `guard`) po odbiciu stoją na swoim cieniu i patrzą w stronę celu; zero błędów konsoli.
  Wywołanie z gry (cios ≥ 15% życia, awans) sprawdzone kodem i testem typów, w przeglądarce klipy uruchomiono bezpośrednio.
