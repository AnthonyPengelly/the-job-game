import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  title: string;
  icon?: React.ReactNode;
  side?: 'right' | 'left';
  wide?: boolean;
  /** Called when the drawer should close (scrim click or Esc). */
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
}

/**
 * Side drawer that slides from an edge.
 *
 * The scrim is soft so the stage stays visible behind it.
 * Dismisses on Esc or scrim click. The drawer itself is focusable on open.
 */
export function Drawer({
  title,
  icon,
  side = 'right',
  wide,
  onClose,
  footer,
  children,
  'data-testid': testId,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Focus drawer on open
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable) {
      focusable.focus();
    } else {
      el.focus();
    }
  }, []);

  return (
    <>
      {/* Soft scrim — stage stays visible */}
      <div
        className="cockpit-scrim soft"
        onClick={onClose}
        data-testid="cockpit-scrim"
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        role="complementary"
        aria-label={title}
        tabIndex={-1}
        className={[
          'cockpit-drawer',
          side,
          wide ? 'wide' : '',
        ].filter(Boolean).join(' ')}
        data-testid={testId ?? 'cockpit-drawer'}
      >
        <div className="cockpit-drawer-head">
          {icon}
          <h3>{title}</h3>
          <button
            type="button"
            className="x"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="cockpit-drawer-body">{children}</div>
        {footer !== undefined && (
          <div className="cockpit-drawer-foot">{footer}</div>
        )}
      </div>
    </>
  );
}
