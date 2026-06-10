import { describe, it, expect, vi } from 'vitest';
import type { ParsedSoundManifest } from '@/content/schema';
import { createAudioEngine } from './engine';

// ── Mock AudioBuffer ──────────────────────────────────────────────────────────

class MockAudioBuffer {
  readonly length = 1;
  readonly sampleRate = 44100;
  readonly numberOfChannels = 1;
  readonly duration = 0.001;
}

// ── Mock GainNode ─────────────────────────────────────────────────────────────

class MockAudioParam {
  value = 1;
  private _timeSeries: Array<{ v: number; t: number }> = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this._timeSeries.push({ v: value, t: time });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number) {
    void timeConstant;
    // Approximate: for testing, treat as immediate set
    this.value = target;
    this._timeSeries.push({ v: target, t: startTime });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number) {
    void endTime;
    this.value = value;
    return this;
  }

  /** Last value assigned */
  get lastValue(): number {
    const last = this._timeSeries[this._timeSeries.length - 1];
    return last !== undefined ? last.v : this.value;
  }
}

class MockGainNode {
  gain = new MockAudioParam();
  connected: MockGainNode | MockDestinationNode | null = null;

  connect(target: MockGainNode | MockDestinationNode) {
    this.connected = target;
    return target;
  }
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;

  connect(target: MockGainNode | MockDestinationNode) {
    return target;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
    this.onended?.();
  }
}

class MockDestinationNode {}

// ── Mock AudioContext ─────────────────────────────────────────────────────────

class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;
  destination = new MockDestinationNode();

  readonly gainNodes: MockGainNode[] = [];
  readonly sourceNodes: MockAudioBufferSourceNode[] = [];

  createGain(): MockGainNode {
    const n = new MockGainNode();
    this.gainNodes.push(n);
    return n;
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const n = new MockAudioBufferSourceNode();
    this.sourceNodes.push(n);
    return n;
  }

  async decodeAudioData(buf: ArrayBuffer): Promise<MockAudioBuffer> {
    void buf;
    return new MockAudioBuffer();
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeManifest(): ParsedSoundManifest {
  return {
    cues: [
      { id: 'ambient-drone', src: 'sound/ambient-drone.wav', channel: 'ambient', loop: true, gain: 0.6, phases: ['briefing'] },
      { id: 'ambient-heartbeat', src: 'sound/ambient-heartbeat.wav', channel: 'ambient', loop: true, gain: 0.8, phases: ['briefing'] },
      { id: 'sfx-lock', src: 'sound/sfx-lock.wav', channel: 'heistSfx', gain: 1.0, phases: ['room'] },
      { id: 'sting-win', src: 'sound/sting-win.wav', channel: 'sting', gain: 1.0, phases: ['result'] },
      { id: 'danger-alarm', src: 'sound/danger-alarm.wav', channel: 'danger', loop: true, gain: 1.0, phases: ['room'] },
      { id: 'finale-escape', src: 'sound/finale-escape.wav', channel: 'finale', gain: 1.0, phases: ['getaway'] },
    ],
    ambientBed: { droneId: 'ambient-drone', heartbeatId: 'ambient-heartbeat' },
  };
}

function makeEngine(manifest = makeManifest(), failCue?: string) {
  const mockCtx = new MockAudioContext();
  const engine = createAudioEngine(manifest, {
    createAudioContext: () => mockCtx as unknown as AudioContext,
    fetchBuffer: async (src: string) => {
      if (failCue && src.includes(failCue)) {
        throw new Error(`Simulated fetch failure: ${src}`);
      }
      return new ArrayBuffer(8);
    },
  });
  return { engine, mockCtx };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AudioEngine', () => {
  describe('preload', () => {
    it('marks all cues available after successful preload', async () => {
      const { engine } = makeEngine();
      await engine.preload();
      expect(engine.loaded).toBe(true);
    });

    it('engine remains usable when one cue decode fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { engine } = makeEngine(makeManifest(), 'sfx-lock');
      await engine.preload();
      expect(engine.loaded).toBe(true);
      // Should log the failure for the failing cue
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AudioEngine]') &&
          expect.stringContaining('sfx-lock'),
        expect.anything(),
      );
      warnSpy.mockRestore();
    });

    it('does not throw when a cue fails — engine still operates', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { engine } = makeEngine(makeManifest(), 'sfx-lock');
      await expect(engine.preload()).resolves.toBeUndefined();
      // Available cues should still play without throwing
      expect(() => engine.play('sting-win')).not.toThrow();
      vi.restoreAllMocks();
    });
  });

  describe('play / stop', () => {
    it('play() starts an AudioBufferSourceNode for an available cue', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.play('sfx-lock');
      const started = mockCtx.sourceNodes.filter((n) => n.started);
      // At least one source was started (ambient bed + sfx-lock)
      expect(started.length).toBeGreaterThan(0);
    });

    it('play() is a no-op for an unknown cue', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      const countBefore = mockCtx.sourceNodes.filter((n) => n.started).length;
      engine.play('does-not-exist');
      const countAfter = mockCtx.sourceNodes.filter((n) => n.started).length;
      expect(countAfter).toBe(countBefore);
    });

    it('play() is a no-op for a cue whose decode failed', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { engine, mockCtx } = makeEngine(makeManifest(), 'sfx-lock');
      await engine.preload();
      const countBefore = mockCtx.sourceNodes.filter((n) => n.started).length;
      engine.play('sfx-lock');
      expect(mockCtx.sourceNodes.filter((n) => n.started).length).toBe(countBefore);
      vi.restoreAllMocks();
    });

    it('stop() stops the active source for a cue', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.play('sfx-lock');
      const sfxSources = mockCtx.sourceNodes.filter((n) => n.started && !n.stopped);
      expect(sfxSources.length).toBeGreaterThan(0);
      engine.stop('sfx-lock');
      const sfxAfterStop = mockCtx.sourceNodes.filter((n) => n.started && !n.stopped);
      // The sfx-lock source should now be stopped
      expect(sfxAfterStop.length).toBeLessThan(sfxSources.length);
    });
  });

  describe('gain routing', () => {
    it('setMasterGain sets gain on master GainNode', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setMasterGain(0.5);
      // Master gain is the first gain node created (connected to destination)
      const masterGainNode = mockCtx.gainNodes.find(
        (g) => g.connected instanceof MockDestinationNode,
      );
      expect(masterGainNode).toBeDefined();
      expect(masterGainNode!.gain.lastValue).toBe(0.5);
    });

    it('mute(true) sets master gain to 0', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.mute(true);
      const masterGainNode = mockCtx.gainNodes.find(
        (g) => g.connected instanceof MockDestinationNode,
      );
      expect(masterGainNode!.gain.lastValue).toBe(0);
    });

    it('mute(false) restores master gain to 1', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.mute(true);
      engine.mute(false);
      const masterGainNode = mockCtx.gainNodes.find(
        (g) => g.connected instanceof MockDestinationNode,
      );
      expect(masterGainNode!.gain.lastValue).toBe(1);
    });

    it('setChannelGain updates the gain for the named channel', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setChannelGain('heistSfx', 0.3);
      // There should be a gain node with value 0.3 among channel gains
      const updated = mockCtx.gainNodes.find((g) => g.gain.lastValue === 0.3);
      expect(updated).toBeDefined();
    });
  });

  describe('ambient bed', () => {
    it('setAmbient(0) ramps drone to ~1 and heartbeat to ~0', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setAmbient(0);
      const droneGainNode = mockCtx.gainNodes.find((g) => g.gain.lastValue === 1);
      const heartbeatGainNode = mockCtx.gainNodes.find((g) => g.gain.lastValue === 0);
      expect(droneGainNode).toBeDefined();
      expect(heartbeatGainNode).toBeDefined();
    });

    it('setAmbient(1) ramps drone to ~0 and heartbeat to ~1', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setAmbient(1);
      // drone → 0, heartbeat → 1
      const droneVal = 0;
      const hbVal = 1;
      expect(
        mockCtx.gainNodes.some((g) => g.gain.lastValue === droneVal),
      ).toBe(true);
      expect(
        mockCtx.gainNodes.some((g) => g.gain.lastValue === hbVal),
      ).toBe(true);
    });

    it('setAmbient(0.5) sets both drone and heartbeat to 0.5', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setAmbient(0.5);
      const halfGains = mockCtx.gainNodes.filter((g) => g.gain.lastValue === 0.5);
      // both drone (1-0.5=0.5) and heartbeat (0.5) should be 0.5
      expect(halfGains.length).toBeGreaterThanOrEqual(2);
    });

    it('setAmbient clamps values outside 0..1', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      engine.setAmbient(-0.5); // should clamp to 0
      expect(mockCtx.gainNodes.some((g) => g.gain.lastValue === 1)).toBe(true); // drone=1
      engine.setAmbient(2.0);  // should clamp to 1
      expect(mockCtx.gainNodes.some((g) => g.gain.lastValue === 1)).toBe(true); // heartbeat=1
    });
  });

  describe('no-context fallback', () => {
    it('does not throw when AudioContext creation fails', async () => {
      const manifest = makeManifest();
      const engine = createAudioEngine(manifest, {
        createAudioContext: () => {
          throw new Error('AudioContext not supported');
        },
        fetchBuffer: async () => new ArrayBuffer(8),
      });
      await expect(engine.preload()).resolves.toBeUndefined();
      expect(engine.loaded).toBe(true);
    });

    it('play/stop/setMasterGain/mute/setAmbient are all no-ops without a context', async () => {
      const manifest = makeManifest();
      const engine = createAudioEngine(manifest, {
        createAudioContext: () => {
          throw new Error('AudioContext not supported');
        },
        fetchBuffer: async () => new ArrayBuffer(8),
      });
      await engine.preload();
      expect(() => {
        engine.play('sfx-lock');
        engine.stop('sfx-lock');
        engine.setMasterGain(0.5);
        engine.mute(true);
        engine.setAmbient(0.7);
        engine.setChannelGain('ambient', 0.2);
      }).not.toThrow();
    });
  });

  describe('isCueAvailable', () => {
    it('returns false for an unknown cue id before preload', () => {
      const { engine } = makeEngine();
      expect(engine.isCueAvailable('does-not-exist')).toBe(false);
    });

    it('returns false for all cues before preload (available not yet set)', () => {
      const { engine } = makeEngine();
      // cue map is populated during preload, so before preload nothing is available
      expect(engine.isCueAvailable('sfx-lock')).toBe(false);
    });

    it('returns true for a successfully loaded cue after preload', async () => {
      const { engine } = makeEngine();
      await engine.preload();
      expect(engine.isCueAvailable('sfx-lock')).toBe(true);
    });

    it('returns false for a cue whose decode failed', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { engine } = makeEngine(makeManifest(), 'sfx-lock');
      await engine.preload();
      expect(engine.isCueAvailable('sfx-lock')).toBe(false);
      vi.restoreAllMocks();
    });

    it('returns true for other cues when one cue fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { engine } = makeEngine(makeManifest(), 'sfx-lock');
      await engine.preload();
      expect(engine.isCueAvailable('sting-win')).toBe(true);
      vi.restoreAllMocks();
    });

    it('returns false for an unknown cue id after preload', async () => {
      const { engine } = makeEngine();
      await engine.preload();
      expect(engine.isCueAvailable('not-a-real-cue')).toBe(false);
    });

    it('returns false when AudioContext creation fails', async () => {
      const manifest = makeManifest();
      const engine = createAudioEngine(manifest, {
        createAudioContext: () => { throw new Error('no ctx'); },
        fetchBuffer: async () => new ArrayBuffer(8),
      });
      await engine.preload();
      // No context → no decode → all cues remain unavailable
      expect(engine.isCueAvailable('sfx-lock')).toBe(false);
    });
  });

  describe('clock', () => {
    it('exposes a clock whose now() reflects the audio context currentTime', async () => {
      const { engine, mockCtx } = makeEngine();
      await engine.preload();
      mockCtx.currentTime = 3.5;
      expect(engine.clock.now()).toBe(3.5);
    });

    it('scheduleAt fires callback in order when time advances', async () => {
      vi.useFakeTimers();
      const { engine, mockCtx } = makeEngine();
      await engine.preload();

      const fired: number[] = [];
      mockCtx.currentTime = 0;
      engine.clock.start();

      engine.clock.scheduleAt(0.5, () => fired.push(1));
      engine.clock.scheduleAt(1.0, () => fired.push(2));
      engine.clock.scheduleAt(0.8, () => fired.push(3));

      // Nothing fires yet
      vi.advanceTimersByTime(25);
      expect(fired).toEqual([]);

      // Advance audio clock so lookahead window covers 0.5
      mockCtx.currentTime = 0.41;
      vi.advanceTimersByTime(25);
      expect(fired).toEqual([1]);

      // Advance to cover 0.8
      mockCtx.currentTime = 0.71;
      vi.advanceTimersByTime(25);
      expect(fired).toEqual([1, 3]);

      // Advance to cover 1.0
      mockCtx.currentTime = 0.91;
      vi.advanceTimersByTime(25);
      expect(fired).toEqual([1, 3, 2]);

      engine.clock.stop();
      vi.useRealTimers();
    });
  });
});
