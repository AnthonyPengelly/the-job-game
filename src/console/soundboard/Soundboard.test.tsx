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

function makeMockEngine(available = true): AudioEngine {
  // Stateful play/stop so the loop on/off glyph logic (engine-derived) works.
  const playing = new Set<string>();
  return {
    preload: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    play: vi.fn((id: string) => { playing.add(id); }),
    stop: vi.fn((id: string) => { playing.delete(id); }),
    setChannelGain: vi.fn(),
    setMasterGain: vi.fn(),
    mute: vi.fn(),
    setAmbient: vi.fn(),
    scheduleBeep: vi.fn(),
    isCuePlaying: vi.fn((id: string) => playing.has(id)),
    stopLoopsForPhase: vi.fn(),
    isCueAvailable: vi.fn().mockReturnValue(available),
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
function renderSoundboard(phase: RunPhase, engine: AudioEngine, fullBoard = false) {
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
            <Soundboard fullBoard={fullBoard} />
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
  it('room phase: shows ambient, heistSfx, sting, and danger groups', () => {
    // sting-clean/complication/botch are phase-relevant in room/minigame/offer
    renderSoundboard('room', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-ambient')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-heistSfx')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-danger')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-sting')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-finale')).toBeNull();
  });

  it('getaway phase: shows finale, heistSfx, and danger groups', () => {
    // sfx-tick/sfx-chaching/sfx-radio-chatter are phase-relevant in getaway,
    // and the wave-2 siren/helicopter danger cues belong to the chase.
    renderSoundboard('getaway', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-finale')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-heistSfx')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-danger')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-ambient')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-sting')).toBeNull();
  });

  it('result phase: shows sting and finale groups', () => {
    renderSoundboard('result', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-sting')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-finale')).toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-group-ambient')).toBeNull();
    expect(screen.queryByTestId('soundboard-group-danger')).toBeNull();
  });

  it('briefing phase: shows ambient and heistSfx groups', () => {
    // sfx-gear (gear-receive chime) is phase-relevant during briefing
    renderSoundboard('briefing', makeMockEngine());

    expect(screen.getByTestId('soundboard-group-ambient')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-heistSfx')).toBeInTheDocument();
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

// ── fullBoard mode ────────────────────────────────────────────────────────────

describe('Soundboard — fullBoard mode', () => {
  it('shows all five channel groups in briefing phase (normally only ambient shows)', () => {
    // briefing phase normally filters to ambient-only; fullBoard must override that
    renderSoundboard('briefing', makeMockEngine(), true);

    expect(screen.getByTestId('soundboard-group-ambient')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-heistSfx')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-sting')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-danger')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-group-finale')).toBeInTheDocument();
  });

  it('shows finale cues (phase-restricted to getaway/result) during briefing phase', () => {
    renderSoundboard('briefing', makeMockEngine(), true);

    expect(screen.getByTestId('btn-cue-finale-escape')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cue-finale-credits')).toBeInTheDocument();
  });

  it('shows sting-win and sting-bust in fullBoard mode during room phase', () => {
    // sting-win/bust are result-only; fullBoard must show them even in room
    renderSoundboard('room', makeMockEngine(), true);

    expect(screen.getByTestId('soundboard-group-sting')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cue-sting-win')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cue-sting-bust')).toBeInTheDocument();
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

// ── Unavailable cue surfacing ─────────────────────────────────────────────────

describe('Soundboard — unavailable cue surfacing', () => {
  it('shows "missing" text and disables button when cue is unavailable', () => {
    // Engine reports all cues as unavailable (isCueAvailable returns false)
    const engine = makeMockEngine(false);
    renderSoundboard('room', engine);

    // All visible cue buttons should be disabled with "missing" text
    const droneBtn = screen.getByTestId('btn-cue-ambient-drone');
    expect(droneBtn).toBeDisabled();
    expect(droneBtn.textContent).toContain('missing');
  });

  it('shows normal text and enables button when cue is available', () => {
    const engine = makeMockEngine(true);
    renderSoundboard('room', engine);

    const lockBtn = screen.getByTestId('btn-cue-sfx-lock');
    expect(lockBtn).not.toBeDisabled();
    expect(lockBtn.textContent).not.toContain('missing');
    expect(lockBtn.textContent).toContain('sfx-lock');
  });

  it('does not call engine.play when an unavailable cue button is clicked', () => {
    const engine = makeMockEngine(false);
    renderSoundboard('room', engine);

    fireEvent.click(screen.getByTestId('btn-cue-sfx-lock'));
    // button is disabled — click handler should not fire
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('data-missing attribute is present on unavailable cue buttons', () => {
    const engine = makeMockEngine(false);
    renderSoundboard('room', engine);

    const btn = screen.getByTestId('btn-cue-ambient-drone');
    expect(btn.dataset['missing']).toBeDefined();
  });

  it('data-missing attribute is absent on available cue buttons', () => {
    const engine = makeMockEngine(true);
    renderSoundboard('room', engine);

    const btn = screen.getByTestId('btn-cue-ambient-drone');
    expect(btn.dataset['missing']).toBeUndefined();
  });
});
