/**
 * Line-art cars. One stroke weight, one colour, no fills — the fleet is drawn
 * the same way everywhere so the three classes read as one family.
 */
const PATHS = {
  sedan:
    'M3 24h58M8 24l5-9q1-2 4-2h22q3 0 5 2l9 7v2M19 13l-4 9M34 13v9',
  suv: 'M3 24h58M7 24l3-10q1-3 4-3h26q3 0 5 3l8 10M22 11v11M38 11v11',
  van: 'M3 24h58M6 24V12q0-2 2-2h34q3 0 6 5l6 6v3M22 10v13M36 10v13',
} as const;

export type CarKind = keyof typeof PATHS;

export function carKindFor(classSlug: string): CarKind {
  if (classSlug === 'suv') return 'suv';
  if (classSlug === 'van') return 'van';
  return 'sedan';
}

/**
 * Bookings store the car's description, not its class, so the drawing is
 * inferred from the model name. Anything unrecognised reads as a sedan — the
 * safest silhouette rather than a wrong one.
 */
export function carKindForLabel(label: string): CarKind {
  const text = label.toLowerCase();
  if (text.includes('prado') || text.includes('suv') || text.includes('land cruiser')) return 'suv';
  if (text.includes('hiace') || text.includes('van') || text.includes('maxis')) return 'van';
  return 'sedan';
}

export function CarArt({
  kind,
  className = 'h-[34px] w-16',
}: {
  kind: CarKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 34"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[kind]} />
      <circle cx="17" cy="27" r="4" />
      <circle cx="49" cy="27" r="4" />
    </svg>
  );
}
