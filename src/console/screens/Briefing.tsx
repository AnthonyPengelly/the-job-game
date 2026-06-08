import { useState } from 'react';
import { Gift } from 'lucide-react';
import { useGameStore } from '@/console/store';
import { PhaseHead, Panel, ActionBar, Button } from '@/console/ui';
import { Teleprompter } from '@/console/teleprompter';

export function Briefing() {
  const mansion = useGameStore(s => s.session.present.mansion);
  const crew = useGameStore(s => s.session.present.crew);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);

  const crewNames = crew.map(p => p.name).join(', ');

  // Commit briefing lines once at mount — within-beat stepping, no re-roll.
  const [lines] = useState<string[]>(() =>
    director?.script('briefing', { mansionType: mansion.type, crew: crewNames }) ?? [],
  );
  const [lineIndex, setLineIndex] = useState(0);

  const currentLine = lines[lineIndex] ?? '';
  const hasNext = lineIndex < lines.length - 1;

  function handleAdvance() {
    setLineIndex(i => Math.min(i + 1, lines.length - 1));
  }

  function handleBegin() {
    // Advance from the briefing phase to the first room. In normal flow, START_RUN
    // already generated room 0 and set phase='room'. This Begin action handles
    // the edge case where the GM has override-jumped back to 'briefing' phase.
    dispatch({ t: 'OVERRIDE_SET_PHASE', phase: 'room' });
  }

  const spine = director?.spine ?? null;

  return (
    <div className="stage-inner" data-testid="screen-briefing">
      <PhaseHead
        eyebrow="02 · Briefing"
        title="Briefing"
      />

      <div data-testid="mansion-dressing">
        <Teleprompter line={currentLine} hasNext={hasNext} onAdvance={handleAdvance} />
      </div>

      {/* Dossier — "Tonight's Mark" */}
      <Panel title="Tonight's Mark" tag={spine?.markName ?? mansion.type} className="dossier-panel">
        <div data-testid="dossier">
          {/* Image strip / drop caption */}
          <div className="dossier-img-strip" data-testid="dossier-img-strip">
            <span className="dossier-cap">
              {spine?.dropCaption ?? '—'}
            </span>
          </div>

          {/* Dossier stat grid */}
          <div className="dossier-stats" data-testid="dossier-stats">
            <div className="dstat" data-testid="dossier-target-haul">
              <span className="k">Target haul</span>
              <span className="v" style={{ color: 'var(--accent)' }}>{spine?.targetHaul ?? '—'}</span>
            </div>
            <div className="dstat" data-testid="dossier-security">
              <span className="k">Security</span>
              <span className="v" style={{ color: 'var(--caution)' }}>{spine?.security ?? '—'}</span>
            </div>
            <div className="dstat" data-testid="dossier-vault">
              <span className="k">The vault</span>
              <span className="v">{spine?.vault ?? '—'}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* "Every room pays out" framing panel */}
      <div className="payout-panel" data-testid="payout-panel">
        <Gift size={18} aria-hidden={true} />
        <div>
          <div className="payout-heading">Every room pays out</div>
          <div className="payout-sub">Loot, Gear, or both — obstacles and scenarios alike.</div>
        </div>
      </div>

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
