import { rngFromState } from './rng';
import type { EngineConfig } from './config';
import type { Player, PlayerSetup, PlayerId, RunEvent, RunState } from './types';

const MANSION_TYPES = ['villa', 'estate', 'penthouse'] as const;

const MEDIOCRE_STATS = { tech: 0, physical: 0, charm: 0, stealth: 0 } as const;

function makePlayer(setup: PlayerSetup, index: number, cfg: EngineConfig): Player {
  const stats = { ...MEDIOCRE_STATS };
  if (setup.quirk !== undefined) {
    const quirkDef = cfg.quirks[setup.quirk];
    if (quirkDef !== undefined) {
      for (const boost of quirkDef.boosts) {
        stats[boost.lane] += boost.magnitude;
      }
    }
    // Unknown quirk: silently fall back to mediocre baseline (GM-override / no dead-end).
  }
  return {
    id: `player-${index}` as PlayerId,
    name: setup.name,
    stats,
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
    crewName: '',
    crew: [],
    roomIndex: 0,
    obstacleCount: 0,
    currentRoom: null,
    carried: [],
    history: [],
    escapeSignal: false,
    mansion: { type: 'villa' },
    usedObstacleTemplateIds: [],
    usedScenarioTemplateIds: [],
    earnedGear: [],
  };
}

/**
 * Builds the full briefing state from a START_RUN event. Crew is created from
 * the supplied setup (names/quirks); stats start at the mediocre baseline and
 * each player's chosen quirk's boosts are applied on top. The mansion type is
 * drawn from the seeded RNG so the same seed + same setup always produces the
 * same RunState.
 */
export function startRun(
  state: RunState,
  event: Extract<RunEvent, { t: 'START_RUN' }>,
  cfg: EngineConfig,
): RunState {
  const seed = event.seed !== undefined ? event.seed >>> 0 : state.seed;
  const rng = rngFromState(event.seed !== undefined ? seed : state.rngState);

  const mansionType = rng.pick(MANSION_TYPES);
  const crew: Player[] = event.crew.map((setup, i) => makePlayer(setup, i, cfg));

  return {
    ...state,
    seed,
    rngState: rng.state(),
    phase: 'briefing',
    heat: 0,
    loot: 0,
    crewName: event.crewName ?? '',
    crew,
    roomIndex: 0,
    obstacleCount: 0,
    currentRoom: null,
    carried: [],
    history: [],
    escapeSignal: false,
    mansion: { type: mansionType },
    usedObstacleTemplateIds: [],
    usedScenarioTemplateIds: [],
    earnedGear: [],
  };
}
