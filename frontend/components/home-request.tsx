'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from './field';
import type { Zone } from '@/lib/api';

function shift(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The hero request form. It only collects what the price actually depends on
 * and hands the rest to /book — no pricing happens here.
 */
export function HomeRequest({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(shift(1));
  const [time, setTime] = useState('09:00');
  const [passengers, setPassengers] = useState(2);

  const selected = destination || zones.find((zone) => !zone.airport)?.slug || zones[0]?.slug || '';
  const ready = zones.length > 0;

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
            {zones.map((zone) => (
              <option key={zone.slug} value={zone.slug}>
                {zone.name}
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
