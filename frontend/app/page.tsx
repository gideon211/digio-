import Link from 'next/link';
import { CarArt, carKindFor } from '@/components/car-art';
import { EnquiryForm } from '@/components/enquiry-form';
import { HomeRequest } from '@/components/home-request';
import { TrustStrip } from '@/components/trust-strip';
import { api, formatGhs, type Catalog } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SERVICES = [
  {
    title: 'Airport transfers',
    body: 'Flight-tracked pickups at Kotoka, name board, luggage handled. One fixed price.',
    href: '/book',
    cta: 'Book a transfer',
    icon: (
      <path d="M2 13.5 21 4l-4.5 9.5L13 15l-2.5 4.5L8 16l-6-2.5Z" strokeLinejoin="round" />
    ),
  },
  {
    title: 'Chauffeur hire',
    body: 'Full-day and multi-day hire with a vetted chauffeur and a late-model car.',
    href: '/rent',
    cta: 'Hire with a chauffeur',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M4.2 16.5l5.2-3M19.8 16.5l-5.2-3" />
      </>
    ),
  },
  {
    title: 'Self-drive rentals',
    body: 'Daily rates, delivery to your hotel, insurance and deposit handled online.',
    href: '/rent',
    cta: 'See day rates',
    icon: (
      <>
        <circle cx="8" cy="8" r="4.5" />
        <path d="M11.2 11.2 20 20M17 17l-2.5 2.5M20 20l-2 2" />
      </>
    ),
  },
] as const;

const STEPS = [
  {
    title: 'Tell us the trip',
    body: 'Area, time, passengers. The price comes back fixed — tolls included.',
  },
  {
    title: 'Confirm with 30%',
    body: 'The deposit holds the car. The balance is settled at handover.',
  },
  {
    title: 'We message you',
    body: 'WhatsApp and SMS confirmation with your reference, the moment it clears.',
  },
] as const;

const FAQ = [
  {
    q: 'Is the price really fixed?',
    a: 'Yes. Tolls are included and there is no surge. Waiting is free for 60 minutes on flights and 10 minutes in town, so a delayed plane does not change the fare.',
  },
  {
    q: 'How do I pay?',
    a: 'A 30% deposit confirms the booking by mobile money or card. The balance is settled with the driver at handover. Nothing is charged until you approve the prompt.',
  },
  {
    q: 'Can I cancel?',
    a: 'Open your booking page and cancel while it is still awaiting the deposit or has only the deposit paid. Your reference is in the WhatsApp and SMS confirmation.',
  },
  {
    q: 'What do I need to collect a rental car?',
    a: 'A valid licence and a driver aged 25 or over. A refundable security hold is taken when you collect the car and released when it comes back clean — it is never part of the price.',
  },
  {
    q: 'Which areas do you cover?',
    a: 'Greater Accra, from Kotoka through Airport City, Cantonments, Labone, Osu, Labadi, Dzorwulu, East Legon, Ridge and Spintex out to Tema. Anything within about 40 km is inside the service area.',
  },
  {
    q: 'What about corporate accounts, weddings or jets?',
    a: 'Those are quoted by a person rather than a calculator. Send an enquiry below and the team will call you back.',
  },
] as const;

export default async function HomePage() {
  const [catalog, fares] = await Promise.all([
    api.catalog().catch(() => null),
    api.fares().catch(() => null),
  ]);

  const fareClasses = fares?.routes[0]?.prices ?? [];

  return (
    <main className="app-shell pt-6 pb-4 md:pt-10">
      {/* ── Hero: dark band, headline left, request form right ── */}
      <section className="band-dark on-dark grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:p-12">
        <div>
          <p className="eyebrow text-gold">Accra · Ghana</p>
          <h1 className="mt-3 font-display text-display-xl text-hero-ink md:text-display-2xl">
            Arrive well. Every ride.
          </h1>
          <p className="mt-4 max-w-md text-body-lg text-hero-ink/80">
            Late-model cars, vetted chauffeurs, one fixed price. No surge.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {['Cold AC', 'Bottled water', 'Chargers', 'Flight tracking'].map((perk) => (
              <li key={perk} className="chip chip-on-dark">
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <HomeRequest zones={catalog?.zones ?? []} />
      </section>

      <TrustStrip />

      {/* ── Services ── */}
      <section className="section">
        <p className="eyebrow">What we drive</p>
        <h2 className="mt-2 font-display text-display-md text-ink md:text-display-lg">
          Three ways to travel
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SERVICES.map((service) => (
            <Link
              key={service.title}
              href={service.href}
              className="card group flex flex-col transition-colors hover:border-line-strong"
            >
              <span className="grid h-11 w-11 place-items-center rounded-pill bg-sunken text-forest">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  aria-hidden
                >
                  {service.icon}
                </svg>
              </span>
              <h3 className="mt-4 font-display text-display-sm text-ink">{service.title}</h3>
              <p className="mt-2 flex-1 text-body-sm text-muted">{service.body}</p>
              <span className="mt-4 text-body-sm font-medium text-forest">
                {service.cta}
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Fares: the published price list ── */}
      <section className="section">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">From {fares?.from ?? 'Kotoka'}</p>
            <h2 className="mt-2 font-display text-display-md text-ink md:text-display-lg">
              What it costs
            </h2>
          </div>
          <p className="max-w-md text-body-sm text-muted">
            One way, tolls included, quoted the same way your booking will quote it.
          </p>
        </div>

        {fares && fareClasses.length > 0 ? (
          <div className="card mt-6 overflow-x-auto p-0">
            <table className="w-full min-w-[520px] border-collapse text-body-sm">
              <caption className="sr-only">
                Fares from {fares.from} to each area, by vehicle class
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-3 text-left font-medium text-muted">
                    Destination
                  </th>
                  {fareClasses.map((price) => (
                    <th
                      key={price.classSlug}
                      scope="col"
                      className="px-5 py-3 text-right font-medium text-muted"
                    >
                      {price.className}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fares.routes.map((route) => (
                  <tr key={route.zoneSlug} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink">
                      {route.zone}
                    </th>
                    {route.prices.map((price) => (
                      <td key={price.classSlug} className="tabular px-5 py-3.5 text-right text-ink">
                        {formatGhs(price.pricePesewas)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card mt-6 text-body-sm text-muted">
            The price list could not be loaded. Is the API running on port 4000?
          </p>
        )}

        <p className="mt-3 text-caption text-muted">
          City-to-city trips are priced the same way. Promo codes and member discounts come off
          these numbers at checkout.
        </p>
      </section>

      {/* ── Fleet ── */}
      <section className="section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The fleet</p>
            <h2 className="mt-2 font-display text-display-md text-ink md:text-display-lg">
              Late-model, inspected weekly
            </h2>
          </div>
          <Link href="/rent" className="btn btn-secondary btn-sm w-auto">
            Hire a car
          </Link>
        </div>

        {catalog ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {catalog.vehicleClasses.map((vehicleClass) => (
              <article key={vehicleClass.slug} className="card">
                <div className="flex items-start justify-between gap-4">
                  <CarArt
                    kind={carKindFor(vehicleClass.slug)}
                    className="h-[46px] w-24 text-forest"
                  />
                  <span className="chip">
                    {vehicleClass.availableVehicles > 0
                      ? `${vehicleClass.availableVehicles} free today`
                      : 'On request'}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-display-sm text-ink">
                  {vehicleClass.name}
                </h3>
                <p className="mt-1 text-body-sm text-muted">{vehicleClass.description}</p>

                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-body-sm">
                  <div>
                    <dt className="text-caption text-muted">Seats</dt>
                    <dd className="font-semibold text-ink">{vehicleClass.seats}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Bags</dt>
                    <dd className="font-semibold text-ink">{vehicleClass.bags}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Self-drive from</dt>
                    <dd className="tabular font-semibold text-ink">
                      {vehicleClass.dailyRateFromPesewas > 0
                        ? `${formatGhs(vehicleClass.dailyRateFromPesewas)}/day`
                        : 'On request'}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="card mt-6 text-body-sm text-muted">
            The fleet could not be loaded. Is the API running on port 4000?
          </p>
        )}
      </section>

      {/* ── How it works ── */}
      <section className="section">
        <div className="card">
          <h2 className="font-display text-display-md text-ink">How it works</h2>
          <ol className="mt-5 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 md:block">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-forest text-body-sm font-semibold text-hero-ink md:mb-3">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-body-md font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-body-sm text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Enquiries: the work a calculator cannot do ── */}
      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <div className="lg:pt-4">
            <p className="eyebrow">Bigger than a booking</p>
            <h2 className="mt-2 font-display text-display-md text-ink md:text-display-lg">
              Corporate accounts, weddings, jets and yachts
            </h2>
            <p className="mt-4 max-w-lg text-body-md text-muted">
              Anything with a schedule, a guest list or a manifest is quoted by a person. Tell us
              the shape of it and we will call you back with numbers.
            </p>

            <ul className="mt-6 grid gap-3">
              {[
                {
                  title: 'Corporate accounts',
                  body: 'Monthly invoicing, named drivers, one point of contact for the whole company.',
                },
                {
                  title: 'Weddings and events',
                  body: 'A matched fleet for the day, timed to the ceremony rather than to traffic.',
                },
                {
                  title: 'Long-term hire',
                  body: 'Weeks or months with a single car and chauffeur, serviced on our schedule.',
                },
                {
                  title: 'Private jets and yachts',
                  body: 'Terminal-side pickup and marina transfer, coordinated with your handler.',
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <div>
                    <h3 className="text-body-md font-semibold text-ink">{item.title}</h3>
                    <p className="mt-0.5 text-body-sm text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <EnquiryForm />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section">
        <h2 className="font-display text-display-md text-ink md:text-display-lg">
          Questions people ask
        </h2>

        <div className="mt-5 border-t border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-body-md font-medium text-ink">
                {item.q}
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-sunken text-body-md text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 pr-10 text-body-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Rentals: the polarity flip that closes the page ── */}
      <section className="section">
        <div className="band-dark on-dark grid gap-6 p-6 sm:p-8 md:grid-cols-[1.2fr_0.8fr] md:items-center lg:p-10">
          <div>
            <p className="eyebrow text-gold">By the day</p>
            <h2 className="mt-3 font-display text-display-md text-hero-ink md:text-display-lg">
              Take the car yourself
            </h2>
            <p className="mt-3 max-w-lg text-body-md text-hero-ink/80">
              Self-drive or with a chauffeur. Delivered anywhere in Accra for a flat GH₵60, with a
              refundable hold released when the car comes back clean.
            </p>
          </div>
          <Link href="/rent" className="btn btn-on-dark md:w-auto md:justify-self-end md:min-w-56">
            See day rates
          </Link>
        </div>
      </section>
    </main>
  );
}
