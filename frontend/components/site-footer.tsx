import Link from 'next/link';
import { Brand } from './brand';

const BOOKING_LINKS = [
  { href: '/book', label: 'Airport transfers' },
  { href: '/book', label: 'Chauffeur hire' },
  { href: '/rent', label: 'Self-drive rentals' },
] as const;

const HOW_IT_WORKS = [
  '30% deposit confirms the booking',
  'Balance settled at handover',
  'Confirmation by WhatsApp and SMS',
] as const;

export function SiteFooter() {
  return (
    <footer className="on-dark mt-16 bg-forest text-hero-ink">
      <div className="app-shell py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <span className="font-display text-xl font-bold text-hero-ink">
              Digio<span className="text-gold">.</span>
            </span>
            <p className="mt-3 max-w-xs text-body-sm text-hero-ink/70">
              Accra, Ghana. Late-model cars, vetted chauffeurs, one fixed price — no surge.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['Cold AC', 'Bottled water', 'Chargers', 'Flight tracking'].map((perk) => (
                <li key={perk} className="chip chip-on-dark">
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Book">
            <h2 className="text-body-sm font-semibold text-hero-ink">Book</h2>
            <ul className="mt-4 grid gap-3">
              {BOOKING_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-body-sm text-hero-ink/70 underline-offset-4 hover:text-hero-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-body-sm font-semibold text-hero-ink">How it works</h2>
            <ul className="mt-4 grid gap-3 text-body-sm text-hero-ink/70">
              {HOW_IT_WORKS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-6 text-caption text-hero-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Digio · Accra</span>
          <span>Prices in GH₵ · Prototype build</span>
        </div>
      </div>
    </footer>
  );
}
