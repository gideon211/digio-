'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { FaqEntry } from '@/features/landing/model/landing-copy';
import { Icon } from '@/shared/ui/icon/icon';

interface FaqItemProps {
  entry: FaqEntry;
  open: boolean;
  onToggle: () => void;
}

/**
 * The frame spaces the question and the answer by 23px rather than 24px.
 * The extra pixel is already in the question's 28px line box, so using 24
 * here pushes the open row past the frame's 127px height.
 */
const QUESTION_ANSWER_GAP = 23;

/**
 * One question in the accordion.
 *
 * The closed row clamps its text to a single 32px line, which is why long
 * mobile questions appear cut off exactly as they do in the frame. Opening
 * the row releases the clamp so the full question and answer are readable.
 */
export function FaqItem({ entry, open, onToggle }: FaqItemProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-8 overflow-hidden rounded-pill bg-ink-soft p-6 text-left"
    >
      <span
        className={`flex flex-col overflow-hidden ${open ? '' : 'h-8'}`}
        style={{ rowGap: QUESTION_ANSWER_GAP }}
      >
        <span className="font-display text-display-md font-semibold text-white">{entry.question}</span>
        <AnimatePresence initial={false}>
          {open && (
            <motion.span
              className="block text-lg leading-7 text-white/72"
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

      <span className="grid size-14 shrink-0 place-items-center text-white">
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
