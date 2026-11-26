'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';
import { FLEET_SLIDES } from '@/features/landing/model/landing-copy';
import { Icon } from '@/shared/ui/icon/icon';
import { Button } from '@/shared/ui/button/button';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The fleet carousel.
 *
 * The design stacks three slides and scrolls a fixed window over them, with a
 * three-dot indicator on the right showing which one is showing. This keeps
 * that shape but drives it from a slide index, so the arrows, the dots and the
 * keyboard all agree about where you are.
 *
 * The two halves come in from opposite edges as the section arrives. The
 * photograph has to travel farther than the copy, so the eye reads the car
 * first and the text settles in behind it.
 */
export function FleetSection() {
  const [index, setIndex] = useState(0);
  const slide = FLEET_SLIDES[index];

  const move = (delta: number) => {
    setIndex((current) => (current + delta + FLEET_SLIDES.length) % FLEET_SLIDES.length);
  };

  return (
    <section
      id="fleet"
      className="relative isolate flex flex-col items-center justify-center gap-14 overflow-hidden bg-ink px-6 py-20 lg:h-[1024px] lg:flex-row lg:gap-14 lg:px-8 lg:py-8"
    >
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src="/img/fleet-1.png"
          alt=""
          fill
          sizes="100vw"
          className="scale-110 object-cover blur-[12px]"
        />
        <div className="absolute inset-0 bg-black/56" />
      </div>

      <Reveal
        className="relative size-[382px] shrink-0 overflow-hidden rounded-pill lg:size-[512px]"
        distance={-56}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.image}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              sizes="(max-width: 1024px) 382px, 512px"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </Reveal>

      <Reveal className="flex w-full flex-col items-start gap-6 lg:w-[616px]" distance={56}>
        <div className="flex h-[288px] w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.title}
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -32 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
            >
              <h2 className="font-display text-[48px] font-bold leading-[56px] tracking-[-0.24px] text-white lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
                {slide.title}
              </h2>
              <p className="max-w-[616px] text-lg leading-7 text-white/72">{slide.body}</p>
              <Button href="#booking" variant="tertiary">
                {slide.cta}
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous vehicle"
            className="group grid size-14 place-items-center rounded-pill border-2 border-white text-white transition-[color,background-color,transform] duration-300 hover:scale-105 hover:bg-white"
          >
            <Icon
              name="chevron-left"
              className="h-3.5 w-4 transition-[filter] duration-300 group-hover:invert"
            />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next vehicle"
            className="group grid size-14 place-items-center rounded-pill border-2 border-white text-white transition-[color,background-color,transform] duration-300 hover:scale-105 hover:bg-white"
          >
            <Icon
              name="chevron-right"
              className="h-3.5 w-4 transition-[filter] duration-300 group-hover:invert"
            />
          </button>
        </div>
      </Reveal>

      <div aria-hidden className="absolute right-4 top-1/2 hidden -translate-y-1/2 lg:block">
        <Image src="/img/scrollbar.svg" alt="" width={16} height={72} className="h-[72px] w-4" />
      </div>
    </section>
  );
}
