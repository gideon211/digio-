'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
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
  type TransferPrice,
  type ZoneMatch,
} from '@/lib/api';

type TripType = 'arrival' | 'departure' | 'city';
type Step = 'trip' | 'cars' | 'confirm' | 'done';

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'arrival', label: 'Arrival' },
  { value: 'departure', label: 'Departure' },
  { value: 'city', label: 'In town' },
];

const BOOK_STEPS = [
  { key: 'trip', label: 'Trip' },
  { key: 'cars', label: 'Car' },
  { key: 'confirm', label: 'Confirm' },
] as const;

function shift(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function BookPage() {
  return (
    <Suspense fallback={<main className="app-shell pt-6" />}>
      <BookForm />
    </Suspense>
  );
}

function BookForm() {
  const searchParams = useSearchParams();
  const seeded = useRef(false);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState<Step>('trip');

  const [tripType, setTripType] = useState<TripType>('arrival');
  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [pickupZone, setPickupZone] = useState<ZoneMatch | null>(null);
  const [dropoff, setDropoff] = useState<SelectedPlace | null>(null);
  const [dropoffZone, setDropoffZone] = useState<ZoneMatch | null>(null);
  const [date, setDate] = useState(shift(1));
  const [time, setTime] = useState('09:00');
  const [passengers, setPassengers] = useState(2);
  const [bags, setBags] = useState(2);
  const [flightNumber, setFlightNumber] = useState('');

  const [extras, setExtras] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');

  const [prices, setPrices] = useState<TransferPrice[] | null>(null);
  const [classSlug, setClassSlug] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const airport = catalog?.zones.find((zone) => zone.airport) ?? null;

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setError('Could not load the fleet. Is the API running on port 4000?'));
  }, []);

  // Arrive with the home-page request already filled in.
  useEffect(() => {
    if (seeded.current || !catalog) return;
    seeded.current = true;

    const from = searchParams.get('to');
    const requestedDate = searchParams.get('date');
    const requestedTime = searchParams.get('time');
    const requestedPax = searchParams.get('pax');

    if (requestedDate) setDate(requestedDate);
    if (requestedTime) setTime(requestedTime);
    if (requestedPax) setPassengers(Math.min(7, Math.max(1, Number(requestedPax) || 2)));

    if (!from) return;
    const zone = catalog.zones.find((candidate) => candidate.slug === from);
    if (!zone) return;

    setTripType('city');
    setDropoff({ label: zone.name, lat: zone.lat ?? 0, lng: zone.lng ?? 0 });
    setDropoffZone({
      zone: { slug: zone.slug, name: zone.name, airport: zone.airport },
      distanceMetres: 0,
      withinServiceArea: true,
    });
  }, [catalog, searchParams]);

  const airportMatch: ZoneMatch | null = airport
    ? {
        zone: { slug: airport.slug, name: airport.name, airport: airport.airport },
        distanceMetres: 0,
        withinServiceArea: true,
      }
    : null;

  const fromMatch = tripType === 'arrival' ? airportMatch : pickupZone;
  const toMatch = tripType === 'departure' ? airportMatch : dropoffZone;

  const fromLabel =
    tripType === 'arrival' ? (airport?.name ?? 'Kotoka International Airport') : pickup?.label;
  const toLabel =
    tripType === 'departure' ? (airport?.name ?? 'Kotoka International Airport') : dropoff?.label;

  const startsAt = `${date}T${time}:00`;

  function describeZoneProblem(): string | null {
    if (!fromMatch?.zone || !toMatch?.zone) return 'Set both a pick-up and a drop-off first';
    if (!fromMatch.withinServiceArea || !toMatch.withinServiceArea) {
      return 'That location is outside our service area — we drive greater Accra';
    }
    if (!date || !time) return 'Pick a date and a time';
    return null;
  }

  async function loadPrices() {
    const problem = describeZoneProblem();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.compareTransfers({
        fromZoneSlug: fromMatch?.zone?.slug ?? '',
        toZoneSlug: toMatch?.zone?.slug ?? '',
        passengers,
        bags,
        extras,
        promoCode: promoCode || undefined,
      });
      setPrices(result);
      setClassSlug((current) =>
        current && result.some((price) => price.classSlug === current) ? current : null,
      );
      setStep('cars');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not price that trip');
    } finally {
      setBusy(false);
    }
  }

  async function chooseCar() {
    if (!classSlug) {
      setError('Choose a car to continue');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.createChauffeurQuote({
        classSlug,
        fromZoneSlug: fromMatch?.zone?.slug ?? '',
        toZoneSlug: toMatch?.zone?.slug ?? '',
        passengers,
        bags,
        startsAt: new Date(startsAt).toISOString(),
        flightNumber: flightNumber || undefined,
        extras,
        promoCode: promoCode || undefined,
      });
      setQuote(result);
      setStep('confirm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      // The car may have been re-priced while the customer was deciding.
      setError(cause instanceof ApiError ? cause.message : 'Could not price that car');
      if (cause instanceof ApiError && (cause.code === 'VEHICLE_TOO_SMALL' || cause.code === 'ZONE_PAIR_UNAVAILABLE')) {
        setPrices(null);
        setStep('trip');
      }
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

  const selected = prices?.find((price) => price.classSlug === classSlug) ?? null;

  return (
    <main className="app-shell pt-6 pb-4">
      <div className="stack">
        <StepRibbon steps={BOOK_STEPS} activeKey={step} />

        {step === 'done' && booking ? (
          <BookedConfirmation
            booking={booking}
            error={error}
            busy={busy}
            onPay={() => void startPayment()}
          />
        ) : step === 'confirm' && quote ? (
          <ConfirmStep
            quote={quote}
            fromLabel={fromLabel ?? ''}
            toLabel={toLabel ?? ''}
            startsAt={startsAt}
            passengers={passengers}
            bags={bags}
            flightNumber={flightNumber}
            car={selected}
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
        ) : step === 'cars' && prices ? (
          <CarsStep
            prices={prices}
            classSlug={classSlug}
            passengers={passengers}
            extrasList={catalog?.extras ?? []}
            onSelect={setClassSlug}
            extras={extras}
            onExtras={setExtras}
            promoCode={promoCode}
            onPromo={setPromoCode}
            onReprice={() => void loadPrices()}
            error={error}
            busy={busy}
            onBack={() => {
              setStep('trip');
              setError(null);
            }}
            onContinue={() => void chooseCar()}
          />
        ) : (
          <TripStep
            catalog={catalog}
            tripType={tripType}
            onTripType={(next) => {
              setTripType(next);
              setError(null);
            }}
            pickup={pickup}
            onPickup={(place) => {
              setPickup(place);
              setError(null);
            }}
            onPickupZone={setPickupZone}
            dropoff={dropoff}
            onDropoff={(place) => {
              setDropoff(place);
              setError(null);
            }}
            onDropoffZone={setDropoffZone}
            airportName={airport?.name ?? 'Kotoka International Airport'}
            date={date}
            onDate={setDate}
            time={time}
            onTime={setTime}
            passengers={passengers}
            onPassengers={setPassengers}
            bags={bags}
            onBags={setBags}
            flightNumber={flightNumber}
            onFlightNumber={setFlightNumber}
            error={error}
            busy={busy}
            onSubmit={() => void loadPrices()}
          />
        )}
      </div>
    </main>
  );
}

/* ───────────────────────────── Steps ───────────────────────────── */

function TripStep(props: {
  catalog: Catalog | null;
  tripType: TripType;
  onTripType: (value: TripType) => void;
  pickup: SelectedPlace | null;
  onPickup: (place: SelectedPlace | null) => void;
  onPickupZone: (match: ZoneMatch) => void;
  dropoff: SelectedPlace | null;
  onDropoff: (place: SelectedPlace | null) => void;
  onDropoffZone: (match: ZoneMatch) => void;
  airportName: string;
  date: string;
  onDate: (value: string) => void;
  time: string;
  onTime: (value: string) => void;
  passengers: number;
  onPassengers: (value: number) => void;
  bags: number;
  onBags: (value: number) => void;
  flightNumber: string;
  onFlightNumber: (value: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  const zones = props.catalog?.zones ?? [];
  const needsPickupSearch = props.tripType !== 'arrival';
  const needsDropoffSearch = props.tripType !== 'departure';

  return (
    <form
      className="form-card"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <p className="eyebrow">Book a ride</p>
      <h1 className="mt-2 font-display text-display-md text-ink">Where are you going?</h1>

      <div className="seg mt-4 grid-cols-3" role="radiogroup" aria-label="Trip type">
        {TRIP_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={props.tripType === option.value}
            onClick={() => props.onTripType(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-caption text-muted">
        {props.tripType === 'city'
          ? 'Anywhere in greater Accra, priced by the zone pair.'
          : 'To and from Kotoka International Airport.'}
      </p>

      <div className="mt-4 grid gap-3">
        {needsPickupSearch ? (
          <PlaceSearch
            label="Pick-up"
            placeholder="Address, area or landmark"
            zones={zones}
            allowGps
            onPlace={props.onPickup}
            onZone={props.onPickupZone}
          />
        ) : (
          <StaticRow label="Pick-up" value={props.airportName} note="We track your flight" />
        )}

        {needsDropoffSearch ? (
          <PlaceSearch
            label="Drop-off"
            placeholder="Address, area or landmark"
            zones={zones}
            onPlace={props.onDropoff}
            onZone={props.onDropoffZone}
          />
        ) : (
          <StaticRow label="Drop-off" value={props.airportName} note="Tolls included" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              className="field-control tabular"
              type="date"
              value={props.date}
              min={shift(0)}
              onChange={(event) => props.onDate(event.target.value)}
            />
          </Field>
          <Field label="Pick-up time">
            <input
              className="field-control tabular"
              type="time"
              value={props.time}
              onChange={(event) => props.onTime(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Passengers">
            <select
              className="field-control tabular"
              value={props.passengers}
              onChange={(event) => props.onPassengers(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Large bags">
            <select
              className="field-control tabular"
              value={props.bags}
              onChange={(event) => props.onBags(Number(event.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {props.tripType !== 'city' ? (
          <Field label="Flight number (optional)">
            <input
              className="field-control"
              placeholder="BA 78"
              value={props.flightNumber}
              onChange={(event) => props.onFlightNumber(event.target.value)}
            />
          </Field>
        ) : null}
      </div>

      {props.error ? <ErrorNote message={props.error} /> : null}

      <button className="btn btn-primary mt-4" type="submit" disabled={props.busy}>
        {props.busy ? 'Checking the garage…' : 'See cars and prices'}
      </button>
      <p className="mt-3 text-caption text-muted">
        Fixed price, tolls included. Free waiting: 60 minutes on flights, 10 minutes in town.
      </p>
    </form>
  );
}

function CarsStep(props: {
  prices: TransferPrice[];
  classSlug: string | null;
  passengers: number;
  extrasList: { code: string; label: string; pricePesewas: number }[];
  onSelect: (slug: string) => void;
  extras: string[];
  onExtras: (value: string[]) => void;
  promoCode: string;
  onPromo: (value: string) => void;
  onReprice: () => void;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="form-card">
        <p className="eyebrow">Step 2</p>
        <h1 className="mt-2 font-display text-display-md text-ink">Choose your car</h1>
        <p className="mt-1 text-body-sm text-muted">
          Fixed prices for this route. The price you see is the price you pay.
        </p>

        <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Vehicle class">
          {props.prices.map((price) => {
            const tooSmall = price.seats < props.passengers;
            const full = price.availableVehicles === 0;
            const disabled = tooSmall || full;
            return (
              <button
                key={price.classSlug}
                type="button"
                role="radio"
                aria-checked={props.classSlug === price.classSlug}
                disabled={disabled}
                onClick={() => props.onSelect(price.classSlug)}
                className="option-row"
              >
                <CarArt kind={carKindFor(price.classSlug)} className="h-[26px] w-12 text-forest sm:h-[38px] sm:w-20" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-md font-semibold text-ink">{price.name}</span>
                  <span className="block truncate text-body-sm text-muted">{price.description}</span>
                  <span className="mt-1 block text-caption text-muted">
                    {full
                      ? 'Fully booked for this slot'
                      : tooSmall
                        ? `Seats ${price.seats} — too small for ${props.passengers}`
                        : `${price.seats} seats · ${price.bags} bags · ${price.availableVehicles} free`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block font-display text-body-md font-semibold text-ink sm:text-display-sm">
                    {formatGhs(price.totalPesewas)}
                  </span>
                  <span className="tabular block text-caption text-muted">
                    {formatGhs(price.depositPesewas)} today
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="form-card">
        <h2 className="font-display text-display-sm text-ink">Extras</h2>
        <div className="mt-3 divide-y divide-line">
          {props.extrasList.map((extra) => (
            <label
              key={extra.code}
              className="flex cursor-pointer items-center gap-3 py-3 text-body-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-forest"
                checked={props.extras.includes(extra.code)}
                onChange={(event) =>
                  props.onExtras(
                    event.target.checked
                      ? [...props.extras, extra.code]
                      : props.extras.filter((code) => code !== extra.code),
                  )
                }
              />
              <span className="flex-1 text-ink">{extra.label}</span>
              <span className="tabular text-muted">{formatGhs(extra.pricePesewas)}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Field label="Promo code">
            <input
              className="field-control uppercase"
              placeholder="AKWAABA10"
              value={props.promoCode}
              onChange={(event) => props.onPromo(event.target.value)}
            />
          </Field>
          <button className="btn btn-secondary btn-sm mb-1 w-auto" type="button" onClick={props.onReprice}>
            Apply
          </button>
        </div>
      </section>

      {props.error ? <ErrorNote message={props.error} /> : null}

      <div className="grid gap-2">
        <button
          className="btn btn-primary"
          type="button"
          disabled={props.busy || !props.classSlug}
          onClick={props.onContinue}
        >
          {props.busy ? 'Working…' : 'Continue'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={props.onBack}>
          Change the trip
        </button>
      </div>
    </div>
  );
}

function ConfirmStep(props: {
  quote: Quote;
  fromLabel: string;
  toLabel: string;
  startsAt: string;
  passengers: number;
  bags: number;
  flightNumber: string;
  car: TransferPrice | null;
  name: string;
  phone: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <section className="form-card">
        <p className="eyebrow">Step 3</p>
        <h1 className="mt-2 font-display text-display-md text-ink">Confirm and pay</h1>

        <dl className="mt-4 grid gap-2.5">
          <SummaryRow label="Route" value={`${props.fromLabel} → ${props.toLabel}`} />
          <SummaryRow label="When" value={formatWhen(props.startsAt)} />
          <SummaryRow label="Passengers" value={`${props.passengers} · ${props.bags} bags`} />
          {props.flightNumber ? <SummaryRow label="Flight" value={props.flightNumber} /> : null}
          {props.car ? <SummaryRow label="Car" value={props.car.name} /> : null}
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
          Your confirmation arrives by WhatsApp and SMS, with the reference for the driver.
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

function BookedConfirmation(props: {
  booking: Booking;
  error: string | null;
  busy: boolean;
  onPay: () => void;
}) {
  const { booking } = props;

  return (
    <div className="grid gap-4">
      <section className="band-dark on-dark p-6">
        <p className="eyebrow text-gold">Booked</p>
        <h1 className="mt-2 font-display text-display-md text-hero-ink">
          Your car is held for 15 minutes.
        </h1>
        <p className="mt-2 text-body-sm text-hero-ink/80">
          {booking.vehicle
            ? `${booking.vehicle.description} · ${booking.vehicle.plate}`
            : `${booking.pickup} → ${booking.dropoff}`}
        </p>

        <dl className="mt-5 grid gap-2.5 border-t border-white/15 pt-4">
          <DarkRow label="Reference" value={booking.ref} />
          <DarkRow label="Route" value={`${booking.pickup} → ${booking.dropoff}`} />
          <DarkRow label="When" value={formatWhen(booking.startsAt)} />
          <DarkRow label="Total" value={formatGhs(booking.totalPesewas)} />
          <DarkRow label="Deposit due now" value={formatGhs(booking.depositDuePesewas)} />
        </dl>
      </section>

      {props.error ? <ErrorNote message={props.error} /> : null}

      <div className="grid gap-2">
        <button className="btn btn-primary" type="button" onClick={props.onPay} disabled={props.busy}>
          {props.busy ? 'Opening checkout…' : `Pay deposit ${formatGhs(booking.depositDuePesewas)}`}
        </button>
        <Link href={`/b/${booking.ref}`} className="btn btn-secondary">
          Manage this booking
        </Link>
      </div>

      <p className="text-center text-caption text-muted">
        Nothing is charged until you approve the mobile money prompt.
      </p>
    </div>
  );
}

/* ───────────────────────────── Parts ───────────────────────────── */

function StaticRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="mt-0.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-body-md font-medium text-ink">{value}</span>
        <span className="shrink-0 text-caption text-muted">{note}</span>
      </span>
    </div>
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
    <p className="mt-3 rounded-input bg-danger-bg px-3 py-2.5 text-body-sm text-danger" role="alert">
      {message}
    </p>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'To be confirmed';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
