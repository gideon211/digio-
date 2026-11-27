'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { FaqEntry } from '@/features/landing/model/landing-copy';
import { Icon } from '@/shared/ui/icon/icon';
import { vibrateOnTap } from '@/shared/ui/haptic/haptic';

interface FaqItemProps {
  entry: FaqEntry;
  open: boolean;
  onToggle: () => void;
}

/**
 * One question in the accordion.
 *
 * Phones get a compact row: tighter padding, a smaller chevron and no fixed
 * line height, so a long question wraps instead of being cut off. The desktop
 * row keeps the frame's 104px height by clamping the question to one line and
 * holding the chevron in a 56px square.
 *
 * The frame spaces the question and the answer by 23px rather than 24px. The
 * extra pixel is already in the question's 28px line box, so using 24 there
 * would push the open row past the frame's 127px height.
 */
export function FaqItem({ entry, open, onToggle }: FaqItemProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        vibrateOnTap();
        onToggle();
      }}
      className="flex w-full items-center justify-between gap-4 overflow-hidden rounded-pill bg-ink-soft p-4 text-left transition-colors duration-300 hover:bg-white/5 active:bg-white/10 focus-ring lg:gap-8 lg:p-6"
    >
      <span
        className={`flex flex-col gap-y-2 overflow-hidden lg:gap-y-[23px] ${open ? '' : 'lg:h-8'}`}
      >
        <span className="font-display text-[20px] font-semibold leading-7 text-white lg:text-display-md">
          {entry.question}
        </span>
        <AnimatePresence initial={false}>
          {open && (
            <motion.span
              className="block text-base leading-6 text-white/72 lg:text-lg lg:leading-7"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {entry.answer}
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <span className="grid size-8 shrink-0 place-items-center text-white lg:size-14">
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        >
          <Icon name="chevron-down" className="h-1.5 w-3" />
        </motion.span>
      </span>
    </button>
  );
}
