'use client';

import Image from 'next/image';
import { CLOSING } from '@/features/landing/model/landing-copy';
import { Button } from '@/shared/ui/button/button';
import { Parallax } from '@/shared/motion/parallax/parallax';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The closing call to action.
 *
 * The photograph sits behind a flat 56 percent black wash rather than a
 * gradient. A gradient would darken the top of the band where the headline
 * sits and leave the bottom bright, which splits the focus; a flat wash puts
 * the whole band at the same distance from the text.
 *
 * The wash drifts with the scroll behind the copy, so the band reads as a
 * window onto a moving street rather than a still backdrop.
 */
export function CtaSection() {
  return (
    <section className="relative isolate flex flex-col items-center gap-12 overflow-hidden bg-ink px-6 py-24 lg:px-8 lg:py-32">
      <Parallax className="absolute -inset-y-20 inset-x-0 -z-10" distance={24}>
        <div className="relative h-full w-full">
          <Image src="/img/cta-band.png" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-black/56" />
        </div>
      </Parallax>

      <div className="flex w-full max-w-[616px] flex-col items-center gap-6 text-center">
        <Reveal className="w-full" distance={24}>
          <h2 className="w-full font-display text-[48px] font-bold leading-[56px] tracking-[-0.24px] text-white">
            {CLOSING.title}
          </h2>
        </Reveal>
        <Reveal className="w-full" distance={24} delay={0.06}>
          <p className="w-full text-lg leading-7 text-white/72">{CLOSING.body}</p>
        </Reveal>
        <Reveal distance={20} delay={0.12}>
          <Button href="#booking">{CLOSING.cta}</Button>
        </Reveal>
      </div>
    </section>
  );
}
