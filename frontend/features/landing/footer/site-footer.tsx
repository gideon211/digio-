'use client';

import Image from 'next/image';
import { FOOTER, FOOTER_LINKS } from '@/features/landing/model/landing-copy';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The three social marks.
 *
 * Only the X artwork ships as a finished disc. The LinkedIn and Instagram
 * files are bare 20px glyphs in the brand green, so they need the pale disc
 * drawn behind them. Instagram is stored upside down and is flipped back here
 * to match the frame.
 */
const SOCIALS = [
  { src: '/img/linkedin.svg', alt: 'LinkedIn', size: 20, flipped: false },
  { src: '/img/twitter.svg', alt: 'X', size: 40, flipped: false },
  { src: '/img/instagram.svg', alt: 'Instagram', size: 19, flipped: true },
];

/**
 * The footer.
 *
 * The frame pulls the footer in to a 928px column on a 1440 screen, which is
 * far narrower than the sections above it. That inset is what makes the
 * footer read as a sign-off rather than another content band, so it is kept
 * at 256px from each edge on wide screens and released to normal page
 * padding below that.
 *
 * The columns arrive last and from the bottom, so the eye has already left
 * the call to action before the site signs off.
 */
export function SiteFooter() {
  return (
    <footer
      id="contact"
      className="flex flex-col gap-[94px] bg-ink px-6 py-16 lg:px-8 lg:py-32 xl:px-[256px]"
    >
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <Reveal className="flex max-w-[323px] flex-col gap-6" distance={20}>
          <Image src="/img/logo.svg" alt="Digio" width={98} height={40} className="h-10 w-[98px]" />
          <p className="text-lg leading-7 text-white">{FOOTER.body}</p>
          <div className="flex items-center gap-4">
            {SOCIALS.map((social) => (
              <a
                key={social.alt}
                href="#"
                aria-label={social.alt}
                className="grid size-10 place-items-center rounded-pill bg-surface transition-transform duration-300 ease-out hover:-translate-y-0.5 active:scale-95"
              >
                <Image
                  src={social.src}
                  alt=""
                  width={social.size}
                  height={social.size}
                  className={social.flipped ? '-scale-y-100' : ''}
                />
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal className="flex flex-col gap-4 text-lg leading-7 text-white" distance={20} delay={0.06}>
          <p className="font-semibold">Links</p>
          <div className="flex flex-col gap-2 font-normal">
            {FOOTER_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="transition-opacity hover:opacity-70 active:opacity-50">
                {link.label}
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal className="flex flex-col gap-6" distance={20} delay={0.12}>
          <p className="text-lg font-semibold leading-7 text-white">Contact</p>
          <p className="text-sm leading-5 text-white">
            {FOOTER.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="text-sm leading-5 text-white">
            <span className="block">{FOOTER.email}</span>
            <span className="block">{FOOTER.phone}</span>
          </p>
        </Reveal>
      </div>

      <Reveal
        className="flex flex-col items-start justify-between gap-4 text-sm leading-5 text-white lg:flex-row lg:items-center"
        distance={16}
        delay={0.08}
      >
        <p>{FOOTER.copyright}</p>
        <div className="flex items-start gap-2">
          {FOOTER.legalLinks.map((link) => (
            <a key={link} href="#" className="underline transition-opacity hover:opacity-70 active:opacity-50">
              {link}
            </a>
          ))}
        </div>
      </Reveal>
    </footer>
  );
}
