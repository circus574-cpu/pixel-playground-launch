import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { GameHud } from '../components/game/GameHud';
import { clampZoom, initialZoom } from '../game/view';
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
  const stage = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(0.62);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayNotice, setDisplayNotice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameViewState>({ x: 960, y: 700, target: null, defeated: 0, ready: false });
  useEffect(() => {
    const initial = initialZoom(window.innerWidth);
    setZoom(initial);
    if (container.current) container.current.dataset['zoom'] = String(initial);
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  function changeZoom(value: number) {
    const next = clampZoom(value);
    setZoom(next);
    if (container.current) {
      container.current.dataset['zoom'] = String(next);
      container.current.dispatchEvent(new Event('ki:zoom'));
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setDisplayNotice('Ta przeglądarka nie udostępnia pełnego ekranu.');
    } catch { setDisplayNotice('Nie udało się włączyć pełnego ekranu. Spróbuj ponownie.'); }
  }
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
  return <main ref={stage} className="ki-stage"><div ref={container} className="ki-canvas" aria-label="Ki Legends — ekran gry" /><GameHud state={state} error={error} zoom={zoom} onZoom={changeZoom} fullscreen={fullscreen} onFullscreen={() => void toggleFullscreen()} />{displayNotice && <button className="ki-display-notice" onClick={() => setDisplayNotice('')}>{displayNotice} ×</button>}</main>;
}
