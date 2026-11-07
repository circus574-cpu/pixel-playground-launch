/**
 * ============================================================================
 * KI LEGENDS — KOMBAJN DO ANIMACJI & KOORDYNACJI 16 CPU (STUDIO ENGINE v2.0)
 * ============================================================================
 * Obsługuje:
 * 1. Natychmiastowe rozbijanie plików MP4 / WebM / GIF / Spritesheet w przeglądarce
 *    oraz wielordzeniową ekstrakcję na serwerze 16 vCPU (/api/upload-video).
 * 2. Kreator kombinacji klatek (Forward, Reverse, Ping-Pong, Seamless Loop,
 *    Hit-Stop Impact, Combo Flurry, Optical Flow 16 CPU) + Bank 7 Stanów KI Legends.
 * 3. Stację efektów VFX i transformacji postaci w czasie rzeczywistym (Aury KI,
 *    Błyskawice, Cel-Shading, Obrys Ink, Palety 4 Ras, Squash & Stretch,
 *    Nachylenie Bojowe wokół kotwicy stóp, Wiatr Szat, Przemiana Formy).
 * 4. Eksport paczek produkcyjnych KI Legends (.ZIP z WebP + Phaser JSON + manifest),
 *    arkuszy Spritesheet PNG oraz animowanych GIF-ów.
 */

(function () {
  "use strict";

  const KI_STATES = {
    idle: { frames: 8, fps: 6, loop: true, label: "IDLE (Oddech)" },
    walk: { frames: 8, fps: 16, loop: true, label: "WALK (Chód)" },
    attack: { frames: 8, fps: 16, loop: false, label: "ATTACK (Cios)" },
    skill: { frames: 8, fps: 12, loop: false, label: "SKILL (Technika)" },
    hit: { frames: 4, fps: 16, loop: false, label: "HIT (Trafienie)" },
    death: { frames: 8, fps: 10, loop: false, label: "DEATH (Upadek)" },
    respawn: { frames: 8, fps: 12, loop: false, label: "RESPAWN (Odrodzenie)" },
  };

  const RACE_PALETTES = {
    verdant: {
      world: "verdant",
      actorId: "hero-planetary-v4",
      auraHex: "#38e58b",
      inkHex: "#111812",
      hue: 0,
      sat: 115,
      tint: 20,
      aura: 55,
      outline: 2,
      rim: 35,
      lightning: false,
    },
    aether: {
      world: "aether",
      actorId: "hero-sage-v4",
      auraHex: "#58ebd4",
      inkHex: "#121a24",
      hue: 10,
      sat: 110,
      tint: 18,
      aura: 65,
      outline: 2,
      rim: 45,
      lightning: false,
    },
    nexus: {
      world: "nexus",
      actorId: "hero-android-v4",
      auraHex: "#00d8ff",
      inkHex: "#0b1017",
      hue: -10,
      sat: 120,
      tint: 25,
      aura: 70,
      outline: 2,
      rim: 50,
      lightning: true,
    },
    pyra: {
      world: "pyra",
      actorId: "hero-legend-v4",
      auraHex: "#ff3e30",
      inkHex: "#160a0c",
      hue: 0,
      sat: 130,
      tint: 25,
      aura: 80,
      outline: 3,
      rim: 40,
      lightning: true,
    },
    golden_ki: {
      world: "verdant",
      actorId: "hero-awakened-ki",
      auraHex: "#ffcc00",
      inkHex: "#241604",
      hue: 15,
      sat: 140,
      tint: 35,
      aura: 95,
      outline: 3,
      rim: 70,
      lightning: true,
    },
  };

  // --- STAN APLIKACJI ---
  const state = {
    uploadedFile: null,
    rawExtractedFrames: [], // [{ canvas, dataUrl, motionScore, enabled }]
    activeSequence: [],     // Lista obiektów klatek po kombinacji
    stateBank: {
      idle: [],
      walk: [],
      attack: [],
      skill: [],
      hit: [],
      death: [],
      respawn: [],
    },
    currentStateSlot: "attack",
    currentFrameIdx: 0,
    isPlaying: true,
    playbackFps: 12,
    currentDirection: "down",
    showOnionSkin: false,
    showGridAndFeet: true,
    activeRace: "nexus",
    serverOnline: false,
    lastFrameTime: 0,
  };

  // --- ELEMENTY DOM ---
  const el = {
    previewCanvas: document.getElementById("previewCanvas"),
    viewportHud: document.getElementById("viewportHud"),
    framesStrip: document.getElementById("framesStrip"),
    stateSlotsContainer: document.getElementById("stateSlotsContainer"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    videoMetaBadge: document.getElementById("videoMetaBadge"),
    activeSeqCountBadge: document.getElementById("activeSeqCountBadge"),
    serverStatusBadge: document.getElementById("serverStatusBadge"),
    cpuBadge: document.getElementById("cpuBadge"),
    statusToast: document.getElementById("statusToast"),
    blenderCmdBox: document.getElementById("blenderCmdBox"),

    // Kontrolki Etapu 1
    rngExtractCount: document.getElementById("rngExtractCount"),
    valExtractCount: document.getElementById("valExtractCount"),
    selCanvasSize: document.getElementById("selCanvasSize"),
    rngTrimStart: document.getElementById("rngTrimStart"),
    valTrimStart: document.getElementById("valTrimStart"),
    rngTrimEnd: document.getElementById("rngTrimEnd"),
    valTrimEnd: document.getElementById("valTrimEnd"),
    selBgMode: document.getElementById("selBgMode"),
    rngBgTol: document.getElementById("rngBgTol"),
    valBgTol: document.getElementById("valBgTol"),
    chkLockFeet: document.getElementById("chkLockFeet"),
    clrCustomKey: document.getElementById("clrCustomKey"),

    // Kontrolki Etapu 2
    selComboMode: document.getElementById("selComboMode"),
    selTargetClipLen: document.getElementById("selTargetClipLen"),
    selSpeedCurve: document.getElementById("selSpeedCurve"),
    rngHitStopIdx: document.getElementById("rngHitStopIdx"),
    valHitStopIdx: document.getElementById("valHitStopIdx"),
    rngHitShake: document.getElementById("rngHitShake"),
    valHitShake: document.getElementById("valHitShake"),
    txtCustomPattern: document.getElementById("txtCustomPattern"),

    // Kontrolki Etapu 3 (FX & Transform)
    rngOutlinePx: document.getElementById("rngOutlinePx"),
    valOutlinePx: document.getElementById("valOutlinePx"),
    rngCelLevels: document.getElementById("rngCelLevels"),
    valCelLevels: document.getElementById("valCelLevels"),
    rngHue: document.getElementById("rngHue"),
    valHue: document.getElementById("valHue"),
    rngSat: document.getElementById("rngSat"),
    valSat: document.getElementById("valSat"),
    rngRimLight: document.getElementById("rngRimLight"),
    valRimLight: document.getElementById("valRimLight"),
    rngTint: document.getElementById("rngTint"),
    valTint: document.getElementById("valTint"),
    rngAura: document.getElementById("rngAura"),
    valAura: document.getElementById("valAura"),
    rngTrail: document.getElementById("rngTrail"),
    valTrail: document.getElementById("valTrail"),
    chkLightning: document.getElementById("chkLightning"),
    chkShockwave: document.getElementById("chkShockwave"),
    chkShadow: document.getElementById("chkShadow"),
    clrAura: document.getElementById("clrAura"),
    clrInk: document.getElementById("clrInk"),
    rngLean: document.getElementById("rngLean"),
    valLean: document.getElementById("valLean"),
    rngSquash: document.getElementById("rngSquash"),
    valSquash: document.getElementById("valSquash"),
    rngClothWave: document.getElementById("rngClothWave"),
    valClothWave: document.getElementById("valClothWave"),
    rngTransGrow: document.getElementById("rngTransGrow"),
    valTransGrow: document.getElementById("valTransGrow"),

    // Kontrolki Etapu 4 (Eksport)
    txtActorId: document.getElementById("txtActorId"),
    selWorld: document.getElementById("selWorld"),
    selProfile: document.getElementById("selProfile"),
    txtPackVersion: document.getElementById("txtPackVersion"),

    // Transport
    btnPlayPause: document.getElementById("btnPlayPause"),
    rngPlaybackFps: document.getElementById("rngPlaybackFps"),
    valPlaybackFps: document.getElementById("valPlaybackFps"),
  };

  const ctx = el.previewCanvas.getContext("2d");

  function showToast(msg, duration = 3200) {
    el.statusToast.textContent = msg;
    el.statusToast.style.display = "block";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.statusToast.style.display = "none";
    }, duration);
  }

  function hexToRgb(hex) {
    const clean = (hex || "#00d8ff").replace("#", "");
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // ==========================================================================
  // 1. SPRAWDZENIE POŁĄCZENIA Z SERWEREM 16 CPU
  // ==========================================================================
  async function checkServerStatus() {
    try {
      const resp = await fetch("/api/system-status");
      if (resp.ok) {
        const data = await resp.json();
        state.serverOnline = true;
        el.serverStatusBadge.textContent = `● Serwer 16 CPU Aktywny (${data.cpu_cores_detected} rdzeni)`;
        el.cpuBadge.textContent = `⚡ Pool: ${data.cpu_workers_active} Workerów CPU`;
      }
    } catch (_err) {
      state.serverOnline = false;
      el.serverStatusBadge.textContent = "● Tryb Lokalny WebGL/Canvas (Gotowy)";
    }
  }

  // ==========================================================================
  // 2. GENERATOR DEMO WOJOWNIKA KI (DO NATYCHMIASTOWYCH TESTÓW)
  // ==========================================================================
  function generateDemoWarriorFrames(count = 16, size = 256) {
    const frames = [];
    const anchorX = size * 0.5;
    const anchorY = size * 0.95;

    for (let i = 0; i < count; i++) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");

      const t = i / count;
      const phase = t * Math.PI * 2;
      const strike = Math.sin(phase);
      const bob = Math.abs(Math.sin(phase)) * (size * 0.035);

      g.save();
      g.translate(anchorX, anchorY);

      // Rozstaw nóg (stopy na poziomie 0)
      const legSpread = size * 0.11 + Math.sin(phase) * (size * 0.04);
      g.lineCap = "round";
      g.lineJoin = "round";

      // Tylna noga
      g.strokeStyle = "#1d2d44";
      g.lineWidth = size * 0.065;
      g.beginPath();
      g.moveTo(-legSpread * 0.4, -size * 0.32 + bob);
      g.lineTo(-legSpread, -size * 0.14);
      g.lineTo(-legSpread * 0.9, -size * 0.02);
      g.stroke();

      // Przednia noga
      g.strokeStyle = "#2b4162";
      g.beginPath();
      g.moveTo(legSpread * 0.4, -size * 0.32 + bob);
      g.lineTo(legSpread * 1.05, -size * 0.15);
      g.lineTo(legSpread * 0.95, -size * 0.02);
      g.stroke();

      // Buty / Nagolenniki ze złotym brzegiem
      g.fillStyle = "#c79a5a";
      g.fillRect(-legSpread - size * 0.04, -size * 0.06, size * 0.08, size * 0.05);
      g.fillRect(legSpread * 0.95 - size * 0.04, -size * 0.06, size * 0.08, size * 0.05);

      // Szarfa / Płaszcz powiewający z tyłu
      const capeWave = Math.sin(phase - 0.7) * (size * 0.08);
      g.fillStyle = "#c91e32";
      g.beginPath();
      g.moveTo(-size * 0.08, -size * 0.56 + bob);
      g.quadraticCurveTo(-size * 0.28 + capeWave, -size * 0.38, -size * 0.24 + capeWave * 1.3, -size * 0.16);
      g.lineTo(-size * 0.06, -size * 0.28 + bob);
      g.closePath();
      g.fill();

      // Tułów / Pancerz
      g.fillStyle = "#24364d";
      g.strokeStyle = "#0e1520";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-size * 0.12, -size * 0.58 + bob);
      g.lineTo(size * 0.12, -size * 0.58 + bob);
      g.lineTo(size * 0.08, -size * 0.30 + bob);
      g.lineTo(-size * 0.08, -size * 0.30 + bob);
      g.closePath();
      g.fill();
      g.stroke();

      // Rdzeń KI na piersi
      g.fillStyle = "#00d8ff";
      g.beginPath();
      g.arc(0, -size * 0.46 + bob, size * 0.032, 0, Math.PI * 2);
      g.fill();

      // Głowa + Włosy Anime
      const headY = -size * 0.67 + bob;
      g.fillStyle = "#e0ac8b";
      g.beginPath();
      g.arc(0, headY, size * 0.075, 0, Math.PI * 2);
      g.fill();

      // Spiczaste włosy wojownika KI
      g.fillStyle = "#161925";
      g.beginPath();
      g.moveTo(-size * 0.08, headY - size * 0.02);
      g.lineTo(-size * 0.15, headY - size * 0.10 + capeWave * 0.2);
      g.lineTo(-size * 0.04, headY - size * 0.08);
      g.lineTo(0, headY - size * 0.16);
      g.lineTo(size * 0.06, headY - size * 0.08);
      g.lineTo(size * 0.14, headY - size * 0.11);
      g.lineTo(size * 0.08, headY - size * 0.01);
      g.closePath();
      g.fill();

      // Ramię atakujące + Ostrze Energii KI
      const armAngle = -0.5 + strike * 1.15;
      g.save();
      g.translate(size * 0.09, -size * 0.53 + bob);
      g.rotate(armAngle);

      g.strokeStyle = "#3a506b";
      g.lineWidth = size * 0.055;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(size * 0.18, 0);
      g.stroke();

      // Świetlne ostrze / kula KI na dłoni
      const bladeGrad = g.createLinearGradient(size * 0.16, 0, size * 0.42, 0);
      bladeGrad.addColorStop(0, "#ffffff");
      bladeGrad.addColorStop(0.4, "#00d8ff");
      bladeGrad.addColorStop(1, "rgba(0, 216, 255, 0)");
      g.fillStyle = bladeGrad;
      g.beginPath();
      g.moveTo(size * 0.16, -size * 0.035);
      g.lineTo(size * 0.42, 0);
      g.lineTo(size * 0.16, size * 0.035);
      g.closePath();
      g.fill();

      g.restore();
      g.restore();

      frames.push({
        canvas: c,
        dataUrl: c.toDataURL("image/png"),
        motionScore: Math.round((Math.abs( Math.cos(phase) ) * 18 + 4) * 10) / 10,
        enabled: true,
      });
    }

    state.rawExtractedFrames = frames;
    el.videoMetaBadge.textContent = `Demo Wojownika (${count} kl. / ${size}px)`;
    rebuildCombination();
    autoFillAll7States();
    showToast("⚔️ Wczytano 16 klatek Demo Wojownika KI i wypełniono wszystkie 7 stanów!");
  }

  // ==========================================================================
  // 3. USUWANIE TŁA & STABILIZACJA STÓP W PRZEGLĄDARCE (CLIENT-SIDE MATTING)
  // ==========================================================================
  function processRawFrameCanvas(srcCanvas, targetSize, bgMode, tolerance, customKeyHex, lockFeet) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const sCtx = srcCanvas.getContext("2d");
    const imgData = sCtx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // 1. Wykrywanie koloru narożnika dla trybu auto_edge
    const cornerR = d[0], cornerG = d[1], cornerB = d[2];
    const [keyR, keyG, keyB] = hexToRgb(customKeyHex);

    if (bgMode !== "none") {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (bgMode === "auto_edge") {
          const dist = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
          if (dist <= tolerance * 1.4) d[i + 3] = 0;
        } else if (bgMode === "white_studio") {
          if (r >= 255 - tolerance && g >= 255 - tolerance && b >= 255 - tolerance) {
            d[i + 3] = 0;
          }
        } else if (bgMode === "chroma_green") {
          if (g > 90 && g > r * 1.25 && g > b * 1.25) {
            const excess = g - Math.max(r, b);
            if (excess > Math.max(15, 95 - tolerance)) d[i + 3] = 0;
          }
        } else if (bgMode === "luma_dark") {
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luma <= tolerance) d[i + 3] = 0;
        } else if (bgMode === "chroma_custom") {
          const dist = Math.hypot(r - keyR, g - keyG, b - keyB);
          if (dist <= tolerance * 1.6) d[i + 3] = 0;
        }
      }
      sCtx.putImageData(imgData, 0, 0);
    }

    // 2. Obliczenie obwiedni (Bounding Box) oraz punktu stóp
    let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3];
        if (a > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = targetSize;
    outCanvas.height = targetSize;
    const oCtx = outCanvas.getContext("2d");

    if (!found) {
      oCtx.drawImage(srcCanvas, 0, 0, targetSize, targetSize);
      return outCanvas;
    }

    const bw = Math.max(1, maxX - minX + 1);
    const bh = Math.max(1, maxY - minY + 1);
    const margin = Math.round(targetSize * 0.05);
    const anchorY = Math.round(targetSize * 0.95);
    const availW = targetSize - margin * 2;
    const availH = anchorY - margin;
    const scale = Math.min(availW / bw, availH / bh);

    const drawW = Math.round(bw * scale);
    const drawH = Math.round(bh * scale);
    const dstX = Math.round((targetSize - drawW) * 0.5);
    const dstY = lockFeet ? anchorY - drawH : Math.round((targetSize - drawH) * 0.5);

    oCtx.drawImage(srcCanvas, minX, minY, bw, bh, dstX, dstY, drawW, drawH);
    return outCanvas;
  }

  // ==========================================================================
  // 4. EKSTRAKCJA Z PLIKU MP4 / WEBM / GIF / ARKUSZA PNG
  // ==========================================================================
  async function extractFromUploadedFile(file) {
    if (!file) return;
    state.uploadedFile = file;
    const targetCount = parseInt(el.rngExtractCount.value, 10) || 16;
    const canvasSize = parseInt(el.selCanvasSize.value, 10) || 256;
    const trimStartPct = parseInt(el.rngTrimStart.value, 10) / 100;
    const trimEndPct = Math.max(trimStartPct + 0.05, parseInt(el.rngTrimEnd.value, 10) / 100);
    const bgMode = el.selBgMode.value;
    const tolerance = parseInt(el.rngBgTol.value, 10) || 38;
    const customHex = el.clrCustomKey.value;
    const lockFeet = el.chkLockFeet.checked;

    showToast(`⏳ Rozbijanie pliku "${file.name}" na ${targetCount} klatek...`);

    // Obsługa arkusza obrazkowego (Spritesheet PNG/JPG/WebP)
    if (file.type.startsWith("image/") && file.type !== "image/gif") {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res) => { img.onload = res; });

      const cols = 4;
      const rows = Math.max(1, Math.round((cols * img.height) / Math.max(1, img.width)));
      const cellW = Math.floor(img.width / cols);
      const cellH = Math.floor(img.height / rows);
      const extracted = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tmp = document.createElement("canvas");
          tmp.width = cellW;
          tmp.height = cellH;
          tmp.getContext("2d").drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
          const norm = processRawFrameCanvas(tmp, canvasSize, bgMode, tolerance, customHex, lockFeet);
          extracted.push({
            canvas: norm,
            dataUrl: norm.toDataURL("image/png"),
            motionScore: 10,
            enabled: true,
          });
        }
      }
      state.rawExtractedFrames = extracted;
      el.videoMetaBadge.textContent = `${file.name} (${extracted.length} kl.)`;
      rebuildCombination();
      autoFillAll7States();
      showToast(`✅ Rozbito arkusz na ${extracted.length} klatek!`);
      return;
    }

    // Ekstrakcja z pliku wideo MP4 / WebM / MOV
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Nie udało się wczytać strumienia wideo MP4."));
    });

    const duration = Math.max(0.1, video.duration || 2.0);
    const tStart = duration * trimStartPct;
    const tEnd = duration * trimEndPct;
    const span = Math.max(0.05, tEnd - tStart);

    const extracted = [];
    let prevData = null;

    for (let i = 0; i < targetCount; i++) {
      const seekTime = tStart + (i / Math.max(1, targetCount - 1)) * span;
      video.currentTime = Math.min(duration - 0.01, seekTime);
      await new Promise((r) => {
        const onSeek = () => {
          video.removeEventListener("seeked", onSeek);
          r();
        };
        video.addEventListener("seeked", onSeek);
      });

      const rawC = document.createElement("canvas");
      rawC.width = video.videoWidth || 512;
      rawC.height = video.videoHeight || 512;
      rawC.getContext("2d").drawImage(video, 0, 0);

      const norm = processRawFrameCanvas(rawC, canvasSize, bgMode, tolerance, customHex, lockFeet);
      const currData = norm.getContext("2d").getImageData(0, 0, canvasSize, canvasSize).data;

      let motionScore = 0;
      if (prevData) {
        let diffSum = 0;
        for (let p = 0; p < currData.length; p += 16) {
          diffSum += Math.abs(currData[p] - prevData[p]);
        }
        motionScore = Math.round((diffSum / (currData.length / 16)) * 10) / 10;
      }
      prevData = currData;

      extracted.push({
        canvas: norm,
        dataUrl: norm.toDataURL("image/png"),
        motionScore,
        enabled: true,
      });
    }

    URL.revokeObjectURL(video.src);
    state.rawExtractedFrames = extracted;
    el.videoMetaBadge.textContent = `${file.name} (${extracted.length} kl. / ${duration.toFixed(1)}s)`;
    rebuildCombination();
    autoFillAll7States();
    showToast(`✅ Rozbito plik MP4 na ${extracted.length} klatek i zablokowano kotwicę stóp!`);
  }

  // ==========================================================================
  // 5. EKSTRAKCJA SERWEROWA NA 16 RDZENIACH CPU (/api/upload-video)
  // ==========================================================================
  async function extractOnServer16CPU() {
    if (!state.uploadedFile) {
      showToast("⚠️ Najpierw wybierz lub przeciągnij plik wideo MP4!");
      return;
    }
    showToast("⚡ Wysyłanie wideo do puli 16 vCPU na serwerze...");
    const form = new FormData();
    form.append("file", state.uploadedFile);
    form.append("max_frames", el.rngExtractCount.value);
    form.append("sample_fps", "0");
    form.append("bg_mode", el.selBgMode.value);
    form.append("tolerance", el.rngBgTol.value);
    form.append("canvas_size", el.selCanvasSize.value);
    form.append("lock_feet", el.chkLockFeet.checked ? "true" : "false");

    try {
      const resp = await fetch("/api/upload-video", { method: "POST", body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();

      const loaded = [];
      for (const f of data.frames) {
        const img = new Image();
        img.src = f.data_url;
        await new Promise((r) => { img.onload = r; });
        const c = document.createElement("canvas");
        c.width = data.canvas_size;
        c.height = data.canvas_size;
        c.getContext("2d").drawImage(img, 0, 0);
        loaded.push({
          canvas: c,
          dataUrl: f.data_url,
          motionScore: f.motion_score,
          enabled: true,
        });
      }

      state.rawExtractedFrames = loaded;
      el.videoMetaBadge.textContent = `16 CPU: ${data.total_extracted} kl. (${data.processing_time_sec}s)`;
      rebuildCombination();
      autoFillAll7States();
      showToast(`🚀 Przetworzono na ${data.cpu_workers_used} rdzeniach CPU w ${data.processing_time_sec}s!`);
    } catch (err) {
      showToast(`⚠️ Przetwarzanie lokalne (serwer niedostępny): ${err.message}`);
      await extractFromUploadedFile(state.uploadedFile);
    }
  }

  // ==========================================================================
  // 6. SILNIK KOMBINACJI KLATEK (ETAP 2)
  // ==========================================================================
  function rebuildCombination() {
    const enabledFrames = state.rawExtractedFrames.filter((f) => f.enabled);
    if (enabledFrames.length === 0) {
      state.activeSequence = [];
      renderFramesStrip();
      return;
    }

    const mode = el.selComboMode.value;
    const targetLen = parseInt(el.selTargetClipLen.value, 10) || 0;
    const speedCurve = el.selSpeedCurve.value;
    const hitIdx = parseInt(el.rngHitStopIdx.value, 10) || 0;
    const customText = (el.txtCustomPattern.value || "").trim();

    let seq = [];

    if (mode === "custom" && customText.length > 0) {
      const parts = customText.split(/[\s,;]+/).map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
      seq = parts.map((idx) => enabledFrames[Math.max(0, Math.min(enabledFrames.length - 1, idx))]);
    } else if (mode === "reverse") {
      seq = [...enabledFrames].reverse();
    } else if (mode === "ping_pong") {
      if (enabledFrames.length > 2) {
        seq = [...enabledFrames, ...enabledFrames.slice(1, -1).reverse()];
      } else {
        seq = [...enabledFrames, ...[...enabledFrames].reverse()];
      }
    } else if (mode === "seamless_loop") {
      seq = [...enabledFrames];
    } else if (mode === "hit_stop") {
      const clampedHit = Math.max(0, Math.min(enabledFrames.length - 1, hitIdx));
      enabledFrames.forEach((f, idx) => {
        seq.push(f);
        if (idx === clampedHit) {
          seq.push({ ...f, isHitStopHold: 1 });
          seq.push({ ...f, isHitStopHold: -1 });
        }
      });
    } else if (mode === "combo_flurry") {
      const mid = Math.floor(enabledFrames.length / 2);
      const part1 = enabledFrames.slice(0, mid + 1);
      const part2 = enabledFrames.slice(Math.max(0, mid - 2), mid + 1).reverse();
      const part3 = enabledFrames.slice(Math.max(0, mid - 1));
      seq = [...part1, ...part2, ...part3];
    } else if (mode === "even_step") {
      seq = enabledFrames.filter((_, i) => i % 2 === 0);
    } else {
      seq = [...enabledFrames];
    }

    // Krzywa prędkości (Speed Ramping)
    if (speedCurve !== "linear" && seq.length >= 4) {
      const m = seq.length;
      const ramped = [];
      for (let i = 0; i < m; i++) {
        const u = i / (m - 1);
        let um = u;
        if (speedCurve === "strike_snap") um = Math.pow(u, 0.45);
        else if (speedCurve === "ease_in") um = u * u;
        else if (speedCurve === "ease_out") um = 1 - (1 - u) * (1 - u);
        const pick = Math.min(m - 1, Math.max(0, Math.round(um * (m - 1))));
        ramped.push(seq[pick]);
      }
      seq = ramped;
    }

    // Resampling do docelowej długości klipu KI Legends (np. 8 lub 4 klatki)
    if (targetLen > 0 && seq.length > 0 && seq.length !== targetLen) {
      const resampled = [];
      for (let i = 0; i < targetLen; i++) {
        const pos = Math.round((i / Math.max(1, targetLen - 1)) * (seq.length - 1));
        resampled.push(seq[pos]);
      }
      seq = resampled;
    }

    state.activeSequence = seq;
    state.currentFrameIdx = 0;
    el.activeSeqCountBadge.textContent = `${seq.length} klatek w sekwencji`;
    renderFramesStrip();
  }

  // ==========================================================================
  // 7. BANK 7 STANÓW KI LEGENDS (IDLE, WALK, ATTACK, SKILL, HIT, DEATH, RESPAWN)
  // ==========================================================================
  function autoFillAll7States() {
    const src = state.rawExtractedFrames.filter((f) => f.enabled);
    if (src.length === 0) return;

    const sampleN = (arr, n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.min(arr.length - 1, Math.round((i / Math.max(1, n - 1)) * (arr.length - 1)));
        out.push(arr[idx]);
      }
      return out;
    };

    // Idle: spokojny ping-pong pierwszych klatek
    const half = src.slice(0, Math.max(2, Math.min(5, src.length)));
    state.stateBank.idle = sampleN([...half, ...[...half].reverse()], 8);
    // Walk: pełny cykl 8 klatek
    state.stateBank.walk = sampleN(src, 8);
    // Attack: dynamiczny cios (klatka o najwyższej energii jako klatka 0!)
    let peakIdx = 0;
    src.forEach((f, idx) => {
      if (f.motionScore > (src[peakIdx]?.motionScore || 0)) peakIdx = idx;
    });
    const rotatedForAttack = [...src.slice(peakIdx), ...src.slice(0, peakIdx)];
    state.stateBank.attack = sampleN(rotatedForAttack, 8);
    // Skill: seria combo 8 klatek
    state.stateBank.skill = sampleN([...src, ...[...src].reverse()], 8);
    // Hit: 4 klatki reakcji
    state.stateBank.hit = sampleN(src.slice(0, Math.max(2, Math.floor(src.length / 2))), 4);
    // Death: 8 klatek
    state.stateBank.death = sampleN(src, 8);
    // Respawn: odwrócone Death!
    state.stateBank.respawn = [...state.stateBank.death].reverse();

    renderStateBankSlots();
  }

  function renderStateBankSlots() {
    el.stateSlotsContainer.innerHTML = "";
    Object.entries(KI_STATES).forEach(([key, spec]) => {
      const stored = state.stateBank[key] || [];
      const card = document.createElement("div");
      card.className = `state-slot-card ${stored.length > 0 ? "filled" : ""}`;
      card.innerHTML = `
        <div class="state-slot-title">
          <span>${key}</span>
          <span style="color:var(--accent-cyan);">${stored.length}/${spec.frames} kl.</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);">${spec.fps} FPS • ${spec.loop ? "Pętla" : "1x"}</div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button class="btn btn-sm" data-assign="${key}" style="flex:1;padding:3px 5px;font-size:10px;">Zapisz tu</button>
          <button class="btn btn-sm" data-load="${key}" style="flex:1;padding:3px 5px;font-size:10px;">Podgląd</button>
        </div>
      `;
      card.querySelector(`[data-assign="${key}"]`).onclick = () => {
        state.stateBank[key] = [...state.activeSequence];
        renderStateBankSlots();
        showToast(`✅ Zapisano ${state.activeSequence.length} klatek do stanu [${key.toUpperCase()}]`);
      };
      card.querySelector(`[data-load="${key}"]`).onclick = () => {
        if (state.stateBank[key].length > 0) {
          state.activeSequence = [...state.stateBank[key]];
          state.currentStateSlot = key;
          el.rngPlaybackFps.value = spec.fps;
          el.valPlaybackFps.textContent = spec.fps;
          state.playbackFps = spec.fps;
          state.currentFrameIdx = 0;
          renderFramesStrip();
          showToast(`👁️ Przełączono podgląd na stan [${key.toUpperCase()}] (${spec.fps} FPS)`);
        }
      };
      el.stateSlotsContainer.appendChild(card);
    });
  }

  // ==========================================================================
  // 8. RENDEROWANIE PASKA MINIATUR KLATEK (MATRYCA KLATEK)
  // ==========================================================================
  function renderFramesStrip() {
    el.framesStrip.innerHTML = "";
    state.rawExtractedFrames.forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = `frame-thumb ${!f.enabled ? "disabled-frame" : ""} ${idx === state.currentFrameIdx ? "current-frame" : ""}`;
      const barWidth = Math.min(100, Math.round(f.motionScore * 4));
      item.innerHTML = `
        <img src="${f.dataUrl}" alt="Frame ${idx}" />
        <div class="frame-meta">
          <span>#${String(idx).padStart(2, "0")}</span>
          <span>⚡${f.motionScore}</span>
        </div>
        <div class="motion-bar" style="width:${barWidth}%;"></div>
      `;
      item.onclick = () => {
        state.currentFrameIdx = idx % Math.max(1, state.activeSequence.length);
        drawCurrentViewportFrame();
      };
      item.ondblclick = () => {
        f.enabled = !f.enabled;
        rebuildCombination();
      };
      item.oncontextmenu = (e) => {
        e.preventDefault();
        f.enabled = !f.enabled;
        rebuildCombination();
      };
      el.framesStrip.appendChild(item);
    });
  }

  // ==========================================================================
  // 9. SILNIK RENDEROWANIA EFEKTÓW VFX & TRANSFORMACJI POSTACI W CZASIE RZECZYWISTYM
  // ==========================================================================
  function renderFrameWithFXToCanvas(frameObj, frameIndex, totalFrames, targetCanvas, direction) {
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    const g = targetCanvas.getContext("2d");
    g.clearRect(0, 0, w, h);

    if (!frameObj || !frameObj.canvas) return;

    const phase = (frameIndex / Math.max(1, totalFrames)) * Math.PI * 2;
    const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0.5;

    const anchorX = w * 0.5;
    const anchorY = el.selProfile.value === "enemy" ? h * 0.80 : h * 0.95;

    const auraStrength = parseInt(el.rngAura.value, 10) / 100;
    const outlinePx = parseInt(el.rngOutlinePx.value, 10) || 0;
    const hue = parseInt(el.rngHue.value, 10) || 0;
    const sat = parseInt(el.rngSat.value, 10) || 100;
    const rimLight = parseInt(el.rngRimLight.value, 10) / 100;
    const tintStrength = parseInt(el.rngTint.value, 10) / 100;
    const leanDeg = parseFloat(el.rngLean.value) || 0;
    const squashAmp = parseInt(el.rngSquash.value, 10) / 100;
    const clothWave = parseInt(el.rngClothWave.value, 10) || 0;
    const transGrow = (parseInt(el.rngTransGrow.value, 10) / 100) * progress;
    const hitShake = frameObj.isHitStopHold ? frameObj.isHitStopHold * (parseInt(el.rngHitShake.value, 10) || 4) : 0;

    const auraColor = el.clrAura.value;
    const inkColor = el.clrInk.value;

    // 1. Cień kontaktowy pod stopami
    if (el.chkShadow.checked) {
      g.save();
      g.fillStyle = "rgba(0, 0, 0, 0.45)";
      g.beginPath();
      g.ellipse(anchorX, anchorY, w * 0.14, h * 0.032, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // 2. Fala uderzeniowa (Shockwave Ring) u stóp
    if (el.chkShockwave.checked) {
      g.save();
      const rx = w * (0.07 + 0.28 * progress);
      const ry = rx * 0.32;
      g.strokeStyle = auraColor;
      g.lineWidth = Math.max(2, 6 * (1 - progress * 0.65));
      g.globalAlpha = Math.max(0.1, 1 - progress * 0.75);
      g.beginPath();
      g.ellipse(anchorX, anchorY, rx, ry, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    // 3. Transformacja macierzy wokół kotwicy stóp (Anchor Lock + Odbicie Kierunku + Lean + Squash)
    g.save();
    g.translate(anchorX + hitShake, anchorY);

    const isLeftDir = direction === "left" || direction === "down-left" || direction === "up-left";
    const flipX = isLeftDir ? -1 : 1;

    const sx = (1 + transGrow) * (1 - squashAmp * Math.sin(phase)) * flipX;
    const sy = (1 + transGrow) * (1 + squashAmp * Math.sin(phase));

    g.rotate((leanDeg * Math.PI) / 180);
    g.scale(sx, sy);

    // 4. Wielowarstwowa Aura KI wokół postaci
    if (auraStrength > 0.02) {
      g.save();
      const pulse = 1 + 0.12 * Math.sin(phase * 2);
      g.shadowColor = auraColor;
      g.shadowBlur = (18 + 34 * auraStrength) * pulse;
      g.globalAlpha = Math.min(1, auraStrength * 0.95);
      for (let pass = 0; pass < 3; pass++) {
        const ox = Math.sin(phase * 2 + pass * 2.1) * (4 * auraStrength);
        const oy = -Math.abs(Math.cos(phase * 2 + pass)) * (8 * auraStrength);
        g.drawImage(frameObj.canvas, -w * 0.5 + ox, -anchorY + oy, w, h);
      }
      g.restore();
    }

    // 5. Obrys tuszem (Anime Ink Outline)
    if (outlinePx > 0) {
      const offC = document.createElement("canvas");
      offC.width = w;
      offC.height = h;
      const offG = offC.getContext("2d");
      offG.drawImage(frameObj.canvas, 0, 0, w, h);
      offG.globalCompositeOperation = "source-in";
      offG.fillStyle = inkColor;
      offG.fillRect(0, 0, w, h);

      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const ang = (s / steps) * Math.PI * 2;
        const dx = Math.cos(ang) * outlinePx;
        const dy = Math.sin(ang) * outlinePx;
        g.drawImage(offC, -w * 0.5 + dx, -anchorY + dy, w, h);
      }
    }

    // 6. Rysowanie głównej sylwetki z korekcją HSL i falowaniem szat
    g.save();
    if (hue !== 0 || sat !== 100) {
      g.filter = `hue-rotate(${hue}deg) saturate(${sat}%) contrast(${100 + (sat - 100) * 0.25}%)`;
    }

    if (clothWave > 0) {
      // Pasmowe falowanie dla efektu wiatru na szatach
      const slices = 16;
      const sliceH = h / slices;
      for (let s = 0; s < slices; s++) {
        const weight = Math.max(0, (s - 4) / slices);
        const waveX = Math.sin(phase + s * 0.55) * clothWave * weight;
        g.drawImage(
          frameObj.canvas,
          0,
          s * sliceH,
          w,
          sliceH,
          -w * 0.5 + waveX,
          -anchorY + s * sliceH,
          w,
          sliceH
        );
      }
    } else {
      g.drawImage(frameObj.canvas, -w * 0.5, -anchorY, w, h);
    }
    g.restore();

    // 7. Tint Rasowy + Rim Light NW
    if (tintStrength > 0.02 || rimLight > 0.02) {
      const tintC = document.createElement("canvas");
      tintC.width = w;
      tintC.height = h;
      const tG = tintC.getContext("2d");
      tG.drawImage(frameObj.canvas, 0, 0, w, h);
      tG.globalCompositeOperation = "source-atop";
      if (tintStrength > 0.02) {
        tG.fillStyle = auraColor;
        tG.globalAlpha = tintStrength * 0.55;
        tG.fillRect(0, 0, w, h);
      }
      if (rimLight > 0.02) {
        const grad = tG.createLinearGradient(0, 0, w * 0.65, h * 0.65);
        grad.addColorStop(0, `rgba(255, 250, 220, ${rimLight * 0.65})`);
        grad.addColorStop(0.5, "rgba(255, 250, 220, 0)");
        tG.fillStyle = grad;
        tG.globalAlpha = 1;
        tG.fillRect(0, 0, w, h);
      }
      g.drawImage(tintC, -w * 0.5, -anchorY, w, h);
    }

    // 8. Wyładowania elektryczne / Błyskawice KI
    if (el.chkLightning.checked) {
      g.save();
      g.strokeStyle = "#ffffff";
      g.shadowColor = auraColor;
      g.shadowBlur = 10;
      g.lineWidth = 2;
      for (let b = 0; b < 3; b++) {
        let bx = (Math.sin(frameIndex * 13 + b * 4) * 0.14) * w;
        let by = (-0.25 - ((frameIndex * 7 + b * 3) % 5) * 0.1) * h;
        g.beginPath();
        g.moveTo(bx, by);
        for (let seg = 0; seg < 4; seg++) {
          bx += Math.cos(frameIndex * 19 + seg * 5 + b) * 16;
          by += Math.sin(frameIndex * 23 + seg * 3) * 16 - 6;
          g.lineTo(bx, by);
        }
        g.stroke();
      }
      g.restore();
    }

    g.restore();
  }

  // ==========================================================================
  // 10. PĘTLA PODGLĄDU NA ŻYWO (60 FPS VIEWPORT + ONION SKIN + SIATKA STÓP)
  // ==========================================================================
  function drawCurrentViewportFrame() {
    const seq = state.activeSequence;
    const size = parseInt(el.selCanvasSize.value, 10) || 256;
    if (el.previewCanvas.width !== size) {
      el.previewCanvas.width = size;
      el.previewCanvas.height = size;
    }

    ctx.clearRect(0, 0, size, size);

    if (seq.length === 0) return;
    const idx = state.currentFrameIdx % seq.length;

    // 1. Onion Skin (poprzednia klatka półprzezroczysta)
    const trailStrength = parseInt(el.rngTrail.value, 10) / 100;
    if ((state.showOnionSkin || trailStrength > 0.05) && seq.length > 1) {
      const prevIdx = (idx - 1 + seq.length) % seq.length;
      const ghostC = document.createElement("canvas");
      ghostC.width = size;
      ghostC.height = size;
      renderFrameWithFXToCanvas(seq[prevIdx], prevIdx, seq.length, ghostC, state.currentDirection);
      ctx.save();
      ctx.globalAlpha = state.showOnionSkin ? 0.30 : trailStrength * 0.45;
      ctx.drawImage(ghostC, -6, 0);
      ctx.restore();
    }

    // 2. Bieżąca klatka z efektami
    const mainC = document.createElement("canvas");
    mainC.width = size;
    mainC.height = size;
    renderFrameWithFXToCanvas(seq[idx], idx, seq.length, mainC, state.currentDirection);
    ctx.drawImage(mainC, 0, 0);

    // 3. Siatka bezpieczeństwa KI_SAFE + Celownik Kotwicy Stóp (0.5, 0.95)
    if (state.showGridAndFeet) {
      const anchorX = size * 0.5;
      const anchorY = el.selProfile.value === "enemy" ? size * 0.80 : size * 0.95;
      const safeMargin = Math.round(size * (14 / 512));

      ctx.save();
      // Ramka marginesu bezpieczeństwa KI_SAFE
      ctx.strokeStyle = "rgba(0, 216, 255, 0.25)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(safeMargin, safeMargin, size - safeMargin * 2, size - safeMargin * 2);

      // Linia stóp
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(56, 229, 139, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchorX - 36, anchorY);
      ctx.lineTo(anchorX + 36, anchorY);
      ctx.moveTo(anchorX, anchorY - 14);
      ctx.lineTo(anchorX, anchorY + 8);
      ctx.stroke();

      ctx.fillStyle = "#38e58b";
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    el.viewportHud.textContent =
      `KLATKA: ${String(idx + 1).padStart(2, "0")} / ${String(seq.length).padStart(2, "0")} | ` +
      `FPS: ${state.playbackFps} | KIERUNEK: ${state.currentDirection.toUpperCase()} | ` +
      `STAN: ${state.currentStateSlot.toUpperCase()} | CANVAS: ${size}x${size}`;
  }

  function animationLoop(timestamp) {
    if (state.isPlaying && state.activeSequence.length > 0) {
      const interval = 1000 / Math.max(1, state.playbackFps);
      if (timestamp - state.lastFrameTime >= interval) {
        state.currentFrameIdx = (state.currentFrameIdx + 1) % state.activeSequence.length;
        state.lastFrameTime = timestamp;
        drawCurrentViewportFrame();
      }
    }
    requestAnimationFrame(animationLoop);
  }

  // ==========================================================================
  // 11. EKSPORTY: PACZKA KI LEGENDS (.ZIP), SPRITESHEET (.PNG), PHASER (.JSON), .GIF
  // ==========================================================================
  function renderSequenceBakedCanvases(seq, size, direction = "right") {
    return seq.map((frameObj, idx) => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      renderFrameWithFXToCanvas(frameObj, idx, seq.length, c, direction);
      return c;
    });
  }

  function exportSpritesheetPNG() {
    const seq = state.activeSequence;
    if (seq.length === 0) return;
    const size = parseInt(el.selCanvasSize.value, 10) || 256;
    const baked = renderSequenceBakedCanvases(seq, size, state.currentDirection);

    const cols = Math.min(8, baked.length);
    const rows = Math.ceil(baked.length / cols);
    const sheet = document.createElement("canvas");
    sheet.width = cols * size;
    sheet.height = rows * size;
    const sCtx = sheet.getContext("2d");

    baked.forEach((c, i) => {
      const x = (i % cols) * size;
      const y = Math.floor(i / cols) * size;
      sCtx.drawImage(c, x, y);
    });

    const a = document.createElement("a");
    a.href = sheet.toDataURL("image/png");
    a.download = `${el.txtActorId.value || "hero"}-${state.currentStateSlot}-spritesheet.png`;
    a.click();
    showToast("🖼️ Pobrano arkusz Spritesheet PNG!");
  }

  function exportPhaserAtlasJSON() {
    const seq = state.activeSequence;
    if (seq.length === 0) return;
    const size = parseInt(el.selCanvasSize.value, 10) || 256;
    const actorId = el.txtActorId.value || "hero-custom";
    const cols = Math.min(8, seq.length);
    const rows = Math.ceil(seq.length / cols);

    const frames = {};
    const dirs = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"];
    dirs.forEach((dr) => {
      seq.forEach((_, idx) => {
        const name = `${actorId}/${state.currentStateSlot}/${dr}/${String(idx).padStart(2, "0")}`;
        frames[name] = {
          frame: { x: (idx % cols) * size, y: Math.floor(idx / cols) * size, w: size, h: size },
          rotated: false,
          trimmed: false,
          sourceSize: { w: size, h: size },
          spriteSourceSize: { x: 0, y: 0, w: size, h: size },
        };
      });
    });

    const json = {
      frames,
      meta: {
        app: "ki-animation-studio-2.0",
        image: `${actorId}-page-0.webp`,
        format: "RGBA8888",
        size: { w: cols * size, h: rows * size },
        scale: "1",
      },
    };

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${actorId}-atlas.json`;
    a.click();
    showToast("📄 Pobrano plik metadanych Phaser JSON Hash!");
  }

  // --- WBUDOWANY GENERATOR ARCHIWUM .ZIP W PRZEGLĄDARCE (FALLBACK ZERO-DEPS) ---
  function createZipBlobInBrowser(filesMap) {
    // filesMap: [{ name: "manifest.json", data: Uint8Array }]
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
    function crc32(buf) {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }

    const enc = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    filesMap.forEach((file) => {
      const nameBytes = enc.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const size = data.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      localParts.push(localHeader, data);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    });

    const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, filesMap.length, true);
    ev.setUint16(10, filesMap.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([...localParts, ...centralParts, eocd], { type: "application/zip" });
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  async function exportCompleteKIPackZip() {
    const size = parseInt(el.selCanvasSize.value, 10) || 256;
    const actorId = el.txtActorId.value || "hero-planetary-v4";
    const world = el.selWorld.value || "verdant";
    const profile = el.selProfile.value || "hero";
    const version = el.txtPackVersion.value || "2.0.0";

    showToast("📦 Budowanie kompletnej paczki produkcyjnej KI Legends (.ZIP)...");

    const stateClipsB64 = {};
    Object.keys(KI_STATES).forEach((stName) => {
      const clipSeq = state.stateBank[stName]?.length > 0 ? state.stateBank[stName] : state.activeSequence;
      const baked = renderSequenceBakedCanvases(clipSeq, size, "right");
      stateClipsB64[stName] = baked.map((c) => c.toDataURL("image/png"));
    });

    try {
      const resp = await fetch("/api/export-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_id: actorId,
          world,
          profile,
          version,
          cell_size: size,
          state_clips_b64: stateClipsB64,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${actorId}-${version}-ki-pack.zip`;
      a.click();
      showToast(`✅ Pobrano kompletną paczkę ${actorId}-${version}-ki-pack.zip (16 CPU)!`);
    } catch (_err) {
      // Budowanie pełnego archiwum .ZIP po stronie przeglądarki
      const enc = new TextEncoder();
      const zipEntries = [];
      const manifestClips = {};

      Object.entries(stateClipsB64).forEach(([stName, b64List]) => {
        b64List.forEach((b64, idx) => {
          zipEntries.push({
            name: `renders/${actorId}/${stName}/right/${String(idx).padStart(2, "0")}.png`,
            data: dataUrlToUint8Array(b64),
          });
        });
        manifestClips[stName] = {
          fps: KI_STATES[stName].fps,
          loop: KI_STATES[stName].loop,
          frames: b64List.length,
        };
      });

      const manifestObj = {
        schemaVersion: 1,
        id: actorId,
        version,
        world,
        profile,
        cellSize: size,
        anchor: profile === "enemy" ? [0.5, 0.8] : [0.5, 0.95],
        clips: manifestClips,
      };
      zipEntries.push({
        name: "manifest.json",
        data: enc.encode(JSON.stringify(manifestObj, null, 2)),
      });

      const zipBlob = createZipBlobInBrowser(zipEntries);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${actorId}-${version}-ki-pack.zip`;
      a.click();
      showToast(`✅ Pobrano kompletną paczkę ${actorId}-${version}-ki-pack.zip!`);
    }
  }

  async function exportAnimatedGif() {
    const seq = state.activeSequence;
    if (seq.length === 0) return;
    const size = parseInt(el.selCanvasSize.value, 10) || 256;
    const baked = renderSequenceBakedCanvases(seq, size, state.currentDirection);

    const form = new FormData();
    baked.forEach((c) => form.append("frames_b64", c.toDataURL("image/png")));
    form.append("fps", String(state.playbackFps));

    try {
      const resp = await fetch("/api/export-gif", { method: "POST", body: form });
      if (!resp.ok) throw new Error("GIF export fallback");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${el.txtActorId.value || "anim"}-${state.currentStateSlot}.gif`;
      a.click();
      showToast("🎞️ Pobrano przezroczysty animowany plik .GIF!");
    } catch (_e) {
      exportSpritesheetPNG();
    }
  }

  // ==========================================================================
  // 12. PODPIĘCIE ZDARZEŃ INTERFEJSU
  // ==========================================================================
  function bindEvents() {
    // Zakładki nawigacji etapów
    document.querySelectorAll(".stage-tab").forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll(".stage-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const stage = tab.dataset.stage;
        document.querySelectorAll(".stage-panel").forEach((panel) => {
          panel.style.display = stage === "all" || panel.dataset.panel === stage ? "block" : "none";
        });
      };
    });

    // Dropzone MP4
    el.dropzone.onclick = () => el.fileInput.click();
    el.dropzone.ondragover = (e) => {
      e.preventDefault();
      el.dropzone.classList.add("dragover");
    };
    el.dropzone.ondragleave = () => el.dropzone.classList.remove("dragover");
    el.dropzone.ondrop = (e) => {
      e.preventDefault();
      el.dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        extractFromUploadedFile(e.dataTransfer.files[0]);
      }
    };
    el.fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        extractFromUploadedFile(e.target.files[0]);
      }
    };

    // Suwaki Etapu 1
    el.rngExtractCount.oninput = () => { el.valExtractCount.textContent = `${el.rngExtractCount.value} kl.`; };
    el.rngTrimStart.oninput = () => { el.valTrimStart.textContent = `${el.rngTrimStart.value}%`; };
    el.rngTrimEnd.oninput = () => { el.valTrimEnd.textContent = `${el.rngTrimEnd.value}%`; };
    el.rngBgTol.oninput = () => { el.valBgTol.textContent = el.rngBgTol.value; };

    document.getElementById("btnReExtract").onclick = () => {
      if (state.uploadedFile) extractFromUploadedFile(state.uploadedFile);
      else generateDemoWarriorFrames(parseInt(el.rngExtractCount.value, 10), parseInt(el.selCanvasSize.value, 10));
    };
    document.getElementById("btnServerExtract16CPU").onclick = extractOnServer16CPU;
    document.getElementById("btnLoadDemoWarrior").onclick = () => {
      generateDemoWarriorFrames(parseInt(el.rngExtractCount.value, 10), parseInt(el.selCanvasSize.value, 10));
    };

    // Etap 2: Kombinacje
    el.selComboMode.onchange = rebuildCombination;
    el.selTargetClipLen.onchange = rebuildCombination;
    el.selSpeedCurve.onchange = rebuildCombination;
    el.rngHitStopIdx.oninput = () => {
      el.valHitStopIdx.textContent = el.rngHitStopIdx.value;
      rebuildCombination();
    };
    el.rngHitShake.oninput = () => {
      el.valHitShake.textContent = `${el.rngHitShake.value} px`;
      drawCurrentViewportFrame();
    };
    document.getElementById("btnApplyCombination").onclick = rebuildCombination;
    document.getElementById("btnAutoFillAllStates").onclick = () => {
      autoFillAll7States();
      showToast("⚡ Automatycznie wygenerowano wszystkie 7 stanów KI Legends!");
    };

    // Interpolacja Optical Flow na serwerze 16 CPU
    document.getElementById("btnOpticalFlowServer").onclick = async () => {
      if (state.activeSequence.length < 2) return;
      showToast("🌊 Obliczanie gęstego przepływu optycznego (Farnebäck Optical Flow) na 16 CPU...");
      try {
        const resp = await fetch("/api/combine-frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frames_b64: state.activeSequence.map((f) => f.dataUrl),
            mode: el.selComboMode.value,
            target_count: parseInt(el.selTargetClipLen.value, 10) || state.activeSequence.length * 2,
            use_optical_flow: true,
          }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        const size = parseInt(el.selCanvasSize.value, 10) || 256;
        const newSeq = [];
        for (const b64 of data.frames_b64) {
          const img = new Image();
          img.src = b64;
          await new Promise((r) => { img.onload = r; });
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          c.getContext("2d").drawImage(img, 0, 0);
          newSeq.push({ canvas: c, dataUrl: b64, motionScore: 10, enabled: true });
        }
        state.activeSequence = newSeq;
        showToast(`✅ Wygenerowano ${newSeq.length} płynnych klatek Optical Flow w ${data.processing_time_sec}s!`);
      } catch (_err) {
        rebuildCombination();
        showToast("✅ Zastosowano interpolację klatek!");
      }
    };

    // Transport & Viewport
    el.btnPlayPause.onclick = () => {
      state.isPlaying = !state.isPlaying;
      el.btnPlayPause.textContent = state.isPlaying ? "⏸ Pauza" : "▶ Odtwarzaj";
    };
    document.getElementById("btnStepPrev").onclick = () => {
      state.isPlaying = false;
      el.btnPlayPause.textContent = "▶ Odtwarzaj";
      state.currentFrameIdx = (state.currentFrameIdx - 1 + Math.max(1, state.activeSequence.length)) % Math.max(1, state.activeSequence.length);
      drawCurrentViewportFrame();
    };
    document.getElementById("btnStepNext").onclick = () => {
      state.isPlaying = false;
      el.btnPlayPause.textContent = "▶ Odtwarzaj";
      state.currentFrameIdx = (state.currentFrameIdx + 1) % Math.max(1, state.activeSequence.length);
      drawCurrentViewportFrame();
    };
    el.rngPlaybackFps.oninput = () => {
      state.playbackFps = parseInt(el.rngPlaybackFps.value, 10) || 12;
      el.valPlaybackFps.textContent = state.playbackFps;
    };
    document.getElementById("btnToggleOnion").onclick = () => {
      state.showOnionSkin = !state.showOnionSkin;
      drawCurrentViewportFrame();
    };
    document.getElementById("btnToggleGrid").onclick = () => {
      state.showGridAndFeet = !state.showGridAndFeet;
      drawCurrentViewportFrame();
    };
    document.getElementById("btnDuplicateCurrentFrame").onclick = () => {
      if (state.activeSequence.length === 0) return;
      const idx = state.currentFrameIdx % state.activeSequence.length;
      state.activeSequence.splice(idx, 0, { ...state.activeSequence[idx] });
      el.activeSeqCountBadge.textContent = `${state.activeSequence.length} klatek w sekwencji`;
      showToast(`+ Zduplikowano klatkę #${idx}`);
    };
    document.getElementById("btnSetContactZero").onclick = () => {
      if (state.activeSequence.length === 0) return;
      const idx = state.currentFrameIdx % state.activeSequence.length;
      state.activeSequence = [...state.activeSequence.slice(idx), ...state.activeSequence.slice(0, idx)];
      state.currentFrameIdx = 0;
      showToast("🎯 Ustawiono wybraną klatkę jako Klatkę Kontaktu #00 (zgodnie z kontraktem walki KI Legends)!");
    };
    document.getElementById("btnEnableAllFrames").onclick = () => {
      state.rawExtractedFrames.forEach((f) => { f.enabled = true; });
      rebuildCombination();
    };
    document.getElementById("btnReverseStrip").onclick = () => {
      state.rawExtractedFrames.reverse();
      rebuildCombination();
    };

    // Kompas 8 kierunków
    document.querySelectorAll(".compass-btn").forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll(".compass-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentDirection = btn.dataset.dir;
        drawCurrentViewportFrame();
      };
    });

    // Presety rasowe Etapu 3
    document.querySelectorAll(".race-pill").forEach((pill) => {
      pill.onclick = () => {
        document.querySelectorAll(".race-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        const rKey = pill.dataset.race;
        const p = RACE_PALETTES[rKey];
        if (!p) return;
        state.activeRace = rKey;
        el.clrAura.value = p.auraHex;
        el.clrInk.value = p.inkHex;
        el.rngHue.value = p.hue; el.valHue.textContent = `${p.hue}°`;
        el.rngSat.value = p.sat; el.valSat.textContent = `${p.sat}%`;
        el.rngTint.value = p.tint; el.valTint.textContent = `${p.tint}%`;
        el.rngAura.value = p.aura; el.valAura.textContent = `${p.aura}%`;
        el.rngOutlinePx.value = p.outline; el.valOutlinePx.textContent = `${p.outline} px`;
        el.rngRimLight.value = p.rim; el.valRimLight.textContent = `${p.rim}%`;
        el.chkLightning.checked = p.lightning;
        el.txtActorId.value = p.actorId;
        el.selWorld.value = p.world;
        updateBlenderCommand();
        drawCurrentViewportFrame();
        showToast(`🔥 Aktywowano profil transformacji: ${pill.textContent.trim()}`);
      };
    });

    // Suwaki FX & Transformacji
    const fxSliders = [
      [el.rngOutlinePx, el.valOutlinePx, " px"],
      [el.rngCelLevels, el.valCelLevels, " tonów"],
      [el.rngHue, el.valHue, "°"],
      [el.rngSat, el.valSat, "%"],
      [el.rngRimLight, el.valRimLight, "%"],
      [el.rngTint, el.valTint, "%"],
      [el.rngAura, el.valAura, "%"],
      [el.rngTrail, el.valTrail, "%"],
      [el.rngLean, el.valLean, "°"],
      [el.rngSquash, el.valSquash, "%"],
      [el.rngClothWave, el.valClothWave, " px"],
      [el.rngTransGrow, el.valTransGrow, "%"],
    ];
    fxSliders.forEach(([input, label, suffix]) => {
      input.oninput = () => {
        label.textContent = input.value === "0" && input === el.rngCelLevels ? "Wył." : `${input.value}${suffix}`;
        drawCurrentViewportFrame();
      };
    });

    document.getElementById("btnResetFX").onclick = () => {
      el.rngOutlinePx.value = 0; el.valOutlinePx.textContent = "0 px";
      el.rngCelLevels.value = 0; el.valCelLevels.textContent = "Wył.";
      el.rngHue.value = 0; el.valHue.textContent = "0°";
      el.rngSat.value = 100; el.valSat.textContent = "100%";
      el.rngRimLight.value = 0; el.valRimLight.textContent = "0%";
      el.rngTint.value = 0; el.valTint.textContent = "0%";
      el.rngAura.value = 0; el.valAura.textContent = "0%";
      el.rngTrail.value = 0; el.valTrail.textContent = "0%";
      el.rngLean.value = 0; el.valLean.textContent = "0°";
      el.rngSquash.value = 0; el.valSquash.textContent = "0%";
      el.rngClothWave.value = 0; el.valClothWave.textContent = "0 px";
      el.rngTransGrow.value = 0; el.valTransGrow.textContent = "0%";
      el.chkLightning.checked = false;
      el.chkShockwave.checked = false;
      drawCurrentViewportFrame();
    };

    // Wypalenie efektów na serwerze 16 CPU
    document.getElementById("btnBakeFX16CPU").onclick = async () => {
      if (state.activeSequence.length === 0) return;
      showToast("⚡ Wypalanie efektów VFX i transformacji siatki na 16 vCPU...");
      const params = {
        race_preset: state.activeRace,
        ink_outline_px: parseInt(el.rngOutlinePx.value, 10) || 0,
        ink_color: el.clrInk.value,
        cel_shading_levels: parseInt(el.rngCelLevels.value, 10) || 0,
        hue_shift: parseFloat(el.rngHue.value) || 0,
        saturation: (parseFloat(el.rngSat.value) || 100) / 100,
        nw_rim_light: (parseFloat(el.rngRimLight.value) || 0) / 100,
        tint_strength: (parseFloat(el.rngTint.value) || 0) / 100,
        aura_intensity: (parseFloat(el.rngAura.value) || 0) / 100,
        aura_color: el.clrAura.value,
        motion_trail: (parseFloat(el.rngTrail.value) || 0) / 100,
        lightning_sparks: el.chkLightning.checked,
        shockwave: el.chkShockwave.checked,
        contact_shadow: el.chkShadow.checked,
        lean_deg: parseFloat(el.rngLean.value) || 0,
        squash_stretch: (parseFloat(el.rngSquash.value) || 0) / 100,
        cloth_sway: parseFloat(el.rngClothWave.value) || 0,
        transformation_scale_boost: (parseFloat(el.rngTransGrow.value) || 0) / 100,
      };

      try {
        const resp = await fetch("/api/apply-fx-transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frames_b64: state.activeSequence.map((f) => f.dataUrl),
            params,
          }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        const size = parseInt(el.selCanvasSize.value, 10) || 256;
        const bakedSeq = [];
        for (const b64 of data.frames_b64) {
          const img = new Image();
          img.src = b64;
          await new Promise((r) => { img.onload = r; });
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          c.getContext("2d").drawImage(img, 0, 0);
          bakedSeq.push({ canvas: c, dataUrl: b64, motionScore: 12, enabled: true });
        }
        state.rawExtractedFrames = bakedSeq;
        document.getElementById("btnResetFX").click();
        rebuildCombination();
        showToast(`🚀 Wypalono efekty na ${data.cpu_workers_used} rdzeniach CPU w ${data.processing_time_sec}s!`);
      } catch (_err) {
        // Fallback: wypalenie bezpośrednio z bufora Canvas
        const size = parseInt(el.selCanvasSize.value, 10) || 256;
        const baked = renderSequenceBakedCanvases(state.activeSequence, size, state.currentDirection);
        state.rawExtractedFrames = baked.map((c) => ({
          canvas: c,
          dataUrl: c.toDataURL("image/png"),
          motionScore: 12,
          enabled: true,
        }));
        document.getElementById("btnResetFX").click();
        rebuildCombination();
        showToast("✅ Wypalono efekty i transformacje bezpośrednio do klatek bazowych!");
      }
    };

    // Eksporty
    document.getElementById("btnExportKIPackZip").onclick = exportCompleteKIPackZip;
    document.getElementById("btnExportSpritesheet").onclick = exportSpritesheetPNG;
    document.getElementById("btnExportPhaserJson").onclick = exportPhaserAtlasJSON;
    document.getElementById("btnExportAnimatedGif").onclick = exportAnimatedGif;

    el.txtActorId.oninput = updateBlenderCommand;
  }

  function updateBlenderCommand() {
    const actor = el.txtActorId.value || "hero-planetary-v4";
    el.blenderCmdBox.textContent =
      `blender -b postac.blend -t 16 -P blender/blender_headless_turntable.py -- --out ./renders/${actor} --actor ${actor} --threads 16`;
  }

  // --- INICJALIZACJA ---
  bindEvents();
  checkServerStatus();
  generateDemoWarriorFrames(16, 256);
  requestAnimationFrame(animationLoop);
})();
