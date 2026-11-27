'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { NAV_LINKS } from '@/features/landing/model/landing-copy';
import { Button } from '@/shared/ui/button/button';

/**
 * The mobile header.
 *
 * On a phone the navigation cannot sit in a row across the top, so it folds
 * behind a button and opens as a full-height panel. The panel is dark rather
 * than transparent because it covers the photograph underneath, and a
 * translucent panel over a car photo makes the links unreadable.
 *
 * The bar is 88px tall: a 40px logo centred in 24px of padding on each side.
 * The same 24px gutter is reused inside the panel so the links line up with
 * the logo edge.
 */
export function MobileHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`absolute inset-x-0 top-0 z-50 lg:hidden ${open ? 'bg-ink' : ''}`}>
      <div className="flex h-[88px] items-center justify-between p-6">
        <Image src="/img/logo.svg" alt="Digio" width={98} height={40} className="h-10 w-[98px]" />
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
          className="grid h-14 w-14 place-items-center rounded-pill transition-[background-color,transform] duration-300 hover:bg-white/10 active:scale-95"
        >
          <Image
            src={open ? '/img/menu-close.svg' : '/img/menu-open.svg'}
            alt=""
            width={16}
            height={14}
            className={open ? 'size-3' : 'h-3.5 w-4'}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="flex h-[calc(100dvh-88px)] flex-col gap-12 overflow-hidden bg-ink px-6 py-6"
            initial={{ height: 0 }}
            animate={{ height: 'calc(100dvh - 88px)' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <nav className="flex w-full flex-col">
              {NAV_LINKS.map((link, index) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center p-4 text-lg font-semibold leading-7 text-white transition-opacity hover:opacity-100 active:opacity-50 ${
                    index === 0 ? '' : 'opacity-72'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <Button href="#booking" className="w-full justify-center" onClick={() => setOpen(false)}>
              Book a Ride
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
