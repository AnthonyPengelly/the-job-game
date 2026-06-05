import type { DefuseRulebookSlice } from '@/platform/channel';

interface Props {
  slice: DefuseRulebookSlice;
}

/** Player-facing rulebook for Defuse the Alarm. Never receives GM-only state. */
export function DefuseRulebook({ slice }: Props): JSX.Element {
  return (
    <div data-testid="defuse-rulebook">
      <h2>Wire Cutting Rules</h2>
      {!slice.gameActive ? (
        <p data-testid="defuse-waiting">Waiting for game to start...</p>
      ) : (
        <ul data-testid="defuse-rules-list">
          {slice.rules.map((rule, i) => (
            <li key={i} data-testid={`defuse-rule-${i}`}>
              {rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
