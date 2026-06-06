import type { DefuseRulebookSlice } from '@/platform/channel';

interface Props {
  slice: DefuseRulebookSlice;
}

/** Player-facing rulebook for Defuse the Alarm. Never receives GM-only state. */
export function DefuseRulebook({ slice }: Props): JSX.Element {
  return (
    <div data-testid="defuse-rulebook" className="pv-inner">
      <div className="pv-eyebrow">
        <span className="sq" />
        Player View
        <span className="div" />
        <span className="muted">Wire Cutting Rules</span>
      </div>
      <h1 className="pv-title">Defuse</h1>

      {!slice.gameActive ? (
        <p data-testid="defuse-waiting" className="pv-lede">
          Waiting for game to start&hellip;
        </p>
      ) : (
        <div data-testid="defuse-rules-list" className="pv-steps">
          {slice.rules.map((rule, i) => (
            <div key={i} className="pv-step" data-testid={`defuse-rule-${i}`}>
              <span className="num">{i + 1}</span>
              <span className="txt">{rule}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
