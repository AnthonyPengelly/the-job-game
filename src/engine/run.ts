import { rngFromState } from './rng';
import type { Player, PlayerSetup, PlayerId, RunEvent, RunState } from './types';

const MANSION_TYPES = ['villa', 'estate', 'penthouse'] as const;

const MEDIOCRE_STATS = { tech: 0, physical: 0, charm: 0, stealth: 0 } as const;

function makePlayer(setup: PlayerSetup, index: number): Player {
  return {
    id: `player-${index}` as PlayerId,
    name: setup.name,
    stats: { ...MEDIOCRE_STATS },
    powerUps: {},
    ...(setup.quirk !== undefined && { quirk: setup.quirk }),
  };
}

/**
 * Minimal pre-briefing state. Every field is at its zero value; the run has
 * not started. rngState is seeded so the first draw is deterministic.
 */
export function initialState(seed: number): RunState {
  const s = seed >>> 0;
  return {
    seed: s,
    rngState: s,
    phase: 'briefing',
    heat: 0,
    loot: 0,
    crew: [],
    roomIndex: 0,
    obstacleCount: 0,
    currentRoom: null,
    carried: [],
    history: [],
    escapeSignal: false,
    mansion: { type: 'villa' },
  };
}

/**
 * Builds the full briefing state from a START_RUN event. Crew is created from
 * the supplied setup (names/quirks); stats default to the mediocre baseline
 * (gear/boosts are E2). The mansion type is drawn from the seeded RNG so the
 * same seed + same setup always produces the same RunState.
 */
export function startRun(
  state: RunState,
  event: Extract<RunEvent, { t: 'START_RUN' }>,
): RunState {
  const seed = event.seed !== undefined ? event.seed >>> 0 : state.seed;
  const rng = rngFromState(event.seed !== undefined ? seed : state.rngState);

  const mansionType = rng.pick(MANSION_TYPES);
  const crew: Player[] = event.crew.map((setup, i) => makePlayer(setup, i));

  return {
    ...state,
    seed,
    rngState: rng.state(),
    phase: 'briefing',
    heat: 0,
    loot: 0,
    crew,
    roomIndex: 0,
    obstacleCount: 0,
    currentRoom: null,
    carried: [],
    history: [],
    escapeSignal: false,
    mansion: { type: mansionType },
  };
}
