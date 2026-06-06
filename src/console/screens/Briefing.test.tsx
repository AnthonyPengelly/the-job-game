// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import { Briefing } from './Briefing';

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function makeNarrationFixture(): ParsedNarration {
  const variants = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, text: `${prefix} text ${i}` }));
  return {
    briefing: [
      { id: 'br-villa-0', text: 'Villa narration line A', when: { mansionType: 'villa' } },
      { id: 'br-villa-1', text: 'Villa narration line B', when: { mansionType: 'villa' } },
      { id: 'br-estate-0', text: 'Estate narration line A', when: { mansionType: 'estate' } },
      { id: 'br-estate-1', text: 'Estate narration line B', when: { mansionType: 'estate' } },
      { id: 'br-penthouse-0', text: 'Penthouse narration line A', when: { mansionType: 'penthouse' } },
      { id: 'br-penthouse-1', text: 'Penthouse narration line B', when: { mansionType: 'penthouse' } },
    ],
    obstacleClue: variants('oc', 10),
    optionDescription: variants('od', 10),
    pushRun: variants('pr', 8),
    outcomeQuip: variants('oq', 18),
    scenarioSetup: variants('ss', 8),
    getawayIntro: variants('gi', 6),
    getawayCountdown: variants('gc', 6),
    winSting: variants('ws', 6),
    bustSting: variants('bs', 6),
  };
}

function renderBriefing(seed = 1) {
  const narration = makeNarrationFixture();
  const store = createGameStore({ cfg: testCfg, storage: makeStorage(), narration });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'briefing' });
  render(
    <StoreContext.Provider value={store}>
      <Briefing />
    </StoreContext.Provider>,
  );
  return store;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Briefing screen', () => {
  it('renders the mansion-dressing hook', () => {
    renderBriefing(1);
    expect(screen.getByTestId('mansion-dressing')).toBeInTheDocument();
  });

  it('mansion-dressing contains a non-empty narration line from the director', () => {
    const store = renderBriefing(1);
    const mansionType = store.getState().session.present.mansion.type;
    const dressing = screen.getByTestId('mansion-dressing');
    expect(dressing).toBeInTheDocument();
    // Director picks from the bank; the text should be one of the authored variants.
    const text = dressing.textContent ?? '';
    const knownPrefix = `${mansionType.charAt(0).toUpperCase()}${mansionType.slice(1)} narration line`;
    expect(text).toContain(knownPrefix);
  });

  it('renders the Teleprompter with a line inside mansion-dressing', () => {
    renderBriefing(1);
    const dressing = screen.getByTestId('mansion-dressing');
    expect(dressing.querySelector('[data-testid="teleprompter"]')).not.toBeNull();
    const line = screen.getByTestId('teleprompter-line');
    expect(line.textContent).not.toBe('');
  });

  it('Teleprompter advance button re-picks a line (never blocks)', () => {
    renderBriefing(1);
    const advanceBtn = screen.getByTestId('teleprompter-advance');
    // Advance is always clickable (no disabled dead-end).
    expect(advanceBtn).not.toBeDisabled();
    fireEvent.click(advanceBtn);
    // After advance, the line is still a non-null element (narration is additive).
    expect(screen.getByTestId('teleprompter-line')).toBeInTheDocument();
  });

  it('clicking Begin transitions the phase to room', () => {
    const store = renderBriefing(1);
    fireEvent.click(screen.getByTestId('btn-begin'));
    expect(store.getState().session.present.phase).toBe('room');
  });
});
