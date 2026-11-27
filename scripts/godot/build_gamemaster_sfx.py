#!/usr/bin/env python3
"""Generates 8 studio-mastered stereo MP3 sound effects for the GameMaster character
under ports/godot-isometric-world/assets/gm/sfx/.

Synthesizes rich, multi-layered cinematic audio (sub-bass chest punch, stereo-decorrelated
filtered wind/plasma, chorused celestial bell/pad harmonics, stereo algorithmic reverb,
analog soft-clipping saturation, and -1.5 dBFS peak mastering) encoded via ffmpeg at
44.1 kHz stereo 160 kbps MP3.

Placing assets under ports/godot-isometric-world/assets/gm/sfx/ ships them cleanly in
core-c101 (~250 KB total) with zero rebuild of the 8 modular world-* OTA packs.
"""
from pathlib import Path
import subprocess
import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "ports" / "godot-isometric-world" / "assets" / "gm" / "sfx"


def rng_seed(n: int) -> np.random.Generator:
    return np.random.default_rng(n)


def one_pole_lp(x: np.ndarray, cutoff_hz: np.ndarray | float) -> np.ndarray:
    """Fast time-varying 1-pole lowpass (per-block smooth) using FFT or chunked IIR."""
    n = len(x)
    if np.isscalar(cutoff_hz):
        fc = float(cutoff_hz)
        freqs = np.fft.rfftfreq(n, 1.0 / SR)
        X = np.fft.rfft(x)
        H = 1.0 / np.sqrt(1.0 + (freqs / max(fc, 1.0)) ** 4)
        return np.fft.irfft(X * H, n=n)
    # Time-varying Butterworth-like filter via overlapping Hann blocks (clean, artifact-free)
    cut = np.asarray(cutoff_hz, dtype=np.float64)
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
        fc = float(np.mean(cut[start:end]))
        X = np.fft.rfft(seg * win)
        H = 1.0 / np.sqrt(1.0 + (freqs / max(fc, 10.0)) ** 4)
        y = np.fft.irfft(X * H, n=block) * win
        out[start:end] += y[: end - start]
        norm[start:end] += win[: end - start] ** 2
    return out / np.maximum(norm, 1e-6)


def tv_bandpass(x: np.ndarray, center_hz: np.ndarray, q: float = 1.8) -> np.ndarray:
    """Time-varying stereo-clean resonant bandpass via overlap-add FFT."""
    n = len(x)
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
        fc = max(float(np.mean(center_hz[start:end])), 30.0)
        bw = max(fc / q, 25.0)
        H = 1.0 / np.sqrt(1.0 + ((freqs - fc) / bw) ** 2)
        H *= np.clip(freqs / 35.0, 0.0, 1.0)
        X = np.fft.rfft(seg * win)
        y = np.fft.irfft(X * H, n=block) * win
        out[start:end] += y[: end - start]
        norm[start:end] += win[: end - start] ** 2
    return out / np.maximum(norm, 1e-6)


def pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    white = rng.standard_normal(n)
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    X = np.fft.rfft(white)
    scale = 1.0 / np.maximum(freqs, 18.0) ** 0.55
    scale[0] = 0.0
    y = np.fft.irfft(X * scale, n=n)
    return y / (np.std(y) + 1e-9)


def stereo_reverb(sig: np.ndarray, rt60: float = 0.85, wet: float = 0.28, seed: int = 7) -> np.ndarray:
    """Lush algorithmic stereo impulse convolution reverb (decorrelated L/R exponential decay)."""
    rng = rng_seed(seed)
    ir_len = int(SR * min(max(rt60 * 1.15, 0.25), 1.8))
    t = np.arange(ir_len) / SR
    decay = np.exp(-6.91 * t / max(rt60, 0.1))
    # Smooth pre-delay & early reflections
    ir = np.zeros((ir_len, 2), dtype=np.float64)
    for ch in range(2):
        noise = rng.standard_normal(ir_len) * decay
        # Warm high-frequency damping in tail
        noise = one_pole_lp(noise, 3400.0 if ch == 0 else 3100.0)
        # Subtle early taps
        taps = [(0.011, 0.55), (0.023, 0.42), (0.037, 0.30), (0.059, 0.22)] if ch == 0 else [
            (0.014, 0.52), (0.029, 0.39), (0.043, 0.28), (0.067, 0.20)
        ]
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
        out[:, ch] = sig[:, ch] * (1.0 - wet * 0.35) + conv * wet
    return out


def env_ad(n: int, atk_s: float, dec_curve: float = 2.0) -> np.ndarray:
    t = np.arange(n) / SR
    atk = np.clip(t / max(atk_s, 1e-4), 0.0, 1.0)
    atk = atk * atk * (3.0 - 2.0 * atk)
    rel = np.clip(1.0 - np.maximum(0.0, t - atk_s) / max(n / SR - atk_s, 1e-4), 0.0, 1.0) ** dec_curve
    return atk * rel


def master_and_save(sig: np.ndarray, path: Path, target_db: float = -1.5, loop_safe: bool = False) -> None:
    """High-pass DC removal, warm analog soft-clipping, fade safety, and ffmpeg MP3 encode."""
    out = np.asarray(sig, dtype=np.float64).copy()
    if out.ndim == 1:
        out = np.stack([out, out], axis=1)
    # Remove sub-24Hz DC/rumble
    freqs = np.fft.rfftfreq(len(out), 1.0 / SR)
    hp = np.clip((freqs - 20.0) / 14.0, 0.0, 1.0)
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(out[:, ch]) * hp, n=len(out))
    # Gentle warm saturation (preserves dynamic punch without digital clipping)
    peak = float(np.max(np.abs(out))) + 1e-9
    out = out / peak * 1.15
    out = np.tanh(out * 1.12) / np.tanh(1.12)
    # Final peak normalize to target_db
    peak2 = float(np.max(np.abs(out))) + 1e-9
    gain = 10.0 ** (target_db / 20.0)
    out = out * (gain / peak2)
    if not loop_safe:
        # 6ms fade-in, 25ms fade-out for zero clicks
        fi = min(int(0.006 * SR), len(out) // 4)
        fo = min(int(0.025 * SR), len(out) // 4)
        out[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
        out[-fo:] *= np.linspace(1.0, 0.0, fo)[:, None]
    pcm = np.clip(out, -1.0, 1.0).astype("<f4").tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-b:a", "160k", "-ar", str(SR),
        str(path),
    ]
    subprocess.run(cmd, input=pcm, check=True)
    sz = path.stat().st_size
    print(f"  {path.name:22s}: {len(out)/SR:.2f}s | {sz // 1024:3d} KB")


def chime_chord(n: int, freqs_hz: list[float], t_offsets: list[float], decay_s: float = 0.85, detune: float = 0.003) -> np.ndarray:
    """Warm celestial FM bell/harp harmonics (zero piercing harshness)."""
    t = np.arange(n) / SR
    st = np.zeros((n, 2), dtype=np.float64)
    for i, (f0, t0) in enumerate(zip(freqs_hz, t_offsets)):
        dt = np.maximum(0.0, t - t0)
        active = (t >= t0).astype(np.float64)
        env = active * (1.0 - np.exp(-dt / 0.012)) * np.exp(-dt / decay_s)
        mod_env = active * np.exp(-dt / (decay_s * 0.35))
        pan = -0.38 + 0.76 * (i / max(1, len(freqs_hz) - 1))
        gl = np.sqrt(0.5 * (1.0 - pan))
        gr = np.sqrt(0.5 * (1.0 + pan))
        for ch, g, df in [(0, gl, 1.0 - detune), (1, gr, 1.0 + detune)]:
            f = f0 * df
            fm = np.sin(2.0 * np.pi * (f * 2.0) * dt) * (0.45 * mod_env)
            tone = (
                0.72 * np.sin(2.0 * np.pi * f * dt + fm)
                + 0.22 * np.sin(2.0 * np.pi * f * 2.0 * dt) * np.exp(-dt / (decay_s * 0.45))
                + 0.08 * np.sin(2.0 * np.pi * f * 3.0 * dt) * np.exp(-dt / (decay_s * 0.22))
            )
            st[:, ch] += tone * env * g
    return st / max(1.0, len(freqs_hz) * 0.42)


def build_gm_transform() -> np.ndarray:
    dur = 2.15
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(101)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Deep celestial bass drop (105 -> 42 Hz)
    f_sub = 42.0 + 63.0 * np.exp(-t / 0.28)
    ph_sub = 2.0 * np.pi * np.cumsum(f_sub) / SR
    sub = np.sin(ph_sub) * (1.0 - np.exp(-t / 0.018)) * np.exp(-t / 0.95)
    sub += 0.30 * np.sin(ph_sub * 2.0) * np.exp(-t / 0.35)
    st[:, 0] += sub * 0.85
    st[:, 1] += sub * 0.85
    # 2. Ascending ethereal wind swell
    for ch in range(2):
        pn = pink_noise(n, rng)
        cf = 240.0 + 2100.0 * (1.0 - np.exp(-t / 0.55)) * np.exp(-np.maximum(0.0, t - 0.65) / 0.9)
        whoosh = tv_bandpass(pn, cf, q=1.5)
        st[:, ch] += whoosh * env_ad(n, 0.24, 1.8) * 0.42
    # 3. Warm golden D-major/sus2 celestial arpeggio swell (D4, A4, D5, E5, F#5, A5)
    st += chime_chord(
        n,
        [293.66, 440.0, 587.33, 659.25, 739.99, 880.0],
        [0.04, 0.11, 0.19, 0.28, 0.37, 0.47],
        decay_s=1.05,
    ) * 0.68
    return stereo_reverb(st, rt60=1.1, wet=0.34, seed=11)


def build_gm_takeoff() -> np.ndarray:
    dur = 1.28
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(202)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Pressurized updraft sub-punch (118 -> 46 Hz)
    f_sub = 46.0 + 72.0 * np.exp(-t / 0.11)
    ph = 2.0 * np.pi * np.cumsum(f_sub) / SR
    punch = np.sin(ph) * (1.0 - np.exp(-t / 0.008)) * np.exp(-t / 0.32)
    st[:, 0] += punch * 0.78
    st[:, 1] += punch * 0.78
    # 2. Sweeping dual-band upward aerodynamic wind surge
    for ch, det in [(0, 0.96), (1, 1.04)]:
        pn = pink_noise(n, rng)
        cf1 = (220.0 + 1850.0 * (1.0 - np.exp(-t / 0.38))) * det
        cf2 = (480.0 + 2600.0 * np.sin(np.clip(t / 0.85, 0.0, 1.0) * np.pi * 0.65)) * det
        w1 = tv_bandpass(pn, cf1, q=1.6)
        w2 = tv_bandpass(pink_noise(n, rng), cf2, q=2.2)
        env_w = np.sin(np.clip(t / 0.95, 0.0, 1.0) * np.pi) ** 1.2 * np.exp(-np.maximum(0.0, t - 0.55) / 0.42)
        st[:, ch] += (w1 * 0.55 + w2 * 0.28) * env_w * 0.92
    # 3. Subtle lifting celestial fifth shimmer (D4 -> A4 glide)
    f_pad = 293.66 * (1.0 + 0.5 * (1.0 - np.exp(-t / 0.32)))
    for ch, df in [(0, 0.996), (1, 1.004)]:
        ph_p = 2.0 * np.pi * np.cumsum(f_pad * df) / SR
        pad = (0.65 * np.sin(ph_p) + 0.25 * np.sin(ph_p * 1.5)) * env_ad(n, 0.16, 2.2)
        st[:, ch] += pad * 0.24
    st += chime_chord(n, [440.0, 587.33, 880.0], [0.06, 0.16, 0.26], decay_s=0.58) * 0.28
    return stereo_reverb(st, rt60=0.72, wet=0.28, seed=22)


def build_gm_land() -> np.ndarray:
    dur = 0.92
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(303)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Grounded superhero touchdown impact (138 -> 38 Hz chest thud)
    f_sub = 38.0 + 100.0 * np.exp(-t / 0.055)
    ph = 2.0 * np.pi * np.cumsum(f_sub) / SR
    thud = np.sin(ph) * (1.0 - np.exp(-t / 0.004)) * np.exp(-t / 0.24)
    thud += 0.35 * np.sin(ph * 1.95) * np.exp(-t / 0.08)
    st[:, 0] += thud * 0.95
    st[:, 1] += thud * 0.95
    # 2. Downward air-cushion compression + crisp stone/earth settle
    for ch, det in [(0, 0.97), (1, 1.03)]:
        pn = pink_noise(n, rng)
        cf_air = (1700.0 * np.exp(-t / 0.16) + 140.0) * det
        air = tv_bandpass(pn, cf_air, q=1.4) * (1.0 - np.exp(-t / 0.008)) * np.exp(-t / 0.28)
        gravel = tv_bandpass(rng.standard_normal(n), np.full(n, 680.0 * det), q=0.9) * np.exp(-t / 0.14)
        st[:, ch] += air * 0.56 + gravel * 0.22
    # 3. Warm settling resonant golden tone (A4 -> D4)
    st += chime_chord(n, [440.0, 293.66], [0.015, 0.08], decay_s=0.45) * 0.22
    return stereo_reverb(st, rt60=0.55, wet=0.24, seed=33)


def build_gm_boost_on() -> np.ndarray:
    dur = 1.15
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(404)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Brief 85ms air-vacuum intake -> supersonic shockwave boom at t=0.085s
    t_boom = 0.085
    dt = np.maximum(0.0, t - t_boom)
    active = (t >= t_boom).astype(np.float64)
    # Intake reverse whoosh
    intake_env = np.clip(t / t_boom, 0.0, 1.0) ** 2.2 * (t < t_boom)
    for ch in range(2):
        st[:, ch] += tv_bandpass(pink_noise(n, rng), 300.0 + 2200.0 * (t / t_boom), q=1.8) * intake_env * 0.35
    # Sonic boom sub-drop (165 -> 42 Hz)
    f_sub = 42.0 + 123.0 * np.exp(-dt / 0.075)
    ph_sub = 2.0 * np.pi * np.cumsum(f_sub * active) / SR
    boom = active * np.sin(ph_sub) * (1.0 - np.exp(-dt / 0.003)) * np.exp(-dt / 0.36)
    st[:, 0] += boom * 0.92
    st[:, 1] += boom * 0.92
    # 2. Supersonic afterburner slipstream jet surge
    for ch, det in [(0, 0.95), (1, 1.05)]:
        pn = pink_noise(n, rng)
        cf = (360.0 + 3400.0 * (1.0 - np.exp(-dt / 0.14)) * np.exp(-dt / 0.65)) * det
        jet = active * tv_bandpass(pn, cf, q=1.5) * (1.0 - np.exp(-dt / 0.006)) * np.exp(-dt / 0.45)
        st[:, ch] += jet * 0.72
    # 3. Crisp luminous plasma harmonic sheen (D5, A5, E6)
    st += chime_chord(n, [587.33, 880.0, 1318.5], [t_boom, t_boom + 0.03, t_boom + 0.07], decay_s=0.52) * 0.38
    return stereo_reverb(st, rt60=0.68, wet=0.26, seed=44)


def build_gm_boost_off() -> np.ndarray:
    dur = 0.76
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(505)
    st = np.zeros((n, 2), dtype=np.float64)
    # Smooth aerodynamic air-brake wind sweep down (2500 -> 210 Hz)
    for ch, det in [(0, 0.96), (1, 1.04)]:
        pn = pink_noise(n, rng)
        cf = (220.0 + 2300.0 * np.exp(-t / 0.22)) * det
        air = tv_bandpass(pn, cf, q=1.7) * env_ad(n, 0.04, 1.8)
        st[:, ch] += air * 0.65
    # Gentle sub-powerdown sweep (110 -> 48 Hz)
    f_sub = 48.0 + 62.0 * np.exp(-t / 0.18)
    ph = 2.0 * np.pi * np.cumsum(f_sub) / SR
    sub = np.sin(ph) * env_ad(n, 0.03, 2.2) * 0.45
    st[:, 0] += sub
    st[:, 1] += sub
    return stereo_reverb(st, rt60=0.45, wet=0.22, seed=55)


def build_gm_flight_loop() -> np.ndarray:
    """Seamless 3.2s looping airborne slipstream wind + warm subtle celestial energy hum."""
    dur = 3.2
    n = int(SR * dur)
    # Build extra tail and equal-power crossfade so loop seam is 100% mathematically seamless!
    xfade = int(SR * 0.55)
    n_ext = n + xfade
    t_ext = np.arange(n_ext) / SR
    rng = rng_seed(606)
    ext = np.zeros((n_ext, 2), dtype=np.float64)
    for ch, ph0 in [(0, 0.0), (1, 1.7)]:
        pn1 = pink_noise(n_ext, rng)
        pn2 = pink_noise(n_ext, rng)
        # Dual soft wind layers: warm low body (210-340 Hz) + silky high-altitude air (680-1120 Hz)
        cf_low = 265.0 + 65.0 * np.sin(2.0 * np.pi * t_ext / dur + ph0)
        cf_hi = 880.0 + 190.0 * np.sin(2.0 * np.pi * 2.0 * t_ext / dur + ph0 + 0.9)
        w_low = tv_bandpass(pn1, cf_low, q=1.5)
        w_hi = tv_bandpass(pn2, cf_hi, q=2.1)
        ext[:, ch] += w_low * 0.52 + w_hi * 0.24
    # Crossfade the tail into the start for zero click at loop boundary
    st = ext[:n].copy()
    w_in = np.sin(np.linspace(0.0, np.pi * 0.5, xfade))[:, None]
    w_out = np.cos(np.linspace(0.0, np.pi * 0.5, xfade))[:, None]
    st[:xfade] = st[:xfade] * w_in + ext[n : n + xfade] * w_out
    # Add exact integer-cycle warm celestial energy hum (D3=146.875, A3=220.0, D4=293.75 -> exact cycles in 3.2s!)
    t = np.arange(n) / SR
    for ch, pan_s in [(0, 0.0), (1, 0.35)]:
        lfo = 0.85 + 0.15 * np.sin(2.0 * np.pi * 1.0 * t / dur + pan_s)
        f1 = round(146.83 * dur) / dur
        f2 = round(220.00 * dur) / dur
        f3 = round(293.66 * dur) / dur
        hum = (
            0.55 * np.sin(2.0 * np.pi * f1 * t + pan_s)
            + 0.30 * np.sin(2.0 * np.pi * f2 * t - pan_s)
            + 0.15 * np.sin(2.0 * np.pi * f3 * t + pan_s * 1.5)
        ) * lfo
        st[:, ch] += hum * 0.16
    return st


def build_gm_heavy_strike() -> np.ndarray:
    dur = 1.12
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(707)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Heavy wind cleave (0..130ms) into colossal shockwave impact at t=0.11s
    t_hit = 0.11
    dt = np.maximum(0.0, t - t_hit)
    active = (t >= t_hit).astype(np.float64)
    for ch, det in [(0, 0.96), (1, 1.04)]:
        cleave = tv_bandpass(pink_noise(n, rng), (1900.0 * np.exp(-t / 0.09) + 220.0) * det, q=1.5)
        cleave *= np.sin(np.clip(t / 0.18, 0.0, 1.0) * np.pi)
        st[:, ch] += cleave * 0.55
    # 2. Titanic shockwave sub-impact (175 -> 36 Hz)
    f_sub = 36.0 + 139.0 * np.exp(-dt / 0.065)
    ph = 2.0 * np.pi * np.cumsum(f_sub * active) / SR
    boom = active * np.sin(ph) * (1.0 - np.exp(-dt / 0.0025)) * np.exp(-dt / 0.34)
    st[:, 0] += boom * 1.05
    st[:, 1] += boom * 1.05
    # 3. Impact crunch + golden bell-gong ring
    for ch, det in [(0, 0.98), (1, 1.02)]:
        crunch = active * tv_bandpass(rng.standard_normal(n), np.full(n, 920.0 * det), q=0.8) * np.exp(-dt / 0.13)
        st[:, ch] += crunch * 0.42
    st += chime_chord(n, [293.66, 440.0, 659.25], [t_hit, t_hit + 0.005, t_hit + 0.012], decay_s=0.62) * 0.42
    return stereo_reverb(st, rt60=0.78, wet=0.28, seed=77)


def build_gm_ki_blast() -> np.ndarray:
    dur = 1.38
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = rng_seed(808)
    st = np.zeros((n, 2), dtype=np.float64)
    # 1. Rapid celestial focus charge (0..115ms)
    t_fire = 0.115
    dt = np.maximum(0.0, t - t_fire)
    active = (t >= t_fire).astype(np.float64)
    f_chg = 293.66 + 587.33 * np.clip(t / t_fire, 0.0, 1.0) ** 2
    ph_chg = 2.0 * np.pi * np.cumsum(f_chg) / SR
    chg = (t < t_fire) * np.sin(ph_chg) * (t / t_fire) ** 1.5 * 0.35
    st[:, 0] += chg
    st[:, 1] += chg
    # 2. Thunderous energy beam discharge (185 -> 50 Hz punch + plasma torrent)
    f_sub = 50.0 + 135.0 * np.exp(-dt / 0.08)
    ph_sub = 2.0 * np.pi * np.cumsum(f_sub * active) / SR
    punch = active * np.sin(ph_sub) * (1.0 - np.exp(-dt / 0.003)) * np.exp(-dt / 0.38)
    st[:, 0] += punch * 0.90
    st[:, 1] += punch * 0.90
    for ch, det in [(0, 0.95), (1, 1.05)]:
        pn = pink_noise(n, rng)
        cf = (450.0 + 3300.0 * np.exp(-dt / 0.34)) * det
        beam_air = active * tv_bandpass(pn, cf, q=1.35) * (1.0 - np.exp(-dt / 0.005)) * np.exp(-dt / 0.48)
        st[:, ch] += beam_air * 0.68
    # 3. Radiant harmonic laser-bell beam core
    st += chime_chord(n, [587.33, 880.0, 1174.66, 1760.0], [t_fire, t_fire + 0.015, t_fire + 0.035, t_fire + 0.06], decay_s=0.68) * 0.48
    return stereo_reverb(st, rt60=0.88, wet=0.30, seed=88)


def main() -> None:
    print(f"Building mastered GameMaster SFX in {OUT_DIR} ...")
    tracks = [
        ("gm_transform.mp3",    build_gm_transform,    -1.5, False),
        ("gm_takeoff.mp3",      build_gm_takeoff,      -1.5, False),
        ("gm_land.mp3",         build_gm_land,         -1.5, False),
        ("gm_boost_on.mp3",     build_gm_boost_on,     -1.5, False),
        ("gm_boost_off.mp3",    build_gm_boost_off,    -2.2, False),
        ("gm_flight_loop.mp3",  build_gm_flight_loop,  -4.5, True),
        ("gm_heavy_strike.mp3", build_gm_heavy_strike, -1.2, False),
        ("gm_ki_blast.mp3",     build_gm_ki_blast,     -1.4, False),
    ]
    total = 0
    for name, fn, db, loop_safe in tracks:
        p = OUT_DIR / name
        master_and_save(fn(), p, target_db=db, loop_safe=loop_safe)
        total += p.stat().st_size
    print(f"Done! 8 mastered stereo MP3s ({total / 1024:.1f} KB total)")


if __name__ == "__main__":
    main()
