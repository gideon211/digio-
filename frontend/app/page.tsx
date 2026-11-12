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

const PERKS = ['Cold AC', 'Bottled water', 'Chargers', 'Flight tracking'] as const;

const STEPS = [
  {
    title: 'Tell us the trip',
    body: 'Area, time and passengers. The price comes back fixed — tolls included, no meter, no surge.',
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

const ENQUIRIES = [
  {
    title: 'Corporate accounts',
    body: 'Monthly invoicing, named drivers and one point of contact for the whole company.',
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
    a: 'Those are quoted by a person rather than a calculator. Send an enquiry and the team will call you back.',
  },
] as const;

/**
 * The homepage sells one thing in five acts: here is the price, here is the
 * car, here is how it works, here is where you watch it happen, and here is
 * what to do when a calculator cannot answer you.
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
        <RouteArt uid="hero" />

        <div className="app-shell relative grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-24">
          <div>
            <p className="eyebrow text-gold-bright">Accra · Ghana</p>

            <h1 className="mt-4 font-display text-display-3xl tracking-[-0.03em] text-hero-ink">
              Arrive well.{' '}
              <span className="text-gold-bright">Every ride.</span>
            </h1>

            <p className="lead mt-5 max-w-xl">
              Late-model cars, vetted chauffeurs and one fixed price — no surge, ever. Book an airport
              run, hire a chauffeur for the day, or take the keys for the week.
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

      {/* ── Coverage ─────────────────────────────────────────── */}
      <section
        className="border-b border-white/10 bg-forest-deep on-dark"
        aria-label="Areas we cover"
      >
        <div className="app-shell flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-6">
          <span className="eyebrow shrink-0 text-gold-bright">Service area · 40 km</span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-hero-ink/70">
            {(catalog?.zones ?? []).map((zone) => (
              <li key={zone.slug}>{zone.name}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Proof ────────────────────────────────────────────── */}
      <ProofStrip />

      {/* ── Fares ────────────────────────────────────────────── */}
      <section className="app-shell section" id="fares">
        <div className="section-head">
          <div>
            <p className="eyebrow">Published prices</p>
            <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-ink">
              What it costs.
            </h2>
          </div>
          <p className="lead max-w-md lg:pb-1.5">
            Every route out of {fares?.from ?? 'Kotoka'}, in all three classes. Tap a destination to
            start a booking at that price.
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
              Corporate accounts, weddings, jets and yachts.
            </h2>
            <p className="lead mt-4 max-w-lg">
              Anything with a schedule, a guest list or a manifest is quoted by a person. Tell us the
              shape of it and we will call you back with numbers.
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
      <section className="band band-full on-dark relative overflow-hidden">
        <RouteArt uid="cta" className="opacity-80" />

        <div className="app-shell relative">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="eyebrow text-gold-bright">Ready when you are</p>
              <h2 className="mt-3 font-display text-display-2xl tracking-[-0.02em] text-hero-ink">
                Where are you headed?
              </h2>
              <p className="lead mt-4 max-w-xl">
                The price is fixed before you commit — 30% confirms it, and we will send every detail
                to your WhatsApp.
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
