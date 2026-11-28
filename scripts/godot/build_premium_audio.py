#!/usr/bin/env python3
"""Generates studio-mastered stereo 44.1 kHz MP3 audio for:
  1. 10 monster creature archetypes x 4 tracks (atk1, atk2, roar, die) = 40 visceral combat SFX
  2. 4 seamless atmospheric Dungeon/Labyrinth ambient soundtracks (pyra, verdant, aether, nexus)
  3. 4 bespoke Dungeon interaction SFX (chest_open, portal_enter, dungeon_step, guardian_alert)

All files are written under ports/godot-isometric-world/assets/premium_sfx/ so they ship cleanly
inside core-c101 (~1.4 MB total) without rebuilding the 8 modular world-* OTA packs.
"""
from pathlib import Path
import subprocess
import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[2]
OUT_MON = ROOT / "ports" / "godot-isometric-world" / "assets" / "premium_sfx" / "monsters"
OUT_DUN = ROOT / "ports" / "godot-isometric-world" / "assets" / "premium_sfx" / "dungeon"


def rng_s(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    w = rng.standard_normal(n)
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    X = np.fft.rfft(w)
    sc = 1.0 / np.maximum(freqs, 22.0) ** 0.52
    sc[0] = 0.0
    y = np.fft.irfft(X * sc, n=n)
    return y / (np.std(y) + 1e-9)


def lp_fft(x: np.ndarray, fc: float) -> np.ndarray:
    n = len(x)
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    H = 1.0 / np.sqrt(1.0 + (freqs / max(fc, 20.0)) ** 4)
    return np.fft.irfft(np.fft.rfft(x) * H, n=n)


def tv_bp(x: np.ndarray, center_hz: np.ndarray | float, q: float = 2.0) -> np.ndarray:
    n = len(x)
    if np.isscalar(center_hz):
        fc = float(center_hz)
        freqs = np.fft.rfftfreq(n, 1.0 / SR)
        bw = max(fc / q, 25.0)
        H = 1.0 / np.sqrt(1.0 + ((freqs - fc) / bw) ** 2)
        H *= np.clip(freqs / 32.0, 0.0, 1.0)
        return np.fft.irfft(np.fft.rfft(x) * H, n=n)
    cut = np.asarray(center_hz, dtype=np.float64)
    block = 1024
    hop = 512
    win = np.hanning(block)
    out = np.zeros(n, dtype=np.float64)
    norm = np.zeros(n, dtype=np.float64)
    freqs = np.fft.rfftfreq(block, 1.0 / SR)
    for start in range(0, n, hop):
        end = min(start + block, n)
        seg = np.zeros(block, dtype=np.float64)
        seg[: end - start] = x[start:end]
        fc = max(float(np.mean(cut[start:end])), 35.0)
        bw = max(fc / q, 25.0)
        H = 1.0 / np.sqrt(1.0 + ((freqs - fc) / bw) ** 2)
        H *= np.clip(freqs / 32.0, 0.0, 1.0)
        y = np.fft.irfft(np.fft.rfft(seg * win) * H, n=block) * win
        out[start:end] += y[: end - start]
        norm[start:end] += win[: end - start] ** 2
    return out / np.maximum(norm, 1e-6)


def formant_voice(n: int, f0_curve: np.ndarray, f1_c: np.ndarray, f2_c: np.ndarray, f3_c: np.ndarray,
                  roughness: float, breath: float, rng: np.random.Generator) -> np.ndarray:
    """Organic creature vocal-tract synthesis: jittered glottal pulse + sub-harmonic growl + 3 moving formants."""
    t = np.arange(n) / SR
    # Organic pitch micro-jitter + harsh creature sub-harmonic modulation
    jitter = lp_fft(rng.standard_normal(n), 38.0) * roughness * 0.24
    inst_f = np.maximum(24.0, f0_curve * (1.0 + jitter))
    ph = 2.0 * np.pi * np.cumsum(inst_f) / SR
    # Asymmetric glottal pulse (rich natural harmonic rolloff, NOT harsh digital square wave)
    glottal = np.tanh(2.2 * np.sin(ph) + 1.1 * np.sin(2.0 * ph + 0.4) + 0.55 * np.sin(3.0 * ph + 0.9))
    # Vocal-cord false-fold sub-harmonic growl (f0 / 2 and f0 / 3)
    sub_g = np.sin(ph * 0.5) * (0.45 * roughness) + np.sin(ph * 0.333) * (0.25 * roughness)
    src = glottal * (1.0 + 0.35 * sub_g) + sub_g * 0.45 + pink_noise(n, rng) * breath
    # Pass through 3 vocal tract formant cavities
    v1 = tv_bp(src, f1_c, q=3.2) * 0.62
    v2 = tv_bp(src, f2_c, q=4.0) * 0.44
    v3 = tv_bp(src, f3_c, q=4.5) * 0.24
    return v1 + v2 + v3


def impact_thump(n: int, t0: float, f_hi: float, f_lo: float, decay_s: float, body_gain: float = 1.0) -> np.ndarray:
    """Heavy chest-feeling physical impact transient."""
    t = np.arange(n) / SR
    dt = np.maximum(0.0, t - t0)
    act = (t >= t0).astype(np.float64)
    f = f_lo + (f_hi - f_lo) * np.exp(-dt / (decay_s * 0.28))
    ph = 2.0 * np.pi * np.cumsum(f * act) / SR
    sig = act * np.sin(ph) * (1.0 - np.exp(-dt / 0.0025)) * np.exp(-dt / decay_s)
    sig += act * 0.35 * np.sin(ph * 2.05) * np.exp(-dt / (decay_s * 0.32))
    return sig * body_gain


def slash_rip(n: int, t0: float, f_start: float, f_end: float, dur_s: float, q: float, rng: np.random.Generator) -> np.ndarray:
    """High-velocity visceral claw/blade/vine air rip."""
    t = np.arange(n) / SR
    dt = np.maximum(0.0, t - t0)
    act = (t >= t0).astype(np.float64)
    env = act * np.sin(np.clip(dt / max(dur_s, 0.02), 0.0, 1.0) * np.pi) ** 1.15 * np.exp(-dt / (dur_s * 0.65))
    cf = f_end + (f_start - f_end) * np.exp(-dt / (dur_s * 0.38))
    return tv_bp(pink_noise(n, rng), cf, q=q) * env


def grain_impacts(n: int, times: list[float], freqs: list[float], decay_s: float, rng: np.random.Generator) -> np.ndarray:
    """Crisp multi-grain physical foley bursts (stone cracks, chitin snaps, ice shards, metallic sparks)."""
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float64)
    for t0, fc in zip(times, freqs):
        dt = np.maximum(0.0, t - t0)
        act = (t >= t0).astype(np.float64)
        env = act * (1.0 - np.exp(-dt / 0.0012)) * np.exp(-dt / decay_s)
        grain = tv_bp(rng.standard_normal(n), fc, q=5.5) * 0.7 + np.sin(2.0 * np.pi * fc * dt) * 0.3
        out += grain * env * rng.uniform(0.65, 1.15)
    return out / max(1.0, np.sqrt(len(times)) * 0.6)


def stereo_reverb(sig: np.ndarray, rt60: float = 0.55, wet: float = 0.24, seed: int = 11, damp_hz: float = 3400.0) -> np.ndarray:
    rng = rng_s(seed)
    ir_len = int(SR * min(max(rt60 * 1.15, 0.18), 1.6))
    t = np.arange(ir_len) / SR
    dec = np.exp(-6.91 * t / max(rt60, 0.08))
    ir = np.zeros((ir_len, 2), dtype=np.float64)
    for ch in range(2):
        noise = lp_fft(rng.standard_normal(ir_len) * dec, damp_hz * (1.0 if ch == 0 else 0.92))
        taps = [(0.009, 0.55), (0.019, 0.40), (0.033, 0.28)] if ch == 0 else [(0.012, 0.52), (0.025, 0.37), (0.041, 0.25)]
        for td, amp in taps:
            idx = int(td * SR)
            if idx < ir_len:
                noise[idx] += amp
        noise /= np.sqrt(np.sum(noise ** 2) + 1e-9)
        ir[:, ch] = noise
    n_out = len(sig)
    n_fft = 1 << int(np.ceil(np.log2(n_out + ir_len)))
    out = np.zeros((n_out, 2), dtype=np.float64)
    for ch in range(2):
        conv = np.fft.irfft(np.fft.rfft(sig[:, ch], n_fft) * np.fft.rfft(ir[:, ch], n_fft), n_fft)[:n_out]
        out[:, ch] = sig[:, ch] * (1.0 - wet * 0.32) + conv * wet
    return out


def save_mp3(sig: np.ndarray, path: Path, target_db: float = -1.5, bitrate: str = "160k", loop_safe: bool = False) -> int:
    out = np.asarray(sig, dtype=np.float64).copy()
    if out.ndim == 1:
        out = np.stack([out, out], axis=1)
    freqs = np.fft.rfftfreq(len(out), 1.0 / SR)
    hp = np.clip((freqs - 22.0) / 14.0, 0.0, 1.0)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(out[:, ch]) * hp, n=len(out))
    peak = float(np.max(np.abs(out))) + 1e-9
    out = out / peak * 1.18
    out = np.tanh(out * 1.15) / np.tanh(1.15)
    peak2 = float(np.max(np.abs(out))) + 1e-9
    out *= (10.0 ** (target_db / 20.0)) / peak2
    if not loop_safe:
        fi = min(int(0.004 * SR), len(out) // 4)
        fo = min(int(0.024 * SR), len(out) // 4)
        out[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
        out[-fo:] *= np.linspace(1.0, 0.0, fo)[:, None]
    pcm = np.clip(out, -1.0, 1.0).astype("<f4").tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", bitrate, "-ar", str(SR), str(path)],
        input=pcm, check=True,
    )
    return path.stat().st_size


# ==============================================================================
# 1. 10 MONSTER CREATURE ARCHETYPES (atk1, atk2, roar, die)
# ==============================================================================
def synth_monster_track(arch: str, kind: str, seed: int) -> np.ndarray:
    rng = rng_s(seed)
    dur = {"atk1": 0.62, "atk2": 0.68, "roar": 1.15, "die": 1.05}[kind]
    if arch == "boss_colossus":
        dur *= 1.25
    n = int(SR * dur)
    t = np.arange(n) / SR
    st = np.zeros((n, 2), dtype=np.float64)
    v2 = 1.08 if kind == "atk2" else 1.0

    if arch == "beast":
        if kind in ("atk1", "atk2"):
            # Fierce predatory snarl + razor claw swipe + fleshy body slam
            f0 = (165.0 * v2) * np.exp(-t / 0.35) + 72.0
            for ch, det in [(0, 0.97), (1, 1.03)]:
                v = formant_voice(n, f0 * det, 420.0 + 380.0 * np.exp(-t / 0.14),
                                  1100.0 + 750.0 * np.exp(-t / 0.18), np.full(n, 2500.0), 0.72, 0.36, rng)
                env = (1.0 - np.exp(-t / 0.014)) * np.exp(-t / 0.24)
                st[:, ch] += v * env * 0.85
                st[:, ch] += slash_rip(n, 0.04, 4200.0 * v2, 620.0, 0.24, 1.5, rng) * 0.92
                st[:, ch] += slash_rip(n, 0.11, 5200.0, 950.0, 0.18, 2.0, rng) * 0.55
            thud = impact_thump(n, 0.08, 155.0, 48.0, 0.18, 0.88)
            st[:, 0] += thud; st[:, 1] += thud
        elif kind == "roar":
            f0 = 115.0 + 68.0 * np.sin(np.clip(t / 0.45, 0.0, 1.0) * np.pi) * np.exp(-t / 0.85)
            for ch, det in [(0, 0.96), (1, 1.04)]:
                v = formant_voice(n, f0 * det, 360.0 + 460.0 * np.sin(np.clip(t / 0.7, 0.0, 1.0) * np.pi),
                                  980.0 + 820.0 * np.exp(-t / 0.45), np.full(n, 2350.0), 0.92, 0.42, rng)
                env = (1.0 - np.exp(-t / 0.05)) * np.exp(-np.maximum(0.0, t - 0.35) / 0.42)
                st[:, ch] += v * env * 1.05
            st[:, 0] += impact_thump(n, 0.04, 110.0, 42.0, 0.45, 0.55)
            st[:, 1] += impact_thump(n, 0.04, 110.0, 42.0, 0.45, 0.55)
        else:  # die
            f0 = 185.0 * np.exp(-t / 0.38) + 42.0
            for ch, det in [(0, 0.97), (1, 1.03)]:
                v = formant_voice(n, f0 * det, 520.0 * np.exp(-t / 0.4) + 210.0,
                                  1350.0 * np.exp(-t / 0.35) + 520.0, np.full(n, 2100.0), 0.75, 0.48, rng)
                env = (1.0 - np.exp(-t / 0.02)) * np.exp(-t / 0.46)
                st[:, ch] += v * env * 0.90
            body_fall = impact_thump(n, 0.42, 115.0, 36.0, 0.22, 0.85)
            st[:, 0] += body_fall; st[:, 1] += body_fall

    elif arch == "insect_spider":
        if kind in ("atk1", "atk2"):
            # Crisp chitinous mandible clicks + venomous hiss + piercing stinger snap
            ts = [0.02, 0.055, 0.09, 0.13, 0.165, 0.21] if kind == "atk1" else [0.015, 0.042, 0.078, 0.12, 0.17, 0.23, 0.28]
            fs = [2100 * v2, 3400, 1850, 4200 * v2, 2700, 3800, 2400][: len(ts)]
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.028, rng) * 0.95
                st[:, ch] += slash_rip(n, 0.06, 6200.0 * det, 1400.0, 0.26, 2.2, rng) * 0.82
            thud = impact_thump(n, 0.08, 180.0, 62.0, 0.13, 0.65)
            st[:, 0] += thud; st[:, 1] += thud
        elif kind == "roar":
            ts = list(np.linspace(0.03, 0.78, 16))
            fs = [float(rng.uniform(1600, 5200)) for _ in ts]
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.032, rng) * 0.85
                st[:, ch] += tv_bp(pink_noise(n, rng), 2400.0 + 1800.0 * np.sin(t * 9.0), q=2.5) * np.exp(-t / 0.62) * 0.65
        else:
            ts = list(np.linspace(0.02, 0.55, 11))
            fs = [float(3800 * np.exp(-i * 0.14) + 700) for i in range(len(ts))]
            for ch, det in [(0, 0.96), (1, 1.04)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.045, rng) * 0.88
                st[:, ch] += slash_rip(n, 0.05, 3200.0, 380.0, 0.58, 1.8, rng) * 0.70

    elif arch == "serpent_slime":
        if kind in ("atk1", "atk2"):
            for ch, det in [(0, 0.96), (1, 1.04)]:
                hiss = tv_bp(pink_noise(n, rng), (4800.0 * np.exp(-t / 0.24) + 1200.0) * det, q=2.0) * np.exp(-t / 0.28)
                squelch = tv_bp(pink_noise(n, rng), (420.0 + 1600.0 * np.sin(t * 26.0 * v2) ** 2) * det, q=3.2) * np.exp(-t / 0.22)
                st[:, ch] += hiss * 0.78 + squelch * 0.68 + slash_rip(n, 0.05, 3600.0, 480.0, 0.22, 1.6, rng) * 0.60
            thud = impact_thump(n, 0.06, 145.0, 46.0, 0.18, 0.82)
            st[:, 0] += thud; st[:, 1] += thud
        elif kind == "roar":
            for ch, det in [(0, 0.95), (1, 1.05)]:
                hiss = tv_bp(pink_noise(n, rng), (3800.0 + 1600.0 * np.sin(t * 6.0)) * det, q=2.2)
                env = (1.0 - np.exp(-t / 0.06)) * np.exp(-np.maximum(0.0, t - 0.35) / 0.45)
                v = formant_voice(n, np.full(n, 95.0 * det), np.full(n, 480.0), np.full(n, 1650.0), np.full(n, 3900.0), 0.6, 0.85, rng)
                st[:, ch] += (hiss * 0.75 + v * 0.55) * env
        else:
            for ch, det in [(0, 0.96), (1, 1.04)]:
                bubbles = grain_impacts(n, list(np.linspace(0.05, 0.72, 12)), [float(rng.uniform(320, 1250)) * det for _ in range(12)], 0.055, rng)
                st[:, ch] += bubbles * 0.80 + slash_rip(n, 0.02, 2400.0, 220.0, 0.65, 1.4, rng) * 0.72
            st[:, 0] += impact_thump(n, 0.12, 120.0, 38.0, 0.30, 0.72)
            st[:, 1] += impact_thump(n, 0.12, 120.0, 38.0, 0.30, 0.72)

    elif arch == "stone_golem":
        if kind in ("atk1", "atk2"):
            # Colossal granite fist slam + cracking boulder shatter
            slam = impact_thump(n, 0.04, 165.0 * v2, 34.0, 0.30, 1.15)
            st[:, 0] += slam; st[:, 1] += slam
            ts = [0.04, 0.055, 0.075, 0.10, 0.135, 0.18, 0.24, 0.31]
            fs = [480, 920, 1450, 740, 2100, 1180, 620, 1650]
            for ch, det in [(0, 0.94), (1, 1.06)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.055, rng) * 0.95
                st[:, ch] += slash_rip(n, 0.0, 1100.0, 180.0, 0.16, 1.2, rng) * 0.65
        elif kind == "roar":
            f0 = 62.0 + 24.0 * np.exp(-t / 0.55)
            for ch, det in [(0, 0.95), (1, 1.05)]:
                v = formant_voice(n, f0 * det, np.full(n, 240.0), np.full(n, 680.0), np.full(n, 1450.0), 0.85, 0.35, rng)
                st[:, ch] += v * (1.0 - np.exp(-t / 0.08)) * np.exp(-t / 0.68) * 1.0
                st[:, ch] += grain_impacts(n, list(np.linspace(0.05, 0.75, 10)), [float(rng.uniform(350, 1500)) * det for _ in range(10)], 0.065, rng) * 0.55
            st[:, 0] += impact_thump(n, 0.03, 95.0, 32.0, 0.52, 0.90)
            st[:, 1] += impact_thump(n, 0.03, 95.0, 32.0, 0.52, 0.90)
        else:
            # Crumbling stone collapse
            ts = list(np.linspace(0.02, 0.78, 18))
            fs = [float(rng.uniform(280, 2400)) for _ in ts]
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.065, rng) * 1.0
            for t_imp, g in [(0.04, 0.95), (0.28, 0.75), (0.54, 0.65)]:
                im = impact_thump(n, t_imp, 120.0, 34.0, 0.24, g)
                st[:, 0] += im; st[:, 1] += im

    elif arch == "fire_dragon":
        if kind in ("atk1", "atk2"):
            # Roaring volcanic flame jet + explosive fireball punch
            boom = impact_thump(n, 0.05, 175.0 * v2, 40.0, 0.28, 1.05)
            st[:, 0] += boom; st[:, 1] += boom
            for ch, det in [(0, 0.95), (1, 1.05)]:
                roar_f = tv_bp(pink_noise(n, rng), (2600.0 * np.exp(-t / 0.24) + 320.0) * det, q=1.15)
                env = (1.0 - np.exp(-t / 0.015)) * np.exp(-t / 0.30)
                crackle = grain_impacts(n, list(np.linspace(0.04, 0.42, 10)), [float(rng.uniform(1800, 5600)) * det for _ in range(10)], 0.022, rng)
                st[:, ch] += roar_f * env * 1.0 + crackle * 0.48
        elif kind == "roar":
            f0 = 88.0 + 52.0 * np.sin(np.clip(t / 0.55, 0.0, 1.0) * np.pi)
            for ch, det in [(0, 0.96), (1, 1.04)]:
                v = formant_voice(n, f0 * det, 320.0 + 380.0 * np.exp(-t / 0.4),
                                  920.0 + 700.0 * np.exp(-t / 0.5), np.full(n, 2200.0), 0.95, 0.55, rng)
                fire = tv_bp(pink_noise(n, rng), (1800.0 * np.exp(-t / 0.5) + 280.0) * det, q=1.2)
                env = (1.0 - np.exp(-t / 0.05)) * np.exp(-np.maximum(0.0, t - 0.4) / 0.45)
                st[:, ch] += (v * 0.88 + fire * 0.55) * env
        else:
            st[:, 0] += impact_thump(n, 0.03, 145.0, 36.0, 0.36, 0.90)
            st[:, 1] += impact_thump(n, 0.03, 145.0, 36.0, 0.36, 0.90)
            for ch, det in [(0, 0.96), (1, 1.04)]:
                steam = tv_bp(pink_noise(n, rng), (3400.0 * np.exp(-t / 0.45) + 420.0) * det, q=1.4) * np.exp(-t / 0.55)
                st[:, ch] += steam * 0.88

    elif arch == "frost_crystal":
        if kind in ("atk1", "atk2"):
            # Razor glacial crystal shatter + freezing wind blade
            ts = [0.02, 0.045, 0.075, 0.11, 0.16, 0.22]
            fs = [1950 * v2, 3120, 4480 * v2, 2680, 5240, 3760]
            for ch, det in [(0, 0.97), (1, 1.03)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.085, rng) * 0.92
                st[:, ch] += slash_rip(n, 0.02, 5400.0 * det, 900.0, 0.28, 2.0, rng) * 0.78
            thud = impact_thump(n, 0.04, 150.0, 48.0, 0.20, 0.80)
            st[:, 0] += thud; st[:, 1] += thud
        elif kind == "roar":
            for ch, det in [(0, 0.98), (1, 1.02)]:
                wind = tv_bp(pink_noise(n, rng), (950.0 + 2100.0 * np.sin(np.clip(t / 0.8, 0.0, 1.0) * np.pi)) * det, q=2.6)
                chimes = grain_impacts(n, [0.05, 0.14, 0.24, 0.36, 0.50], [1760 * det, 2349 * det, 3136 * det, 2637 * det, 3520 * det], 0.22, rng)
                st[:, ch] += wind * np.exp(-t / 0.72) * 0.75 + chimes * 0.68
        else:
            ts = list(np.linspace(0.02, 0.65, 15))
            fs = [float(rng.uniform(1800, 6400)) for _ in ts]
            for ch, det in [(0, 0.97), (1, 1.03)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.11, rng) * 0.98
            st[:, 0] += impact_thump(n, 0.04, 130.0, 44.0, 0.24, 0.65)
            st[:, 1] += impact_thump(n, 0.04, 130.0, 44.0, 0.24, 0.65)

    elif arch == "arcane_spirit":
        if kind in ("atk1", "atk2"):
            # Ethereal dark-arcane lance + resonant void crack
            f_sw = (620.0 * v2) * np.exp(-t / 0.22) + 145.0
            for ch, det in [(0, 0.985), (1, 1.015)]:
                ph = 2.0 * np.pi * np.cumsum(f_sw * det) / SR
                fm = np.sin(ph * 1.414) * 1.2 * np.exp(-t / 0.16)
                bolt = np.sin(ph + fm) * (1.0 - np.exp(-t / 0.008)) * np.exp(-t / 0.28)
                st[:, ch] += bolt * 0.68 + slash_rip(n, 0.03, 4600.0 * det, 540.0, 0.30, 2.2, rng) * 0.82
            st[:, 0] += impact_thump(n, 0.05, 140.0, 46.0, 0.22, 0.78)
            st[:, 1] += impact_thump(n, 0.05, 140.0, 46.0, 0.22, 0.78)
        elif kind == "roar":
            for ch, det in [(0, 0.99), (1, 1.01)]:
                # Haunting spectral dissonant fifth + tritone whisper
                v = formant_voice(n, (220.0 + 55.0 * np.sin(t * 4.5)) * det,
                                  580.0 + 320.0 * np.sin(t * 3.0), np.full(n, 1620.0), np.full(n, 3100.0), 0.35, 0.75, rng)
                env = (1.0 - np.exp(-t / 0.09)) * np.exp(-np.maximum(0.0, t - 0.35) / 0.50)
                st[:, ch] += v * env * 0.92
        else:
            for ch, det in [(0, 0.985), (1, 1.015)]:
                f = 420.0 * np.exp(-t / 0.42) + 85.0
                ph = 2.0 * np.pi * np.cumsum(f * det) / SR
                wail = np.sin(ph + 0.8 * np.sin(ph * 1.5)) * np.exp(-t / 0.48)
                wind = tv_bp(pink_noise(n, rng), (2600.0 * np.exp(-t / 0.45) + 280.0) * det, q=2.0) * np.exp(-t / 0.55)
                st[:, ch] += wail * 0.60 + wind * 0.72

    elif arch == "mech_cyber":
        if kind in ("atk1", "atk2"):
            # Servo whine + electromagnetic plasma railgun discharge + metallic clack
            t_fire = 0.07
            dt = np.maximum(0.0, t - t_fire)
            act = (t >= t_fire).astype(np.float64)
            f_srv = (280.0 + 920.0 * np.clip(t / t_fire, 0.0, 1.0)) * v2
            for ch, det in [(0, 0.98), (1, 1.02)]:
                ph_s = 2.0 * np.pi * np.cumsum(f_srv * det) / SR
                servo = (t < t_fire) * np.sin(ph_s + 0.5 * np.sin(ph_s * 2.0)) * 0.45
                plasma = act * tv_bp(pink_noise(n, rng), (4200.0 * np.exp(-dt / 0.16) + 380.0) * det, q=1.5) * np.exp(-dt / 0.24)
                clang = grain_impacts(n, [t_fire, t_fire + 0.025], [1480 * det, 2940 * det], 0.045, rng)
                st[:, ch] += servo + plasma * 0.88 + clang * 0.65
            boom = impact_thump(n, t_fire, 210.0, 48.0, 0.22, 0.98)
            st[:, 0] += boom; st[:, 1] += boom
        elif kind == "roar":
            for ch, det in [(0, 0.98), (1, 1.02)]:
                f = (140.0 + 480.0 * np.sin(np.clip(t / 0.75, 0.0, 1.0) * np.pi)) * det
                ph = 2.0 * np.pi * np.cumsum(f) / SR
                klaxon = np.tanh(1.8 * np.sin(ph) + 0.9 * np.sin(ph * 1.498)) * (1.0 - np.exp(-t / 0.04)) * np.exp(-t / 0.65)
                st[:, ch] += klaxon * 0.55 + tv_bp(pink_noise(n, rng), 1800.0 * det, q=2.0) * np.exp(-t / 0.55) * 0.50
        else:
            # Power-down turbine whine + short-circuit sparks + chassis collapse
            for ch, det in [(0, 0.97), (1, 1.03)]:
                f = (880.0 * np.exp(-t / 0.38) + 65.0) * det
                ph = 2.0 * np.pi * np.cumsum(f) / SR
                down = np.sin(ph + 0.6 * np.sin(ph * 2.1)) * np.exp(-t / 0.58)
                sparks = grain_impacts(n, [0.05, 0.14, 0.28, 0.44, 0.62], [3200 * det, 4600 * det, 2400 * det, 5100 * det, 1800 * det], 0.035, rng)
                st[:, ch] += down * 0.58 + sparks * 0.72
            st[:, 0] += impact_thump(n, 0.34, 135.0, 38.0, 0.25, 0.85)
            st[:, 1] += impact_thump(n, 0.34, 135.0, 38.0, 0.25, 0.85)

    elif arch == "plant_druid":
        if kind in ("atk1", "atk2"):
            # Elastic vine whip-crack + ancient timber snap + mossy earth thud
            ts = [0.03, 0.065, 0.11, 0.16]
            fs = [580 * v2, 1180, 820 * v2, 1680]
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += slash_rip(n, 0.02, 3400.0 * det, 420.0, 0.24, 1.5, rng) * 0.92
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.048, rng) * 0.85
            thud = impact_thump(n, 0.07, 148.0, 42.0, 0.22, 0.92)
            st[:, 0] += thud; st[:, 1] += thud
        elif kind == "roar":
            f0 = 78.0 + 28.0 * np.sin(np.clip(t / 0.7, 0.0, 1.0) * np.pi)
            for ch, det in [(0, 0.96), (1, 1.04)]:
                v = formant_voice(n, f0 * det, np.full(n, 310.0), np.full(n, 840.0), np.full(n, 1950.0), 0.78, 0.40, rng)
                creak = grain_impacts(n, list(np.linspace(0.06, 0.82, 12)), [float(rng.uniform(420, 1400)) * det for _ in range(12)], 0.055, rng)
                st[:, ch] += v * np.exp(-t / 0.65) * 0.85 + creak * 0.55
        else:
            ts = list(np.linspace(0.03, 0.68, 14))
            fs = [float(rng.uniform(320, 1800)) for _ in ts]
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += grain_impacts(n, ts, [f * det for f in fs], 0.060, rng) * 0.92
            st[:, 0] += impact_thump(n, 0.26, 125.0, 36.0, 0.28, 0.88)
            st[:, 1] += impact_thump(n, 0.26, 125.0, 36.0, 0.28, 0.88)

    else:  # boss_colossus
        if kind in ("atk1", "atk2"):
            slam = impact_thump(n, 0.06, 190.0 * v2, 30.0, 0.42, 1.25)
            st[:, 0] += slam; st[:, 1] += slam
            for ch, det in [(0, 0.95), (1, 1.05)]:
                st[:, ch] += slash_rip(n, 0.01, 3200.0 * det, 260.0, 0.28, 1.3, rng) * 0.95
                st[:, ch] += grain_impacts(n, [0.06, 0.09, 0.13, 0.18, 0.25], [640 * det, 1320 * det, 2200 * det, 980 * det, 1740 * det], 0.07, rng) * 0.80
                v = formant_voice(n, (92.0 * v2) * np.exp(-t / 0.4) + 46.0, np.full(n, 290.0), np.full(n, 820.0), np.full(n, 1900.0), 0.9, 0.35, rng)
                st[:, ch] += v * np.exp(-t / 0.34) * 0.62
        elif kind == "roar":
            f0 = 64.0 + 42.0 * np.sin(np.clip(t / 0.65, 0.0, 1.0) * np.pi)
            for ch, det in [(0, 0.95), (1, 1.05)]:
                v = formant_voice(n, f0 * det, 260.0 + 360.0 * np.sin(np.clip(t / 0.9, 0.0, 1.0) * np.pi),
                                  780.0 + 640.0 * np.exp(-t / 0.6), np.full(n, 1850.0), 0.98, 0.45, rng)
                env = (1.0 - np.exp(-t / 0.07)) * np.exp(-np.maximum(0.0, t - 0.55) / 0.55)
                st[:, ch] += v * env * 1.15
            st[:, 0] += impact_thump(n, 0.04, 110.0, 30.0, 0.65, 0.95)
            st[:, 1] += impact_thump(n, 0.04, 110.0, 30.0, 0.65, 0.95)
        else:
            f0 = 110.0 * np.exp(-t / 0.55) + 32.0
            for ch, det in [(0, 0.96), (1, 1.04)]:
                v = formant_voice(n, f0 * det, np.full(n, 280.0), np.full(n, 720.0), np.full(n, 1600.0), 0.92, 0.48, rng)
                st[:, ch] += v * np.exp(-t / 0.65) * 0.95
            st[:, 0] += impact_thump(n, 0.38, 140.0, 30.0, 0.48, 1.1)
            st[:, 1] += impact_thump(n, 0.38, 140.0, 30.0, 0.48, 1.1)

    rt = 0.72 if arch in ("arcane_spirit", "frost_crystal", "boss_colossus") else 0.42
    wet = 0.30 if arch in ("arcane_spirit", "frost_crystal", "boss_colossus") else 0.22
    return stereo_reverb(st, rt60=rt, wet=wet, seed=seed + 999)


# ==============================================================================
# 2. 4 ATMOSPHERIC SEAMLESS DUNGEON SOUNDTRACKS (10s loops) + 4 DUNGEON SFX
# ==============================================================================
def build_dungeon_music(theme: str, seed: int) -> np.ndarray:
    """Rich, moody, seamless 10-second stereo dungeon soundtrack loop (dark cavern pad + tension pulses + biome motif)."""
    dur = 10.0
    n = int(SR * dur)
    xfade = int(SR * 1.2)
    n_ext = n + xfade
    t_ext = np.arange(n_ext) / SR
    t = np.arange(n) / SR
    rng = rng_s(seed)

    # Exact integer-cycle musical scales per biome (dark minor/Phrygian/Dorian)
    roots = {"pyra": 73.42, "verdant": 82.41, "aether": 98.00, "nexus": 65.41}[theme]  # D2, E2, G2, C2
    ratios = {
        "pyra":    [1.0, 1.5, 2.0, 2.118, 3.0, 3.56],     # Dark D Phrygian volcanic tension
        "verdant": [1.0, 1.5, 2.0, 2.40, 3.0, 3.60],      # Mystical E minor druid cavern
        "aether":  [1.0, 1.5, 2.0, 2.25, 3.0, 4.0],       # Ethereal G sus2 frozen shrine
        "nexus":   [1.0, 1.5, 2.0, 2.378, 3.0, 4.24],     # Deep C dark sci-fi reactor
    }[theme]

    # 1. Atmospheric cavern wind / lava rumble / cryo hum / reactor bed (crossfaded for seamless seam)
    ext = np.zeros((n_ext, 2), dtype=np.float64)
    bed_cf = {"pyra": 190.0, "verdant": 340.0, "aether": 620.0, "nexus": 260.0}[theme]
    for ch, ph0 in [(0, 0.0), (1, 1.8)]:
        pn = pink_noise(n_ext, rng)
        cf = bed_cf + bed_cf * 0.28 * np.sin(2.0 * np.pi * t_ext / dur + ph0)
        ext[:, ch] += tv_bp(pn, cf, q=1.5) * 0.42
    st = ext[:n].copy()
    w_in = np.sin(np.linspace(0.0, np.pi * 0.5, xfade))[:, None]
    w_out = np.cos(np.linspace(0.0, np.pi * 0.5, xfade))[:, None]
    st[:xfade] = st[:xfade] * w_in + ext[n : n + xfade] * w_out

    # 2. Deep pulsing orchestral/ambient drone (exact cycles in 10.0s -> 100% seamless loop!)
    for idx, r in enumerate(ratios):
        f_exact = round(roots * r * dur) / dur
        amp = [0.36, 0.22, 0.16, 0.11, 0.09, 0.06][idx]
        lfo_cyc = [1, 2, 1, 3, 2, 3][idx]
        for ch, ps in [(0, 0.0), (1, 0.45 + idx * 0.3)]:
            lfo = 0.65 + 0.35 * np.sin(2.0 * np.pi * lfo_cyc * t / dur + ps)
            st[:, ch] += np.sin(2.0 * np.pi * f_exact * t + ps) * amp * lfo

    # 3. Periodic eerie dungeon motif notes (haunting echoes inside cavern)
    motif_t = [0.5, 2.0, 3.6, 5.5, 7.2, 8.6]
    motif_f = [roots * r * 4.0 for r in [ratios[0], ratios[3], ratios[1], ratios[4], ratios[2], ratios[1]]]
    for i, (t0, f0) in enumerate(zip(motif_t, motif_f)):
        dt = (t - t0) % dur
        env = (1.0 - np.exp(-dt / 0.04)) * np.exp(-dt / 1.35)
        pan = -0.45 if i % 2 == 0 else 0.45
        gl, gr = np.sqrt(0.5 * (1.0 - pan)), np.sqrt(0.5 * (1.0 + pan))
        tone = 0.72 * np.sin(2.0 * np.pi * f0 * dt) + 0.22 * np.sin(2.0 * np.pi * f0 * 2.0 * dt) * np.exp(-dt / 0.4)
        st[:, 0] += tone * env * gl * 0.22
        st[:, 1] += tone * env * gr * 0.22

    # 4. Subtle heartbeat/drum tension pulse every 2.5s
    for tb in [0.0, 2.5, 5.0, 7.5]:
        dt = (t - tb) % dur
        f_d = 46.0 + 44.0 * np.exp(-dt / 0.06)
        ph_d = 2.0 * np.pi * np.cumsum(f_d * (dt < 0.45)) / SR
        drum = (dt < 0.45) * np.sin(ph_d) * np.exp(-dt / 0.16) * 0.28
        st[:, 0] += drum; st[:, 1] += drum

    return st


def build_dungeon_sfx(kind: str) -> np.ndarray:
    rng = rng_s(900 + hash(kind) % 1000)
    if kind == "chest_open":
        n = int(SR * 1.45)
        t = np.arange(n) / SR
        st = np.zeros((n, 2), dtype=np.float64)
        # Heavy lock unlatch + creak + triumphant golden harp fanfare
        st[:, 0] += impact_thump(n, 0.02, 160.0, 52.0, 0.14, 0.75)
        st[:, 1] += impact_thump(n, 0.02, 160.0, 52.0, 0.14, 0.75)
        for ch, det in [(0, 0.97), (1, 1.03)]:
            st[:, ch] += grain_impacts(n, [0.015, 0.06, 0.12], [1100 * det, 2400 * det, 3200 * det], 0.04, rng) * 0.62
        notes = [(0.14, 523.25), (0.22, 659.25), (0.30, 783.99), (0.38, 1046.5), (0.48, 1318.5)]
        for i, (t0, f0) in enumerate(notes):
            dt = np.maximum(0.0, t - t0)
            act = (t >= t0).astype(np.float64)
            env = act * (1.0 - np.exp(-dt / 0.012)) * np.exp(-dt / 0.75)
            pan = -0.35 + 0.70 * (i / 4.0)
            tone = 0.72 * np.sin(2.0 * np.pi * f0 * dt) + 0.24 * np.sin(2.0 * np.pi * f0 * 2.0 * dt) * np.exp(-dt / 0.3)
            st[:, 0] += tone * env * np.sqrt(0.5 * (1.0 - pan)) * 0.55
            st[:, 1] += tone * env * np.sqrt(0.5 * (1.0 + pan)) * 0.55
        return stereo_reverb(st, rt60=0.95, wet=0.32, seed=91)
    elif kind == "portal_enter":
        n = int(SR * 1.35)
        t = np.arange(n) / SR
        st = np.zeros((n, 2), dtype=np.float64)
        st[:, 0] += impact_thump(n, 0.04, 130.0, 38.0, 0.45, 0.90)
        st[:, 1] += impact_thump(n, 0.04, 130.0, 38.0, 0.45, 0.90)
        for ch, det in [(0, 0.96), (1, 1.04)]:
            st[:, ch] += tv_bp(pink_noise(n, rng), (260.0 + 2400.0 * np.sin(np.clip(t / 1.1, 0.0, 1.0) * np.pi)) * det, q=1.8) * np.exp(-t / 0.65) * 0.85
            ph = 2.0 * np.pi * np.cumsum((220.0 + 220.0 * np.exp(-t / 0.45)) * det) / SR
            st[:, ch] += np.sin(ph) * np.exp(-t / 0.65) * 0.35
        return stereo_reverb(st, rt60=1.05, wet=0.36, seed=92)
    elif kind == "dungeon_step":
        n = int(SR * 0.24)
        st = np.zeros((n, 2), dtype=np.float64)
        st[:, 0] += impact_thump(n, 0.005, 135.0, 52.0, 0.065, 0.72)
        st[:, 1] += impact_thump(n, 0.005, 135.0, 52.0, 0.065, 0.72)
        for ch, det in [(0, 0.96), (1, 1.04)]:
            st[:, ch] += grain_impacts(n, [0.004, 0.016, 0.032], [850 * det, 1950 * det, 1350 * det], 0.024, rng) * 0.68
        return stereo_reverb(st, rt60=0.38, wet=0.28, seed=93)
    else:  # guardian_alert
        return synth_monster_track("boss_colossus", "roar", 994)


def main() -> None:
    archetypes = [
        "beast", "insect_spider", "serpent_slime", "stone_golem", "fire_dragon",
        "frost_crystal", "arcane_spirit", "mech_cyber", "plant_druid", "boss_colossus",
    ]
    total = 0
    print("Generating 40 studio-mastered monster archetype SFX...")
    for idx, arch in enumerate(archetypes):
        for k_idx, kind in enumerate(["atk1", "atk2", "roar", "die"]):
            sig = synth_monster_track(arch, kind, 1000 + idx * 31 + k_idx * 7)
            total += save_mp3(sig, OUT_MON / f"{arch}_{kind}.mp3", target_db=-1.4, bitrate="128k")
    print(f"  40 monster SFX done ({total / 1024:.1f} KB)")

    dun_bytes = 0
    print("Generating 4 seamless Dungeon soundtracks + 4 Dungeon SFX...")
    for ti, theme in enumerate(["pyra", "verdant", "aether", "nexus"]):
        sig = build_dungeon_music(theme, 2000 + ti * 17)
        dun_bytes += save_mp3(sig, OUT_DUN / f"lab_{theme}.mp3", target_db=-5.0, bitrate="96k", loop_safe=True)
    for kind in ["chest_open", "portal_enter", "dungeon_step", "guardian_alert"]:
        sig = build_dungeon_sfx(kind)
        dun_bytes += save_mp3(sig, OUT_DUN / f"{kind}.mp3", target_db=-1.6, bitrate="128k")
    print(f"  Dungeon audio done ({dun_bytes / 1024:.1f} KB)")
    print(f"TOTAL premium audio: {(total + dun_bytes) / 1024:.1f} KB (48 stereo MP3s)")


if __name__ == "__main__":
    main()
