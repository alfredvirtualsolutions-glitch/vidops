#!/usr/bin/env python3
"""Repair a raw-AAC-in-WAV file and derive a bar-aligned cut list for reels.

Usage:
    python scripts/beat_sync_audio.py INPUT.wav OUT_DIR [--clip-seconds 1.0]

Writes OUT_DIR/<stem>_fixed.wav (plain 16-bit PCM) and OUT_DIR/<stem>.beats.json
({bpm, barSeconds, durationInSeconds, cuts}). The JSON feeds `buildBeatSyncedClips`
in lib/props.ts.

Requires: pip install av numpy scipy

Why the repair step exists: some exporters wrap raw AAC frames in a WAV header
(format tag 0x00FF). Demuxers cut those frames at the header's block size and fail.
Handing the whole data chunk to the AAC decoder as ONE packet works, because
libavcodec consumes it frame by frame.
"""
import argparse, json, struct, wave
from pathlib import Path

import av
import numpy as np
from scipy.signal import stft

FPS = 30
HOP, NFFT = 512, 2048


def read_chunks(raw: bytes):
    i, chunks = 12, {}
    while i < len(raw) - 8:
        cid, size = raw[i : i + 4], struct.unpack("<I", raw[i + 4 : i + 8])[0]
        chunks[cid] = raw[i + 8 : i + 8 + size]
        i += 8 + size + (size & 1)
    return chunks


def load_pcm(path: Path) -> tuple[np.ndarray, int]:
    """Return (samples shaped (n, 2) float32, sample_rate). Handles plain PCM and raw-AAC WAVs."""
    raw = path.read_bytes()
    chunks = read_chunks(raw)
    fmt = chunks[b"fmt "]
    tag, channels, rate = struct.unpack("<HHI", fmt[:8])
    if tag in (0x0001, 0xFFFE):
        with wave.open(str(path)) as w:
            pcm = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, w.getnchannels())
        return (pcm.astype(np.float32) / 32768), rate
    if tag != 0x00FF:
        raise SystemExit(f"Unsupported WAV format tag 0x{tag:04x}")
    cb = struct.unpack("<H", fmt[16:18])[0]
    ctx = av.CodecContext.create("aac", "r")
    ctx.sample_rate, ctx.layout, ctx.extradata = rate, "stereo" if channels == 2 else "mono", fmt[18 : 18 + cb]
    ctx.open()
    frames = [f.to_ndarray() for f in ctx.decode(av.Packet(chunks[b"data"]))]
    a = np.concatenate(frames, axis=1)  # (channels, n)
    return a.T.astype(np.float32), rate


def analyse(x: np.ndarray, sr: int, loud_rms: float = 0.075):
    mono = x.mean(1)
    _, _, Z = stft(mono, sr, nperseg=NFFT, noverlap=NFFT - HOP)
    S = np.log1p(10 * np.abs(Z))
    flux = np.r_[0, np.maximum(np.diff(S, axis=1), 0).sum(0)]
    flux = (flux - flux.mean()) / flux.std()
    fr = sr / HOP
    ac = np.correlate(flux, flux, "full")[len(flux) - 1 :]
    lo, hi = int(fr * 60 / 200), int(fr * 60 / 70)
    guess = 60 * fr / (lo + np.argmax(ac[lo:hi]))  # often the double-time pulse
    best = (-1e9, guess, 0.0)
    for b in np.arange(guess - 4, guess + 4, 0.02):
        per = fr * 60 / b
        for off in np.arange(0, per, 1.0):
            idx = (off + np.arange(0, len(flux) - per, per)).astype(int)
            s = flux[idx].sum()
            if s > best[0]:
                best = (s, b, off)
    _, fast_bpm, off = best
    per_s = 60 / fast_bpm  # seconds per double-time pulse
    # a 4/4 bar = 8 pulses; pick the bar phase (2-pulse steps) with the strongest onsets
    def score(o):
        idx = ((o + np.arange(0, len(flux) * HOP / sr / (per_s * 8)) * 8 * per_s) * fr).astype(int)
        return flux[idx[idx < len(flux)]].mean()
    o0 = off / fr
    phase = max(range(4), key=lambda k: score(o0 + k * 2 * per_s))
    first = o0 + phase * 2 * per_s
    bar = 8 * per_s
    dur = len(mono) / sr

    def rms(t):
        a, b = int(max(t - 1, 0) * sr), int(min(t + 1, dur) * sr)
        return float(np.sqrt((mono[a:b] ** 2).mean()))

    cuts, t = [0.0], first
    while t < dur - 0.5:
        if t > 0.3:
            cuts.append(t)
        t += bar / 2 if rms(t) > loud_rms else bar
    cuts.append(dur)
    q = [round(c * FPS) / FPS for c in cuts]
    return {"bpm": round(fast_bpm / 2, 2), "barSeconds": round(bar, 3), "durationInSeconds": round(dur, 2), "cuts": [round(c, 4) for c in dict.fromkeys(q)]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("out_dir", type=Path)
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    x, sr = load_pcm(args.input)
    stem = args.input.stem
    fixed = args.out_dir / f"{stem}_fixed.wav"
    with wave.open(str(fixed), "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    info = analyse(x, sr)
    (args.out_dir / f"{stem}.beats.json").write_text(json.dumps(info, indent=1))
    print(f"{fixed}  {info['durationInSeconds']}s  ~{info['bpm']} BPM  {len(info['cuts'])-1} cuts")


if __name__ == "__main__":
    main()
