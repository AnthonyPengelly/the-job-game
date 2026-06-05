// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, useGameStore, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { StorageLike } from '@/platform';
import type { GearId, PlayerId } from '@/engine';
import { GearTray } from './GearTray';
import { CrewPanel } from './CrewPanel';

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

const gearTestCfg = {
  ...testCfg,
  gear: {
    'stat-tech-1': { id: 'stat-tech-1', kind: 'statBoost' as const, lane: 'tech' as const, magnitude: 1 },
    'powerup-tech': { id: 'powerup-tech', kind: 'powerUp' as const, lane: 'tech' as const },
  },
};

/**
 * Renders GearTray alongside a CrewPanel that reads live state from the store.
 * Mirrors the HUD layout so gear assignment is visible in the crew panel.
 */
function GearTrayWithCrew() {
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const dispatch = useGameStore(s => s.dispatch);
  return (
    <>
      <GearTray />
      <CrewPanel
        crew={crew}
        roomIndex={roomIndex}
        onAssignGear={(gear, to) => dispatch({ t: 'ASSIGN_GEAR', gear, to })}
      />
    </>
  );
}

function makeStore() {
  const store = createGameStore({ cfg: gearTestCfg, storage: makeStorage() });
  store.getState().startRun([{ name: 'Alice' }, { name: 'Bob' }], 1);
  return store;
}

function renderGearTrayWithCrew() {
  const store = makeStore();
  render(
    <StoreContext.Provider value={store}>
      <GearTrayWithCrew />
    </StoreContext.Provider>,
  );
  return store;
}

// ── GearTray rendering ────────────────────────────────────────────────────────

describe('GearTray — rendering', () => {
  it('renders a gear-tray container', () => {
    renderGearTrayWithCrew();
    expect(screen.getByTestId('gear-tray')).toBeInTheDocument();
  });

  it('renders a card for every gear item in cfg.gear', () => {
    renderGearTrayWithCrew();
    expect(screen.getByTestId('gear-card-stat-tech-1')).toBeInTheDocument();
    expect(screen.getByTestId('gear-card-powerup-tech')).toBeInTheDocument();
  });

  it('shows a descriptive label for stat-boost gear', () => {
    renderGearTrayWithCrew();
    expect(screen.getByTestId('gear-label-stat-tech-1').textContent).toBe('tech +1');
  });

  it('shows a descriptive label for power-up gear', () => {
    renderGearTrayWithCrew();
    expect(screen.getByTestId('gear-label-powerup-tech').textContent).toBe('tech power-up');
  });

  it('renders a player select with options for each crew member', () => {
    renderGearTrayWithCrew();
    const select = screen.getByTestId('gear-select-stat-tech-1');
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    // First option is empty "Select player…", rest are crew ids
    expect(options).toContain('player-0');
    expect(options).toContain('player-1');
  });

  it('assign button is disabled before a player is selected', () => {
    renderGearTrayWithCrew();
    expect(screen.getByTestId('gear-assign-stat-tech-1')).toBeDisabled();
  });

  it('assign button is enabled after selecting a player', () => {
    renderGearTrayWithCrew();
    fireEvent.change(screen.getByTestId('gear-select-stat-tech-1'), {
      target: { value: 'player-0' },
    });
    expect(screen.getByTestId('gear-assign-stat-tech-1')).not.toBeDisabled();
  });
});

// ── Stat-boost gear assignment ────────────────────────────────────────────────

describe('GearTray — stat-boost assignment', () => {
  it('dispatches ASSIGN_GEAR after selecting a player and clicking Assign', () => {
    const store = renderGearTrayWithCrew();

    fireEvent.change(screen.getByTestId('gear-select-stat-tech-1'), {
      target: { value: 'player-0' },
    });
    fireEvent.click(screen.getByTestId('gear-assign-stat-tech-1'));

    const lastEvent = store.getState().eventLog.at(-1);
    expect(lastEvent?.t).toBe('ASSIGN_GEAR');
    if (lastEvent?.t === 'ASSIGN_GEAR') {
      expect(lastEvent.gear).toBe('stat-tech-1');
      expect(lastEvent.to).toBe('player-0');
    }
  });

  it('CrewPanel shows the boosted stat after assigning a +1 tech gear', () => {
    const store = renderGearTrayWithCrew();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;
    const techBefore = player.stats.tech;

    fireEvent.change(screen.getByTestId('gear-select-stat-tech-1'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-stat-tech-1'));

    const techAfterEl = screen.getByTestId(`crew-stat-${player.id}-tech`);
    expect(techAfterEl.textContent).toBe(`tech: ${techBefore + 1}`);
  });

  it('stat boost stacks: assigning the same stat-boost gear twice adds +2 total', () => {
    const store = renderGearTrayWithCrew();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;
    const techBefore = player.stats.tech;

    // First assignment
    fireEvent.change(screen.getByTestId('gear-select-stat-tech-1'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-stat-tech-1'));

    // Second assignment
    fireEvent.change(screen.getByTestId('gear-select-stat-tech-1'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-stat-tech-1'));

    const techAfterEl = screen.getByTestId(`crew-stat-${player.id}-tech`);
    expect(techAfterEl.textContent).toBe(`tech: ${techBefore + 2}`);
  });
});

// ── Power-up gear assignment ──────────────────────────────────────────────────

describe('GearTray — power-up assignment', () => {
  it('sets the power-up indicator in CrewPanel after assigning a power-up gear', () => {
    const store = renderGearTrayWithCrew();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;

    // No power-up initially
    expect(screen.queryByTestId(`crew-powerup-${player.id}-tech`)).toBeNull();

    fireEvent.change(screen.getByTestId('gear-select-powerup-tech'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-powerup-tech'));

    expect(screen.getByTestId(`crew-powerup-${player.id}-tech`)).toBeInTheDocument();
  });

  it('engine applyGear semantics: assigning a power-up twice is idempotent (no stack)', () => {
    const store = renderGearTrayWithCrew();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;

    // Assign once
    fireEvent.change(screen.getByTestId('gear-select-powerup-tech'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-powerup-tech'));

    // Assign again
    fireEvent.change(screen.getByTestId('gear-select-powerup-tech'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-powerup-tech'));

    // Still only one tech power-up indicator — powerUps is Record<Lane, boolean>
    const powerUpEls = screen.getAllByTestId(`crew-powerup-${player.id}-tech`);
    expect(powerUpEls).toHaveLength(1);

    // Engine state: powerUps.tech is true (boolean, not a counter)
    const updatedPlayer = store.getState().session.present.crew.find(p => p.id === player.id)!;
    expect(updatedPlayer.powerUps.tech).toBe(true);
  });

  it('power-up does not affect the stat value', () => {
    const store = renderGearTrayWithCrew();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;
    const techBefore = player.stats.tech;

    fireEvent.change(screen.getByTestId('gear-select-powerup-tech'), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByTestId('gear-assign-powerup-tech'));

    // Stat is unchanged — power-up is a separate boolean flag
    const techEl = screen.getByTestId(`crew-stat-${player.id}-tech`);
    expect(techEl.textContent).toBe(`tech: ${techBefore}`);
  });
});

// ── Drop-target: CrewPanel accepts dragged gear ───────────────────────────────

describe('CrewPanel — drop target', () => {
  it('handles onDrop and dispatches ASSIGN_GEAR via the callback', () => {
    const store = makeStore();
    const crew = store.getState().session.present.crew;
    const player = crew[0]!;
    const dispatched: { gear: GearId; to: PlayerId }[] = [];

    render(
      <StoreContext.Provider value={store}>
        <CrewPanel
          crew={crew}
          roomIndex={0}
          onAssignGear={(gear, to) => {
            dispatched.push({ gear, to });
            store.getState().dispatch({ t: 'ASSIGN_GEAR', gear, to });
          }}
        />
      </StoreContext.Provider>,
    );

    const playerCard = screen.getByTestId(`crew-member-${player.id}`);
    fireEvent.drop(playerCard, {
      dataTransfer: { getData: () => 'stat-tech-1' },
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ gear: 'stat-tech-1', to: player.id });
  });
});
