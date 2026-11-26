import Image from 'next/image';

interface IconProps {
  name: 'star' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'chevron-up';
  className?: string;
  alt?: string;
}

/**
 * The stroked glyphs the design draws beside text.
 *
 * They are separate assets rather than inline SVG because the design renders
 * them at a fixed size inside a fixed box, and every one of them is a single
 * colour that inherits the surrounding text.
 */
const ICON: Record<IconProps['name'], { src: string; width: number; height: number }> = {
  star: { src: '/img/star.svg', width: 27, height: 26 },
  'chevron-left': { src: '/img/chevron-left.svg', width: 16, height: 14 },
  'chevron-right': { src: '/img/chevron-right.svg', width: 16, height: 14 },
  'chevron-down': { src: '/img/chevron-down.svg', width: 14, height: 8 },
  'chevron-up': { src: '/img/chevron-up.svg', width: 14, height: 8 },
};

export function Icon({ name, className, alt = '' }: IconProps) {
  const icon = ICON[name];

  return (
    <Image
      src={icon.src}
      alt={alt}
      width={icon.width}
      height={icon.height}
      className={className}
    />
  );
}
