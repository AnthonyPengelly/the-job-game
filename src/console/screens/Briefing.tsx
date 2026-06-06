import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { Teleprompter } from '@/console/teleprompter';

export function Briefing() {
  const mansion = useGameStore(s => s.session.present.mansion);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const [narrationLine, setNarrationLine] = useState(() =>
    director?.next('briefing', { mansionType: mansion.type }) ?? ''
  );

  function handleBegin() {
    // Advance from the briefing phase to the first room. In normal flow, START_RUN
    // already generated room 0 and set phase='room'. This Begin action handles
    // the edge case where the GM has override-jumped back to 'briefing' phase.
    dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'room' });
  }

  function handleAdvance() {
    if (!director) return;
    setNarrationLine(director.next('briefing', { mansionType: mansion.type }));
  }

  return (
    <div data-testid="screen-briefing">
      <h2>The Briefing</h2>
      <div data-testid="mansion-dressing">
        <Teleprompter line={narrationLine} onAdvance={handleAdvance} />
      </div>
      <button data-testid="btn-begin" onClick={handleBegin}>
        Begin
      </button>
    </div>
  );
}
