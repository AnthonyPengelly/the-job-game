// Pure scaling-aware helpers: commit-range annotation, variant resolution, dial computation.
// No Math.random, no mutation, no side effects.
import type { EngineConfig } from './config';
import { profileFor } from './crew';

/**
 * Compute the valid [minCrew, maxCrew] commit range for an obstacle option at the
 * given headcount.
 *
 *   minCrew = max(minCommit[gameId] ?? 1, crewPerOption[headcount][0])
 *   maxCrew = min(crewPerOption[headcount][1], headcount)
 *
 * Headcount is clamped to 2–7 for profile lookup (matching profileFor semantics),
 * but the raw headcount bounds maxCrew so you can never commit more players than exist.
 */
export function obstacleCommitRange(
  gameId: string,
  headcount: number,
  cfg: EngineConfig,
): [number, number] {
  const profile = profileFor(headcount, cfg);
  const minCommit = cfg.scaling.minCommit[gameId] ?? 1;
  const minCrew = Math.max(minCommit, profile.crewPerOption[0]);
  const maxCrew = Math.min(profile.crewPerOption[1], headcount);
  return [minCrew, maxCrew];
}

/**
 * Resolve the effective game-module id for a committed crew size and headcount.
 * Returns the solo or group variant id when the game qualifies, or the base gameId.
 *
 * Eligibility rules for commit-1 ("solo") slots:
 *   - The game must not appear in cfg.scaling.excludedFromSolo.
 *   - If poolSize is supplied, the obstacle pool must be ≥ cfg.scaling.soloEligibleMinPool.
 */
export function resolveGameVariant(
  gameId: string,
  commitSize: number,
  _headcount: number,
  cfg: EngineConfig,
  poolSize?: number,
): string {
  if (commitSize === 1) {
    if (cfg.scaling.excludedFromSolo.includes(gameId)) return gameId;
    if (poolSize !== undefined && poolSize < cfg.scaling.soloEligibleMinPool) return gameId;
  }

  const entry = cfg.scaling.variant[gameId];
  if (entry === undefined) return gameId;
  if (!entry.appliesAt.includes(commitSize)) return gameId;

  if (commitSize === 1 && entry.soloVariantId !== undefined) return entry.soloVariantId;
  if (entry.variantId !== undefined) return entry.variantId;

  return gameId;
}

/**
 * Compute the difficulty dial value for a mini-game given the lane ratings of the
 * committed players.
 *
 * Formula (from the active preset's dialCurve for gameId, or _default):
 *   dial = base + perLanePoint × Σ(ratings) − tightenPerExtraCrew × (commitSize − 1)
 *
 * Higher ratings lower the dial (easier); more committed crew also eases it.
 * The tightenPerExtraCrew preset field stores the magnitude of the easing-per-extra-crew
 * credit (positive value ⇒ subtracted in the formula).
 */
export function computeDial(
  committedLaneRatings: number[],
  gameId: string,
  _headcount: number,
  cfg: EngineConfig,
): number {
  const curve = cfg.scaling.dialCurve[gameId] ?? cfg.scaling.dialCurve['_default'];
  if (curve === undefined) {
    throw new Error(`computeDial: no dial curve for game "${gameId}" and no "_default" in preset`);
  }
  const sum = committedLaneRatings.reduce((acc, r) => acc + r, 0);
  const commitSize = committedLaneRatings.length;
  return curve.base + curve.perLanePoint * sum - curve.tightenPerExtraCrew * (commitSize - 1);
}
