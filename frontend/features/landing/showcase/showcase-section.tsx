'use client';

import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { SHOWCASE } from '@/features/landing/model/landing-copy';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The showcase car is a 1280x820 canvas cut into five 256px wide windows.
 *
 * Odd windows start 142px down the canvas and are 678px tall, even windows
 * start at the top and are 734px tall. The two shapes keep the background
 * stepping while the car body stays on one horizontal line.
 */
const WINDOW_LOW = {
  top: '17.3171%',
  height: '82.6829%',
  imageHeight: '117.99%',
} as const;

const WINDOW_HIGH = {
  top: '0%',
  height: '89.5122%',
  imageHeight: '108.99%',
} as const;

/**
 * Every window renders its full panorama at 465.8% of the window width, which
 * is 1192x800 on the 1280px canvas. Each window keeps a slightly different
 * left and top offset because the five renders were generated separately and
 * hand-nudged until the body met at the seams. These percentages are the
 * frame's own values, not a step of 256, so do not round them into one.
 */
const PANORAMA_WIDTH = '465.8%';

interface RideWindow {
  src: string;
  left: string;
  imageTop: string;
  shape: typeof WINDOW_LOW | typeof WINDOW_HIGH;
}

const RIDE_WINDOWS: RideWindow[] = [
  { src: '/img/ride-1.png', left: '0.1%', imageTop: '-18.01%', shape: WINDOW_LOW },
  { src: '/img/ride-2.png', left: '-105.14%', imageTop: '3.32%', shape: WINDOW_HIGH },
  { src: '/img/ride-3.png', left: '-211.08%', imageTop: '-17.99%', shape: WINDOW_LOW },
  { src: '/img/ride-4.png', left: '-303.84%', imageTop: '4.37%', shape: WINDOW_HIGH },
  { src: '/img/ride-5.png', left: '-404.38%', imageTop: '-16.18%', shape: WINDOW_LOW },
];

/**
 * The size of the vertical drift the whole collage makes across its scroll
 * travel. Big enough to feel the page moving, small enough that the car never
 * leaves the band.
 */
const COLLAGE_DRIFT = 48;

const ENTRY_SPRING = { type: 'spring', bounce: 0, duration: 0.75 } as const;
const HOVER_SPRING = { type: 'spring', bounce: 0, duration: 0.5 } as const;

export function ShowcaseSection() {
  const collageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({ target: collageRef, offset: ['start end', 'end start'] });
  const travel = reduced ? 0 : COLLAGE_DRIFT;
  const y = useTransform(scrollYProgress, [0, 1], [travel, -travel]);

  return (
    <section className="flex flex-col items-center gap-12 overflow-hidden bg-ink p-6 lg:px-8 lg:py-32">
      <div className="flex w-full max-w-[736px] flex-col items-center gap-4 text-center">
        <Reveal className="w-full" distance={24}>
          <h2 className="w-full font-display text-[56px] font-bold leading-[64px] tracking-[-0.56px] text-white">
            {SHOWCASE.title}
          </h2>
        </Reveal>
        <Reveal className="w-full" distance={24} delay={0.06}>
          <p className="w-full text-lg leading-7 text-white/72">{SHOWCASE.body}</p>
        </Reveal>
      </div>

      <div ref={collageRef} className="w-full max-w-[1280px]">
        <motion.div
          className="relative flex aspect-[1280/820] w-full will-change-transform"
          style={{ y }}
        >
          {RIDE_WINDOWS.map((ride, index) => {
            const isLow = ride.shape === WINDOW_LOW;
            const isHovered = hovered === index;
            const isDimmed = hovered !== null && !isHovered;

            return (
              <motion.div
                key={ride.src}
                className="relative h-full w-1/5"
                initial={{ opacity: 0, y: isLow ? 56 : -56 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ ...ENTRY_SPRING, delay: index * 0.06 }}
                onHoverStart={() => setHovered(index)}
                onHoverEnd={() => setHovered(null)}
              >
                <motion.div
                  className="absolute inset-x-0 overflow-hidden"
                  style={{ top: ride.shape.top, height: ride.shape.height }}
                  animate={{ y: isHovered ? -14 : 0 }}
                  transition={HOVER_SPRING}
                >
                  <motion.div
                    className="absolute"
                    style={{
                      left: ride.left,
                      top: ride.imageTop,
                      width: PANORAMA_WIDTH,
                      height: ride.shape.imageHeight,
                    }}
                    animate={{ scale: isHovered ? 1.05 : 1, opacity: isDimmed ? 0.55 : 1 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
                  >
                    <Image
                      src={ride.src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 1280px"
                      className="object-cover"
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
