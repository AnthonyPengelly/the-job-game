import type { GetawaySlice } from '@/platform/channel';

interface Props {
  slice: GetawaySlice;
}

/** Player-facing Getaway display. Never receives GM-only state (Heat, odds, score). */
export function GetawayDisplay({ slice }: Props): JSX.Element {
  const { cardsCleared, targetCards, secondsRemaining, clueGiverName, gameActive } = slice;

  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${minutes}:${String(secs).padStart(2, '0')}`;
  const danger = gameActive && secondsRemaining <= 15;

  return (
    <div data-testid="getaway-display" className="pv-inner" style={{ alignItems: 'center' }}>
      <div className="pv-clock-label">Get to the van</div>

      <div
        data-testid="getaway-timer"
        data-remaining={secondsRemaining}
        className={`pv-clock${danger ? ' danger' : ''}`}
      >
        {gameActive ? formattedTime : '—:——'}
      </div>

      <div className="pv-check" data-testid="getaway-cards-cleared">
        <span className="k">Cards cleared</span>
        <span className="v">
          {cardsCleared}&thinsp;/&thinsp;{targetCards}
        </span>
      </div>

      <p data-testid="getaway-clue-giver" className="pv-lede">
        Clue-giver: <b>{clueGiverName}</b>
      </p>
    </div>
  );
}
