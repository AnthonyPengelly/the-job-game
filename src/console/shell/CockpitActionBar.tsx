interface CockpitActionBarProps {
  left?: React.ReactNode;
  cues?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * The cockpit bottom action bar.
 *
 * Has three zones: left (secondary / back), cues (contextual sound
 * shortcuts, centred), and right (primary CTA). All are optional
 * placeholders in E13.1 — filled contextually by phase screens in
 * E13.3/E13.7 onward.
 */
export function CockpitActionBar({ left, cues, right }: CockpitActionBarProps) {
  return (
    <div className="cockpit-actionbar" data-testid="cockpit-actionbar">
      <div className="grp">{left}</div>
      <div className="grp-cues">{cues}</div>
      <div className="grp">{right}</div>
    </div>
  );
}
