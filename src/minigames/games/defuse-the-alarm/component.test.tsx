// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { DefuseComponent } from './component';
import { publishSlice } from '@/platform/channel';

// Suppress publishSlice broadcast in tests
vi.mock('@/platform/channel', () => ({
  publishSlice: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const dial: Difficulty = { level: 0 };

function makeParams(seed = 1) {
  return generate(mulberry32(seed), dial);
}

function makeCommitted(withCharmOrStealth = false) {
  return [
    {
      id: 'p1' as import('@/engine').PlayerId,
      name: 'Millie',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: withCharmOrStealth ? { charm: true as const } : {},
    },
    {
      id: 'p2' as import('@/engine').PlayerId,
      name: 'Liv',
      stats: { tech: 3, physical: 3, charm: 3, stealth: 3 },
      powerUps: {},
    },
  ];
}

function renderGame(opts: { boost?: boolean; onResolve?: (o: string) => void } = {}) {
  const params = makeParams(1);
  render(
    <DefuseComponent
      params={params}
      dial={dial}
      committed={makeCommitted(opts.boost ?? false)}
      onResolve={(opts.onResolve ?? (() => {})) as never}
    />,
  );
  return params;
}

function dealWires() {
  fireEvent.click(screen.getByTestId('defuse-dealt'));
}

// ── Setup panel ───────────────────────────────────────────────────────────────

describe('DefuseComponent — setup panel', () => {
  it('states how many cards to deal as the wires', () => {
    const params = renderGame();
    expect(screen.getByTestId('defuse-setup').textContent).toContain(
      `${params.wireCount} cards face-up`,
    );
  });

  it('timer does not run during setup; starts once wires are dealt', () => {
    renderGame();
    expect(screen.queryByTestId('timer')).not.toBeInTheDocument();
    dealWires();
    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  it('record controls appear only after the deal', () => {
    renderGame();
    expect(screen.queryByTestId('defuse-record-controls')).not.toBeInTheDocument();
    dealWires();
    expect(screen.getByTestId('defuse-record-controls')).toBeInTheDocument();
  });
});

// ── Player-view publishing ────────────────────────────────────────────────────

describe('DefuseComponent — player-view slice', () => {
  it('publishes the rulebook slice on mount (rules text only)', () => {
    const params = renderGame();
    expect(publishSlice).toHaveBeenCalledWith({
      kind: 'defuse-rulebook',
      rules: params.ruleLines,
      gameActive: true,
    });
  });
});

// ── Recording ─────────────────────────────────────────────────────────────────

describe('DefuseComponent — GM recording', () => {
  it('safe cut increments the tally', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    expect(screen.getByTestId('defuse-progress').textContent).toContain('2');
  });

  it('wrong cut trips the alarm badge and removes the controls', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    expect(screen.getByTestId('defuse-badge').textContent).toContain('ALARM');
    expect(screen.queryByTestId('defuse-record-controls')).not.toBeInTheDocument();
  });

  it('all clear shows the DEFUSED badge', () => {
    renderGame();
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    expect(screen.getByTestId('defuse-badge').textContent).toContain('DEFUSED');
  });
});

// ── GM rulebook ───────────────────────────────────────────────────────────────

describe('DefuseComponent — GM rulebook', () => {
  it('shows every rule in the GM-only fold once dealt', () => {
    const params = renderGame();
    dealWires();
    params.ruleLines.forEach((line, i) => {
      expect(screen.getByTestId(`defuse-gm-rule-${i}`).textContent).toBe(line);
    });
  });
});

// ── Insulated Gloves boost (wave 3) ───────────────────────────────────────────

describe('DefuseComponent — Insulated Gloves boost', () => {
  it('arming shows the armed banner', () => {
    renderGame({ boost: true });
    dealWires();
    expect(screen.queryByTestId('defuse-gloves-armed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('defuse-gloves-armed')).toBeInTheDocument();
  });

  it('an armed wrong cut is absorbed: no alarm, complication suggested', () => {
    const spy = vi.fn();
    renderGame({ boost: true, onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('boost-charm'));
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    // No alarm — the gloves ate it.
    expect(screen.getByTestId('defuse-badge').textContent).not.toContain('ALARM');
    expect(screen.getByTestId('defuse-gloves-used')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('complication');
  });

  it('fired AFTER a recorded wrong cut, it takes the mistake back', () => {
    renderGame({ boost: true });
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    expect(screen.getByTestId('defuse-badge').textContent).toContain('ALARM');
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('defuse-badge').textContent).not.toContain('ALARM');
    expect(screen.getByTestId('defuse-gloves-used')).toBeInTheDocument();
  });

  it('a second wrong cut still trips the alarm (once per game)', () => {
    renderGame({ boost: true });
    dealWires();
    fireEvent.click(screen.getByTestId('boost-charm'));
    fireEvent.click(screen.getByTestId('defuse-wrong-cut')); // absorbed
    fireEvent.click(screen.getByTestId('defuse-wrong-cut')); // trips
    expect(screen.getByTestId('defuse-badge').textContent).toContain('ALARM');
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('DefuseComponent — onResolve', () => {
  it('in progress → complication suggested', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('complication');
  });

  it('all clear → clean', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });

  it('wrong cut → botched', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    dealWires();
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});

// ── One-laptop handoff (playtest wave 2) ──────────────────────────────────────

describe('DefuseComponent — laptop handoff flow', () => {
  it('setup offers both paths: second screen and one-laptop handoff', () => {
    renderGame();
    expect(screen.getByTestId('defuse-dealt')).toBeInTheDocument();
    expect(screen.getByTestId('defuse-handoff')).toBeInTheDocument();
  });

  it('handoff shows ONLY the fullscreen reader view — no GM controls', () => {
    const params = renderGame();
    fireEvent.click(screen.getByTestId('defuse-handoff'));
    expect(screen.getByTestId('defuse-reader-overlay')).toBeInTheDocument();
    // The rulebook is fully visible to the reader...
    params.ruleLines.forEach((line, i) => {
      expect(screen.getByTestId(`defuse-reader-rule-${i}`).textContent).toBe(line);
    });
    // ...and the timer runs...
    expect(screen.getByTestId('timer')).toBeInTheDocument();
    // ...but nothing GM-only leaks onto the handed-over screen.
    expect(screen.queryByTestId('defuse-record-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defuse-rulebook-gm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-call-outcome')).not.toBeInTheDocument();
  });

  it('handing back moves to adjudication: record controls + rules return', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('defuse-handoff'));
    fireEvent.click(screen.getByTestId('defuse-handback'));
    expect(screen.queryByTestId('defuse-reader-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('defuse-record-controls')).toBeInTheDocument();
    expect(screen.getByTestId('defuse-rulebook-gm')).toBeInTheDocument();
    expect(screen.getByTestId('defuse-badge').textContent).toContain('Checking');
  });

  it('retrospective adjudication feeds the same judge: all clear → clean', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    fireEvent.click(screen.getByTestId('defuse-handoff'));
    fireEvent.click(screen.getByTestId('defuse-handback'));
    fireEvent.click(screen.getByTestId('defuse-safe-cut'));
    fireEvent.click(screen.getByTestId('defuse-all-clear'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });

  it('a wrong cut found while checking the work → botched', () => {
    const spy = vi.fn();
    renderGame({ onResolve: spy });
    fireEvent.click(screen.getByTestId('defuse-handoff'));
    fireEvent.click(screen.getByTestId('defuse-handback'));
    fireEvent.click(screen.getByTestId('defuse-wrong-cut'));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('timer expiry during handoff returns the laptop to adjudication with a TIME note', () => {
    vi.useFakeTimers();
    try {
      const params = renderGame();
      fireEvent.click(screen.getByTestId('defuse-handoff'));
      // Walk the whole clock down one second per act (Timer chains setTimeout).
      for (let i = 0; i < params.timerSeconds; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      expect(screen.queryByTestId('defuse-reader-overlay')).not.toBeInTheDocument();
      expect(screen.getByTestId('defuse-time-ran-out')).toBeInTheDocument();
      // The GM can still record what the row shows — no dead-end.
      expect(screen.getByTestId('defuse-record-controls')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
