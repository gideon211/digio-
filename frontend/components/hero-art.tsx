/**
 * The Digio route motif.
 *
 * A faint street grid, a handful of real road shapes, and one gold route that
 * runs from a pick-up to a drop-off. It is the brand's own illustration — a
 * transport company's natural ornament is its map — so the same drawing
 * returns on the closing call to action rather than a new decoration being
 * invented every section.
 *
 * Everything here is decorative and inert: no pointer events, no text, no
 * behaviour. The page must read exactly the same without it.
 */
const STREETS = [
  'M-20 140H360L470 250H980L1080 150H1460',
  'M-20 470H240L330 560H760L860 460H1460',
  'M-20 700H620L740 840',
  'M120 -20V300L240 420V860',
  'M540 -20V180L640 280V860',
  'M900 -20V860',
  'M1180 -20V260L1300 380V860',
  'M300 860L420 740V600',
] as const;

const ROUTE =
  'M60 772C262 764 334 656 302 546C274 450 404 402 528 372C650 342 706 250 668 118';

export function RouteArt({ uid = 'route', className = '' }: { uid?: string; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 select-none ${className}`} aria-hidden>
      <svg
        viewBox="0 0 1440 820"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        fill="none"
      >
        <defs>
          <pattern
            id={`${uid}-tiles`}
            width="96"
            height="96"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-4)"
          >
            <path
              d="M0 0H96M0 0V96"
              stroke="#f4f1e4"
              strokeOpacity="0.055"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient
            id={`${uid}-fade`}
            x1="60"
            y1="772"
            x2="668"
            y2="118"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#b8841f" stopOpacity="0" />
            <stop offset="0.4" stopColor="#e0ad4c" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f6d79b" stopOpacity="0.3" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <rect width="1440" height="820" fill={`url(#${uid}-tiles)`} />

        <g stroke="#f4f1e4" strokeOpacity="0.07" strokeWidth="1.5">
          {STREETS.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>

        <path
          d={ROUTE}
          stroke="#b8841f"
          strokeOpacity="0.3"
          strokeWidth="7"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
        />
        <path
          d={ROUTE}
          stroke={`url(#${uid}-fade)`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Pick-up: solid. Drop-off: hollow. Read at a glance, in either order. */}
        <circle cx="60" cy="772" r="17" fill="#b8841f" fillOpacity="0.16" />
        <circle cx="60" cy="772" r="6.5" fill="#f0c169" />
        <circle cx="668" cy="118" r="17" fill="#f4f1e4" fillOpacity="0.1" />
        <circle cx="668" cy="118" r="7" fill="none" stroke="#f0c169" strokeWidth="3" />
      </svg>
    </div>
  );
}
