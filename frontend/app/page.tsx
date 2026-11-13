import Link from 'next/link';
import { EnquiryForm } from '@/components/enquiry-form';
import { FareTable } from '@/components/fare-table';
import { FleetBand } from '@/components/fleet-band';
import { HomeRequest } from '@/components/home-request';
import { ProofStrip } from '@/components/proof-strip';
import { RouteArt } from '@/components/hero-art';
import { TrackingBand } from '@/components/tracking-band';
import { api, type Catalog, type FareList } from '@/lib/api';

export const dynamic = 'force-dynamic';

const PERKS = ['Fixed price', 'Vetted chauffeurs', 'Flight tracking', 'Around the clock'] as const;

/** The four things Digio does, everywhere it operates. */
const MODES = [
  { label: 'Airport transfers', href: '/book' },
  { label: 'Chauffeur hire', href: '/book' },
  { label: 'Self-drive rentals', href: '/rent' },
  { label: 'Corporate & events', href: '/#enquire' },
] as const;

const STEPS = [
  {
    title: 'Tell us the trip',
    body: 'Pick-up, destination, time and passengers. The price comes back fixed — tolls included, no meter, no surge.',
  },
  {
    title: 'Confirm with 30%',
    body: 'The deposit holds the car. The balance is settled with the driver at handover, not before.',
  },
  {
    title: 'We message you',
    body: 'WhatsApp and SMS with your reference and a link to manage the booking, the moment it clears.',
  },
] as const;

/**
 * The city list is deliberately short and truthful. A worldwide homepage that
 * invents supply is worse than one that says exactly where it is live — so
 * Accra is marked live, and everywhere else has a route to ask.
 */
const CITIES = [
  {
    status: 'Live now',
    live: true,
    name: 'Accra, Ghana',
    body: 'Airport transfers, chauffeur hire and self-drive within about 40 km of the city — priced, booked and tracked end to end.',
    action: { label: 'Book in Accra', href: '/book' },
  },
  {
    status: 'Opening',
    live: false,
    name: 'New cities',
    body: 'We open one city at a time, with local fleets held to the same inspection, insurance and pricing standard.',
    action: { label: 'Partner with us', href: '/#enquire' },
  },
  {
    status: 'Request',
    live: false,
    name: 'Your city',
    body: 'Tell us where you travel. Requests decide where Digio goes next, and we will tell you where it stands.',
    action: { label: 'Request a city', href: '/#enquire' },
  },
] as const;

const ENQUIRIES = [
  {
    title: 'Corporate accounts',
    body: 'Monthly invoicing, named drivers and one point of contact for the whole company — in every city we serve.',
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
  {
    title: 'New cities and partners',
    body: 'Fleet owners and operators who meet the standard: tell us the city and the cars you run.',
  },
] as const;

const FAQ = [
  {
    q: 'Is the price really fixed?',
    a: 'Yes. Tolls are included and there is no surge. Waiting is free for 60 minutes on flights and 10 minutes in town, so a delayed plane does not change the fare.',
  },
  {
    q: 'How do I pay?',
    a: 'A 30% deposit confirms the booking by card or mobile money, whichever your city supports. The balance is settled with the driver at handover. Nothing is charged until you approve the prompt.',
  },
  {
    q: 'Can I cancel?',
    a: 'Open your booking page and cancel while it is still awaiting the deposit or has only the deposit paid. Your reference is in the WhatsApp and SMS confirmation.',
  },
  {
    q: 'What do I need to collect a rental car?',
    a: 'A valid licence, an international driving permit where local law requires one, and a driver aged 25 or over. A refundable security hold is taken when you collect the car and released when it comes back clean — it is never part of the price.',
  },
  {
    q: 'Which cities do you cover?',
    a: 'Accra is live today, for airport and city transfers within about 40 km of the city. New cities open with local partner fleets that pass the same inspection and pricing standard. If you need Digio somewhere else, request the city and we will tell you where it stands.',
  },
  {
    q: 'Can I book before I land?',
    a: 'Yes. Book from anywhere before you fly. We track the flight, move the pick-up if it is delayed, and send the chauffeur’s name, rating and plate to your WhatsApp before you clear arrivals.',
  },
] as const;

/**
 * The homepage sells one thing in six acts: what we do, what it costs, which
 * car, where we drive, how it works, and what to do when a calculator cannot
 * answer you. The brand speaks to the world; the prices speak for the city that
 * is actually live.
 */
export default async function HomePage() {
  const [catalog, fares] = await Promise.all([
    api.catalog().catch(() => null),
    api.fares().catch(() => null),
  ]);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero-surface on-dark">
        {/*
         * On stacked layouts the hero is tall, so an artwork that scales with
         * the whole section drops its route pin straight into the headline.
         * Cap it to the top band there and fade it out; the desktop hero keeps
         * the full-height version.
         */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_58%,transparent)] sm:h-[420px] lg:h-full lg:[mask-image:none]">
          <RouteArt uid="hero" />
        </div>

        <div className="app-shell relative grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-24">
          <div>
            <p className="eyebrow text-gold-bright">Worldwide · Chauffeur &amp; self-drive</p>

            <h1 className="mt-4 font-display text-display-3xl tracking-[-0.03em] text-hero-ink">
              Arrive well.{' '}
              <span className="text-gold-bright">Anywhere.</span>
            </h1>

            <p className="lead mt-5 max-w-xl">
              Late-model cars, vetted chauffeurs and one fixed price — no surge, ever. Airport
              transfers, chauffeur hire and self-drive rentals, in every city we serve.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/book" className="btn btn-primary sm:w-auto sm:min-w-56">
                Book a ride
              </Link>
              <a
                href="#fares"
                className="text-body-sm font-medium text-hero-ink/85 underline-offset-4 transition-colors hover:text-hero-ink hover:underline sm:ml-2"
              >
                See what it costs →
              </a>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-caption text-hero-ink/75">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <HomeRequest zones={catalog?.zones ?? []} fares={fares} />
        </div>
      </section>

      {/* ── What we do ───────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-forest-deep on-dark" aria-label="What we do">
        <div className="app-shell flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:gap-8">
          <span className="eyebrow shrink-0 text-gold-bright">What we do</span>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-caption text-hero-ink/70">
            {MODES.map((mode) => (
              <li key={mode.label}>
                <Link
                  href={mode.href}
                  className="underline-offset-4 transition-colors hover:text-hero-ink hover:underline"
                >
                  {mode.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="#cities"
            className="shrink-0 text-caption font-medium text-gold-bright underline-offset-4 transition-colors hover:text-hero-ink hover:underline lg:ml-auto"
          >
            Now serving Accra · see where we drive →
          </Link>
        </div>
      </section>

      {/* ── Proof ────────────────────────────────────────────── */}
      <ProofStrip />

      {/* ── Fares ────────────────────────────────────────────── */}
      <section className="app-shell section" id="fares">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live fares · Accra</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              What it costs.
            </h2>
          </div>
          <p className="lead max-w-md lg:pb-1.5">
            Every route out of {fares?.from ?? 'Kotoka International Airport'}, in all three
            classes. The same engine prices your booking; new cities publish in their own currency
            when they open.
          </p>
        </div>

        <div className="mt-7">
          {fares ? (
            <FareTable fares={fares} />
          ) : (
            <p className="card text-body-sm text-muted">
              The price list could not be loaded. Start the API on port 4000 and reload.
            </p>
          )}
        </div>
      </section>

      {/* ── Fleet ────────────────────────────────────────────── */}
      <FleetBand classes={catalog?.vehicleClasses ?? []} />

      {/* ── Cities ───────────────────────────────────────────── */}
      <section className="app-shell section" id="cities">
        <div className="section-head">
          <div>
            <p className="eyebrow">Where we drive</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              Built for the world.
              <br />
              Live in Accra.
            </h2>
          </div>
          <p className="lead max-w-md lg:pb-1.5">
            One standard, not a franchise. Every city we open is run with local fleets we have
            inspected, insured and priced ourselves — so the promise travels even when the car does
            not.
          </p>
        </div>

        <ul className="mt-8 border-t border-line">
          {CITIES.map((city) => (
            <li
              key={city.name}
              className="grid gap-3 border-b border-line py-5 sm:grid-cols-[104px_1fr_auto] sm:items-start sm:gap-6"
            >
              <span className={`chip w-fit ${city.live ? 'chip-gold' : ''}`}>{city.status}</span>
              <div>
                <h3 className="text-body-md font-semibold text-ink">{city.name}</h3>
                <p className="mt-1 max-w-xl text-body-sm text-muted">{city.body}</p>
              </div>
              <Link
                href={city.action.href}
                className="text-body-sm font-medium text-forest underline-offset-4 hover:underline sm:justify-self-end sm:pt-0.5"
              >
                {city.action.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="app-shell section" id="how">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              Three steps, then we drive.
            </h2>
          </div>
          <p className="lead max-w-md lg:pb-1.5">
            No account to create, no card kept on file. The booking exists once the deposit clears.
          </p>
        </div>

        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-line pt-5">
              <span className="numeral">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 font-display text-display-sm text-ink">{step.title}</h3>
              <p className="mt-2 text-body-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Tracking ─────────────────────────────────────────── */}
      <TrackingBand />

      {/* ── Enquiries ────────────────────────────────────────── */}
      <section className="app-shell section" id="enquire">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div>
            <p className="eyebrow">Bigger than a booking</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              Corporate accounts, events and new cities.
            </h2>
            <p className="lead mt-4 max-w-lg">
              Anything with a schedule, a guest list or a market to open is quoted by a person. Tell
              us the shape of it and we will call you back with numbers.
            </p>

            <ul className="mt-8 border-t border-line">
              {ENQUIRIES.map((item) => (
                <li
                  key={item.title}
                  className="grid gap-1 border-b border-line py-4 sm:grid-cols-[0.75fr_1.25fr] sm:gap-6"
                >
                  <h3 className="text-body-md font-semibold text-ink">{item.title}</h3>
                  <p className="text-body-sm text-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <EnquiryForm />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="app-shell section" id="faq">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow">Before you book</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              Questions people ask.
            </h2>
            <p className="mt-4 text-body-sm text-muted">
              Still unsure? Send an enquiry and a person will call you back.
            </p>
            <Link href="/#enquire" className="mt-4 inline-block text-body-sm font-medium text-forest underline-offset-4 hover:underline">
              Send an enquiry →
            </Link>
          </div>

          <div className="border-t border-line">
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
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────── */}
      <section className="band band-full on-dark relative overflow-hidden pt-24 lg:pt-36">
        <RouteArt uid="cta" className="opacity-80" />

        <div className="app-shell relative">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="eyebrow text-gold-bright">Ready when you are</p>
              <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-hero-ink">
                Where are you headed?
              </h2>
              <p className="lead mt-4 max-w-xl">
                The price is fixed before you commit — 30% confirms it, and every detail lands on
                your WhatsApp.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link href="/book" className="btn btn-primary sm:w-auto sm:min-w-52">
                Book a ride
              </Link>
              <Link href="/rent" className="btn btn-on-dark sm:w-auto sm:min-w-52">
                Hire a car
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
