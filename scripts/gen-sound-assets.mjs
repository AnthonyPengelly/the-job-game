#!/usr/bin/env node
/**
 * scripts/gen-sound-assets.mjs
 *
 * Deterministic PCM WAV audio synthesiser for The Job sound assets.
 * Self-authored, CC0. No external dependencies, no network access.
 *
 * Run: node scripts/gen-sound-assets.mjs
 * Output: src/platform/audio/sounds/*.wav
 *
 * Reproducibility: all randomness uses a seeded LCG — same script == same bytes.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../src/platform/audio/sounds');

const SR = 22050; // sample rate (Hz)

// ── WAV writer ──────────────────────────────────────────────────────────────

/** Write a 16-bit mono PCM WAV file from a Float32Array of samples in [-1, 1]. */
function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes/sample
  const buf = Buffer.alloc(44 + dataSize);
  let p = 0;

  buf.write('RIFF', p); p += 4;
  buf.writeUInt32LE(36 + dataSize, p); p += 4;
  buf.write('WAVE', p); p += 4;
  buf.write('fmt ', p); p += 4;
  buf.writeUInt32LE(16, p); p += 4;   // chunk size
  buf.writeUInt16LE(1, p); p += 2;    // PCM
  buf.writeUInt16LE(1, p); p += 2;    // mono
  buf.writeUInt32LE(SR, p); p += 4;
  buf.writeUInt32LE(SR * 2, p); p += 4; // byte rate
  buf.writeUInt16LE(2, p); p += 2;    // block align
  buf.writeUInt16LE(16, p); p += 2;   // bits/sample
  buf.write('data', p); p += 4;
  buf.writeUInt32LE(dataSize, p); p += 4;

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), p);
    p += 2;
  }

  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, buf);
  console.log(`  ${filename.padEnd(28)} ${(numSamples / SR).toFixed(2)}s  ${buf.length} bytes`);
}

// ── DSP helpers ─────────────────────────────────────────────────────────────

/** Deterministic LCG noise (Numerical Recipes). Seed must be a non-zero integer. */
function makeLcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0x80000000) - 1.0; // [-1, 1)
  };
}

/** Allocate n-sample buffer and optionally fill with LCG noise scaled by amp. */
function buf(n, noiseAmp = 0, seed = 0) {
  const out = new Float32Array(n);
  if (noiseAmp > 0) {
    const rng = makeLcg(seed || 0x1a2b3c4d);
    for (let i = 0; i < n; i++) out[i] = rng() * noiseAmp;
  }
  return out;
}

/** First-order low-pass filter in-place. */
function lowpass(samples, cutoff) {
  const alpha = (1 / (2 * Math.PI * cutoff)) + (1 / SR);
  const a = (1 / SR) / alpha;
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev += a * (samples[i] - prev);
    samples[i] = prev;
  }
  return samples;
}

/** Scale in-place so peak is at most targetPeak. */
function normalise(samples, targetPeak = 0.9) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak > 0) {
    const g = targetPeak / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= g;
  }
  return samples;
}

/** Exponential decay envelope starting at 1.0. */
function expDecay(i, halfLifeSec) { return Math.exp(-i / (SR * halfLifeSec)); }

// ── Asset definitions ────────────────────────────────────────────────────────

console.log('\nGenerating The Job sound assets...\n');

// ── 1. ambient-drone (1.5 s loop) ──────────────────────────────────────────
{
  const n = Math.round(SR * 1.5);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const lfo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.4 * i / SR);
    out[i] = lfo * (
      0.50 * Math.sin(2 * Math.PI * 55  * i / SR) +
      0.30 * Math.sin(2 * Math.PI * 82  * i / SR) +
      0.20 * Math.sin(2 * Math.PI * 110 * i / SR)
    );
  }
  normalise(out, 0.7);
  writeWav('ambient-drone.wav', out);
}

// ── 2. ambient-heartbeat (1.2 s loop, two-beat) ────────────────────────────
{
  const n = Math.round(SR * 1.2);
  const out = buf(n);
  function addBeat(startSec, amp) {
    const s0 = Math.round(startSec * SR);
    for (let i = 0; i < Math.round(SR * 0.12) && s0 + i < n; i++) {
      out[s0 + i] += amp * expDecay(i, 0.04) *
        Math.sin(2 * Math.PI * 70 * i / SR);
    }
  }
  addBeat(0.05, 0.85);
  addBeat(0.25, 0.55);
  normalise(out, 0.85);
  writeWav('ambient-heartbeat.wav', out);
}

// ── 3. sfx-lock (0.5 s) — sharp click + metallic ring ─────────────────────
{
  const n = Math.round(SR * 0.5);
  const rng = makeLcg(0xDEADBEEF);
  const out = buf(n);
  // click transient
  for (let i = 0; i < Math.round(SR * 0.008); i++) {
    out[i] += rng() * expDecay(i, 0.003);
  }
  // metallic ring
  for (let i = 0; i < n; i++) {
    out[i] += 0.5 * expDecay(i, 0.08) *
      Math.sin(2 * Math.PI * 1200 * i / SR);
  }
  normalise(out, 0.85);
  writeWav('sfx-lock.wav', out);
}

// ── 4. sfx-footstep (0.35 s) — low thud ───────────────────────────────────
{
  const n = Math.round(SR * 0.35);
  const rng = makeLcg(0xFACECAFE);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const freq = 200 - 130 * (i / n);
    out[i] = 0.7 * expDecay(i, 0.07) * Math.sin(2 * Math.PI * freq * i / SR);
    if (i < Math.round(SR * 0.025)) out[i] += 0.35 * rng() * expDecay(i, 0.01);
  }
  normalise(out, 0.85);
  writeWav('sfx-footstep.wav', out);
}

// ── 5. sting-win (1.5 s) — ascending C major arpeggio ─────────────────────
{
  const n = Math.round(SR * 1.5);
  const out = buf(n);
  const freqs = [261.63, 329.63, 392.0, 523.25];
  const spacing = Math.round(SR * 0.22);
  const noteDur = Math.round(SR * 0.8);
  for (let ni = 0; ni < freqs.length; ni++) {
    const s0 = ni * spacing;
    for (let i = 0; i < noteDur && s0 + i < n; i++) {
      out[s0 + i] += 0.28 * expDecay(i, 0.35) *
        Math.sin(2 * Math.PI * freqs[ni] * i / SR);
    }
  }
  normalise(out, 0.9);
  writeWav('sting-win.wav', out);
}

// ── 6. sting-bust (1.2 s) — descending minor ──────────────────────────────
{
  const n = Math.round(SR * 1.2);
  const out = buf(n);
  const freqs = [440.0, 349.23, 293.66, 246.94]; // A4, F4, D4, B3
  const spacing = Math.round(SR * 0.18);
  const noteDur = Math.round(SR * 0.65);
  for (let ni = 0; ni < freqs.length; ni++) {
    const s0 = ni * spacing;
    for (let i = 0; i < noteDur && s0 + i < n; i++) {
      out[s0 + i] += 0.28 * expDecay(i, 0.28) * (
        Math.sin(2 * Math.PI * freqs[ni] * i / SR) +
        0.45 * Math.sin(2 * Math.PI * freqs[ni] * 1.5 * i / SR)
      );
    }
  }
  normalise(out, 0.9);
  writeWav('sting-bust.wav', out);
}

// ── 7. danger-alarm (2.0 s loop) — oscillating siren ──────────────────────
{
  const n = Math.round(SR * 2.0);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * i / SR);
    const freq = 380 + 380 * lfo;
    out[i] = 0.7 * Math.sin(2 * Math.PI * freq * i / SR);
  }
  normalise(out, 0.85);
  writeWav('danger-alarm.wav', out);
}

// ── 8. finale-escape (2.0 s) — engine rumble with acceleration ─────────────
{
  const n = Math.round(SR * 2.0);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 80 + 130 * t * t;
    const envAmp = 0.3 + 0.7 * t;
    out[i] = envAmp * (
      0.55 * Math.sin(2 * Math.PI * freq       * i / SR) +
      0.35 * Math.sin(2 * Math.PI * freq * 2.0 * i / SR) +
      0.10 * Math.sin(2 * Math.PI * freq * 3.0 * i / SR)
    );
  }
  normalise(out, 0.85);
  writeWav('finale-escape.wav', out);
}

// ── 9. finale-credits (2.0 s) — triumphant G-major chord ──────────────────
{
  const n = Math.round(SR * 2.0);
  const out = buf(n);
  const freqs = [392.0, 493.88, 587.33, 784.0]; // G4, B4, D5, G5
  for (const freq of freqs) {
    for (let i = 0; i < n; i++) {
      out[i] += (0.25 / freqs.length) * expDecay(i, 0.8) *
        Math.sin(2 * Math.PI * freq * i / SR);
    }
  }
  normalise(out, 0.85);
  writeWav('finale-credits.wav', out);
}

// ── 10. sfx-tick (0.5 s) — sharp clock tick ───────────────────────────────
{
  const n = Math.round(SR * 0.5);
  const out = buf(n);
  const tickLen = Math.round(SR * 0.018);
  for (let i = 0; i < tickLen; i++) {
    out[i] = expDecay(i, 0.005) *
      Math.sin(2 * Math.PI * 1800 * i / SR) * 0.9;
  }
  normalise(out, 0.9);
  writeWav('sfx-tick.wav', out);
}

// ── 11. sfx-wiresnip (0.3 s) — snip transient + short ring ────────────────
{
  const n = Math.round(SR * 0.3);
  const rng = makeLcg(0xC0FFEE);
  const out = buf(n);
  const transientLen = Math.round(SR * 0.025);
  for (let i = 0; i < transientLen; i++) {
    out[i] += rng() * expDecay(i, 0.006);
  }
  for (let i = 0; i < n; i++) {
    out[i] += 0.45 * expDecay(i, 0.045) *
      Math.sin(2 * Math.PI * 850 * i / SR);
  }
  normalise(out, 0.85);
  writeWav('sfx-wiresnip.wav', out);
}

// ── 12. sting-clean (0.8 s) — quick two-note positive cue ─────────────────
{
  const n = Math.round(SR * 0.8);
  const out = buf(n);
  const notes = [{ f: 392.0, s: 0 }, { f: 523.25, s: Math.round(SR * 0.25) }];
  for (const { f, s } of notes) {
    const dur = Math.round(SR * 0.4);
    for (let i = 0; i < dur && s + i < n; i++) {
      out[s + i] += 0.4 * expDecay(i, 0.2) *
        Math.sin(2 * Math.PI * f * i / SR);
    }
  }
  normalise(out, 0.85);
  writeWav('sting-clean.wav', out);
}

// ── 13. sting-complication (0.8 s) — tense minor-2nd dissonance ───────────
{
  const n = Math.round(SR * 0.8);
  const out = buf(n);
  const freqs = [440.0, 466.16]; // A4, Bb4 — minor 2nd
  for (const freq of freqs) {
    for (let i = 0; i < n; i++) {
      out[i] += 0.32 * expDecay(i, 0.3) *
        Math.sin(2 * Math.PI * freq * i / SR);
    }
  }
  normalise(out, 0.85);
  writeWav('sting-complication.wav', out);
}

// ── 14. sting-botch (0.8 s) — descending low warning ─────────────────────
{
  const n = Math.round(SR * 0.8);
  const out = buf(n);
  const notes = [{ f: 220.0, s: 0 }, { f: 174.61, s: Math.round(SR * 0.3) }];
  for (const { f, s } of notes) {
    const dur = Math.round(SR * 0.4);
    for (let i = 0; i < dur && s + i < n; i++) {
      out[s + i] += 0.38 * expDecay(i, 0.22) * (
        Math.sin(2 * Math.PI * f       * i / SR) +
        0.5 * Math.sin(2 * Math.PI * f * 2.0 * i / SR)
      );
    }
  }
  normalise(out, 0.85);
  writeWav('sting-botch.wav', out);
}

// ── 15. sfx-chaching (0.6 s) — coin/loot metallic ring ───────────────────
{
  const n = Math.round(SR * 0.6);
  const out = buf(n);
  const freqs = [1046.5, 1318.5, 1568.0]; // C6, E6, G6 — bright metallic chord
  for (const freq of freqs) {
    for (let i = 0; i < n; i++) {
      out[i] += (0.35 / freqs.length) * expDecay(i, 0.13) *
        Math.sin(2 * Math.PI * freq * i / SR);
    }
  }
  normalise(out, 0.9);
  writeWav('sfx-chaching.wav', out);
}

// ── 16. sfx-gear (0.5 s) — gear-receive chime ────────────────────────────
{
  const n = Math.round(SR * 0.5);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    out[i] = expDecay(i, 0.18) * (
      0.55 * Math.sin(2 * Math.PI * 880.0 * i / SR) +
      0.30 * Math.sin(2 * Math.PI * 1320.0 * i / SR)
    );
  }
  normalise(out, 0.85);
  writeWav('sfx-gear.wav', out);
}

// ── 17. finale-engine (1.5 s loop) — idling engine rumble ─────────────────
{
  const n = Math.round(SR * 1.5);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const lfo = 0.88 + 0.12 * Math.sin(2 * Math.PI * 6 * i / SR);
    const freq = 100;
    out[i] = lfo * 0.65 * (
      0.60 * Math.sin(2 * Math.PI * freq       * i / SR) +
      0.30 * Math.sin(2 * Math.PI * freq * 2.0 * i / SR) +
      0.10 * Math.sin(2 * Math.PI * freq * 3.0 * i / SR)
    );
  }
  normalise(out, 0.8);
  writeWav('finale-engine.wav', out);
}

// ── 18. finale-tyres (1.0 s) — tyre screech ───────────────────────────────
{
  const n = Math.round(SR * 1.0);
  const rng = makeLcg(0x7EEDFACE);
  const rawNoise = new Float32Array(n);
  for (let i = 0; i < n; i++) rawNoise[i] = rng();
  lowpass(rawNoise, 3500);

  const out = buf(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.exp(-t * 1.5);
    const hiFreq = 1100 + 350 * Math.sin(2 * Math.PI * 2.5 * i / SR);
    out[i] = 0.45 * rawNoise[i] * env +
             0.45 * env * Math.sin(2 * Math.PI * hiFreq * i / SR);
  }
  normalise(out, 0.85);
  writeWav('finale-tyres.wav', out);
}

// ── 19. danger-siren (2.4 s loop) — two-tone police hi-lo ──────────────────
{
  const n = Math.round(SR * 2.4);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    // Hi-lo alternation at 1.25 Hz: 0.4 s per tone, hard switch like a
    // European siren; slight detuned second osc for body.
    const phase = Math.floor((i / SR) / 0.4) % 2;
    const freq = phase === 0 ? 660 : 880;
    out[i] = 0.55 * Math.sin(2 * Math.PI * freq * i / SR) +
             0.25 * Math.sin(2 * Math.PI * (freq * 1.01) * i / SR);
  }
  normalise(out, 0.8);
  writeWav('danger-siren.wav', out);
}

// ── 20. danger-helicopter (1.6 s loop) — rotor chop ────────────────────────
{
  const n = Math.round(SR * 1.6);
  const rng = makeLcg(0xBEEFCAFE);
  const rawNoise = new Float32Array(n);
  for (let i = 0; i < n; i++) rawNoise[i] = rng();
  lowpass(rawNoise, 320);

  const out = buf(n);
  for (let i = 0; i < n; i++) {
    // Rotor chop: noise amplitude-gated at 12.5 Hz (20 chops per loop —
    // integer count keeps the loop seamless), plus a low body thrum.
    const chop = Math.max(0, Math.sin(2 * Math.PI * 12.5 * i / SR));
    const gate = Math.pow(chop, 3);
    out[i] = 0.8 * rawNoise[i] * gate +
             0.22 * Math.sin(2 * Math.PI * 55 * i / SR);
  }
  normalise(out, 0.8);
  writeWav('danger-helicopter.wav', out);
}

// ── 21. sfx-radio-chatter (1.8 s) — squelch + voice-band bursts ────────────
{
  const n = Math.round(SR * 1.8);
  const rng = makeLcg(0x5EC0FDE5);
  const rawNoise = new Float32Array(n);
  for (let i = 0; i < n; i++) rawNoise[i] = rng();
  lowpass(rawNoise, 2200);

  const out = buf(n);
  // Squelch click on, three speech-like bursts, squelch click off.
  function click(startSec) {
    const s0 = Math.round(startSec * SR);
    for (let i = 0; i < Math.round(SR * 0.015) && s0 + i < n; i++) {
      out[s0 + i] += 0.8 * expDecay(i, 0.004) *
        Math.sin(2 * Math.PI * 2400 * i / SR);
    }
  }
  // Speech-like rhythm: amplitude follows syllable bumps (~7 Hz) inside bursts.
  const bursts = [
    { start: 0.08, dur: 0.45 },
    { start: 0.65, dur: 0.30 },
    { start: 1.08, dur: 0.50 },
  ];
  for (const { start, dur } of bursts) {
    const s0 = Math.round(start * SR);
    const len = Math.round(dur * SR);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const syll = 0.45 + 0.55 * Math.max(0, Math.sin(2 * Math.PI * 7 * i / SR));
      // Band shaping: ring the lowpassed noise at a voice-ish carrier.
      out[s0 + i] += 0.6 * rawNoise[s0 + i] * syll *
        (0.7 + 0.3 * Math.sin(2 * Math.PI * 300 * i / SR));
    }
  }
  click(0.02);
  click(1.72);
  normalise(out, 0.8);
  writeWav('sfx-radio-chatter.wav', out);
}

// ── 22. ambient-tension (2.4 s loop) — minigame-timer bed layer ────────────
{
  const n = Math.round(SR * 2.4);
  const out = buf(n);
  for (let i = 0; i < n; i++) {
    // Minor-second drone (110 + 116.5 Hz beats at ~6.5 Hz) — unease without
    // melody — plus a quiet eighth-note pulse at 2.5 Hz (integer cycles per
    // loop for a seamless join).
    const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 2.5 * i / SR)), 8);
    out[i] =
      0.30 * Math.sin(2 * Math.PI * 110.0 * i / SR) +
      0.30 * Math.sin(2 * Math.PI * 116.5 * i / SR) +
      0.25 * pulse * Math.sin(2 * Math.PI * 440 * i / SR);
  }
  normalise(out, 0.65);
  writeWav('ambient-tension.wav', out);
}

console.log('\nAll assets written.\n');
