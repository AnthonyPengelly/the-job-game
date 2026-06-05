import type { FC } from 'react';
import type { Lane, Outcome, PlayerId, GameId, Rng } from '@/engine';

/** Normalised 0..n difficulty level set by the committed crew's lane rating(s). Lower = easier. */
export interface Difficulty {
  level: number;
}

/** A player projection the launcher builds from the committed crew — what a mini-game needs. */
export interface CommittedPlayer {
  id: PlayerId;
  name: string;
  stats: Record<Lane, number>;
  powerUps: Partial<Record<Lane, boolean>>;
}

/**
 * A lane-specific power-up effect that a committed holder can shout once per game.
 * `apply` is pure — it returns a new ChallengeState with the boost effect applied.
 */
export interface BoostHook<ChallengeState, Params> {
  lane: Lane;
  label: string;
  apply(state: ChallengeState, params: Params): ChallengeState;
}

/**
 * Props passed by the launcher to every mini-game Component.
 * ChallengeState is the component's internal React state, not a prop.
 */
export interface MiniGameProps<Params> {
  params: Params;
  dial: Difficulty;
  committed: CommittedPlayer[];
  onResolve: (outcome: Outcome) => void;
}

/**
 * The single shape every mini-game must implement.
 * Ten implementations behind one contract (MINIGAMES.md §1).
 */
export interface MiniGame<Params, ChallengeState> {
  id: GameId;
  /** The lane(s) that drive the dial and surface boosts for this game. */
  lanes: Lane[];
  /**
   * Procedurally generate game parameters from the seeded RNG.
   * Must be pure: no side effects, no Math.random. Same rng state + same dial ⇒ same params.
   */
  generate(rng: Rng, dial: Difficulty): Params;
  /** React component that renders the game and calls onResolve once the GM confirms. */
  Component: FC<MiniGameProps<Params>>;
  /** Suggest an outcome from the terminal challenge state. Pure: (state, params) → outcome. */
  judge(state: ChallengeState, params: Params): Outcome;
  /** Power-up boost hooks, one per lane in `lanes`. Empty array if the game has none. */
  boosts: BoostHook<ChallengeState, Params>[];
  /** Hard floor on committed crew size; the generator never offers this game below this count. */
  minCommit: number;
  /** Separate game module to use when committed headcount is 1, if the mechanic needs it. */
  soloVariantId?: GameId;
}
