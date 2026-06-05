// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StoreContext, createGameStore } from '@/console/store';
import { testCfg } from '@/engine/test-config';
import type { EngineConfig, Lane, PlayerId } from '@/engine';
import type { StorageLike } from '@/platform';
import { MinigameHost } from './MinigameHost';

afterEach(cleanup);

// ── safeCrack-only EngineConfig ───────────────────────────────────────────────

const safeCrackCfg: EngineConfig = {
  ...testCfg,
  generation: { obstacleRatio: 1.0 },
  scaling: {
    ...testCfg.scaling,
    minCommit: { ...testCfg.scaling.minCommit, safeCrack: 1 },
    dialCurve: {
      ...testCfg.scaling.dialCurve,
      safeCrack: { base: 1.5, perLanePoint: -0.3, tightenPerExtraCrew: 0.15 },
    },
  },
  roomTemplates: {
    ...testCfg.roomTemplates,
    obstacles: [
      {
        id: 'safecrack-vault',
        gameId: 'safeCrack',
        lane: 'tech',
        options: [
          { id: 'safe-patient', greedy: false, heatCost: 1, reward: 1 },
          { id: 'safe-speedy',  greedy: true,  heatCost: 2, reward: 2 },
        ],
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem:    (k: string) => data.get(k) ?? null,
    setItem:    (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

interface MakeSafeCrackStoreOpts {
  techStat?:      number;
  stealthStat?:   number;
  alicePowerUps?: Lane[];
  bobPowerUps?:   Lane[];
  twoPlayers?:    boolean;
}

/**
 * Build a store in the minigame phase at a safeCrack obstacle.
 * With twoPlayers=true a second player (Bob) is added and both are committed.
 */
function makeSafeCrackStore(seed = 1, opts: MakeSafeCrackStoreOpts = {}) {
  const store = createGameStore({ cfg: safeCrackCfg, storage: makeStorage() });
  const playerSetup = opts.twoPlayers
    ? [{ name: 'Alice' }, { name: 'Bob' }]
    : [{ name: 'Alice' }];
  store.getState().startRun(playerSetup, seed);

  const crew = store.getState().session.present.crew;
  const alice = crew[0]!;

  if (opts.techStat !== undefined) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_STAT', player: alice.id, lane: 'tech', value: opts.techStat });
  }
  if (opts.stealthStat !== undefined) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_STAT', player: alice.id, lane: 'stealth', value: opts.stealthStat });
  }
  for (const lane of opts.alicePowerUps ?? []) {
    store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: alice.id, lane, held: true });
  }
  if (opts.twoPlayers && crew[1]) {
    const bob = crew[1];
    for (const lane of opts.bobPowerUps ?? []) {
      store.getState().dispatch({ t: 'OVERRIDE_SET_POWERUP', player: bob.id, lane, held: true });
    }
  }

  const room = store.getState().session.present.currentRoom;
  if (room === null || room.kind !== 'obstacle') {
    throw new Error('Expected obstacle room after startRun with safeCrackCfg');
  }
  const committed: PlayerId[] = opts.twoPlayers
    ? crew.map(p => p.id)
    : [alice.id];
  store.getState().dispatch({
    t: 'CHOOSE_OPTION',
    optionId: room.options[0]!.id,
    committed,
  });

  return store;
}

function readDialLevel(): number {
  const text = screen.getByTestId('dial-level').textContent ?? '';
  return parseFloat(text.replace('Difficulty: ', ''));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MinigameHost — safeCrack end-to-end', () => {
  describe('game resolution', () => {
    it('mounts SafeCrackComponent instead of the stub', () => {
      const store = makeSafeCrackStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      // SafeCrackComponent has this testid; MinigameStub has btn-outcome-clean instead
      expect(screen.getByTestId('safe-crack')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-outcome-clean')).not.toBeInTheDocument();
    });

    it('renders DialReadout alongside the game component', () => {
      const store = makeSafeCrackStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      expect(screen.getByTestId('dial-readout')).toBeInTheDocument();
    });
  });

  describe('seeded params', () => {
    it('same seed → identical params across two independent stores', () => {
      const storeA = makeSafeCrackStore(42);
      const { unmount: unmountA } = render(
        <StoreContext.Provider value={storeA}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const codeLenA = screen.getByTestId('code-length').textContent;
      const dialA    = readDialLevel();
      unmountA();

      const storeB = makeSafeCrackStore(42);
      render(
        <StoreContext.Provider value={storeB}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const codeLenB = screen.getByTestId('code-length').textContent;
      const dialB    = readDialLevel();

      expect(codeLenA).toBe(codeLenB);
      expect(dialA).toBe(dialB);
    });

    it('params remain stable across re-renders (memo guard)', () => {
      const store = makeSafeCrackStore();
      const { rerender } = render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const codeLen1 = screen.getByTestId('code-length').textContent;

      rerender(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const codeLen2 = screen.getByTestId('code-length').textContent;

      expect(codeLen1).toBe(codeLen2);
    });
  });

  describe('dial wiring', () => {
    it('dial level decreases (easier) as committed tech+stealth stats rise', () => {
      const storeLow = makeSafeCrackStore(1, { techStat: 0, stealthStat: 0 });
      const { unmount: unmountLow } = render(
        <StoreContext.Provider value={storeLow}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const dialLow = readDialLevel();
      unmountLow();

      const storeHigh = makeSafeCrackStore(1, { techStat: 4, stealthStat: 4 });
      render(
        <StoreContext.Provider value={storeHigh}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const dialHigh = readDialLevel();

      expect(isNaN(dialLow)).toBe(false);
      expect(isNaN(dialHigh)).toBe(false);
      expect(dialHigh).toBeLessThan(dialLow);
    });
  });

  describe('boost surfacing', () => {
    it('both Stethoscope (tech) and Patient Touch (stealth) surface when both power-ups are held', () => {
      const store = makeSafeCrackStore(1, {
        twoPlayers:    true,
        alicePowerUps: ['tech'],
        bobPowerUps:   ['stealth'],
      });
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      expect(screen.getByTestId('boost-tech')).toBeInTheDocument();
      expect(screen.getByTestId('boost-stealth')).toBeInTheDocument();
    });

    it('no boost button renders when no committed player holds a power-up', () => {
      const store = makeSafeCrackStore(1);
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      expect(screen.queryByTestId('boost-tech')).not.toBeInTheDocument();
      expect(screen.queryByTestId('boost-stealth')).not.toBeInTheDocument();
    });

    it('Stethoscope (tech) fires once and then disables', () => {
      const store = makeSafeCrackStore(1, { alicePowerUps: ['tech'] });
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const btn = screen.getByTestId('boost-tech');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(btn).toBeDisabled();
    });

    it('Patient Touch (stealth) fires once and then disables', () => {
      const store = makeSafeCrackStore(1, {
        twoPlayers:  true,
        bobPowerUps: ['stealth'],
      });
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );
      const btn = screen.getByTestId('boost-stealth');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(btn).toBeDisabled();
    });
  });

  describe('outcome flow — GM confirm feeds the engine', () => {
    it('GM selects botched and confirms → RESOLVE_MINIGAME → phase is offer', () => {
      const store = makeSafeCrackStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('outcome-option-botched'));
      fireEvent.click(screen.getByTestId('outcome-confirm'));

      expect(store.getState().session.present.phase).toBe('offer');
      const history = store.getState().session.present.history;
      const last = history[history.length - 1];
      expect(last?.kind).toBe('obstacle');
      if (last?.kind === 'obstacle') {
        expect(last.outcome).toBe('botched');
      }
    });

    it('GM overrides to clean outcome → RESOLVE_MINIGAME → recorded as clean', () => {
      const store = makeSafeCrackStore();
      render(
        <StoreContext.Provider value={store}>
          <MinigameHost />
        </StoreContext.Provider>,
      );

      // Judge suggests botched (game not played); GM overrides to clean
      fireEvent.click(screen.getByTestId('outcome-option-clean'));
      fireEvent.click(screen.getByTestId('outcome-confirm'));

      const history = store.getState().session.present.history;
      const last = history[history.length - 1];
      expect(last?.kind).toBe('obstacle');
      if (last?.kind === 'obstacle') {
        expect(last.outcome).toBe('clean');
      }
    });
  });
});
