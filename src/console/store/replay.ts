import { initialState, reduce, initialSession } from '@/engine';
import type { EngineConfig } from '@/engine';
import type { RunEvent, SessionState } from '@/engine';

/**
 * Pure replay: fold every event in the log through `reduce` starting from
 * `initialState(seed)`, then wrap in a fresh session with an empty past stack.
 *
 * Returns a SessionState whose `present` is byte-identical to the state that
 * produced the event log — the determinism guarantee of the seeded reducer.
 * The `past` undo stack is empty after replay (ephemeral, not persisted).
 */
export function replay(
  seed: number,
  eventLog: RunEvent[],
  cfg: EngineConfig,
): SessionState {
  let state = initialState(seed);
  for (const event of eventLog) {
    state = reduce(state, event, cfg);
  }
  return initialSession(state);
}
