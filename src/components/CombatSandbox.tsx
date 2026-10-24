import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HERO_RACES, HeroRace, Direction } from '../data/heroes';
import { MONSTERS, Monster, WORLDS } from '../data/bestiary';
import { 
  Swords, 
  Shield, 
  Heart, 
  Zap, 
  RotateCcw, 
  Plus, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  Crosshair,
  Award,
  Sparkles,
  Info
} from 'lucide-react';

interface ActiveMonster {
  instanceId: string;
  monsterId: string;
  name: string;
  world: string;
  x: number;
  y: number;
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  speed: number;
  agro: number;
  range: number;
  xp: number;
  color: string;
  state: 'idle' | 'chase' | 'attack' | 'dead';
  lastAttackTime: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
  duration: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  time: number;
}

interface CombatSandboxProps {
  initialHeroId?: HeroRace['id'];
  queuedMonster?: Monster | null;
  onClearQueuedMonster?: () => void;
}

export const CombatSandbox: React.FC<CombatSandboxProps> = ({
  initialHeroId = 'planetary',
  queuedMonster,
  onClearQueuedMonster,
}) => {
  const [selectedHeroId, setSelectedHeroId] = useState<HeroRace['id']>(initialHeroId);
  const hero = HERO_RACES.find((h) => h.id === selectedHeroId) || HERO_RACES[0];

  // Player Progression
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXp, setPlayerXp] = useState(0);
  const xpNeeded = playerLevel * 60;
  const [playerHp, setPlayerHp] = useState(hero.baseStats.hp);
  const [playerKi, setPlayerKi] = useState(hero.baseStats.ki);
  const [playerDirection, setPlayerDirection] = useState<Direction>('down');
  const [combatLog, setCombatLog] = useState<{ id: string; time: string; text: string; type: 'hit' | 'damage' | 'kill' | 'level' | 'info' }[]>([]);
  const [selectedSpawnMonsterId, setSelectedSpawnMonsterId] = useState<string>(MONSTERS[0].id);

  // Canvas & Game State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerPosRef = useRef({ x: 400, y: 300 });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const monstersRef = useRef<ActiveMonster[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const heroImgCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Skill cooldown trackers
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({ Q: 0, E: 0, R: 0 });

  const addLog = useCallback((text: string, type: 'hit' | 'damage' | 'kill' | 'level' | 'info' = 'info') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setCombatLog((prev) => [{ id: Math.random().toString(), time, text, type }, ...prev.slice(0, 19)]);
  }, []);

  // Preload hero 8-direction images
  useEffect(() => {
    Object.entries(hero.views).forEach(([dir, src]) => {
      const img = new Image();
      img.src = src;
      heroImgCacheRef.current[dir] = img;
    });
  }, [hero]);

  // Handle incoming monster spawn from bestiary explorer
  useEffect(() => {
    if (queuedMonster) {
      spawnMonster(queuedMonster);
      if (onClearQueuedMonster) onClearQueuedMonster();
    }
  }, [queuedMonster, onClearQueuedMonster]);

  // Spawn monster function
  const spawnMonster = (m: Monster) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 220 + Math.random() * 120;
    const px = playerPosRef.current.x + Math.cos(angle) * dist;
    const py = playerPosRef.current.y + Math.sin(angle) * dist;

    // Clamp inside arena
    const x = Math.max(60, Math.min(740, px));
    const y = Math.max(60, Math.min(540, py));

    const newMonster: ActiveMonster = {
      instanceId: `mob-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      monsterId: m.id,
      name: m.name,
      world: m.world,
      x,
      y,
      maxHp: m.stats.hp,
      currentHp: m.stats.hp,
      atk: m.stats.atk,
      def: m.stats.def,
      speed: m.speed * 1.3,
      agro: m.agro,
      range: Math.max(45, m.range * 0.4),
      xp: m.stats.xp,
      color: WORLDS[m.world]?.color || '#10b981',
      state: 'idle',
      lastAttackTime: 0,
    };

    monstersRef.current.push(newMonster);
    addLog(`Spawned [${m.name}] Lv.${m.level} (${m.world})`, 'info');
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling on space / arrows
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;
      keysRef.current[e.key.toLowerCase()] = true;

      // Handle direct key triggers
      if (e.code === 'KeyQ') triggerSkill('Q');
      if (e.code === 'KeyE') triggerSkill('E');
      if (e.code === 'KeyR') triggerSkill('R');
      if (e.code === 'Space') triggerBasicAttack();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hero, playerLevel, playerKi]);

  // Basic Attack
  const triggerBasicAttack = () => {
    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;

    // Determine direction vector
    let dx = 0;
    let dy = 0;
    if (playerDirection.includes('right')) dx = 1;
    if (playerDirection.includes('left')) dx = -1;
    if (playerDirection.includes('down')) dy = 1;
    if (playerDirection.includes('up')) dy = -1;
    if (dx === 0 && dy === 0) dy = 1;

    // Normalize
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    // Projectile
    projectilesRef.current.push({
      id: Math.random().toString(),
      x: px + dx * 20,
      y: py + dy * 20,
      vx: dx * 7.5,
      vy: dy * 7.5,
      damage: Math.round(hero.baseStats.atk * (1 + (playerLevel - 1) * 0.1)),
      color: hero.accentColor,
      radius: 6,
      duration: 45,
    });
  };

  // Ki Skills
  const triggerSkill = (key: 'Q' | 'E' | 'R') => {
    const skill = hero.skills.find((s) => s.key === key);
    if (!skill) return;

    if (playerKi < skill.cost) {
      addLog(`Not enough Ki for ${skill.name} (${skill.cost} Ki required)`, 'info');
      return;
    }

    if ((cooldowns[key] || 0) > 0) {
      return;
    }

    // Spend Ki
    setPlayerKi((prev) => Math.max(0, prev - skill.cost));
    setCooldowns((prev) => ({ ...prev, [key]: skill.cooldown }));

    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;

    if (key === 'Q') {
      // Ki Blast / Arc / Slam: 3-way spread or high power blast
      addLog(`Casted [${skill.name}]!`, 'hit');
      [-0.2, 0, 0.2].forEach((offsetAngle) => {
        let baseAngle = 0;
        if (playerDirection === 'down') baseAngle = Math.PI / 2;
        else if (playerDirection === 'up') baseAngle = -Math.PI / 2;
        else if (playerDirection === 'left') baseAngle = Math.PI;
        else if (playerDirection === 'right') baseAngle = 0;
        else if (playerDirection === 'down-right') baseAngle = Math.PI / 4;
        else if (playerDirection === 'down-left') baseAngle = (3 * Math.PI) / 4;
        else if (playerDirection === 'up-right') baseAngle = -Math.PI / 4;
        else if (playerDirection === 'up-left') baseAngle = -(3 * Math.PI) / 4;

        const a = baseAngle + offsetAngle;
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: px,
          y: py,
          vx: Math.cos(a) * 8.5,
          vy: Math.sin(a) * 8.5,
          damage: Math.round(hero.baseStats.atk * 1.6),
          color: hero.accentColor,
          radius: 9,
          duration: 50,
        });
      });
    } else if (key === 'E') {
      // Dash / Shield: Quick teleport/dash in facing direction
      addLog(`Activated [${skill.name}]!`, 'info');
      let dx = 0;
      let dy = 0;
      if (playerDirection.includes('right')) dx = 1;
      if (playerDirection.includes('left')) dx = -1;
      if (playerDirection.includes('down')) dy = 1;
      if (playerDirection.includes('up')) dy = -1;
      const len = Math.hypot(dx, dy) || 1;

      playerPosRef.current.x = Math.max(40, Math.min(760, px + (dx / len) * 110));
      playerPosRef.current.y = Math.max(40, Math.min(560, py + (dy / len) * 110));

      floatingTextsRef.current.push({
        id: Math.random().toString(),
        x: px,
        y: py - 20,
        text: 'DASH!',
        color: '#38bdf8',
        alpha: 1,
        time: 0,
      });
    } else if (key === 'R') {
      // Ultimate Burst: 360-degree radial ring of Ki
      addLog(`UNLEASHED ULTIMATE: [${skill.name}]!`, 'hit');
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: px,
          y: py,
          vx: Math.cos(a) * 6,
          vy: Math.sin(a) * 6,
          damage: Math.round(hero.baseStats.atk * 2.8),
          color: '#fbbf24',
          radius: 11,
          duration: 65,
        });
      }
    }
  };

  // Cooldown countdown loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k] > 0) {
            next[k] = Math.max(0, parseFloat((next[k] - 0.1).toFixed(1)));
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Main Canvas Game Loop
  useEffect(() => {
    let animId: number;

    const gameLoop = (currentTime: number) => {
      const dt = Math.min(0.05, (currentTime - lastTimeRef.current) / 1000);
      lastTimeRef.current = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Process Player Movement (Owner Rule: +5% base speed per level up to 20)
      const speedMult = 1 + Math.min(19, playerLevel - 1) * 0.05;
      const moveSpeed = hero.baseStats.speed * 180 * speedMult * dt;

      let mx = 0;
      let my = 0;
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp'] || keysRef.current['w']) my -= 1;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown'] || keysRef.current['s']) my += 1;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft'] || keysRef.current['a']) mx -= 1;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight'] || keysRef.current['d']) mx += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        playerPosRef.current.x = Math.max(35, Math.min(765, playerPosRef.current.x + (mx / len) * moveSpeed));
        playerPosRef.current.y = Math.max(35, Math.min(565, playerPosRef.current.y + (my / len) * moveSpeed));

        // Determine 8-direction facing
        if (mx > 0 && my === 0) setPlayerDirection('right');
        else if (mx < 0 && my === 0) setPlayerDirection('left');
        else if (mx === 0 && my > 0) setPlayerDirection('down');
        else if (mx === 0 && my < 0) setPlayerDirection('up');
        else if (mx > 0 && my > 0) setPlayerDirection('down-right');
        else if (mx < 0 && my > 0) setPlayerDirection('down-left');
        else if (mx > 0 && my < 0) setPlayerDirection('up-right');
        else if (mx < 0 && my < 0) setPlayerDirection('up-left');
      }

      // 2. Ki Regeneration
      setPlayerKi((prev) => Math.min(hero.baseStats.ki, prev + hero.baseStats.kiRegen * dt));

      // 3. Update Projectiles
      const remainingProjectiles: Projectile[] = [];
      projectilesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.duration -= 1;

        let hit = false;
        // Collision against monsters
        monstersRef.current.forEach((m) => {
          if (m.state === 'dead' || hit) return;
          const dist = Math.hypot(m.x - p.x, m.y - p.y);
          if (dist < p.radius + 24) {
            hit = true;
            const actualDamage = Math.max(1, p.damage - Math.floor(m.def * 0.3));
            m.currentHp -= actualDamage;

            floatingTextsRef.current.push({
              id: Math.random().toString(),
              x: m.x + (Math.random() * 20 - 10),
              y: m.y - 15,
              text: `-${actualDamage}`,
              color: '#f87171',
              alpha: 1,
              time: 0,
            });

            if (m.currentHp <= 0) {
              m.state = 'dead';
              addLog(`Defeated ${m.name}! Gained +${m.xp} XP`, 'kill');

              // Reward XP
              setPlayerXp((currXp) => {
                const nextXp = currXp + m.xp;
                if (nextXp >= xpNeeded && playerLevel < 20) {
                  setPlayerLevel((lvl) => lvl + 1);
                  setPlayerHp(hero.baseStats.hp + playerLevel * 10);
                  addLog(`★ LEVEL UP! Reached Level ${playerLevel + 1}! (+5% Speed, +HP)`, 'level');
                  return nextXp - xpNeeded;
                }
                return nextXp;
              });
            }
          }
        });

        if (!hit && p.duration > 0 && p.x >= 0 && p.x <= 800 && p.y >= 0 && p.y <= 600) {
          remainingProjectiles.push(p);
        }
      });
      projectilesRef.current = remainingProjectiles;

      // 4. Update Monsters (AI Logic)
      const px = playerPosRef.current.x;
      const py = playerPosRef.current.y;

      monstersRef.current.forEach((m) => {
        if (m.state === 'dead') return;

        const distToPlayer = Math.hypot(px - m.x, py - m.y);

        if (distToPlayer <= m.agro) {
          m.state = 'chase';
          // Move towards player if outside range
          if (distToPlayer > m.range) {
            const dx = (px - m.x) / distToPlayer;
            const dy = (py - m.y) / distToPlayer;
            m.x += dx * m.speed * 60 * dt;
            m.y += dy * m.speed * 60 * dt;
          } else {
            // In attack range
            if (currentTime - m.lastAttackTime > 1200) {
              m.lastAttackTime = currentTime;
              const dmg = Math.max(1, Math.round(m.atk - hero.baseStats.def * 0.4));
              setPlayerHp((prev) => Math.max(0, prev - dmg));
              addLog(`${m.name} struck for ${dmg} damage!`, 'damage');

              floatingTextsRef.current.push({
                id: Math.random().toString(),
                x: px + (Math.random() * 20 - 10),
                y: py - 20,
                text: `-${dmg}`,
                color: '#ef4444',
                alpha: 1,
                time: 0,
              });
            }
          }
        } else {
          m.state = 'idle';
        }
      });

      // Filter out dead monsters after brief delay
      monstersRef.current = monstersRef.current.filter((m) => m.state !== 'dead' || m.currentHp > 0);

      // 5. Render Scene
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Arena Background
      ctx.fillStyle = '#141e17';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid / Ground pattern
      ctx.strokeStyle = '#1e3325';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Arena Boundary
      ctx.strokeStyle = '#2d5a3c';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Render Monsters
      monstersRef.current.forEach((m) => {
        if (m.state === 'dead') return;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(m.x, m.y + 16, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Monster Body
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff80';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Agro ring indicator
        if (m.state === 'chase') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.range, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Monster Name & HP Bar
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(m.name, m.x, m.y - 24);

        // HP Bar
        const barWidth = 36;
        const hpPct = Math.max(0, m.currentHp / m.maxHp);
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(m.x - barWidth / 2, m.y - 20, barWidth, 4);
        ctx.fillStyle = hpPct > 0.4 ? '#ef4444' : '#dc2626';
        ctx.fillRect(m.x - barWidth / 2, m.y - 20, barWidth * hpPct, 4);
      });

      // Render Player
      const pimg = heroImgCacheRef.current[playerDirection];
      // Player Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(px, py + 22, 22, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      if (pimg && pimg.complete && pimg.naturalWidth > 0) {
        // Draw real sprite
        const spriteSize = 72;
        ctx.drawImage(pimg, px - spriteSize / 2, py - spriteSize / 2 - 8, spriteSize, spriteSize);
      } else {
        // Fallback circle
        ctx.fillStyle = hero.accentColor;
        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player Direction Indicator
      ctx.strokeStyle = hero.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.stroke();

      // Render Projectiles
      projectilesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Render Floating Texts
      const nextTexts: FloatingText[] = [];
      floatingTextsRef.current.forEach((t) => {
        t.y -= 0.6;
        t.alpha -= 0.02;
        if (t.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, t.alpha);
          ctx.fillStyle = t.color;
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(t.text, t.x, t.y);
          ctx.restore();
          nextTexts.push(t);
        }
      });
      floatingTextsRef.current = nextTexts;

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [hero, playerLevel]);

  return (
    <div className="space-y-6 text-stone-100">
      {/* Header Bar */}
      <div className="border-b border-stone-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
            <Swords className="w-4 h-4" />
            Stage 2 Authorized Local PvE Ground
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            Combat Sandbox & PvE Arena
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            Real-time combat mathematics, 8-directional movement, Ki abilities, and bestiary AI engagement.
          </p>
        </div>

        {/* Hero Selector Quick Buttons */}
        <div className="flex items-center gap-2 bg-stone-900 p-1 rounded-xl border border-stone-800">
          {HERO_RACES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedHeroId(r.id);
                setPlayerHp(r.baseStats.hp);
                setPlayerKi(r.baseStats.ki);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedHeroId === r.id
                  ? 'bg-stone-800 text-white shadow-sm ring-1 ring-emerald-500/50'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Play Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Canvas & Controls Container */}
        <div className="lg:col-span-8 bg-stone-900/60 border border-stone-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
          {/* Top HUD Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-950 p-4 rounded-xl border border-stone-800">
            {/* Level & XP */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="font-bold text-amber-400">Level {playerLevel}</span>
                <span className="text-stone-400">{playerXp} / {xpNeeded} XP</span>
              </div>
              <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (playerXp / xpNeeded) * 100)}%` }}
                />
              </div>
            </div>

            {/* Health Bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="flex items-center gap-1 font-bold text-rose-400">
                  <Heart className="w-3.5 h-3.5" /> HP
                </span>
                <span className="text-stone-300">{Math.round(playerHp)} / {hero.baseStats.hp + (playerLevel - 1) * 10}</span>
              </div>
              <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(0, (playerHp / (hero.baseStats.hp + (playerLevel - 1) * 10))) * 100}%` }}
                />
              </div>
            </div>

            {/* Ki Energy Bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="flex items-center gap-1 font-bold text-cyan-400">
                  <Zap className="w-3.5 h-3.5" /> KI
                </span>
                <span className="text-stone-300">{Math.round(playerKi)} / {hero.baseStats.ki}</span>
              </div>
              <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-100"
                  style={{ width: `${Math.max(0, (playerKi / hero.baseStats.ki)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="relative rounded-xl overflow-hidden border border-stone-700/80 shadow-2xl bg-stone-950">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="w-full aspect-[8/5] block cursor-crosshair"
              onClick={triggerBasicAttack}
            />

            {/* Quick Controls Overlay */}
            <div className="absolute bottom-3 left-3 bg-stone-950/80 backdrop-blur-sm border border-stone-800 px-3 py-1.5 rounded-lg text-[11px] font-mono text-stone-300 pointer-events-none">
              WASD/Arrows to move • Click/Space to attack • Q/E/R for Ki skills
            </div>

            <div className="absolute top-3 right-3 bg-stone-950/80 backdrop-blur-sm border border-stone-800 px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400">
              Speed: +{Math.round((playerLevel - 1) * 5)}% ({hero.baseStats.speed * (1 + (playerLevel - 1) * 0.05)}x)
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              onClick={triggerBasicAttack}
              className="py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <div className="flex items-center gap-1 text-white">
                <Swords className="w-4 h-4 text-amber-400" />
                <span>Basic Attack</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">[SPACE / CLICK]</span>
            </button>

            {hero.skills.map((s) => {
              const cd = cooldowns[s.key] || 0;
              const hasKi = playerKi >= s.cost;
              return (
                <button
                  key={s.key}
                  onClick={() => triggerSkill(s.key as any)}
                  disabled={cd > 0 || !hasKi}
                  className={`py-3 px-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    cd > 0 || !hasKi
                      ? 'bg-stone-950/80 border-stone-850 text-stone-500 cursor-not-allowed'
                      : 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-700/60 text-white active:scale-95'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-stone-800 text-[10px] flex items-center justify-center font-mono">
                      {s.key}
                    </span>
                    <span className="truncate">{s.name}</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {cd > 0 ? `${cd}s CD` : `${s.cost} Ki`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Spawner & Combat Log */}
        <div className="lg:col-span-4 space-y-6">
          {/* Monster Spawner Tool */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Bestiary Monster Spawner
            </h4>

            <div className="space-y-2">
              <label className="text-xs text-stone-300 font-medium block">
                Select from 40 Bestiary Entities:
              </label>
              <select
                value={selectedSpawnMonsterId}
                onChange={(e) => setSelectedSpawnMonsterId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {MONSTERS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-stone-900">
                    [{m.world.toUpperCase()}] Lv.{m.level} {m.name} ({m.stats.hp} HP)
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const m = MONSTERS.find((item) => item.id === selectedSpawnMonsterId);
                  if (m) spawnMonster(m);
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Spawn Selected Monster
              </button>
            </div>

            <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 font-mono">
              <span>Active in Arena:</span>
              <span className="font-bold text-white">{monstersRef.current.length}</span>
            </div>

            <button
              onClick={() => {
                monstersRef.current = [];
                addLog('Cleared all arena monsters', 'info');
              }}
              className="w-full py-1.5 rounded-lg text-xs text-stone-400 hover:text-rose-300 hover:bg-stone-800/40 transition-colors"
            >
              Clear Arena
            </button>
          </div>

          {/* Combat Log */}
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Live Combat Event Log
              </h4>
              <button
                onClick={() => setCombatLog([])}
                className="text-[11px] text-stone-500 hover:text-stone-300 font-mono"
              >
                Clear
              </button>
            </div>

            <div className="h-[220px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
              {combatLog.length === 0 ? (
                <div className="text-stone-500 text-center py-8 italic">
                  Move into the arena and battle beasts to generate combat logs.
                </div>
              ) : (
                combatLog.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded-lg border text-left ${
                      log.type === 'kill'
                        ? 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                        : log.type === 'level'
                        ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 font-bold'
                        : log.type === 'damage'
                        ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                        : 'bg-stone-950/40 border-stone-850 text-stone-300'
                    }`}
                  >
                    <span className="text-stone-500 mr-2">[{log.time}]</span>
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
