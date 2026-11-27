'use client';

import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * The first-load brand moment.
 *
 * The wordmark assembles letter by letter out of a mask and a hairline fills
 * underneath, then the whole cover lifts like a curtain. The letters entering
 * from below imply the page is being pulled up, so the exit continues the
 * same direction instead of fading, which would read as a separate event.
 *
 * Scroll is locked while the cover is up. Otherwise a swipe during the hold
 * moves the page behind it and the curtain reveals the hero halfway down.
 * The gutter is reserved globally so removing the scrollbar cannot reflow
 * the layout when the lock is released.
 *
 * Reduced-motion visitors get no cover at all. It is hidden with a CSS media
 * query rather than a hook so it never flashes on the server render, and the
 * timeout still runs so the element unmounts on the same schedule.
 */
const WORD = ['D', 'i', 'g', 'i', 'o'];

const HOLD_MS = 1500;
const EXIT_SECONDS = 0.8;
const LETTER_STAGGER = 0.07;

const LETTER: Variants = {
  hidden: { y: '115%' },
  visible: (index: number) => ({
    y: '0%',
    transition: { type: 'spring', bounce: 0, duration: 0.7, delay: index * LETTER_STAGGER },
  }),
};

const HAIRLINE: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.85, ease: 'easeInOut', delay: 0.25 } },
};

const EXIT: Transition = {
  duration: EXIT_SECONDS,
  ease: [0.76, 0, 0.24, 1],
};

export function PageLoader() {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduced) {
      setDone(true);
      return;
    }

    const timer = window.setTimeout(() => setDone(true), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (done) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previous;
    };
  }, [done]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          aria-hidden
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 overflow-hidden bg-ink motion-reduce:hidden"
          initial={{ y: 0 }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={EXIT}
        >
          <motion.div
            className="flex flex-col items-center gap-8"
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeIn' }}
          >
            <div className="flex overflow-hidden font-display text-[64px] font-bold leading-[1.1] tracking-[-0.03em] text-white lg:text-[88px]">
              {WORD.map((letter, index) => (
                <motion.span
                  key={`${letter}-${index}`}
                  custom={index}
                  variants={LETTER}
                  initial="hidden"
                  animate="visible"
                  className="inline-block"
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            <span className="relative block h-px w-[120px] overflow-hidden bg-white/16">
              <motion.span
                variants={HAIRLINE}
                initial="hidden"
                animate="visible"
                className="absolute inset-0 origin-left bg-white"
              />
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
