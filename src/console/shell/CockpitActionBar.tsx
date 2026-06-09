import { useActionBarSlot } from './actionBarSlot';

/**
 * The cockpit bottom action bar.
 *
 * Reads left/right/note from the ActionBarSlot context published by the
 * active phase screen's <ActionBar> component. Three zones:
 *   left  — back / secondary CTA
 *   cues  — contextual sound shortcuts (reserved, empty until E20)
 *   right — note text + primary CTA
 */
export function CockpitActionBar() {
  const { left, right, note } = useActionBarSlot();

  return (
    <div className="cockpit-actionbar" data-testid="cockpit-actionbar">
      <div className="grp">{left}</div>
      <div className="grp-cues" />
      <div className="grp">
        {note !== undefined && (
          <span className="cockpit-actionbar-note">{note}</span>
        )}
        {right}
      </div>
    </div>
  );
}
