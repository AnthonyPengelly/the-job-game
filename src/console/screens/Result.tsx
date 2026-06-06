import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { getawayMultiplier } from '@/engine/scoring';
import { Teleprompter } from '@/console/teleprompter';
import { PhaseHead, Button, Icon } from '@/console/ui';

/**
 * GM console screen for the result phase.
 *
 * Shows the run outcome (win or bust), the final score, a score breakdown
 * (loot banked, heat at Getaway, multiplier applied), and a "Go again" button
 * that calls goAgain() — clears the save and returns to Setup.
 *
 * A winSting or bustSting narration line is surfaced via Teleprompter based on
 * the session outcome.
 *
 * Leaderboard outcome (new personal best / rank) is surfaced from the store's
 * currentRunNewBest and currentRunRank fields (written by E10.2 store logic).
 */
export function Result() {
  const state = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const goAgain = useGameStore(s => s.goAgain);
  const director = useGameStore(s => s.director);
  const currentRunRank = useGameStore(s => s.currentRunRank);
  const currentRunNewBest = useGameStore(s => s.currentRunNewBest);

  const win = state.win ?? false;
  const finalScore = state.finalScore ?? 0;

  const multiplier = getawayMultiplier(state.heat, win, cfg);

  const stingBeat = win ? 'winSting' : 'bustSting' as const;

  const [stingLine, setStingLine] = useState<string>(() =>
    director?.next(stingBeat) ?? ''
  );

  function handleStingAdvance() {
    if (!director) return;
    setStingLine(director.next(stingBeat));
  }

  return (
    <div data-testid="screen-result" className="stage-inner">
      <PhaseHead eyebrow="06 · Result" title="After the Job" />

      {/* Verdict headline */}
      <div
        data-testid="result-outcome"
        className={`verdict ${win ? 'win' : 'lose'}`}
      >
        {win ? 'Win' : 'Bust'}
      </div>

      {/* Win / bust sting narration */}
      {stingLine !== '' && (
        <div data-testid="result-sting">
          <Teleprompter line={stingLine} onAdvance={handleStingAdvance} />
        </div>
      )}

      {/* Leaderboard outcome: new personal-best badge and rank */}
      {currentRunNewBest && (
        <div data-testid="result-new-best" className="panel" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <Icon icon={Trophy} size={22} label="New personal best!" />
        </div>
      )}
      {currentRunRank !== null && (
        <p
          data-testid="result-rank"
          className="opt-tag"
          style={{ color: win ? 'var(--accent)' : 'var(--fg-muted)', textAlign: 'center' }}
        >
          Rank #{currentRunRank} on the leaderboard
        </p>
      )}

      {/* Final score */}
      <p data-testid="result-final-score" className="prose" style={{ textAlign: 'center', fontSize: 22 }}>
        Final score: {finalScore.toFixed(2)}
      </p>

      {/* Score breakdown stat tiles */}
      <div data-testid="result-breakdown" className="grid-3">
        <div className="readout" data-testid="breakdown-loot">
          <span className="k">Loot banked</span>
          <span className="v" style={{ color: 'var(--accent)' }}>{state.loot}</span>
        </div>
        <div className="readout" data-testid="breakdown-heat">
          <span className="k">Heat at getaway</span>
          <span className="v" style={{ color: win ? 'var(--fg)' : 'var(--danger)' }}>
            {String(state.heat).padStart(2, '0')}
          </span>
        </div>
        <div className="readout" data-testid="breakdown-multiplier">
          <span className="k">Multiplier</span>
          <span className="v">{multiplier.toFixed(2)}x</span>
        </div>
      </div>

      {/* Go again */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button kind="primary" size="lg" data-testid="btn-go-again" onClick={goAgain}>
          Go Again
        </Button>
      </div>
    </div>
  );
}
