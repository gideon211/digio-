import type { ReactNode } from 'react';

/**
 * One filled row: label above the value, no border, whole row is the target.
 * Used everywhere a request form asks for something.
 */
export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
