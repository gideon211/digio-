'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiError,
  formatGhs,
  type Booking,
  type Catalog,
  type Quote,
} from '@/lib/api';

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function BookPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [classSlug, setClassSlug] = useState('suv');
  const [fromZone, setFromZone] = useState('kotoka-airport');
  const [toZone, setToZone] = useState('east-legon');
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState('09:00');
  const [passengers, setPassengers] = useState(2);
  const [bags, setBags] = useState(2);
  const [extras, setExtras] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [flightNumber, setFlightNumber] = useState('');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .catalog()
      .then((data) => {
        setCatalog(data);
        const airport = data.zones.find((zone) => zone.airport);
        const city = data.zones.find((zone) => !zone.airport);
        if (airport) setFromZone(airport.slug);
        if (city) setToZone(city.slug);
      })
      .catch(() => setError('Could not load the fleet. Is the API running on port 4000?'));
  }, []);

  const selectedClass = useMemo(
    () => catalog?.vehicleClasses.find((vehicleClass) => vehicleClass.slug === classSlug),
    [catalog, classSlug],
  );

  async function getQuote() {
    setBusy(true);
    setError(null);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const result = await api.createChauffeurQuote({
        classSlug,
        fromZoneSlug: fromZone,
        toZoneSlug: toZone,
        passengers,
        bags,
        startsAt,
        flightNumber: flightNumber || undefined,
        extras,
        promoCode: promoCode || undefined,
      });
      setQuote(result);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not price that ride');
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.createBooking({
        quoteToken: quote.token,
        customer: { name, phone },
      });
      setBooking(result);
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

  if (booking) {
    return (
      <main className="app-shell pt-5">
        <div className="mb-4 rounded-[20px] bg-forest px-5 py-6 text-hero-ink">
          <h1 className="font-display text-[26px] leading-tight font-bold">You&rsquo;re booked.</h1>
          <p className="mt-1 text-sm opacity-85">
            {booking.pickup} → {booking.dropoff}
          </p>
        </div>
        <div className="card">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Reference</span>
            <span className="tabular font-display text-lg font-bold">{booking.ref}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xs text-muted">Total</span>
            <span className="tabular font-semibold">{formatGhs(booking.totalPesewas)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted">Deposit due now</span>
            <span className="tabular font-semibold">{formatGhs(booking.depositDuePesewas)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted">Balance on the day</span>
            <span className="tabular text-muted">
              {formatGhs(booking.totalPesewas - booking.depositDuePesewas)}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Pay the deposit to lock the car. We&rsquo;ll send the confirmation by SMS and WhatsApp.
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-[10px] bg-danger-bg px-3 py-2 text-[13px] text-danger">{error}</p>
        ) : null}

        <button className="btn-primary mt-3" type="button" onClick={() => void startPayment()} disabled={busy}>
          {busy ? 'Opening checkout…' : `Pay deposit ${formatGhs(booking.depositDuePesewas)}`}
        </button>
        <Link href={`/b/${booking.ref}`} className="btn-secondary mt-2">
          Manage this booking
        </Link>
      </main>
    );
  }

  return (
    <main className="app-shell pt-5">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-bold">
          Digio<span className="text-gold">.</span>
        </Link>
        <span className="text-xs text-muted">Book a ride</span>
      </header>

      <form
        className="card grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void (quote ? confirmBooking() : getQuote());
        }}
      >
        <div>
          <label className="label" htmlFor="class">
            Car
          </label>
          <select
            id="class"
            className="field"
            value={classSlug}
            onChange={(event) => setClassSlug(event.target.value)}
          >
            {catalog?.vehicleClasses.map((vehicleClass) => (
              <option key={vehicleClass.slug} value={vehicleClass.slug}>
                {vehicleClass.name}
              </option>
            )) ?? <option>Loading…</option>}
          </select>
          {selectedClass ? (
            <p className="mt-1 text-xs text-muted">
              {selectedClass.seats} seats · {selectedClass.bags} bags
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <select
              id="from"
              className="field"
              value={fromZone}
              onChange={(event) => setFromZone(event.target.value)}
            >
              {catalog?.zones.map((zone) => (
                <option key={zone.slug} value={zone.slug}>
                  {zone.name}
                </option>
              )) ?? <option>Loading…</option>}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <select
              id="to"
              className="field"
              value={toZone}
              onChange={(event) => setToZone(event.target.value)}
            >
              {catalog?.zones.map((zone) => (
                <option key={zone.slug} value={zone.slug}>
                  {zone.name}
                </option>
              )) ?? <option>Loading…</option>}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              className="field"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="time">
              Time
            </label>
            <input
              id="time"
              className="field"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="pax">
              Passengers
            </label>
            <input
              id="pax"
              className="field tabular"
              type="number"
              min={1}
              max={7}
              value={passengers}
              onChange={(event) => setPassengers(Number(event.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="bags">
              Large bags
            </label>
            <input
              id="bags"
              className="field tabular"
              type="number"
              min={0}
              max={8}
              value={bags}
              onChange={(event) => setBags(Number(event.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="flight">
            Flight number (optional)
          </label>
          <input
            id="flight"
            className="field"
            placeholder="BA 78"
            value={flightNumber}
            onChange={(event) => setFlightNumber(event.target.value)}
          />
        </div>

        <fieldset>
          <legend className="label">Extras</legend>
          <div className="grid gap-1">
            {catalog?.extras.map((extra) => (
              <label key={extra.code} className="flex items-center gap-2 py-1 text-[13px]">
                <input
                  type="checkbox"
                  checked={extras.includes(extra.code)}
                  onChange={(event) =>
                    setExtras((current) =>
                      event.target.checked
                        ? [...current, extra.code]
                        : current.filter((code) => code !== extra.code),
                    )
                  }
                />
                <span className="flex-1">{extra.label}</span>
                <span className="tabular text-muted">{formatGhs(extra.pricePesewas)}</span>
              </label>
            )) ?? null}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="promo">
            Promo code (optional)
          </label>
          <input
            id="promo"
            className="field uppercase"
            placeholder="AKWAABA10"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
          />
        </div>

        {quote ? (
          <div className="rounded-[14px] bg-sunken p-3">
            <ul className="grid gap-1">
              {quote.lineItems.map((item) => (
                <li key={item.code} className="flex justify-between text-[13px]">
                  <span>{item.label}</span>
                  <span className="tabular">{formatGhs(item.amountPesewas)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="tabular font-display text-xl font-bold">
                {formatGhs(quote.totalPesewas)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Deposit today {formatGhs(quote.depositPesewas)} · balance on the day
            </p>

            <div className="mt-3 grid gap-2">
              <div>
                <label className="label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="field"
                  required
                  minLength={2}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="phone">
                  Mobile number
                </label>
                <input
                  id="phone"
                  className="field tabular"
                  required
                  inputMode="tel"
                  placeholder="024 123 4567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-[10px] bg-danger-bg px-3 py-2 text-[13px] text-danger">{error}</p>
        ) : null}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : quote ? 'Confirm booking' : 'See the price'}
        </button>

        {quote ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setQuote(null);
              setError(null);
            }}
          >
            Change trip
          </button>
        ) : null}
      </form>
    </main>
  );
}
