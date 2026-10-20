# Tymczasowa zmiana rasy podczas testów

2026-10-20. **Ustawienia → Zmiana rasy** zapisuje aktualną postać, zamyka scenę i otwiera bezpośrednio cztery karty pochodzenia. Wybierz rasę i naciśnij „Rozpocznij przygodę”. Gra uruchomi odpowiadający jej kontynent.

Każda nowa podróż ma osobny slot. Przycisk nie zmienia pochodzenia ani postępu istniejącej postaci i nie przenosi zadań między kontynentami. Do wcześniejszych postaci można wrócić przez „Twoje postacie”. Zwykły przycisk „Zapisz i wybierz postać” pozostaje dostępny.

## Wyłączenie po testach

W `src/game/features.ts` ustaw:

```ts
export const TEST_RACE_SWITCH_ENABLED = false;
```

Po buildzie i publikacji przycisk oraz jego opis znikną z ustawień. Zapisane postacie nadal będą dostępne przez zwykły wybór postaci. Flaga jest celowo włączona również na produkcji na czas testów użytkownika.

## Weryfikacja

- 70/70 istniejących testów jednostkowych PASS.
- Dwa scenariusze przeglądarkowe (1280 × 900 i 390 × 844): Planetarni → Mędrcy → Androidy → Legendy, poprawne kontynenty, odświeżenie każdej nowej postaci, cztery niezależne sloty, powrót do Planetarnych z nadal aktywnym zadaniem Airy. PASS.
- Pełny TypeScript aplikacji i testów; build produkcyjny. PASS.
- Lint: bez błędów; siedem wcześniejszych ostrzeżeń niezwiązanych ze zmianą.

Scenariusze: `npx playwright test e2e/race-switch.spec.ts`.

Build aktualizacji: `stage3.1-race-switch-r2`. Publikacja i sprawdzenie przycisku na produkcji: w toku.
