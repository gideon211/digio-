'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { HERO, HERO_STATS } from '@/features/landing/model/landing-copy';
import { Icon } from '@/shared/ui/icon/icon';
import { Button } from '@/shared/ui/button/button';

/**
 * The hero entrance.
 *
 * The design animates three things on load: the city photograph scales up
 * from 0.88, the header drops in from 200px above, and the headline scales
 * down from 1.2. Each runs on a spring with no bounce so the motion settles
 * rather than wobbling, which keeps the page feeling calm rather than bouncy.
 */
const SPRING = { type: 'spring', bounce: 0, duration: 2 } as const;

/**
 * The four proof points under the hero.
 *
 * They stagger upward by 200px each, so the row assembles rather than
 * arriving at once. The offsets are large on purpose: the row sits below the
 * fold on a phone, and a small stagger would read as a single jump.
 */
const STAT_OFFSETS = [200, 400, 600, 800];

export function Hero() {
  return (
    <section className="relative isolate h-[964px] overflow-hidden bg-night lg:h-[1024px]">
      <motion.div
        className="absolute inset-0 -z-10"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
      >
        <Image
          src="/img/hero-city.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_75%]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.438) 28.122%, rgba(0,0,0,0) 50%), linear-gradient(2.85deg, rgba(0,0,0,1) 2.36%, rgba(0,0,0,0) 18.92%)',
          }}
        />
      </motion.div>

      <motion.header
        className="absolute inset-x-0 top-0 hidden items-center justify-between px-8 py-4 lg:flex"
        initial={{ opacity: 0, y: -200 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <Image src="/img/logo.svg" alt="Digio" width={98} height={40} className="h-10 w-[98px]" />
        <HeroNav />
        <Button href="#booking">Book a Ride</Button>
      </motion.header>

      <motion.div
        className="absolute left-1/2 top-[calc(50%-202px)] flex w-[min(382px,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-6 text-center lg:top-[calc(50%-234px)] lg:w-[739px]"
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
      >
        <h1 className="w-full font-display text-[48px] font-bold leading-[56px] tracking-[-0.24px] text-white lg:w-[484px] lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
          {HERO.title}
        </h1>
        <p className="w-full text-lg leading-7 text-white/72">{HERO.body}</p>
        <div className="flex w-full flex-col items-center gap-4 lg:flex-row lg:justify-center">
          <Button href="#fleet" className="w-full justify-center lg:w-auto">
            {HERO.primaryCta}
          </Button>
          <Button href="#about" variant="tertiary" className="w-full justify-center lg:w-auto">
            {HERO.secondaryCta}
          </Button>
        </div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-6 lg:p-8">
        {HERO_STATS.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="flex flex-1 flex-col items-center justify-center rounded-pill"
            initial={{ opacity: 0, y: STAT_OFFSETS[index] ?? 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
          >
            <span className="flex items-center text-lg font-semibold leading-7 text-white lg:font-display lg:text-[32px] lg:leading-10">
              {stat.value}
              {stat.showStar && (
                <Icon name="star" className="ml-0.5 size-5 lg:size-8" />
              )}
            </span>
            <span className="text-xs leading-4 text-white lg:text-lg lg:leading-7">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/**
 * The desktop navigation.
 *
 * It sits between the logo and the booking button as the middle column of a
 * three-column header, so the links read as the centre of the bar rather than
 * as a menu pinned to the right edge. Home is the current page and therefore
 * the only link at full strength.
 */
function HeroNav() {
  return (
    <nav className="flex items-center gap-10 text-lg font-semibold leading-7 text-white">
      <a href="#top" className="transition-opacity hover:opacity-70 active:opacity-50 focus-ring">
        Home
      </a>
      <a href="#fleet" className="opacity-72 transition-opacity hover:opacity-100 active:opacity-50 focus-ring">
        Our Fleet
      </a>
      <a href="#about" className="opacity-72 transition-opacity hover:opacity-100 active:opacity-50 focus-ring">
        About Us
      </a>
      <a href="#contact" className="opacity-72 transition-opacity hover:opacity-100 active:opacity-50 focus-ring">
        Contact Us
      </a>
    </nav>
  );
}
