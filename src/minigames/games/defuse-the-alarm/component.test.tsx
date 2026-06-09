// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { mulberry32 } from '@/engine/rng';
import type { Difficulty } from '@/minigames/contract';
import { generate } from './generate';
import { DefuseComponent } from './component';

// Suppress publishSlice broadcast in tests
vi.mock('@/platform/channel', () => ({
  publishSlice: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

// ── Wire cards ────────────────────────────────────────────────────────────────

describe('DefuseComponent — wire cards', () => {
  it('renders a wire card for each wire', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (const wire of params.wires) {
      expect(screen.getByTestId(`wire-card-${wire.id}`)).toBeInTheDocument();
    }
  });

  it('clicking a wire card cuts it', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const firstWire = params.wires[0]!;
    const card = screen.getByTestId(`wire-card-${firstWire.id}`);
    fireEvent.click(card);
    // After cut, position label changes
    const posEl = screen.getByTestId(`wire-pos-${firstWire.id}`);
    expect(posEl.textContent).toContain('cut');
  });

  it('safe cuts show green (cut) state', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const safeCutId = params.safeWireIds[0]!;
    const card = screen.getByTestId(`wire-card-${safeCutId}`);
    fireEvent.click(card);
    expect(card.className).toContain('dfz-card--cut');
  });

  it('wrong cuts show red (badcut) state and set alarm tripped', () => {
    const params = makeParams(1);
    const unsafeWire = params.wires.find(w => !params.safeWireIds.includes(w.id));
    if (!unsafeWire) return; // skip if no unsafe wire (unlikely)
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const card = screen.getByTestId(`wire-card-${unsafeWire.id}`);
    fireEvent.click(card);
    expect(card.className).toContain('dfz-card--badcut');
  });
});

// ── GM-only resolution ────────────────────────────────────────────────────────

describe('DefuseComponent — GM-only resolution', () => {
  it('shows the GM resolution panel', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-gm-resolution')).toBeInTheDocument();
  });

  it('GM resolution text references the next safe wire position', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const gmText = screen.getByTestId('defuse-gm-text').textContent ?? '';
    expect(gmText).toContain('Next:');
  });

  it('GM resolution shows alarm text after wrong cut', () => {
    const params = makeParams(1);
    const unsafeWire = params.wires.find(w => !params.safeWireIds.includes(w.id));
    if (!unsafeWire) return;
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId(`wire-card-${unsafeWire.id}`));
    const gmPanel = screen.getByTestId('defuse-gm-resolution');
    expect(gmPanel.className).toContain('dfz-gmcut--danger');
    expect(screen.getByTestId('defuse-gm-text').textContent).toContain('alarm tripped');
  });

  it('GM resolution shows defused text when all safe cuts made', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (const id of params.safeWireIds) {
      const card = screen.getByTestId(`wire-card-${id}`);
      fireEvent.click(card);
    }
    expect(screen.getByTestId('defuse-gm-text').textContent).toContain('defused');
  });
});

// ── Status badge ──────────────────────────────────────────────────────────────

describe('DefuseComponent — status badge', () => {
  it('shows Defusing badge initially', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-the-alarm').textContent).toContain('Defusing');
  });

  it('shows DEFUSED badge after all safe cuts', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    for (const id of params.safeWireIds) {
      const card = screen.getByTestId(`wire-card-${id}`);
      fireEvent.click(card);
    }
    expect(screen.getByTestId('defuse-the-alarm').textContent).toContain('DEFUSED');
  });

  it('shows ALARM TRIPPED badge after wrong cut', () => {
    const params = makeParams(1);
    const unsafeWire = params.wires.find(w => !params.safeWireIds.includes(w.id));
    if (!unsafeWire) return;
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId(`wire-card-${unsafeWire.id}`));
    expect(screen.getByTestId('defuse-the-alarm').textContent).toContain('ALARM TRIPPED');
  });
});

// ── Progress bar ──────────────────────────────────────────────────────────────

describe('DefuseComponent — progress bar', () => {
  it('renders the progress bar', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-progress-bar')).toBeInTheDocument();
  });

  it('shows safe cuts progress label', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-progress').textContent).toContain('Safe cuts');
  });

  it('progress fill grows as safe cuts are made', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    const fill = screen.getByTestId('defuse-progress-fill');
    expect(fill.style.width).toBe('0%');
    const card = screen.getByTestId(`wire-card-${params.safeWireIds[0]!}`);
    fireEvent.click(card);
    const pct = parseFloat(fill.style.width);
    expect(pct).toBeGreaterThan(0);
  });
});

// ── Clear Channel boost ────────────────────────────────────────────────────────

describe('DefuseComponent — Clear Channel boost', () => {
  it('Clear Channel active indicator hidden initially', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByTestId('defuse-clear-channel-active')).toBeNull();
  });

  it('Clear Channel active indicator appears after boost fires', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted(true)}
        onResolve={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('boost-charm'));
    expect(screen.getByTestId('defuse-clear-channel-active')).toBeInTheDocument();
  });
});

// ── Player-view manual ref ─────────────────────────────────────────────────────

describe('DefuseComponent — player-view ref', () => {
  it('shows the manual reference note', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-manual-ref')).toBeInTheDocument();
  });
});

// ── GM rulebook ────────────────────────────────────────────────────────────────

describe('DefuseComponent — GM rulebook', () => {
  it('shows the rulebook toggle', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('defuse-rulebook-toggle')).toBeInTheDocument();
  });
});

// ── Boost slot (no layout shift) ──────────────────────────────────────────────

describe('DefuseComponent — boost slot', () => {
  it('mg-boost-slot always rendered regardless of boost eligibility', () => {
    const params = makeParams(1);
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted(false)}
        onResolve={() => {}}
      />,
    );
    const slots = document.querySelectorAll('.mg-boost-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Outcome ───────────────────────────────────────────────────────────────────

describe('DefuseComponent — onResolve', () => {
  it('calls onResolve when Call Outcome clicked', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls onResolve with clean when all safe cuts made', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    for (const id of params.safeWireIds) {
      fireEvent.click(screen.getByTestId(`wire-card-${id}`));
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('clean');
  });

  it('calls onResolve with botched after wrong cut', () => {
    const params = makeParams(1);
    const unsafeWire = params.wires.find(w => !params.safeWireIds.includes(w.id));
    if (!unsafeWire) return;
    const spy = vi.fn();
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    fireEvent.click(screen.getByTestId(`wire-card-${unsafeWire.id}`));
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });

  it('calls onResolve with botched when timer expires', () => {
    const params = makeParams(1);
    const spy = vi.fn();
    render(
      <DefuseComponent
        params={params}
        dial={dial}
        committed={makeCommitted()}
        onResolve={spy}
      />,
    );
    // Advance one tick at a time so React flushes state after each second
    for (let i = 0; i <= params.timerSeconds; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    fireEvent.click(screen.getByTestId('btn-call-outcome'));
    expect(spy).toHaveBeenCalledWith('botched');
  });
});
