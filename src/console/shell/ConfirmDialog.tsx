import { AlertTriangle } from 'lucide-react';
import { Dialog } from './overlays';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  'data-testid'?: string;
}

/**
 * Generic destructive-action confirm dialog.
 * Shows a warning icon, a message, and Confirm / Cancel buttons.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
  'data-testid': testId,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Dialog
      title={title}
      icon={<AlertTriangle size={20} />}
      danger
      onClose={onClose}
      data-testid={testId ?? 'confirm-dialog'}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            data-testid="btn-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            data-testid="btn-confirm"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--fg-muted)',
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {message}
      </p>
    </Dialog>
  );
}
