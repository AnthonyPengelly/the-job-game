import type { LucideIcon as LucideIconType } from 'lucide-react';

interface IconProps {
  /** The Lucide icon component to render. */
  icon: LucideIconType;
  /** Size in px (default 18). */
  size?: number;
  /** Optional mono-caps label paired with the icon (design rule: always pair an icon with text). */
  label?: string;
  className?: string;
}

/**
 * Wrapper around lucide-react icons.
 * Enforces stroke 1.75. When `label` is provided the icon and label are
 * rendered as an inline flex pair; without `label` the icon element is
 * returned directly (for use inside Button where the children supply the label).
 */
export function Icon({ icon: Ic, size = 18, label, className }: IconProps) {
  if (label) {
    return (
      <span
        className={['icon-labeled', className].filter(Boolean).join(' ')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
      >
        <Ic size={size} strokeWidth={1.75} aria-hidden={true} />
        <span className="icon-label t-label">{label}</span>
      </span>
    );
  }
  return <Ic size={size} strokeWidth={1.75} className={className} aria-hidden={true} />;
}
