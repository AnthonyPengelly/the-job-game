import type { DefuseRulebookSlice } from '@/platform/channel';

interface Props {
  slice: DefuseRulebookSlice;
}

/**
 * Player-facing rulebook for Defuse the Alarm.
 *
 * One player holds this view (on a second screen or cast device) and reads
 * the conditional rules aloud while the rest of the crew describe the cards.
 * Never receives GM-only state (wire layout, safe/unsafe mapping, odds).
 */
export function DefuseRulebook({ slice }: Props): JSX.Element {
  return (
    <div data-testid="defuse-rulebook" className="pv-inner">
      <div className="pv-eyebrow">
        <span className="sq" />
        Player View
        <span className="div" />
        <span className="muted">You hold the manual</span>
      </div>
      <h1 className="pv-title">Defuse<br />the Alarm</h1>

      {!slice.gameActive ? (
        <p data-testid="defuse-waiting" className="pv-lede">
          Waiting for game to start&hellip;
        </p>
      ) : (
        <>
          <p className="pv-lede">
            You can&rsquo;t see the cards.
            The crew reads you the row, <b>left to right</b>.
            Find the <b>first rule that fits</b> &mdash; name that card.
          </p>
          <div data-testid="defuse-rules-list" className="pv-steps">
            {slice.rules.map((rule, i) => (
              <div key={i} className="pv-step" data-testid={`defuse-rule-${i}`}>
                <span className="num">{i + 1}</span>
                <span className="txt">{rule}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
