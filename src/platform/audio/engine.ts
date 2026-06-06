/**
 * AudioEngine — framework-free Web Audio service.
 *
 * The console drives this; the engine layer never touches it.
 * Gracefully degrades when AudioContext is unavailable (headless/test/
 * unsupported browser): all operations become no-ops, no throws.
 */

import type { ParsedSoundManifest, SoundChannel, SoundCue } from '@/content/schema';
import { createClock } from './clock';
import type { AudioClock } from './clock';

// ── Internal cue state ────────────────────────────────────────────────────────

interface CueState {
  cue: SoundCue;
  buffer: AudioBuffer | null;
  /** false when fetch/decode failed */
  available: boolean;
  activeSource: AudioBufferSourceNode | null;
}

// ── Ambient-bed state ─────────────────────────────────────────────────────────

interface AmbientBedState {
  droneGain: GainNode;
  heartbeatGain: GainNode;
  droneSource: AudioBufferSourceNode | null;
  heartbeatSource: AudioBufferSourceNode | null;
}

// ── Public surface ────────────────────────────────────────────────────────────

export interface AudioEngine {
  /**
   * Preloads all cue buffers from the manifest. Tolerates per-cue failures:
   * failed cues are logged and marked unavailable; the engine remains usable.
   * Call after the first user gesture so the AudioContext can be created/resumed.
   */
  preload(): Promise<void>;

  /**
   * Resume the AudioContext (must be called from a user-gesture handler).
   * Safe to call before preload(); idempotent.
   */
  resume(): Promise<void>;

  /** Play a cue by id. No-op for unknown or unavailable cues. */
  play(cueId: string): void;

  /** Stop a currently playing cue by id. No-op if not playing. */
  stop(cueId: string): void;

  /** Set gain for a named channel (0..1). */
  setChannelGain(channel: SoundChannel, gain: number): void;

  /** Set master output gain (0..1). */
  setMasterGain(gain: number): void;

  /** Mute/unmute master output. */
  mute(on: boolean): void;

  /**
   * Crossfade the ambient bed.
   * `intensity` 0 → full drone, 1 → full heartbeat.
   * Mid-values produce a proportional crossfade via GainNode ramps.
   */
  setAmbient(intensity: number): void;

  /**
   * Schedule an oscillator beep at the given audio-clock time (seconds).
   * Used by the shared Metronome via AudioClockContext (E9.4).
   * No-op if no AudioContext is available.
   */
  scheduleBeep(when: number): void;

  /** The precise audio-clock scheduler for metronome use. */
  readonly clock: AudioClock;

  /** True after `preload()` completes (whether or not all cues succeeded). */
  readonly loaded: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface AudioEngineOptions {
  /**
   * Override fetch for testing. Receives the cue `src` path and must return
   * an ArrayBuffer (or throw to simulate a load failure).
   */
  fetchBuffer?: (src: string) => Promise<ArrayBuffer>;
  /**
   * Override AudioContext constructor for testing. If omitted, uses the
   * global `AudioContext` when available, or a no-op fallback.
   */
  createAudioContext?: () => AudioContext;
}

export function createAudioEngine(
  manifest: ParsedSoundManifest,
  opts: AudioEngineOptions = {},
): AudioEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let masterMuted = false;
  let _loaded = false;

  // Per-channel gain nodes
  const channelGains = new Map<SoundChannel, GainNode>();
  // Cue state keyed by cue id
  const cues = new Map<string, CueState>();
  // Ambient bed
  let bed: AmbientBedState | null = null;

  const CHANNELS: SoundChannel[] = ['ambient', 'heistSfx', 'sting', 'danger', 'finale'];

  // ── AudioContext creation ───────────────────────────────────────────────────

  function ensureContext(): boolean {
    if (ctx) return true;
    try {
      ctx = opts.createAudioContext
        ? opts.createAudioContext()
        : new AudioContext();
    } catch {
      ctx = null;
      return false;
    }

    // Master gain node → destination
    masterGain = ctx.createGain();
    masterGain.gain.value = masterMuted ? 0 : 1;
    masterGain.connect(ctx.destination);

    // Per-channel gains → master
    for (const ch of CHANNELS) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(masterGain);
      channelGains.set(ch, g);
    }

    // Ambient bed gain nodes (connected through the ambient channel)
    const ambientCh = channelGains.get('ambient')!;
    const droneGain = ctx.createGain();
    const heartbeatGain = ctx.createGain();
    droneGain.gain.value = 1;
    heartbeatGain.gain.value = 0;
    droneGain.connect(ambientCh);
    heartbeatGain.connect(ambientCh);
    bed = { droneGain, heartbeatGain, droneSource: null, heartbeatSource: null };

    clock = buildClock();
    clock.start();

    return true;
  }

  // ── Precise clock ───────────────────────────────────────────────────────────

  let clock: AudioClock = createClock({ getTime: () => 0 });

  function buildClock(): AudioClock {
    return createClock({ getTime: () => ctx?.currentTime ?? 0 });
  }

  // ── Buffer fetch ────────────────────────────────────────────────────────────

  async function fetchBuffer(src: string): Promise<ArrayBuffer> {
    if (opts.fetchBuffer) return opts.fetchBuffer(src);
    const resp = await fetch(src);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${src}`);
    return resp.arrayBuffer();
  }

  // ── Ambient bed helpers ─────────────────────────────────────────────────────

  function startAmbientSource(
    gainNode: GainNode,
    buf: AudioBuffer,
    loop: boolean,
  ): AudioBufferSourceNode {
    if (!ctx) throw new Error('no ctx');
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(gainNode);
    src.start();
    return src;
  }

  function startAmbientBed(): void {
    if (!ctx || !bed) return;
    const droneState = cues.get(manifest.ambientBed.droneId);
    const heartbeatState = cues.get(manifest.ambientBed.heartbeatId);

    if (droneState?.buffer && !bed.droneSource) {
      bed.droneSource = startAmbientSource(bed.droneGain, droneState.buffer, true);
    }
    if (heartbeatState?.buffer && !bed.heartbeatSource) {
      bed.heartbeatSource = startAmbientSource(
        bed.heartbeatGain,
        heartbeatState.buffer,
        true,
      );
    }
  }

  // ── Preload ─────────────────────────────────────────────────────────────────

  async function preload(): Promise<void> {
    ensureContext();

    if (ctx?.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // best-effort
      }
    }

    // Initialise cue state map from the manifest
    for (const cue of manifest.cues) {
      cues.set(cue.id, { cue, buffer: null, available: false, activeSource: null });
    }

    const loadCue = async (cueState: CueState) => {
      if (!ctx) return;
      try {
        const raw = await fetchBuffer(cueState.cue.src);
        const buf = await ctx.decodeAudioData(raw);
        cueState.buffer = buf;
        cueState.available = true;
      } catch (err) {
        // Log once; never throw — no dead-end at the table
        console.warn(`[AudioEngine] Failed to load cue "${cueState.cue.id}":`, err);
        cueState.available = false;
      }
    };

    await Promise.all([...cues.values()].map(loadCue));

    startAmbientBed();

    _loaded = true;
  }

  // ── Resume ─────────────────────────────────────────────────────────────────

  async function resume(): Promise<void> {
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // best-effort
      }
    }
  }

  // ── Play / Stop ────────────────────────────────────────────────────────────

  function play(cueId: string): void {
    if (!ctx) return;
    const state = cues.get(cueId);
    if (!state?.available || !state.buffer) return;

    const chGain = channelGains.get(state.cue.channel);
    if (!chGain) return;

    // Stop existing source if any
    if (state.activeSource) {
      try {
        state.activeSource.stop();
      } catch {
        // may already be stopped
      }
      state.activeSource = null;
    }

    const src = ctx.createBufferSource();
    src.buffer = state.buffer;
    src.loop = state.cue.loop ?? false;

    // Per-cue gain node to apply the cue's default gain
    const cueGain = ctx.createGain();
    cueGain.gain.value = state.cue.gain ?? 1;
    src.connect(cueGain);
    cueGain.connect(chGain);

    src.onended = () => {
      if (state.activeSource === src) state.activeSource = null;
    };

    src.start();
    state.activeSource = src;
  }

  function stop(cueId: string): void {
    const state = cues.get(cueId);
    if (!state?.activeSource) return;
    try {
      state.activeSource.stop();
    } catch {
      // already stopped
    }
    state.activeSource = null;
  }

  // ── Gain control ───────────────────────────────────────────────────────────

  function setChannelGain(channel: SoundChannel, gain: number): void {
    const g = channelGains.get(channel);
    if (!g || !ctx) return;
    g.gain.setValueAtTime(gain, ctx.currentTime);
  }

  function setMasterGain(gain: number): void {
    if (!masterGain || !ctx) return;
    masterGain.gain.setValueAtTime(gain, ctx.currentTime);
  }

  function mute(on: boolean): void {
    masterMuted = on;
    if (!masterGain || !ctx) return;
    masterGain.gain.setValueAtTime(on ? 0 : 1, ctx.currentTime);
  }

  // ── Ambient crossfade ──────────────────────────────────────────────────────

  function setAmbient(intensity: number): void {
    if (!bed || !ctx) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const now = ctx.currentTime;
    const rampTime = 0.05; // 50 ms ramp to avoid clicks
    bed.droneGain.gain.setTargetAtTime(1 - clamped, now, rampTime);
    bed.heartbeatGain.gain.setTargetAtTime(clamped, now, rampTime);
  }

  // ── Beep scheduler ────────────────────────────────────────────────────────

  function scheduleBeep(when: number): void {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      osc.start(when);
      osc.stop(when + 0.06);
    } catch {
      // AudioContext may be suspended or context may lack oscillator support — no-op
    }
  }

  return {
    preload,
    resume,
    play,
    stop,
    setChannelGain,
    setMasterGain,
    mute,
    setAmbient,
    scheduleBeep,
    get clock() {
      return clock;
    },
    get loaded() {
      return _loaded;
    },
  };
}
