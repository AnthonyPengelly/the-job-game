import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  kind?: ButtonKind;
  size?: 'lg';
  icon?: LucideIcon;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
}

export function Button({
  kind = 'primary',
  size,
  icon,
  children,
  disabled,
  onClick,
  type = 'button',
  className,
  'data-testid': testId,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
}: ButtonProps) {
  const cls = ['btn', `btn-${kind}`, size === 'lg' ? 'btn-lg' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={cls}
      disabled={disabled}
      onClick={onClick}
      type={type}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
    >
      {icon && <Icon icon={icon} size={19} />}
      {children}
    </button>
  );
}
