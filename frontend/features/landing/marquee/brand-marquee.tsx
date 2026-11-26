'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

/**
 * The width of one cycle of the brand strip artwork.
 *
 * The SVG repeats twelve marks three times across its 3684px width, so a
 * cycle is a third of that. Translating by exactly one cycle is what makes
 * the loop seamless: any other distance would show a seam where the strip
 * jumps back to its start.
 */
const CYCLE_WIDTH = 1228;

/**
 * The design scrolls the strip by 2254px over 30 seconds. That distance is
 * not a whole number of cycles, so it cannot loop. One cycle per 30 seconds
 * keeps the same linear rhythm and the same content on screen at any moment,
 * with no jump.
 */
const SCROLL_SECONDS = 30;

export function BrandMarquee() {
  return (
    <div className="relative h-12 w-full overflow-hidden">
      <motion.div
        className="flex h-12 w-max"
        animate={{ x: [0, -CYCLE_WIDTH] }}
        transition={{ duration: SCROLL_SECONDS, ease: 'linear', repeat: Infinity }}
      >
        <Image
          src="/img/brand-strip.svg"
          alt="Audi, Bentley, Lamborghini, Ferrari, Aston Martin, Bugatti, Mercedes-Benz, Rolls-Royce, Land Rover, BMW, Porsche and Lexus"
          width={3684}
          height={48}
          className="h-12 w-[3684px] max-w-none shrink-0"
        />
      </motion.div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(-24.34deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 12.37%)',
        }}
      />
    </div>
  );
}
