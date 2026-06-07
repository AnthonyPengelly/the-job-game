import { useEffect, useRef } from 'react';

interface PopoverProps {
  /**
   * Position relative to the cockpit container.
   * The caller is responsible for computing `top`/`left`/`right`/`bottom`
   * from the trigger's bounding rect.
   */
  style?: React.CSSProperties;
  /** Which side the arrow points to (where the popover is anchored). */
  anchor?: 'left' | 'right';
  /** Called when the popover should close (click outside or Esc). */
  onClose: () => void;
  children: React.ReactNode;
  'data-testid'?: string;
}

/**
 * Anchored popover. Does NOT render a blocking scrim so the stage stays
 * fully interactive. Dismisses on Esc or a click outside the popover.
 *
 * The caller positions it via the `style` prop (top/left/right/bottom
 * computed from the trigger's bounding rect relative to the cockpit root).
 */
export function Popover({
  style,
  anchor = 'left',
  onClose,
  children,
  'data-testid': testId,
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Esc to dismiss
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Click outside to dismiss
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    // Use capture so we catch clicks before they're handled by content
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [onClose]);

  // Focus first focusable element on open
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  return (
    <div
      ref={popoverRef}
      className={`cockpit-popover anchor-${anchor}`}
      style={style}
      data-testid={testId ?? 'cockpit-popover'}
    >
      {children}
    </div>
  );
}
