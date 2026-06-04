// Pure GM-override event handlers.
// No Math.random, no mutation, no side effects.
// OVERRIDE_REROLL_ROOM and OVERRIDE_SKIP_ROOM advance rngState via generateRoom.
//
// Force-outcome is handled by GM-supplied RESOLVE_MINIGAME + UNDO_LAST (E2.6);
// gear grant/remove is expressed via OVERRIDE_SET_STAT / OVERRIDE_SET_POWERUP.
import { generateRoom } from './generation';
import { escapeSignal as computeEscapeSignal } from './heat';
import type { EngineConfig } from './config';
import type { OverrideEvent, Player, RunState } from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Return the player at the given index, throwing loudly if absent.
 * All override handlers call this so out-of-range indices are caught early.
 */
function requirePlayer(state: RunState, playerId: string): [Player, number] {
  const idx = state.crew.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error(`Override: unknown player id "${playerId}"`);
  return [state.crew[idx]!, idx];
}

/** Replace the player at `idx` in the crew array, returning a new crew. */
function replaceCrew(state: RunState, idx: number, updated: Player): RunState['crew'] {
  return state.crew.map((p, i) => (i === idx ? updated : p));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Apply a GM-override event to the run state.
 * Returns a fresh RunState; input is never mutated.
 * Clamps: heat ∈ [0, hMax]; loot ≥ 0.
 */
export function applyOverride(
  state: RunState,
  event: OverrideEvent,
  cfg: EngineConfig,
): RunState {
  switch (event.t) {
    // ── Heat ──────────────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_HEAT': {
      const next: RunState = { ...state, heat: Math.min(cfg.heat.hMax, Math.max(0, event.value)) };
      return { ...next, escapeSignal: computeEscapeSignal(next, cfg) };
    }

    case 'OVERRIDE_ADJUST_HEAT': {
      const next: RunState = {
        ...state,
        heat: Math.min(cfg.heat.hMax, Math.max(0, state.heat + event.delta)),
      };
      return { ...next, escapeSignal: computeEscapeSignal(next, cfg) };
    }

    // ── Loot ──────────────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_LOOT': {
      return { ...state, loot: Math.max(0, event.value) };
    }

    case 'OVERRIDE_ADJUST_LOOT': {
      return { ...state, loot: Math.max(0, state.loot + event.delta) };
    }

    // ── Player stats ──────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_STAT': {
      const [player, idx] = requirePlayer(state, event.player);
      const updated: Player = {
        ...player,
        stats: { ...player.stats, [event.lane]: event.value },
      };
      return { ...state, crew: replaceCrew(state, idx, updated) };
    }

    case 'OVERRIDE_ADJUST_STAT': {
      const [player, idx] = requirePlayer(state, event.player);
      const updated: Player = {
        ...player,
        stats: { ...player.stats, [event.lane]: player.stats[event.lane] + event.delta },
      };
      return { ...state, crew: replaceCrew(state, idx, updated) };
    }

    // ── Power-ups ─────────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_POWERUP': {
      const [player, idx] = requirePlayer(state, event.player);
      // Rebuild powerUps: add or remove the lane entry.
      const oldPowerUps = player.powerUps;
      const newPowerUps: Player['powerUps'] = event.held
        ? { ...oldPowerUps, [event.lane]: true }
        : (() => {
            const copy = { ...oldPowerUps };
            delete copy[event.lane];
            return copy;
          })();
      const updated: Player = { ...player, powerUps: newPowerUps };
      return { ...state, crew: replaceCrew(state, idx, updated) };
    }

    // ── Resting ───────────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_RESTING': {
      const [player, idx] = requirePlayer(state, event.player);
      // When untilRoom is absent, clear restingUntilRoom entirely.
      // exactOptionalPropertyTypes: we cannot set the key to undefined — must omit it.
      const updated: Player = event.untilRoom !== undefined
        ? { ...player, restingUntilRoom: event.untilRoom }
        : (() => {
            const { restingUntilRoom: _omit, ...rest } = player;
            void _omit;
            return rest;
          })();
      return { ...state, crew: replaceCrew(state, idx, updated) };
    }

    // ── Room manipulation ─────────────────────────────────────────────────────

    case 'OVERRIDE_REROLL_ROOM': {
      // Regenerate the current room in-place, advancing rngState.
      // Preserve carried effects — reroll does not advance roomIndex, so no tick.
      return { ...generateRoom(state, cfg), carried: state.carried };
    }

    case 'OVERRIDE_SKIP_ROOM': {
      // Advance roomIndex and generate the next room without resolving the current one.
      // No forcedGetaway check — the GM is explicitly bypassing normal flow.
      const withNextIndex: RunState = { ...state, roomIndex: state.roomIndex + 1 };
      const generated = generateRoom(withNextIndex, cfg);
      const next: RunState = { ...generated, phase: 'room' };
      return { ...next, escapeSignal: computeEscapeSignal(next, cfg) };
    }

    // ── Phase ─────────────────────────────────────────────────────────────────

    case 'OVERRIDE_SET_PHASE': {
      return { ...state, phase: event.phase };
    }

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
