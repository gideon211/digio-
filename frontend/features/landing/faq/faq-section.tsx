'use client';

import { useState } from 'react';
import { FAQ_ENTRIES } from '@/features/landing/model/landing-copy';
import { Reveal } from '@/shared/ui/reveal/reveal';
import { FaqItem } from './faq-item';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="flex flex-col items-center gap-8 bg-ink px-6 py-12 lg:gap-12 lg:px-8 lg:py-16">
      <Reveal className="w-full" distance={24}>
        <h2 className="w-full text-center font-display text-[36px] font-bold leading-[44px] tracking-[-0.36px] text-white lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
          Frequently Asked Questions
        </h2>
      </Reveal>

      <div className="flex w-full max-w-[1071px] flex-col gap-3 lg:gap-6">
        {FAQ_ENTRIES.map((entry, index) => (
          <Reveal key={entry.question} className="w-full" distance={20} delay={index * 0.035}>
            <FaqItem
              entry={entry}
              open={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
