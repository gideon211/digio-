import Image from 'next/image';
import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  href?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * The three button shapes in the design.
 *
 * The primary button carries a trailing arrow chip: the label reads first and
 * the icon sits in a dark disc on a white pill, which is why it does not share
 * a base class with the outline variants.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-white text-ink pl-4 pr-2 gap-2 rounded-pill h-14 font-sans font-normal text-lg leading-7',
  secondary:
    'border-2 border-white text-white bg-transparent px-8 gap-2 rounded-pill h-14 font-sans font-normal text-lg leading-7',
  tertiary:
    'border-2 border-white text-white bg-transparent px-8 gap-2 rounded-pill h-14 font-sans font-normal text-lg leading-7',
};

/**
 * The dark disc and arrow that sit on the right of the primary button.
 *
 * The arrow artwork already points right, so it is drawn as authored.
 */
function ArrowChip() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-ink">
      <Image src="/img/arrow-double.svg" alt="" width={18} height={16} className="h-4 w-[18px]" />
    </span>
  );
}

export function Button({ children, variant = 'primary', href, className, onClick }: ButtonProps) {
  const base = VARIANT_CLASS[variant];
  const composed = `inline-flex items-center ${base} ${className ?? ''}`;

  if (href) {
    return (
      <a href={href} className={composed} onClick={onClick}>
        <span>{children}</span>
        {variant === 'primary' && <ArrowChip />}
      </a>
    );
  }

  return (
    <button type="button" className={composed} onClick={onClick}>
      <span>{children}</span>
      {variant === 'primary' && <ArrowChip />}
    </button>
  );
}
