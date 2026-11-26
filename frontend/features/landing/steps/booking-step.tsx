'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import type { BookingStep as BookingStepModel } from '@/features/landing/model/landing-copy';

interface BookingStepProps {
  step: BookingStepModel;
  position: number;
}

/**
 * One of the three booking steps.
 *
 * The number badge sits over the boundary between the photograph and the
 * text block rather than inside either one, which is why it is positioned
 * against the card and not against the copy. It scales up on its own spring
 * after the card has arrived so the step count reads before the copy.
 */
export function BookingStep({ step, position }: BookingStepProps) {
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-card bg-white transition-transform duration-500 ease-out hover:-translate-y-1.5">
      <div className="relative h-[184px] shrink-0 overflow-hidden">
        <Image
          src={step.image}
          alt={step.alt}
          fill
          sizes="(max-width: 768px) 80vw, 326px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 30.71%), linear-gradient(0deg, rgba(0,0,0,1) 7.37%, rgba(0,0,0,0) 22.02%)',
          }}
        />
      </div>

      <div className="flex min-h-[200px] flex-col justify-center gap-4 bg-ink-soft p-4 text-white">
        <h3 className="font-display text-[32px] font-semibold leading-10">{step.title}</h3>
        <p className="text-lg leading-7 text-white/72">{step.body}</p>
      </div>

      <motion.span
        className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-pill bg-white font-display text-[32px] font-semibold leading-10 text-ink"
        initial={{ opacity: 0, scale: 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: false, amount: 0.6 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.6, delay: 0.05 }}
      >
        {position}
      </motion.span>
    </article>
  );
}
