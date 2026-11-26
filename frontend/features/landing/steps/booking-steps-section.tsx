'use client';

import { BOOKING_STEPS, STEPS } from '@/features/landing/model/landing-copy';
import { Reveal } from '@/shared/ui/reveal/reveal';
import { BookingStep } from './booking-step';

/**
 * The three booking steps.
 *
 * The cards come in from below one at a time. The delay is tied to the index
 * rather than to a fixed timeline so the third card only starts moving once
 * the first has almost settled, which keeps the row legible as a sequence.
 */
export function BookingStepsSection() {
  return (
    <section id="booking" className="flex flex-col items-center gap-12 bg-ink px-6 py-24 lg:px-8 lg:py-32">
      <div className="flex w-full max-w-[736px] flex-col items-center gap-4 text-center">
        <Reveal className="w-full" distance={24}>
          <h2 className="w-full font-display text-[48px] font-bold leading-[56px] tracking-[-0.24px] text-white lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
            {STEPS.title}
          </h2>
        </Reveal>
        <Reveal className="w-full" distance={24} delay={0.06}>
          <p className="w-full text-lg leading-7 text-white/72">{STEPS.body}</p>
        </Reveal>
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-6 lg:flex-row">
        {BOOKING_STEPS.map((step, index) => (
          <Reveal
            key={step.title}
            className="w-full max-w-[326px]"
            distance={56}
            delay={index * 0.07}
          >
            <BookingStep step={step} position={index + 1} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
