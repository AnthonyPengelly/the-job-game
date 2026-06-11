import { useState } from 'react';
import { Trophy, PartyPopper, Siren } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { getawayMultiplier } from '@/engine/scoring';
import { Teleprompter } from '@/console/teleprompter';
import { ActionBar, Button } from '@/console/ui';
import { formatLoot } from '@/content/format';
import type { LeaderboardEntry } from '@/content/schema/leaderboard';

// ── Rank panel ────────────────────────────────────────────────────────────────

interface RankPanelProps {
  entries: LeaderboardEntry[];
  runSeed: number;
  currentRunNewBest: boolean;
  currentRunRank: number | null;
  win: boolean;
  /** Current run's actual data (for the "Did not place" bottom row). */
  crewName: string;
  heat: number;
  finalScore: number;
}

function RankPanel({
  entries,
  runSeed,
  currentRunNewBest,
  currentRunRank,
  win,
  crewName,
  heat,
  finalScore,
}: RankPanelProps) {
  const top5 = entries.slice(0, 5);
  const currentInTop5 = top5.some(e => e.runSeed === runSeed) && currentRunNewBest;

  return (
    <div data-testid="result-rank" className="rankpanel">
      <div className="rp-head">
        <Trophy size={17} strokeWidth={1.75} aria-hidden />
        <h3>Personal best</h3>
        {currentRunNewBest && currentRunRank !== null ? (
          <span data-testid="result-new-best" className="badge b-live">
            <span className="d" />
            New best · #{currentRunRank}
          </span>
        ) : (
          <span className="badge b-danger">
            <span className="d" />
            Did not place
          </span>
        )}
      </div>
      <div className="rp-body">
        {top5.map((entry, i) => {
          const isCurrent = currentRunNewBest && entry.runSeed === runSeed;
          const rowClass = isCurrent
            ? `lrow you${win ? '' : ' lose'}`
            : 'lrow';
          return (
            <div key={entry.runSeed} className={rowClass}>
              <span className="rank">{i + 1}</span>
              <span className="lname">{entry.crewName || '—'}</span>
              <span className="lscore">{formatLoot(Math.round(entry.score))}</span>
              <span className="lheat">H {entry.heatAtGetaway}</span>
            </div>
          );
        })}
        {!currentInTop5 && (
          <div className={`lrow you${win ? '' : ' lose'}`}>
            <span className="rank">—</span>
            <span className="lname">{crewName || '—'}</span>
            <span className="lscore">{formatLoot(Math.round(finalScore))}</span>
            <span className="lheat">H {heat}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────────────────────

export function Result() {
  const state = useGameStore(s => s.session.present);
  const cfg = useGameStore(s => s.cfg);
  const goAgain = useGameStore(s => s.goAgain);
  const director = useGameStore(s => s.director);
  const currentRunRank = useGameStore(s => s.currentRunRank);
  const currentRunNewBest = useGameStore(s => s.currentRunNewBest);
  const leaderboard = useGameStore(s => s.leaderboard);
  const runSeed = useGameStore(s => s.runSeed);

  const win = state.win ?? false;
  const finalScore = state.finalScore ?? 0;
  const multiplier = getawayMultiplier(state.heat, win, cfg);

  const stingBeat = win ? 'winSting' : ('bustSting' as const);

  // Committed once at mount; no re-roll on advance.
  const [stingLines] = useState<string[]>(() => director?.script(stingBeat) ?? []);
  const [lineIndex, setLineIndex] = useState(0);

  function handleStingAdvance() {
    setLineIndex(i => Math.min(i + 1, stingLines.length - 1));
  }

  const stingLine = stingLines[lineIndex] ?? '';
  const hasNext = lineIndex < stingLines.length - 1;

  const reasonText = win
    ? state.heat >= cfg.heat.hMax
      ? `Heat ${state.heat} / ${cfg.heat.hMax} — a hot exit`
      : `Heat ${state.heat} / ${cfg.heat.hMax} — stayed cool`
    : `Heat ${state.heat} / ${cfg.heat.hMax} — maxed out`;

  return (
    <div data-testid="screen-result" className="stage-inner">
      {/* Verdict headline */}
      <div
        data-testid="result-outcome"
        className={`verdict ${win ? 'win' : 'lose'}`}
      >
        <span className="vmark">
          {win
            ? <PartyPopper size={34} strokeWidth={1.75} aria-hidden />
            : <Siren size={34} strokeWidth={1.75} aria-hidden />}
        </span>
        <span className="vbig">{win ? 'Clean Getaway' : 'Job Blown'}</span>
      </div>

      {/* Win / bust sting narration */}
      {stingLine !== '' && (
        <div data-testid="result-sting">
          <Teleprompter line={stingLine} hasNext={hasNext} onAdvance={handleStingAdvance} />
        </div>
      )}

      {/* Score equation: Loot banked × Multiplier = Final score */}
      <div data-testid="result-breakdown" className="score-eq">
        <div className="score-cell" data-testid="breakdown-loot">
          <span className="k">{win ? 'Loot banked' : 'Loot salvaged'}</span>
          <span className="v">{formatLoot(state.loot)}</span>
          <span className="s">{win ? `across ${state.roomIndex} rooms` : 'dropped the rest running'}</span>
        </div>
        <div className="score-op">×</div>
        <div className="score-cell" data-testid="breakdown-multiplier">
          <span className="k">Multiplier</span>
          <span
            className="v"
            style={{ color: win ? 'var(--accent)' : 'var(--danger)' }}
          >
            {multiplier.toFixed(2)}
          </span>
          <span className="s" data-testid="breakdown-heat">{reasonText}</span>
        </div>
        <div className="score-op">=</div>
        <div className={`score-final${win ? '' : ' lose'}`} data-testid="result-final-score">
          <span className="k">Final score</span>
          <span className="v">{formatLoot(Math.round(finalScore))}</span>
        </div>
      </div>

      {/* Personal best rank panel */}
      <RankPanel
        entries={leaderboard}
        runSeed={runSeed}
        currentRunNewBest={currentRunNewBest}
        currentRunRank={currentRunRank}
        win={win}
        crewName={state.crewName}
        heat={state.heat}
        finalScore={finalScore}
      />

      {/* Actions */}
      <ActionBar
        left={
          <Button kind="ghost" data-testid="btn-run-summary">
            Run summary
          </Button>
        }
        right={
          <Button kind="primary" size="lg" data-testid="btn-go-again" onClick={goAgain}>
            Go Again
          </Button>
        }
      />
    </div>
  );
}
