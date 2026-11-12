'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from './brand';

/**
 * Three links and one action. The header is not the place for the whole site
 * map — a booking platform should look like it wants you to book.
 */
const LINKS = [
  { href: '/#fares', label: 'Fares' },
  { href: '/rent', label: 'Hire a car' },
  { href: '/#how', label: 'How it works' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="app-shell flex h-16 items-center justify-between gap-4 md:h-18">
        <Brand />

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex min-h-11 items-center rounded-pill px-3 text-body-sm transition-colors ${
                      active
                        ? 'font-semibold text-ink'
                        : 'text-muted hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    {link.label}
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gold"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link href="/book" className="btn btn-primary btn-sm w-auto">
          Book a ride
        </Link>
      </div>
    </header>
  );
}
