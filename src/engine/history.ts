// Pure session reducer — wraps reduce() with UNDO_LAST support.
//
// SessionState holds the current RunState (present) plus a stack of prior
// RunStates (past) that were pushed before each event. UNDO_LAST pops the
// stack one level. At the root (past is empty) UNDO_LAST is a safe no-op —
// the GM can never be left in a dead-end by an undo.
//
// The E3 Zustand store will hold a SessionState and call reduceSession for
// every event. UNDO_LAST is a *session* event, not a RunEvent — this keeps
// reduce()'s exhaustive switch clean.
import { reduce } from './reduce';
import type { EngineConfig } from './config';
import type { RunState, RunEvent } from './types';

// ── Session event ─────────────────────────────────────────────────────────────

/** RunEvent plus the session-level UNDO_LAST. */
export type SessionEvent = RunEvent | { t: 'UNDO_LAST' };

// ── Session state ─────────────────────────────────────────────────────────────

/** Full session: current run state plus a stack of prior states for undo. */
export interface SessionState {
  present: RunState;
  /** Prior states, newest first. past[0] is the state before the last event. */
  past: RunState[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Wrap a RunState in a fresh session with an empty undo stack. */
export function initialSession(state: RunState): SessionState {
  return { present: state, past: [] };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

/**
 * Pure session reducer.
 * - Non-undo events: push present onto past, advance present via reduce().
 * - UNDO_LAST: pop past[0] into present (no-op at root — never throws).
 *
 * Input session is never mutated. Returns a fresh SessionState.
 */
export function reduceSession(
  session: SessionState,
  event: SessionEvent,
  cfg: EngineConfig,
): SessionState {
  if (event.t === 'UNDO_LAST') {
    if (session.past.length === 0) {
      return session;
    }
    const [head, ...tail] = session.past;
    return { present: head!, past: tail };
  }
  return {
    present: reduce(session.present, event, cfg),
    past: [session.present, ...session.past],
  };
}
