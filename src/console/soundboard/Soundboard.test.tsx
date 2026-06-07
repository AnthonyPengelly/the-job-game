// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { RunPhase } from '@/engine';
import { AudioHandleContext, AudioSettingsContext } from '@/console/audio';
import type { AudioHandle, AudioSettingsHandle } from '@/console/audio';
import { soundManifestSchema } from '@/content/schema';
import { Soundboard } from './Soundboard';
import soundJson from '../../../presets/default/content/sound.json';

// ── Fixture ───────────────────────────────────────────────────────────────────

const manifest = soundManifestSchema.parse(soundJson);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function makeMockEngine(): AudioEngine {
  return {
    preload: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    setChannelGain: vi.fn(),
    setMasterGain: vi.fn(),
    mute: vi.fn(),
    setAmbient: vi.fn(),
    scheduleBeep: vi.fn(),
    clock: {
      now: vi.fn().mockReturnValue(0),
      scheduleAt: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
    get loaded() { return false; },
  };
}

/**
 * Renders Soundboard with a reactive AudioSettingsContext so that muted/volume
 * state updates from handler calls are reflected in the UI.
 */
function renderSoundboard(phase: RunPhase, engine: AudioEngine) {
  const storage = makeStorage();
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });

  const handle: AudioHandle = { engine, manifest };

  function Wrapper() {
    const [muted, setMutedState] = useState(false);
    const [volume, setVolumeState] = useState(1);

    const settings: AudioSettingsHandle = {
      muted,
      volume,
      setMuted: (v: boolean) => { engine.mute(v); setMutedState(v); },
      setVolume: (v: number) => { engine.setMasterGain(v); setVolumeState(v); },
    };

    return (
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={handle}>
          <AudioSettingsContext.Provider value={settings}>
            <Soundboard />
          </AudioSettingsContext.Provider>
        </AudioHandleContext.Provider>
      </StoreContext.Provider>
    );
  }

  return render(<Wrapper />);
}

afterEach(cleanup);

// ── Visibility: correct groups per phase ──────────────────────────────────────

describe('Soundboard — correct cue groups per phase', () => {
  it('room phase: shows ambient, heistSfx, and danger groups', () => {
    renderSoundboard('room', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-ambient')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-heistSfx')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-danger')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-sting')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-finale')).toBeNull();
  });

  it('getaway phase: shows only finale group', () => {
    renderSoundboard('getaway', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-finale')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-ambient')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-heistSfx')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-sting')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-danger')).toBeNull();
  });

  it('result phase: shows sting and finale groups', () => {
    renderSoundboard('result', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-sting')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-finale')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-ambient')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-danger')).toBeNull();
  });

  it('briefing phase: shows only ambient group', () => {
    renderSoundboard('briefing', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-ambient')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-heistSfx')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-sting')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-danger')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-finale')).toBeNull();
  });

  it('correct buttons appear in each visible group', () => {
    renderSoundboard('room', makeMockEngine());

    // Ambient group should contain the two ambient cue buttons
    expect(screen.getByTestId('btn-cue-ambient-drone')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cue-ambient-heartbeat')).toBeInTheDocument();

    // heistSfx group in room phase has both sfx cues
    expect(screen.getByTestId('btn-cue-sfx-lock')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cue-sfx-footstep')).toBeInTheDocument();

    // danger group
    expect(screen.getByTestId('btn-cue-danger-alarm')).toBeInTheDocument();
  });
});

// ── Engine interactions ───────────────────────────────────────────────────────

describe('Soundboard — engine interactions', () => {
  it('clicking a non-looping cue calls engine.play', () => {
    const engine = makeMockEngine();
    renderSoundboard('result', engine);

    fireEvent.click(screen.getByTestId('btn-cue-sting-win'));
    expect(engine.play).toHaveBeenCalledWith('sting-win');
  });

  it('clicking a looping cue starts playback (engine.play called)', () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    fireEvent.click(screen.getByTestId('btn-cue-ambient-drone'));
    expect(engine.play).toHaveBeenCalledWith('ambient-drone');
  });

  it('clicking a looping cue a second time stops it (engine.stop called)', async () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    const droneBtn = screen.getByTestId('btn-cue-ambient-drone');

    // First click: play
    await act(async () => { fireEvent.click(droneBtn); });
    expect(engine.play).toHaveBeenCalledWith('ambient-drone');

    // Second click: stop
    await act(async () => { fireEvent.click(droneBtn); });
    expect(engine.stop).toHaveBeenCalledWith('ambient-drone');
  });

  it('play and stop are not called for each other\'s cues', async () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    // Click only the drone
    await act(async () => { fireEvent.click(screen.getByTestId('btn-cue-ambient-drone')); });
    expect(engine.play).toHaveBeenCalledWith('ambient-drone');
    expect(engine.play).not.toHaveBeenCalledWith('ambient-heartbeat');
    expect(engine.stop).not.toHaveBeenCalled();
  });
});

// ── Master mute / volume ──────────────────────────────────────────────────────

describe('Soundboard — master mute / volume', () => {
  it('master mute button calls engine.mute(true) on first click', () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    fireEvent.click(screen.getByTestId('btn-master-mute'));
    expect(engine.mute).toHaveBeenCalledWith(true);
  });

  it('master mute toggles to engine.mute(false) on second click', async () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    const muteBtn = screen.getByTestId('btn-master-mute');

    await act(async () => { fireEvent.click(muteBtn); });
    expect(engine.mute).toHaveBeenLastCalledWith(true);

    await act(async () => { fireEvent.click(muteBtn); });
    expect(engine.mute).toHaveBeenLastCalledWith(false);
  });

  it('volume slider calls engine.setMasterGain with the new value', () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    fireEvent.change(screen.getByTestId('input-master-volume'), {
      target: { value: '0.5' },
    });

    expect(engine.setMasterGain).toHaveBeenCalledWith(0.5);
  });

  it('mute button label changes between Mute and Unmute', async () => {
    const engine = makeMockEngine();
    renderSoundboard('room', engine);

    const muteBtn = screen.getByTestId('btn-master-mute');
    expect(muteBtn.textContent).toBe('Mute');

    await act(async () => { fireEvent.click(muteBtn); });
    expect(muteBtn.textContent).toBe('Unmute');

    await act(async () => { fireEvent.click(muteBtn); });
    expect(muteBtn.textContent).toBe('Mute');
  });
});

// ── Null fallback ─────────────────────────────────────────────────────────────

describe('Soundboard — null fallback', () => {
  it('renders nothing when there is no AudioProvider (null handle)', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }], 1);

    render(
      <StoreContext.Provider value={store}>
        {/* AudioHandleContext.Provider deliberately omitted */}
        <Soundboard />
      </StoreContext.Provider>,
    );

    expect(screen.queryByTestId('soundboard')).toBeNull();
  });
});
