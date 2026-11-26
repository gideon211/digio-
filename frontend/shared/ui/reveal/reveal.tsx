'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  axis?: 'y' | 'x';
}

/**
 * Content that lifts into place when it enters the viewport.
 *
 * The animation runs again on the way back up rather than only once, so the
 * page keeps its motion when someone scrolls in either direction. Springs with
 * no bounce are used instead of eased keyframes because a spring settles by
 * itself, which matters when a section can be entered at any scroll speed.
 */
export function Reveal({ children, className, delay = 0, distance = 32, axis = 'y' }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, [axis]: distance }}
      whileInView={{ opacity: 1, [axis]: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.65, delay }}
    >
      {children}
    </motion.div>
  );
}
