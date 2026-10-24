# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pre-gpu.spec.ts >> Android legend 390x844 >> real Android input in eight directions: legend 390x844
- Location: e2e/pre-gpu.spec.ts:66:7

# Error details

```
Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic "Ki Legends — ekran gry" [ref=e4]
  - generic:
    - region "Postać gracza":
      - generic: "1"
      - generic:
        - generic: Wędrowiec
        - meter "Zdrowie":
          - generic: 120 / 120
        - meter "Energia KI":
          - generic: 50 / 50
        - generic "Doświadczenie 0/100"
    - region "Minimapa":
      - generic: Twierdza Popiołu
      - button "Otwórz mapę świata" [ref=e6] [cursor=pointer]:
        - 'img "Mapa: Twierdza Popiołu" [ref=e7]'
        - generic "Twierdza Popiołu": ◆
        - generic "Arena Dziedzictwa": ◆
        - generic "Szczeliny": ◆
    - region "Czat lokalny":
      - button "☷ Czat lokalny" [ref=e9] [cursor=pointer]
    - navigation "Umiejętności":
      - button "Cięcie płomienia" [ref=e10] [cursor=pointer]:
        - generic [ref=e12]: "1"
      - button "Impuls KI" [ref=e13] [cursor=pointer]:
        - generic [ref=e15]: "2"
      - button "Tarcza ducha" [ref=e16] [cursor=pointer]:
        - generic [ref=e18]: "3"
      - button "Atak podstawowy" [ref=e19] [cursor=pointer]:
        - generic [ref=e21]: "4"
      - button "Mikstura życia" [disabled] [ref=e22]:
        - generic [ref=e24]: Q
        - generic [ref=e25]: "3"
    - navigation "Widok mapy":
      - button "Oddal mapę" [ref=e26] [cursor=pointer]: −
      - button "Przybliż mapę" [ref=e27] [cursor=pointer]: +
      - button "Pełny ekran" [ref=e28] [cursor=pointer]: ⛶
    - navigation "Menu gry":
      - button "Ekwipunek" [ref=e29] [cursor=pointer]
      - button "Dziennik" [ref=e31] [cursor=pointer]
      - button "Ustawienia" [ref=e33] [cursor=pointer]
    - button "Rozmowa · Yumi E" [ref=e35] [cursor=pointer]
    - generic "Powiadomienia gry"
```