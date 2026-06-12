// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { AudioEngine } from '@/platform';
import type { RunPhase } from '@/engine';
import { AudioHandleContext } from '@/console/audio';
import type { AudioHandle } from '@/console/audio';
import { soundManifestSchema } from '@/content/schema';
import soundJson from '../../../presets/default/content/sound.json';
import { ActionBarSlotProvider } from './actionBarSlot';
import { CockpitActionBar } from './CockpitActionBar';

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
    isCuePlaying: vi.fn().mockReturnValue(false),
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

function renderActionBar(phase: RunPhase, engine: AudioEngine) {
  const storage = makeStorage();
  const store = createGameStore({ cfg: testCfg, storage });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase });

  const handle: AudioHandle = { engine, manifest };

  return render(
    <ActionBarSlotProvider>
      <StoreContext.Provider value={store}>
        <AudioHandleContext.Provider value={handle}>
          <CockpitActionBar />
        </AudioHandleContext.Provider>
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
  );
}

afterEach(cleanup);

// ── Phase-contextual cue display ──────────────────────────────────────────────

describe('CockpitActionBar — cue row visibility', () => {
  it('shows no cue buttons in briefing phase (no danger/sting/finale cues)', () => {
    renderActionBar('briefing', makeMockEngine());
    expect(screen.queryByText('Cues')).toBeNull();
  });

  it('shows sting and danger cue buttons in room phase', () => {
    renderActionBar('room', makeMockEngine());
    expect(screen.getByTestId('action-cue-sting-clean')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-sting-complication')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-sting-botch')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-danger-alarm')).toBeInTheDocument();
  });

  it('shows "Cues" label when contextual cues are present', () => {
    renderActionBar('room', makeMockEngine());
    expect(screen.getByText('Cues')).toBeInTheDocument();
  });

  it('shows finale cue buttons in getaway phase', () => {
    renderActionBar('getaway', makeMockEngine());
    expect(screen.getByTestId('action-cue-finale-engine')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-finale-escape')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-finale-tyres')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-finale-credits')).toBeInTheDocument();
  });

  it('shows sting-win and sting-bust in result phase', () => {
    renderActionBar('result', makeMockEngine());
    expect(screen.getByTestId('action-cue-sting-win')).toBeInTheDocument();
    expect(screen.getByTestId('action-cue-sting-bust')).toBeInTheDocument();
  });

  it('does not show ambient or heistSfx cues', () => {
    renderActionBar('room', makeMockEngine());
    expect(screen.queryByTestId('action-cue-ambient-drone')).toBeNull();
    expect(screen.queryByTestId('action-cue-sfx-lock')).toBeNull();
    expect(screen.queryByTestId('action-cue-sfx-footstep')).toBeNull();
  });
});

// ── One-shot cue playback ─────────────────────────────────────────────────────

describe('CockpitActionBar — one-shot cue playback', () => {
  it('clicking a one-shot cue calls engine.play with the cue id', () => {
    const engine = makeMockEngine();
    renderActionBar('result', engine);

    fireEvent.click(screen.getByTestId('action-cue-sting-win'));
    expect(engine.play).toHaveBeenCalledWith('sting-win');
  });

  it('clicking a one-shot cue a second time fires play again (not stop)', () => {
    const engine = makeMockEngine();
    renderActionBar('result', engine);

    fireEvent.click(screen.getByTestId('action-cue-sting-win'));
    fireEvent.click(screen.getByTestId('action-cue-sting-win'));
    expect(engine.play).toHaveBeenCalledTimes(2);
    expect(engine.stop).not.toHaveBeenCalled();
  });
});

// ── Looping cue toggle ────────────────────────────────────────────────────────

describe('CockpitActionBar — looping cue toggle', () => {
  it('clicking a looping cue calls engine.play', () => {
    const engine = makeMockEngine();
    renderActionBar('getaway', engine);

    fireEvent.click(screen.getByTestId('action-cue-finale-engine'));
    expect(engine.play).toHaveBeenCalledWith('finale-engine');
  });

  it('clicking a looping cue a second time calls engine.stop', async () => {
    const engine = makeMockEngine();
    renderActionBar('getaway', engine);

    const btn = screen.getByTestId('action-cue-finale-engine');

    await act(async () => { fireEvent.click(btn); });
    expect(engine.play).toHaveBeenCalledWith('finale-engine');

    await act(async () => { fireEvent.click(btn); });
    expect(engine.stop).toHaveBeenCalledWith('finale-engine');
  });

  it('looping cue button shows playing class while active, removes it on stop', async () => {
    const engine = makeMockEngine();
    renderActionBar('getaway', engine);

    const btn = screen.getByTestId('action-cue-finale-engine');
    expect(btn.className).not.toContain('playing');

    await act(async () => { fireEvent.click(btn); });
    expect(btn.className).toContain('playing');

    await act(async () => { fireEvent.click(btn); });
    expect(btn.className).not.toContain('playing');
  });
});

// ── Unavailable cue surfacing ─────────────────────────────────────────────────

describe('CockpitActionBar — unavailable cue surfacing', () => {
  it('unavailable cue button is disabled', () => {
    renderActionBar('room', makeMockEngine(false));

    const btn = screen.getByTestId('action-cue-danger-alarm');
    expect(btn).toBeDisabled();
  });

  it('unavailable cue button has missing class', () => {
    renderActionBar('room', makeMockEngine(false));

    const btn = screen.getByTestId('action-cue-sting-clean');
    expect(btn.className).toContain('missing');
  });

  it('unavailable cue button shows a missing badge text', () => {
    renderActionBar('room', makeMockEngine(false));

    const btn = screen.getByTestId('action-cue-sting-clean');
    expect(btn.textContent).toContain('missing');
  });

  it('does not call engine.play when a disabled cue button is clicked', () => {
    const engine = makeMockEngine(false);
    renderActionBar('room', engine);

    fireEvent.click(screen.getByTestId('action-cue-sting-clean'));
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('available cue button is enabled and lacks missing class', () => {
    renderActionBar('room', makeMockEngine(true));

    const btn = screen.getByTestId('action-cue-sting-clean');
    expect(btn).not.toBeDisabled();
    expect(btn.className).not.toContain('missing');
    expect(btn.textContent).not.toContain('missing');
  });
});

// ── No audio provider ─────────────────────────────────────────────────────────

describe('CockpitActionBar — no AudioProvider', () => {
  it('renders without throwing when no AudioProvider is present', () => {
    const storage = makeStorage();
    const store = createGameStore({ cfg: testCfg, storage });
    store.getState().startRun([{ name: 'Alice' }], 1);

    expect(() => {
      render(
        <ActionBarSlotProvider>
          <StoreContext.Provider value={store}>
            {/* No AudioHandleContext.Provider — handle is null */}
            <CockpitActionBar />
          </StoreContext.Provider>
        </ActionBarSlotProvider>,
      );
    }).not.toThrow();

    // No cue buttons rendered without audio handle
    expect(screen.queryByText('Cues')).toBeNull();
  });
});
