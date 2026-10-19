import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { GameHud } from '../components/game/GameHud';
import type { GameViewState } from '../game/mountGame';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Ki Legends — Wioska Początkowa' },
    { name: 'description', content: 'Wejdź do świata Ki Legends. Odkrywaj Wioskę Początkową i rozpocznij swoją podróż.' },
  ] }),
  component: Index,
});
function Index() {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameViewState>({ x: 960, y: 700, target: null, defeated: 0, ready: false });
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import('../game/mountGame').then(({ mountKileGends }) => {
      if (!cancelled && container.current) cleanup = mountKileGends(container.current, next => { if (!cancelled) setState(next); });
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Nie można uruchomić gry');
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <main className="ki-stage"><div ref={container} className="ki-canvas" aria-label="Ki Legends — ekran gry" /><GameHud state={state} error={error} /></main>;
}
