/**
 * Car drawings.
 *
 * Two registers on purpose: `CarArt` is a single-weight line drawing for dense
 * rows where an illustration must not compete with a price, and `CarProfile` is
 * the filled side-profile the fleet band stages. Both are drawn from the same
 * three silhouettes so a Camry and a Hiace always read as one family.
 */
const PATHS = {
  sedan: 'M3 24h58M8 24l5-9q1-2 4-2h22q3 0 5 2l9 7v2M19 13l-4 9M34 13v9',
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

/* ── Filled side-profiles ────────────────────────────────────────────
 * Geometry is data, not three copies of the same markup: a body rectangle, a
 * cabin, a glass inset split by pillars, and wheel positions. Every car sits
 * on the same ground line (y=170) so the three line up when they swap.
 */
interface Spec {
  body: { x: number; y: number; w: number; h: number; rx: number };
  cabin: string;
  glass: string;
  pillars: { x: number; y: number; w: number; h: number }[];
  wheels: number[];
  wheelR: number;
  wheelCy: number;
  shadow: number;
  detail?: { x: number; y: number; w: number; h: number; rx: number };
}

const BODY = '#f4f1e4';
const GLASS = '#0e2a22';

const SPECS: Record<CarKind, Spec> = {
  sedan: {
    body: { x: 26, y: 94, w: 308, h: 48, rx: 18 },
    cabin: 'M78 96C92 68 110 56 136 54H236C262 56 278 70 292 96Z',
    glass: 'M92 92C104 72 116 63 138 61H234C254 63 264 74 276 92Z',
    pillars: [{ x: 178, y: 61, w: 9, h: 31 }],
    wheels: [104, 258],
    wheelR: 25,
    wheelCy: 145,
    shadow: 148,
  },
  suv: {
    body: { x: 26, y: 86, w: 308, h: 58, rx: 16 },
    cabin: 'M62 88V62a14 14 0 0 1 14-14h214a14 14 0 0 1 14 14v26Z',
    glass: 'M76 82V64a10 10 0 0 1 10-10h186a10 10 0 0 1 10 10v18Z',
    pillars: [{ x: 170, y: 54, w: 9, h: 28 }],
    wheels: [104, 256],
    wheelR: 27,
    wheelCy: 143,
    shadow: 152,
    // Roof rails — the one thing that makes an SUV read as an SUV.
    detail: { x: 96, y: 42, w: 150, h: 5, rx: 2.5 },
  },
  van: {
    body: { x: 22, y: 84, w: 316, h: 62, rx: 14 },
    cabin: 'M46 86V56a16 16 0 0 1 16-16h244a16 16 0 0 1 16 16v30Z',
    glass: 'M62 80V60a12 12 0 0 1 12-12h224a12 12 0 0 1 12 12v20Z',
    pillars: [
      { x: 140, y: 48, w: 9, h: 32 },
      { x: 226, y: 48, w: 9, h: 32 },
    ],
    wheels: [96, 268],
    wheelR: 26,
    wheelCy: 144,
    shadow: 150,
  },
};

/**
 * The staged car: cream body, forest glass, a gold pinstripe and gold hubs,
 * lit from above on a warm pool of light. It has no stroke — the silhouette is
 * the shape, and a stroke at this size turns an illustration into a diagram.
 */
export function CarProfile({ kind, className = '' }: { kind: CarKind; className?: string }) {
  const spec = SPECS[kind];
  const { body } = spec;
  const stripeY = body.y + body.h - 14;

  return (
    <svg
      viewBox="0 0 360 192"
      className={`w-full ${className}`}
      fill="none"
      role="img"
      aria-label={`${kind === 'sedan' ? 'Executive sedan' : kind === 'suv' ? 'Premium SUV' : 'Executive van'} side profile`}
    >
      <ellipse cx="180" cy="174" rx={spec.shadow} ry="7" fill="#000000" opacity="0.35" />

      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx} fill={BODY} />
      <path d={spec.cabin} fill={BODY} />
      <path d={spec.glass} fill={GLASS} />
      {spec.pillars.map((pillar) => (
        <rect key={pillar.x} {...pillar} fill={BODY} />
      ))}
      {spec.detail ? <rect {...spec.detail} fill="#e3ddca" /> : null}

      <rect
        x={body.x + 8}
        y={stripeY}
        width={body.w - 16}
        height="4"
        rx="2"
        fill="#b8841f"
        opacity="0.85"
      />

      {/* Wheel wells: a dark arch cut into the body, then the wheel on top. */}
      {spec.wheels.map((cx) => (
        <path
          key={`well-${cx}`}
          d={`M${cx - spec.wheelR - 4} ${body.y + body.h}A${spec.wheelR + 4} ${spec.wheelR + 4} 0 0 1 ${cx + spec.wheelR + 4} ${body.y + body.h}Z`}
          fill="#0a1310"
        />
      ))}

      {spec.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={spec.wheelCy} r={spec.wheelR} fill="#0d1714" />
          <circle cx={cx} cy={spec.wheelCy} r={spec.wheelR * 0.45} fill="#e3ddca" />
          <circle cx={cx} cy={spec.wheelCy} r={spec.wheelR * 0.18} fill="#b8841f" />
        </g>
      ))}

      <rect
        x={body.x + body.w - 24}
        y={body.y + body.h * 0.34}
        width="17"
        height="9"
        rx="4.5"
        fill="#f0c169"
      />
      <rect
        x={body.x + 7}
        y={body.y + body.h * 0.34}
        width="15"
        height="9"
        rx="4.5"
        fill="#8a6414"
      />
    </svg>
  );
}
