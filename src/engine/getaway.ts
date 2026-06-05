// Getaway odds, brief computation, and outcome resolution. Pure functions;
// no RNG calls inside — the caller supplies a seeded roll so the engine stays
// deterministic. Port of heat-model-simulation.py getaway() and resolve().
import type { EngineConfig } from './config';
import type { RunState } from './types';

/**
 * Compute the Getaway brief from Heat at the moment the screen opens.
 *
 * Maps heat → { targetCards, timerSeconds } by linearly interpolating between
 * cfg.getaway.brief.lowHeat and cfg.getaway.brief.highHeat anchors.  Both
 * outputs are rounded to integers; targetCards is non-decreasing in heat and
 * timerSeconds is non-increasing in heat (monotone by construction).
 *
 * Difficulty is locked at call time — subsequent GETAWAY_DITCH events raise
 * Heat in state but do not affect an already-computed brief.
 */
export function getawayBrief(
  heat: number,
  cfg: EngineConfig,
): { targetCards: number; timerSeconds: number } {
  const { brief } = cfg.getaway;
  const low = brief.lowHeat;
  const high = brief.highHeat;

  const range = high.heat - low.heat;
  const t = range <= 0
    ? 1
    : Math.min(1, Math.max(0, (heat - low.heat) / range));

  return {
    targetCards: Math.round(low.targetCards + t * (high.targetCards - low.targetCards)),
    timerSeconds: Math.round(low.timerSeconds + t * (high.timerSeconds - low.timerSeconds)),
  };
}

/**
 * Probability the crew successfully escapes at the given Heat level.
 *
 * Python ref:
 *   frac = H / HMAX
 *   p = 1 - frac**exp
 *   p += (crewSkill - skillPivot) * skillTerm + player_bonus(n) * headcountTerm
 *   return max(clamp[0], min(clamp[1], p))
 *
 * @param heat      Current Heat value
 * @param cfg       Active EngineConfig
 * @param headcount Number of crew members (integer 2–7; must key into cfg.scaling.profiles)
 * @param crewSkill Aggregate skill score in [0, 1] (harness supplies; E2+ derives from crew stats)
 */
export function getawayOdds(
  heat: number,
  cfg: EngineConfig,
  headcount: number,
  crewSkill: number,
): number {
  const frac = heat / cfg.heat.hMax;
  let p = 1.0 - Math.pow(frac, cfg.getaway.exponent);
  p += (crewSkill - cfg.getaway.skillPivot) * cfg.getaway.skillTerm;
  const profile = cfg.scaling.profiles[String(headcount)];
  if (profile !== undefined) {
    p += profile.getawayBonus * cfg.getaway.headcountTerm;
  }
  return Math.max(cfg.getaway.clamp[0], Math.min(cfg.getaway.clamp[1], p));
}

/**
 * Resolve the Getaway outcome from a pre-seeded roll.
 * Returns true (win) when roll < odds.
 *
 * The caller (reducer) draws the roll from the run RNG before calling here,
 * keeping this function pure and testable without an RNG instance.
 *
 * @param state     Current RunState (supplies heat and crew headcount)
 * @param cfg       Active EngineConfig
 * @param opts      `roll` — a float in [0, 1) from the seeded RNG
 *                  `crewSkill` — aggregate skill in [0, 1]; defaults to skillPivot
 *                                if omitted (neutral baseline, e.g. mediocre crew in E1)
 */
export function resolveGetawayOutcome(
  state: Pick<RunState, 'heat' | 'crew'>,
  cfg: EngineConfig,
  opts: { roll: number; crewSkill?: number },
): boolean {
  const crewSkill = opts.crewSkill ?? cfg.getaway.skillPivot;
  const odds = getawayOdds(state.heat, cfg, state.crew.length, crewSkill);
  return opts.roll < odds;
}
