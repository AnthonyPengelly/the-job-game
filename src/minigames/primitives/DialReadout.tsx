import type { Difficulty } from '@/minigames/contract';

export interface DialReadoutProps {
  dial: Difficulty;
}

/** GM-only display of the resolved difficulty level. The crew never sees this. */
export function DialReadout({ dial }: DialReadoutProps): JSX.Element {
  const display = dial.level.toFixed(1);
  return (
    <div data-testid="dial-readout" aria-label={`Difficulty: ${display}`}>
      <span data-testid="dial-level">Difficulty: {display}</span>
    </div>
  );
}
