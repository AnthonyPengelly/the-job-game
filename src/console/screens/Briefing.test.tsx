// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext } from '@/console/store';
import { createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { ParsedNarration } from '@/content/schema';
import type { SpineBank } from '@/content/schema';
import { ActionBarSlotProvider, ActionBarSlotOutlet } from '@/console/shell/actionBarSlot';
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
    roomApproach: variants('ra', 4),
    scenarioApproach: variants('sap', 4),
    scenarioReveal: variants('sr', 4),
  };
}

function makeSpineBankFixture(): SpineBank {
  return {
    marks: [
      {
        id: 'villa-mark-0',
        mansionType: 'villa',
        markName: 'Ashcombe House',
        vault: 'Floor 3',
        security: 'HIGH',
        targetHaul: '$120k',
        dropCaption: 'Ashcombe House — north face, dusk',
        dressing: 'Cold marble and old money.',
      },
      {
        id: 'villa-mark-1',
        mansionType: 'villa',
        markName: 'Briar Hall',
        vault: 'Basement',
        security: 'MEDIUM',
        targetHaul: '$80k',
        dropCaption: 'Briar Hall — east wing',
        dressing: 'Old ivy, older secrets.',
      },
      {
        id: 'estate-mark-0',
        mansionType: 'estate',
        markName: 'Redcroft Estate',
        vault: 'East Wing Safe',
        security: 'HIGH',
        targetHaul: '$200k',
        dropCaption: 'Redcroft — aerial, pre-dawn',
        dressing: 'Twenty acres of manicured suspicion.',
      },
      {
        id: 'estate-mark-1',
        mansionType: 'estate',
        markName: 'Thornfield',
        vault: 'Study Floor Safe',
        security: 'MEDIUM',
        targetHaul: '$150k',
        dropCaption: 'Thornfield — main drive',
        dressing: 'Fog and iron gates.',
      },
      {
        id: 'penthouse-mark-0',
        mansionType: 'penthouse',
        markName: 'The Apex',
        vault: 'Roof Terrace',
        security: 'EXTREME',
        targetHaul: '$350k',
        dropCaption: 'The Apex — city skyline, night',
        dressing: 'Glass and altitude.',
      },
      {
        id: 'penthouse-mark-1',
        mansionType: 'penthouse',
        markName: 'Tower Suite',
        vault: 'Private Floor',
        security: 'HIGH',
        targetHaul: '$250k',
        dropCaption: 'Tower Suite — upper lobby',
        dressing: 'Marble, security glass, and silence.',
      },
    ],
  };
}

function renderBriefing(seed = 1) {
  const narration = makeNarrationFixture();
  const spineBank = makeSpineBankFixture();
  const store = createGameStore({ cfg: testCfg, storage: makeStorage(), narration, spineBank });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], seed);
  store.getState().dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'briefing' });
  render(
    <ActionBarSlotProvider>
      <ActionBarSlotOutlet />
      <StoreContext.Provider value={store}>
        <Briefing />
      </StoreContext.Provider>
    </ActionBarSlotProvider>,
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

  it('there is no Order of Play / Mastermind panel', () => {
    renderBriefing(1);
    // The Order of Play panel must not be present — design-rejected.
    const panels = screen.getAllByRole('heading', { level: 3 });
    const panelTexts = panels.map(h => h.textContent ?? '');
    expect(panelTexts).not.toContain('Order of Play');
    expect(panelTexts).not.toContain('Mastermind reveals');
  });

  it('renders the dossier panel with spine data', () => {
    renderBriefing(1);
    expect(screen.getByTestId('dossier')).toBeInTheDocument();
    // The dossier stats must be present.
    expect(screen.getByTestId('dossier-security')).toBeInTheDocument();
    expect(screen.getByTestId('dossier-the-night')).toBeInTheDocument();
    expect(screen.getByTestId('dossier-the-exit')).toBeInTheDocument();
    // Spine security is non-placeholder (no literal '—' from a null spine).
    expect(screen.getByTestId('dossier-security').textContent).not.toBe('Security—');
  });

  it('does not show fake numbers — no target haul, no vault stat', () => {
    renderBriefing(1);
    // Playtest decision: the haul number is meaningless at briefing time and no
    // "vault" is ever reached — the dossier foreshadows the night instead.
    expect(screen.queryByTestId('dossier-target-haul')).toBeNull();
    expect(screen.queryByTestId('dossier-vault')).toBeNull();
    const dossier = screen.getByTestId('dossier');
    expect(dossier.textContent).not.toContain('Target haul');
    expect(dossier.textContent).not.toContain('The vault');
  });

  it('renders the dossier drop-caption image strip', () => {
    renderBriefing(1);
    expect(screen.getByTestId('dossier-img-strip')).toBeInTheDocument();
    const strip = screen.getByTestId('dossier-img-strip');
    // Drop caption is sourced from the committed spine — not empty.
    expect(strip.textContent?.trim()).not.toBe('');
    expect(strip.textContent?.trim()).not.toBe('—');
  });

  it('renders the "Every room pays out" payout panel', () => {
    renderBriefing(1);
    const payout = screen.getByTestId('payout-panel');
    expect(payout).toBeInTheDocument();
    expect(payout.textContent).toContain('Every room pays out');
    expect(payout.textContent).toContain('Loot');
    expect(payout.textContent).toContain('Gear');
  });

  it('clicking Begin transitions the phase to room', () => {
    const store = renderBriefing(1);
    fireEvent.click(screen.getByTestId('btn-begin'));
    expect(store.getState().session.present.phase).toBe('room');
  });
});
