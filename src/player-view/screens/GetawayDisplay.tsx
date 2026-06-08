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

  const remaining = targetCards - cardsCleared;

  const subText = !gameActive
    ? 'Waiting to start…'
    : danger
      ? `${remaining} card${remaining !== 1 ? 's' : ''} left — go!`
      : `${cardsCleared} of ${targetCards} cleared`;

  return (
    <div data-testid="getaway-display" className="pv-inner center" style={{ alignItems: 'center' }}>
      <div className={`pv-clock-label${danger ? ' danger' : ''}`}>Get to the van</div>

      <div
        data-testid="getaway-timer"
        data-remaining={secondsRemaining}
        className={`pv-clock${danger ? ' danger' : ''}`}
      >
        {gameActive ? formattedTime : '—:——'}
      </div>

      {/* Progress dots — one per card, cleared dots lit up */}
      <div className="pv-progdots" data-testid="getaway-progdots">
        {Array.from({ length: targetCards }, (_, i) => (
          <span
            key={i}
            className={`d${i < cardsCleared ? ' on' : danger ? ' left' : ''}`}
          />
        ))}
      </div>

      <div
        className={`pv-clock-sub${danger ? ' danger' : ''}`}
        data-testid="getaway-clock-sub"
      >
        {subText}
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
