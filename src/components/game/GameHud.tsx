import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameViewState } from '../../game/mountGame';
import './game-hud.css';

type Props = { state: GameViewState; error: string | null };
type Panel = 'inventory' | 'journal' | 'settings' | 'map' | null;
const iconNames = ['Portret', 'Impuls KI', 'Cięcie płomienia', 'Tarcza ducha', 'Mikstura życia', 'Ekwipunek', 'Dziennik', 'Ustawienia', 'Walka'];
function Icon({ index, className = '' }: { index: number; className?: string }) {
  const style: CSSProperties = { backgroundPosition: `${index % 3 * 50}% ${Math.floor(index / 3) * 50}%` };
  return <span aria-hidden="true" className={`ki-icon ${className}`} style={style} />;
}

export function GameHud({ state, error }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState('System');
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [hints, setHints] = useState(true);
  const [notice, setNotice] = useState('');
  const [mapSize, setMapSize] = useState(false);
  const x = Math.max(0, Math.min(100, state.x / 1920 * 100));
  const y = Math.max(0, Math.min(100, state.y / 1280 * 100));
  function toggle(next: Panel) { setPanel(p => p === next ? null : next); }
  function skill(name: string) { setNotice(`${name} — umiejętność jeszcze zablokowana`); }
  return <div className="ki-hud">
    <section className="ki-player ki-frame" aria-label="Postać gracza">
      <div className="ki-portrait"><Icon index={0} /><span className="ki-level">1</span></div>
      <div className="ki-player-info"><div className="ki-player-name">Wędrowiec <span>CZŁOWIEK</span></div>
        <div className="ki-meter ki-hp" role="meter" aria-label="Zdrowie" aria-valuenow={120} aria-valuemin={0} aria-valuemax={120}><i /><span>120 / 120</span></div>
        <div className="ki-meter ki-energy" role="meter" aria-label="Energia KI" aria-valuenow={50} aria-valuemin={0} aria-valuemax={50}><i /><span>50 / 50</span></div>
        <div className="ki-xp"><i /></div>
      </div>
    </section>
    {state.target && <section className="ki-target ki-frame" aria-label="Wybrany przeciwnik"><span>POZIOM 1 · BESTIA</span><strong>{state.target.name}</strong><div className="ki-meter ki-hp"><i style={{ width: `${state.target.hp / state.target.maxHp * 100}%` }} /><span>{state.target.hp} / {state.target.maxHp}</span></div></section>}
    <section className={`ki-map ki-frame ${mapSize ? 'ki-map-large' : ''}`} aria-label="Minimapa">
      <div className="ki-map-title"><span className="ki-dot" />Wioska Początkowa</div>
      <button className="ki-map-image" aria-label="Otwórz mapę świata" onClick={() => toggle('map')}><img src="/game/assets/village-v2.webp" alt="Mapa Wioski Początkowej" /><span className="ki-map-marker" style={{ left: `${x}%`, top: `${y}%` }} /></button>
      <div className="ki-map-footer"><span>BEZPIECZNA OKOLICA</span><button onClick={() => setMapSize(v => !v)} aria-label={mapSize ? 'Zmniejsz minimapę' : 'Powiększ minimapę'}>{mapSize ? '−' : '+'}</button></div>
    </section>
    <button className="ki-quest" onClick={() => toggle('journal')}><span className="ki-quest-diamond">◆</span><div><strong>Pierwsze kroki</strong><span>Poznaj Wioskę Początkową</span></div><span className="ki-quest-arrow">›</span></button>
    <div className="ki-location"><span>KI LEGENDS</span><strong>Wioska Początkowa</strong><i />Dolina Szmaragdowego Potoku</div>
    <section className={`ki-chat ki-frame ${chatOpen ? 'ki-chat-open' : ''}`} aria-label="Czat lokalny">
      <button className="ki-chat-toggle" onClick={() => setChatOpen(v => !v)} aria-expanded={chatOpen}>Czat lokalny <span>{chatOpen ? '−' : '+'}</span></button>
      <div className="ki-chat-content"><div className="ki-chat-tabs" role="tablist" aria-label="Kanały czatu">{['Ogólny', 'System', 'Walka', 'Gildia'].map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="ki-messages" role="log" aria-live="polite">
        {tab === 'System' && <><p><b>[System]</b> Witaj w Ki Legends!</p><p><b>[System]</b> Odkryto: Wioska Początkowa.</p><p className="ki-chat-muted">Twoja podróż zaczyna się tutaj.</p></>}
        {tab === 'Walka' && <p><b>[Walka]</b> Pokonani przeciwnicy: {state.defeated}</p>}
        {tab === 'Gildia' && <p className="ki-chat-muted">Nie należysz jeszcze do gildii.</p>}
        {tab === 'Ogólny' && (messages.length ? messages.map((m, i) => <p key={i}><b>[Ty]</b> {m}</p>) : <p className="ki-chat-muted">Rozmowa lokalna na tym urządzeniu.</p>)}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { setMessages(m => [...m.slice(-19), draft.trim().slice(0, 240)]); setDraft(''); setTab('Ogólny'); } }}><input maxLength={240} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Napisz wiadomość lokalną…" aria-label="Wiadomość lokalna" /><button aria-label="Dodaj wiadomość lokalną">↵</button></form></div>
    </section>
    <nav className="ki-actionbar ki-frame" aria-label="Umiejętności"><div className="ki-action-crest">KI</div>{[{ n: 2, key: '1' }, { n: 1, key: '2' }, { n: 3, key: '3' }, { n: 8, key: '4' }, { n: 4, key: 'Q' }].map(({ n, key }) => <button className="ki-skill" key={key} title={`${iconNames[n]} — zablokowane`} aria-label={`${iconNames[n]} — zablokowane`} onClick={() => skill(iconNames[n])}><Icon index={n} /><kbd>{key}</kbd><span className="ki-skill-lock">◇</span></button>)}<div className="ki-bar-decoration">◆</div></nav>
    <nav className="ki-menu" aria-label="Menu gry">{([{ p: 'inventory', n: 5 }, { p: 'journal', n: 6 }, { p: 'settings', n: 7 }] as const).map(({ p, n }) => <button key={p} className={`ki-menu-button ki-frame ${panel === p ? 'active' : ''}`} title={iconNames[n]} aria-label={iconNames[n]} onClick={() => toggle(p)}><Icon index={n} /></button>)}</nav>
    {hints && <div className="ki-help"><span>WASD</span> ruch <b>·</b> kliknij ziemię lub przeciwnika <b>·</b> <span>ESC</span> anuluj</div>}
    {notice && <button className="ki-notice ki-frame" onClick={() => setNotice('')}>{notice} <span>×</span></button>}
    {(!state.ready || error) && <div className="ki-loading"><div className="ki-frame"><span className="ki-loading-rune">◆</span><h1>KI LEGENDS</h1><p>{error || 'Wkraczasz do Wioski Początkowej…'}</p></div></div>}
    {panel && <div className="ki-modal-backdrop" onClick={() => setPanel(null)}><section className="ki-modal ki-frame" role="dialog" aria-modal="true" aria-label={{ inventory: 'Ekwipunek', journal: 'Dziennik', settings: 'Ustawienia', map: 'Mapa wioski' }[panel]} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setPanel(null); }}><header><h2>{{ inventory: 'Ekwipunek', journal: 'Dziennik podróży', settings: 'Ustawienia', map: 'Wioska Początkowa' }[panel]}</h2><button autoFocus onClick={() => setPanel(null)} aria-label="Zamknij okno">×</button></header>
      {panel === 'inventory' && <><div className="ki-inventory">{Array.from({ length: 15 }, (_, i) => <div key={i} />)}</div><p className="ki-panel-caption">Twój plecak jest jeszcze pusty.</p></>}
      {panel === 'journal' && <article className="ki-journal"><span className="ki-eyebrow">POCZĄTEK PODRÓŻY</span><h3>Pierwsze kroki</h3><p>Za murami wioski zaczyna się nieznany świat. Poznaj brukowany rynek, odnajdź most nad potokiem i rozejrzyj się po okolicy.</p><div className="ki-journal-entry">◆ Wioska Początkowa <span>ODKRYTA</span></div></article>}
      {panel === 'settings' && <div className="ki-settings"><label><span>Podpowiedzi sterowania</span><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} /></label><label><span>Duża minimapa</span><input type="checkbox" checked={mapSize} onChange={e => setMapSize(e.target.checked)} /></label></div>}
      {panel === 'map' && <div className="ki-full-map"><img src="/game/assets/village-v2.webp" alt="Mapa wioski" /><span className="ki-map-marker" style={{ left: `${x}%`, top: `${y}%` }} /></div>}
    </section></div>}
  </div>;
}
