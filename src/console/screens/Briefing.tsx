import { useState } from 'react';
import { useGameStore } from '@/console/store';
import { PhaseHead, Panel, ActionBar, Button } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';

export function Briefing() {
  const mansion = useGameStore(s => s.session.present.mansion);
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
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

  const mansionLabel = mansion.type.charAt(0).toUpperCase() + mansion.type.slice(1);

  return (
    <div className="stage-inner" data-testid="screen-briefing">
      <PhaseHead
        eyebrow="02 · Briefing"
        title="The Briefing"
        aside={
          <>
            {mansionLabel}
            <br />
            <span style={{ color: 'var(--fg-faint)', fontSize: 13, fontFamily: 'var(--font-data)' }}>
              {roomIndex} rooms cleared
            </span>
          </>
        }
      />

      <div data-testid="mansion-dressing">
        <Teleprompter line={narrationLine} hasNext={true} onAdvance={handleAdvance} />
      </div>

      <div className="grid-3">
        <div className="readout">
          <span className="k">Crew</span>
          <span className="v">{crew.length}</span>
        </div>
        <div className="readout">
          <span className="k">Mark</span>
          <span className="v" style={{ fontSize: 28, textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
            {mansion.type}
          </span>
        </div>
        <div className="readout">
          <span className="k">Phase</span>
          <span className="v" style={{ fontSize: 28, fontFamily: 'var(--font-display)' }}>
            Briefing
          </span>
        </div>
      </div>

      <Panel title="Order of Play" tag="Mastermind reveals">
        <div className="checklist">
          {crew.map((player, i) => (
            <div key={player.id} className="check done">
              <span
                className="box"
                style={{ fontFamily: 'var(--font-data)', fontWeight: 800 }}
              >
                {i + 1}
              </span>
              <strong
                style={{
                  fontFamily: 'var(--font-display)',
                  textTransform: 'uppercase',
                  letterSpacing: '.02em',
                }}
              >
                {player.name}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <ActionBar
        right={
          <Button kind="primary" data-testid="btn-begin" onClick={handleBegin}>
            Begin
          </Button>
        }
      />
    </div>
  );
}
