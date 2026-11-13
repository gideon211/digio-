import Link from 'next/link';

/**
 * The tracking preview.
 *
 * The backend streams real positions over SSE the moment a driver is assigned;
 * a marketing page has no trip to stream, so this is the view itself, drawn
 * from the shape the stream actually returns — phase chip, driver, plate, ETA.
 * It is labelled as a preview rather than passed off as someone's live ride.
 *
 * The drawing sits inside a 72-unit margin on each side: the card is narrower
 * than the viewBox and `slice` crops horizontally, which would otherwise cut
 * both pins in half.
 */

const ROUTE =
  'M110 306C190 300 232 262 258 222C286 182 330 160 392 150C454 140 496 112 520 74';

const STREETS = [
  'M0 84H640',
  'M0 178H214L268 232H640',
  'M0 262H176L232 316H640',
  'M96 0V340',
  'M330 0V104L386 160V340',
  'M540 0V340',
] as const;

export function TrackingBand() {
  return (
    <section className="band band-night on-dark" id="tracking">
      <div className="app-shell">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14">
          <div>
            <p className="eyebrow text-gold-bright">Live tracking</p>
            <h2 className="mt-3 font-display text-display-2xl text-hero-ink">Watch it arrive.</h2>
            <p className="lead mt-4 max-w-lg">
              From the moment your chauffeur is assigned, the car moves on your screen. Position every
              two seconds, an ETA that counts down, and the plate before it pulls up.
            </p>

            <ul className="mt-7 grid gap-3.5 border-t border-white/15 pt-6">
              {[
                'See the car move from assignment to drop-off.',
                'Driver name, rating and plate before it reaches you.',
                'Three phases that change by distance: to pick-up, arrived, on trip.',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-body-sm text-hero-ink/80">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Link href="/book" className="btn btn-on-dark mt-7 sm:w-auto sm:min-w-56">
              Book a ride
            </Link>
          </div>

          {/* ── The view itself ── */}
          <figure className="map-card">
            <div className="relative aspect-[16/11] w-full">
              <svg
                viewBox="0 0 640 340"
                preserveAspectRatio="xMidYMid slice"
                className="absolute inset-0 h-full w-full"
                fill="none"
                aria-hidden
              >
                <defs>
                  <linearGradient id="track-route" x1="110" y1="306" x2="520" y2="74" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#b8841f" stopOpacity="0.15" />
                    <stop offset="0.55" stopColor="#e0ad4c" />
                    <stop offset="1" stopColor="#f6d79b" stopOpacity="0.5" />
                  </linearGradient>
                  <filter id="track-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="9" />
                  </filter>
                </defs>

                <g stroke="#f4f1e4" strokeOpacity="0.07" strokeWidth="1.5">
                  {STREETS.map((path) => (
                    <path key={path} d={path} />
                  ))}
                </g>

                <path
                  d={ROUTE}
                  stroke="#b8841f"
                  strokeOpacity="0.45"
                  strokeWidth="9"
                  strokeLinecap="round"
                  filter="url(#track-glow)"
                />
                <path
                  d={ROUTE}
                  stroke="url(#track-route)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                <circle cx="110" cy="306" r="18" fill="#f4f1e4" fillOpacity="0.08" />
                <circle cx="110" cy="306" r="7" fill="none" stroke="#f6d79b" strokeWidth="3" />
                <circle cx="520" cy="74" r="18" fill="#b8841f" fillOpacity="0.16" />
                <circle cx="520" cy="74" r="7" fill="#f0c169" />

                {/* The car, roughly two thirds along the route. */}
                <circle cx="392" cy="150" r="26" fill="#b8841f" fillOpacity="0.2" />
                <circle cx="392" cy="150" r="11" fill="#f0c169" />
                <circle cx="392" cy="150" r="4" fill="#0a1310" />
              </svg>

              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-pill border border-white/15 bg-night/85 px-3 py-1.5 text-caption text-hero-ink backdrop-blur-sm sm:left-4 sm:top-4">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                To pick-up · 4 min
              </div>

              <span className="absolute right-3 top-3 rounded-pill border border-white/15 bg-night/85 px-3 py-1.5 text-caption text-hero-ink/70 backdrop-blur-sm sm:right-4 sm:top-4">
                In-app view
              </span>
            </div>

            <figcaption className="flex items-center gap-3 border-t border-white/12 px-4 py-4">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-gold text-caption font-bold text-gold-ink"
              >
                MC
              </span>
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-hero-ink">Marcus Cole</p>
                <p className="truncate text-caption text-hero-ink/65">
                  4.91 · Toyota Prado · to the airport
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded-md border border-white/25 px-2 py-1 text-caption font-semibold tracking-[0.06em] text-hero-ink tabular">
                DG 2481
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
