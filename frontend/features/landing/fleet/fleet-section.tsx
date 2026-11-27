'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { useState } from 'react';
import { FLEET_SLIDES } from '@/features/landing/model/landing-copy';
import { Button } from '@/shared/ui/button/button';
import { Icon } from '@/shared/ui/icon/icon';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The fleet carousel.
 *
 * Every slide owns the whole section: the photograph on the left is repeated
 * full bleed behind the section, blurred and dimmed, and both copies crossfade
 * together. Figma pairs the background and the card image per slide, so a
 * shared background would break the transition the moment the slide changes.
 *
 * The copy is not swapped in and out. Figma keeps the three text blocks
 * stacked in one strip and moves the strip up by one slide at a time, which
 * is what makes the section read as a reel rather than three separate fades.
 * The strip's step is a CSS variable because it is 416px on desktop and 352px
 * on phones, where the title is shorter and the gap between blocks is smaller.
 *
 * The card image does not simply crossfade. In Figma each slide is a stack of
 * three photographs where only the active one is visible and the hidden two
 * are parked at half size, so smart animate fades the incoming photograph in
 * while it grows to fill the square. The outgoing photograph keeps its size
 * and only fades, which is why the two directions use different transitions.
 *
 * The dots sit under the card on phones and vertically on the right edge of
 * the section on desktop, matching the two placements in the design.
 */

const SLIDE_TRANSITION: Transition = {
  duration: 0.56,
  ease: [0.22, 1, 0.36, 1],
};

const HIDDEN_IMAGE_SCALE = 0.5;

interface FleetDotsProps {
  index: number;
}

function FleetDots({ index }: FleetDotsProps) {
  return (
    <div aria-hidden className="flex items-center gap-3 lg:flex-col">
      {FLEET_SLIDES.map((slide, dot) => (
        <span
          key={slide.title}
          className={`size-4 rounded-pill transition-colors duration-300 ${
            dot === index ? 'bg-white' : 'bg-white/56'
          }`}
        />
      ))}
    </div>
  );
}

export function FleetSection() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : SLIDE_TRANSITION;

  const move = (delta: number) => {
    setIndex((current) => (current + delta + FLEET_SLIDES.length) % FLEET_SLIDES.length);
  };

  return (
    <section
      id="fleet"
      className="relative isolate flex flex-col items-center overflow-hidden bg-ink px-6 py-14 lg:h-[1024px] lg:flex-row lg:justify-center lg:gap-14 lg:px-8 lg:py-8"
    >
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-ink">
        <AnimatePresence initial={false}>
          <motion.div
            key={FLEET_SLIDES[index].image}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <Image
              src={FLEET_SLIDES[index].image}
              alt=""
              fill
              sizes="100vw"
              className="scale-110 object-cover blur-[12px]"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/56" />
      </div>

      <Reveal
        className="relative aspect-square w-full max-w-[382px] shrink-0 overflow-hidden rounded-pill lg:size-[512px]"
        distance={-56}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={FLEET_SLIDES[index].image}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: HIDDEN_IMAGE_SCALE }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <Image
              src={FLEET_SLIDES[index].image}
              alt={FLEET_SLIDES[index].alt}
              fill
              sizes="(max-width: 1024px) 90vw, 512px"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </Reveal>

      <div className="mt-10 lg:hidden">
        <FleetDots index={index} />
      </div>

      <Reveal
        className="mt-2 flex w-full flex-col items-start gap-6 lg:mt-0 lg:w-[616px] lg:gap-14"
        distance={56}
      >
        <div className="relative h-[300px] w-full overflow-hidden">
          <div
            className="flex flex-col gap-16 transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] [--slide-pitch:352px] motion-reduce:transition-none lg:gap-32 lg:[--slide-pitch:416px]"
            style={{ transform: `translateY(calc(var(--slide-pitch) * ${-index}))` }}
          >
            {FLEET_SLIDES.map((slide) => (
              <div key={slide.title} className="flex h-[288px] w-full flex-col gap-6 lg:items-start">
                <h2 className="text-wrap font-display text-[32px] font-bold leading-[40px] tracking-[-0.16px] text-white lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
                  {slide.title}
                </h2>
                <p className="max-w-[616px] text-lg leading-7 text-white/72">{slide.body}</p>
                <Button href="#booking" variant="tertiary" className="justify-center">
                  {slide.cta}
                </Button>
              </div>
            ))}
          </div>
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

      <div className="absolute right-[77px] top-[434px] hidden lg:block">
        <FleetDots index={index} />
      </div>
    </section>
  );
}
