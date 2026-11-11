import Link from 'next/link';
import { api, type Catalog } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SERVICES = [
  {
    title: 'Airport transfers',
    body: 'Flight-tracked pickups at Kotoka, name board, luggage handled. One fixed price.',
    href: '/book',
  },
  {
    title: 'Chauffeur hire',
    body: 'Full-day and multi-day hire with a vetted chauffeur and a late-model car.',
    href: '/book',
  },
  {
    title: 'Self-drive rentals',
    body: 'Daily rates, delivery to your hotel, insurance and deposit handled online.',
    href: '/book',
  },
] as const;

export default async function HomePage() {
  let catalog: Catalog | null = null;
  try {
    catalog = await api.catalog();
  } catch {
    catalog = null;
  }

  return (
    <main className="app-shell pt-5 md:max-w-3xl md:py-10">
      <header className="mb-5 flex items-center justify-between">
        <span className="font-display text-xl font-bold tracking-tight">
          Digio<span className="text-gold">.</span>
        </span>
        <span className="text-xs text-muted">Accra · GH₵</span>
      </header>

      <section className="mb-4 rounded-[20px] bg-forest px-5 py-6 text-hero-ink">
        <h1 className="font-display text-[28px] leading-[1.1] font-bold">
          Arrive well. Every ride.
        </h1>
        <p className="mt-2 text-sm opacity-85">
          Late-model cars, vetted chauffeurs, one fixed price. No surge.
        </p>
        <ul className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
          {['Cold AC', 'Bottled water', 'Chargers', 'Flight tracking'].map((perk) => (
            <li key={perk} className="rounded-full border border-white/20 px-2.5 py-0.5">
              {perk}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4 grid gap-2.5">
        {SERVICES.map((service) => (
          <Link
            key={service.title}
            href={service.href}
            className="card block transition-colors hover:border-line-strong"
          >
            <h2 className="font-display text-[17px] font-bold">{service.title}</h2>
            <p className="mt-1 text-[13px] text-muted">{service.body}</p>
          </Link>
        ))}
      </section>

      <section className="card mb-4">
        <h2 className="font-display text-[15px] font-bold">The fleet</h2>
        {catalog ? (
          <ul className="mt-2 divide-y divide-line">
            {catalog.vehicleClasses.map((vehicleClass) => (
              <li key={vehicleClass.slug} className="flex items-baseline justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">{vehicleClass.name}</p>
                  <p className="text-xs text-muted">
                    {vehicleClass.seats} seats · {vehicleClass.bags} bags ·{' '}
                    {vehicleClass.description}
                  </p>
                </div>
                <span className="tabular shrink-0 text-xs text-muted">
                  {vehicleClass.availableVehicles} available
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            Fleet is loading. Make sure the API is running on port 4000.
          </p>
        )}
      </section>

      <Link href="/book" className="btn-primary">
        Book a ride
      </Link>
      <p className="mt-4 text-center text-xs text-muted">
        Prototype build · prices are server-generated, never client-side
      </p>
    </main>
  );
}
