import { useGameStore } from '@/console/store';
import type { MansionType } from '@/engine';

const MANSION_LABELS: Record<MansionType, string> = {
  villa: 'A lavish villa on the coast',
  estate: 'A sprawling country estate',
  penthouse: 'A sky-high penthouse suite',
};

export function Briefing() {
  const mansion = useGameStore(s => s.session.present.mansion);
  const dispatch = useGameStore(s => s.dispatch);

  const label = MANSION_LABELS[mansion.type] ?? mansion.type;

  function handleBegin() {
    // Advance from the briefing phase to the first room. In normal flow, START_RUN
    // already generated room 0 and set phase='room'. This Begin action handles
    // the edge case where the GM has override-jumped back to 'briefing' phase.
    dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'room' });
  }

  return (
    <div data-testid="screen-briefing">
      <h2>The Briefing</h2>
      <p data-testid="mansion-dressing">{label}</p>
      <button data-testid="btn-begin" onClick={handleBegin}>
        Begin
      </button>
    </div>
  );
}
