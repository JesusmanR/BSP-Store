import type { ReactNode } from 'react';

export function Button({
  children,
  onClick,
  secondary = false,
  className = '',
  type = 'button',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${secondary ? 'btn-secondary' : 'btn-primary'} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
