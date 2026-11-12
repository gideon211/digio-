import Link from 'next/link';
import { Brand } from './brand';

const BOOK_LINKS = [
  { href: '/book', label: 'Airport transfers' },
  { href: '/book', label: 'Chauffeur hire' },
  { href: '/rent', label: 'Self-drive rentals' },
  { href: '/#fares', label: 'Published fares' },
] as const;

const AREAS = [
  'Kotoka International Airport',
  'Airport City & Cantonments',
  'Labone, Osu & Labadi',
  'East Legon & Dzorwulu',
  'Ridge & Spintex',
  'Tema',
] as const;

export function SiteFooter() {
  return (
    <footer className="on-dark border-t border-white/10 bg-forest text-hero-ink">
      <div className="app-shell py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr_1.1fr]">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-body-sm text-hero-ink/70">
              Late-model cars, vetted chauffeurs and one fixed price — no surge, ever.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['Paystack', 'Mobile money', 'Card'].map((mark) => (
                <li key={mark} className="chip chip-on-dark">
                  {mark}
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Book">
            <h2 className="text-caption font-semibold uppercase tracking-[0.1em] text-hero-ink/60">
              Book
            </h2>
            <ul className="mt-4 grid gap-3">
              {BOOK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-body-sm text-hero-ink/75 underline-offset-4 transition-colors hover:text-hero-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-caption font-semibold uppercase tracking-[0.1em] text-hero-ink/60">
              We drive
            </h2>
            <ul className="mt-4 grid gap-3 text-body-sm text-hero-ink/75">
              {AREAS.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
            <p className="mt-4 text-caption text-hero-ink/55">Plus anywhere within about 40 km.</p>
          </div>

          <div>
            <h2 className="text-caption font-semibold uppercase tracking-[0.1em] text-hero-ink/60">
              Managing a booking
            </h2>
            <p className="mt-4 text-body-sm text-hero-ink/75">
              Your booking link arrives by WhatsApp and SMS the moment the deposit clears. Reply there
              to change anything — a person answers.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <Link
                href="/#faq"
                className="text-body-sm text-hero-ink/75 underline-offset-4 hover:text-hero-ink hover:underline"
              >
                Questions
              </Link>
              <Link
                href="/#enquire"
                className="text-body-sm text-hero-ink/75 underline-offset-4 hover:text-hero-ink hover:underline"
              >
                Send an enquiry
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 text-caption text-hero-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Digio · Accra, Ghana</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Prices in GH₵ · Deposits secured by Paystack</span>
            <Link href="/credits" className="underline-offset-4 hover:text-hero-ink hover:underline">
              Image credits
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
