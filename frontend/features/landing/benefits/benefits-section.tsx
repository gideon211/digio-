'use client';

import { BENEFITS, BENEFIT_CARDS } from '@/features/landing/model/landing-copy';
import { Reveal } from '@/shared/ui/reveal/reveal';
import { BenefitCard } from './benefit-card';

/**
 * The four reasons to book.
 *
 * On a phone the cards become a horizontal strip rather than a stack. A
 * single column of tall cards pushes the next section a long way down, and
 * swiping sideways is the gesture people already expect from a row of cars.
 *
 * The cards enter one after another instead of together. The stagger is short
 * enough that the row still reads as a single movement, but it leaves the eye
 * enough time to land on each card in turn.
 */
export function BenefitsSection() {
  return (
    <section className="flex flex-col gap-12 overflow-hidden bg-white px-6 py-16 lg:px-8 lg:py-32">
      <div className="flex w-full flex-col items-center gap-4 text-center text-ink">
        <Reveal className="w-full max-w-[736px]" distance={24}>
          <h2 className="w-full font-display text-[48px] font-bold leading-[64px] tracking-[-0.24px] lg:text-[56px] lg:tracking-[-0.56px]">
            {BENEFITS.title}
          </h2>
        </Reveal>
        <Reveal className="w-full max-w-[736px]" distance={24} delay={0.06}>
          <p className="w-full text-lg leading-7 text-ink/72">{BENEFITS.body}</p>
        </Reveal>
      </div>

      <div className="flex w-full gap-6 overflow-x-auto pb-2 lg:overflow-visible">
        {BENEFIT_CARDS.map((card, index) => (
          <Reveal
            key={card.title}
            className="w-[80vw] shrink-0 lg:w-auto lg:flex-1"
            distance={48}
            delay={index * 0.05}
          >
            <BenefitCard card={card} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
