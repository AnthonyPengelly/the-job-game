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

  return (
    <div data-testid="getaway-display">
      <h2>Getaway!</h2>

      <p data-testid="getaway-clue-giver">
        Clue-giver: <strong>{clueGiverName}</strong>
      </p>

      <p data-testid="getaway-cards-cleared">
        {cardsCleared} / {targetCards} cards cleared
      </p>

      <div data-testid="getaway-timer" data-remaining={secondsRemaining}>
        {gameActive ? formattedTime : 'Waiting...'}
      </div>
    </div>
  );
}
