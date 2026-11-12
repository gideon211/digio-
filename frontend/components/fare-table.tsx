'use client';

import Link from 'next/link';
import { useState } from 'react';
import { type FareList, formatGhs } from '@/lib/api';

/**
 * The published price list.
 *
 * Desktop shows all three classes at once so the ladder is visible — a
 * customer can see that the van costs 2.1× the sedan without asking. A phone
 * cannot hold four columns without scrolling sideways, so it gets a class
 * toggle instead and one honest column.
 *
 * Every destination links into the booking flow with the zone already chosen:
 * a price someone has just read should be one tap from being acted on.
 */
export function FareTable({ fares }: { fares: FareList }) {
  const all = fares.routes[0]?.prices ?? [];
  const [activeClass, setActiveClass] = useState(all[0]?.classSlug ?? '');

  return (
    <div>
      <div className="seg grid-cols-3 md:hidden" role="group" aria-label="Vehicle class">
        {all.map((price) => (
          <button
            key={price.classSlug}
            type="button"
            aria-pressed={price.classSlug === activeClass}
            onClick={() => setActiveClass(price.classSlug)}
          >
            {price.className.replace('Executive ', '').replace('Premium ', '')}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto md:mt-7">
        <table className="fare-table md:min-w-[620px]">
          <caption className="sr-only">
            Fares from {fares.from} to each area, by vehicle class
          </caption>
          <thead>
            <tr>
              <th scope="col">Destination</th>
              {all.map((price) => (
                <th
                  key={price.classSlug}
                  scope="col"
                  className={`text-right md:hidden ${
                    price.classSlug === activeClass ? '' : 'hidden'
                  }`}
                >
                  {price.className}
                </th>
              ))}
              {all.map((price) => (
                <th
                  key={`wide-${price.classSlug}`}
                  scope="col"
                  className="hidden text-right md:table-cell"
                >
                  {price.className}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fares.routes.map((route) => (
              <tr key={route.zoneSlug}>
                <th scope="row" className="font-medium text-ink">
                  <Link
                    href={`/book?to=${encodeURIComponent(route.zoneSlug)}`}
                    className="group -mx-1 inline-flex items-center gap-2 rounded-pill px-1 py-0.5 hover:text-forest"
                  >
                    {route.zone}
                    <span
                      aria-hidden
                      className="text-gold opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      →
                    </span>
                  </Link>
                </th>
                {route.prices.map((price) => (
                  <td
                    key={price.classSlug}
                    className={`tabular text-right font-medium text-ink md:hidden ${
                      price.classSlug === activeClass ? '' : 'hidden'
                    }`}
                  >
                    {formatGhs(price.pricePesewas)}
                  </td>
                ))}
                {route.prices.map((price) => (
                  <td
                    key={`wide-${price.classSlug}`}
                    className="tabular hidden text-right font-medium text-ink md:table-cell"
                  >
                    {formatGhs(price.pricePesewas)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-caption text-muted">
        One way, tolls included, priced by the same engine that will price your booking. City-to-city
        trips are priced the same way. Promo and member discounts come off these numbers at checkout.
      </p>
    </div>
  );
}
