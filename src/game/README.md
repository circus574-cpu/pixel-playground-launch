# KileGends — Phaser 4

Silnik: Phaser 4.2.1, TypeScript. Moduł odizolowany od istniejących tras TanStack Start.

## Uruchomienie

Zainstaluj zależności repozytorium (`npm install` lub zgodny menedżer pakietów), następnie zaimportuj `mountKileGends` z `src/game/mountGame.ts` w klienckim komponencie React. Nie importuj modułu po stronie SSR.

Przykład:

```tsx
useEffect(() => {
  let destroy: undefined | (() => void);
  let cancelled = false;
  import('@/game/mountGame').then(({ mountKileGends }) => {
    if (!cancelled && container.current) destroy = mountKileGends(container.current);
  });
  return () => { cancelled = true; destroy?.(); };
}, []);
```

To etap inicjalizacji silnika, bez publikacji i bez gotowych tekstur.
