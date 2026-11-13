'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { carKindFor, CarProfile } from './car-art';
import { type VehicleClass, formatGhs } from '@/lib/api';

/** What each class is actually for — one line, because that is all anyone reads. */
const BEST_FOR: Record<string, string> = {
  sedan: 'Airport runs, meetings and city evenings.',
  suv: 'Families, heavy luggage and long distances.',
  van: 'Groups, event transfers and up to seven bags.',
};

/**
 * The image optimizer caches by URL and the browser caches the optimized
 * response, so replacing bytes at the same path keeps serving the old car.
 * Photographs are therefore named by subject: replace one and give it a new
 * name (e.g. `executive-sedan-2.jpg`) rather than overwriting it.
 */
const PHOTO: Record<string, string> = {
  sedan: 'executive-sedan.jpg',
  suv: 'premium-suv.jpg',
  van: 'executive-van.jpg',
};

const short = (name: string) => name.replace('Executive ', '').replace('Premium ', '');

/**
 * The fleet band: one car at a time behind a tab, with both prices shown.
 *
 * A self-drive customer and a chauffeur customer read the same card, so the
 * card must not quote one of them a number that belongs to the other. Capacity
 * is passengers only — the engine rejects anything above it — so it is labelled
 * as such rather than left to be read as a total.
 */
export function FleetBand({ classes }: { classes: VehicleClass[] }) {
  const [slug, setSlug] = useState(classes[0]?.slug ?? '');
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const current = classes.find((entry) => entry.slug === slug) ?? classes[0];

  if (!current) return null;

  const kind = carKindFor(current.slug);

  return (
    <section className="band band-full on-dark" id="fleet">
      <div className="app-shell">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          {/* ── The stage ── */}
          <figure className="stage m-0">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[12px] border border-white/10 bg-forest-deep">
              {failed[current.slug] ? (
                <CarProfile kind={kind} className="absolute inset-0 h-full w-full p-5" />
              ) : (
                <Image
                  src={`/fleet/${PHOTO[current.slug] ?? `${current.slug}.jpg`}`}
                  alt=""
                  fill
                  /*
                   * The stage is a fixed ~567px column once the shell caps at
                   * 1200px. Saying `44vw` there made a wide monitor ask for a
                   * 3840px variant that the 2400px source cannot fill, which
                   * upscales and softens. Declare the real width instead.
                   * Quality is left at the default: Next rejects anything that
                   * is not in `images.qualities`, and 85 returns a 400.
                   */
                  sizes="(min-width: 1200px) 570px, (min-width: 1024px) 48vw, 100vw"
                  className="fleet-photo object-cover"
                  onError={() => setFailed((prev) => ({ ...prev, [current.slug]: true }))}
                />
              )}

              {/* Scrim so the chip has something to sit on, whatever the sky did. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-night/75 via-night/10 to-transparent"
              />
              <span className="absolute left-3 top-3 rounded-pill border border-white/20 bg-night/70 px-3 py-1.5 text-caption text-hero-ink backdrop-blur-sm">
                {current.availableVehicles} in the fleet
              </span>
            </div>

            <figcaption className="mt-4 border-t border-white/15 pt-4">
              <p className="font-display text-display-sm text-hero-ink">{current.name}</p>
              <p className="mt-0.5 text-caption text-hero-ink/70">{current.description}</p>
            </figcaption>
          </figure>

          {/* ── The spec ── */}
          <div>
            <p className="eyebrow text-gold-bright">The fleet</p>
            <h2 className="mt-3 font-display text-display-2xl text-hero-ink">
              Late-model, inspected weekly.
            </h2>
            <p className="lead mt-4 max-w-xl">
              {BEST_FOR[current.slug] ?? current.description} Every car is on a service plan, checked
              before it goes out, and yours for as long as you need it — with a chauffeur, or with the
              keys in your hand.
            </p>

            <div className="tab-row mt-6" role="group" aria-label="Vehicle class">
              {classes.map((entry) => (
                <button
                  key={entry.slug}
                  type="button"
                  className="tab"
                  aria-pressed={entry.slug === current.slug}
                  onClick={() => setSlug(entry.slug)}
                >
                  {short(entry.name)}
                </button>
              ))}
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-5">
              {[
                { label: 'Passengers', value: String(current.seats) },
                { label: 'Bags', value: String(current.bags) },
                {
                  label: 'Self-drive hold',
                  value: current.securityDepositPesewas > 0 ? formatGhs(current.securityDepositPesewas) : '—',
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-caption text-hero-ink/65">{item.label}</dt>
                  <dd className="tabular mt-1 font-display text-body-lg font-semibold text-hero-ink">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 grid gap-4 rounded-[14px] border border-white/15 bg-white/[0.06] p-4 sm:grid-cols-2">
              <div>
                <span className="text-caption text-hero-ink/70">Self-drive, per day</span>
                <span className="tabular mt-1 block font-display text-display-md text-hero-ink">
                  {current.dailyRateFromPesewas > 0
                    ? formatGhs(current.dailyRateFromPesewas)
                    : 'On request'}
                </span>
                <span className="mt-0.5 block text-caption text-hero-ink/60">
                  cheapest car in this class
                </span>
              </div>
              <div className="border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                <span className="text-caption text-hero-ink/70">With chauffeur, per day</span>
                <span className="tabular mt-1 block font-display text-display-md text-hero-ink">
                  {current.chauffeurDayRatePesewas > 0
                    ? formatGhs(current.chauffeurDayRatePesewas)
                    : 'On request'}
                </span>
                <span className="mt-0.5 block text-caption text-hero-ink/60">
                  one rate, vetted driver
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/rent" className="btn btn-on-dark sm:w-auto sm:min-w-56">
                See day rates
              </Link>
              <Link
                href="/book"
                className="text-body-sm font-medium text-hero-ink/80 underline-offset-4 hover:text-hero-ink hover:underline"
              >
                Or book a chauffeured transfer →
              </Link>
            </div>

            <p className="mt-4 text-caption text-hero-ink/60">
              Capacity counts passengers only — your chauffeur sits outside that number. Day rates
              shown are for Accra.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
