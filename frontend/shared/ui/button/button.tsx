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
    'border-2 border-white text-white bg-transparent px-8 gap-2 rounded-pill h-14 font-sans font-normal text-lg leading-7 hover:border-ink hover:bg-ink',
  tertiary:
    'border-2 border-white text-white bg-transparent px-8 gap-2 rounded-pill h-14 font-sans font-normal text-lg leading-7 hover:bg-white hover:text-ink',
};

/**
 * Colour transitions between the default and hover variants.
 *
 * Figma swaps the whole variant with a 0.56s smart animate, so the fill and
 * label cross into each other at that speed rather than snapping. Kept out of
 * the variant map because every button shape shares it.
 */
const BUTTON_MOTION =
  'transition-[background-color,border-color,color] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]';

/**
 * The arrow travel used by the white pill's hover state.
 */
const ARROW_SLIDE =
  'transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]';

/**
 * The dark disc and arrow that sit on the right of the primary button.
 *
 * On hover the settled arrow leaves through the right of the disc while the
 * incoming arrow enters from the left. Figma pairs the two arrows in the same
 * frame and lets the disc clip them, which is why nothing fades: a single
 * arrow moving right would simply vanish.
 */
function ArrowChip() {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-pill bg-ink">
      <Image
        src="/img/arrow-double.svg"
        alt=""
        width={18}
        height={16}
        className={`col-start-1 row-start-1 h-4 w-[18px] ${ARROW_SLIDE} group-hover:translate-x-8`}
      />
      <Image
        src="/img/arrow-double.svg"
        alt=""
        width={18}
        height={16}
        className={`col-start-1 row-start-1 h-4 w-[18px] -translate-x-8 ${ARROW_SLIDE} group-hover:translate-x-0`}
      />
    </span>
  );
}

export function Button({ children, variant = 'primary', href, className, onClick }: ButtonProps) {
  const base = VARIANT_CLASS[variant];
  const composed = `group inline-flex items-center active:scale-[0.98] ${BUTTON_MOTION} ${base} ${className ?? ''}`;

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
