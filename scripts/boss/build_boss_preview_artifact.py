import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = Path(r"C:\Users\maki5\.gemini\antigravity\brain\d8f62331-f91e-4606-965b-c7c104fec35b")

char_b64 = base64.b64encode((ROOT / "art" / "production" / "boss_preview_char.png").read_bytes()).decode("ascii")
shadow_b64 = base64.b64encode((ROOT / "art" / "production" / "boss_preview_shadow.png").read_bytes()).decode("ascii")

html_content = f"""<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Próba Animacji Bossa — Astralny Władca</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @keyframes pulseGlow {{
      0%, 100% {{ filter: drop-shadow(0 0 15px rgba(0, 220, 255, 0.4)); }}
      50% {{ filter: drop-shadow(0 0 35px rgba(0, 240, 255, 0.8)); }}
    }}
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-3 select-none">
  <div class="max-w-4xl mx-auto bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl backdrop-blur-md">
    
    <!-- Header -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-[var(--border)] gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-900/40 text-cyan-400 border border-cyan-500/40">
            ★ BOSS AKTU FABULARNEGO
          </span>
          <span class="text-xs text-[var(--muted-foreground)]">Archetyp: Hover / Celestial</span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 mt-1">
          Astralny Władca Siedmiu Oktaw (Aurelith)
        </h1>
        <p class="text-xs text-[var(--muted-foreground)]">
          Próba animacji proceduralnej 60 FPS z dynamicznym rdzeniem gwiazdy, pierścieniami orbitalnymi i reakcją na otoczenie.
        </p>
      </div>
      
      <!-- Stats quick badge -->
      <div class="flex items-center gap-3 bg-[var(--background)]/60 px-3 py-2 rounded-xl border border-[var(--border)] text-xs">
        <div>
          <span class="text-red-400 font-bold">HP:</span> 85,000
        </div>
        <div class="w-px h-4 bg-[var(--border)]"></div>
        <div>
          <span class="text-cyan-400 font-bold">KI:</span> 40,000
        </div>
        <div class="w-px h-4 bg-[var(--border)]"></div>
        <div>
          <span class="text-amber-400 font-bold">Ranga:</span> S-Tier
        </div>
      </div>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
      
      <!-- Canvas Viewport (Left/Center) -->
      <div class="lg:col-span-8 flex flex-col items-center">
        <div id="viewport-container" class="relative w-full aspect-[4/5] max-w-[500px] rounded-xl overflow-hidden border border-[var(--border)] shadow-inner transition-colors duration-500 flex items-center justify-center bg-slate-950">
          <canvas id="boss-canvas" width="500" height="600" class="w-full h-full object-contain cursor-crosshair"></canvas>
          
          <!-- Live FPS and state badge overlay -->
          <div class="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono border border-white/10">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="fps-display" class="text-emerald-300">60 FPS</span>
            <span class="text-slate-400">|</span>
            <span id="state-display" class="text-cyan-300">LEWITACJA</span>
          </div>

          <div class="absolute bottom-3 right-3 text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded backdrop-blur">
            Najedź kursorem, by sterować spojrzeniem
          </div>
        </div>
      </div>

      <!-- Controls & Inspector (Right) -->
      <div class="lg:col-span-4 flex flex-col gap-4">
        
        <!-- Animation State Selector -->
        <div class="bg-[var(--background)]/70 p-3.5 rounded-xl border border-[var(--border)]">
          <label class="block text-xs font-semibold text-[var(--foreground)] mb-2 uppercase tracking-wider">
            Stan Animacji Bossa
          </label>
          <div class="grid grid-cols-1 gap-2">
            <button id="btn-idle" onclick="setMode('idle')" class="w-full py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex items-center justify-between bg-cyan-950/60 border-cyan-500/60 text-cyan-300 shadow-sm">
              <span>🌌 1. Lewitacja (Idle Hover)</span>
              <span class="text-[10px] opacity-70">Spokój</span>
            </button>
            <button id="btn-pulse" onclick="setMode('pulse')" class="w-full py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex items-center justify-between bg-transparent border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)]">
              <span>⚡ 2. Puls Rdzenia (Overdrive)</span>
              <span class="text-[10px] opacity-70">Szarża</span>
            </button>
            <button id="btn-supernova" onclick="setMode('supernova')" class="w-full py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex items-center justify-between bg-transparent border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)]">
              <span>💥 3. Wybuch Gwiazdy (Supernova)</span>
              <span class="text-[10px] opacity-70">Atak</span>
            </button>
          </div>
        </div>

        <!-- Layer Toggles -->
        <div class="bg-[var(--background)]/70 p-3.5 rounded-xl border border-[var(--border)]">
          <label class="block text-xs font-semibold text-[var(--foreground)] mb-2 uppercase tracking-wider">
            Warstwy i Efekty Wizualne
          </label>
          <div class="space-y-2 text-xs">
            <label class="flex items-center gap-2 cursor-pointer hover:text-cyan-300">
              <input type="checkbox" id="chk-rings" checked class="rounded border-[var(--border)] text-cyan-500 focus:ring-0">
              <span>Pierścienie orbitalne 3D (Sigil Rings)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:text-cyan-300">
              <input type="checkbox" id="chk-core" checked class="rounded border-[var(--border)] text-cyan-500 focus:ring-0">
              <span>Dynamiczny rdzeń gwiezdny (Star Core)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:text-cyan-300">
              <input type="checkbox" id="chk-particles" checked class="rounded border-[var(--border)] text-cyan-500 focus:ring-0">
              <span>Cząsteczki gwiezdnego pyłu (Embers)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:text-cyan-300">
              <input type="checkbox" id="chk-shadow" checked class="rounded border-[var(--border)] text-cyan-500 focus:ring-0">
              <span>Reaktywny cień podłoża (Ground Shadow)</span>
            </label>
          </div>
        </div>

        <!-- Environment Background -->
        <div class="bg-[var(--background)]/70 p-3.5 rounded-xl border border-[var(--border)]">
          <label class="block text-xs font-semibold text-[var(--foreground)] mb-2 uppercase tracking-wider">
            Środowisko Tła Podglądu
          </label>
          <div class="grid grid-cols-2 gap-1.5 text-xs">
            <button onclick="setBg('nebula')" class="py-1.5 px-2 rounded bg-slate-900 text-cyan-300 border border-cyan-800/40 text-center font-medium">Kosmos</button>
            <button onclick="setBg('arena')" class="py-1.5 px-2 rounded bg-stone-900 text-amber-200 border border-stone-700/40 text-center font-medium">Arena</button>
            <button onclick="setBg('grid')" class="py-1.5 px-2 rounded bg-slate-900 text-slate-300 border border-slate-700/40 text-center font-medium">Siatka UI</button>
            <button onclick="setBg('transparent')" class="py-1.5 px-2 rounded bg-black/40 text-slate-400 border border-slate-700/40 text-center font-medium">Przezroczyste</button>
          </div>
        </div>

        <!-- Speed Slider -->
        <div class="bg-[var(--background)]/70 p-3.5 rounded-xl border border-[var(--border)]">
          <div class="flex justify-between items-center mb-1 text-xs">
            <span class="font-semibold uppercase tracking-wider">Szybkość Animacji</span>
            <span id="speed-label" class="font-mono text-cyan-400">1.0x</span>
          </div>
          <input type="range" id="speed-slider" min="0.2" max="2.5" step="0.1" value="1.0" class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400" oninput="updateSpeed(this.value)">
        </div>

      </div>

    </div>

    <!-- Loot & Game Specs Footer -->
    <div class="mt-5 pt-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div class="p-2.5 rounded-lg bg-[var(--background)]/50 border border-[var(--border)]">
        <span class="text-[var(--muted-foreground)] block">Przypisany Region / Akt:</span>
        <span class="font-medium text-[var(--foreground)]">Akt IV — Płaskowyż Siedmiu Oktaw</span>
      </div>
      <div class="p-2.5 rounded-lg bg-[var(--background)]/50 border border-[var(--border)]">
        <span class="text-[var(--muted-foreground)] block">Główny Łup (Drop):</span>
        <span class="font-medium text-amber-300">U-W08 Korona Gwiazd Oceanu, K-10</span>
      </div>
      <div class="p-2.5 rounded-lg bg-[var(--background)]/50 border border-[var(--border)]">
        <span class="text-[var(--muted-foreground)] block">Gotowe Pliki Silnika:</span>
        <span class="font-medium text-emerald-400">WebP (60 FPS), GIF, SpriteSheet</span>
      </div>
    </div>

  </div>

  <script>
    // Embedded Cutout Assets as Base64 Data URIs
    const CHAR_B64 = "data:image/png;base64,{char_b64}";
    const SHADOW_B64 = "data:image/png;base64,{shadow_b64}";

    const canvas = document.getElementById('boss-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('viewport-container');

    const charImg = new Image();
    charImg.src = CHAR_B64;
    const shadowImg = new Image();
    shadowImg.src = SHADOW_B64;

    let animTime = 0;
    let animSpeed = 1.0;
    let currentMode = 'idle'; // idle, pulse, supernova
    let bgMode = 'nebula';

    let mouseX = 250, mouseY = 250;
    let targetTiltX = 0, currentTiltX = 0;

    canvas.addEventListener('mousemove', (e) => {{
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mouseX = (e.clientX - rect.left) * scaleX;
      mouseY = (e.clientY - rect.top) * scaleY;
      targetTiltX = (mouseX - 250) / 250.0;
    }});

    canvas.addEventListener('mouseleave', () => {{
      targetTiltX = 0;
    }});

    function setMode(mode) {{
      currentMode = mode;
      document.getElementById('state-display').innerText = 
        mode === 'idle' ? 'LEWITACJA' : mode === 'pulse' ? 'PULS RDZENIA' : 'SUPERNOVA';
      
      const buttons = {{
        idle: document.getElementById('btn-idle'),
        pulse: document.getElementById('btn-pulse'),
        supernova: document.getElementById('btn-supernova'),
      }};

      Object.entries(buttons).forEach(([k, btn]) => {{
        if (k === mode) {{
          btn.className = "w-full py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex items-center justify-between bg-cyan-950/60 border-cyan-500/60 text-cyan-300 shadow-sm";
        }} else {{
          btn.className = "w-full py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex items-center justify-between bg-transparent border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)]";
        }}
      }});
    }}

    function setBg(bg) {{
      bgMode = bg;
      if (bg === 'nebula') {{
        container.style.backgroundColor = '#030712';
      }} else if (bg === 'arena') {{
        container.style.backgroundColor = '#1c1917';
      }} else if (bg === 'grid') {{
        container.style.backgroundColor = '#0f172a';
      }} else {{
        container.style.backgroundColor = 'transparent';
      }}
    }}

    function updateSpeed(val) {{
      animSpeed = parseFloat(val);
      document.getElementById('speed-label').innerText = animSpeed.toFixed(1) + 'x';
    }}

    // Particles array
    const particles = [];
    for (let i = 0; i < 40; i++) {{
      particles.push({{
        x: 250 + (Math.random() - 0.5) * 220,
        y: 150 + Math.random() * 350,
        speed: 0.8 + Math.random() * 1.6,
        size: 1.5 + Math.random() * 3,
        alpha: Math.random(),
        seed: Math.random() * 100,
        color: Math.random() > 0.4 ? 'cyan' : 'gold'
      }});
    }}

    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    function render(now) {{
      const dt = (now - lastFrameTime) / 1000.0;
      lastFrameTime = now;

      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {{
        document.getElementById('fps-display').innerText = Math.round(frameCount / fpsTimer) + ' FPS';
        frameCount = 0;
        fpsTimer = 0;
      }}

      animTime += dt * animSpeed;
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background ambient drawing
      if (bgMode === 'nebula') {{
        const bgGrad = ctx.createRadialGradient(250, 260, 50, 250, 260, 280);
        bgGrad.addColorStop(0, 'rgba(15, 30, 65, 0.55)');
        bgGrad.addColorStop(0.5, 'rgba(10, 15, 35, 0.35)');
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }} else if (bgMode === 'arena') {{
        ctx.strokeStyle = 'rgba(215, 140, 60, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(250, 520, 200, 60, 0, 0, Math.PI * 2);
        ctx.stroke();
      }} else if (bgMode === 'grid') {{
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 30) {{
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }}
        for (let y = 0; y < canvas.height; y += 30) {{
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }}
      }}

      // Hover physics
      const hoverAmp = currentMode === 'supernova' ? 22 : currentMode === 'pulse' ? 18 : 14;
      const hoverFreq = currentMode === 'supernova' ? 4 : currentMode === 'pulse' ? 3 : 2;
      const hoverY = -hoverAmp * Math.sin(animTime * hoverFreq);
      const bossY = 250 + hoverY;

      const breathScaleX = 1.0 - 0.018 * Math.cos(animTime * 2);
      const breathScaleY = 1.0 + 0.022 * Math.cos(animTime * 2);

      const chkShadow = document.getElementById('chk-shadow').checked;
      const chkRings = document.getElementById('chk-rings').checked;
      const chkCore = document.getElementById('chk-core').checked;
      const chkParticles = document.getElementById('chk-particles').checked;

      // 1. Ground Shadow
      if (chkShadow && shadowImg.complete) {{
        const sDist = (hoverY / hoverAmp);
        const sScale = 1.0 - sDist * 0.15;
        const sAlpha = Math.max(0.2, 0.75 - sDist * 0.2);
        const sw = 214 * sScale;
        const sh = 13 * sScale;
        ctx.save();
        ctx.globalAlpha = sAlpha;
        ctx.drawImage(shadowImg, 250 - sw / 2, 515 - sh / 2, sw, sh);
        ctx.restore();
      }}

      // 2. Halo / Back Glow
      const haloGrad = ctx.createRadialGradient(250, bossY - 80, 20, 250, bossY - 80, 160);
      haloGrad.addColorStop(0, 'rgba(80, 200, 255, 0.35)');
      haloGrad.addColorStop(0.6, 'rgba(30, 80, 220, 0.15)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(250, bossY - 80, 160, 0, Math.PI * 2);
      ctx.fill();

      // 3. Back half of 3D Orbital Sigil Ring
      const ringY = bossY + 25;
      const rx = 175;
      const ry = 42;
      const ringAngle = animTime * 1.5;

      if (chkRings) {{
        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(70, 180, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(250, ringY, rx, ry, 0, Math.PI, Math.PI * 2); // back half
        ctx.stroke();

        // Orbital nodes in back
        for (let i = 0; i < 4; i++) {{
          const ang = ringAngle + i * (Math.PI / 2);
          if (Math.sin(ang) < 0) {{
            const nx = 250 + Math.cos(ang) * rx;
            const ny = ringY + Math.sin(ang) * ry;
            ctx.fillStyle = 'rgba(160, 230, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(nx, ny, 5, 0, Math.PI * 2);
            ctx.fill();
          }}
        }}
        ctx.restore();
      }}

      // 4. Character Sprite
      if (charImg.complete) {{
        ctx.save();
        ctx.translate(250, bossY);
        ctx.rotate(currentTiltX * 0.05);
        ctx.scale(breathScaleX, breathScaleY);
        ctx.drawImage(charImg, -199, -226, 399, 452);
        ctx.restore();
      }}

      // 5. Front half of 3D Orbital Sigil Ring
      if (chkRings) {{
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(100, 225, 255, 0.85)';
        ctx.shadowColor = 'rgba(0, 220, 255, 0.9)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(250, ringY, rx, ry, 0, 0, Math.PI); // front half
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.ellipse(250, ringY, rx - 1, ry - 1, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();

        // Orbital nodes in front
        for (let i = 0; i < 4; i++) {{
          const ang = ringAngle + i * (Math.PI / 2);
          if (Math.sin(ang) >= 0) {{
            const nx = 250 + Math.cos(ang) * rx;
            const ny = ringY + Math.sin(ang) * ry;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(nx, ny, 8, 0, Math.PI * 2);
            ctx.fill();
          }}
        }}
        ctx.restore();
      }}

      // 6. Chest Star Core Pulsation & Rays
      if (chkCore) {{
        const coreX = 250 + currentTiltX * 6;
        const coreY = bossY - 70;
        const corePulse = currentMode === 'supernova'
          ? 1.6 + 0.4 * Math.sin(animTime * 12)
          : currentMode === 'pulse'
          ? 1.25 + 0.25 * Math.sin(animTime * 8)
          : 1.0 + 0.15 * Math.sin(animTime * 5);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Radiant starburst rays
        const rayLen = 45 * corePulse;
        ctx.lineWidth = 4 * corePulse;
        ctx.strokeStyle = currentMode === 'supernova' ? 'rgba(255, 220, 100, 0.9)' : 'rgba(255, 245, 180, 0.75)';
        for (let r_ang = 0; r_ang < Math.PI; r_ang += Math.PI / 4) {{
          const a = r_ang + animTime * 0.3;
          ctx.beginPath();
          ctx.moveTo(coreX - Math.cos(a) * rayLen, coreY - Math.sin(a) * rayLen);
          ctx.lineTo(coreX + Math.cos(a) * rayLen, coreY + Math.sin(a) * rayLen);
          ctx.stroke();
        }}

        // Central blinding orb
        const radGrad = ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, 28 * corePulse);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.3, 'rgba(255, 230, 120, 0.95)');
        radGrad.addColorStop(0.7, 'rgba(255, 120, 40, 0.6)');
        radGrad.addColorStop(1, 'rgba(255, 50, 20, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(coreX, coreY, 28 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }}

      // 7. Rising Cosmic Particles
      if (chkParticles) {{
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach((p) => {{
          p.y -= p.speed * animSpeed;
          p.x += Math.sin(animTime * 2 + p.seed) * 0.6;
          if (p.y < 80) {{
            p.y = 500;
            p.x = 250 + (Math.random() - 0.5) * 200;
          }}
          const pLife = Math.sin((p.y - 80) / 420 * Math.PI);
          ctx.fillStyle = p.color === 'cyan'
            ? `rgba(80, 220, 255, ${{pLife * 0.8}})`
            : `rgba(255, 215, 120, ${{pLife * 0.85}})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }});
        ctx.restore();
      }}

      requestAnimationFrame(render);
    }}

    requestAnimationFrame(render);
  </script>
</body>
</html>
"""

out_file = ARTIFACT_DIR / "boss_preview.html"
out_file.write_text(html_content, encoding="utf-8")
print(f"Generated {out_file} ({len(html_content)} chars)")
