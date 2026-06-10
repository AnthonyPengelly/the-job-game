# Audio Credits

All audio assets bundled in **The Job** are self-authored, procedurally synthesised, and released under **Creative Commons Zero (CC0 1.0 Universal)**. No third-party or CDN content is used.

## Generator

Assets are produced by `scripts/gen-sound-assets.mjs` — a deterministic PCM WAV synthesiser with no external dependencies or network access. Running the script reproduces the committed bytes exactly (same Node.js built-ins, same LCG seed constants, no `Date.now()` or `Math.random()`).

```
node scripts/gen-sound-assets.mjs
```

## Asset inventory

| File | Description | Duration | Channel |
|------|-------------|----------|---------|
| `ambient-drone.wav` | Low drone with slow LFO modulation | 1.5 s (loop) | ambient |
| `ambient-heartbeat.wav` | Two-beat pulse at ≈60 BPM | 1.2 s (loop) | ambient |
| `sfx-lock.wav` | Lock click with metallic resonance | 0.5 s | heistSfx |
| `sfx-footstep.wav` | Low thud footstep | 0.35 s | heistSfx |
| `sfx-tick.wav` | Sharp clock tick | 0.5 s (loop) | heistSfx |
| `sfx-wiresnip.wav` | Wire-snip transient + ring | 0.3 s | heistSfx |
| `sfx-chaching.wav` | Loot cha-ching metallic chord | 0.6 s | heistSfx |
| `sfx-gear.wav` | Gear-receive chime | 0.5 s | heistSfx |
| `sting-win.wav` | Ascending C-major arpeggio | 1.5 s | sting |
| `sting-bust.wav` | Descending minor fall | 1.2 s | sting |
| `sting-clean.wav` | Two-note positive cue | 0.8 s | sting |
| `sting-complication.wav` | Minor-2nd dissonant tension cue | 0.8 s | sting |
| `sting-botch.wav` | Descending low warning cue | 0.8 s | sting |
| `danger-alarm.wav` | Oscillating siren | 2.0 s (loop) | danger |
| `finale-escape.wav` | Engine rumble with acceleration | 2.0 s | finale |
| `finale-engine.wav` | Idling engine rumble | 1.5 s (loop) | finale |
| `finale-tyres.wav` | Tyre screech | 1.0 s | finale |
| `finale-credits.wav` | Triumphant G-major chord | 2.0 s | finale |

## Licence

**CC0 1.0 Universal** — To the extent possible under law, the authors have waived all copyright and related or neighbouring rights to these works.
