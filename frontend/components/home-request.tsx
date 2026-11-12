'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from './field';
import { type FareList, formatGhs, type Zone } from '@/lib/api';

function shift(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The hero request form. It only collects what the price actually depends on
 * and hands the rest to /book — no pricing happens here.
 *
 * It also shows what the trip will cost. The numbers are the published airport
 * fares, fetched on the server with the page, so the form can answer "roughly
 * how much?" before a customer commits to anything — and answer it with the
 * same engine that will eventually charge them.
 */
export function HomeRequest({ zones, fares }: { zones: Zone[]; fares: FareList | null }) {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(shift(1));
  const [time, setTime] = useState('09:00');
  const [passengers, setPassengers] = useState(2);

  const selected = destination || zones.find((zone) => !zone.airport)?.slug || zones[0]?.slug || '';
  const ready = zones.length > 0;

  const route = fares?.routes.find((entry) => entry.zoneSlug === selected) ?? null;
  const zone = zones.find((entry) => entry.slug === selected) ?? null;

  function start(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const params = new URLSearchParams({
      to: selected,
      date,
      time,
      pax: String(passengers),
    });
    router.push(`/book?${params.toString()}`);
  }

  return (
    <form className="form-card" onSubmit={start}>
      <h2 className="font-display text-display-sm text-ink">Where are you going?</h2>

      <div className="mt-4 grid gap-3">
        <Field label="Drop-off area">
          <select
            className="field-control"
            value={selected}
            onChange={(event) => setDestination(event.target.value)}
          >
            {zones.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              className="field-control tabular"
              type="date"
              value={date}
              min={shift(0)}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Pick-up time">
            <input
              className="field-control tabular"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Passengers">
          <select
            className="field-control tabular"
            value={passengers}
            onChange={(event) => setPassengers(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'passenger' : 'passengers'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Live fare board: three classes, one route, published prices. */}
      {route && zone ? (
        <div className="mt-4 rounded-md bg-sunken px-3 py-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="eyebrow">Airport fare</span>
            <span className="text-caption text-muted">
              Kotoka → {zone.name} · one way, tolls in
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {route.prices.map((price) => (
              <div
                key={price.classSlug}
                className="rounded-[10px] border border-line bg-raised px-2.5 py-2"
              >
                <span className="block truncate text-caption text-muted">
                  {price.className.replace('Executive ', '').replace('Premium ', '')}
                </span>
                <span className="tabular mt-0.5 block font-display text-body-md font-semibold text-ink">
                  {formatGhs(price.pricePesewas)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button className="btn btn-primary mt-4" type="submit" disabled={!ready}>
        {ready ? 'See cars and prices' : 'Loading the fleet…'}
      </button>
      <p className="mt-3 text-caption text-muted">
        {ready
          ? 'Fixed price, tolls included. Free waiting: 60 minutes on flights, 10 minutes in town.'
          : 'The API could not be reached. Start it on port 4000 and reload.'}
      </p>
    </form>
  );
}
