import { useGameStore } from '@/console/store';
import type { DiceMode } from '@/content/schema/settings';

/**
 * GM-only control to toggle between app-rolled d20 and physically-rolled d20.
 * The setting is persisted under its own localStorage key (the-job:settings),
 * separate from the run save, so it survives run resets.
 * Never rendered to the player-view.
 */
export function DiceModeControl() {
  const diceMode = useGameStore(s => s.diceMode);
  const setDiceMode = useGameStore(s => s.setDiceMode);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDiceMode(e.target.value as DiceMode);
  }

  return (
    <div data-testid="dice-mode-control">
      <label htmlFor="dice-mode-select">Dice mode</label>
      <select
        id="dice-mode-select"
        data-testid="dice-mode-select"
        value={diceMode}
        onChange={handleChange}
      >
        <option value="app">App roll</option>
        <option value="physical">Physical roll</option>
      </select>
    </div>
  );
}
