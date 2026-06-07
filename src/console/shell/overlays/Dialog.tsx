import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  icon?: React.ReactNode;
  /** Called when the dialog should close (scrim click or Esc). */
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Adds danger styling to the header. */
  danger?: boolean;
  'data-testid'?: string;
}

/**
 * Centred blocking dialog with scrim.
 *
 * Dismisses on Esc or scrim click. Traps focus inside while open.
 * Portals into the nearest `.cockpit` ancestor (position:absolute parent).
 */
export function Dialog({
  title,
  icon,
  onClose,
  footer,
  children,
  danger,
  'data-testid': testId,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  // Focus the dialog on open
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    // Focus the first focusable element, or the container itself
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable) {
      focusable.focus();
    } else {
      el.focus();
    }
  }, []);

  // Trap focus inside dialog
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    function handleKey(e: KeyboardEvent) {
      if (!node || e.key !== 'Tab') return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    node.addEventListener('keydown', handleKey);
    return () => node.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      {/* Scrim — click to close */}
      <div
        className="cockpit-scrim"
        onClick={onClose}
        data-testid="cockpit-scrim"
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cockpit-dialog-title"
        tabIndex={-1}
        className={`cockpit-dialog${danger ? ' danger' : ''}`}
        data-testid={testId ?? 'cockpit-dialog'}
      >
        <div className={`cockpit-dialog-head${danger ? ' danger' : ''}`}>
          {icon}
          <h3 id="cockpit-dialog-title">{title}</h3>
          <button
            type="button"
            className="x"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="cockpit-dialog-body">{children}</div>
        {footer !== undefined && (
          <div className="cockpit-dialog-foot">{footer}</div>
        )}
      </div>
    </>
  );
}
