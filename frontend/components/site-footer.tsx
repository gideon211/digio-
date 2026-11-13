import Link from 'next/link';
import { Brand } from './brand';

const BOOK_LINKS = [
  { href: '/book', label: 'Airport transfers' },
  { href: '/book', label: 'Chauffeur hire' },
  { href: '/rent', label: 'Self-drive rentals' },
  { href: '/#fares', label: 'Published fares' },
] as const;

const CITY_LINKS = [
  { href: '/book', label: 'Accra, Ghana · live' },
  { href: '/#cities', label: 'New cities' },
  { href: '/#enquire', label: 'Partner with us' },
  { href: '/#enquire', label: 'Request a city' },
] as const;

export function SiteFooter() {
  return (
    <footer className="on-dark border-t border-white/10 bg-forest text-hero-ink">
      <div className="app-shell py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr_1.1fr]">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-body-sm text-hero-ink/70">
              Private chauffeurs and self-drive cars, one fixed price, in every city we serve.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['Card', 'Mobile money', 'Paystack'].map((mark) => (
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

          <nav aria-label="Cities">
            <h2 className="text-caption font-semibold uppercase tracking-[0.1em] text-hero-ink/60">
              Where we drive
            </h2>
            <ul className="mt-4 grid gap-3">
              {CITY_LINKS.map((link) => (
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
            <p className="mt-4 text-caption text-hero-ink/55">New cities open with local partners.</p>
          </nav>

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
          <span>© {new Date().getFullYear()} Digio · Worldwide</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Prices in local currency · Payments secured by Paystack</span>
            <Link href="/credits" className="underline-offset-4 hover:text-hero-ink hover:underline">
              Image credits
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
