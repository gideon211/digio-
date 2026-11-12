'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CarArt, carKindFor } from '@/components/car-art';
import { Field } from '@/components/field';
import { PlaceSearch, type SelectedPlace } from '@/components/place-search';
import { StepRibbon } from '@/components/step-ribbon';
import {
  api,
  ApiError,
  formatGhs,
  type Booking,
  type Catalog,
  type Quote,
  type RentalAvailability,
  type ZoneMatch,
} from '@/lib/api';

type Step = 'cars' | 'confirm' | 'done';
type Product = 'self_drive' | 'chauffeur_hire';

const RENT_STEPS = [
  { key: 'cars', label: 'Car' },
  { key: 'confirm', label: 'Confirm' },
] as const;

function shift(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayCount(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export default function RentPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState<Step>('cars');

  const [product, setProduct] = useState<Product>('self_drive');
  const [classSlug, setClassSlug] = useState('sedan');
  const [fromDate, setFromDate] = useState(shift(1));
  const [toDate, setToDate] = useState(shift(4));
  const [deliver, setDeliver] = useState(false);
  const [deliveryPlace, setDeliveryPlace] = useState<SelectedPlace | null>(null);
  const [deliveryZone, setDeliveryZone] = useState<ZoneMatch | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');

  const [availability, setAvailability] = useState<RentalAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = dayCount(fromDate, toDate);

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setError('Could not load the fleet. Is the API running on port 4000?'));
  }, []);

  useEffect(() => {
    if (days < 1) {
      setAvailability(null);
      setAvailabilityError('The return date has to be after the pick-up date.');
      return;
    }

    let active = true;
    setAvailabilityError(null);

    api
      .rentalClasses({ fromDate, toDate })
      .then((data) => {
        if (active) setAvailability(data);
      })
      .catch((cause) => {
        if (!active) return;
        setAvailability(null);
        setAvailabilityError(
          cause instanceof ApiError ? cause.message : 'Could not check availability',
        );
      });

    return () => {
      active = false;
    };
  }, [fromDate, toDate, days]);

  const selectedClass = useMemo(
    () => availability?.classes.find((entry) => entry.slug === classSlug),
    [availability, classSlug],
  );

  const dayRate =
    product === 'self_drive'
      ? (selectedClass?.dailyRateFromPesewas ?? 0)
      : (selectedClass?.chauffeurDayRatePesewas ?? 0);

  const soldOut = selectedClass ? selectedClass.availableVehicles === 0 : false;

  function describeProblem(): string | null {
    if (days < 1) return 'The return date has to be after the pick-up date.';
    if (days > 60) return 'Online bookings stop at 60 days — call us for longer hire.';
    if (!selectedClass) return 'Choose a car first';
    if (soldOut) return 'That class is fully booked for these dates';
    if (dayRate <= 0) return 'This class is not bookable online yet';
    if (deliver && !deliveryZone?.zone) return 'Tell us where to deliver it';
    if (deliver && deliveryZone && !deliveryZone.withinServiceArea) {
      return 'Delivery is only available inside greater Accra';
    }
    return null;
  }

  async function getQuote() {
    const problem = describeProblem();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.createRentalQuote({
        product,
        classSlug,
        fromDate,
        toDate,
        deliveryZoneSlug: deliver ? deliveryZone?.zone?.slug : undefined,
        extras,
        promoCode: promoCode || undefined,
      });
      setQuote(result);
      setStep('confirm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not price that rental');
      if (cause instanceof ApiError && cause.code === 'VEHICLE_UNAVAILABLE') setAvailability(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createBooking({ quoteToken: quote.token, customer: { name, phone } });
      setBooking(result);
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the booking');
      if (cause instanceof ApiError && cause.code === 'VEHICLE_UNAVAILABLE') {
        setQuote(null);
        setStep('cars');
      }
    } finally {
      setBusy(false);
    }
  }

  async function startPayment() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const payment = await api.initializePayment({ bookingRef: booking.ref });
      if (payment.authorizationUrl) {
        window.location.href = payment.authorizationUrl;
        return;
      }
      setError('Could not open the payment page. Please retry.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not start the payment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell pt-6 pb-4">
      <div className="stack">
        <StepRibbon steps={RENT_STEPS} activeKey={step} />

        {step === 'done' && booking ? (
          <div className="grid gap-4">
            <section className="band-dark on-dark p-6">
              <p className="eyebrow text-gold">Booked</p>
              <h1 className="mt-2 font-display text-display-md text-hero-ink">
                Your car is held for 15 minutes.
              </h1>
              <p className="mt-2 text-body-sm text-hero-ink/80">
                {booking.vehicle
                  ? `${booking.vehicle.description} · ${booking.vehicle.plate}`
                  : booking.pickup}
              </p>

              <dl className="mt-5 grid gap-2.5 border-t border-white/15 pt-4">
                <DarkRow label="Reference" value={booking.ref} />
                <DarkRow
                  label="Hire"
                  value={
                    booking.rental
                      ? `${booking.rental.days} days · ${booking.rental.fromDate} → ${booking.rental.toDate}`
                      : '—'
                  }
                />
                <DarkRow label="Total" value={formatGhs(booking.totalPesewas)} />
                <DarkRow label="Deposit due now" value={formatGhs(booking.depositDuePesewas)} />
              </dl>

              {booking.rental && booking.rental.securityDepositPesewas > 0 ? (
                <p className="mt-4 border-t border-white/15 pt-4 text-caption text-hero-ink/70">
                  A refundable {formatGhs(booking.rental.securityDepositPesewas)} hold is taken at
                  handover, not now.
                </p>
              ) : null}
            </section>

            {error ? <ErrorNote message={error} /> : null}

            <div className="grid gap-2">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void startPayment()}
                disabled={busy}
              >
                {busy ? 'Opening checkout…' : `Pay deposit ${formatGhs(booking.depositDuePesewas)}`}
              </button>
              <Link href={`/b/${booking.ref}`} className="btn btn-secondary">
                Manage this booking
              </Link>
            </div>
          </div>
        ) : step === 'confirm' && quote ? (
          <RentConfirmStep
            quote={quote}
            product={product}
            name={name}
            phone={phone}
            onName={setName}
            onPhone={setPhone}
            error={error}
            busy={busy}
            onBack={() => {
              setStep('cars');
              setError(null);
            }}
            onSubmit={() => void confirmBooking()}
          />
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void getQuote();
            }}
          >
            <section className="form-card">
              <p className="eyebrow">Hire a car</p>
              <h1 className="mt-2 font-display text-display-md text-ink">
                Take the keys for a few days
              </h1>

              <div className="seg mt-4 grid-cols-2" role="radiogroup" aria-label="Hire type">
                {(
                  [
                    { value: 'self_drive', label: 'Self-drive' },
                    { value: 'chauffeur_hire', label: 'With chauffeur' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={product === option.value}
                    onClick={() => {
                      setProduct(option.value);
                      setQuote(null);
                      setError(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Collect">
                  <input
                    className="field-control tabular"
                    type="date"
                    value={fromDate}
                    min={shift(0)}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setQuote(null);
                    }}
                  />
                </Field>
                <Field label="Return">
                  <input
                    className="field-control tabular"
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setQuote(null);
                    }}
                  />
                </Field>
              </div>

              <p className="mt-2 text-caption text-muted">
                {days > 0
                  ? `${days} day${days === 1 ? '' : 's'}, collected and returned at 09:00.`
                  : 'Pick a return date after the collect date.'}
              </p>
            </section>

            <section className="form-card">
              <h2 className="font-display text-display-sm text-ink">Choose your car</h2>

              <div className="mt-3 grid gap-3" role="radiogroup" aria-label="Vehicle class">
                {availability?.classes.map((vehicleClass) => {
                  const rate =
                    product === 'self_drive'
                      ? vehicleClass.dailyRateFromPesewas
                      : vehicleClass.chauffeurDayRatePesewas;
                  const full = vehicleClass.availableVehicles === 0;
                  return (
                    <button
                      key={vehicleClass.slug}
                      type="button"
                      role="radio"
                      aria-checked={classSlug === vehicleClass.slug}
                      disabled={full}
                      onClick={() => {
                        setClassSlug(vehicleClass.slug);
                        setQuote(null);
                      }}
                      className="option-row"
                    >
                      <CarArt
                        kind={carKindFor(vehicleClass.slug)}
                        className="h-[38px] w-20 text-forest"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-md font-semibold text-ink">
                          {vehicleClass.name}
                        </span>
                        <span className="block text-body-sm text-muted">
                          {vehicleClass.seats} seats · {vehicleClass.bags} bags
                        </span>
                        <span className="mt-1 block text-caption text-muted">
                          {full
                            ? 'Fully booked for these dates'
                            : `${vehicleClass.availableVehicles} free`}
                          {product === 'self_drive' && vehicleClass.securityDepositPesewas > 0
                            ? ` · ${formatGhs(vehicleClass.securityDepositPesewas)} hold`
                            : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block font-display text-display-sm text-ink">
                          {rate > 0 ? `${formatGhs(rate)}/day` : 'On request'}
                        </span>
                      </span>
                    </button>
                  );
                }) ?? (
                  <p className="text-body-sm text-muted">
                    {availabilityError ?? 'Checking the garage…'}
                  </p>
                )}
              </div>

              {availabilityError ? <p className="mt-2 text-caption text-danger">{availabilityError}</p> : null}
            </section>

            <section className="form-card">
              <h2 className="font-display text-display-sm text-ink">Where do you want it?</h2>

              <div className="seg mt-3 grid-cols-2" role="radiogroup" aria-label="Delivery">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!deliver}
                  onClick={() => {
                    setDeliver(false);
                    setQuote(null);
                  }}
                >
                  Collect from garage
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={deliver}
                  onClick={() => {
                    setDeliver(true);
                    setQuote(null);
                  }}
                >
                  Deliver to me
                </button>
              </div>

              {deliver ? (
                <div className="mt-3">
                  <PlaceSearch
                    label="Delivery address"
                    placeholder="Address, area or landmark"
                    zones={catalog?.zones ?? []}
                    allowGps
                    onPlace={setDeliveryPlace}
                    onZone={(match) => {
                      setDeliveryZone(match);
                      setQuote(null);
                    }}
                  />
                  <p className="mt-1.5 text-caption text-muted">
                    Delivery and collection inside Accra is a flat GH₵60.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-caption text-muted">
                  Digio garage, Accra. We&rsquo;ll confirm the collection time on WhatsApp.
                </p>
              )}

              {deliver && deliveryPlace ? (
                <p className="mt-2 text-caption text-forest">
                  Delivering to {deliveryPlace.label}
                </p>
              ) : null}
            </section>

            <section className="form-card">
              <h2 className="font-display text-display-sm text-ink">Extras</h2>
              <div className="mt-2 divide-y divide-line">
                {(catalog?.rentalExtras ?? []).map((extra) => (
                  <label
                    key={extra.code}
                    className="flex cursor-pointer items-center gap-3 py-3 text-body-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-forest"
                      checked={extras.includes(extra.code)}
                      onChange={(event) => {
                        setExtras(
                          event.target.checked
                            ? [...extras, extra.code]
                            : extras.filter((code) => code !== extra.code),
                        );
                        setQuote(null);
                      }}
                    />
                    <span className="flex-1 text-ink">{extra.label}</span>
                    <span className="tabular text-muted">{formatGhs(extra.dailyPesewas)}/day</span>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <Field label="Promo code">
                  <input
                    className="field-control uppercase"
                    placeholder="AKWAABA10"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setQuote(null);
                    }}
                  />
                </Field>
              </div>
            </section>

            {error ? <ErrorNote message={error} /> : null}

            <div className="grid gap-2">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || soldOut || days < 1 || dayRate <= 0}
              >
                {busy
                  ? 'Checking the garage…'
                  : soldOut
                    ? 'No car free for those dates'
                    : dayRate > 0
                      ? `See the price · ${formatGhs(dayRate)}/day`
                      : 'This class is not bookable online'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function RentConfirmStep(props: {
  quote: Quote;
  product: Product;
  name: string;
  phone: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const rental = props.quote.rental;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <section className="form-card">
        <p className="eyebrow">Confirm</p>
        <h1 className="mt-2 font-display text-display-md text-ink">Check the details</h1>

        {rental ? (
          <p className="mt-3 text-body-sm text-muted">
            {rental.vehicleDescription} · <span className="plate">{rental.vehiclePlate}</span>
          </p>
        ) : null}

        <dl className="mt-4 grid gap-2.5">
          <SummaryRow
            label="Hire"
            value={
              rental ? `${rental.days} day${rental.days === 1 ? '' : 's'}` : '—'
            }
          />
          {rental ? (
            <SummaryRow
              label="Dates"
              value={`${rental.fromDate} → ${rental.toDate}`}
            />
          ) : null}
          <SummaryRow
            label="Type"
            value={props.product === 'self_drive' ? 'Self-drive' : 'With chauffeur'}
          />
        </dl>

        <ul className="mt-4 divide-y divide-line border-t border-line pt-1">
          {props.quote.lineItems.map((item) => (
            <li key={item.code} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="text-body-sm text-muted">{item.label}</span>
              <span className="tabular shrink-0 text-body-sm text-ink">
                {formatGhs(item.amountPesewas)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-body-md font-semibold text-ink">Total</span>
          <span className="tabular font-display text-display-md text-ink">
            {formatGhs(props.quote.totalPesewas)}
          </span>
        </div>
        <p className="mt-1 text-caption text-muted">
          Deposit today {formatGhs(props.quote.depositPesewas)} · balance{' '}
          {formatGhs(props.quote.balancePesewas)} at handover
        </p>

        {rental && rental.securityDepositPesewas > 0 ? (
          <p className="mt-3 rounded-input bg-warning-bg px-3 py-2.5 text-caption text-warning">
            A refundable {formatGhs(rental.securityDepositPesewas)} security hold is taken when you
            collect the car. It is not part of this price.
          </p>
        ) : null}
      </section>

      <section className="form-card grid gap-3">
        <Field label="Name">
          <input
            className="field-control"
            required
            minLength={2}
            autoComplete="name"
            value={props.name}
            onChange={(event) => props.onName(event.target.value)}
          />
        </Field>
        <Field label="Mobile number">
          <input
            className="field-control tabular"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 123 4567"
            value={props.phone}
            onChange={(event) => props.onPhone(event.target.value)}
          />
        </Field>
        <p className="text-caption text-muted">
          Bring your licence to collection. Drivers must be 25 or older.
        </p>
      </section>

      {props.error ? <ErrorNote message={props.error} /> : null}

      <div className="grid gap-2">
        <button className="btn btn-primary" type="submit" disabled={props.busy}>
          {props.busy ? 'Holding the car…' : 'Confirm booking'}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={props.onBack}
          disabled={props.busy}
        >
          Change the car
        </button>
      </div>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-body-sm text-muted">{label}</dt>
      <dd className="text-right text-body-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function DarkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-body-sm text-hero-ink/70">{label}</dt>
      <dd className="tabular text-right text-body-sm font-medium text-hero-ink">{value}</dd>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-input bg-danger-bg px-3 py-2.5 text-body-sm text-danger" role="alert">
      {message}
    </p>
  );
}
