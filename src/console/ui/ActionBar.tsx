import { useEffect } from 'react';
import { useActionBarSlotSetter } from '@/console/shell/actionBarSlot';

interface ActionBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Optional note rendered alongside the primary CTA in the right zone. */
  note?: React.ReactNode;
}

/**
 * Publishes left/right CTAs (and an optional note) to the ActionBarSlot
 * context so they appear in the cockpit's bottom grid action bar.
 *
 * Renders nothing in place — the CTAs live in the real grid bar, not
 * absolutely-positioned inside the stage, so stage content is never
 * covered by the bar.
 *
 * Existing call sites — `<ActionBar left right />` — keep working unchanged.
 */
export function ActionBar({ left, right, note }: ActionBarProps) {
  const { setSlot, clearSlot } = useActionBarSlotSetter();

  useEffect(() => {
    setSlot({ left, right, note });
    return clearSlot;
  }, [left, right, note, setSlot, clearSlot]);

  return null;
}
